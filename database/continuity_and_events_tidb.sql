-- =============================================================================
-- FINNOVA — PERSISTENCIA DE EVENTOS NOC, AUDITORÍA DE RESPALDOS Y DRP (TiDB)
-- Motor compatible: TiDB Cloud Serverless / Dedicated (AWS us-east-1, MySQL 8.0)
-- =============================================================================

-- 1. TABLA TRANSACCIONAL DE REGISTRO DE EVENTOS DE MONITOREO (SEMANA 15 & 16)
CREATE TABLE IF NOT EXISTS eventos_monitoreo (
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
CREATE TABLE IF NOT EXISTS auditoria_respaldos_drp (
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
