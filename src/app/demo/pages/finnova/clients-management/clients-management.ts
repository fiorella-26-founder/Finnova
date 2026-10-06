import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, Client, AdvisoryRequest, Appointment } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-clients-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './clients-management.html',
  styleUrl: './clients-management.scss'
})
export class ClientsManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  ngOnInit() {
    this.dataService.loadClients();
    this.dataService.loadRequests();
  }

  // Modals state
  isFormModalOpen = false;
  isDetailModalOpen = false;
  isEditing = false;
  isSaving = false;

  // Form Fields
  currentClientId: number | null = null;
  clientDni = '';
  clientName = '';
  clientEmail = '';
  clientPhone = '';
  clientAddress = '';
  clientStatus: 'Activo' | 'Inactivo' = 'Activo';

  // Selection
  selectedClient: Client | null = null;

  // Client Details Data
  clientRequests: AdvisoryRequest[] = [];
  clientAppointments: Appointment[] = [];

  openNewClientModal() {
    this.isEditing = false;
    this.currentClientId = null;
    this.clientDni = '';
    this.clientName = '';
    this.clientEmail = '';
    this.clientPhone = '';
    this.clientAddress = '';
    this.clientStatus = 'Activo';
    this.isFormModalOpen = true;
  }

  openEditClientModal(client: Client) {
    this.isEditing = true;
    this.currentClientId = client.id;
    this.clientDni = client.dni;
    this.clientName = client.name;
    this.clientEmail = client.email;
    this.clientPhone = client.phone;
    this.clientAddress = client.address || '';
    this.clientStatus = client.status;
    this.isFormModalOpen = true;
  }

  openDetailModal(client: Client) {
    this.selectedClient = client;
    this.clientRequests = this.dataService.getRequests().filter(r => r.clientDni === client.dni);
    this.clientAppointments = this.dataService.getAppointments().filter(a => a.clientName === client.name);
    this.isDetailModalOpen = true;
  }

  closeFormModal() {
    this.isFormModalOpen = false;
  }

  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedClient = null;
  }

  saveClient() {
    if (!this.clientDni.trim() || !this.clientName.trim() || !this.clientEmail.trim()) {
      this.confirmService.alert('Por favor ingresa DNI, Nombre completo y Correo.', 'Campos Requeridos', 'warning');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.currentClientId) {
      this.dataService.updateClient(
        this.currentClientId,
        {
          dni: this.clientDni.trim(),
          name: this.clientName.trim(),
          email: this.clientEmail.trim(),
          phone: this.clientPhone.trim(),
          address: this.clientAddress.trim(),
          status: this.clientStatus
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al actualizar datos del cliente en el servidor.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Cliente Actualizado',
              message: 'Datos del cliente actualizados exitosamente.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeFormModal();
          }
        }
      );
    } else {
      this.dataService.addClient(
        {
          dni: this.clientDni.trim(),
          name: this.clientName.trim(),
          email: this.clientEmail.trim(),
          phone: this.clientPhone.trim(),
          address: this.clientAddress.trim(),
          status: this.clientStatus
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al registrar nuevo cliente en el servidor.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Cliente Registrado',
              message: 'Cliente y usuario de acceso creados exitosamente en el sistema.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeFormModal();
          }
        }
      );
    }
  }

  toggleStatus(client: Client) {
    const nextStatus = client.status === 'Activo' ? 'Inactivo' : 'Activo';
    this.dataService.toggleClientStatus(client.id, (err) => {
      if (err) {
        this.confirmService.alert('Error al cambiar estado del cliente.', 'Error', 'danger');
      } else {
        this.confirmService.alert({
          title: 'Estado Actualizado',
          message: `Estado de "${client.name}" cambiado a ${nextStatus}.`,
          type: 'info',
          confirmText: 'Aceptar'
        });
      }
    });
  }

  async deleteClient(client: Client) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Registro de Cliente?',
      message: '¿Estás seguro de que deseas eliminar a este cliente del sistema?',
      itemName: `${client.name} (DNI: ${client.dni})`,
      confirmText: 'Eliminar Cliente',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteClient(client.id, (err) => {
        if (err) {
          const msg = err.error?.mensaje || err.error?.error || 'No se puede eliminar el cliente porque está sujeto a solicitudes o citas existentes.';
          this.confirmService.alert({
            title: 'No se puede eliminar el cliente',
            message: msg,
            itemName: `${client.name} (DNI: ${client.dni})`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }
}
