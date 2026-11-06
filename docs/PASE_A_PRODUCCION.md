# DOCUMENTACIÓN DE PASE A PRODUCCIÓN — FRONTEND FINNOVA
**Sistema:** Finnova Frontend SPA (Angular 17+)  
**Repositorio:** `https://github.com/fiorella-26-founder/Finnova.git`  
**Plataforma de Despliegue:** Vercel Cloud (Edge Network CDN)  
**URL Productiva:** `https://finnova-nine.vercel.app`  
**Responsable de Release / Change Manager:** Fiorella Gamarra  

---

## 1. OBJETIVO DEL DOCUMENTO (RUNBOOK DE PASE)

Establecer el procedimiento técnico estandarizado, auditable y repetible para la ejecución de **Pases a Producción (Releases)** del Frontend de **Finnova**, vinculando cada despliegue con su respectiva **Solicitud de Cambio (RFC)** en Jira, el pipeline de Integración Continua en **GitHub Actions** y el **Calendario Oficial de Cambios (FSC)**.

---

## 2. PLANTILLA ESTÁNDAR DE ACTA DE PASE A PRODUCCIÓN (FRONTEND)

| Campo de Control | Detalle Técnico Requerido |
| :--- | :--- |
| **Código de Acta / Release** | `PASE-FE-2026-XX` |
| **Ticket(s) Jira RFC Asociados** | `FCC-XXX` (Ej. `FCC-104`, `FCC-106`, `FCC-110`) |
| **Dimensión Técnica Principal** | `[ ] Infraestructura` \| `[X] Aplicaciones y BD` \| `[ ] Documentación` \| `[ ] Calendario` |
| **Tipo de Cambio (ITIL 4)** | `[ ] Estándar (CHS)` \| `[X] Normal (CHN)` \| `[ ] Emergencia (CHE)` |
| **Rama Origen $\rightarrow$ Destino** | `feature/*` o `hotfix/*` $\rightarrow$ `main` (vía Pull Request aprobado) |
| **Ventana de Calendarización** | Domingo 01:00 AM – 03:00 AM (UTC-5) o Ventana Estándar Mar/Jue 10:00 AM |
| **Aprobador CAB / eCAB** | Fiorella Gamarra (Tech Lead & Change Manager) |

---

## 3. PROCEDIMIENTO TÉCNICO DE PASE A PRODUCCIÓN (PASO A PASO)

### 3.1. Pre-Requisitos y Controles Previos (Pre-Flight Checklist)
1. **Validación de Ticket RFC en Jira:** Verificar que el ticket en Jira tenga estado `Aprobado por CAB` (o `En Proceso`) y cuente con su **Plan de Rollback** documentado.
2. **Verificación de Ventana en Calendario (FSC):** Confirmar que la fecha/hora actual no se encuentre dentro del período de **Congelamiento (*Code Freeze*)** (días 28 al 31 de cada mes por cierre contable de comisiones).
3. **Sincronización de Variables y Entorno (`src/environments/environment.prod.ts`):**
   ```typescript
   export const environment = {
     appVersion: packageInfo.version,
     production: true,
     apiUrl: 'https://backend-finnova.onrender.com/api'
   };
   ```
4. **Verificación de Reglas de Enrutamiento SPA (`vercel.json`):**
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

### 3.2. Ejecución del Pipeline CI y Compilación AOT (`.github/workflows/ci.yml`)
Antes de fusionar a `main`, se ejecuta la validación local y en **GitHub Actions**:
```bash
# 1. Instalar dependencias con lockfile estricto
npm install

# 2. Compilación Ahead-of-Time (AOT) de producción
npm run build
```
- **Criterio de Aceptación CI:** El directorio `dist/` debe generarse con `Exit Code 0` sin errores de tipado TypeScript ni plantillas HTML rotas.

### 3.3. Despliegue Automatizado en Vercel (CD)
1. Aprobar y hacer **Merge del Pull Request** hacia la rama protegida `main`.
2. El webhook de GitHub dispara automáticamente el despliegue de producción en **Vercel**.
3. Vercel construye el artefacto optimizado y distribuye los bundles estáticos en el CDN Edge global.

### 3.4. Pruebas Post-Pase en Producción (*Smoke Tests*)
Inmediatamente después del despliegue (máximo 5 minutos), ejecutar el siguiente checklist:
- [x] **Carga de Portal Público (`/landing` y `/request-form`):** Respuesta `HTTP 200 OK` y carga del catálogo público desde `/api/servicios/publicos`.
- [x] **Autenticación JWT (`/login`):** Inicio de sesión exitoso y almacenamiento seguro de token.
- [x] **Rutas Protegidas por Rol (`/dashboard/requests`, `/dashboard/support-changes`):** Verificación de `authGuard` y renderizado de la Bandeja de Mesa de Ayuda y Control de Cambios.
- [x] **Inspección de Consola:** Cero errores de CORS o Mixed Content hacia `https://backend-finnova.onrender.com/api`.

### 3.5. Procedimiento de Rollback Inmediato (Tiempo de Recuperación RTO < 1 min)
En caso de detectarse anomalías críticas durante el *Smoke Test*:
1. **Opción A (Consola Vercel - 1 Clic):** Ingresar a *Vercel Dashboard $\rightarrow$ Project Finnova $\rightarrow$ Deployments*, seleccionar el deployment estable anterior y pulsar **"Instant Rollback"**.
2. **Opción B (Git Revert):**
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```

---

## 4. REGISTRO HISTÓRICO DE ACTAS DE PASE EJECUTADAS (FRONTEND)

| Acta de Pase | Ticket Jira | Dimensión Técnica | Descripción del Pase a Producción | Fecha / Ventana | Estado |
| :---: | :---: | :---: | :--- | :---: | :---: |
| **`PASE-FE-2026-01`** | **`FCC-101`** | **Infraestructura** | Configuración de `vercel.json` (SPA Rewrites) y cabeceras CORS hacia Render Cloud. | 18/10/2026 (10:30 h) | **Completado** |
| **`PASE-FE-2026-02`** | **`FCC-104`** | **Aplicaciones y BD** | Despliegue de validación de vouchers Yape Base64 y filtros por rol en `FinnovaDataService`. | 22/10/2026 (01:15 h) | **Completado** |
| **`PASE-FE-2026-03`** | **`FCC-107`** | **Documentación** | Incorporación de Runbook de Pase a Producción (`docs/PASE_A_PRODUCCION.md`) y guía de componentes. | 06/11/2026 (10:00 h) | **Completado** |
| **`PASE-FE-2026-04`** | **`FCC-105`** | **Aplicaciones y BD** | Pase del nuevo módulo **Mesa de Ayuda & Control de Cambios (`/dashboard/support-changes`)** conectado a bandeja RFC. | 06/11/2026 (En Curso) | **En Proceso** |
