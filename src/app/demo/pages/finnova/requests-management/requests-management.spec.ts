import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestsManagement } from './requests-management';

describe('RequestsManagement', () => {
  let component: RequestsManagement;
  let fixture: ComponentFixture<RequestsManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestsManagement]
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
