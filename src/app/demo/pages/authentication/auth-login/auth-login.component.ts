import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);
  private confirmService = inject(ConfirmDialogService);

  email = 'admin@finnova.pe';
  password = 'admin123';
  selectedRole: UserRole = 'Administrador';
  
  isLoading = false;
  errorMessage = '';
  returnUrl = '';

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
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
      this.email = 'maria@ejemplo.com';
      this.password = 'password123';
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

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.usuario) {
          this.dataService.setRole(res.usuario.rol);
          
          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
          } else if (res.usuario.rol === 'Cliente') {
            this.router.navigate(['/dashboard/appointments']);
          } else {
            this.router.navigate(['/dashboard/default']);
          }
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
          this.errorMessage = 'No se pudo contactar al servidor Backend en http://localhost:3000. Asegúrate de que el backend esté corriendo con npm run dev.';
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
