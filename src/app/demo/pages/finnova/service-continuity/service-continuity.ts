import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  BackupSnapshotRecord,
  BackupType,
  CircuitState,
  ContinuityRiskItem,
  CriticalServiceItem,
  DrpDrillResult,
  ServiceContinuityService
} from 'src/app/services/service-continuity.service';

@Component({
  selector: 'app-service-continuity',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './service-continuity.html',
  styleUrl: './service-continuity.scss'
})
export class ServiceContinuityComponent implements OnInit, OnDestroy {
  public continuity = inject(ServiceContinuityService);
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'bia' | 'risks' | 'backups' | 'drp' = 'bia';

  services: CriticalServiceItem[] = [];
  risks: ContinuityRiskItem[] = this.continuity.RISKS;
  backups: BackupSnapshotRecord[] = [];
  drills: DrpDrillResult[] = [];
  circuitState: CircuitState = 'CLOSED';

  selectedDrill: DrpDrillResult | null = null;
  lastRiskTestBanner = '';
  isBusy = false;
  statusToast = '';

  private subs: Subscription[] = [];

  ngOnInit() {
    this.subs.push(
      this.continuity.services$.subscribe(list => (this.services = list)),
      this.continuity.backups$.subscribe(list => (this.backups = list)),
      this.continuity.drills$.subscribe(list => {
        this.drills = list;
        if (!this.selectedDrill && list.length > 0) {
          this.selectedDrill = list[0];
        }
      }),
      this.continuity.circuitState$.subscribe(st => (this.circuitState = st))
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  get latestMeasuredRto(): string {
    return this.drills.length > 0 ? `${this.drills[0].measuredRtoSec} s` : '1.18 s';
  }

  get latestMeasuredRpo(): string {
    return this.drills.length > 0 ? `${this.drills[0].measuredRpoMin} min` : '0 min';
  }

  get verifiedBackupsCount(): number {
    return this.backups.filter(b => b.verified).length;
  }

  async runHealthCheck() {
    if (this.isBusy) return;
    this.isBusy = true;
    try {
      const res = await this.continuity.checkCriticalServicesHealth();
      this.flashToast(
        res.ok
          ? `Health Check OK: HTTP ${res.status} (${res.latencyMs} ms)`
          : `Primario degradado (${res.status}) • Failover Standby activo`
      );
    } finally {
      this.isBusy = false;
      this.cdr.detectChanges();
    }
  }

  toggleFailoverMode() {
    const next: CircuitState = this.circuitState === 'OPEN_FAILOVER' ? 'CLOSED' : 'OPEN_FAILOVER';
    this.continuity.setCircuitState(next);
    this.flashToast(
      next === 'OPEN_FAILOVER'
        ? 'Circuit Breaker: OPEN_FAILOVER (Réplica Standby activa)'
        : 'Circuit Breaker: CLOSED (Tráfico en Nodo Primario)'
    );
  }

  async triggerBackup(type: BackupType) {
    if (this.isBusy) return;
    this.isBusy = true;
    try {
      const snap = await this.continuity.createBackupSnapshot(type);
      this.activeTab = 'backups';
      this.flashToast(`Snapshot ${snap.id} (${snap.type}) • SHA-256 ${snap.sha256.slice(0, 12)}...`);
    } finally {
      this.isBusy = false;
      this.cdr.detectChanges();
    }
  }

  async verifySnapshot(id: string) {
    const res = await this.continuity.verifyBackupIntegrity(id);
    this.flashToast(
      res.valid
        ? `${id} verificado: SHA-256 íntegro (${res.recomputedHash.slice(0, 12)}...)`
        : `Alerta: Checksum inválido en ${id}`
    );
    this.cdr.detectChanges();
  }

  async restoreSnapshot(id: string) {
    if (this.isBusy) return;
    this.isBusy = true;
    try {
      const res = await this.continuity.restoreBackupSnapshot(id);
      this.flashToast(`Restaurado ${id}: ${res.restoredRecords} reg. • RTO ${res.rtoMs} ms • RPO ${res.rpoMin} min`);
    } finally {
      this.isBusy = false;
      this.cdr.detectChanges();
    }
  }

  downloadBackup(id: string, format: 'json' | 'sql') {
    const content = this.continuity.exportSnapshotContent(id, format);
    if (!content) return;
    const mime = format === 'json' ? 'application/json;charset=utf-8' : 'application/sql;charset=utf-8';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id.toLowerCase()}_finnova_drp.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async executeDrill(scenario: 'render-outage' | 'tidb-pitr' | 'vercel-rollback') {
    if (this.isBusy) return;
    this.isBusy = true;
    try {
      const drill = await this.continuity.runDisasterRecoveryDrill(scenario);
      this.selectedDrill = drill;
      this.activeTab = 'drp';
      this.flashToast(`${drill.id} completado • RTO ${drill.measuredRtoSec}s (Meta ≤ ${drill.targetRtoSec}s)`);
    } finally {
      this.isBusy = false;
      this.cdr.detectChanges();
    }
  }

  async runRiskTest(riskId: string) {
    if (this.isBusy) return;
    this.isBusy = true;
    try {
      const res = await this.continuity.testRiskScenario(riskId);
      this.lastRiskTestBanner = res.summary;
      this.flashToast(`${res.riskId} validado → ${res.eventId}`);
    } finally {
      this.isBusy = false;
      this.cdr.detectChanges();
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  private flashToast(msg: string) {
    this.statusToast = msg;
    setTimeout(() => {
      if (this.statusToast === msg) {
        this.statusToast = '';
        this.cdr.detectChanges();
      }
    }, 3500);
  }
}
