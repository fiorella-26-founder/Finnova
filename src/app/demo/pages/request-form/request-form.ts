import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinnovaDataService, FinancialService } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-request-form',
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './request-form.html',
  styleUrl: './request-form.scss'
})
export class RequestFormComponent implements OnInit {
  public dataService = inject(FinnovaDataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirmService = inject(ConfirmDialogService);

  clientDni = '';
  clientName = '';
  clientEmail = '';
  clientPhone = '';
  selectedServiceId: number = 0;
  message = '';
  isSubmitting = false;

  // Payment Fields (Yape / Plin)
  numeroOperacionYape = '';
  urlVoucherImagen = '';

  // Preset Vouchers for easy testing
  presetVouchers = [
    { label: 'Voucher Yape 1', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60' },
    { label: 'Voucher Plin 2', url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=60' }
  ];

  isSuccessModalOpen = false;
  createdRequestId = '';

  ngOnInit() {
    this.dataService.loadPublicServices();

    this.route.queryParams.subscribe(params => {
      if (params['serviceId']) {
        this.selectedServiceId = Number(params['serviceId']);
      } else if (params['service']) {
        const services = this.dataService.getServices();
        const found = services.find(s => s.title.toLowerCase().includes(params['service'].toLowerCase()));
        if (found) {
          this.selectedServiceId = found.id;
        }
      }
    });

    // Auto-select first active service if current selectedServiceId is not found
    this.dataService.services$.subscribe(services => {
      const active = (services || []).filter(s => s.status === 'Activo');
      if (active.length > 0) {
        if (!this.selectedServiceId || !active.some(s => s.id === Number(this.selectedServiceId))) {
          this.selectedServiceId = active[0].id;
        }
      }
    });
  }

  get servicesList(): FinancialService[] {
    return this.dataService.getServices().filter(s => s.status === 'Activo');
  }

  get selectedServiceObj(): FinancialService | undefined {
    return this.servicesList.find(s => s.id === Number(this.selectedServiceId));
  }

  get selectedProveedorObj() {
    const service = this.selectedServiceObj;
    if (!service) return undefined;
    return this.dataService.getProveedores().find(p => p.id === service.idProveedor);
  }

  onVoucherSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.urlVoucherImagen = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  selectPresetVoucher(url: string) {
    this.urlVoucherImagen = url;
  }

  submitRequest() {
    if (!this.clientDni.trim() || !this.clientName.trim() || !this.clientEmail.trim()) {
      this.confirmService.alert('Por favor ingresa tu DNI, Nombre completo y Correo.', 'Campos Requeridos', 'warning');
      return;
    }

    const service = this.selectedServiceObj;
    if (!service) {
      this.confirmService.alert('Por favor selecciona un servicio financiero válido.', 'Servicio Requerido', 'warning');
      return;
    }

    if (!this.numeroOperacionYape.trim()) {
      this.confirmService.alert('Por favor ingresa el Número de Operación de tu transferencia por Yape / Plin.', 'Número de Operación', 'warning');
      return;
    }

    if (!this.urlVoucherImagen) {
      this.confirmService.alert('Por favor adjunta la captura o foto de tu comprobante (voucher).', 'Comprobante Requerido', 'warning');
      return;
    }

    this.isSubmitting = true;

    this.dataService.addRequest(
      {
        clientDni: this.clientDni.trim(),
        clientName: this.clientName.trim(),
        clientEmail: this.clientEmail.trim(),
        clientPhone: this.clientPhone.trim(),
        serviceId: Number(service.id),
        serviceTitle: service.title,
        servicePrecio: service.precio,
        montoPagado: service.precio,
        idProveedor: service.idProveedor,
        proveedorNombre: service.proveedorNombre,
        numeroOperacionYape: this.numeroOperacionYape.trim(),
        urlVoucherImagen: this.urlVoucherImagen,
        estadoPago: 'Pendiente',
        notes: this.message.trim()
      },
      (err, createdId) => {
        this.isSubmitting = false;
        if (err) {
          console.error('Error al registrar solicitud en backend:', err);
          const errorMsg = err?.error?.error || err?.error?.mensaje || 'No se pudo guardar la solicitud en el servidor. Por favor verifica tus datos e inténtalo nuevamente.';
          this.confirmService.alert(errorMsg, 'Error al Registrar', 'danger');
          return;
        }

        this.createdRequestId = createdId || 'SOL-001';
        this.isSuccessModalOpen = true;
      }
    );
  }

  closeSuccessModal() {
    this.isSuccessModalOpen = false;
    this.router.navigate(['/landing']);
  }
}
