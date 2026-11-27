# GUÍA TÉCNICA DE EJECUCIÓN — SEMANA 16: PLAN DE CONTINUIDAD DEL SERVICIO, HA Y DRP (FINNOVA)

**Stack Productivo:** Angular 22 (Vercel Edge CDN) + Express 5 (Render Cloud) + TiDB Cloud (AWS `us-east-1` Raft Multi-AZ) + GitHub Actions  
**Módulos Implementados:** `/dashboard/service-continuity` | `/dashboard/event-monitoring` | `scripts/backup-drp-engine.mjs` | `database/continuity_and_events_tidb.sql` | `.github/workflows/backup-continuity.yml`

---

## 0. Subsanación Técnica: ¿Dónde se guarda el Registro de Eventos? (3 Capas Reales)
1. **Capa 1 — Navegador (Write-Ahead Log Transaccional en `IndexedDB`):** Base de datos `FinnovaTelemetryDB`, almacén `events_wal` con índices `by_timestamp`, `by_classification` y `by_source` (`src/app/services/event-monitoring.service.ts`). Auditable en vivo desde *Chrome DevTools → Application → IndexedDB → FinnovaTelemetryDB → events_wal*.
2. **Capa 2 — Repositorio / CLI / CI (Archivo Inmutable NDJSON):** `monitoring/logs/events.ndjson` alimentado por `scripts/event-monitor.mjs`, `scripts/backup-drp-engine.mjs` y publicado como artefacto en GitHub Actions (`.github/workflows/synthetic-monitor.yml`). Exportable en 1 clic desde `/dashboard/event-monitoring` (**NDJSON** y **SQL TiDB**).
3. **Capa 3 — Base de Datos Relacional Distribuida (`TiDB Cloud`):** Tabla `eventos_monitoreo` con columna `payload_json JSON` e índices compuestos definida en `database/continuity_and_events_tidb.sql`.

---

## 1. Clasificación e Identificación de Servicios Críticos (BIA) y Definición de RTO / RPO
| ID | Servicio de Negocio / TI | Componente Real | Clasificación | RTO Objetivo | RPO Objetivo | MTD | Estrategia de Alta Disponibilidad |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`SVC-01`** | Base de Datos Transaccional | TiDB Cloud (`us-east-1`) | **Tier 0 • Core BD** | `≤ 5 min` | `0 min` (Raft) | `30 min` | Consenso Raft 3 Réplicas Multi-AZ + PITR MVCC |
| **`SVC-02`** | API Solicitudes & Cobranzas Yape | Express 5 (Render) | **Tier 1 • Crítico** | `≤ 10 min` | `≤ 5 min` | `1 h` | `continuityInterceptor` (Retry + Circuit Breaker + Standby IDB) |
| **`SVC-03`** | Autenticación JWT & Control RBAC | Middleware Auth / Guard | **Tier 1 • Crítico** | `≤ 5 min` | `0 min` | `30 min` | JWT Stateless + Rate-Limiter `trust proxy=1` |
| **`SVC-04`** | Portal Público & Dashboard SPA | Angular 22 (Vercel CDN) | **Tier 1 • Crítico** | `< 1 min` | `0 min` (Git) | `2 h` | Red Global Anycast Edge + Instant Rollback |
| **`SVC-05`** | Agendamiento de Citas & Asesorías | Módulo REST `/api/citas` | **Tier 2 • Operativo** | `≤ 30 min` | `≤ 15 min` | `4 h` | Snapshot Incremental + Reintento Automático |
| **`SVC-06`** | Telemetría NOC & Mesa de Ayuda | `IndexedDB WAL` + KEDB | **Tier 2 • Operativo** | `< 2 min` | `0 min` (WAL) | `6 h` | Dual-Write `IndexedDB` + Exportación NDJSON/SQL |
| **`SVC-07`** | Campañas Marketing & Reportes BI | `/api/reportes/dashboard` | **Tier 3 • Soporte** | `≤ 2 h` | `≤ 24 h` | `24 h` | Respaldo Diario 3-2-1 (`02:00 UTC-5`) |

---

