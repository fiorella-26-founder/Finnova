// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminLayout } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      {
        path: '',
        redirectTo: '/dashboard/default',
        pathMatch: 'full'
      },
      {
        path: 'dashboard/default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'typography',
        loadComponent: () => import('./demo/component/basic-component/typography/typography.component').then((c) => c.TypographyComponent)
      },
      {
        path: 'color',
        loadComponent: () => import('./demo/component/basic-component/color/color.component').then((c) => c.ColorComponent)
      },
      {
        path: 'sample-page',
        loadComponent: () => import('./demo/others/sample-page/sample-page.component').then((c) => c.SamplePageComponent)
      },
      {
        path: 'dashboard/users',
        loadComponent: () => import('./demo/pages/finnova/users-management/users-management').then((c) => c.UsersManagement)
      },
      {
        path: 'dashboard/services',
        loadComponent: () => import('./demo/pages/finnova/services-management/services-management').then((c) => c.ServicesManagement)
      },
      {
        path: 'dashboard/clients',
        loadComponent: () => import('./demo/pages/finnova/clients-management/clients-management').then((c) => c.ClientsManagement)
      },
      {
        path: 'dashboard/requests',
        loadComponent: () => import('./demo/pages/finnova/requests-management/requests-management').then((c) => c.RequestsManagement)
      },
      {
        path: 'dashboard/appointments',
        loadComponent: () => import('./demo/pages/finnova/appointments-management/appointments-management').then((c) => c.AppointmentsManagement)
      },
      {
        path: 'dashboard/reports',
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
        path: 'register',
        loadComponent: () =>
          import('./demo/pages/authentication/auth-register/auth-register.component').then((c) => c.AuthRegisterComponent)
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
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
