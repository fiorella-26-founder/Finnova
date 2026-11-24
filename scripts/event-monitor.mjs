#!/usr/bin/env node
/**
 * Finnova Synthetic Event Monitor & Correlation Agent (Node 22 - Zero Dependencies)
 * Uso:
 *   node scripts/event-monitor.mjs --once
 *   node scripts/event-monitor.mjs --watch --interval=30
 *   node scripts/event-monitor.mjs --simulate-p1
 *   node scripts/event-monitor.mjs --once --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const policyPath = path.join(rootDir, 'monitoring', 'event-policies.json');
const logDir = path.join(rootDir, 'monitoring', 'logs');
const logFile = path.join(logDir, 'events.ndjson');

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isJson = args.includes('--json');
const isSimulateP1 = args.includes('--simulate-p1');
const intervalArg = args.find(a => a.startsWith('--interval='));
const intervalSec = intervalArg ? Math.max(5, Number(intervalArg.split('=')[1]) || 30) : 30;

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const warnCounters = new Map();

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function appendNdjson(eventObj) {
  ensureLogDir();
  fs.appendFileSync(logFile, JSON.stringify(eventObj) + '\n', 'utf8');
}

function matchKedb(text) {
  const hay = String(text || '').toLowerCase();
  return policy.kedbCatalog.find(k =>
    k.matchTokens.some(tok => hay.includes(tok.toLowerCase()))
  );
}

function computePriority(classification, criticality) {
  if (classification === 'EXCEPTION') {
    return criticality === 'CORE' ? 'P1 - Crítico' : 'P2 - Alto';
  }
  if (classification === 'WARNING') {
    return criticality === 'CORE' ? 'P2 - Alto' : 'P3 - Medio';
  }
  return 'P4 - Bajo';
}

function classifyAndCorrelate(target, httpStatus, latencyMs, errorCode, errorMessage) {
  const { latencyWarnMs, latencyCritMs, consecutiveWarnToIncident } = policy.thresholds;

  let classification = 'INFO';
  let code = errorCode || `PROBE_HTTP_${httpStatus}_OK`;

  if (httpStatus === 0 || httpStatus >= 500 || httpStatus === 429 || latencyMs >= latencyCritMs) {
    classification = 'EXCEPTION';
    if (!errorCode) {
      code = httpStatus === 429 ? 'HTTP_429_RATE_LIMIT' : (latencyMs >= latencyCritMs ? 'COLD_START_TIMEOUT_504' : `HTTP_${httpStatus}_OUTAGE`);
    }
  } else if (httpStatus >= 400 || latencyMs >= latencyWarnMs) {
    classification = 'WARNING';
    if (!errorCode) {
      code = latencyMs >= latencyWarnMs ? 'LATENCY_DEGRADATION_WARN' : `HTTP_${httpStatus}_WARN`;
    }
  }

  let correlatedCount = 1;
  if (classification === 'WARNING') {
    correlatedCount = (warnCounters.get(target.id) || 0) + 1;
    warnCounters.set(target.id, correlatedCount);
    if (correlatedCount >= consecutiveWarnToIncident) {
      classification = 'EXCEPTION';
      warnCounters.set(target.id, 0);
    }
  } else if (classification === 'INFO') {
    warnCounters.set(target.id, 0);
  }

  const priority = computePriority(classification, target.criticality);
  const kb = matchKedb(`${code} ${httpStatus} ${errorMessage || ''} ${target.name}`);
  const action =
    classification === 'EXCEPTION'
      ? `CREATE_INCIDENT (${priority}) -> ${kb ? kb.kbId + ' / ' + kb.playbookId : 'Escalation L2 DevOps'}`
      : classification === 'WARNING'
        ? `AUTO_KEEPALIVE_REMEDIATION (${correlatedCount}/${consecutiveWarnToIncident} before INC)`
        : 'LOG_TELEMETRY_ONLY';

  return {
    event_id: `EVT-CLI-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
    target_id: target.id,
    service: target.name,
    url: target.url,
    criticality: target.criticality,
    http_status: httpStatus,
    latency_ms: latencyMs,
    classification,
    priority,
    code,
    correlated_count: correlatedCount,
    action,
    matched_kedb: kb ? kb.kbId : null,
    playbook_id: kb ? kb.playbookId : null,
    recommended_remediation: kb ? kb.action : null,
    detail: errorMessage || `HTTP ${httpStatus} en ${latencyMs}ms (WARN>${latencyWarnMs}ms, CRIT>${latencyCritMs}ms)`
  };
}

async function probeTarget(target) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), policy.thresholds.timeoutMs);
  const t0 = performance.now();

  try {
    const res = await fetch(target.url, {
      method: target.method || 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Finnova-Synthetic-Monitor/1.0' }
    });
    const latencyMs = Math.round(performance.now() - t0);
    clearTimeout(timeoutId);
    return classifyAndCorrelate(target, res.status, latencyMs, null, null);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return classifyAndCorrelate(
      target,
      isTimeout ? 504 : 0,
      latencyMs,
      isTimeout ? 'COLD_START_TIMEOUT_504' : 'NETWORK_UNREACHABLE',
      err?.message || 'Fallo de conexión hacia el destino'
    );
  }
}

async function dispatchWebhookIfConfigured(eventObj) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl || eventObj.classification === 'INFO') return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[FINNOVA NOC][${eventObj.classification}][${eventObj.priority}] ${eventObj.service} | ${eventObj.code} (${eventObj.latency_ms}ms) | ${eventObj.action}`
      })
    });
  } catch {
    // No abortar sonda si el webhook externo no responde
  }
}

function printEvent(ev) {
  if (isJson) {
    console.log(JSON.stringify(ev));
    return;
  }
  const tag =
    ev.classification === 'EXCEPTION'
      ? '[EXCEPTION]'
      : ev.classification === 'WARNING'
        ? '[WARNING]  '
        : '[INFO]     ';
  console.log(`${ev.timestamp} ${tag} ${ev.priority.padEnd(13)} | ${ev.service}`);
  console.log(`  URL: ${ev.url} | HTTP: ${ev.http_status} | Latencia: ${ev.latency_ms}ms | Código: ${ev.code}`);
  console.log(`  Acción BPMN: ${ev.action}`);
  if (ev.matched_kedb) {
    console.log(`  Match KEDB:  ${ev.matched_kedb} (${ev.playbook_id}) -> ${ev.recommended_remediation}`);
  }
  console.log('-'.repeat(92));
}

async function runCycle() {
  if (isSimulateP1) {
    const simulated = classifyAndCorrelate(
      policy.targets[0],
      500,
      5420,
      'ER_CON_COUNT_ERROR',
      'SIMULACRO P1: Pool de conexiones SSL TiDB Cloud saturado (50 peticiones concurrentes Yape).'
    );
    appendNdjson(simulated);
    printEvent(simulated);
    await dispatchWebhookIfConfigured(simulated);
    return;
  }

  if (!isJson) {
    console.log(`\n=== FINNOVA SYNTHETIC EVENT MONITOR | Ciclo ${new Date().toISOString()} ===`);
  }

  for (const target of policy.targets) {
    const ev = await probeTarget(target);
    appendNdjson(ev);
    printEvent(ev);
    await dispatchWebhookIfConfigured(ev);
  }
}

await runCycle();

if (isWatch && !isSimulateP1) {
  if (!isJson) {
    console.log(`Modo vigilancia activo: ejecutando sondas cada ${intervalSec}s (Ctrl+C para detener)...`);
  }
  setInterval(runCycle, intervalSec * 1000);
}
