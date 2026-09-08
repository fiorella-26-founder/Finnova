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
    id: 'dashboard',
    title: 'Dashboard',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'default',
        title: 'Default',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'dashboard',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'authentication',
    title: 'Authentication',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'login',
        title: 'Login',
        type: 'item',
        classes: 'nav-item',
        url: '/login',
        icon: 'login',
        target: true,
        breadcrumbs: false
      },
      {
        id: 'register',
        title: 'Register',
        type: 'item',
        classes: 'nav-item',
        url: '/register',
        icon: 'profile',
        target: true,
        breadcrumbs: false
      }
    ]
  },
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
        title: 'Reportes',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/reports',
        icon: 'bar-chart'
      }
    ]
  },
  {
    id: 'utilities',
    title: 'UI Components',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'typography',
        title: 'Typography',
        type: 'item',
        classes: 'nav-item',
        url: '/typography',
        icon: 'font-size'
      },
      {
        id: 'color',
        title: 'Colors',
        type: 'item',
        classes: 'nav-item',
        url: '/color',
        icon: 'bg-colors'
      },
      {
        id: 'ant-icons',
        title: 'Ant Icons',
        type: 'item',
        classes: 'nav-item',
        url: 'https://ant.design/components/icon',
        icon: 'ant-design',
        target: true,
        external: true
      }
    ]
  },

  {
    id: 'other',
    title: 'Other',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'sample-page',
        title: 'Sample Page',
        type: 'item',
        url: '/sample-page',
        classes: 'nav-item',
        icon: 'chrome'
      },
      {
        id: 'landing',
        title: 'Landing Finnova',
        type: 'item',
        url: '/landing',
        classes: 'nav-item',
        icon: 'home',
        target: true
      },
      {
        id: 'document',
        title: 'Document',
        type: 'item',
        classes: 'nav-item',
        url: 'https://codedthemes.gitbook.io/mantis-angular/',
        icon: 'question',
        target: true,
        external: true
      }
    ]
  }
];
