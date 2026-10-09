import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, AdvisoryRequest, RequestStatus } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-requests-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './requests-management.html',
  styleUrl: './requests-management.scss'
})
export class RequestsManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Modals visibility state
  isNewRequestModalOpen = false;
  isAssignModalOpen = false;
  isCreateClientModalOpen = false;
  isStatusModalOpen = false;
  isAdvisoryModalOpen = false;
  isCloseModalOpen = false;
  isDetailModalOpen = false;
  isSaving = false;

  // Selected Item
  selectedRequest: AdvisoryRequest | null = null;
  pendingAssignRequest: AdvisoryRequest | null = null;

  // Form Fields - New Request (F006)
  newClientDni = '';
  newClientName = '';
  newClientEmail = '';
  newClientPhone = '';
  newServiceId: number = 1;
  newNotes = '';

  // Form Fields - Assign Advisor (F007)
  selectedAdvisorId: number | null = null;

  // Form Fields - Create Client from Request (Pre-Assign)
  clientModalDni = '';
  clientModalName = '';
  clientModalEmail = '';
  clientModalPhone = '';
  clientModalAddress = '';
  clientModalAdvisorId: number | null = null;

  // Form Fields - Update Status (F008)
  updatedStatus: RequestStatus = 'En Proceso';

  // Form Fields - Log Advisory (RF011)
  advisoryNotes = '';
  advisoryOutcome = '';

  // Form Fields - Close Request (F012)
  closureNotes = '';
  closureStatus: RequestStatus = 'Finalizada';

  ngOnInit() {
    this.dataService.loadRequests();
    this.dataService.loadServices();
    const role = this.dataService.activeRole;
    if (role === 'Administrador') {
      this.dataService.loadUsers();
      this.dataService.loadProveedores();
      this.dataService.loadClients();
    } else if (role === 'Asesor') {
      this.dataService.loadClients();
    }
  }

  get advisorsList() {
    return this.dataService.getUsers().filter(u => u.role === 'Asesor' && u.status === 'Activo');
  }

  get activeServices() {
    return this.dataService.getServices().filter(s => s.status === 'Activo');
  }

  openNewRequestModal() {
    this.newClientDni = '';
    this.newClientName = '';
    this.newClientEmail = '';
    this.newClientPhone = '';
    const services = this.activeServices;
    this.newServiceId = services.length ? services[0].id : 1;
    this.newNotes = '';
    this.isNewRequestModalOpen = true;
  }

  openAssignModal(request: AdvisoryRequest) {
    // 1. Validar que el pago ya haya sido validado por Cobranzas
    if (request.estadoPago !== 'Pagado') {
      this.confirmService.alert({
        title: 'Asignación no permitida',
        message: `No se puede asignar un asesor a la solicitud ${request.id} porque el pago aún no ha sido corroborado por el área de Cobranzas (Estado actual: "${request.estadoPago}"). Por favor, diríjase al módulo "Validación de Cobranzas" para validar el comprobante de pago.`,
        itemName: `Solicitud #${request.id} - ${request.clientName}`,
        type: 'warning',
        confirmText: 'Entendido'
      });
      return;
    }

    // 2. Verificar si el cliente ya existe en el sistema por DNI
    const clientDni = request.clientDni?.trim();
    const allClients = this.dataService.getAllClients();
    const existingClient = allClients.find(c => c.dni && c.dni.trim() === clientDni);

    if (!existingClient) {
      // Si NO existe, abrir modal para registrar al cliente y asignar de inmediato
      this.pendingAssignRequest = request;
      this.clientModalDni = request.clientDni || '';
      this.clientModalName = request.clientName || '';
      this.clientModalEmail = request.clientEmail || '';
      this.clientModalPhone = request.clientPhone || '';
      this.clientModalAddress = '';
      this.clientModalAdvisorId = this.advisorsList.length ? this.advisorsList[0].id : null;
      this.isCreateClientModalOpen = true;
      return;
    }

    // Si YA existe en BD, abrir modal estándar de asignación de asesor
    this.selectedRequest = request;
    this.selectedAdvisorId = request.assignedAdvisorId || existingClient.assignedAdvisorId || (this.advisorsList.length ? this.advisorsList[0].id : null);
    this.isAssignModalOpen = true;
  }

  saveCreateClientAndAssign() {
    if (!this.pendingAssignRequest) return;

    if (!this.clientModalDni.trim() || !this.clientModalName.trim() || !this.clientModalEmail.trim()) {
      this.confirmService.alert('Por favor complete los datos obligatorios: DNI, Nombre Completo y Correo Electrónico.', 'Campos Requeridos', 'warning');
      return;
    }

    if (!this.clientModalAdvisorId) {
      this.confirmService.alert('Por favor seleccione el Asesor que atenderá la solicitud.', 'Asesor Requerido', 'warning');
      return;
    }

    const advisor = this.advisorsList.find(a => a.id === Number(this.clientModalAdvisorId));
    if (!advisor) {
      this.confirmService.alert('Seleccione un asesor válido.', 'Asesor no válido', 'warning');
      return;
    }

    this.isSaving = true;
    const req = this.pendingAssignRequest;

    // 1. Crear el cliente
    this.dataService.addClient(
      {
        dni: this.clientModalDni.trim(),
        name: this.clientModalName.trim(),
        email: this.clientModalEmail.trim(),
        phone: this.clientModalPhone.trim(),
        address: this.clientModalAddress.trim() || undefined,
        status: 'Activo',
        assignedAdvisorId: advisor.id,
        assignedAdvisorName: advisor.name
      },
      (errClient) => {
        if (errClient) {
          this.isSaving = false;
          this.confirmService.alert('Error al registrar el cliente en la base de datos. Verifique si el DNI ya está registrado.', 'Error al Crear Cliente', 'danger');
          return;
        }

        // 2. Asignar el asesor a la solicitud
        this.dataService.assignAdvisorToRequest(
          req.id,
          advisor.id,
          advisor.name,
          (errAssign) => {
            this.isSaving = false;
            if (errAssign) {
              this.confirmService.alert(`Cliente registrado con éxito, pero ocurrió un problema al asignar el asesor a la solicitud: ${errAssign.message || 'Error'}`, 'Aviso de Asignación', 'warning');
            } else {
              this.confirmService.alert({
                title: 'Asignación Exitosa',
                message: `¡Cliente "${this.clientModalName}" registrado en el sistema y Asesor "${advisor.name}" asignado exitosamente!`,
                itemName: `Solicitud #${req.id}`,
                type: 'success',
                confirmText: 'Aceptar'
              });
              this.closeAllModals();
            }
          }
        );
      }
    );
  }

  openStatusModal(request: AdvisoryRequest) {
    this.selectedRequest = request;
    this.updatedStatus = request.status;
    this.isStatusModalOpen = true;
  }

  openAdvisoryModal(request: AdvisoryRequest) {
    this.selectedRequest = request;
    this.advisoryNotes = request.advisoryNotes || '';
    this.advisoryOutcome = request.advisoryOutcome || '';
    this.isAdvisoryModalOpen = true;
  }

  openCloseModal(request: AdvisoryRequest) {
    this.selectedRequest = request;
    this.closureNotes = request.closureNotes || '';
    this.closureStatus = request.status === 'Nula / Abandonada' ? 'Nula / Abandonada' : 'Finalizada';
    this.isCloseModalOpen = true;
  }

  openDetailModal(request: AdvisoryRequest) {
    this.selectedRequest = request;
    this.isDetailModalOpen = true;
  }

  getAppointmentsForRequest(requestId: string) {
    return this.dataService.getAppointments().filter(a => a.requestId === requestId);
  }

  closeAllModals() {
    this.isNewRequestModalOpen = false;
    this.isAssignModalOpen = false;
    this.isCreateClientModalOpen = false;
    this.isStatusModalOpen = false;
    this.isAdvisoryModalOpen = false;
    this.isCloseModalOpen = false;
    this.isDetailModalOpen = false;
    this.selectedRequest = null;
    this.pendingAssignRequest = null;
    this.isSaving = false;
  }

  saveNewRequest() {
    if (!this.newClientDni.trim() || !this.newClientName.trim() || !this.newClientEmail.trim()) {
      this.confirmService.alert('Por favor ingresa los datos del cliente (DNI, Nombre y Correo).', 'Campos Requeridos', 'warning');
      return;
    }

    const service = this.activeServices.find(s => s.id === Number(this.newServiceId));
    if (!service) {
      this.confirmService.alert('Selecciona un servicio financiero válido.', 'Servicio Requerido', 'warning');
      return;
    }

    this.isSaving = true;

    this.dataService.addRequest(
      {
        clientDni: this.newClientDni.trim(),
        clientName: this.newClientName.trim(),
        clientEmail: this.newClientEmail.trim(),
        clientPhone: this.newClientPhone.trim(),
        serviceId: service.id,
        serviceTitle: service.title,
        servicePrecio: service.precio,
        idProveedor: service.idProveedor,
        proveedorNombre: service.proveedorNombre,
        notes: this.newNotes.trim()
      },
      (err) => {
        this.isSaving = false;
        if (err) {
          this.confirmService.alert('Error al registrar la solicitud en el servidor.', 'Error de Registro', 'danger');
        } else {
          this.confirmService.alert({
            title: 'Solicitud Registrada',
            message: 'Solicitud de asesoría registrada exitosamente en el sistema.',
            type: 'success',
            confirmText: 'Aceptar'
          });
          this.closeAllModals();
        }
      }
    );
  }

  saveAssignment() {
    if (!this.selectedRequest || !this.selectedAdvisorId) {
      this.confirmService.alert('Por favor selecciona un asesor.', 'Asesor Requerido', 'warning');
      return;
    }

    const advisor = this.advisorsList.find(a => a.id === Number(this.selectedAdvisorId));
    if (advisor) {
      this.isSaving = true;
      this.dataService.assignAdvisorToRequest(
        this.selectedRequest.id,
        advisor.id,
        advisor.name,
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al asignar asesor en el servidor.', 'Error de Asignación', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Asesor Asignado',
              message: `Asesor "${advisor.name}" asignado correctamente a la solicitud.`,
              itemName: `Solicitud #${this.selectedRequest?.id}`,
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeAllModals();
          }
        }
      );
    }
  }

  saveStatus() {
    if (!this.selectedRequest) return;
    this.isSaving = true;
    this.dataService.updateRequestStatus(
      this.selectedRequest.id,
      this.updatedStatus,
      (err) => {
        this.isSaving = false;
        if (err) {
          this.confirmService.alert('Error al actualizar el estado en el servidor.', 'Error', 'danger');
        } else {
          this.confirmService.alert({
            title: 'Estado Actualizado',
            message: `Estado de la solicitud actualizado a "${this.updatedStatus}".`,
            itemName: `Solicitud #${this.selectedRequest?.id}`,
            type: 'success',
            confirmText: 'Aceptar'
          });
          this.closeAllModals();
        }
      }
    );
  }

  saveAdvisorySession() {
    if (!this.selectedRequest || !this.advisoryNotes.trim() || !this.advisoryOutcome.trim()) {
      this.confirmService.alert('Por favor ingresa las observaciones y el resultado de la asesoría.', 'Campos Requeridos', 'warning');
      return;
    }

    this.isSaving = true;
    this.dataService.logAdvisorySession(
      this.selectedRequest.id,
      this.advisoryNotes.trim(),
      this.advisoryOutcome.trim(),
      (err) => {
        this.isSaving = false;
        if (err) {
          this.confirmService.alert('Error al guardar la sesión de asesoría en el servidor.', 'Error', 'danger');
        } else {
          this.confirmService.alert({
            title: 'Sesión Guardada',
            message: 'Sesión de asesoría registrada y guardada exitosamente.',
            itemName: `Solicitud #${this.selectedRequest?.id}`,
            type: 'success',
            confirmText: 'Aceptar'
          });
          this.closeAllModals();
        }
      }
    );
  }

  saveClosure() {
    if (!this.selectedRequest || !this.closureNotes.trim()) {
      this.confirmService.alert('Por favor ingresa las observaciones de cierre de solicitud.', 'Campos Requeridos', 'warning');
      return;
    }

    this.isSaving = true;
    this.dataService.closeRequest(
      this.selectedRequest.id,
      this.closureNotes.trim(),
      this.closureStatus,
      (err) => {
        this.isSaving = false;
        if (err) {
          this.confirmService.alert('Error al cerrar la solicitud en el servidor.', 'Error', 'danger');
        } else {
          this.confirmService.alert({
            title: 'Solicitud Cerrada',
            message: `La solicitud ha sido cerrada formalmente como "${this.closureStatus}".`,
            itemName: `Solicitud #${this.selectedRequest?.id}`,
            type: 'success',
            confirmText: 'Aceptar'
          });
          this.closeAllModals();
        }
      }
    );
  }
}
