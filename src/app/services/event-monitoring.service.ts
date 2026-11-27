import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  FinnovaDataService,
  IncidentSeverity,
  SupportChangeTicket
} from './finnova-data.service';
import { SKIP_TELEMETRY_PROBE } from './telemetry.interceptor';

export type EventClassification = 'INFO' | 'WARNING' | 'EXCEPTION';
export type EventSource =
  | 'Backend Render API'
  | 'TiDB Cloud AWS'
  | 'Vercel Frontend SPA'
  | 'Auth / Rate Limiter'
  | 'Sonda Sintética'
  | 'HTTP Telemetry Interceptor';

export type EventDisposition =
  | 'Registrado (Log)'
  | 'Auto-Remediado'
  | 'Escalado a Incidente'
  | 'Suprimido (Deduplicado)';

export interface MonitoringEvent {
  id: string;
  timestamp: string;
  source: EventSource;
  endpoint: string;
  classification: EventClassification;
  priority: IncidentSeverity;
  httpStatus: number;
  latencyMs: number;
  metricName: string;
  observedValue: string;
  thresholdValue: string;
  code: string;
  message: string;
  correlatedCount: number;
  disposition: EventDisposition;
  linkedIncidentId?: string;
  matchedKbId?: string;
  playbookId?: string;
  bpmnTrace: string[];
  rawPayload: Record<string, unknown>;
}

export interface MonitoringPolicy {
  pollIntervalSec: number;
  latencyWarnMs: number;
  latencyCritMs: number;
  consecutiveWarnToIncident: number;
  dedupWindowSec: number;
  max429PerMin: number;
  dbPoolWarnPct: number;
  dbPoolCritPct: number;
  autoCreateIncidentOnException: boolean;
  autoExecuteKeepAlive: boolean;
}

export interface LatencySample {
  time: string;
  apiMs: number;
  spaMs: number;
  status: number;
}

export interface ResponsePlaybook {
  id: string;
  title: string;
  triggerCode: string;
  classification: EventClassification;
  severity: IncidentSeverity;
  targetComponent: string;
  kbRef: string;
  autoAction: string;
  escalationPath: string;
  commands: string[];
  verificationCmd: string;
}

export interface BpmnLiveState {
  activeStep: number; // 1..6
  eventId: string;
  classification: EventClassification;
  summary: string;
  stepsLog: { step: number; lane: string; label: string; detail: string; status: 'done' | 'active' | 'skipped' }[];
  payloadPreview: Record<string, unknown>;
}

