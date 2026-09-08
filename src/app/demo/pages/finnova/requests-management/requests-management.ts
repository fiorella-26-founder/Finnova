import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { IconDirective, IconService } from '@ant-design/icons-angular';
import { EyeOutline, EditOutline, CheckOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-requests-management',
  imports: [CommonModule, CardComponent, IconDirective],
  templateUrl: './requests-management.html',
  styleUrl: './requests-management.scss'
})
export class RequestsManagement {
  constructor(private iconService: IconService) {
    this.iconService.addIcon(...[EyeOutline, EditOutline, CheckOutline]);
  }
}
