export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'finnova-config',
    title: 'Finnova: Configuración',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'users',
        title: 'Usuarios',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/users',
        icon: 'team'
      },
      {
        id: 'services',
        title: 'Servicios',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/services',
        icon: 'appstore'
      },
      {
        id: 'providers',
        title: 'Proveedores / Aliados',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/providers',
        icon: 'bank'
      }
    ]
  },
  {
    id: 'finnova-management',
    title: 'Finnova: Gestión',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'collections',
        title: 'Validación de Cobranzas',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/collections',
        icon: 'dollar'
      },
      {
        id: 'clients',
        title: 'Clientes',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/clients',
        icon: 'user'
      },
      {
        id: 'requests',
        title: 'Solicitudes',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/requests',
        icon: 'file-text'
      },
      {
        id: 'appointments',
        title: 'Citas',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/appointments',
        icon: 'calendar'
      },
      {
        id: 'campaigns',
        title: 'Campañas Marketing',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/campaigns',
        icon: 'notification'
      }
    ]
  },
  {
    id: 'finnova-analysis',
    title: 'Finnova: Análisis',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'reports',
        title: 'Reportes y Analítica',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/reports',
        icon: 'bar-chart'
      }
    ]
  },
  // {
  //   id: 'public-access',
  //   title: 'Vistas Públicas',
  //   type: 'group',
  //   icon: 'icon-navigation',
  //   children: [
  //     {
  //       id: 'landing',
  //       title: 'Portal Landing',
  //       type: 'item',
  //       url: '/landing',
  //       classes: 'nav-item',
  //       icon: 'home'
  //     },
  //     {
  //       id: 'request-form',
  //       title: 'Formulario de Solicitud',
  //       type: 'item',
  //       url: '/request-form',
  //       classes: 'nav-item',
  //       icon: 'file-add'
  //     }
  //   ]
  // }
];
