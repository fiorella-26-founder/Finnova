import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, from, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserRole } from './finnova-data.service';
import { encryptPassword } from '../utils/crypto.util';

export interface AuthUser {
  id_usuario: number;
  dni: string;
  nombre_completo: string;
  correo_electronico: string;
  telefono?: string;
  rol: UserRole;
  id_rol: number;
  estado?: string;
}

export interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: AuthUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:3000/api';

  private tokenKey = 'finnova_token';
  private userKey = 'finnova_user';

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getStoredUser());
  public currentUser$: Observable<AuthUser | null> = this.currentUserSubject.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  public token$: Observable<string | null> = this.tokenSubject.asObservable();

  // Iniciar sesión con email y contraseña cifrada con AES-256
  login(correo_electronico: string, contrasena: string): Observable<LoginResponse> {
    return from(encryptPassword(contrasena)).pipe(
      switchMap((contrasenaEncriptada) => {
        return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, {
          correo_electronico,
          contrasena: contrasenaEncriptada
        });
      }),
      tap((res) => {
        if (res && res.token && res.usuario) {
          this.setSession(res.token, res.usuario);
        }
      })
    );
  }

  // Retorna la primera opción de menú habilitada para cada rol
  getDefaultRouteForRole(role?: string): string {
    const userRole = role || this.getUserRole();
    if (userRole === 'Administrador') {
      return '/dashboard/users';
    } else if (userRole === 'Asesor') {
      return '/dashboard/clients';
    } else if (userRole === 'Cliente') {
      return '/dashboard/requests';
    }
    return '/login';
  }

  // Cambiar contraseña de usuario autenticado con cifrado AES-256
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return from(Promise.all([encryptPassword(currentPassword), encryptPassword(newPassword)])).pipe(
      switchMap(([actualEnc, nuevaEnc]) => {
        return this.http.patch(`${this.baseUrl}/auth/cambiar-password`, {
          contrasena_actual: actualEnc,
          nueva_contrasena: nuevaEnc
        });
      })
    );
  }

  // Guardar token y datos del usuario en localStorage
  private setSession(token: string, user: AuthUser): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
  }

  // Cerrar sesión y limpiar credenciales y parámetros de ruta
  logout(): void {
    try {
      this.http.post(`${this.baseUrl}/auth/logout`, {}).subscribe({
        next: () => {},
        error: () => {}
      });
    } catch {
      // Ignorar errores de red en logout
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.clear();
    sessionStorage.clear();
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    window.location.href = '/login';
  }

  // Verificar si hay una sesión activa y token no expirado
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          this.logout();
          return false;
        }
      }
      return true;
    } catch {
      return !!token;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  getUserRole(): UserRole {
    const user = this.getUser();
    return (user?.rol as UserRole) || 'Administrador';
  }

  hasRole(roles: string[]): boolean {
    const currentRole = this.getUserRole();
    return roles.includes(currentRole);
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getStoredUser(): AuthUser | null {
    const stored = localStorage.getItem(this.userKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}
