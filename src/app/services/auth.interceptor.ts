import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Lista y reglas de endpoints públicos que NO deben adjuntar token de autorización
  const isPublicRoute =
    req.url.includes('/servicios/publicos') ||
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/health') ||
    (req.url.includes('/solicitudes') && req.method === 'POST'); // Formulario público de registro de solicitudes

  let authReq = req;
  if (token && !isPublicRoute) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo forzar logout si el usuario estaba previamente autenticado y el token expiró/falló en endpoint protegido
      if (error.status === 401 && !isPublicRoute && !req.url.includes('/auth/login')) {
        if (authService.isAuthenticated()) {
          console.warn('Sesión expirada o no autorizada (401). Redirigiendo a login...');
          authService.logout();
        }
      }
      return throwError(() => error);
    })
  );
};
