import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-users-management',
  imports: [CommonModule, CardComponent],
  templateUrl: './users-management.html',
  styleUrl: './users-management.scss'
})
export class UsersManagement {}
