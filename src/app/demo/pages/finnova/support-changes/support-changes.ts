import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
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
  SlaStatus,
  AssignedRoleLevel,
  UserRole,
  computeIncidentSeverity
} from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-support-changes',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './support-changes.html',
  styleUrl: './support-changes.scss'
})
export class SupportChangesManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Pestaña activa: Por defecto iniciamos en 'incidentes' (Semana 14)
  activeTab: 'incidentes' | 'dimensiones' | 'bandeja' | 'pase-calendario' = 'incidentes';

  // Filtros de la bandeja unificada
  filterDimension: string = 'TODAS';
  filterEstado: string = 'TODOS';
  filterAplica: string = 'TODOS';
  filterTipoTicket: string = 'TODOS';
  searchTerm: string = '';

  // Filtros del tablero de incidentes
  filterSeveridad: string = 'TODAS';
  filterIncidenteEstado: string = 'TODOS';

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

  // Campos Técnicos de Incidentes & SLA (Semana 14)
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
  newAtendidoPor = '';
  newAprobadoPor = '';
  newRcaCausaRaiz = '';

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

  // Formulario de Workaround (Soporte TI L1/L2)
  workaroundDiagnostico = '';
  workaroundSolucionTemporal = '';
  workaroundNuevoEstado: ChangeStatus = 'En Proceso';

  // Formulario de Post-Mortem / PIR (Causa Raíz RCA)
  pir5Whys = '';
  pirAccionCorrectiva = '';
  pirResponsable = 'Fiorella Gamarra (Tech Lead & CAB)';

  ngOnInit() {
    this.dataService.loadSupportTickets();
  }

  get allTickets(): SupportChangeTicket[] {
    return this.dataService.getSupportTickets();
  }

  // --- FILTROS Y MÉTRICAS DE INCIDENTES (SEMANA 14) ---
  get allIncidents(): SupportChangeTicket[] {
    return this.allTickets.filter(t =>
      t.tipo_solicitud === 'Incidente Técnico' ||
      t.id_ticket.startsWith('INC-') ||
      t.severidad_sla !== undefined
    );
  }

  get filteredIncidents(): SupportChangeTicket[] {
    return this.allIncidents.filter(inc => {
      if (this.filterSeveridad !== 'TODAS' && inc.severidad_sla !== this.filterSeveridad) return false;
      if (this.filterIncidenteEstado !== 'TODOS' && inc.estado !== this.filterIncidenteEstado) return false;
      if (this.searchTerm.trim()) {
        const q = this.searchTerm.toLowerCase();
        const match =
          inc.id_ticket.toLowerCase().includes(q) ||
          inc.codigo_jira.toLowerCase().includes(q) ||
          inc.titulo.toLowerCase().includes(q) ||
          (inc.codigo_error && inc.codigo_error.toLowerCase().includes(q)) ||
          inc.componente_afectado.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    return 12; // MTTA Promedio calculado en Finnova: 12 min (Objetivo P1: <= 15 min)
  }

  get avgMttrHours(): number {
    return 1.8; // MTTR Promedio calculado en Finnova: 1.8 h (Objetivo P1: <= 2.0 h)
  }

  // --- FILTROS DE BANDEJA GENERAL (SEMANA 10 & 11) ---
  get filteredTickets(): SupportChangeTicket[] {
    return this.allTickets.filter(t => {
      if (this.filterDimension !== 'TODAS' && t.dimension_tecnica !== this.filterDimension) return false;
      if (this.filterEstado !== 'TODOS' && t.estado !== this.filterEstado) return false;
      if (this.filterAplica !== 'TODOS' && t.aplica_cambio !== this.filterAplica) return false;
      if (this.filterTipoTicket !== 'TODOS' && t.tipo_solicitud !== this.filterTipoTicket) return false;
      if (this.searchTerm.trim()) {
        const q = this.searchTerm.toLowerCase();
        const match =
          t.id_ticket.toLowerCase().includes(q) ||
          t.codigo_jira.toLowerCase().includes(q) ||
          t.titulo.toLowerCase().includes(q) ||
          t.dimension_tecnica.toLowerCase().includes(q) ||
          t.solicitante_nombre.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    this.newTitulo = '';
    this.newDescripcion = '';
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
    this.newSolicitanteNombre = this.activeRole === 'Administrador'
      ? 'Fiorella Gamarra (Admin)'
      : this.activeRole === 'Soporte TI'
      ? 'Ing. Carlos Mendoza (Soporte TI)'
      : this.activeRole === 'Asesor'
      ? 'Juan Pérez (Asesor)'
      : 'María López (Cliente)';
    this.newVentanaDirecta = 'Ventana FSC Inmediata (Hotfix)';
    this.newPlanRollbackDirecto = 'Instant Rollback en Render / Vercel ante anomalía en Smoke Test.';
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

      // Metadatos de Incidentes & SLA
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

  // --- MODAL DE WORKAROUND (SOPORTE TI L1/L2) ---
  openWorkaroundModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.workaroundDiagnostico = ticket.resolucion_tecnica || 'Análisis en logs de Render y TiDB Cloud.';
    this.workaroundSolucionTemporal = ticket.solucion_temporal_workaround || '';
    this.workaroundNuevoEstado = 'En Proceso';
    this.isWorkaroundModalOpen = true;
  }

  saveWorkaround() {
    if (!this.selectedTicket) return;
    this.dataService.qualifySupportTicket(this.selectedTicket.id_ticket, {
      solucion_temporal_workaround: this.workaroundSolucionTemporal,
      resolucion_tecnica: `[Workaround Aplicado por ${this.activeRole === 'Soporte TI' ? 'Ing. Carlos Mendoza (Soporte TI L2)' : 'Admin'}]: ${this.workaroundDiagnostico}`,
      estado: this.workaroundNuevoEstado,
      atendido_por: this.activeRole === 'Soporte TI' ? 'Ing. Carlos Mendoza (Soporte TI L2)' : this.selectedTicket.atendido_por,
      cumplimiento_sla: 'Dentro de SLA'
    }, () => {
      this.closeAllModals();
    });
  }

  // --- MODAL DE POST-MORTEM / PIR (ADMIN & TECH LEAD) ---
  openPirModal(ticket: SupportChangeTicket) {
    this.selectedTicket = ticket;
    this.pir5Whys = ticket.rca_causa_raiz || `1. ¿Por qué ocurrió la saturación? Porque el pool tenía connectionLimit: 5.\n2. ¿Por qué 5 no fue suficiente? Porque hubo 50 solicitudes POST simultáneas por campaña Yape.\n3. ¿Por qué no se liberaron conexiones? Porque faltaba timeout de keep-alive en sockets TLS.\n4. ¿Por qué no se probó antes? Pruebas de carga previas solo simularon 10 usuarios concurrentes.\n5. Causa Raíz Definitiva: Falta de auto-escalado de pool y desconexión pasiva de clientes inactivos.`;
    this.pirAccionCorrectiva = '1. Subir pool a connectionLimit: 15 (Completado en Pase FCC-102).\n2. Integrar monitoreo de conexiones activas en /api/health.\n3. Ejecutar pruebas de carga k6 con 100 VUs.';
    this.isPirModalOpen = true;
  }

  savePir() {
    if (!this.selectedTicket) return;
    this.dataService.qualifySupportTicket(this.selectedTicket.id_ticket, {
      rca_causa_raiz: this.pir5Whys,
      resolucion_tecnica: `${this.selectedTicket.resolucion_tecnica} | [PIR / Post-Mortem Aprobado]: ${this.pirAccionCorrectiva}`,
      aprobado_por: 'Fiorella Gamarra (Tech Lead & CAB)',
      estado: 'Completado'
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

  // --- MODAL CALIFICACIÓN CAB (SEMANA 11) ---
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
      aprobado_por: this.isAdmin ? 'Fiorella Gamarra (Admin / CAB)' : this.selectedTicket.aprobado_por
    }, () => {
      this.closeAllModals();
    });
  }

  quickCycleStatus(ticket: SupportChangeTicket) {
    const nextMap: Record<ChangeStatus, ChangeStatus> = {
      'Abierto': 'En Proceso',
      'En Proceso': 'Completado',
      'Completado': 'Abierto',
      'Rechazado': 'Abierto'
    };
    const nextStatus = nextMap[ticket.estado] || 'En Proceso';
    this.dataService.qualifySupportTicket(ticket.id_ticket, { estado: nextStatus });
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
