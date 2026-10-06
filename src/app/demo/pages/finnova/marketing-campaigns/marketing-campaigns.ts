import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, MarketingCampaign } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-marketing-campaigns',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './marketing-campaigns.html',
  styleUrl: './marketing-campaigns.scss'
})
export class MarketingCampaignsComponent implements OnInit {
  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Modals state
  isFormModalOpen = false;
  isPreviewModalOpen = false;
  isEditing = false;
  currentCampaignId: number | null = null;

  // Selected Campaign for Preview
  selectedCampaign: MarketingCampaign | null = null;

  // Form Fields
  title = '';
  message = '';
  imageUrl = 'assets/images/afp.jpg';
  targetServiceId: number | null = null;
  targetProveedorId: number | null = null;
  status: 'Activa' | 'Inactiva' = 'Activa';

  // Available image presets
  imagePresets = [
    { label: 'Asesoría AFP / Jubilación', url: 'assets/images/afp.jpg' },
    { label: 'Asesoría ONP / Pensiones', url: 'assets/images/onp.jpg' },
    { label: 'Aseguradoras y Vida', url: 'assets/images/aseguradoras.jpg' },
    { label: 'Asesoramiento Empresarial', url: 'assets/images/asesoramiento-empresarial.jpg' }
  ];

  ngOnInit(): void {
    this.dataService.loadCampaigns();
    this.dataService.loadServices();
    this.dataService.loadProveedores();
  }

  get servicesList() {
    return this.dataService.getServices();
  }

  get proveedoresList() {
    return this.dataService.getProveedores();
  }

  openNewCampaignModal() {
    this.isEditing = false;
    this.currentCampaignId = null;
    this.title = '';
    this.message = '';
    this.imageUrl = 'assets/images/afp.jpg';
    this.targetServiceId = null;
    this.targetProveedorId = null;
    this.status = 'Activa';
    this.isFormModalOpen = true;
  }

  openEditModal(campaign: MarketingCampaign) {
    this.isEditing = true;
    this.currentCampaignId = campaign.id;
    this.title = campaign.title;
    this.message = campaign.message;
    this.imageUrl = campaign.imageUrl || 'assets/images/afp.jpg';
    this.targetServiceId = campaign.targetServiceId || null;
    this.targetProveedorId = campaign.targetProveedorId || null;
    this.status = campaign.status;
    this.isFormModalOpen = true;
  }

  closeFormModal() {
    this.isFormModalOpen = false;
  }

  openPreviewModal(campaign: MarketingCampaign) {
    this.selectedCampaign = campaign;
    this.isPreviewModalOpen = true;
  }

  closePreviewModal() {
    this.isPreviewModalOpen = false;
    this.selectedCampaign = null;
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.confirmService.alert('Por favor seleccione un archivo de imagen válido (PNG, JPG, WEBP).', 'Formato Inválido', 'warning');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.confirmService.alert('La imagen no debe superar los 5MB.', 'Tamaño Excedido', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  saveCampaign() {
    if (!this.title.trim() || !this.message.trim()) {
      this.confirmService.alert('Ingresa el título y mensaje de la campaña promocional.', 'Campos Requeridos', 'warning');
      return;
    }

    const selectedService = this.targetServiceId ? this.servicesList.find(s => s.id === Number(this.targetServiceId)) : null;
    const selectedProveedor = this.targetProveedorId ? this.proveedoresList.find(p => p.id === Number(this.targetProveedorId)) : null;

    if (this.isEditing && this.currentCampaignId) {
      this.dataService.updateCampaign(this.currentCampaignId, {
        title: this.title,
        message: this.message,
        imageUrl: this.imageUrl,
        targetServiceId: this.targetServiceId ? Number(this.targetServiceId) : null,
        targetServiceName: selectedService ? selectedService.title : 'Todos los Servicios',
        targetProveedorId: this.targetProveedorId ? Number(this.targetProveedorId) : null,
        targetProveedorName: selectedProveedor ? selectedProveedor.nombreEmpresa : 'Todos los Proveedores',
        status: this.status
      });
    } else {
      this.dataService.addCampaign({
        title: this.title,
        message: this.message,
        imageUrl: this.imageUrl,
        targetServiceId: this.targetServiceId ? Number(this.targetServiceId) : null,
        targetServiceName: selectedService ? selectedService.title : 'Todos los Servicios',
        targetProveedorId: this.targetProveedorId ? Number(this.targetProveedorId) : null,
        targetProveedorName: selectedProveedor ? selectedProveedor.nombreEmpresa : 'Todos los Proveedores',
        status: this.status
      });
    }

    this.confirmService.alert({
      title: 'Campaña Guardada',
      message: this.isEditing ? 'Campaña promocional actualizada exitosamente.' : 'Nueva campaña promocional creada exitosamente.',
      type: 'success',
      confirmText: 'Aceptar'
    });

    this.closeFormModal();
  }

  toggleStatus(campaign: MarketingCampaign) {
    this.dataService.toggleCampaignStatus(campaign.id);
  }

  async deleteCampaign(campaign: MarketingCampaign) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Campaña Promocional?',
      message: '¿Estás seguro de que deseas eliminar permanentemente esta campaña de difusión?',
      itemName: `${campaign.title} (ID #${campaign.id})`,
      confirmText: 'Eliminar Campaña',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteCampaign(campaign.id, (err) => {
        if (err) {
          const msg = err?.error?.mensaje || err?.error?.error || 'Error al eliminar campaña promocional.';
          this.confirmService.alert({
            title: 'No se puede eliminar la campaña',
            message: msg,
            itemName: `${campaign.title} (ID #${campaign.id})`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }
}
