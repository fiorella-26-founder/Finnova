import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-test-view',
  imports: [CommonModule, CardComponent],
  templateUrl: './test-view.html'
})
export class TestViewComponent {}
