import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientsManagement } from './clients-management';

describe('ClientsManagement', () => {
  let component: ClientsManagement;
  let fixture: ComponentFixture<ClientsManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsManagement]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
