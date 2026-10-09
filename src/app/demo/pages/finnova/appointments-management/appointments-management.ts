import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, Appointment, AppointmentStatus } from 'src/app/services/finnova-data.service';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-appointments-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './appointments-management.html',
  styleUrl: './appointments-management.scss'
})
export class AppointmentsManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private authService = inject(AuthService);
  private confirmService = inject(ConfirmDialogService);

  // Modals state
  isFormModalOpen = false;
  isDetailModalOpen = false;
  isAttendModalOpen = false;
  isEditing = false;
  isLoadingData = true;

  // Selected item
  selectedAppointment: Appointment | null = null;

  // Form Fields (RF009)
  currentAppointmentId: string | null = null;
  selectedRequestId = '';
  clientName = '';
  advisorName = '';
  appointmentDate = '';
  appointmentTime = '10:00';
  modality: 'Virtual' | 'Presencial' = 'Virtual';
  locationOrLink = 'https://meet.google.com/finnova-asesoria';
  notes = '';

  // Form Fields - Atención de Cita
  attendNotes = '';
  attendOutcome = '';

  ngOnInit(): void {
    this.isLoadingData = true;
    this.dataService.loadAppointments(() => { this.isLoadingData = false; });
    this.dataService.loadRequests();
    this.dataService.loadUsers();
  }

  get requestsList() {
    return this.dataService.getRequests();
  }

  get advisorsList() {
    return this.dataService.getUsers().filter(u => (u.role === 'Asesor' || u.role === 'Administrador') && u.status === 'Activo');
  }

  openNewAppointmentModal() {
    this.isEditing = false;
    this.currentAppointmentId = null;

    const currentUser = this.authService.getUser();
    if (currentUser && (currentUser.rol === 'Asesor' || this.dataService.activeRole === 'Asesor')) {
      this.advisorName = currentUser.nombre_completo;
    } else {
      this.advisorName = this.advisorsList.length > 0 ? this.advisorsList[0].name : 'Juan Pérez (Asesor)';
    }

    const reqs = this.requestsList;
    if (reqs.length > 0) {
      this.onRequestSelected(reqs[0].id);
    } else {
      this.selectedRequestId = '';
      this.clientName = '';
    }

    this.appointmentDate = new Date().toISOString().split('T')[0];
    this.appointmentTime = '10:00';
    this.modality = 'Virtual';
    this.locationOrLink = 'https://meet.google.com/finnova-asesoria';
    this.notes = '';
    this.isFormModalOpen = true;
  }

  openEditModal(appointment: Appointment) {
    this.isEditing = true;
    this.currentAppointmentId = appointment.id;
    this.selectedRequestId = appointment.requestId;
    this.clientName = appointment.clientName;
    this.advisorName = appointment.advisorName;
    const parts = appointment.dateTime.split(' ');
    this.appointmentDate = parts[0] || '';
    this.appointmentTime = parts[1] || '10:00';
    this.modality = appointment.modality;
    this.locationOrLink = appointment.locationOrLink;
    this.notes = appointment.notes || '';
    this.isFormModalOpen = true;
  }

  openDetailModal(appointment: Appointment) {
    this.selectedAppointment = appointment;
    this.isDetailModalOpen = true;
  }

  closeFormModal() {
    this.isFormModalOpen = false;
  }

  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedAppointment = null;
  }

  onRequestSelected(requestId: string) {
    this.selectedRequestId = requestId;
    const req = this.requestsList.find(r => r.id === requestId);
    if (req) {
      this.clientName = req.clientName;
      const currentUser = this.authService.getUser();
      if (currentUser && (currentUser.rol === 'Asesor' || this.dataService.activeRole === 'Asesor')) {
        this.advisorName = currentUser.nombre_completo;
      } else {
        this.advisorName = req.assignedAdvisorName || (this.advisorsList.length ? this.advisorsList[0].name : 'Juan Pérez (Asesor)');
      }
    }
  }

  saveAppointment() {
    if (!this.clientName.trim() || !this.appointmentDate.trim() || !this.appointmentTime.trim()) {
      this.confirmService.alert('Por favor completa la fecha, hora y cliente para programar la cita.', 'Campos Requeridos', 'warning');
      return;
    }

    const fullDateTime = `${this.appointmentDate} ${this.appointmentTime}`;

    if (this.isEditing && this.currentAppointmentId) {
      this.dataService.updateAppointment(this.currentAppointmentId, {
        dateTime: fullDateTime,
        modality: this.modality,
        locationOrLink: this.locationOrLink,
        notes: this.notes,
        advisorName: this.advisorName
      });
    } else {
      this.dataService.addAppointment({
        requestId: this.selectedRequestId || 'SOL-001',
        clientName: this.clientName,
        advisorName: this.advisorName || 'Asesor Asignado',
        dateTime: fullDateTime,
        modality: this.modality,
        locationOrLink: this.locationOrLink,
        notes: this.notes
      });
    }

    this.confirmService.alert({
      title: 'Cita Guardada',
      message: this.isEditing ? 'Cita de asesoría actualizada exitosamente.' : 'Nueva cita de asesoría agendada exitosamente.',
      type: 'success',
      confirmText: 'Aceptar'
    });

    this.closeFormModal();
  }

  updateStatus(appointment: Appointment, status: AppointmentStatus) {
    this.dataService.updateAppointmentStatus(appointment.id, status);
  }

  async deleteAppointment(appointment: Appointment) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Cita de Asesoría?',
      message: '¿Estás seguro de que deseas eliminar esta cita del calendario?',
      itemName: `Cita #${appointment.id} - ${appointment.clientName}`,
      confirmText: 'Eliminar Cita',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteAppointment(appointment.id, (err) => {
        if (err) {
          const msg = err?.error?.mensaje || err?.error?.error || 'Error al eliminar la cita de asesoría.';
          this.confirmService.alert({
            title: 'No se puede eliminar la cita',
            message: msg,
            itemName: `Cita #${appointment.id} - ${appointment.clientName}`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }

  openAttendModal(appointment: Appointment) {
    this.selectedAppointment = appointment;
    this.attendNotes = appointment.attentionNotes || '';
    this.attendOutcome = appointment.advisoryOutcome || '';
    this.isAttendModalOpen = true;
  }

  closeAttendModal() {
    this.isAttendModalOpen = false;
    this.selectedAppointment = null;
  }

  saveAttendModal() {
    if (!this.selectedAppointment || !this.attendNotes.trim()) {
      this.confirmService.alert('Por favor ingresa las observaciones de la atención realizada.', 'Observaciones Requeridas', 'warning');
      return;
    }
    this.dataService.logAppointmentAttention(this.selectedAppointment.id, this.attendNotes, this.attendOutcome);
    this.confirmService.alert({
      title: 'Atención Registrada',
      message: 'La atención de la cita ha sido registrada y guardada exitosamente.',
      type: 'success',
      confirmText: 'Aceptar'
    });
    this.closeAttendModal();
  }
}
