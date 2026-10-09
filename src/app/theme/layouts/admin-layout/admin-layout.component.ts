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
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, SharedModule, NavigationComponent, NavBarComponent, RouterModule, BreadcrumbComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayout implements OnInit {
  private layoutState = inject(LayoutStateService);
  public dataService = inject(FinnovaDataService);
  private authService = inject(AuthService);

  dismissedCampaignIds = new Set<number>();

  // public props
  navCollapsed = false;
  windowWidth: number;

  activeClientCampaign: MarketingCampaign | null = null;

  // Constructor
  constructor() {
    this.windowWidth = window.innerWidth;
  }

  ngOnInit(): void {
    if (this.dataService.activeRole === 'Cliente') {
      this.dataService.loadCampaigns(() => {
        this.evaluateClientCampaign();
      });
      this.dataService.loadRequests(() => {
        this.evaluateClientCampaign();
      });
    }
  }

  evaluateClientCampaign(): void {
    if (this.dataService.activeRole !== 'Cliente') return;
    const user = this.authService.getUser();
    const campaigns = this.dataService.getActiveCampaignsForClient(user?.dni, user?.correo_electronico);
    const available = campaigns.filter(c => !this.dismissedCampaignIds.has(c.id));
    this.activeClientCampaign = available.length > 0 ? available[0] : null;
  }

  get navCollapsedMob(): boolean {
    return this.layoutState.navCollapsedMob();
  }

  dismissCampaign(campaignId: number) {
    this.dismissedCampaignIds.add(campaignId);
    this.activeClientCampaign = null;
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
