import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgApexchartsModule, ApexOptions } from 'ng-apexcharts';
import { Subscription } from 'rxjs';
import {
  BpmnLiveState,
  EventClassification,
  EventMonitoringService,
  LatencySample,
  MonitoringEvent,
  MonitoringPolicy,
  ResponsePlaybook
} from 'src/app/services/event-monitoring.service';
import { FinnovaDataService } from 'src/app/services/finnova-data.service';

@Component({
  selector: 'app-event-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgApexchartsModule],
  templateUrl: './event-monitoring.html',
  styleUrl: './event-monitoring.scss'
})
export class EventMonitoringComponent implements OnInit, OnDestroy {
  public monitor = inject(EventMonitoringService);
  public dataService = inject(FinnovaDataService);

  activeTab: 'live' | 'policies' | 'playbooks' | 'tooling' = 'live';
  activeConfigTab: 'cli' | 'promql' | 'github' | 'interceptor' = 'cli';

  // Filtros independientes del stream de eventos
  filterClass: 'TODOS' | EventClassification = 'TODOS';
  filterSource = 'TODOS';
  eventSearch = '';
  selectedEvent: MonitoringEvent | null = null;

  // Auto-polling real en vivo
  autoPolling = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  lastProbeAt = 'Pendiente de ejecución';

  // Políticas editables en vivo
  policyForm: MonitoringPolicy = { ...this.monitor.policy };
  policySavedBanner = false;

  // Consola de ejecución de playbooks
  playbookTerminalLog: string[] = [
    '[NOC-READY] Motor de Eventos Finnova inicializado. Ejecute una sonda real o un playbook para ver la traza.'
  ];
  copiedSnippet: string | null = null;

  // Estado reactivo
  events: MonitoringEvent[] = [];
  latencySeries: LatencySample[] = [];
  bpmnState: BpmnLiveState = this.monitor.bpmnState;

  // Opciones de ApexCharts
  latencyChartOptions: Partial<ApexOptions> = {};
  classificationChartOptions: Partial<ApexOptions> = {};

  private subs: Subscription[] = [];

  // Snippets reales de infraestructura del repositorio para inspección técnica
  readonly snippetCli = `# Ejecutar sonda real única contra Finnova Producción (Vercel + Render + TiDB)
npm run monitor

# Ejecutar en modo vigilancia continua (Watch Mode cada 30s)
npm run monitor:watch

# Ejecutar simulacro P1 (correlación + match KEDB + log NDJSON)
npm run monitor:drill

# Salida JSON estructurada lista para SIEM / Datadog / GitHub Actions
node scripts/event-monitor.mjs --once --json`;

  readonly snippetPromql = `# monitoring/prometheus/alert-rules.yml
groups:
  - name: finnova_slo_events
    rules:
      - alert: FinnovaRenderColdStartWarning
        expr: probe_duration_seconds{job="finnova_backend_api"} > 1.5
        for: 1m
        labels: { severity: warning, classification: WARNING, priority: P2 }
        annotations:
          summary: "Latencia > 1.5s en Render API ({{ $value }}s) - Disparar KeepAlive"

      - alert: FinnovaBackendDownException
        expr: probe_success{job="finnova_backend_api"} == 0 or probe_http_status_code >= 500
        for: 30s
        labels: { severity: critical, classification: EXCEPTION, priority: P1, kedb: KEDB-FIN-001 }
        annotations:
          summary: "Outage API Finnova (HTTP {{ $value }}) - Crear Incidente P1 automático"

      - alert: FinnovaRateLimitStorm429
        expr: sum(rate(http_requests_total{status="429"}[1m])) * 60 > 5
        for: 1m
        labels: { severity: critical, classification: EXCEPTION, priority: P1, kedb: KEDB-FIN-002 }`;

  readonly snippetGithub = `# .github/workflows/synthetic-monitor.yml
name: Finnova Synthetic Event Monitor (24/7)
on:
  schedule:
    - cron: '*/15 * * * *'   # Sonda automática cada 15 min (evita Cold Start Render)
  workflow_dispatch:
jobs:
  synthetic-probe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - name: Ejecutar Agente Sintético y Evaluar Políticas
        run: node scripts/event-monitor.mjs --once --json
      - name: Publicar Telemetría NDJSON
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: finnova-event-logs
          path: monitoring/logs/events.ndjson`;

  readonly snippetInterceptor = `// src/app/services/telemetry.interceptor.ts (ACTIVO EN PRODUCCIÓN)
export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  const monitor = inject(EventMonitoringService);
  const start = performance.now();
  return next(req).pipe(
    tap({
      next: (ev) => ev instanceof HttpResponse &&
        monitor.recordHttpTelemetry(req.url, ev.status, performance.now() - start),
      error: (err: HttpErrorResponse) =>
        monitor.recordHttpTelemetry(req.url, err?.status ?? 0, performance.now() - start, err?.message)
    })
  );
};`;

