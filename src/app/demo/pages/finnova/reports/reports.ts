import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, CardComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports {}
