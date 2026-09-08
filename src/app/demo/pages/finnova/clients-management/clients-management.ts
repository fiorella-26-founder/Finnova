import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { IconDirective, IconService } from '@ant-design/icons-angular';
import { EyeOutline, EditOutline, UserAddOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-clients-management',
  imports: [CommonModule, CardComponent, IconDirective],
  templateUrl: './clients-management.html',
  styleUrl: './clients-management.scss'
})
export class ClientsManagement {
  constructor(private iconService: IconService) {
    this.iconService.addIcon(...[EyeOutline, EditOutline, UserAddOutline]);
  }
}
