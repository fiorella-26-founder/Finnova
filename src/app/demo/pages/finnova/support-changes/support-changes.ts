import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  FinnovaDataService,
  SupportChangeTicket,
  TechnicalDimension,
  ChangeStatus,
  ItilChangeType,
  ChangeApplicationFlag,
  DimensionMetricsRow,
  IncidentSeverity,
  IncidentUrgency,
  IncidentImpact,
  IncidentEnvironment,
  AssignedRoleLevel,
  UserRole,
  computeIncidentSeverity
} from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-support-changes',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './support-changes.html',
  styleUrl: './support-changes.scss'
})
export class SupportChangesManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Pestañas activas (incluye Base de Conocimiento KEDB para Soporte TI y Admin)
  activeTab: 'incidentes' | 'kedb' | 'bpmn-raci' | 'bandeja' = 'incidentes';
  adminTab: 'dimensiones' | 'pase-calendario' | 'pir-auditoria' | 'kedb' | 'bandeja' = 'dimensiones';

  // --- FILTROS INDEPENDIENTES POR BANDEJA (sin fugas entre pestañas) ---
  // 1. Tablero de Incidentes (Soporte TI)
  filterSeveridad: string = 'TODAS';
  filterIncidenteEstado: string = 'TODOS';
  filterIncidenteSoloKb: boolean = false;
  incidentSearchTerm: string = '';

  // 2. Bandeja Técnica Unificada / Bandeja Global (Soporte TI & Admin)
  filterDimension: string = 'TODAS';
  filterEstado: string = 'TODOS';
  filterAplica: string = 'TODOS';
  filterTipoTicket: string = 'TODOS';
  filterBandejaSeveridad: string = 'TODAS';
  bandejaSearchTerm: string = '';

  // 3. Base de Conocimiento de Incidencias (KEDB)
  kbSearchTerm: string = '';
  kbFilterTag: string = 'TODAS';
  kbFilterDimension: string = 'TODAS';
  copiedKbId: string | null = null;

  // 4. Bandeja de Mis Solicitudes (Asesor / Cliente)
  myFilterEstado: string = 'TODOS';
  mySearchTerm: string = '';

  // Modales
  isNewTicketModalOpen = false;
  isQualifyModalOpen = false;
  isDetailModalOpen = false;
  isWorkaroundModalOpen = false;
  isPirModalOpen = false;
  selectedTicket: SupportChangeTicket | null = null;

  // Formulario Extendido de Nueva Solicitud / Incidente Técnico
  newTitulo = '';
  newDescripcion = '';
  newTipoSolicitud: 'Incidente Técnico' | 'Soporte / Mesa de Ayuda' | 'Acceso / Credenciales' | 'Requerimiento de Cambio' = 'Incidente Técnico';
  newPrioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica' = 'Alta';
  newComponente = 'Backend Express (Render Cloud)';
  newSolicitanteNombre = '';
  newAplicaDirecto: ChangeApplicationFlag = 'Si Aplica (RFC)';
  newDimensionDirecta: TechnicalDimension = 'Infraestructura';
  newTipoItilDirecto: ItilChangeType = 'Normal (CHN)';
  newVentanaDirecta = 'Por definir en Comité CAB';
  newPlanRollbackDirecto = 'Instant Rollback en Vercel / Render ante anomalía en Smoke Test.';

  // Campos Técnicos de Incidentes & SLA
  newImpacto: IncidentImpact = 'Global (Toda la Plataforma)';
  newUrgencia: IncidentUrgency = 'Crítica';
  newSeveridad: IncidentSeverity = 'P1 - Crítico';
  newMttaMin = 15;
  newMttrHoras = 2;
  newEntorno: IncidentEnvironment = 'Producción';
  newCodigoError = 'ER_CON_COUNT_ERROR: Too many connections';
  newPasosReproducir = '';
  newStackTrace = '';
  newWorkaround = '';
  newTieneWorkaround = true;
  newAsignadoRol: AssignedRoleLevel = 'Ingeniero TI L2';

  // Formulario de Calificación / Triaje a Control de Cambios (CAB)
  qualifyCodigoJira = '';
  qualifyAplicaCambio: ChangeApplicationFlag = 'Si Aplica (RFC)';
  qualifyDimension: TechnicalDimension = 'Aplicaciones y BD';
  qualifyTipoItil: ItilChangeType = 'Normal (CHN)';
  qualifyEstado: ChangeStatus = 'En Proceso';
  qualifyPrioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica' = 'Alta';
  qualifyComponente = '';
  qualifyVentana = '';
  qualifyDocPase = '';
  qualifyRollback = '';
  qualifyResolucion = '';
  qualifyAccionesAplicadas = '';
  qualifyComandos = '';
  qualifyValidacionPost = '';
  qualifyEtiquetasKb = '';
  qualifyPublicarKb = true;

  // Formulario de Workaround & Cierre Técnico KEDB (Soporte TI L1/L2)
  workaroundDiagnostico = '';
  workaroundSolucionTemporal = '';
  workaroundNuevoEstado: ChangeStatus = 'En Proceso';
  workaroundAccionesAplicadas = '';
  workaroundComandos = '';
  workaroundArchivos = '';
  workaroundValidacionPost = '';
  workaroundLecciones = '';
  workaroundEtiquetasKb = '';
  workaroundPublicarKb = true;

  // Formulario de Post-Mortem / PIR & KEDB (Causa Raíz RCA)
  pir5Whys = '';
  pirAccionCorrectiva = '';
  pirComandos = '';
  pirArchivos = '';
  pirValidacionPost = '';
  pirLecciones = '';
  pirEtiquetasKb = '';
  pirPublicarKb = true;
  pirResponsable = 'Fiorella Gamarra (Tech Lead & CAB)';

  ngOnInit() {
    this.dataService.loadSupportTickets();
    this.dataService.activeRole$.subscribe(role => {
      if (role === 'Soporte TI') {
        this.activeTab = 'incidentes';
      } else if (role === 'Administrador') {
        this.adminTab = 'dimensiones';
      }
    });
  }

  // Normalización robusta (insensible a tildes, mayúsculas y espacios)
  private normalize(val: unknown): string {
    return String(val ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private matchesSearch(ticket: SupportChangeTicket, term: string): boolean {
    const q = this.normalize(term);
    if (!q) return true;
    const haystack = this.normalize([
      ticket.id_ticket,
      ticket.codigo_jira,
      ticket.kb_id,
      ticket.titulo,
      ticket.descripcion,
      ticket.codigo_error,
      ticket.componente_afectado,
      ticket.dimension_tecnica,
      ticket.tipo_solicitud,
      ticket.solicitante_nombre,
      ticket.solucion_temporal_workaround,
      ticket.resolucion_tecnica,
      ticket.rca_causa_raiz,
      ticket.sintoma_detectado,
      ticket.diagnostico_tecnico,
      ticket.comandos_ejecutados,
      ticket.archivos_modificados,
      ticket.validacion_post_cierre,
      ticket.lecciones_aprendidas,
      ...(ticket.acciones_aplicadas || []),
      ...(ticket.etiquetas_kb || [])
    ].join(' '));
    return haystack.includes(q);
  }

  private parseLines(text: string): string[] {
    return (text || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private parseTags(text: string): string[] {
    return (text || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  get allTickets(): SupportChangeTicket[] {
    return this.dataService.getSupportTickets();
  }

  // --- MIS REPORTES (ASESOR / CLIENTE) ---
  get myReportedTicketsBase(): SupportChangeTicket[] {
    if (this.isCliente) {
      const list = this.allTickets.filter(t =>
        t.solicitante_rol === 'Cliente' ||
        (t.solicitante_nombre && (this.normalize(t.solicitante_nombre).includes('maria') || this.normalize(t.solicitante_nombre).includes('cliente')))
      );
      return list.length > 0 ? list : this.allTickets.slice(0, 2);
    }
    if (this.isAsesor) {
      const list = this.allTickets.filter(t =>
        t.solicitante_rol === 'Asesor' ||
        (t.solicitante_nombre && (this.normalize(t.solicitante_nombre).includes('asesor') || this.normalize(t.solicitante_nombre).includes('juan')))
      );
      return list.length > 0 ? list : this.allTickets.slice(0, 2);
    }
    return this.allTickets;
  }

  get myReportedTickets(): SupportChangeTicket[] {
    return this.myReportedTicketsBase.filter(t => {
      if (this.myFilterEstado !== 'TODOS' && this.normalize(t.estado) !== this.normalize(this.myFilterEstado)) {
        return false;
      }
      return this.matchesSearch(t, this.mySearchTerm);
    });
  }

  resetMyFilters() {
    this.myFilterEstado = 'TODOS';
    this.mySearchTerm = '';
  }

  get myReportedCount(): number {
    return this.myReportedTicketsBase.length;
  }

  get myInProgressCount(): number {
    return this.myReportedTicketsBase.filter(t => t.estado === 'En Proceso' || t.estado === 'Abierto').length;
  }

  get myResolvedCount(): number {
    return this.myReportedTicketsBase.filter(t => t.estado === 'Completado').length;
  }

  get criticalIncidentsForPir(): SupportChangeTicket[] {
    return this.allIncidents.filter(i =>
      i.severidad_sla === 'P1 - Crítico' ||
      i.severidad_sla === 'P2 - Alto' ||
      !!i.rca_causa_raiz ||
      i.tipo_cambio_itil === 'Emergencia (CHE)'
    );
  }

  // --- FILTROS Y MÉTRICAS DE INCIDENTES ---
  get allIncidents(): SupportChangeTicket[] {
    return this.allTickets.filter(t =>
      this.normalize(t.tipo_solicitud).includes('incidente') ||
      (t.id_ticket || '').startsWith('INC-') ||
      t.severidad_sla !== undefined
    );
  }

  get filteredIncidents(): SupportChangeTicket[] {
    return this.allIncidents.filter(inc => {
      if (this.filterSeveridad !== 'TODAS' && this.normalize(inc.severidad_sla) !== this.normalize(this.filterSeveridad)) {
        return false;
      }
      if (this.filterIncidenteEstado !== 'TODOS' && this.normalize(inc.estado) !== this.normalize(this.filterIncidenteEstado)) {
        return false;
      }
      if (this.filterIncidenteSoloKb && !(inc.estado === 'Completado' && inc.publicado_kb !== false)) {
        return false;
      }
      return this.matchesSearch(inc, this.incidentSearchTerm);
    });
  }

  get hasActiveIncidentFilters(): boolean {
    return (
      this.filterSeveridad !== 'TODAS' ||
      this.filterIncidenteEstado !== 'TODOS' ||
      this.filterIncidenteSoloKb ||
      this.incidentSearchTerm.trim().length > 0
    );
  }

  resetIncidentFilters() {
    this.filterSeveridad = 'TODAS';
    this.filterIncidenteEstado = 'TODOS';
    this.filterIncidenteSoloKb = false;
    this.incidentSearchTerm = '';
  }

  get totalIncidentsCount(): number {
    return this.allIncidents.length;
  }

  get p1Count(): number {
    return this.allIncidents.filter(i => i.severidad_sla === 'P1 - Crítico').length;
  }

  get p2Count(): number {
    return this.allIncidents.filter(i => i.severidad_sla === 'P2 - Alto').length;
  }

  get p3Count(): number {
    return this.allIncidents.filter(i => i.severidad_sla === 'P3 - Medio').length;
  }

  get p4Count(): number {
    return this.allIncidents.filter(i => i.severidad_sla === 'P4 - Bajo').length;
  }

  get incidentsEnSlaCount(): number {
    return this.allIncidents.filter(i => i.cumplimiento_sla === 'Dentro de SLA' || !i.cumplimiento_sla).length;
  }

  get slaComplianceRate(): number {
    if (this.totalIncidentsCount === 0) return 100;
    return Math.round((this.incidentsEnSlaCount / this.totalIncidentsCount) * 100);
  }

  get avgMttaMin(): number {
    const withReal = this.allIncidents.filter(i => typeof i.tiempo_mtta_real_min === 'number');
    if (withReal.length === 0) return 12;
    const avg = withReal.reduce((acc, i) => acc + (i.tiempo_mtta_real_min || 0), 0) / withReal.length;
    return Math.round(avg);
  }

  get avgMttrHours(): number {
    const withReal = this.allIncidents.filter(i => typeof i.tiempo_mttr_real_horas === 'number');
    if (withReal.length === 0) return 1.8;
    const avg = withReal.reduce((acc, i) => acc + (i.tiempo_mttr_real_horas || 0), 0) / withReal.length;
    return Math.round(avg * 10) / 10;
  }

  // --- FILTROS DE BANDEJA TÉCNICA UNIFICADA / BANDEJA GLOBAL ---
  get filteredTickets(): SupportChangeTicket[] {
    return this.allTickets.filter(t => {
      if (this.filterTipoTicket !== 'TODOS' && this.normalize(t.tipo_solicitud) !== this.normalize(this.filterTipoTicket)) {
        return false;
      }
      if (this.filterDimension !== 'TODAS' && this.normalize(t.dimension_tecnica) !== this.normalize(this.filterDimension)) {
        return false;
      }
      if (this.filterEstado !== 'TODOS' && this.normalize(t.estado) !== this.normalize(this.filterEstado)) {
        return false;
      }
      if (this.filterAplica !== 'TODOS' && this.normalize(t.aplica_cambio) !== this.normalize(this.filterAplica)) {
        return false;
      }
      if (this.filterBandejaSeveridad !== 'TODAS' && this.normalize(t.severidad_sla) !== this.normalize(this.filterBandejaSeveridad)) {
        return false;
      }
      return this.matchesSearch(t, this.bandejaSearchTerm);
    });
  }

  get hasActiveBandejaFilters(): boolean {
    return (
      this.filterTipoTicket !== 'TODOS' ||
      this.filterDimension !== 'TODAS' ||
      this.filterEstado !== 'TODOS' ||
      this.filterAplica !== 'TODOS' ||
      this.filterBandejaSeveridad !== 'TODAS' ||
      this.bandejaSearchTerm.trim().length > 0
    );
  }

  resetBandejaFilters() {
    this.filterTipoTicket = 'TODOS';
    this.filterDimension = 'TODAS';
    this.filterEstado = 'TODOS';
    this.filterAplica = 'TODOS';
    this.filterBandejaSeveridad = 'TODAS';
    this.bandejaSearchTerm = '';
  }

  // --- BASE DE CONOCIMIENTO DE INCIDENCIAS (KEDB / KB) ---
  get allKnowledgeEntries(): SupportChangeTicket[] {
    return this.dataService.getKnowledgeBaseEntries();
  }

  get allKnowledgeTags(): string[] {
    const tags = new Set<string>();
    for (const kb of this.allKnowledgeEntries) {
      for (const tag of kb.etiquetas_kb || []) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  get filteredKnowledgeEntries(): SupportChangeTicket[] {
    return this.allKnowledgeEntries.filter(kb => {
      if (this.kbFilterDimension !== 'TODAS' && this.normalize(kb.dimension_tecnica) !== this.normalize(this.kbFilterDimension)) {
        return false;
      }
      if (this.kbFilterTag !== 'TODAS') {
        const hasTag = (kb.etiquetas_kb || []).some(t => this.normalize(t) === this.normalize(this.kbFilterTag));
        if (!hasTag) return false;
      }
      return this.matchesSearch(kb, this.kbSearchTerm);
    });
  }

  get totalKbReuses(): number {
    return this.allKnowledgeEntries.reduce((acc, kb) => acc + (kb.veces_reutilizada || 0), 0);
  }

  resetKbFilters() {
    this.kbSearchTerm = '';
    this.kbFilterTag = 'TODAS';
    this.kbFilterDimension = 'TODAS';
  }

  copyKbCommands(kb: SupportChangeTicket) {
    const text = kb.comandos_ejecutados || (kb.acciones_aplicadas || []).join('\n') || kb.resolucion_tecnica;
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.copiedKbId = kb.id_ticket;
    setTimeout(() => {
      if (this.copiedKbId === kb.id_ticket) this.copiedKbId = null;
    }, 2000);
  }

  reuseKbSolution(kb: SupportChangeTicket) {
    this.dataService.incrementKbReuse(kb.id_ticket);
    // Abrir modal de nuevo incidente o aplicar sobre incidente abierto más reciente con workaround precargado
    const openInc = this.allIncidents.find(i => i.estado !== 'Completado');
    if (openInc && this.canApplyWorkaround) {
      this.openWorkaroundModal(openInc);
      this.workaroundDiagnostico = `[Reutilizado desde ${kb.kb_id || kb.id_ticket}] ${kb.diagnostico_tecnico || kb.rca_causa_raiz || ''}`;
      this.workaroundSolucionTemporal = kb.solucion_temporal_workaround || kb.resolucion_tecnica;
      this.workaroundAccionesAplicadas = (kb.acciones_aplicadas || []).join('\n');
      this.workaroundComandos = kb.comandos_ejecutados || '';
      this.workaroundValidacionPost = kb.validacion_post_cierre || '';
    } else {
      this.openDetailModal(kb);
    }
  }

  get metricsByDimension(): DimensionMetricsRow[] {
    return this.dataService.getChangeMetricsByDimension();
  }

  get totalBandejaCount(): number {
    return this.allTickets.length;
  }

  get totalRfcCount(): number {
    return this.allTickets.filter(t => t.aplica_cambio === 'Si Aplica (RFC)').length;
  }

  get totalMesaAyudaCount(): number {
    return this.allTickets.filter(t => t.aplica_cambio !== 'Si Aplica (RFC)').length;
  }

  get totalRfcAbiertos(): number {
    return this.allTickets.filter(t => t.aplica_cambio === 'Si Aplica (RFC)' && t.estado === 'Abierto').length;
  }

  get totalRfcEnProceso(): number {
    return this.allTickets.filter(t => t.aplica_cambio === 'Si Aplica (RFC)' && t.estado === 'En Proceso').length;
  }

  get totalRfcCompletados(): number {
    return this.allTickets.filter(t => t.aplica_cambio === 'Si Aplica (RFC)' && t.estado === 'Completado').length;
  }

  getTicketsByDimension(dim: TechnicalDimension): SupportChangeTicket[] {
    return this.allTickets.filter(t => t.dimension_tecnica === dim && t.aplica_cambio === 'Si Aplica (RFC)');
  }

  // --- CONTROL DE ACCESO BASADO EN ROLES (RBAC) ---
  get activeRole(): UserRole {
    return this.dataService.activeRole;
  }

  get isAdmin(): boolean {
    return this.activeRole === 'Administrador';
  }

  get isSoporteTI(): boolean {
    return this.activeRole === 'Soporte TI';
  }

  get isAsesor(): boolean {
    return this.activeRole === 'Asesor';
  }

  get isCliente(): boolean {
    return this.activeRole === 'Cliente';
  }

  get canApplyWorkaround(): boolean {
    return this.isSoporteTI || this.isAdmin;
  }

  get canQualifyCab(): boolean {
    return this.isAdmin || this.isSoporteTI;
  }

  get canApproveEmergencyChange(): boolean {
    return this.isAdmin;
  }

  get canDelete(): boolean {
    return this.isAdmin;
  }

  // --- MATRIZ INTERACTIVA URGENCIA X IMPACTO = SEVERIDAD & SLA ---
  onMatrixChange() {
    const res = computeIncidentSeverity(this.newImpacto, this.newUrgencia);
    this.newSeveridad = res.severidad;
    this.newMttaMin = res.mtta;
    this.newMttrHoras = res.mttr;
    if (this.newSeveridad === 'P1 - Crítico') {
      this.newPrioridad = 'Crítica';
      this.newTipoItilDirecto = 'Emergencia (CHE)';
      this.newAplicaDirecto = 'Si Aplica (RFC)';
      this.newAsignadoRol = 'Ingeniero TI L2';
    } else if (this.newSeveridad === 'P2 - Alto') {
      this.newPrioridad = 'Alta';
      this.newTipoItilDirecto = 'Normal (CHN)';
      this.newAplicaDirecto = 'Si Aplica (RFC)';
      this.newAsignadoRol = 'Ingeniero TI L2';
    } else if (this.newSeveridad === 'P3 - Medio') {
      this.newPrioridad = 'Media';
      this.newTipoItilDirecto = 'Normal (CHN)';
      this.newAsignadoRol = 'Mesa de Ayuda L1';
    } else {
      this.newPrioridad = 'Baja';
      this.newTipoItilDirecto = 'No Aplica';
      this.newAsignadoRol = 'Mesa de Ayuda L1';
    }
  }

  onTipoSolicitudChange() {
    if (this.newTipoSolicitud === 'Incidente Técnico') {
      this.newImpacto = 'Global (Toda la Plataforma)';
      this.newUrgencia = 'Crítica';
      this.onMatrixChange();
    } else if (this.newTipoSolicitud === 'Requerimiento de Cambio') {
      this.newAplicaDirecto = 'Si Aplica (RFC)';
      this.newDimensionDirecta = 'Aplicaciones y BD';
      this.newTipoItilDirecto = 'Normal (CHN)';
    } else {
      this.newAplicaDirecto = 'No Aplica (Soporte Directo)';
      this.newDimensionDirecta = 'N/A - Mesa de Ayuda';
      this.newTipoItilDirecto = 'No Aplica';
    }
  }

  // --- FORMULARIO NUEVA SOLICITUD / INCIDENTE ---
  openNewTicketModal() {
    if (this.isCliente) {
      this.newTitulo = 'Falla al cargar comprobante de pago en validación de voucher';
      this.newDescripcion = 'Al subir la imagen PNG de 2MB del voucher de pago en mi solicitud, la pantalla se queda congelada en "Procesando" y luego muestra error de conexión sin confirmar el registro.';
      this.newTipoSolicitud = 'Incidente Técnico';
      this.newImpacto = 'Individual (Usuario/Cliente)';
      this.newUrgencia = 'Media';
      this.onMatrixChange();
      this.newComponente = 'Módulo de Solicitud de Crédito / Voucher (Frontend)';
      this.newEntorno = 'Producción';
      this.newCodigoError = 'HTTP 413 / Request Entity Too Large';
      this.newPasosReproducir = '1. Ir a /dashboard/requests.\n2. Cargar voucher PNG.\n3. Presionar Enviar.';
      this.newStackTrace = '';
      this.newWorkaround = '';
      this.newSolicitanteNombre = 'María López (Cliente)';
      this.newVentanaDirecta = 'Atención estándar Mesa de Ayuda';
      this.newPlanRollbackDirecto = 'N/A';
    } else if (this.isAsesor) {
      this.newTitulo = 'Lentitud y timeout al consultar historial de cliente en evaluación';
      this.newDescripcion = 'La búsqueda por DNI en la bandeja de aprobación demora más de 10 segundos en responder durante horas punta (11:00 am - 1:00 pm).';
      this.newTipoSolicitud = 'Incidente Técnico';
      this.newImpacto = 'Departamental (Asesores/Cobranzas)';
      this.newUrgencia = 'Alta';
      this.onMatrixChange();
      this.newComponente = 'Bandeja de Aprobación de Asesor';
      this.newEntorno = 'Producción';
      this.newCodigoError = 'GATEWAY_TIMEOUT_504';
      this.newPasosReproducir = '1. Ingresar DNI en filtro de clientes.\n2. Esperar respuesta de TiDB Cloud.';
      this.newStackTrace = '';
      this.newWorkaround = '';
      this.newSolicitanteNombre = 'Juan Pérez (Asesor)';
      this.newVentanaDirecta = 'Atención prioritaria Asesoría';
      this.newPlanRollbackDirecto = 'N/A';
    } else if (this.isSoporteTI) {
      this.newTitulo = 'Saturación en Connection Pool de TiDB Cloud en horas punta';
      this.newDescripcion = 'El backend Express en Render agota el pool de conexiones TLS (connectionLimit: 5) al procesar validación concurrente de vouchers QR.';
      this.newTipoSolicitud = 'Incidente Técnico';
      this.newImpacto = 'Global (Toda la Plataforma)';
      this.newUrgencia = 'Crítica';
      this.onMatrixChange();
      this.newComponente = 'Backend Express (Render Cloud)';
      this.newEntorno = 'Producción';
      this.newCodigoError = 'ER_CON_COUNT_ERROR: Too many connections';
      this.newPasosReproducir = '1. Enviar 50 solicitudes POST simultáneas a /api/solicitudes/validar-voucher.\n2. TiDB Cloud agota sockets TLS.\n3. Backend responde HTTP 500.';
      this.newStackTrace = 'Error: Connection pool exhausted at Pool.getConnection (mysql2/lib/pool.js:52)\nat async validarVoucher (/src/controllers/solicitudController.js:142)';
      this.newWorkaround = 'Incrementar pool en caliente a connectionLimit: 15 y reiniciar contenedor Render.';
      this.newTieneWorkaround = true;
      this.newSolicitanteNombre = 'Ing. Carlos Mendoza (Soporte TI L2)';
      this.newVentanaDirecta = 'Ventana FSC Inmediata (Hotfix)';
      this.newPlanRollbackDirecto = 'Instant Rollback en Render / Vercel ante anomalía en Smoke Test.';
    } else {
      this.newTitulo = 'Pase de Emergencia: Aumento de Límites de Pool TiDB y Timeout';
      this.newDescripcion = 'RFC de emergencia aprobado por CAB para estabilizar microservicio ante campaña masiva.';
      this.newTipoSolicitud = 'Requerimiento de Cambio';
      this.newImpacto = 'Global (Toda la Plataforma)';
      this.newUrgencia = 'Alta';
      this.onMatrixChange();
      this.newAplicaDirecto = 'Si Aplica (RFC)';
      this.newDimensionDirecta = 'Infraestructura';
      this.newTipoItilDirecto = 'Emergencia (CHE)';
      this.newComponente = 'Infraestructura TiDB & Render Cloud';
      this.newEntorno = 'Producción';
      this.newCodigoError = '';
      this.newPasosReproducir = '';
      this.newStackTrace = '';
      this.newWorkaround = '';
      this.newSolicitanteNombre = 'Fiorella Gamarra (Admin / CAB)';
      this.newVentanaDirecta = 'Ventana de Emergencia CAB Inmediata';
      this.newPlanRollbackDirecto = 'Instant Rollback en Render ante fallo de Smoke Test.';
    }
    this.isNewTicketModalOpen = true;
  }

  saveNewTicket() {
    if (!this.newTitulo.trim() || !this.newDescripcion.trim()) {
      return;
    }

    const isInc = this.newTipoSolicitud === 'Incidente Técnico';

    this.dataService.addSupportTicket({
      titulo: this.newTitulo.trim(),
      descripcion: this.newDescripcion.trim(),
      tipo_solicitud: this.newTipoSolicitud,
      prioridad: this.newPrioridad,
      componente_afectado: this.newComponente,
      solicitante_nombre: this.newSolicitanteNombre.trim() || 'Usuario Finnova',
      solicitante_rol: this.activeRole,
      aplica_cambio: this.newAplicaDirecto,
      dimension_tecnica: this.newDimensionDirecta,
      tipo_cambio_itil: this.newTipoItilDirecto,
      estado: 'Abierto',
      ventana_calendarizacion: this.newVentanaDirecta,
      doc_pase_referencia: this.newComponente.includes('Frontend')
        ? 'proyecto-finnova/docs/PASE_A_PRODUCCION.md'
        : 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: this.newPlanRollbackDirecto,
      resolucion_tecnica: isInc
        ? 'Incidente registrado en triaje L1. Notificado al Ingeniero de TI / DevOps.'
        : 'Solicitud registrada en bandeja.',
      severidad_sla: isInc ? this.newSeveridad : undefined,
      urgencia: isInc ? this.newUrgencia : undefined,
      impacto: isInc ? this.newImpacto : undefined,
      codigo_error: isInc ? this.newCodigoError : undefined,
      entorno: this.newEntorno,
      pasos_reproducir: this.newPasosReproducir,
      stack_trace_logs: this.newStackTrace,
      solucion_temporal_workaround: this.newWorkaround,
      mtta_sla_min: isInc ? this.newMttaMin : undefined,
      mttr_sla_horas: isInc ? this.newMttrHoras : undefined,
      cumplimiento_sla: 'Dentro de SLA',
      asignado_a_rol: this.newAsignadoRol,
      atendido_por: this.activeRole === 'Soporte TI' ? 'Ing. Carlos Mendoza (Soporte TI L2)' : 'Mesa de Ayuda L1',
      aprobado_por: this.activeRole === 'Administrador' ? 'Fiorella Gamarra (Admin / CAB)' : 'Pendiente CAB'
    }, () => {
      this.closeAllModals();
    });
  }

  // --- MODAL DE WORKAROUND & CIERRE KEDB (SOPORTE TI L1/L2) ---
  openWorkaroundModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.workaroundDiagnostico = ticket.diagnostico_tecnico || ticket.resolucion_tecnica || 'Análisis en logs de Render y TiDB Cloud.';
    this.workaroundSolucionTemporal = ticket.solucion_temporal_workaround || '';
    this.workaroundNuevoEstado = ticket.estado === 'Completado' ? 'Completado' : 'En Proceso';
    this.workaroundAccionesAplicadas = (ticket.acciones_aplicadas || []).join('\n') || '1. Validación de logs y métricas del servicio afectado.\n2. Aplicación de ajuste técnico en configuración/código.\n3. Verificación de estabilidad post-cambio.';
    this.workaroundComandos = ticket.comandos_ejecutados || 'curl -s -w "\\nHTTP %{http_code} - %{time_total}s\\n" https://backend-finnova.onrender.com/api/health';
    this.workaroundArchivos = ticket.archivos_modificados || ticket.componente_afectado;
    this.workaroundValidacionPost = ticket.validacion_post_cierre || 'Smoke test HTTP 200 validado sin errores 4xx/5xx en consola.';
    this.workaroundLecciones = ticket.lecciones_aprendidas || 'Agregar regla de alerta preventiva en monitor de eventos para detectar anomalía antes del impacto a usuarios.';
    this.workaroundEtiquetasKb = (ticket.etiquetas_kb || []).join(', ') || (ticket.codigo_error ? ticket.codigo_error.split(/[\s:]+/)[0] : 'Finnova');
    this.workaroundPublicarKb = ticket.publicado_kb !== false;
    this.isWorkaroundModalOpen = true;
  }

  saveWorkaround() {
    if (!this.selectedTicket) return;
    const isClosing = this.workaroundNuevoEstado === 'Completado';
    const acciones = this.parseLines(this.workaroundAccionesAplicadas);
    const tags = this.parseTags(this.workaroundEtiquetasKb);

    this.dataService.qualifySupportTicket(this.selectedTicket.id_ticket, {
      solucion_temporal_workaround: this.workaroundSolucionTemporal,
      diagnostico_tecnico: this.workaroundDiagnostico,
      resolucion_tecnica: `[${isClosing ? 'Cierre Técnico & KEDB' : 'Workaround'} por ${this.activeRole === 'Soporte TI' ? 'Ing. Carlos Mendoza (Soporte TI L2)' : 'Admin'}]: ${this.workaroundDiagnostico}`,
      estado: this.workaroundNuevoEstado,
      atendido_por: this.activeRole === 'Soporte TI' ? 'Ing. Carlos Mendoza (Soporte TI L2)' : this.selectedTicket.atendido_por,
      cumplimiento_sla: 'Dentro de SLA',
      sintoma_detectado: this.selectedTicket.sintoma_detectado || `${this.selectedTicket.codigo_error || 'Anomalía'} en ${this.selectedTicket.componente_afectado}`,
      acciones_aplicadas: acciones.length ? acciones : undefined,
      comandos_ejecutados: this.workaroundComandos.trim() || undefined,
      archivos_modificados: this.workaroundArchivos.trim() || undefined,
      validacion_post_cierre: this.workaroundValidacionPost.trim() || undefined,
      lecciones_aprendidas: this.workaroundLecciones.trim() || undefined,
      etiquetas_kb: tags.length ? tags : undefined,
      publicado_kb: isClosing ? this.workaroundPublicarKb : this.selectedTicket.publicado_kb
    }, () => {
      this.closeAllModals();
    });
  }

  // --- MODAL DE POST-MORTEM / PIR & PUBLICACIÓN KEDB (ADMIN & TECH LEAD) ---
  openPirModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.pir5Whys = ticket.rca_causa_raiz || `1. ¿Por qué ocurrió la incidencia? Porque el umbral operativo fue superado en ${ticket.componente_afectado}.\n2. ¿Por qué no se contuvo antes? Faltaba control de umbral automático en la capa afectada.\n3. ¿Por qué ocurrió bajo carga? Picos simultáneos durante validación de solicitudes.\n4. ¿Por qué no se detectó en QA? Escenario de estrés no incluía concurrencia sostenida.\n5. Causa Raíz Definitiva: Falta de parametrización preventiva y regla de alerta proactiva.`;
    this.pirAccionCorrectiva = (ticket.acciones_aplicadas || []).join('\n') || '1. Aplicación de parche definitivo en producción.\n2. Actualización de política de monitoreo de eventos.\n3. Incorporación a la Base de Conocimiento (KEDB).';
    this.pirComandos = ticket.comandos_ejecutados || 'node scripts/event-monitor.mjs --once';
    this.pirArchivos = ticket.archivos_modificados || ticket.componente_afectado;
    this.pirValidacionPost = ticket.validacion_post_cierre || 'Smoke test productivo HTTP 200 y monitoreo estable durante 30 min.';
    this.pirLecciones = ticket.lecciones_aprendidas || 'Se documenta runbook en KEDB y alerta automática en /dashboard/event-monitoring.';
    this.pirEtiquetasKb = (ticket.etiquetas_kb || []).join(', ') || 'RCA, PostMortem, Finnova';
    this.pirPublicarKb = true;
    this.isPirModalOpen = true;
  }

  savePir() {
    if (!this.selectedTicket) return;
    const acciones = this.parseLines(this.pirAccionCorrectiva);
    const tags = this.parseTags(this.pirEtiquetasKb);

    this.dataService.qualifySupportTicket(this.selectedTicket.id_ticket, {
      rca_causa_raiz: this.pir5Whys,
      resolucion_tecnica: `${this.selectedTicket.resolucion_tecnica} | [PIR / Post-Mortem Aprobado]: ${acciones.join(' ; ')}`,
      aprobado_por: 'Fiorella Gamarra (Tech Lead & CAB)',
      estado: 'Completado',
      sintoma_detectado: this.selectedTicket.sintoma_detectado || `${this.selectedTicket.codigo_error || this.selectedTicket.titulo}`,
      diagnostico_tecnico: this.selectedTicket.diagnostico_tecnico || this.pir5Whys,
      acciones_aplicadas: acciones.length ? acciones : undefined,
      comandos_ejecutados: this.pirComandos.trim() || undefined,
      archivos_modificados: this.pirArchivos.trim() || undefined,
      validacion_post_cierre: this.pirValidacionPost.trim() || undefined,
      lecciones_aprendidas: this.pirLecciones.trim() || undefined,
      etiquetas_kb: tags.length ? tags : undefined,
      publicado_kb: this.pirPublicarKb
    }, () => {
      this.closeAllModals();
    });
  }

  // --- ESCALAMIENTO A CONTROL DE CAMBIOS (RFC) ---
  escalateToRfc(ticket: SupportChangeTicket) {
    this.openQualifyModal(ticket);
    this.qualifyAplicaCambio = 'Si Aplica (RFC)';
    this.qualifyDimension = ticket.dimension_tecnica === 'Por Clasificar' ? 'Infraestructura' : ticket.dimension_tecnica;
    this.qualifyTipoItil = ticket.severidad_sla === 'P1 - Crítico' ? 'Emergencia (CHE)' : 'Normal (CHN)';
    if (!this.qualifyCodigoJira.startsWith('FCC-')) {
      this.qualifyCodigoJira = `FCC-${Math.floor(115 + Math.random() * 50)}`;
    }
  }

  // --- MODAL CALIFICACIÓN CAB ---
  openQualifyModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.qualifyCodigoJira = ticket.codigo_jira;
    this.qualifyAplicaCambio = ticket.aplica_cambio;
    this.qualifyDimension = ticket.dimension_tecnica === 'Por Clasificar' ? 'Aplicaciones y BD' : ticket.dimension_tecnica;
    this.qualifyTipoItil = ticket.tipo_cambio_itil === 'No Aplica' ? 'Normal (CHN)' : ticket.tipo_cambio_itil;
    this.qualifyEstado = ticket.estado;
    this.qualifyPrioridad = ticket.prioridad;
    this.qualifyComponente = ticket.componente_afectado;
    this.qualifyVentana = ticket.ventana_calendarizacion;
    this.qualifyDocPase = ticket.doc_pase_referencia;
    this.qualifyRollback = ticket.plan_rollback;
    this.qualifyResolucion = ticket.resolucion_tecnica;
    this.qualifyAccionesAplicadas = (ticket.acciones_aplicadas || []).join('\n');
    this.qualifyComandos = ticket.comandos_ejecutados || '';
    this.qualifyValidacionPost = ticket.validacion_post_cierre || '';
    this.qualifyEtiquetasKb = (ticket.etiquetas_kb || []).join(', ');
    this.qualifyPublicarKb = ticket.publicado_kb !== false;
    this.isQualifyModalOpen = true;
  }

  onQualifyAplicaChange() {
    if (this.qualifyAplicaCambio === 'Si Aplica (RFC)') {
      if (this.qualifyDimension === 'Por Clasificar' || this.qualifyDimension === 'N/A - Mesa de Ayuda') {
        this.qualifyDimension = 'Aplicaciones y BD';
      }
      if (this.qualifyTipoItil === 'No Aplica') {
        this.qualifyTipoItil = 'Normal (CHN)';
      }
      if (!this.qualifyCodigoJira.startsWith('FCC-')) {
        this.qualifyCodigoJira = `FCC-${Math.floor(115 + Math.random() * 50)}`;
      }
    } else if (this.qualifyAplicaCambio === 'No Aplica (Soporte Directo)') {
      this.qualifyDimension = 'N/A - Mesa de Ayuda';
      this.qualifyTipoItil = 'No Aplica';
    }
  }

  saveQualification() {
    if (!this.selectedTicket) return;
    const acciones = this.parseLines(this.qualifyAccionesAplicadas);
    const tags = this.parseTags(this.qualifyEtiquetasKb);

    this.dataService.qualifySupportTicket(this.selectedTicket.id_ticket, {
      codigo_jira: this.qualifyCodigoJira,
      aplica_cambio: this.qualifyAplicaCambio,
      dimension_tecnica: this.qualifyDimension,
      tipo_cambio_itil: this.qualifyTipoItil,
      estado: this.qualifyEstado,
      prioridad: this.qualifyPrioridad,
      componente_afectado: this.qualifyComponente,
      ventana_calendarizacion: this.qualifyVentana,
      doc_pase_referencia: this.qualifyDocPase,
      plan_rollback: this.qualifyRollback,
      resolucion_tecnica: this.qualifyResolucion,
      acciones_aplicadas: acciones.length ? acciones : this.selectedTicket.acciones_aplicadas,
      comandos_ejecutados: this.qualifyComandos.trim() || this.selectedTicket.comandos_ejecutados,
      validacion_post_cierre: this.qualifyValidacionPost.trim() || this.selectedTicket.validacion_post_cierre,
      etiquetas_kb: tags.length ? tags : this.selectedTicket.etiquetas_kb,
      publicado_kb: this.qualifyEstado === 'Completado' ? this.qualifyPublicarKb : this.selectedTicket.publicado_kb,
      aprobado_por: this.isAdmin ? 'Fiorella Gamarra (Admin / CAB)' : this.selectedTicket.aprobado_por
    }, () => {
      this.closeAllModals();
    });
  }

  openDetailModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.isDetailModalOpen = true;
  }

  deleteTicket(ticket: SupportChangeTicket) {
    this.confirmService.confirm({
      title: 'Eliminar Registro de Bandeja',
      message: `¿Está seguro de que desea eliminar el registro ${ticket.id_ticket} (${ticket.codigo_jira})?`,
      itemName: ticket.titulo,
      type: 'danger',
      confirmText: 'Sí, Eliminar'
    }).then((confirmed: boolean) => {
      if (confirmed) {
        this.dataService.deleteSupportTicket(ticket.id_ticket);
      }
    });
  }

  closeAllModals() {
    this.isNewTicketModalOpen = false;
    this.isQualifyModalOpen = false;
    this.isDetailModalOpen = false;
    this.isWorkaroundModalOpen = false;
    this.isPirModalOpen = false;
    this.selectedTicket = null;
  }
}