export interface EventStorageMeta {
  engine: string;
  dbName: string;
  storeName: string;
  persistedCount: number;
  lastWriteAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class EventMonitoringService {
  private http = inject(HttpClient);
  private dataService = inject(FinnovaDataService);
  private baseUrl = (environment as any).apiUrl || 'https://backend-finnova.onrender.com/api';

  private readonly STORAGE_KEY_POLICY = 'finnova_event_monitoring_policy_v1';
  private readonly STORAGE_KEY_EVENTS = 'finnova_event_monitoring_stream_v1';
  private readonly IDB_NAME = 'FinnovaTelemetryDB';
  private readonly IDB_VERSION = 1;
  private readonly IDB_STORE = 'events_wal';
  private idbPromise: Promise<IDBDatabase | null> | null = null;

  public readonly DEFAULT_POLICY: MonitoringPolicy = {
    pollIntervalSec: 30,
    latencyWarnMs: 1500,
    latencyCritMs: 4000,
    consecutiveWarnToIncident: 2,
    dedupWindowSec: 60,
    max429PerMin: 5,
    dbPoolWarnPct: 70,
    dbPoolCritPct: 90,
    autoCreateIncidentOnException: true,
    autoExecuteKeepAlive: true
  };

  public readonly PLAYBOOKS: ResponsePlaybook[] = [
    {
      id: 'PB-001',
      title: 'Saturación de Pool SSL/TLS TiDB Cloud',
      triggerCode: 'ER_CON_COUNT_ERROR',
      classification: 'EXCEPTION',
      severity: 'P1 - Crítico',
      targetComponent: 'TiDB Cloud AWS / Backend Render',
      kbRef: 'KEDB-FIN-001',
      autoAction: 'Crear incidente P1 automático, adjuntar KEDB-FIN-001 y notificar L2 DevOps + eCAB.',
      escalationPath: 'Sonda → L2 DevOps (≤15m) → Tech Lead/DBA L3 → eCAB',
      commands: [
        'mysql -h gateway01.us-east-1.prod.aws.tidbcloud.com -P 4000 --ssl-mode=VERIFY_IDENTITY -e "SHOW FULL PROCESSLIST;"',
        '# Render Env: DB_CONNECTION_LIMIT=15 | db.js -> enableKeepAlive: true, idleTimeout: 60000',
        'curl -s -w "\\nHTTP %{http_code} | %{time_total}s\\n" https://backend-finnova.onrender.com/api/servicios/publicos'
      ],
      verificationCmd: 'node scripts/event-monitor.mjs --once'
    },
    {
      id: 'PB-002',
      title: 'Tormenta HTTP 429 en Login / Rate Limiter',
      triggerCode: 'HTTP_429_RATE_LIMIT',
      classification: 'EXCEPTION',
      severity: 'P1 - Crítico',
      targetComponent: 'Auth / Rate Limiter (Express Render)',
      kbRef: 'KEDB-FIN-002',
      autoAction: 'Correlacionar IPs en X-Forwarded-For, alertar L2 Seguridad y sugerir hotfix trust proxy.',
      escalationPath: 'Interceptor/WAF → L2 Seguridad (≤15m) → Hotfix CHE',
      commands: [
        'curl -I https://backend-finnova.onrender.com/api/servicios/publicos | findstr /I "x-ratelimit http"',
        '# Verificar en backend-finnova/server.js: app.set("trust proxy", 1);',
        '# Workaround: reiniciar servicio Render para limpiar bucket en RAM'
      ],
      verificationCmd: 'for /L %i in (1,1,5) do @curl -s -o NUL -w "Req %i: %{http_code}\\n" https://backend-finnova.onrender.com/api/servicios/publicos'
    },
    {
      id: 'PB-003',
      title: 'Degradación de Latencia / Cold Start Render (HTTP 504)',
      triggerCode: 'COLD_START_TIMEOUT_504',
      classification: 'WARNING',
      severity: 'P2 - Alto',
      targetComponent: 'Backend Render API / KeepAlive',
      kbRef: 'KEDB-FIN-003',
      autoAction: 'Auto-remediación: disparar ping Keep-Alive inmediato. Si persiste 2 ciclos, abrir INC P2.',
      escalationPath: 'Auto-Remediación Cron → L2 DevOps (≤30m)',
      commands: [
        'curl -s -o /dev/null -w "HTTP %{http_code} | TTFB: %{time_starttransfer}s | Total: %{time_total}s\\n" https://backend-finnova.onrender.com/api/servicios/publicos',
        'node scripts/event-monitor.mjs --once',
        '# Verificar cron activo en .github/workflows/synthetic-monitor.yml (*/15 * * * *)'
      ],
      verificationCmd: 'node scripts/event-monitor.mjs --once --json'
    },
    {
      id: 'PB-004',
      title: 'Rechazo HTTP 413 Payload Too Large (Voucher Yape)',
      triggerCode: 'HTTP_413_PAYLOAD_TOO_LARGE',
      classification: 'WARNING',
      severity: 'P3 - Medio',
      targetComponent: 'Vercel Frontend SPA / Express body-parser',
      kbRef: 'KEDB-FIN-004',
      autoAction: 'Registrar evento WARNING, agrupar por usuario/dispositivo y vincular a RFC de compresión.',
      escalationPath: 'Interceptor SPA → Mesa de Ayuda L1 (≤2h)',
      commands: [
        '# Verificar límite express.json({ limit: "5mb" }) y compresión canvas client-side',
        'curl -X OPTIONS -I https://backend-finnova.onrender.com/api/solicitudes'
      ],
      verificationCmd: 'Validar carga de voucher < 1.5MB con HTTP 201'
    },
    {
      id: 'PB-005',
      title: 'Excepción No Controlada en Frontend Angular (SPA)',
      triggerCode: 'SPA_RUNTIME_EXCEPTION',
      classification: 'EXCEPTION',
      severity: 'P2 - Alto',
      targetComponent: 'Vercel Frontend SPA (Angular 22)',
      kbRef: 'KEDB-FIN-006',
      autoAction: 'Capturar stack trace vía GlobalEventErrorHandler, verificar versión build y evaluar Instant Rollback Vercel.',
      escalationPath: 'ErrorHandler → L2 Frontend → Rollback Vercel (<1 min)',
      commands: [
        'curl -I https://finnova-nine.vercel.app',
        'git log -n 3 --oneline',
        '# Si impacta a usuarios: Vercel Dashboard -> Deployments -> Instant Rollback'
      ],
      verificationCmd: 'npm run build-prod'
    }
  ];

  private policySubject = new BehaviorSubject<MonitoringPolicy>(this.loadPolicy());
  public policy$: Observable<MonitoringPolicy> = this.policySubject.asObservable();

  private eventsSubject = new BehaviorSubject<MonitoringEvent[]>(this.loadInitialEvents());
  public events$: Observable<MonitoringEvent[]> = this.eventsSubject.asObservable();

  private latencySubject = new BehaviorSubject<LatencySample[]>(this.buildInitialLatencySeries());
  public latency$: Observable<LatencySample[]> = this.latencySubject.asObservable();

  private bpmnStateSubject = new BehaviorSubject<BpmnLiveState>(this.buildInitialBpmnState());
  public bpmnState$: Observable<BpmnLiveState> = this.bpmnStateSubject.asObservable();

  private storageMetaSubject = new BehaviorSubject<EventStorageMeta>({
    engine: 'IndexedDB WAL + NDJSON',
    dbName: 'FinnovaTelemetryDB',
    storeName: 'events_wal',
    persistedCount: 0,
    lastWriteAt: new Date().toISOString()
  });
  public storageMeta$: Observable<EventStorageMeta> = this.storageMetaSubject.asObservable();

  private consecutiveWarnCounter = new Map<string, number>();
  private lastEventSignatureTs = new Map<string, number>();
  private probeRunning = false;
  private eventSeq = 120;

  constructor() {
    this.hydrateFromIndexedDb();
  }

  get storageMeta(): EventStorageMeta {
    return this.storageMetaSubject.value;
  }

  get policy(): MonitoringPolicy {
    return this.policySubject.value;
  }

  get events(): MonitoringEvent[] {
    return this.eventsSubject.value;
  }

  get latencySeries(): LatencySample[] {
    return this.latencySubject.value;
  }

  get bpmnState(): BpmnLiveState {
    return this.bpmnStateSubject.value;
  }

  get isProbeRunning(): boolean {
    return this.probeRunning;
  }

  updatePolicy(patch: Partial<MonitoringPolicy>) {
    const next: MonitoringPolicy = { ...this.policySubject.value, ...patch };
    this.policySubject.next(next);
    try {
      localStorage.setItem(this.STORAGE_KEY_POLICY, JSON.stringify(next));
    } catch {
      // ignore storage error
    }
  }

  resetPolicy() {
    this.updatePolicy({ ...this.DEFAULT_POLICY });
  }

  private loadPolicy(): MonitoringPolicy {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_POLICY);
      if (saved) return { ...this.DEFAULT_POLICY, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return { ...this.DEFAULT_POLICY };
  }

  private buildInitialLatencySeries(): LatencySample[] {
    const now = Date.now();
    const samples: LatencySample[] = [];
    const baseApi = [210, 245, 198, 310, 260, 185, 230, 290];
    const baseSpa = [42, 38, 45, 51, 39, 44, 41, 47];
    for (let i = 0; i < baseApi.length; i++) {
      const d = new Date(now - (baseApi.length - i) * 60000);
      samples.push({
        time: d.toTimeString().slice(0, 8),
        apiMs: baseApi[i],
        spaMs: baseSpa[i],
        status: 200
      });
    }
    return samples;
  }

  private buildInitialBpmnState(): BpmnLiveState {
    return {
      activeStep: 3,
      eventId: 'EVT-2026-0101',
      classification: 'INFO',
      summary: 'Sonda periódica OK en producción (Render API + TiDB Cloud < 300ms). Operación normal registrada en log.',
      stepsLog: [
        { step: 1, lane: 'Agente / Sonda', label: '1. Detección', detail: 'Sonda HTTP GET /api/servicios/publicos ejecutada.', status: 'done' },
        { step: 2, lane: 'Motor Correlación', label: '2. Filtrado & Dedup', detail: 'Evento único fuera de ventana de supresión (60s).', status: 'done' },
        { step: 3, lane: 'Clasificador ITIL', label: '3. Clasificación', detail: 'Latencia 220ms < 1500ms → INFO (Normal).', status: 'active' },
        { step: 4, lane: 'Compuerta XOR', label: '4. Respuesta Auto', detail: 'No requiere remediación ni escalamiento.', status: 'skipped' },
        { step: 5, lane: 'ITSM + KEDB', label: '5. Incidente & KEDB', detail: 'Sin incidente generado.', status: 'skipped' },
        { step: 6, lane: 'Verificación', label: '6. Cierre / Métrica', detail: 'Actualiza serie de disponibilidad (99.93%).', status: 'done' }
      ],
      payloadPreview: {
        event_id: 'EVT-2026-0101',
        source: 'Sonda Sintética',
        endpoint: '/api/servicios/publicos',
        http_status: 200,
        latency_ms: 220,
        classification: 'INFO'
      }
    };
  }

  private loadInitialEvents(): MonitoringEvent[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_EVENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const now = Date.now();
    const iso = (minAgo: number) => new Date(now - minAgo * 60000).toISOString();
    return [
      {
        id: 'EVT-2026-0105',
        timestamp: iso(2),
        source: 'Sonda Sintética',
        endpoint: 'GET /api/servicios/publicos',
        classification: 'INFO',
        priority: 'P4 - Bajo',
        httpStatus: 200,
        latencyMs: 215,
        metricName: 'http_response_time_ms',
        observedValue: '215 ms',
        thresholdValue: '< 1500 ms',
        code: 'PROBE_HTTP_200_OK',
        message: 'API Render + lectura TiDB Cloud operativa dentro de SLA.',
        correlatedCount: 1,
        disposition: 'Registrado (Log)',
        bpmnTrace: ['Detección Sonda', 'Sin duplicados', 'Clasificado INFO', 'Log telemetría'],
        rawPayload: { service: 'backend-finnova', region: 'us-east-1', status: 200, latency_ms: 215 }
      },
      {
        id: 'EVT-2026-0104',
        timestamp: iso(11),
        source: 'Backend Render API',
        endpoint: 'GET /api/servicios/publicos',
        classification: 'WARNING',
        priority: 'P2 - Alto',
        httpStatus: 200,
        latencyMs: 2180,
        metricName: 'http_response_time_ms',
        observedValue: '2180 ms',
        thresholdValue: '> 1500 ms (WARN)',
        code: 'LATENCY_DEGRADATION_WARN',
        message: 'Latencia elevada detectada por reactivación parcial de instancia Render. Se disparó Keep-Alive preventivo.',
        correlatedCount: 1,
        disposition: 'Auto-Remediado',
        matchedKbId: 'KEDB-FIN-003',
        playbookId: 'PB-003',
        bpmnTrace: ['Detección Sonda', 'Sin duplicados', 'Clasificado WARNING', 'Auto-Remediación KeepAlive', 'Verificado 215ms'],
        rawPayload: { service: 'backend-finnova', latency_ms: 2180, auto_action: 'keepalive_ping_dispatched' }
      },
      {
        id: 'EVT-2026-0103',
        timestamp: iso(28),
        source: 'TiDB Cloud AWS',
        endpoint: 'POST /api/solicitudes/validar-voucher',
        classification: 'EXCEPTION',
        priority: 'P1 - Crítico',
        httpStatus: 500,
        latencyMs: 4820,
        metricName: 'tidb_pool_utilization_pct',
        observedValue: '96% (ER_CON_COUNT_ERROR)',
        thresholdValue: '> 90% (CRIT)',
        code: 'ER_CON_COUNT_ERROR',
        message: 'Saturación crítica del pool SSL en TiDB Cloud. Incidente P1 correlacionado y asociado a KEDB-FIN-001.',
        correlatedCount: 3,
        disposition: 'Escalado a Incidente',
        linkedIncidentId: 'INC-2026-001',
        matchedKbId: 'KEDB-FIN-001',
        playbookId: 'PB-001',
        bpmnTrace: ['Detección Excepción', 'Correlación (3x)', 'Clasificado EXCEPTION P1', 'Incidente INC-2026-001', 'Match KEDB-FIN-001'],
        rawPayload: { sql_error: 'ER_CON_COUNT_ERROR', pool_limit: 5, active_sockets: 5, queue: 45 }
      },
      {
        id: 'EVT-2026-0102',
        timestamp: iso(46),
        source: 'Auth / Rate Limiter',
        endpoint: 'POST /api/auth/login',
        classification: 'EXCEPTION',
        priority: 'P1 - Crítico',
        httpStatus: 429,
        latencyMs: 95,
        metricName: 'http_429_rate_per_min',
        observedValue: '18 req/min (IP 10.128.0.4)',
        thresholdValue: '> 5 req/min',
        code: 'HTTP_429_RATE_LIMIT',
        message: 'Ráfaga de bloqueos 429 detrás de proxy inverso Render. Escalado a INC-2026-002 con runbook KEDB-FIN-002.',
        correlatedCount: 18,
        disposition: 'Escalado a Incidente',
        linkedIncidentId: 'INC-2026-002',
        matchedKbId: 'KEDB-FIN-002',
        playbookId: 'PB-002',
        bpmnTrace: ['Detección Middleware', 'Correlación (18x)', 'Clasificado EXCEPTION P1', 'Incidente INC-2026-002', 'Match KEDB-FIN-002'],
        rawPayload: { req_ip: '10.128.0.4', x_forwarded_for: 'multiple', status: 429 }
      },
      {
        id: 'EVT-2026-0101',
        timestamp: iso(64),
        source: 'Vercel Frontend SPA',
        endpoint: 'POST /api/solicitudes',
        classification: 'WARNING',
        priority: 'P3 - Medio',
        httpStatus: 413,
        latencyMs: 340,
        metricName: 'payload_size_mb',
        observedValue: '3.6 MB (HTTP 413)',
        thresholdValue: '<= 2.0 MB',
        code: 'HTTP_413_PAYLOAD_TOO_LARGE',
        message: 'Carga de voucher Base64 superó límite express.json(2mb). Correlacionado con INC-2026-004.',
        correlatedCount: 2,
        disposition: 'Escalado a Incidente',
        linkedIncidentId: 'INC-2026-004',
        playbookId: 'PB-004',
        bpmnTrace: ['Detección Interceptor', 'Correlación (2x)', 'Clasificado WARNING P3', 'Vinculado INC-2026-004'],
        rawPayload: { payload_bytes: 3774873, limit_bytes: 2097152, status: 413 }
      }
    ];
  }

  private openTelemetryDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (this.idbPromise) return this.idbPromise;

    this.idbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.IDB_STORE)) {
            const store = db.createObjectStore(this.IDB_STORE, { keyPath: 'id' });
            store.createIndex('by_timestamp', 'timestamp', { unique: false });
            store.createIndex('by_classification', 'classification', { unique: false });
            store.createIndex('by_source', 'source', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.idbPromise;
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    const db = await this.openTelemetryDb();
    if (!db) {
      this.updateStorageMeta(this.eventsSubject.value.length, 'localStorage Fallback');
      return;
    }
    try {
      const records = await new Promise<MonitoringEvent[]>(resolve => {
        const tx = db.transaction(this.IDB_STORE, 'readonly');
        const store = tx.objectStore(this.IDB_STORE);
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => resolve((getAllReq.result as MonitoringEvent[]) || []);
        getAllReq.onerror = () => resolve([]);
      });

      if (records.length > 0) {
        const sorted = records.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500);
        const maxNum = sorted.reduce((acc, ev) => {
          const m = ev.id.match(/(\d+)$/);
          return m ? Math.max(acc, Number(m[1])) : acc;
        }, this.eventSeq);
        this.eventSeq = Math.max(this.eventSeq, maxNum);
        this.eventsSubject.next(sorted);
        this.updateStorageMeta(sorted.length);
      } else {
        // Seed initial events into IndexedDB WAL so DevTools shows populated table immediately
        const initial = this.eventsSubject.value;
        await this.syncListToIndexedDb(initial);
      }
    } catch {
      this.updateStorageMeta(this.eventsSubject.value.length);
    }
  }

  private async syncListToIndexedDb(list: MonitoringEvent[]): Promise<void> {
    const db = await this.openTelemetryDb();
    if (!db) return;
    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(this.IDB_STORE, 'readwrite');
        const store = tx.objectStore(this.IDB_STORE);
        for (const ev of list.slice(0, 500)) {
          store.put(ev);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    this.updateStorageMeta(list.length);
  }

  private updateStorageMeta(count: number, engine = 'IndexedDB WAL + NDJSON') {
    this.storageMetaSubject.next({
      engine,
      dbName: this.IDB_NAME,
      storeName: this.IDB_STORE,
      persistedCount: count,
      lastWriteAt: new Date().toISOString()
    });
  }

  private persistEvents(list: MonitoringEvent[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY_EVENTS, JSON.stringify(list.slice(0, 200)));
    } catch {
      // ignore
    }
    void this.syncListToIndexedDb(list);
  }

  private nextEventId(): string {
    this.eventSeq += 1;
    return `EVT-2026-${String(this.eventSeq).padStart(4, '0')}`;
  }

  // =========================================================================
  // INGESTA, FILTRADO, CORRELACIÓN Y CREACIÓN AUTOMÁTICA DE INCIDENTES
  // =========================================================================
  ingestEvent(input: {
    source: EventSource;
    endpoint: string;
    httpStatus: number;
    latencyMs: number;
    metricName: string;
    observedValue: string;
    thresholdValue: string;
    code: string;
    message: string;
    forceClassification?: EventClassification;
    forceCreateIncident?: boolean;
    rawPayload?: Record<string, unknown>;
  }): MonitoringEvent {
    const pol = this.policy;
    const now = Date.now();
    const signature = `${input.source}|${input.code}|${input.endpoint}`;

    // 1. Clasificación automática según políticas activas
    let classification: EventClassification = input.forceClassification || 'INFO';
    if (!input.forceClassification) {
      if (input.httpStatus >= 500 || input.httpStatus === 0 || input.httpStatus === 429 || input.latencyMs >= pol.latencyCritMs) {
        classification = 'EXCEPTION';
      } else if (input.httpStatus >= 400 || input.latencyMs >= pol.latencyWarnMs) {
        classification = 'WARNING';
      } else {
        classification = 'INFO';
      }
    }

    // 2. Correlación de repeticiones para WARNING -> promoción a EXCEPTION
    let correlatedCount = 1;
    let promotedByCorrelation = false;
    if (classification === 'WARNING') {
      correlatedCount = (this.consecutiveWarnCounter.get(signature) || 0) + 1;
      this.consecutiveWarnCounter.set(signature, correlatedCount);
      if (correlatedCount >= pol.consecutiveWarnToIncident) {
        classification = 'EXCEPTION';
        promotedByCorrelation = true;
        this.consecutiveWarnCounter.set(signature, 0);
      }
    } else if (classification === 'INFO') {
      this.consecutiveWarnCounter.set(signature, 0);
    }

    // 3. Deduplicación (anti-tormenta de alertas) salvo cuando es simulación forzada
    const lastTs = this.lastEventSignatureTs.get(signature) || 0;
    const isDuplicate = !input.forceCreateIncident && classification !== 'INFO' && now - lastTs < pol.dedupWindowSec * 1000 && !promotedByCorrelation;
    this.lastEventSignatureTs.set(signature, now);

    // 4. Priorización matricial (Severidad de Evento × Criticidad del Servicio)
    const priority = this.computeEventPriority(classification, input.source, input.httpStatus, input.code);

    // 5. Match automático en Base de Conocimiento (KEDB) y Playbook
    const matchedKb: SupportChangeTicket | undefined = this.dataService.findKnowledgeMatch(`${input.code} ${input.message} ${input.source}`);
    const playbook = this.PLAYBOOKS.find(p => input.code.includes(p.triggerCode) || p.triggerCode.includes(input.code));

    // 6. Disposición y creación automática de incidente real en FinnovaDataService
    let disposition: EventDisposition = 'Registrado (Log)';
    let linkedIncidentId: string | undefined;
    const bpmnTrace: string[] = [
      `1. Detección (${input.source})`,
      isDuplicate ? `2. Deduplicado (<${pol.dedupWindowSec}s)` : '2. Validado (Sin duplicado)',
      `3. Clasificado ${classification} (${priority})`
    ];

    if (isDuplicate) {
      disposition = 'Suprimido (Deduplicado)';
      bpmnTrace.push('4. Alerta suprimida por política anti-fatiga');
    } else if (classification === 'WARNING') {
      if (pol.autoExecuteKeepAlive && (input.latencyMs >= pol.latencyWarnMs || input.code.includes('COLD_START'))) {
        disposition = 'Auto-Remediado';
        bpmnTrace.push('4. Auto-Remediación: Ping Keep-Alive ejecutado');
      } else {
        disposition = 'Registrado (Log)';
        bpmnTrace.push(`4. En observación (${correlatedCount}/${pol.consecutiveWarnToIncident} antes de escalar)`);
      }
    } else if (classification === 'EXCEPTION') {
      if (pol.autoCreateIncidentOnException || input.forceCreateIncident) {
        const created = this.autoCreateIncidentFromEvent(input, priority, matchedKb, playbook);
        linkedIncidentId = created.id_ticket;
        disposition = 'Escalado a Incidente';
        bpmnTrace.push(`4. Escalamiento automático → ${created.id_ticket}`);
        if (matchedKb?.kb_id) {
          bpmnTrace.push(`5. Match KEDB automático: ${matchedKb.kb_id}`);
        }
        if (playbook) {
          bpmnTrace.push(`6. Playbook asignado: ${playbook.id}`);
        }
      }
    }

    const evtId = this.nextEventId();
    const newEvent: MonitoringEvent = {
      id: evtId,
      timestamp: new Date(now).toISOString(),
      source: input.source,
      endpoint: input.endpoint,
      classification,
      priority,
      httpStatus: input.httpStatus,
      latencyMs: Math.round(input.latencyMs),
      metricName: input.metricName,
      observedValue: input.observedValue,
      thresholdValue: input.thresholdValue,
      code: input.code,
      message: promotedByCorrelation
        ? `[Promovido por Correlación ${correlatedCount}x] ${input.message}`
        : input.message,
      correlatedCount,
      disposition,
      linkedIncidentId,
      matchedKbId: matchedKb?.kb_id,
      playbookId: playbook?.id,
      bpmnTrace,
      rawPayload: {
        event_id: evtId,
        source: input.source,
        endpoint: input.endpoint,
        http_status: input.httpStatus,
        latency_ms: Math.round(input.latencyMs),
        classification,
        priority,
        matched_kb: matchedKb?.kb_id || null,
        linked_incident: linkedIncidentId || null,
        ...(input.rawPayload || {})
      }
    };

    const updated = [newEvent, ...this.eventsSubject.value].slice(0, 500);
    this.eventsSubject.next(updated);
    this.persistEvents(updated);
    this.updateLiveBpmn(newEvent, isDuplicate);
    return newEvent;
  }

  private computeEventPriority(
    classification: EventClassification,
    source: EventSource,
    httpStatus: number,
    code: string
  ): IncidentSeverity {
    const isCriticalService =
      source === 'TiDB Cloud AWS' ||
      source === 'Auth / Rate Limiter' ||
      source === 'Backend Render API';

    if (classification === 'EXCEPTION') {
      if (isCriticalService || httpStatus === 500 || httpStatus === 503 || httpStatus === 429 || code.includes('CON_COUNT')) {
        return 'P1 - Crítico';
      }
      return 'P2 - Alto';
    }
    if (classification === 'WARNING') {
      if (isCriticalService && (httpStatus === 504 || code.includes('COLD_START') || code.includes('LATENCY'))) {
        return 'P2 - Alto';
      }
      return 'P3 - Medio';
    }
    return 'P4 - Bajo';
  }

  private autoCreateIncidentFromEvent(
    input: {
      source: EventSource;
      endpoint: string;
      httpStatus: number;
      latencyMs: number;
      code: string;
      message: string;
    },
    priority: IncidentSeverity,
    matchedKb?: SupportChangeTicket,
    playbook?: ResponsePlaybook
  ): SupportChangeTicket {
    const slaMap: Record<IncidentSeverity, { prio: 'Crítica' | 'Alta' | 'Media' | 'Baja'; mtta: number; mttr: number }> = {
      'P1 - Crítico': { prio: 'Crítica', mtta: 15, mttr: 2 },
      'P2 - Alto': { prio: 'Alta', mtta: 30, mttr: 6 },
      'P3 - Medio': { prio: 'Media', mtta: 120, mttr: 24 },
      'P4 - Bajo': { prio: 'Baja', mtta: 480, mttr: 72 }
    };
    const cfg = slaMap[priority];
    const evtRef = `EVT-AUTO-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.dataService.addSupportTicket({
      titulo: `[AUTO-NOC ${priority.split(' ')[0]}] ${input.code} en ${input.source}`,
      descripcion: `${input.message} | Endpoint: ${input.endpoint} | HTTP: ${input.httpStatus} | Latencia: ${Math.round(input.latencyMs)}ms.`,
      tipo_solicitud: 'Incidente Técnico',
      solicitante_nombre: 'Monitor de Eventos Finnova (NOC)',
      solicitante_rol: 'Soporte TI',
      prioridad: cfg.prio,
      severidad_sla: priority,
      urgencia: cfg.prio,
      impacto: priority === 'P1 - Crítico' ? 'Global (Toda la Plataforma)' : 'Departamental (Asesores/Cobranzas)',
      codigo_error: input.code,
      entorno: 'Producción',
      componente_afectado: input.source,
      aplica_cambio: priority === 'P1 - Crítico' ? 'Si Aplica (RFC)' : 'Pendiente Evaluación',
      dimension_tecnica: input.source.includes('TiDB') || input.source.includes('Render') || input.source.includes('Auth')
        ? 'Infraestructura'
        : 'Aplicaciones y BD',
      tipo_cambio_itil: priority === 'P1 - Crítico' ? 'Emergencia (CHE)' : 'Normal (CHN)',
      estado: 'Abierto',
      mtta_sla_min: cfg.mtta,
      mttr_sla_horas: cfg.mttr,
      cumplimiento_sla: 'Dentro de SLA',
      asignado_a_rol: priority === 'P1 - Crítico' ? 'Ingeniero TI L2' : 'Mesa de Ayuda L1',
      atendido_por: 'Ing. Carlos Mendoza (Soporte TI L2)',
      solucion_temporal_workaround: matchedKb?.solucion_temporal_workaround || playbook?.autoAction || 'Ejecutar playbook de contención NOC.',
      resolucion_tecnica: matchedKb
        ? `Auto-detectado por Monitoreo de Eventos. Solución previa sugerida desde BD Conocimiento: ${matchedKb.kb_id} (${matchedKb.titulo}).`
        : `Incidente generado automáticamente por regla de correlación NOC (${playbook?.id || 'Playbook estándar'}).`,
      evento_origen_id: evtRef,
      etiquetas_kb: [input.code, 'AutoNOC', ...(matchedKb?.etiquetas_kb?.slice(0, 2) || [])]
    });
  }

  private updateLiveBpmn(evt: MonitoringEvent, isDuplicate: boolean) {
    const isException = evt.classification === 'EXCEPTION';
    const isWarning = evt.classification === 'WARNING';
    const activeStep = isDuplicate ? 2 : (isException && evt.linkedIncidentId ? 5 : isWarning ? 4 : 3);

    this.bpmnStateSubject.next({
      activeStep,
      eventId: evt.id,
      classification: evt.classification,
      summary: `${evt.id}: ${evt.classification} (${evt.priority}) → ${evt.disposition}${evt.linkedIncidentId ? ' [' + evt.linkedIncidentId + ']' : ''}${evt.matchedKbId ? ' • Match ' + evt.matchedKbId : ''}`,
      stepsLog: [
        {
          step: 1,
          lane: 'Sonda / Agente',
          label: '1. Detección',
          detail: `${evt.source} midió ${evt.observedValue} en ${evt.endpoint}`,
          status: 'done'
        },
        {
          step: 2,
          lane: 'Motor Correlación',
          label: '2. Filtrado & Dedup',
          detail: isDuplicate
            ? `Duplicado suprimido (< ${this.policy.dedupWindowSec}s)`
            : `Validado (correlación: ${evt.correlatedCount}x)`,
          status: isDuplicate ? 'active' : 'done'
        },
        {
          step: 3,
          lane: 'Clasificador ITIL',
          label: '3. Clasificación',
          detail: `${evt.classification} • Umbral: ${evt.thresholdValue} → ${evt.priority}`,
          status: activeStep === 3 ? 'active' : 'done'
        },
        {
          step: 4,
          lane: 'Compuerta XOR',
          label: '4. Respuesta / Playbook',
          detail: evt.playbookId
            ? `Playbook ${evt.playbookId} activado (${evt.disposition})`
            : evt.disposition,
          status: activeStep === 4 ? 'active' : (evt.classification === 'INFO' ? 'skipped' : 'done')
        },
        {
          step: 5,
          lane: 'ITSM + KEDB',
          label: '5. Incidente & KEDB',
          detail: evt.linkedIncidentId
            ? `Creado ${evt.linkedIncidentId}${evt.matchedKbId ? ' + KEDB ' + evt.matchedKbId : ''}`
            : (evt.matchedKbId ? `Referencia KEDB ${evt.matchedKbId}` : 'No requirió ticket INC'),
          status: activeStep === 5 ? 'active' : (evt.linkedIncidentId ? 'done' : 'skipped')
        },
        {
          step: 6,
          lane: 'NOC Verificación',
          label: '6. Telemetría & Cierre',
          detail: `Registrado en stream JSON y gráfica de latencia (${evt.latencyMs}ms)`,
          status: 'done'
        }
      ],
      payloadPreview: evt.rawPayload
    });
  }

  // =========================================================================
  // SONDAS REALES EN VIVO CONTRA PRODUCCIÓN FINNOVA (RENDER + VERCEL SPA)
  // =========================================================================
  async runLiveProbes(): Promise<MonitoringEvent[]> {
    if (this.probeRunning) return [];
    this.probeRunning = true;
    const results: MonitoringEvent[] = [];
    const probeContext = new HttpContext().set(SKIP_TELEMETRY_PROBE, true);

    try {
      // Sonda 1: Backend Express Render + TiDB Cloud (sin cabeceras custom -> cero CORS preflight)
      const apiUrl = `${this.baseUrl}/servicios/publicos`;
      const t0 = performance.now();
      let apiStatus = 200;
      let apiLatency = 0;
      let apiOk = true;
      let apiErrMsg = '';
      let itemCount = 0;

      try {
        const res = await firstValueFrom(
          this.http
            .get<any[]>(apiUrl, { context: probeContext, observe: 'response' })
            .pipe(timeout(12000))
        );
        apiLatency = Math.round(performance.now() - t0);
        apiStatus = res.status;
        itemCount = Array.isArray(res.body) ? res.body.length : 0;
      } catch (err: any) {
        apiLatency = Math.round(performance.now() - t0);
        apiStatus = err?.status || (err?.name === 'TimeoutError' ? 504 : 0);
        apiOk = false;
        apiErrMsg = err?.message || 'Error de conectividad o timeout hacia Render Cloud';
      }

      const apiEvt = this.ingestEvent({
        source: 'Sonda Sintética',
        endpoint: 'GET /api/servicios/publicos',
        httpStatus: apiStatus,
        latencyMs: apiLatency,
        metricName: 'http_response_time_ms',
        observedValue: apiOk ? `${apiLatency} ms (${itemCount} servicios TiDB)` : `HTTP ${apiStatus} (${apiLatency} ms)`,
        thresholdValue: `WARN > ${this.policy.latencyWarnMs}ms | CRIT > ${this.policy.latencyCritMs}ms`,
        code: apiOk
          ? (apiLatency >= this.policy.latencyCritMs ? 'COLD_START_TIMEOUT_504' : (apiLatency >= this.policy.latencyWarnMs ? 'LATENCY_DEGRADATION_WARN' : 'PROBE_HTTP_200_OK'))
          : `PROBE_HTTP_${apiStatus}_ERROR`,
        message: apiOk
          ? `Sonda productiva Render + TiDB respondió HTTP ${apiStatus} en ${apiLatency}ms (${itemCount} registros).`
          : `Fallo en sonda productiva Render (${apiStatus}): ${apiErrMsg}`,
        rawPayload: { target: apiUrl, status: apiStatus, latency_ms: apiLatency, records_tidb: itemCount }
      });
      results.push(apiEvt);

      // Sonda 2: Rendimiento Frontend SPA real (Navigation Timing API del navegador)
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = navEntries?.[0];
      const spaDomMs = nav ? Math.max(18, Math.round(nav.domInteractive - nav.startTime)) : 45;
      const memInfo = (performance as any).memory;
      const heapMb = memInfo ? Math.round(memInfo.usedJSHeapSize / (1024 * 1024)) : null;

      const spaEvt = this.ingestEvent({
        source: 'Vercel Frontend SPA',
        endpoint: window.location.pathname,
        httpStatus: 200,
        latencyMs: spaDomMs,
        metricName: 'spa_dom_interactive_ms',
        observedValue: heapMb ? `${spaDomMs} ms | Heap ${heapMb} MB` : `${spaDomMs} ms`,
        thresholdValue: `WARN > ${this.policy.latencyWarnMs}ms`,
        code: spaDomMs >= this.policy.latencyWarnMs ? 'SPA_SLOW_RENDER_WARN' : 'SPA_HEALTH_OK',
        message: `Telemetría SPA Angular operativa (DOM interactive: ${spaDomMs}ms${heapMb ? ', Heap JS: ' + heapMb + 'MB' : ''}).`,
        rawPayload: { path: window.location.pathname, dom_interactive_ms: spaDomMs, js_heap_mb: heapMb }
      });
      results.push(spaEvt);

      // Agregar punto real a la serie de ApexCharts
      const sample: LatencySample = {
        time: new Date().toTimeString().slice(0, 8),
        apiMs: apiLatency,
        spaMs: spaDomMs,
        status: apiStatus
      };
      this.latencySubject.next([...this.latencySubject.value.slice(-11), sample]);
    } finally {
      this.probeRunning = false;
    }

    return results;
  }

  // =========================================================================
  // SIMULADOR TÉCNICO DE FALLAS (CHAOS DRILL PARA DEMO EN VIVO)
  // =========================================================================
  simulateScenario(scenario: 'cold-start' | 'tidb-pool' | 'rate-limit-429' | 'payload-413' | 'spa-exception'): MonitoringEvent {
    if (scenario === 'tidb-pool') {
      const evt = this.ingestEvent({
        source: 'TiDB Cloud AWS',
        endpoint: 'POST /api/solicitudes/validar-voucher',
        httpStatus: 500,
        latencyMs: 5340,
        metricName: 'tidb_pool_utilization_pct',
        observedValue: '98% (ER_CON_COUNT_ERROR)',
        thresholdValue: `> ${this.policy.dbPoolCritPct}% (CRIT)`,
        code: 'ER_CON_COUNT_ERROR',
        message: 'Drill P1: Pool de conexiones SSL TiDB Cloud agotado bajo ráfaga de validación Yape.',
        forceClassification: 'EXCEPTION',
        forceCreateIncident: true,
        rawPayload: { drill: true, error: 'ER_CON_COUNT_ERROR', active_connections: 15, limit: 15, waiting_queue: 38 }
      });
      this.pushLatencyPoint(5340, 62, 500);
      return evt;
    }

    if (scenario === 'cold-start') {
      const evt = this.ingestEvent({
        source: 'Backend Render API',
        endpoint: 'GET /api/servicios/publicos',
        httpStatus: 504,
        latencyMs: 4920,
        metricName: 'http_response_time_ms',
        observedValue: '4920 ms (HTTP 504)',
        thresholdValue: `> ${this.policy.latencyCritMs} ms (CRIT)`,
        code: 'COLD_START_TIMEOUT_504',
        message: 'Drill P2: Timeout HTTP 504 por suspensión de instancia Render Free Tier. Playbook KeepAlive y creación automática de INC.',
        forceClassification: 'EXCEPTION',
        forceCreateIncident: true,
        rawPayload: { drill: true, render_instance: 'srv-finnova-api', status: 504, cold_start: true }
      });
      this.pushLatencyPoint(4920, 55, 504);
      return evt;
    }

    if (scenario === 'rate-limit-429') {
      const evt = this.ingestEvent({
        source: 'Auth / Rate Limiter',
        endpoint: 'POST /api/auth/login',
        httpStatus: 429,
        latencyMs: 88,
        metricName: 'http_429_rate_per_min',
        observedValue: '24 req/min (IP 10.128.0.4)',
        thresholdValue: `> ${this.policy.max429PerMin} req/min`,
        code: 'HTTP_429_RATE_LIMIT',
        message: 'Drill P1: Bloqueo masivo HTTP 429 en login detectado por middleware express-rate-limit.',
        forceClassification: 'EXCEPTION',
        forceCreateIncident: true,
        rawPayload: { drill: true, req_ip: '10.128.0.4', trust_proxy_warning: true, blocked_users: 14 }
      });
      this.pushLatencyPoint(88, 44, 429);
      return evt;
    }

    if (scenario === 'payload-413') {
      const evt = this.ingestEvent({
        source: 'Vercel Frontend SPA',
        endpoint: 'POST /api/solicitudes',
        httpStatus: 413,
        latencyMs: 420,
        metricName: 'payload_size_mb',
        observedValue: '4.1 MB (HTTP 413)',
        thresholdValue: '<= 2.0 MB',
        code: 'HTTP_413_PAYLOAD_TOO_LARGE',
        message: 'Drill P3: Voucher Yape en alta resolución rechazado por límite body-parser (2MB).',
        forceClassification: 'WARNING',
        rawPayload: { drill: true, file_type: 'image/png', size_mb: 4.1, limit_mb: 2.0 }
      });
      this.pushLatencyPoint(420, 48, 413);
      return evt;
    }

    const evt = this.ingestEvent({
      source: 'Vercel Frontend SPA',
      endpoint: '/dashboard/requests',
      httpStatus: 500,
      latencyMs: 110,
      metricName: 'spa_uncaught_errors',
      observedValue: 'TypeError: Cannot read properties of undefined',
      thresholdValue: '0 uncaught/min',
      code: 'SPA_RUNTIME_EXCEPTION',
      message: 'Drill P2: Excepción no controlada capturada por GlobalEventErrorHandler en Angular SPA.',
      forceClassification: 'EXCEPTION',
      forceCreateIncident: true,
      rawPayload: { drill: true, handler: 'GlobalEventErrorHandler', route: '/dashboard/requests' }
    });
    return evt;
  }

  private pushLatencyPoint(apiMs: number, spaMs: number, status: number) {
    this.latencySubject.next([
      ...this.latencySubject.value.slice(-11),
      { time: new Date().toTimeString().slice(0, 8), apiMs, spaMs, status }
    ]);
  }

  // Registro pasivo invocado desde el HttpInterceptor real de Angular
  recordHttpTelemetry(endpoint: string, httpStatus: number, latencyMs: number, errorMessage?: string) {
    const cleanPath = endpoint.replace(/^https?:\/\/[^/]+/, '');
    const isErr = httpStatus === 0 || httpStatus >= 400;
    const isSlow = latencyMs >= this.policy.latencyWarnMs;

    // Registrar siempre errores, respuestas lentas y peticiones relevantes a la API
    if (!isErr && !isSlow && !cleanPath.includes('/api/')) return;

    this.ingestEvent({
      source: 'HTTP Telemetry Interceptor',
      endpoint: cleanPath,
      httpStatus,
      latencyMs,
      metricName: 'http_client_latency_ms',
      observedValue: `${Math.round(latencyMs)} ms (HTTP ${httpStatus})`,
      thresholdValue: `WARN > ${this.policy.latencyWarnMs}ms | CRIT > ${this.policy.latencyCritMs}ms`,
      code: isErr
        ? `HTTP_${httpStatus}_ERROR`
        : (isSlow ? 'LATENCY_DEGRADATION_WARN' : 'HTTP_200_TELEMETRY'),
      message: isErr
        ? `Interceptor HTTP capturó error ${httpStatus} en ${cleanPath}: ${errorMessage || 'Fallo en respuesta'}`
        : `Petición real a ${cleanPath} completada en ${Math.round(latencyMs)}ms (HTTP ${httpStatus}).`,
      rawPayload: { interceptor: true, path: cleanPath, status: httpStatus, latency_ms: Math.round(latencyMs) }
    });
  }

  recordFrontendException(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    this.ingestEvent({
      source: 'Vercel Frontend SPA',
      endpoint: window.location.pathname,
      httpStatus: 500,
      latencyMs: 0,
      metricName: 'spa_uncaught_errors',
      observedValue: msg.slice(0, 120),
      thresholdValue: '0 uncaught/min',
      code: 'SPA_RUNTIME_EXCEPTION',
      message: `GlobalEventErrorHandler capturó excepción en runtime: ${msg.slice(0, 180)}`,
      forceClassification: 'EXCEPTION',
      rawPayload: { error_message: msg }
    });
  }

  exportEventsNdjson(): string {
    return this.eventsSubject.value
      .map(ev =>
        JSON.stringify({
          event_id: ev.id,
          timestamp: ev.timestamp,
          source: ev.source,
          endpoint: ev.endpoint,
          classification: ev.classification,
          priority: ev.priority,
          http_status: ev.httpStatus,
          latency_ms: ev.latencyMs,
          code: ev.code,
          disposition: ev.disposition,
          linked_incident: ev.linkedIncidentId || null,
          matched_kedb: ev.matchedKbId || null,
          playbook_id: ev.playbookId || null,
          message: ev.message
        })
      )
      .join('\n') + '\n';
  }

  exportEventsSql(): string {
    const esc = (v: unknown) => String(v ?? '').replace(/'/g, "''");
    const header = [
      '-- Persistencia Transaccional de Eventos Finnova (TiDB Cloud / MySQL 8.0)',
      'USE `finnova_db`;',
      'CREATE TABLE IF NOT EXISTS `finnova_db`.`eventos_monitoreo` (',
      '  id_evento VARCHAR(32) PRIMARY KEY,',
      '  fecha_evento DATETIME NOT NULL,',
      '  origen VARCHAR(64) NOT NULL,',
      '  endpoint VARCHAR(180) NOT NULL,',
      '  clasificacion ENUM(\'INFO\',\'WARNING\',\'EXCEPTION\') NOT NULL,',
      '  prioridad VARCHAR(24) NOT NULL,',
      '  http_status INT NOT NULL,',
      '  latencia_ms INT NOT NULL,',
      '  codigo_evento VARCHAR(64) NOT NULL,',
      '  disposicion VARCHAR(64) NOT NULL,',
      '  id_incidente_vinculado VARCHAR(32) NULL,',
      '  id_kedb VARCHAR(32) NULL,',
      '  payload_json JSON NOT NULL,',
      '  INDEX idx_eventos_fecha (fecha_evento),',
      '  INDEX idx_eventos_clase (clasificacion)',
      ');',
      ''
    ].join('\n');

    const rows = this.eventsSubject.value.map(ev => {
      const dt = ev.timestamp.replace('T', ' ').slice(0, 19);
      const inc = ev.linkedIncidentId ? `'${esc(ev.linkedIncidentId)}'` : 'NULL';
      const kb = ev.matchedKbId ? `'${esc(ev.matchedKbId)}'` : 'NULL';
      const jsonStr = esc(JSON.stringify(ev.rawPayload));
      return `REPLACE INTO \`finnova_db\`.\`eventos_monitoreo\` VALUES ('${esc(ev.id)}', '${dt}', '${esc(ev.source)}', '${esc(ev.endpoint)}', '${ev.classification}', '${esc(ev.priority)}', ${ev.httpStatus}, ${ev.latencyMs}, '${esc(ev.code)}', '${esc(ev.disposition)}', ${inc}, ${kb}, '${jsonStr}');`;
    });

    return header + rows.join('\n') + '\n';
  }

  restoreEventsFromBackup(events: MonitoringEvent[]) {
    if (!Array.isArray(events) || events.length === 0) return;
    const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500);
    this.eventsSubject.next(sorted);
    this.persistEvents(sorted);
  }

  async clearEvents() {
    localStorage.removeItem(this.STORAGE_KEY_EVENTS);
    const db = await this.openTelemetryDb();
    if (db) {
      await new Promise<void>(resolve => {
        const tx = db.transaction(this.IDB_STORE, 'readwrite');
        tx.objectStore(this.IDB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    const fresh = this.loadInitialEvents();
    this.eventsSubject.next(fresh);
    await this.syncListToIndexedDb(fresh);
  }
}
