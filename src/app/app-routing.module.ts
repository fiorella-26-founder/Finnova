// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminLayout } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';
import { authGuard, guestGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/landing',
        pathMatch: 'full'
      },
      {
        path: 'dashboard/default',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor'] },
        loadComponent: () => import('./demo/pages/finnova/reports/reports').then((c) => c.Reports)
      },
      {
        path: 'dashboard/users',
        canActivate: [authGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./demo/pages/finnova/users-management/users-management').then((c) => c.UsersManagement)
      },
      {
        path: 'dashboard/services',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor'] },
        loadComponent: () => import('./demo/pages/finnova/services-management/services-management').then((c) => c.ServicesManagement)
      },
      {
        path: 'dashboard/providers',
        canActivate: [authGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./demo/pages/finnova/proveedores-management/proveedores-management').then((c) => c.ProveedoresManagement)
      },
      {
        path: 'dashboard/collections',
        canActivate: [authGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./demo/pages/finnova/collections-validation/collections-validation').then((c) => c.CollectionsValidation)
      },
      {
        path: 'dashboard/clients',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor'] },
        loadComponent: () => import('./demo/pages/finnova/clients-management/clients-management').then((c) => c.ClientsManagement)
      },
      {
        path: 'dashboard/requests',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor', 'Cliente'] },
        loadComponent: () => import('./demo/pages/finnova/requests-management/requests-management').then((c) => c.RequestsManagement)
      },
      {
        path: 'dashboard/appointments',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor', 'Cliente'] },
        loadComponent: () => import('./demo/pages/finnova/appointments-management/appointments-management').then((c) => c.AppointmentsManagement)
      },
      {
        path: 'dashboard/campaigns',
        canActivate: [authGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./demo/pages/finnova/marketing-campaigns/marketing-campaigns').then((c) => c.MarketingCampaignsComponent)
      },
      {
        path: 'dashboard/reports',
        canActivate: [authGuard],
        data: { roles: ['Administrador', 'Asesor'] },
        loadComponent: () => import('./demo/pages/finnova/reports/reports').then((c) => c.Reports)
      }
    ]
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () => import('./demo/pages/authentication/auth-login/auth-login.component').then((c) => c.AuthLoginComponent)
      },
      {
        path: 'landing',
        loadComponent: () => import('./demo/pages/landing/landing').then((c) => c.LandingComponent)
      },
      {
        path: 'request-form',
        loadComponent: () => import('./demo/pages/request-form/request-form').then((c) => c.RequestFormComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/landing'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