  readonly recommendations = [
    {
      id: 'REC-01',
      area: 'Backend Express (Render)',
      title: 'Endpoint /api/health/deep con estado de Pool TiDB',
      implementation: 'Exponer SELECT 1 + pool._allConnections.length + process.memoryUsage().rss en JSON para que Prometheus/Monitor detecte saturación al 70% antes de ER_CON_COUNT_ERROR.',
      metric: 'Reducción MTTR P1 en -60%'
    },
    {
      id: 'REC-02',
      area: 'Observabilidad Distribuida',
      title: 'Instrumentación OpenTelemetry + Correlation-ID',
      implementation: 'Propagar cabecera X-Correlation-Id desde Angular telemetryInterceptor hasta Express y logs SQL de TiDB para trazabilidad end-to-end.',
      metric: 'Diagnóstico L2 < 5 min'
    },
    {
      id: 'REC-03',
      area: 'Resiliencia & Continuidad',
      title: 'Circuit Breaker + Retry Exponencial en Cliente HTTP',
      implementation: 'Aplicar retry({ count: 2, delay: 1500 }) en llamadas idempotentes GET de catálogo para absorber micro-cortes de Render sin mostrar pantalla vacía al cliente.',
      metric: 'Disponibilidad percibida > 99.95%'
    },
    {
      id: 'REC-04',
      area: 'Alertamiento & ITSM',
      title: 'Webhook Bidireccional Alertmanager → Jira + Discord/Slack',
      implementation: 'Configurar ALERT_WEBHOOK_URL en GitHub Secrets para que scripts/event-monitor.mjs notifique incidentes P1 en < 15s y abra ticket Jira FCC-* automáticamente.',
      metric: 'MTTA automatizado < 1 min'
    }
  ];

  ngOnInit() {
    this.subs.push(
      this.monitor.events$.subscribe(evts => {
        this.events = evts;
        if (!this.selectedEvent && evts.length > 0) {
          this.selectedEvent = evts[0];
        }
        this.rebuildClassificationChart();
      }),
      this.monitor.latency$.subscribe(series => {
        this.latencySeries = series;
        this.rebuildLatencyChart();
      }),
      this.monitor.bpmnState$.subscribe(state => {
        this.bpmnState = state;
      }),
      this.monitor.policy$.subscribe(pol => {
        this.policyForm = { ...pol };
        this.rebuildLatencyChart();
      })
    );
  }

  ngOnDestroy() {
    this.stopPolling();
    this.subs.forEach(s => s.unsubscribe());
  }

  // --- KPIS EN VIVO ---
  get infoCount(): number {
    return this.events.filter(e => e.classification === 'INFO').length;
  }

  get warningCount(): number {
    return this.events.filter(e => e.classification === 'WARNING').length;
  }

  get exceptionCount(): number {
    return this.events.filter(e => e.classification === 'EXCEPTION').length;
  }

  get autoIncidentsCount(): number {
    return this.events.filter(e => !!e.linkedIncidentId).length;
  }

  get latestApiLatency(): number {
    return this.latencySeries.length ? this.latencySeries[this.latencySeries.length - 1].apiMs : 0;
  }

  get liveAvailabilityPct(): string {
    if (this.events.length === 0) return '99.93';
    const ok = this.events.filter(e => e.httpStatus >= 200 && e.httpStatus < 500).length;
    const pct = Math.max(92, Math.min(100, (ok / this.events.length) * 100));
    return pct.toFixed(2);
  }

