// Angular import
import { Component, OnInit, inject, output } from '@angular/core';
import { CommonModule, Location, LocationStrategy } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

// project import
import { NavigationItem, NavigationItems } from '../navigation';
import { environment } from 'src/environments/environment';
import { NavGroupComponent } from './nav-group/nav-group.component';

// icon
import { IconService } from '@ant-design/icons-angular';
import {
  DashboardOutline,
  CreditCardOutline,
  LoginOutline,
  QuestionOutline,
  ChromeOutline,
  FontSizeOutline,
  ProfileOutline,
  BgColorsOutline,
  AntDesignOutline
} from '@ant-design/icons-angular/icons';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FinnovaDataService, UserRole } from 'src/app/services/finnova-data.service';

const AdminNavigationItems: NavigationItem[] = NavigationItems;

const AsesorNavigationItems: NavigationItem[] = [
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
  }
];

const ClienteNavigationItems: NavigationItem[] = [
  {
    id: 'finnova-management',
    title: 'Finnova: Gestión',
    type: 'group',
    icon: 'icon-navigation',
    children: [
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
  }
];

@Component({
  selector: 'app-nav-content',
  imports: [CommonModule, RouterModule, NavGroupComponent, NgScrollbarModule],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent implements OnInit {
  private location = inject(Location);
  private locationStrategy = inject(LocationStrategy);
  private iconService = inject(IconService);
  private router = inject(Router);
  public dataService = inject(FinnovaDataService);

  switchRole(role: UserRole) {
    this.dataService.setRole(role);
    if (role === 'Cliente') {
      this.router.navigate(['/dashboard/requests']);
    }
  }

  // public props
  NavCollapsedMob = output();

  navigations: NavigationItem[];
  title = 'Demo application for version numbering';
  currentApplicationVersion = environment.appVersion;
  navigation = NavigationItems;
  windowWidth = window.innerWidth;

  constructor() {
    this.iconService.addIcon(
      ...[
        DashboardOutline,
        CreditCardOutline,
        FontSizeOutline,
        LoginOutline,
        ProfileOutline,
        BgColorsOutline,
        AntDesignOutline,
        ChromeOutline,
        QuestionOutline
      ]
    );
    this.navigations = NavigationItems;
  }

  get filteredNavigations(): NavigationItem[] {
    const role = this.dataService.activeRole;
    if (role === 'Cliente') {
      return ClienteNavigationItems;
    }
    if (role === 'Asesor') {
      return AsesorNavigationItems;
    }
    return AdminNavigationItems;
  }

  ngOnInit() {
    if (this.windowWidth < 1025) {
      (document.querySelector('.coded-navbar') as HTMLDivElement)?.classList.add('menupos-static');
    }
  }

  fireOutClick() {
    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[ href='" + current_url + "' ]";
    const ele = document.querySelector(link);
    if (ele !== null && ele !== undefined) {
      const parent = ele.parentElement;
      const up_parent = parent?.parentElement?.parentElement;
      const last_parent = up_parent?.parentElement;
      if (parent?.classList.contains('coded-hasmenu')) {
        parent.classList.add('coded-trigger');
        parent.classList.add('active');
      } else if (up_parent?.classList.contains('coded-hasmenu')) {
        up_parent.classList.add('coded-trigger');
        up_parent.classList.add('active');
      } else if (last_parent?.classList.contains('coded-hasmenu')) {
        last_parent.classList.add('coded-trigger');
        last_parent.classList.add('active');
      }
    }
  }

  navMob() {
    if (this.windowWidth < 1025 && document.querySelector('app-navigation.coded-navbar')?.classList.contains('mob-open')) {
      this.NavCollapsedMob.emit();
    }
  }
}
