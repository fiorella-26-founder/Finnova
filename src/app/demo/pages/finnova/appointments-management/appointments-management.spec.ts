import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppointmentsManagement } from './appointments-management';

describe('AppointmentsManagement', () => {
  let component: AppointmentsManagement;
  let fixture: ComponentFixture<AppointmentsManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentsManagement]
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentsManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
