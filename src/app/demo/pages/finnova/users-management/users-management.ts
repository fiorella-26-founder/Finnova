import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FinnovaDataService, SystemUser, UserRole } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-users-management',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './users-management.html',
  styleUrl: './users-management.scss'
})
export class UsersManagement implements OnInit {
  ngOnInit(): void {
    this.dataService.loadUsers();
  }

  public dataService = inject(FinnovaDataService);
  private confirmService = inject(ConfirmDialogService);

  // Modal state
  isModalOpen = false;
  isEditing = false;
  isSaving = false;

  // Alerts
  feedbackMessage = '';
  feedbackType: 'success' | 'danger' = 'success';

  // Form fields
  currentUserId: number | null = null;
  userDni = '';
  userName = '';
  userEmail = '';
  userPhone = '';
  userPassword = '';
  userRole: UserRole = 'Asesor';
  userStatus: 'Activo' | 'Inactivo' = 'Activo';

  // Filter
  searchTerm = '';
  filterRole: string = 'Todos';

  openNewUserModal() {
    this.isEditing = false;
    this.currentUserId = null;
    this.userDni = '';
    this.userName = '';
    this.userEmail = '';
    this.userPhone = '';
    this.userPassword = 'password123';
    this.userRole = 'Asesor';
    this.userStatus = 'Activo';
    this.isModalOpen = true;
  }

  openEditUserModal(user: SystemUser) {
    this.isEditing = true;
    this.currentUserId = user.id;
    this.userDni = user.dni;
    this.userName = user.name;
    this.userEmail = user.email;
    this.userPhone = user.phone || '';
    this.userPassword = '';
    this.userRole = user.role;
    this.userStatus = user.status;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveUser() {
    if (!this.userName.trim() || !this.userEmail.trim() || !this.userDni.trim()) {
      this.showAlert('Por favor completa los campos obligatorios DNI, Nombre y Correo.', 'danger');
      return;
    }

    this.isSaving = true;

    if (this.isEditing && this.currentUserId) {
      this.dataService.updateUser(
        this.currentUserId,
        {
          dni: this.userDni.trim(),
          name: this.userName.trim(),
          email: this.userEmail.trim(),
          phone: this.userPhone.trim(),
          role: this.userRole,
          status: this.userStatus,
          contrasena: this.userPassword.trim() || undefined
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.showAlert(err?.error?.mensaje || err?.error?.error || 'Error al actualizar usuario en el servidor.', 'danger');
          } else {
            this.showAlert('Usuario actualizado exitosamente.', 'success');
            this.closeModal();
          }
        }
      );
    } else {
      this.dataService.addUser(
        {
          dni: this.userDni.trim(),
          name: this.userName.trim(),
          email: this.userEmail.trim(),
          phone: this.userPhone.trim(),
          role: this.userRole,
          status: this.userStatus,
          contrasena: this.userPassword.trim() || 'password123'
        },
        (err) => {
          this.isSaving = false;
          if (err) {
            this.showAlert(err?.error?.mensaje || err?.error?.error || 'Error al registrar usuario en el servidor.', 'danger');
          } else {
            this.showAlert('Nuevo usuario registrado exitosamente.', 'success');
            this.closeModal();
          }
        }
      );
    }
  }

  toggleStatus(user: SystemUser) {
    const nextStatus = user.status === 'Activo' ? 'Inactivo' : 'Activo';
    this.dataService.toggleUserStatus(user.id, (err) => {
      if (err) {
        this.showAlert('Error al cambiar el estado del usuario.', 'danger');
      } else {
        this.showAlert(`Estado de "${user.name}" cambiado a ${nextStatus}.`, 'success');
      }
    });
  }

  async deleteUser(user: SystemUser) {
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar Usuario del Sistema?',
      message: '¿Estás seguro de que deseas eliminar permanentemente a este usuario? Esta acción no se puede deshacer.',
      itemName: `${user.name} (${user.role} - ID #${user.id})`,
      confirmText: 'Eliminar Usuario',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      this.dataService.deleteUser(user.id, (err) => {
        if (err) {
          const msg = err?.error?.mensaje || err?.error?.error || 'No se puede eliminar el usuario porque tiene asesorías o clientes asociados.';
          this.confirmService.alert({
            title: 'No se puede eliminar el usuario',
            message: msg,
            itemName: `${user.name} (${user.role})`,
            type: 'warning',
            confirmText: 'Entendido'
          });
        }
      });
    }
  }

  showAlert(msg: string, type: 'success' | 'danger') {
    this.feedbackMessage = msg;
    this.feedbackType = type;
  }
}
