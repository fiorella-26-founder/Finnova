import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FinnovaDataService, FinancialService } from 'src/app/services/finnova-data.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class LandingComponent implements OnInit, OnDestroy {
  public dataService = inject(FinnovaDataService);
  private cdr = inject(ChangeDetectorRef);

  public services: FinancialService[] = [];
  public isLoading = true;
  public selectedServiceForDetail: FinancialService | null = null;
  public isDetailModalOpen = false;
  public defaultImage = 'assets/images/afp.jpg';

  private subscription = new Subscription();

  ngOnInit(): void {
    // Escuchar el flujo reactivo de servicios
    this.subscription.add(
      this.dataService.services$.subscribe((list) => {
        if (list && list.length > 0) {
          this.services = list.filter(s => s.status === 'Activo');
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      })
    );

    this.refreshServices();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  refreshServices(): void {
    this.isLoading = true;
    // Únicamente se solicita el catálogo público de servicios desde BD
    this.dataService.loadPublicServices(() => {
      this.services = (this.dataService.getServices() || []).filter(s => s.status === 'Activo');
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    // Timeout de seguridad en caso de red lenta
    setTimeout(() => {
      if (this.isLoading) {
        this.services = (this.dataService.getServices() || []).filter(s => s.status === 'Activo');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }, 400);
  }

  openDetailModal(service: FinancialService): void {
    this.selectedServiceForDetail = service;
    this.isDetailModalOpen = true;
  }

  closeDetailModal(): void {
    this.isDetailModalOpen = false;
    this.selectedServiceForDetail = null;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = this.defaultImage;
    }
  }
}

