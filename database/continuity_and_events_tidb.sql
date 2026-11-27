-- =============================================================================
-- FINNOVA — PERSISTENCIA DE EVENTOS NOC, AUDITORÍA DE RESPALDOS Y DRP (TiDB)
-- Motor compatible: TiDB Cloud Serverless / Dedicated (AWS us-east-1, MySQL 8.0)
-- =============================================================================

USE `finnova_db`;

-- 1. TABLA TRANSACCIONAL DE REGISTRO DE EVENTOS DE MONITOREO (SEMANA 15 & 16)
CREATE TABLE IF NOT EXISTS `finnova_db`.`eventos_monitoreo` (
  id_evento VARCHAR(32) NOT NULL PRIMARY KEY,
  fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origen VARCHAR(64) NOT NULL,
  endpoint VARCHAR(180) NOT NULL,
  clasificacion ENUM('INFO', 'WARNING', 'EXCEPTION') NOT NULL,
  prioridad VARCHAR(24) NOT NULL,
  http_status INT NOT NULL,
  latencia_ms INT NOT NULL,
  codigo_evento VARCHAR(64) NOT NULL,
  disposicion VARCHAR(64) NOT NULL,
  id_incidente_vinculado VARCHAR(32) NULL,
  id_kedb VARCHAR(32) NULL,
  payload_json JSON NOT NULL,
  INDEX idx_eventos_fecha (fecha_evento),
  INDEX idx_eventos_clasificacion (clasificacion, prioridad),
  INDEX idx_eventos_incidente (id_incidente_vinculado)
);

-- 2. TABLA DE AUDITORÍA DE RESPALDOS CRIPTOGRÁFICOS Y SIMULACROS DRP (SEMANA 16)
CREATE TABLE IF NOT EXISTS `finnova_db`.`auditoria_respaldos_drp` (
  id_snapshot VARCHAR(40) NOT NULL PRIMARY KEY,
  tipo ENUM('FULL', 'INCREMENTAL', 'PRE-DRP') NOT NULL,
  regla_almacenamiento VARCHAR(80) NOT NULL DEFAULT '3-2-1 (TiDB + GitHub + Local)',
  registros INT NOT NULL,
  bytes_size BIGINT NOT NULL,
  sha256_hash CHAR(64) NOT NULL,
  estado_verificacion VARCHAR(24) NOT NULL DEFAULT 'SHA-256 OK',
  rto_medido_seg DECIMAL(8,2) NULL,
  rpo_medido_min DECIMAL(8,2) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_respaldos_fecha (fecha_creacion)
);

-- 2.1 SEMILLA INICIAL DE EVENTOS Y AUDITORÍA DRP PARA CONSULTA DIRECTA EN TiDB
REPLACE INTO `finnova_db`.`eventos_monitoreo`
(`id_evento`, `fecha_evento`, `origen`, `endpoint`, `clasificacion`, `prioridad`, `http_status`, `latencia_ms`, `codigo_evento`, `disposicion`, `id_incidente_vinculado`, `id_kedb`, `payload_json`)
VALUES
('EVT-2026-0105', NOW() - INTERVAL 2 MINUTE, 'Sonda Sintética', 'GET /api/servicios/publicos', 'INFO', 'P4 - Bajo', 200, 215, 'PROBE_HTTP_200_OK', 'Registrado (Log)', NULL, NULL, '{"service":"backend-finnova","status":200,"latency_ms":215}'),
('EVT-2026-0104', NOW() - INTERVAL 11 MINUTE, 'Backend Render API', 'GET /api/servicios/publicos', 'WARNING', 'P2 - Alto', 200, 2180, 'LATENCY_DEGRADATION_WARN', 'Auto-Remediado', NULL, 'KEDB-FIN-003', '{"service":"backend-finnova","latency_ms":2180,"auto_action":"keepalive_ping_dispatched"}'),
('EVT-2026-0103', NOW() - INTERVAL 28 MINUTE, 'TiDB Cloud AWS', 'POST /api/solicitudes/validar-voucher', 'EXCEPTION', 'P1 - Crítico', 500, 4820, 'ER_CON_COUNT_ERROR', 'Escalado a Incidente', 'INC-2026-001', 'KEDB-FIN-001', '{"sql_error":"ER_CON_COUNT_ERROR","pool_limit":15,"active_sockets":15}'),
('EVT-2026-0102', NOW() - INTERVAL 46 MINUTE, 'Auth / Rate Limiter', 'POST /api/auth/login', 'EXCEPTION', 'P1 - Crítico', 429, 95, 'HTTP_429_RATE_LIMIT', 'Escalado a Incidente', 'INC-2026-002', 'KEDB-FIN-002', '{"req_ip":"10.128.0.4","status":429}'),
('EVT-DRP-138440', NOW() - INTERVAL 1 MINUTE, 'Cluster Primario Render + TiDB Cloud', 'GET /api/servicios/publicos', 'EXCEPTION', 'P1 - Crítico', 503, 4850, 'DRP_PRIMARY_OUTAGE_SIMULATION', 'Escalado a Incidente', 'INC-2026-009', 'KEDB-FIN-001', '{"drill":true,"failover":"STANDBY_LOCAL_REPLICA"}');

REPLACE INTO `finnova_db`.`auditoria_respaldos_drp`
(`id_snapshot`, `tipo`, `regla_almacenamiento`, `registros`, `bytes_size`, `sha256_hash`, `estado_verificacion`, `rto_medido_seg`, `rpo_medido_min`)
VALUES
('BKP-CLI-20261127-1269', 'FULL', '3-2-1 (TiDB + GitHub + Local)', 6, 3877, 'c206c95852af31661ed692cae29752606b3b9cfe2e5b0a3b300ede51686ecc12', 'SHA-256 OK', 0.17, 0.12),
('BKP-2026-001', 'FULL', '3-2-1 (IDB + NDJSON + TiDB)', 22, 14820, '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', 'SHA-256 OK', 1.18, 0.00);

-- =============================================================================
-- 3. COMANDOS NATIVOS DE RECUPERACIÓN ANTE DESASTRES EN TiDB CLOUD (PITR / MVCC)
-- =============================================================================

-- 3.1 Verificar ventana de retención MVCC para recuperación instantánea sin downtime:
SHOW VARIABLES LIKE 'tidb_gc_life_time';

-- 3.2 Consulta histórica exacta antes de una corrupción lógica (RPO ~ 0s):
-- SELECT * FROM solicitudes AS OF TIMESTAMP '2026-11-27 12:00:00';

-- 3.3 Restauración de registros eliminados accidentalmente desde snapshot MVCC:
-- INSERT IGNORE INTO solicitudes
-- SELECT * FROM solicitudes AS OF TIMESTAMP TIMESTAMPADD(MINUTE, -5, NOW());

-- 3.4 Recuperación instantánea ante DROP o TRUNCATE accidental (< 10 segundos):
-- FLASHBACK TABLE solicitudes;

-- 3.5 Verificación de consistencia física e índices entre réplicas Raft:
-- ADMIN CHECK TABLE solicitudes;
-- ADMIN CHECK TABLE citas;
