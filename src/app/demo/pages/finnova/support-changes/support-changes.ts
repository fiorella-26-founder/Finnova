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
  DimensionMetricsRow
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

  activeTab: 'bandeja' | 'dimensiones' | 'pase-calendario' = 'dimensiones';

  // Filtros de la bandeja
  filterDimension: string = 'TODAS';
  filterEstado: string = 'TODOS';
  filterAplica: string = 'TODOS';
  searchTerm: string = '';

  // Modales
  isNewTicketModalOpen = false;
  isQualifyModalOpen = false;
  isDetailModalOpen = false;
  selectedTicket: SupportChangeTicket | null = null;

  // Formulario Nueva Solicitud (Mesa de Ayuda / Soporte / Cambio)
  newTitulo = '';
  newDescripcion = '';
  newTipoSolicitud = 'Soporte / Mesa de Ayuda';
  newPrioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica' = 'Media';
  newComponente = 'Frontend Angular (Vercel)';
  newSolicitanteNombre = '';
  newAplicaDirecto: ChangeApplicationFlag = 'Pendiente Evaluación';
  newDimensionDirecta: TechnicalDimension = 'Por Clasificar';
  newTipoItilDirecto: ItilChangeType = 'No Aplica';
  newVentanaDirecta = 'Por definir en Comité CAB';
  newPlanRollbackDirecto = 'Instant Rollback en Vercel / Render ante anomalía post-pase.';

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

  ngOnInit() {
    this.dataService.loadSupportTickets();
  }

  get allTickets(): SupportChangeTicket[] {
    return this.dataService.getSupportTickets();
  }

  get filteredTickets(): SupportChangeTicket[] {
    return this.allTickets.filter(t => {
      if (this.filterDimension !== 'TODAS' && t.dimension_tecnica !== this.filterDimension) return false;
      if (this.filterEstado !== 'TODOS' && t.estado !== this.filterEstado) return false;
      if (this.filterAplica !== 'TODOS' && t.aplica_cambio !== this.filterAplica) return false;
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

  openNewTicketModal() {
    this.newTitulo = '';
    this.newDescripcion = '';
    this.newTipoSolicitud = 'Soporte / Mesa de Ayuda';
    this.newPrioridad = 'Media';
    this.newComponente = 'Frontend Angular (Vercel)';
    this.newSolicitanteNombre = this.dataService.activeRole === 'Administrador'
      ? 'Fiorella Gamarra (Admin)'
      : this.dataService.activeRole === 'Asesor'
      ? 'Juan Pérez (Asesor)'
      : 'María López (Cliente)';
    this.newAplicaDirecto = 'Pendiente Evaluación';
    this.newDimensionDirecta = 'Por Clasificar';
    this.newTipoItilDirecto = 'No Aplica';
    this.newVentanaDirecta = 'Ventana Estándar (Mar/Jue 10:00 AM)';
    this.newPlanRollbackDirecto = 'Instant Rollback en Vercel / Render ante anomalía en Smoke Test.';
    this.isNewTicketModalOpen = true;
  }

  onAplicaDirectoChange() {
    if (this.newAplicaDirecto === 'Si Aplica (RFC)') {
      if (this.newDimensionDirecta === 'Por Clasificar' || this.newDimensionDirecta === 'N/A - Mesa de Ayuda') {
        this.newDimensionDirecta = 'Aplicaciones y BD';
      }
      if (this.newTipoItilDirecto === 'No Aplica') {
        this.newTipoItilDirecto = 'Normal (CHN)';
      }
    } else if (this.newAplicaDirecto === 'No Aplica (Soporte Directo)') {
      this.newDimensionDirecta = 'N/A - Mesa de Ayuda';
      this.newTipoItilDirecto = 'No Aplica';
    } else {
      this.newDimensionDirecta = 'Por Clasificar';
      this.newTipoItilDirecto = 'No Aplica';
    }
  }

  saveNewTicket() {
    if (!this.newTitulo.trim() || !this.newDescripcion.trim()) {
      return;
    }

    this.dataService.addSupportTicket({
      titulo: this.newTitulo.trim(),
      descripcion: this.newDescripcion.trim(),
      tipo_solicitud: this.newTipoSolicitud,
      prioridad: this.newPrioridad,
      componente_afectado: this.newComponente,
      solicitante_nombre: this.newSolicitanteNombre.trim() || 'Usuario Finnova',
      solicitante_rol: this.dataService.activeRole,
      aplica_cambio: this.newAplicaDirecto,
      dimension_tecnica: this.newDimensionDirecta,
      tipo_cambio_itil: this.newTipoItilDirecto,
      estado: 'Abierto',
      ventana_calendarizacion: this.newVentanaDirecta,
      doc_pase_referencia: this.newComponente.includes('Frontend')
        ? 'proyecto-finnova/docs/PASE_A_PRODUCCION.md'
        : 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: this.newPlanRollbackDirecto,
      resolucion_tecnica: 'Solicitud registrada en la Bandeja de Soporte y Control de Cambios.'
    }, () => {
      this.closeAllModals();
    });
  }

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
        this.qualifyCodigoJira = `FCC-${Math.floor(113 + Math.random() * 50)}`;
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
      resolucion_tecnica: this.qualifyResolucion
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
    this.selectedTicket = null;
  }
}
