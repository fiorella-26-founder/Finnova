import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Verificar si la ruta requiere roles específicos
  const expectedRoles = route.data?.['roles'] as string[] | undefined;
  if (expectedRoles && expectedRoles.length > 0) {
    const userRole = authService.getUserRole();
    if (!expectedRoles.includes(userRole)) {
      console.warn(`Acceso denegado: El rol '${userRole}' no tiene permiso para acceder a esta ruta.`);
      if (userRole === 'Cliente') {
        router.navigate(['/dashboard/appointments']);
      } else {
        router.navigate(['/dashboard/default']);
      }
      return false;
    }
  }

  return true;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const userRole = authService.getUserRole();
    if (userRole === 'Cliente') {
      router.navigate(['/dashboard/appointments']);
    } else {
      router.navigate(['/dashboard/default']);
    }
    return false;
  }

  return true;
};
