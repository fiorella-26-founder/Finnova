import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Project import
import { SharedModule } from '../../shared/shared.module';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { FinnovaDataService, MarketingCampaign } from 'src/app/services/finnova-data.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, SharedModule, NavigationComponent, NavBarComponent, RouterModule, BreadcrumbComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayout implements OnInit {
  private layoutState = inject(LayoutStateService);
  public dataService = inject(FinnovaDataService);

  dismissedCampaignIds = new Set<number>();

  // public props
  navCollapsed = false;
  windowWidth: number;

  // Constructor
  constructor() {
    this.windowWidth = window.innerWidth;
  }

  ngOnInit(): void {
    // Cada pantalla del dashboard carga sus propios datos bajo demanda en su ngOnInit
  }

  get navCollapsedMob(): boolean {
    return this.layoutState.navCollapsedMob();
  }

  get activeClientCampaign(): MarketingCampaign | null {
    if (this.dataService.activeRole !== 'Cliente') {
      return null;
    }
    const campaigns = this.dataService.getActiveCampaignsForClient('72345678');
    const available = campaigns.filter(c => !this.dismissedCampaignIds.has(c.id));
    return available.length > 0 ? available[0] : null;
  }

  dismissCampaign(campaignId: number) {
    this.dismissedCampaignIds.add(campaignId);
  }

  // public method
  navMobClick() {
    this.layoutState.toggleNavCollapsedMob();
    if (document.querySelector('app-navigation.pc-sidebar')?.classList.contains('navbar-collapsed')) {
      document.querySelector('app-navigation.pc-sidebar')?.classList.remove('navbar-collapsed');
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.layoutState.closeNavCollapsedMob();
  }

  handleNavCollapse() {
    this.navCollapsed = !this.navCollapsed;
  }
}

