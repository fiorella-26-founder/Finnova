import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { FinnovaDataService, UserRole } from 'src/app/services/finnova-data.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.scss'
})
export class AuthLoginComponent implements OnInit {
  private authService = inject(AuthService);
  private dataService = inject(FinnovaDataService);
  private router = inject(Router);
  private confirmService = inject(ConfirmDialogService);

  email = 'admin@finnova.pe';
  password = 'admin123';
  selectedRole: UserRole = 'Administrador';
  
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    // Purgar al 100% cualquier sesión previa para garantizar un inicio de sesión limpio
    this.authService.clearSession();
    this.selectRole('Administrador');
  }

  selectRole(role: UserRole) {
    this.selectedRole = role;
    this.errorMessage = '';
    if (role === 'Administrador') {
      this.email = 'admin@finnova.pe';
      this.password = 'admin123';
    } else if (role === 'Asesor') {
      this.email = 'juan.asesor@finnova.pe';
      this.password = 'password123';
    } else {
      this.email = 'fiorellatecsup26@gmail.com';
      this.password = '';
    }
  }

  onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa tu correo y contraseña.';
      this.confirmService.alert(this.errorMessage, 'Campos Incompletos', 'warning');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const cleanEmail = this.email.trim().toLowerCase();
    const cleanPassword = this.password.trim();

    this.authService.login(cleanEmail, cleanPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.usuario) {
          const userRole = res.usuario.rol;
          this.dataService.setRole(userRole);
          
          const targetRoute = this.authService.getDefaultRouteForRole(userRole);
          this.router.navigateByUrl(targetRoute);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al iniciar sesión:', err);

        // Control C5: Captura de Rate Limiting y mensajes devueltos por el backend
        if (err.status === 429) {
          this.errorMessage = err?.error?.mensaje || err?.error?.error || 'Has alcanzado el límite de intentos permitidos (Rate Limiting). Por seguridad, espera 15 minutos.';
        } else if (err.status === 403) {
          this.errorMessage = err?.error?.mensaje || err?.error?.error || 'Acceso restringido: Cuenta bloqueada temporalmente por intentos fallidos.';
        } else if (err.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor Backend en Render. Si estaba en reposo (cold start), puede tardar unos segundos en responder. Por favor, reintenta en un momento.';
        } else {
          this.errorMessage = err?.error?.mensaje || err?.error?.error || 'Credenciales inválidas o error de autenticación.';
        }

        this.confirmService.alert({
          title: 'Error de Autenticación',
          message: this.errorMessage,
          type: 'danger',
          confirmText: 'Aceptar'
        });
      }
    });
  }
}