  // --- FILTROS DEL STREAM DE EVENTOS ---
  get filteredEvents(): MonitoringEvent[] {
    const q = this.eventSearch.trim().toLowerCase();
    return this.events.filter(e => {
      if (this.filterClass !== 'TODOS' && e.classification !== this.filterClass) return false;
      if (this.filterSource !== 'TODOS' && e.source !== this.filterSource) return false;
      if (q) {
        const hay = `${e.id} ${e.source} ${e.endpoint} ${e.code} ${e.message} ${e.linkedIncidentId || ''} ${e.matchedKbId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  resetEventFilters() {
    this.filterClass = 'TODOS';
    this.filterSource = 'TODOS';
    this.eventSearch = '';
  }

  // --- SONDAS EN VIVO Y AUTO-POLLING ---
  async triggerLiveProbe() {
    this.appendTerminal(`[PROBE] Ejecutando sonda HTTP real contra backend-finnova.onrender.com/api/servicios/publicos...`);
    const emitted = await this.monitor.runLiveProbes();
    this.lastProbeAt = new Date().toTimeString().slice(0, 8);
    if (emitted.length > 0) {
      this.selectedEvent = emitted[0];
      this.appendTerminal(
        `[RESULT] ${emitted[0].id} | ${emitted[0].classification} | HTTP ${emitted[0].httpStatus} | ${emitted[0].latencyMs}ms | ${emitted[0].disposition}`
      );
    }
  }

  toggleAutoPolling() {
    if (this.autoPolling) {
      this.stopPolling();
    } else {
      this.autoPolling = true;
      const ms = Math.max(10, this.policyForm.pollIntervalSec) * 1000;
      this.triggerLiveProbe();
      this.pollTimer = setInterval(() => this.triggerLiveProbe(), ms);
      this.appendTerminal(`[AUTO-POLL] Sonda continua activada cada ${Math.max(10, this.policyForm.pollIntervalSec)}s.`);
    }
  }

  private stopPolling() {
    this.autoPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // --- CHAOS DRILLS (INYECCIÓN TÉCNICA DE EVENTOS) ---
  runDrill(scenario: 'cold-start' | 'tidb-pool' | 'rate-limit-429' | 'payload-413' | 'spa-exception') {
    const evt = this.monitor.simulateScenario(scenario);
    this.selectedEvent = evt;
    this.appendTerminal(
      `[DRILL:${scenario.toUpperCase()}] ${evt.id} → ${evt.classification} (${evt.priority}) | ${evt.disposition}${evt.linkedIncidentId ? ' → Ticket ' + evt.linkedIncidentId : ''}${evt.matchedKbId ? ' | KEDB ' + evt.matchedKbId : ''}`
    );
  }

  // --- GUARDAR POLÍTICAS EN VIVO ---
  savePolicy() {
    this.monitor.updatePolicy({ ...this.policyForm });
    this.policySavedBanner = true;
    this.appendTerminal(
      `[POLICY] Umbrales actualizados: WARN>${this.policyForm.latencyWarnMs}ms, CRIT>${this.policyForm.latencyCritMs}ms, Correlación=${this.policyForm.consecutiveWarnToIncident}x, Dedup=${this.policyForm.dedupWindowSec}s.`
    );
    setTimeout(() => (this.policySavedBanner = false), 2500);
  }

  resetPolicy() {
    this.monitor.resetPolicy();
    this.appendTerminal(`[POLICY] Políticas restablecidas a valores estándar ITIL Finnova.`);
  }

  // --- EJECUCIÓN DE PLAYBOOKS ---
  executePlaybook(pb: ResponsePlaybook) {
    this.appendTerminal(`==========================================================`);
    this.appendTerminal(`[PLAYBOOK ${pb.id}] Iniciando respuesta: ${pb.title} (${pb.severity})`);
    this.appendTerminal(`[TRIGGER] Código: ${pb.triggerCode} | Referencia KEDB: ${pb.kbRef}`);
    for (const cmd of pb.commands) {
      this.appendTerminal(`  $ ${cmd}`);
    }
    this.appendTerminal(`[VERIFY] $ ${pb.verificationCmd}`);
    this.appendTerminal(`[STATUS] Acción automática: ${pb.autoAction}`);
  }

  copyText(text: string, id: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.copiedSnippet = id;
    setTimeout(() => {
      if (this.copiedSnippet === id) this.copiedSnippet = null;
    }, 1800);
  }

  private appendTerminal(line: string) {
    const ts = new Date().toTimeString().slice(0, 8);
    this.playbookTerminalLog = [`[${ts}] ${line}`, ...this.playbookTerminalLog].slice(0, 30);
  }

  // --- APEXCHARTS EN VIVO ---
  private rebuildLatencyChart() {
    const labels = this.latencySeries.map(s => s.time);
    const apiData = this.latencySeries.map(s => s.apiMs);
    const spaData = this.latencySeries.map(s => s.spaMs);
    const warnLine = this.policyForm.latencyWarnMs;
    const critLine = this.policyForm.latencyCritMs;

    this.latencyChartOptions = {
      chart: {
        type: 'area',
        height: 245,
        toolbar: { show: false },
        animations: { enabled: true, speed: 350 }
      },
      series: [
        { name: 'Backend Render + TiDB (ms)', data: apiData },
        { name: 'Frontend SPA Vercel (ms)', data: spaData }
      ],
      colors: ['#0d6efd', '#198754'],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.35, opacityTo: 0.05 }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: labels, labels: { style: { fontSize: '11px' } } },
      yaxis: {
        title: { text: 'Latencia (ms)' },
        min: 0
      },
      annotations: {
        yaxis: [
          {
            y: warnLine,
            borderColor: '#ffc107',
            strokeDashArray: 4,
            label: { text: `WARN ${warnLine}ms`, style: { color: '#000', background: '#ffc107' } }
          },
          {
            y: critLine,
            borderColor: '#dc3545',
            strokeDashArray: 4,
            label: { text: `CRIT ${critLine}ms`, style: { color: '#fff', background: '#dc3545' } }
          }
        ]
      },
      grid: { borderColor: '#e9ecef', strokeDashArray: 3 },
      legend: { position: 'top' }
    };
  }

  private rebuildClassificationChart() {
    this.classificationChartOptions = {
      chart: { type: 'donut', height: 245 },
      series: [this.infoCount, this.warningCount, this.exceptionCount],
      labels: ['INFO (Normal)', 'WARNING (Preventivo)', 'EXCEPTION (Incidente)'],
      colors: ['#0dcaf0', '#ffc107', '#dc3545'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true }
    };
  }
}
