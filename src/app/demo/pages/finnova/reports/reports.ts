import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService } from 'src/app/services/finnova-data.service';
import { ApiService, ReportDashboardMetrics, ReportComisionItem, ReportGananciaPeriodoItem, ReportServicioItem, ReportAsesorItem, ReportCampaniaItem } from 'src/app/services/api.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

export type ReportType = 'comisiones' | 'ganancias' | 'servicios' | 'asesores' | 'campanias';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports implements OnInit {
  public dataService = inject(FinnovaDataService);
  private apiService = inject(ApiService);
  private confirmService = inject(ConfirmDialogService);

  // Global KPIs State
  metrics: ReportDashboardMetrics = {
    solicitudes: {
      total_solicitudes: 0,
      solicitudes_finalizadas: 0,
      solicitudes_atendidas: 0,
      solicitudes_en_proceso: 0,
      solicitudes_pendientes: 0,
      pagos_validados: 0,
      total_recaudado: 0,
      comisiones_ganadas_broker: 0
    },
    servicios: {
      total_servicios: 0,
      servicios_activos: 0,
      total_categorias: 0
    },
    campanias: {
      total_campanias: 0,
      campanias_activas: 0,
      campanias_inactivas: 0
    },
    clientes: {
      total_clientes: 0,
      clientes_activos: 0
    },
    proveedores: {
      total_proveedores: 0,
      promedio_comision_aliados: 0
    },
    citas: {
      total_citas: 0,
      citas_realizadas: 0,
      citas_programadas: 0
    }
  };

  // Filter Form State
  reportType: ReportType = 'comisiones';
  agrupacion: 'mes' | 'semana' = 'mes';
  startDate: string = '';
  endDate: string = '';
  estadoAtencionFiltro: string = 'Todos';
  searchTerm: string = '';

  // View & Data State
  isLoadingMetrics: boolean = false;
  isLoadingReport: boolean = false;
  isGenerated: boolean = false;
  activePeriodLabel: string = 'Histórico Completo';

  // Loaded Report Data
  comisionesData: ReportComisionItem[] = [];
  gananciasData: ReportGananciaPeriodoItem[] = [];
  serviciosData: ReportServicioItem[] = [];
  asesoresData: ReportAsesorItem[] = [];
  campaniasData: ReportCampaniaItem[] = [];

  ngOnInit(): void {
    this.setQuickPeriod('month');
    this.loadDashboardMetrics();
    this.generateReport();
  }

  // Quick Period Selectors
  setQuickPeriod(period: 'month' | 'quarter' | 'year' | 'all'): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    if (period === 'month') {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      this.startDate = this.formatDate(start);
      this.endDate = this.formatDate(end);
      this.activePeriodLabel = 'Este Mes';
    } else if (period === 'quarter') {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const start = new Date(currentYear, quarterStartMonth, 1);
      const end = new Date(currentYear, quarterStartMonth + 3, 0);
      this.startDate = this.formatDate(start);
      this.endDate = this.formatDate(end);
      this.activePeriodLabel = 'Trimestre Actual';
    } else if (period === 'year') {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      this.startDate = this.formatDate(start);
      this.endDate = this.formatDate(end);
      this.activePeriodLabel = `Año ${currentYear}`;
    } else {
      this.startDate = '';
      this.endDate = '';
      this.activePeriodLabel = 'Histórico Completo';
    }
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Load Dashboard High-Level Metrics
  loadDashboardMetrics(): void {
    this.isLoadingMetrics = true;
    const params: { fecha_inicio?: string; fecha_fin?: string } = {};
    if (this.startDate) params.fecha_inicio = this.startDate;
    if (this.endDate) params.fecha_fin = this.endDate;

    this.apiService.getReportsDashboard(params).subscribe({
      next: (res) => {
        if (res && res.solicitudes) {
          this.metrics = res;
        }
        this.isLoadingMetrics = false;
      },
      error: (err) => {
        console.warn('Backend metrics fallback to local stream calculation:', err);
        this.calculateLocalMetricsFallback();
        this.isLoadingMetrics = false;
      }
    });
  }

  // Fallback calculation using local reactive store if backend report route fails
  private calculateLocalMetricsFallback(): void {
    const reqs = this.dataService.getRequests();
    const servs = this.dataService.getServices();
    const camps = this.dataService.getCampaigns();
    const clients = this.dataService.getClients();
    const provs = this.dataService.getProveedores();
    const citas = this.dataService.getAppointments();

    const finalizadas = reqs.filter(r => r.status === 'Finalizada').length;
    const atendidas = reqs.filter(r => r.status === 'Atendida').length;
    const enProceso = reqs.filter(r => r.status === 'En Proceso').length;
    const pendientes = reqs.filter(r => r.status.includes('Pendiente') || r.status === 'Nueva').length;
    const pagosValidados = reqs.filter(r => r.estadoPago === 'Pagado').length;
    const totalRecaudado = reqs.reduce((acc, r) => acc + (r.estadoPago === 'Pagado' ? (r.montoPagado || r.servicePrecio || 0) : 0), 0);
    const comisionesGanadas = reqs.reduce((acc, r) => acc + (Number(r.montoComisionBroker) || 0), 0);

    this.metrics = {
      solicitudes: {
        total_solicitudes: reqs.length,
        solicitudes_finalizadas: finalizadas,
        solicitudes_atendidas: atendidas,
        solicitudes_en_proceso: enProceso,
        solicitudes_pendientes: pendientes,
        pagos_validados: pagosValidados,
        total_recaudado: totalRecaudado,
        comisiones_ganadas_broker: comisionesGanadas
      },
      servicios: {
        total_servicios: servs.length,
        servicios_activos: servs.filter(s => s.status === 'Activo').length,
        total_categorias: new Set(servs.map(s => s.category)).size
      },
      campanias: {
        total_campanias: camps.length,
        campanias_activas: camps.filter(c => c.status === 'Activa').length,
        campanias_inactivas: camps.filter(c => c.status !== 'Activa').length
      },
      clientes: {
        total_clientes: clients.length,
        clientes_activos: clients.filter(c => c.status === 'Activo').length
      },
      proveedores: {
        total_proveedores: provs.length,
        promedio_comision_aliados: provs.length > 0 ? provs.reduce((a, p) => a + (p.comisionPct || 0), 0) / provs.length : 0
      },
      citas: {
        total_citas: citas.length,
        citas_realizadas: citas.filter(c => c.status === 'Realizada').length,
        citas_programadas: citas.filter(c => c.status === 'Programada').length
      }
    };
  }

  // Generate Report according to selected filters
  generateReport(): void {
    this.isLoadingReport = true;
    this.isGenerated = true;

    const params: any = {};
    if (this.startDate) params.fecha_inicio = this.startDate;
    if (this.endDate) params.fecha_fin = this.endDate;

    if (this.reportType === 'comisiones') {
      if (this.estadoAtencionFiltro && this.estadoAtencionFiltro !== 'Todos') {
        params.estado_atencion = this.estadoAtencionFiltro;
      }
      this.apiService.getComisionesReport(params).subscribe({
        next: (data) => {
          this.comisionesData = data || [];
          this.isLoadingReport = false;
        },
        error: () => {
          // Fallback from local requests
          const reqs = this.dataService.getRequests();
          this.comisionesData = reqs.map(r => ({
            id_solicitud: r.id,
            fecha_registro: r.date,
            fecha_cierre: null,
            monto_servicio: r.servicePrecio || 0,
            monto_pagado: r.montoPagado || (r.estadoPago === 'Pagado' ? (r.servicePrecio || 0) : 0),
            estado_pago: r.estadoPago,
            estado_atencion: r.status,
            porcentaje_comision_aliado: r.comisionAliadoPct || 0,
            monto_comision_broker: r.montoComisionBroker || 0,
            nombre_cliente: r.clientName,
            dni_cliente: r.clientDni,
            titulo_servicio: r.serviceTitle,
            categoria_servicio: 'Financiero',
            nombre_proveedor: r.proveedorNombre || '-',
            nombre_asesor: r.assignedAdvisorName || 'Sin Asignar'
          }));
          this.isLoadingReport = false;
        }
      });
    } else if (this.reportType === 'ganancias') {
      params.agrupacion = this.agrupacion;
      this.apiService.getGananciasHistoricas(params).subscribe({
        next: (data) => {
          this.gananciasData = data || [];
          this.isLoadingReport = false;
        },
        error: () => {
          this.gananciasData = [
            {
              periodo: this.agrupacion === 'semana' ? 'Semana Actual' : 'Mes Actual',
              total_solicitudes: this.metrics.solicitudes.total_solicitudes,
              solicitudes_exitosas: this.metrics.solicitudes.solicitudes_finalizadas,
              monto_total_solicitado: this.metrics.solicitudes.total_recaudado,
              total_recaudado: this.metrics.solicitudes.total_recaudado,
              comisiones_broker: this.metrics.solicitudes.comisiones_ganadas_broker
            }
          ];
          this.isLoadingReport = false;
        }
      });
    } else if (this.reportType === 'servicios') {
      this.apiService.getServiciosRendimiento(params).subscribe({
        next: (data) => {
          this.serviciosData = data || [];
          this.isLoadingReport = false;
        },
        error: () => {
          const servs = this.dataService.getServices();
          const reqs = this.dataService.getRequests();
          this.serviciosData = servs.map(s => {
            const relatedReqs = reqs.filter(r => r.serviceId === s.id);
            const exitosas = relatedReqs.filter(r => r.status === 'Finalizada' || r.status === 'Atendida').length;
            const recaudado = relatedReqs.reduce((acc, r) => acc + (r.estadoPago === 'Pagado' ? (r.montoPagado || r.servicePrecio || 0) : 0), 0);
            const comisiones = relatedReqs.reduce((acc, r) => acc + (r.montoComisionBroker || 0), 0);
            return {
              id_servicio: s.id,
              titulo: s.title,
              categoria: s.category,
              precio_tarifa: s.precio,
              estado_servicio: s.status,
              nombre_proveedor: s.proveedorNombre || '-',
              total_solicitudes: relatedReqs.length,
              solicitudes_exitosas: exitosas,
              total_recaudado: recaudado,
              total_comisiones_broker: comisiones
            };
          });
          this.isLoadingReport = false;
        }
      });
    } else if (this.reportType === 'asesores') {
      this.apiService.getAsesoresDesempeno(params).subscribe({
        next: (data) => {
          this.asesoresData = data || [];
          this.isLoadingReport = false;
        },
        error: () => {
          const users = this.dataService.getUsers().filter(u => u.role === 'Asesor');
          const reqs = this.dataService.getRequests();
          const citas = this.dataService.getAppointments();
          this.asesoresData = users.map(u => {
            const advisorReqs = reqs.filter(r => r.assignedAdvisorId === u.id || (r.assignedAdvisorName && r.assignedAdvisorName.includes(u.name.split(' ')[0])));
            const fin = advisorReqs.filter(r => r.status === 'Finalizada').length;
            const at = advisorReqs.filter(r => r.status === 'Atendida').length;
            const rec = advisorReqs.reduce((acc, r) => acc + (r.estadoPago === 'Pagado' ? (r.montoPagado || r.servicePrecio || 0) : 0), 0);
            const com = advisorReqs.reduce((acc, r) => acc + (r.montoComisionBroker || 0), 0);
            const advisorCitas = citas.filter(c => c.advisorId === u.id || c.advisorName.includes(u.name.split(' ')[0]));
            const citReal = advisorCitas.filter(c => c.status === 'Realizada').length;
            return {
              id_usuario: u.id,
              nombre_asesor: u.name,
              correo_electronico: u.email,
              estado_asesor: u.status,
              total_solicitudes: advisorReqs.length,
              solicitudes_finalizadas: fin,
              solicitudes_atendidas: at,
              total_recaudado: rec,
              total_comisiones_generadas: com,
              total_citas_asignadas: advisorCitas.length,
              citas_realizadas: citReal
            };
          });
          this.isLoadingReport = false;
        }
      });
    } else if (this.reportType === 'campanias') {
      this.apiService.getCampaniasReport().subscribe({
        next: (data) => {
          this.campaniasData = data || [];
          this.isLoadingReport = false;
        },
        error: () => {
          const camps = this.dataService.getCampaigns();
          this.campaniasData = camps.map(c => ({
            id_campana: c.id,
            titulo: c.title,
            publico_objetivo: 'Clientes interesados',
            categoria: 'Financiero',
            estado: c.status,
            fecha_programada: c.createdAt,
            fecha_creacion: c.createdAt,
            servicio_promovido: c.targetServiceName || '-',
            aliado_proveedor: c.targetProveedorName || '-',
            usuario_creador: 'Administrador'
          }));
          this.isLoadingReport = false;
        }
      });
    }
  }

  // Filtered lists based on search query
  get filteredComisiones(): ReportComisionItem[] {
    if (!this.searchTerm.trim()) return this.comisionesData;
    const term = this.searchTerm.toLowerCase();
    return this.comisionesData.filter(item =>
      item.id_solicitud.toLowerCase().includes(term) ||
      item.nombre_cliente.toLowerCase().includes(term) ||
      item.dni_cliente.toLowerCase().includes(term) ||
      item.titulo_servicio.toLowerCase().includes(term) ||
      item.nombre_proveedor.toLowerCase().includes(term) ||
      item.nombre_asesor.toLowerCase().includes(term) ||
      item.estado_atencion.toLowerCase().includes(term)
    );
  }

  get filteredGanancias(): ReportGananciaPeriodoItem[] {
    if (!this.searchTerm.trim()) return this.gananciasData;
    const term = this.searchTerm.toLowerCase();
    return this.gananciasData.filter(item =>
      item.periodo.toLowerCase().includes(term)
    );
  }

  get filteredServicios(): ReportServicioItem[] {
    if (!this.searchTerm.trim()) return this.serviciosData;
    const term = this.searchTerm.toLowerCase();
    return this.serviciosData.filter(item =>
      item.titulo.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term) ||
      item.nombre_proveedor.toLowerCase().includes(term) ||
      item.estado_servicio.toLowerCase().includes(term)
    );
  }

  get filteredAsesores(): ReportAsesorItem[] {
    if (!this.searchTerm.trim()) return this.asesoresData;
    const term = this.searchTerm.toLowerCase();
    return this.asesoresData.filter(item =>
      item.nombre_asesor.toLowerCase().includes(term) ||
      item.correo_electronico.toLowerCase().includes(term) ||
      item.estado_asesor.toLowerCase().includes(term)
    );
  }

  get filteredCampanias(): ReportCampaniaItem[] {
    if (!this.searchTerm.trim()) return this.campaniasData;
    const term = this.searchTerm.toLowerCase();
    return this.campaniasData.filter(item =>
      item.titulo.toLowerCase().includes(term) ||
      item.servicio_promovido.toLowerCase().includes(term) ||
      item.aliado_proveedor.toLowerCase().includes(term) ||
      item.estado.toLowerCase().includes(term)
    );
  }

  // Summary Totals
  get totalComisionesSum(): number {
    return this.filteredComisiones.reduce((acc, item) => acc + (Number(item.monto_comision_broker) || 0), 0);
  }

  get totalRecaudadoComisionesSum(): number {
    return this.filteredComisiones.reduce((acc, item) => acc + (item.estado_pago === 'Pagado' ? (Number(item.monto_pagado) || Number(item.monto_servicio) || 0) : 0), 0);
  }

  get totalGananciasPeriodoSum(): number {
    return this.filteredGanancias.reduce((acc, item) => acc + (Number(item.total_recaudado) || 0), 0);
  }

  get totalComisionesPeriodoSum(): number {
    return this.filteredGanancias.reduce((acc, item) => acc + (Number(item.comisiones_broker) || 0), 0);
  }

  get totalServiciosRecaudacionSum(): number {
    return this.filteredServicios.reduce((acc, item) => acc + (Number(item.total_recaudado) || 0), 0);
  }

  get totalServiciosComisionesSum(): number {
    return this.filteredServicios.reduce((acc, item) => acc + (Number(item.total_comisiones_broker) || 0), 0);
  }

  get totalAsesoresComisionesSum(): number {
    return this.filteredAsesores.reduce((acc, item) => acc + (Number(item.total_comisiones_generadas) || 0), 0);
  }

  get totalAsesoresRecaudadoSum(): number {
    return this.filteredAsesores.reduce((acc, item) => acc + (Number(item.total_recaudado) || 0), 0);
  }

  // Reset Filters
  resetFilters(): void {
    this.reportType = 'comisiones';
    this.agrupacion = 'mes';
    this.estadoAtencionFiltro = 'Todos';
    this.searchTerm = '';
    this.setQuickPeriod('month');
    this.loadDashboardMetrics();
    this.generateReport();
  }

  // Export to CSV
  downloadCSV(): void {
    let csvContent = '\uFEFF'; // UTF-8 BOM for correct Excel encoding
    const dateStr = new Date().toISOString().split('T')[0];

    if (this.reportType === 'comisiones') {
      csvContent += 'Código Solicitud,Fecha Registro,Cliente,DNI,Servicio,Aliado Proveedor,Asesor,Tarifa (S/),Monto Pagado (S/),Estado Pago,Comisión Aliado (%),Comisión Broker (S/),Estado Atención\n';
      this.filteredComisiones.forEach(row => {
        csvContent += `"${row.id_solicitud}","${row.fecha_registro.split('T')[0]}","${row.nombre_cliente}","${row.dni_cliente}","${row.titulo_servicio}","${row.nombre_proveedor}","${row.nombre_asesor}",${row.monto_servicio},${row.monto_pagado},"${row.estado_pago}",${row.porcentaje_comision_aliado}%,${row.monto_comision_broker},"${row.estado_atencion}"\n`;
      });
    } else if (this.reportType === 'ganancias') {
      csvContent += 'Periodo,Total Solicitudes,Solicitudes Exitosas,Monto Solicitado (S/),Total Recaudado (S/),Comisiones Broker (S/)\n';
      this.filteredGanancias.forEach(row => {
        csvContent += `"${row.periodo}",${row.total_solicitudes},${row.solicitudes_exitosas},${row.monto_total_solicitado},${row.total_recaudado},${row.comisiones_broker}\n`;
      });
    } else if (this.reportType === 'servicios') {
      csvContent += 'ID Servicio,Título del Servicio,Categoría,Aliado Proveedor,Tarifa (S/),Total Solicitudes,Solicitudes Exitosas,Recaudación Total (S/),Comisiones Broker (S/),Estado\n';
      this.filteredServicios.forEach(row => {
        csvContent += `${row.id_servicio},"${row.titulo}","${row.categoria}","${row.nombre_proveedor}",${row.precio_tarifa},${row.total_solicitudes},${row.solicitudes_exitosas},${row.total_recaudado},${row.total_comisiones_broker},"${row.estado_servicio}"\n`;
      });
    } else if (this.reportType === 'asesores') {
      csvContent += 'ID Asesor,Nombre Asesor,Correo Electrónico,Solicitudes Asignadas,Finalizadas,Atendidas,Citas Asignadas,Citas Realizadas,Recaudación Generada (S/),Comisiones Finnova (S/),Estado\n';
      this.filteredAsesores.forEach(row => {
        csvContent += `${row.id_usuario},"${row.nombre_asesor}","${row.correo_electronico}",${row.total_solicitudes},${row.solicitudes_finalizadas},${row.solicitudes_atendidas},${row.total_citas_asignadas},${row.citas_realizadas},${row.total_recaudado},${row.total_comisiones_generadas},"${row.estado_asesor}"\n`;
      });
    } else if (this.reportType === 'campanias') {
      csvContent += 'ID Campaña,Título,Servicio Promovido,Aliado Proveedor,Público Objetivo,Fecha Creación,Fecha Programada,Creado Por,Estado\n';
      this.filteredCampanias.forEach(row => {
        csvContent += `${row.id_campana},"${row.titulo}","${row.servicio_promovido}","${row.aliado_proveedor}","${row.publico_objetivo}","${row.fecha_creacion ? row.fecha_creacion.split('T')[0] : ''}","${row.fecha_programada ? row.fecha_programada.split('T')[0] : ''}","${row.usuario_creador}","${row.estado}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_finnova_${this.reportType}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export / Print PDF View
  downloadPDF(): void {
    window.print();
  }
}
