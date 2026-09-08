import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-appointments-management',
  imports: [CommonModule, CardComponent],
  templateUrl: './appointments-management.html',
  styleUrl: './appointments-management.scss'
})
export class AppointmentsManagement {}
