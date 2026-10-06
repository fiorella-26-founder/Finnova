import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, Proveedor } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-proveedores-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './proveedores-management.html',
  styleUrl: './proveedores-management.scss'
})
export class ProveedoresManagement implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  isModalOpen = false;
  isEditing = false;
  isSaving = false;
  currentProveedorId: number | null = null;

  nombreEmpresa = '';
  tipoAlianza = 'Aseguradora';
  contacto = '';
  comisionPct = 15;
  status: 'Activo' | 'Inactivo' = 'Activo';

  tiposAlianzaOptions = ['Aseguradora', 'Fondos de Pensiones', 'Entidad Financiera', 'Entidad Estatal', 'Corporativo'];

  ngOnInit() {
    this.dataService.loadProveedores();
  }

  openNewModal() {
    this.isEditing = false;
    this.currentProveedorId = null;
    this.nombreEmpresa = '';
    this.tipoAlianza = 'Aseguradora';
    this.contacto = '';
    this.comisionPct = 15;
    this.status = 'Activo';
    this.isModalOpen = true;
  }

  openEditModal(proveedor: Proveedor) {
    this.isEditing = true;
    this.currentProveedorId = proveedor.id;
    this.nombreEmpresa = proveedor.nombreEmpresa;
    this.tipoAlianza = proveedor.tipoAlianza;
    this.contacto = proveedor.contacto;
    this.comisionPct = proveedor.comisionPct || 15;
    this.status = proveedor.status;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveProveedor() {
    if (!this.nombreEmpresa.trim() || !this.contacto.trim()) {
      this.confirmService.alert('Por favor ingresa el nombre de la empresa y los datos de contacto.', 'Campos Requeridos', 'warning');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.currentProveedorId) {
      this.dataService.updateProveedor(
        this.currentProveedorId,
        {
          nombreEmpresa: this.nombreEmpresa.trim(),
          tipoAlianza: this.tipoAlianza.trim(),
          contacto: this.contacto.trim(),
          comisionPct: Number(this.comisionPct),
          status: this.status
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al actualizar proveedor en el servidor.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Proveedor Actualizado',
              message: 'Proveedor / Aliado actualizado exitosamente.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeModal();
          }
        }
      );
    } else {
      this.dataService.addProveedor(
        {
          nombreEmpresa: this.nombreEmpresa.trim(),
          tipoAlianza: this.tipoAlianza.trim(),
          contacto: this.contacto.trim(),
          comisionPct: Number(this.comisionPct),
          status: this.status
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.confirmService.alert('Error al registrar proveedor en el servidor.', 'Error', 'danger');
          } else {
            this.confirmService.alert({
              title: 'Proveedor Registrado',
              message: 'Nuevo Proveedor / Aliado registrado exitosamente.',
              type: 'success',
              confirmText: 'Aceptar'
            });
            this.closeModal();
          }
        }
      );
    }
  }

  toggleStatus(proveedor: Proveedor) {
    const nextStatus = proveedor.status === 'Activo' ? 'Inactivo' : 'Activo';
    this.dataService.toggleProveedorStatus(proveedor.id, (err) => {
      if (err) {
        this.confirmService.alert('Error al cambiar estado del proveedor.', 'Error', 'danger');
      } else {
        this.confirmService.alert({
          title: 'Estado Actualizado',
          message: `Estado de "${proveedor.nombreEmpresa}" cambiado a ${nextStatus}.`,
          type: 'info',
          confirmText: 'Aceptar'
        });
      }
    });
  }

  async deleteProveedor(proveedor: Proveedor) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Aliado / Proveedor?',
      message: '¿Estás seguro de que deseas eliminar este proveedor?',
      itemName: `${proveedor.nombreEmpresa} (${proveedor.tipoAlianza})`,
      confirmText: 'Eliminar Proveedor',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteProveedor(proveedor.id, (err) => {
        if (err) {
          const msg = err.error?.mensaje || err.error?.error || 'No se puede eliminar el proveedor porque tiene servicios financieros asociados.';
          this.confirmService.alert({
            title: 'No se puede eliminar el proveedor',
            message: msg,
            itemName: `${proveedor.nombreEmpresa} (${proveedor.tipoAlianza})`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }
}
