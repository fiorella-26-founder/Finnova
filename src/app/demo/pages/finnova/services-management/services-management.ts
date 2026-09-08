import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-services-management',
  imports: [CommonModule, CardComponent],
  templateUrl: './services-management.html',
  styleUrl: './services-management.scss'
})
export class ServicesManagement {}
