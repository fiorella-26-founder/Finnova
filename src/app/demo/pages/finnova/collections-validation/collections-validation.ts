import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, AdvisoryRequest, PaymentStatus } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-collections-validation',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './collections-validation.html',
  styleUrl: './collections-validation.scss'
})
export class CollectionsValidation implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);
  private cdr = inject(ChangeDetectorRef);

  activeFilter: PaymentStatus | 'Todos' = 'Pendiente';

  // Modal Voucher Preview
  isVoucherModalOpen = false;
  selectedRequest: AdvisoryRequest | null = null;
  isValidating = false;

  ngOnInit() {
    this.dataService.loadRequests(() => this.cdr.markForCheck());
    this.dataService.loadClients();
    this.dataService.loadServices();
  }

  get allRequests(): AdvisoryRequest[] {
    return this.dataService.getAllRequests();
  }

  get filteredRequests(): AdvisoryRequest[] {
    if (this.activeFilter === 'Todos') {
      return this.allRequests;
    }
    return this.allRequests.filter(r => r.estadoPago === this.activeFilter);
  }

  // Summary Metrics
  get totalRecaudado(): number {
    return this.allRequests
      .filter(r => r.estadoPago === 'Pagado')
      .reduce((sum, r) => sum + (r.montoPagado || r.servicePrecio || 0), 0);
  }

  get countPendientes(): number {
    return this.allRequests.filter(r => r.estadoPago === 'Pendiente').length;
  }

  get countPagados(): number {
    return this.allRequests.filter(r => r.estadoPago === 'Pagado').length;
  }

  get countRechazados(): number {
    return this.allRequests.filter(r => r.estadoPago === 'Rechazado').length;
  }

  setFilter(filter: PaymentStatus | 'Todos') {
    this.activeFilter = filter;
  }

  openVoucherModal(request: AdvisoryRequest) {
    this.selectedRequest = request;
    this.isVoucherModalOpen = true;
  }

  closeVoucherModal() {
    this.isVoucherModalOpen = false;
    this.selectedRequest = null;
  }

  async validatePayment(request: AdvisoryRequest) {
    const monto = (request.montoPagado || request.servicePrecio || 0).toFixed(2);
    const confirmed = await this.confirmService.confirm({
      title: 'Validar Pago',
      message: `¿Confirmas la validación formal del pago registrado por ${request.clientName}? Se habilitará la asignación de asesor.`,
      confirmText: 'Validar Pago',
      cancelText: 'Cancelar',
      type: 'success',
      itemName: `S/ ${monto} (Op. Yape: ${request.numeroOperacionYape || 'N/A'})`
    });

    if (confirmed) {
      this.isValidating = true;
      this.dataService.validatePayment(
        request.id,
        {
          monto_pagado: request.montoPagado || request.servicePrecio || 0,
          numero_operacion_yape: request.numeroOperacionYape || undefined
        },
        (err) => {
          this.isValidating = false;
          this.cdr.markForCheck();
          if (err) {
            this.confirmService.alert('Error al validar el pago en el servidor.', 'Error de Validación', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Pago Validado',
              message: `El pago de la solicitud ${request.id} ha sido validado formalmente. Ahora se encuentra habilitada para la asignación de asesor.`,
              itemName: `${request.clientName} (S/ ${monto})`,
              type: 'success',
              confirmText: 'Aceptar'
            });
            if (this.isVoucherModalOpen) {
              this.closeVoucherModal();
            }
          }
        }
      );
    }
  }

  async rejectPayment(request: AdvisoryRequest) {
    const confirmed = await this.confirmService.confirm({
      title: 'Rechazar Comprobante',
      message: `¿Estás seguro de que deseas rechazar el comprobante de pago de la solicitud?`,
      confirmText: 'Rechazar Pago',
      cancelText: 'Cancelar',
      type: 'danger',
      itemName: `Solicitud #${request.id}`
    });

    if (confirmed) {
      this.isValidating = true;
      this.dataService.rejectPayment(request.id, (err) => {
        this.isValidating = false;
        this.cdr.markForCheck();
        if (err) {
          this.confirmService.alert('Error al rechazar el pago en el servidor.', 'Error', 'danger');
        } else {
          this.confirmService.alert({
            title: 'Comprobante Rechazado',
            message: `El comprobante de la solicitud ${request.id} fue marcado como Rechazado.`,
            type: 'warning',
            confirmText: 'Aceptar'
          });
          if (this.isVoucherModalOpen) {
            this.closeVoucherModal();
          }
        }
      });
    }
  }
}
