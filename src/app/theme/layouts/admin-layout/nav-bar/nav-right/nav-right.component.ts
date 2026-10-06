// angular import
import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { FinnovaDataService } from 'src/app/services/finnova-data.service';
import { AuthService } from 'src/app/services/auth.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule, RouterModule, CommonModule, FormsModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent {
  public dataService = inject(FinnovaDataService);
  public authService = inject(AuthService);
  private confirmService = inject(ConfirmDialogService);
  private router = inject(Router);

  // Modal Cambiar Contraseña
  isChangePasswordModalOpen = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrentPass = false;
  showNewPass = false;
  showConfirmPass = false;
  isSubmitting = false;

  openChangePasswordModal() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.showCurrentPass = false;
    this.showNewPass = false;
    this.showConfirmPass = false;
    this.isChangePasswordModalOpen = true;
  }

  closeChangePasswordModal() {
    this.isChangePasswordModalOpen = false;
  }

  submitChangePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.confirmService.alert('Por favor completa todos los campos de contraseña.', 'Campos Requeridos', 'warning');
      return;
    }

    if (this.newPassword.length < 6) {
      this.confirmService.alert('La nueva contraseña debe tener al menos 6 caracteres.', 'Contraseña muy corta', 'warning');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.confirmService.alert('La nueva contraseña y su confirmación no coinciden.', 'Contraseñas no coinciden', 'warning');
      return;
    }

    this.isSubmitting = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.closeChangePasswordModal();
        this.confirmService.alert({
          title: 'Contraseña Actualizada',
          message: 'Tu contraseña ha sido modificada con éxito. Por favor consérvala de manera segura.',
          type: 'success',
          confirmText: 'Entendido'
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        const errMsg = err?.error?.mensaje || err?.error?.error || 'Error al actualizar la contraseña. Verifica que tu contraseña actual sea correcta.';
        this.confirmService.alert(errMsg, 'Error al Cambiar Contraseña', 'danger');
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
