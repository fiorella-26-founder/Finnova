import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, FinancialService } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-services-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './services-management.html',
  styleUrl: './services-management.scss'
})
export class ServicesManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Modal State
  isModalOpen = false;
  isDetailModalOpen = false;
  isEditing = false;
  isSaving = false;

  // Form Fields
  currentServiceId: number | null = null;
  serviceTitle = '';
  serviceDescription = '';
  servicePrecio = 50.00;
  serviceProveedorId: number | null = null;
  serviceImageUrl = '';
  serviceCategory = 'Pensiones';
  serviceStatus: 'Activo' | 'Inactivo' = 'Activo';

  // Detail View Field
  selectedService: FinancialService | null = null;

  // Presets rápidos
  presetImages = [
    { label: 'AFP Pensiones', url: 'assets/images/afp.jpg' },
    { label: 'ONP Jubilación', url: 'assets/images/onp.jpg' },
    { label: 'Seguros y Salud', url: 'assets/images/aseguradoras.jpg' },
    { label: 'Asesoría Empresarial', url: 'assets/images/asesoramiento-empresarial.jpg' }
  ];

  ngOnInit() {
    this.dataService.loadServices();
    this.dataService.loadProveedores();
  }

  get proveedoresList() {
    return this.dataService.getProveedores().filter(p => p.status === 'Activo');
  }

  openNewServiceModal() {
    this.isEditing = false;
    this.currentServiceId = null;
    this.serviceTitle = '';
    this.serviceDescription = '';
    this.servicePrecio = 50.00;
    const provs = this.proveedoresList;
    this.serviceProveedorId = provs.length ? provs[0].id : null;
    this.serviceImageUrl = this.presetImages[0].url;
    this.serviceCategory = 'Pensiones';
    this.serviceStatus = 'Activo';
    this.isModalOpen = true;
  }

  openEditServiceModal(service: FinancialService) {
    this.isEditing = true;
    this.currentServiceId = service.id;
    this.serviceTitle = service.title;
    this.serviceDescription = service.description;
    this.servicePrecio = service.precio || 50.00;
    this.serviceProveedorId = service.idProveedor || null;
    this.serviceImageUrl = service.imageUrl;
    this.serviceCategory = service.category;
    this.serviceStatus = service.status;
    this.isModalOpen = true;
  }

  openDetailModal(service: FinancialService) {
    this.selectedService = service;
    this.isDetailModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedService = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Validar tamaño máximo 5MB para evitar saturar base64
      if (file.size > 5 * 1024 * 1024) {
        this.confirmService.alert('La imagen seleccionada supera el tamaño máximo permitido (5MB).', 'Tamaño Excedido', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.serviceImageUrl = reader.result as string; // Contiene Data URI en Base64
      };
      reader.readAsDataURL(file);
    }
  }

  selectPresetImage(url: string) {
    this.serviceImageUrl = url;
  }

  saveService() {
    if (!this.serviceTitle.trim() || !this.serviceDescription.trim()) {
      this.confirmService.alert('Por favor completa el título y la descripción del servicio.', 'Campos Requeridos', 'warning');
      return;
    }

    if (!this.serviceImageUrl) {
      this.confirmService.alert('Por favor selecciona o sube una imagen para el servicio.', 'Imagen Requerida', 'warning');
      return;
    }

    this.isSaving = true;
    const provId = this.serviceProveedorId ? Number(this.serviceProveedorId) : undefined;

    if (this.isEditing && this.currentServiceId) {
      this.dataService.updateService(
        this.currentServiceId,
        {
          title: this.serviceTitle.trim(),
          description: this.serviceDescription.trim(),
          precio: Number(this.servicePrecio),
          idProveedor: provId,
          imageUrl: this.serviceImageUrl,
          category: this.serviceCategory,
          status: this.serviceStatus
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al actualizar el servicio en la base de datos.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Servicio Actualizado',
              message: 'Servicio financiero actualizado exitosamente.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeModal();
          }
        }
      );
    } else {
      this.dataService.addService(
        {
          title: this.serviceTitle.trim(),
          description: this.serviceDescription.trim(),
          precio: Number(this.servicePrecio),
          idProveedor: provId,
          imageUrl: this.serviceImageUrl,
          category: this.serviceCategory,
          status: this.serviceStatus
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al registrar el servicio en la base de datos.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Servicio Registrado',
              message: 'Nuevo servicio financiero registrado exitosamente.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeModal();
          }
        }
      );
    }
  }

  toggleStatus(service: FinancialService) {
    const nextStatus = service.status === 'Activo' ? 'Inactivo' : 'Activo';
    this.dataService.toggleServiceStatus(service.id, (err) => {
      if (err) {
        this.confirmService.alert('Error al cambiar el estado del servicio.', 'Error', 'danger');
      } else {
        this.confirmService.alert({
          title: 'Estado Actualizado',
          message: `Servicio "${service.title}" cambiado a ${nextStatus}.`,
          type: 'info',
          confirmText: 'Aceptar'
        });
      }
    });
  }

  async deleteService(service: FinancialService) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Servicio Financiero?',
      message: '¿Estás seguro de que deseas eliminar este servicio financiero?',
      itemName: `${service.title} (ID #${service.id})`,
      confirmText: 'Eliminar Definitivamente',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteService(service.id, (err) => {
        if (err) {
          const msg = err.error?.mensaje || err.error?.error || 'Este servicio está sujeto a una solicitud o a un cliente y no se puede eliminar para no romper la base de datos.';
          this.confirmService.alert({
            title: 'No se puede eliminar el servicio',
            message: msg,
            itemName: `${service.title} (ID #${service.id})`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }
}