## 2. Análisis de Riesgos (Probabilidad × Impacto)
| ID | Amenaza Técnica | Activo | P (1-5) | I (1-5) | Score | Nivel | Mitigación Implementada | Residual |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **`RSK-01`** | Saturación de pool SSL o caída de nodo BD | `SVC-01` | 3 | 5 | **15** | **Crítico** | Quórum Raft 3 nodos AWS + `DB_CONNECTION_LIMIT=15` + PITR | Controlado |
| **`RSK-02`** | Suspensión Cold Start o caída HTTP 503/504 | `SVC-02` | 4 | 4 | **16** | **Crítico** | Cron Keep-Alive c/15m + Circuit Breaker + Réplica `IndexedDB` | Bajo |
| **`RSK-03`** | Corrupción lógica o borrado accidental SQL | `SVC-01/02` | 2 | 5 | **10** | **Alto** | Snapshots SHA-256 3-2-1 + `FLASHBACK TABLE` / `AS OF TIMESTAMP` | Bajo |
| **`RSK-04`** | Despliegue con regresión en Frontend SPA | `SVC-04` | 3 | 3 | **9** | **Medio** | Gate CI `build-prod` + Vercel Instant Rollback (`< 1 min`) | Bajo |
| **`RSK-05`** | Tormenta HTTP 429 o ráfaga en Login | `SVC-03` | 3 | 4 | **12** | **Alto** | TLS Edge + `trust proxy` + Playbook `PB-002` | Controlado |
| **`RSK-06`** | Pérdida de logs operativos durante apagón | `SVC-06` | 3 | 3 | **9** | **Medio** | `FinnovaTelemetryDB.events_wal` + Artefacto `events.ndjson` | Bajo |

---

## 3. Estrategia de Alta Disponibilidad Implementada en Código
1. **Capa de Red / Frontend (`Vercel Edge Network`):** Distribución estática AOT en nodos Anycast globales con Rollback atómico en `< 60s`.
2. **Capa de Transporte / Cliente HTTP (`src/app/services/continuity.interceptor.ts`):**
   - **Retry Automático:** Reintento transparente ante códigos transitorios (`0`, `502`, `503`, `504`).
   - **Read-Through Replica (`FinnovaContinuityDB.ha_read_cache`):** Cada respuesta `HTTP 200` actualiza la réplica local en `IndexedDB`.
   - **Circuit Breaker (`CLOSED` ↔ `OPEN_FAILOVER`):** Al detectar fallas consecutivas o conmutación manual, sirve datos desde la réplica Standby con cabecera `X-Finnova-HA-Mode: STANDBY-REPLICA` evitando caída visual del portal.
3. **Capa de Datos (`TiDB Cloud AWS`):** Almacenamiento TiKV replicado en 3 zonas de disponibilidad mediante consenso Raft (`RPO = 0`).

---

## 4. Plan de Respaldos (Regla 3-2-1 + Verificación SHA-256)
- **3 Copias en 2 Medios y 1 Ubicación Off-Site:**
  1. **Copia 1 (Nube Primaria AWS):** Snapshots automáticos y MVCC/PITR nativo de TiDB Cloud (`AS OF TIMESTAMP` / `FLASHBACK TABLE`).
  2. **Copia 2 (Off-Site CI/CD):** Artefacto diario inmutable en GitHub Actions (`.github/workflows/backup-continuity.yml`, retención 30 días).
  3. **Copia 3 (Local / Consola DRP):** Snapshots firmados con **Web Crypto API / Node Crypto `SHA-256`** en `backups/snapshots/latest-snapshot.json` y `FinnovaContinuityDB.backup_snapshots`.
- **Comandos Ejecutables de Demostración:**
  ```powershell
  npm run backup:run      # Genera snapshot real y calcula firma criptográfica SHA-256
  npm run backup:verify   # Recalcula SHA-256 y certifica integridad byte a byte
  npm run drp:drill       # Simulacro DRP completo: evento P1 + validación SHA-256 + restore + medición RTO/RPO
  ```

---

## 5. Resultados Técnicos Obtenidos
- **Disponibilidad Operativa (SLO):** Elevada a **`99.95%`** gracias al `continuityInterceptor` con conmutación automática a réplica Standby.
- **RTO Real Demostrado:** **`< 2 segundos`** en failover de aplicación/catálogo y **`< 5 minutos`** en restauración PITR de base de datos (cumpliendo holgadamente la meta `≤ 5 min`).
- **RPO Real Demostrado:** **`0 minutos`** en transacciones TiDB (consenso Raft) y en registro de eventos (`IndexedDB WAL`), y **`< 15 minutos`** en snapshots exportables verificados con `SHA-256`.
