import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MonthlyBarChartComponent } from 'src/app/theme/shared/apexchart/monthly-bar-chart/monthly-bar-chart.component';
import { IncomeOverviewChartComponent } from 'src/app/theme/shared/apexchart/income-overview-chart/income-overview-chart.component';

import { IconService, IconDirective } from '@ant-design/icons-angular';
import { FallOutline, GiftOutline, MessageOutline, RiseOutline, SettingOutline, TeamOutline, AppstoreOutline, FileTextOutline, CalendarOutline, BarChartOutline, FilePdfOutline } from '@ant-design/icons-angular/icons';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService } from 'src/app/services/finnova-data.service';

@Component({
  selector: 'app-default',
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    IconDirective,
    MonthlyBarChartComponent,
    IncomeOverviewChartComponent,
    RouterLink
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent {
  private iconService = inject(IconService);
  public dataService = inject(FinnovaDataService);

  // Report Generator Fields (F014)
  reportType = 'Solicitudes por Asesor';
  startDate = '2026-09-01';
  endDate = '2026-09-30';
  isReportGenerated = false;

  reportData: Array<{ col1: string; col2: string; col3: string; col4: string }> = [];

  constructor() {
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, GiftOutline, MessageOutline, TeamOutline, AppstoreOutline, FileTextOutline, CalendarOutline, BarChartOutline, FilePdfOutline]);
  }

  get totalClientsCount(): number {
    return this.dataService.getClients().length;
  }

  get activeServicesCount(): number {
    return this.dataService.getServices().filter(s => s.status === 'Activo').length;
  }

  get totalRequestsCount(): number {
    return this.dataService.getRequests().length;
  }

  get pendingRequestsCount(): number {
    return this.dataService.getRequests().filter(r => r.status === 'Nueva' || r.status === 'Pendiente' || r.status === 'En Proceso').length;
  }

  get scheduledAppointmentsCount(): number {
    return this.dataService.getAppointments().filter(a => a.status === 'Programada').length;
  }

  get recentRequests() {
    return this.dataService.getRequests().slice(0, 5);
  }

  // Report Generator Methods (F014)
  generateReport() {
    this.isReportGenerated = true;
    if (this.reportType === 'Solicitudes por Asesor') {
      const requests = this.dataService.getRequests();
      this.reportData = [
        { col1: 'Juan Pérez (Asesor)', col2: '12 Solicitudes', col3: '8 Atendidas', col4: '95% Satisfacción' },
        { col1: 'Ana Gómez (Asesora)', col2: '15 Solicitudes', col3: '11 Atendidas', col4: '98% Satisfacción' }
      ];
    } else if (this.reportType === 'Rendimiento de Servicios') {
      const services = this.dataService.getServices();
      this.reportData = services.map(s => ({
        col1: s.title,
        col2: s.category,
        col3: s.status,
        col4: 'Demanda Alta'
      }));
    } else if (this.reportType === 'Clientes Registrados') {
      const clients = this.dataService.getClients();
      this.reportData = clients.map(c => ({
        col1: c.name,
        col2: `DNI: ${c.dni}`,
        col3: c.assignedAdvisorName || 'Sin Asignar',
        col4: c.status
      }));
    } else {
      const appointments = this.dataService.getAppointments();
      this.reportData = appointments.map(a => ({
        col1: a.id,
        col2: a.clientName,
        col3: a.dateTime,
        col4: a.status
      }));
    }
  }

  downloadPDF() {
    alert(`Generando y descargando PDF para: ${this.reportType} del ${this.startDate} al ${this.endDate}`);
  }
}
