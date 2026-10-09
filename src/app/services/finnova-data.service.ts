import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export type UserRole = 'Administrador' | 'Asesor' | 'Cliente';

export interface SystemUser {
  id: number;
  dni: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'Activo' | 'Inactivo';
  createdAt: string;
}

export interface Proveedor {
  id: number;
  nombreEmpresa: string;
  tipoAlianza: string;
  contacto: string;
  comisionPct: number; // Porcentaje de comisión que el Aliado le otorga a Finnova (Brokerage)
  status: 'Activo' | 'Inactivo';
}

export interface FinancialService {
  id: number;
  title: string;
  description: string;
  precio: number;
  idProveedor?: number;
  proveedorNombre?: string;
  imageUrl: string;
  category: string;
  status: 'Activo' | 'Inactivo';
}

export interface Client {
  id: number;
  dni: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  status: 'Activo' | 'Inactivo';
  assignedAdvisorId?: number;
  assignedAdvisorName?: string;
}

export type RequestStatus = 'Nueva' | 'Pendiente' | 'En Proceso' | 'Atendida' | 'Finalizada' | 'Nula / Abandonada' | 'Pendiente de Validación de Pago' | 'Pago Rechazado';
export type PaymentStatus = 'Pendiente' | 'Pagado' | 'Rechazado';

export interface AdvisoryRequest {
  id: string;
  clientDni: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceId: number;
  serviceTitle: string;
  servicePrecio?: number;
  montoPagado?: number;
  idProveedor?: number;
  proveedorNombre?: string;
  comisionAliadoPct?: number;
  montoComisionBroker?: number;
  numeroOperacionYape?: string;
  urlVoucherImagen?: string;
  estadoPago: PaymentStatus;
  date: string;
  assignedAdvisorId?: number;
  assignedAdvisorName?: string;
  status: RequestStatus;
  estadoAtencion?: string;
  notes?: string;
  advisoryNotes?: string;
  advisoryOutcome?: string;
  closureNotes?: string;
}

export type AppointmentStatus = 'Programada' | 'Realizada' | 'Cancelada';

export interface Appointment {
  id: string;
  requestId: string;
  clientId?: number;
  clientName: string;
  advisorId?: number;
  advisorName: string;
  dateTime: string;
  modality: 'Virtual' | 'Presencial';
  locationOrLink: string;
  status: AppointmentStatus;
  notes?: string;
  attentionNotes?: string;
  advisoryOutcome?: string;
}

export interface MarketingCampaign {
  id: number;
  title: string;
  message: string;
  imageUrl?: string;
  targetServiceId?: number | null;
  targetServiceName?: string;
  targetProveedorId?: number | null;
  targetProveedorName?: string;
  status: 'Activa' | 'Inactiva';
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FinnovaDataService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  private activeRoleSubject = new BehaviorSubject<UserRole>(this.authService.getUserRole());
  public activeRole$: Observable<UserRole> = this.activeRoleSubject.asObservable();

  get activeRole(): UserRole {
    const user = this.authService.getUser();
    if (user?.rol) {
      return user.rol as UserRole;
    }
    return this.activeRoleSubject.value;
  }

  setRole(role: UserRole) {
    this.activeRoleSubject.next(role);
  }

  // 1. USUARIOS
  private usersSubject = new BehaviorSubject<SystemUser[]>([]);
  public users$: Observable<SystemUser[]> = this.usersSubject.asObservable();

  // 2. PROVEEDORES
  private proveedoresSubject = new BehaviorSubject<Proveedor[]>([]);
  public proveedores$: Observable<Proveedor[]> = this.proveedoresSubject.asObservable();

  // 3. SERVICIOS
  private servicesSubject = new BehaviorSubject<FinancialService[]>([]);
  public services$: Observable<FinancialService[]> = this.servicesSubject.asObservable();

  // 4. CLIENTES
  private clientsSubject = new BehaviorSubject<Client[]>([]);
  public clients$: Observable<Client[]> = combineLatest([
    this.clientsSubject.asObservable(),
    this.activeRole$,
    this.authService.currentUser$
  ]).pipe(
    map(([clients, role, currentUser]) => {
      if (role === 'Administrador') return clients;
      if (role === 'Asesor') {
        const userId = currentUser?.id_usuario;
        const userName = currentUser?.nombre_completo?.toLowerCase();
        return clients.filter(c => {
          if (userId && c.assignedAdvisorId === userId) return true;
          if (userName && c.assignedAdvisorName && c.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
          if (!userId && !userName && (c.assignedAdvisorId === 2 || c.assignedAdvisorName?.includes('Juan'))) return true;
          return false;
        });
      }
      if (role === 'Cliente') {
        const userDni = currentUser?.dni;
        const userEmail = currentUser?.correo_electronico?.toLowerCase();
        return clients.filter(c => {
          if (userDni && c.dni === userDni) return true;
          if (userEmail && c.email?.toLowerCase() === userEmail) return true;
          if (!userDni && !userEmail && (c.dni === '72345678' || c.name?.includes('María'))) return true;
          return false;
        });
      }
      return clients;
    })
  );

  // 5. SOLICITUDES
  private requestsSubject = new BehaviorSubject<AdvisoryRequest[]>([]);
  public requests$: Observable<AdvisoryRequest[]> = combineLatest([
    this.requestsSubject.asObservable(),
    this.activeRole$,
    this.authService.currentUser$
  ]).pipe(
    map(([requests, role, currentUser]) => {
      if (role === 'Administrador') return requests;
      if (role === 'Asesor') {
        const userId = currentUser?.id_usuario;
        const userName = currentUser?.nombre_completo?.toLowerCase();
        return requests.filter(r => {
          if (userId && r.assignedAdvisorId === userId) return true;
          if (userName && r.assignedAdvisorName && r.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
          if (!userId && !userName && (r.assignedAdvisorId === 2 || r.assignedAdvisorName?.includes('Juan'))) return true;
          return false;
        });
      }
      if (role === 'Cliente') {
        const userDni = currentUser?.dni;
        const userEmail = currentUser?.correo_electronico?.toLowerCase();
        const userName = currentUser?.nombre_completo?.toLowerCase();
        return requests.filter(r => {
          if (userDni && r.clientDni === userDni) return true;
          if (userEmail && r.clientEmail?.toLowerCase() === userEmail) return true;
          if (userName && r.clientName && r.clientName.toLowerCase().includes(userName.split(' ')[0])) return true;
          if (!userDni && !userEmail && !userName && (r.clientDni === '72345678' || r.clientName?.includes('María'))) return true;
          return false;
        });
      }
      return requests;
    })
  );

  // 6. CITAS
  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$: Observable<Appointment[]> = combineLatest([
    this.appointmentsSubject.asObservable(),
    this.activeRole$,
    this.authService.currentUser$
  ]).pipe(
    map(([appointments, role, currentUser]) => {
      if (role === 'Administrador') return appointments;
      if (role === 'Asesor') {
        const userId = currentUser?.id_usuario;
        const userName = currentUser?.nombre_completo?.toLowerCase();
        return appointments.filter(a => {
          if (userId && a.advisorId === userId) return true;
          if (userName && a.advisorName && a.advisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
          if (!userId && !userName && (a.advisorId === 2 || a.advisorName?.includes('Juan'))) return true;
          return false;
        });
      }
      if (role === 'Cliente') {
        const userName = currentUser?.nombre_completo?.toLowerCase();
        return appointments.filter(a => {
          if (userName && a.clientName && a.clientName.toLowerCase().includes(userName.split(' ')[0])) return true;
          if (!userName && (a.clientName?.includes('María') || a.clientName?.includes('Carlos'))) return true;
          return false;
        });
      }
      return appointments;
    })
  );

  // 7. CAMPAÑAS
  private campaignsSubject = new BehaviorSubject<MarketingCampaign[]>([]);
  public campaigns$: Observable<MarketingCampaign[]> = this.campaignsSubject.asObservable();

  constructor() {
    this.authService.currentUser$.subscribe(user => {
      if (user?.rol) {
        this.activeRoleSubject.next(user.rol as UserRole);
      }
    });
    this.loadAllData();
  }

  // Carga global inicial desde la base de datos
  loadAllData() {
    this.loadUsers();
    this.loadProveedores();
    this.loadServices();
    this.loadClients();
    this.loadRequests();
    this.loadAppointments();
    this.loadCampaigns();
  }

  // ==========================================
  // 1. GESTIÓN DE USUARIOS
  // ==========================================
  loadUsers(callback?: (err?: any) => void) {
    this.apiService.getUsers().subscribe({
      next: (users) => {
        if (users && users.length > 0) {
          this.usersSubject.next(users);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar usuarios desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getUsers(): SystemUser[] {
    return this.usersSubject.value;
  }

  addUser(user: Omit<SystemUser, 'id' | 'createdAt'> & { contrasena?: string }, callback?: (err?: any) => void) {
    this.apiService.createUser(user).subscribe({
      next: () => {
        this.loadUsers();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al registrar usuario en backend, aplicando fallback:', err);
        const current = this.usersSubject.value;
        const newId = current.length ? Math.max(...current.map(u => u.id)) + 1 : 1;
        const newUser: SystemUser = {
          ...user,
          id: newId,
          createdAt: new Date().toISOString().split('T')[0]
        };
        this.usersSubject.next([newUser, ...current]);
        if (callback) callback(err);
      }
    });
  }

  updateUser(id: number, updated: Partial<SystemUser> & { contrasena?: string }, callback?: (err?: any) => void) {
    this.apiService.updateUser(id, updated).subscribe({
      next: () => {
        this.loadUsers();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar usuario en backend, aplicando fallback:', err);
        const current = this.usersSubject.value;
        const index = current.findIndex(u => u.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updated };
          this.usersSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  toggleUserStatus(id: number, callback?: (err?: any) => void) {
    const current = this.usersSubject.value;
    const user = current.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === 'Activo' ? 'Inactivo' : 'Activo';

    this.apiService.toggleUserStatus(id, newStatus).subscribe({
      next: () => {
        this.loadUsers();
        if (callback) callback();
      },
      error: () => {
        const index = current.findIndex(u => u.id === id);
        if (index !== -1) {
          current[index].status = newStatus;
          this.usersSubject.next([...current]);
        }
        if (callback) callback();
      }
    });
  }

  deleteUser(id: number, callback?: (err?: any) => void) {
    this.apiService.deleteUser(id).subscribe({
      next: () => {
        this.loadUsers();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al eliminar usuario en backend, aplicando fallback:', err);
        const current = this.usersSubject.value;
        this.usersSubject.next(current.filter(u => u.id !== id));
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 2. GESTIÓN DE PROVEEDORES Y ALIADOS
  // ==========================================
  loadProveedores(callback?: (err?: any) => void) {
    this.apiService.getProveedores().subscribe({
      next: (provs) => {
        if (provs && provs.length > 0) {
          this.proveedoresSubject.next(provs);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar proveedores desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getProveedores(): Proveedor[] {
    return this.proveedoresSubject.value;
  }

  addProveedor(proveedor: Omit<Proveedor, 'id'>, callback?: (err?: any) => void) {
    this.apiService.createProveedor(proveedor).subscribe({
      next: () => {
        this.loadProveedores();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al crear proveedor en backend, aplicando fallback:', err);
        const current = this.proveedoresSubject.value;
        const newId = current.length ? Math.max(...current.map(p => p.id)) + 1 : 1;
        const newProv: Proveedor = { ...proveedor, id: newId };
        this.proveedoresSubject.next([...current, newProv]);
        if (callback) callback(err);
      }
    });
  }

  updateProveedor(id: number, updated: Partial<Proveedor>, callback?: (err?: any) => void) {
    this.apiService.updateProveedor(id, updated).subscribe({
      next: () => {
        this.loadProveedores();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar proveedor en backend, aplicando fallback:', err);
        const current = this.proveedoresSubject.value;
        const index = current.findIndex(p => p.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updated };
          this.proveedoresSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  toggleProveedorStatus(id: number, callback?: (err?: any) => void) {
    const current = this.proveedoresSubject.value;
    const prov = current.find(p => p.id === id);
    if (!prov) return;
    const newStatus = prov.status === 'Activo' ? 'Inactivo' : 'Activo';

    this.apiService.toggleProveedorStatus(id, newStatus).subscribe({
      next: () => {
        this.loadProveedores();
        if (callback) callback();
      },
      error: () => {
        const index = current.findIndex(p => p.id === id);
        if (index !== -1) {
          current[index].status = newStatus;
          this.proveedoresSubject.next([...current]);
        }
        if (callback) callback();
      }
    });
  }

  deleteProveedor(id: number, callback?: (err?: any) => void) {
    this.apiService.deleteProveedor(id).subscribe({
      next: () => {
        this.loadProveedores();
        if (callback) callback();
      },
      error: (err) => {
        const current = this.proveedoresSubject.value;
        this.proveedoresSubject.next(current.filter(p => p.id !== id));
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 3. GESTIÓN DE SERVICIOS FINANCIEROS
  // ==========================================
  loadPublicServices(callback?: (err?: any) => void) {
    this.apiService.getPublicServices().subscribe({
      next: (services) => {
        if (services && services.length > 0) {
          this.servicesSubject.next(services);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar servicios públicos desde API backend, usando fallback:', err);
        this.loadServices(callback);
      }
    });
  }

  loadServices(callback?: (err?: any) => void) {
    this.apiService.getServices().subscribe({
      next: (services) => {
        if (services && services.length > 0) {
          this.servicesSubject.next(services);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar servicios desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getServices(): FinancialService[] {
    return this.servicesSubject.value;
  }

  addService(service: Omit<FinancialService, 'id'>, callback?: (err?: any) => void) {
    this.apiService.createService(service).subscribe({
      next: () => {
        this.loadServices();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al crear servicio en backend, aplicando fallback:', err);
        const current = this.servicesSubject.value;
        const newId = current.length ? Math.max(...current.map(s => s.id)) + 1 : 1;
        const prov = service.idProveedor ? this.proveedoresSubject.value.find(p => p.id === service.idProveedor) : null;
        const newService: FinancialService = {
          ...service,
          id: newId,
          proveedorNombre: prov ? prov.nombreEmpresa : service.proveedorNombre
        };
        this.servicesSubject.next([...current, newService]);
        if (callback) callback(err);
      }
    });
  }

  updateService(id: number, updated: Partial<FinancialService>, callback?: (err?: any) => void) {
    this.apiService.updateService(id, updated).subscribe({
      next: () => {
        this.loadServices();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar servicio en backend, aplicando fallback:', err);
        const current = this.servicesSubject.value;
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          const provId = updated.idProveedor !== undefined ? updated.idProveedor : current[index].idProveedor;
          const prov = provId ? this.proveedoresSubject.value.find(p => p.id === provId) : null;
          current[index] = {
            ...current[index],
            ...updated,
            proveedorNombre: prov ? prov.nombreEmpresa : current[index].proveedorNombre
          };
          this.servicesSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  toggleServiceStatus(id: number, callback?: (err?: any) => void) {
    const current = this.servicesSubject.value;
    const serv = current.find(s => s.id === id);
    if (!serv) return;
    const newStatus = serv.status === 'Activo' ? 'Inactivo' : 'Activo';

    this.apiService.toggleServiceStatus(id, newStatus).subscribe({
      next: () => {
        this.loadServices();
        if (callback) callback();
      },
      error: () => {
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          current[index].status = newStatus;
          this.servicesSubject.next([...current]);
        }
        if (callback) callback();
      }
    });
  }

  deleteService(id: number, callback?: (err?: any) => void) {
    this.apiService.deleteService(id).subscribe({
      next: () => {
        this.loadServices();
        if (callback) callback();
      },
      error: (err) => {
        const current = this.servicesSubject.value;
        this.servicesSubject.next(current.filter(s => s.id !== id));
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 4. GESTIÓN DE CLIENTES
  // ==========================================
  loadClients(callback?: (err?: any) => void) {
    this.apiService.getClients().subscribe({
      next: (clients) => {
        if (clients && clients.length > 0) {
          this.clientsSubject.next(clients);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar clientes desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getClients(): Client[] {
    const all = this.clientsSubject.value;
    const role = this.activeRole;
    if (role === 'Administrador') return all;
    const currentUser = this.authService.getUser();
    if (role === 'Asesor') {
      const userId = currentUser?.id_usuario;
      const userName = currentUser?.nombre_completo?.toLowerCase();
      return all.filter(c => {
        if (userId && c.assignedAdvisorId === userId) return true;
        if (userName && c.assignedAdvisorName && c.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (!userId && !userName && (c.assignedAdvisorId === 2 || c.assignedAdvisorName?.includes('Juan'))) return true;
        return false;
      });
    }
    if (role === 'Cliente') {
      const userDni = currentUser?.dni;
      const userEmail = currentUser?.correo_electronico?.toLowerCase();
      return all.filter(c => {
        if (userDni && c.dni === userDni) return true;
        if (userEmail && c.email?.toLowerCase() === userEmail) return true;
        if (!userDni && !userEmail && (c.dni === '72345678' || c.name?.includes('María'))) return true;
        return false;
      });
    }
    return all;
  }

  getAllClients(): Client[] {
    return this.clientsSubject.value;
  }

  addClient(client: Omit<Client, 'id'>, callback?: (err?: any) => void) {
    this.apiService.createClient(client).subscribe({
      next: () => {
        this.loadClients();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al crear cliente en backend, aplicando fallback:', err);
        const current = this.clientsSubject.value;
        const newId = current.length ? Math.max(...current.map(c => c.id)) + 1 : 1;
        const newClient: Client = { ...client, id: newId };
        this.clientsSubject.next([...current, newClient]);
        if (callback) callback(err);
      }
    });
  }

  updateClient(id: number, updated: Partial<Client>, callback?: (err?: any) => void) {
    this.apiService.updateClient(id, updated).subscribe({
      next: () => {
        this.loadClients();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar cliente en backend, aplicando fallback:', err);
        const current = this.clientsSubject.value;
        const index = current.findIndex(c => c.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updated };
          this.clientsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  assignAdvisorToClient(clientId: number, advisorId: number, advisorName: string, callback?: (err?: any) => void) {
    this.apiService.assignAdvisorToClient(clientId, advisorId).subscribe({
      next: () => {
        this.loadClients();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al asignar asesor a cliente en backend, aplicando fallback:', err);
        const current = this.clientsSubject.value;
        const index = current.findIndex(c => c.id === clientId);
        if (index !== -1) {
          current[index].assignedAdvisorId = advisorId;
          current[index].assignedAdvisorName = advisorName;
          this.clientsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  toggleClientStatus(id: number, callback?: (err?: any) => void) {
    const current = this.clientsSubject.value;
    const client = current.find(c => c.id === id);
    if (!client) return;
    const newStatus = client.status === 'Activo' ? 'Inactivo' : 'Activo';

    this.apiService.toggleClientStatus(id, newStatus).subscribe({
      next: () => {
        this.loadClients();
        if (callback) callback();
      },
      error: () => {
        const index = current.findIndex(c => c.id === id);
        if (index !== -1) {
          current[index].status = newStatus;
          this.clientsSubject.next([...current]);
        }
        if (callback) callback();
      }
    });
  }

  deleteClient(id: number, callback?: (err?: any) => void) {
    this.apiService.deleteClient(id).subscribe({
      next: () => {
        this.loadClients();
        if (callback) callback();
      },
      error: (err) => {
        const current = this.clientsSubject.value;
        this.clientsSubject.next(current.filter(c => c.id !== id));
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 5. GESTIÓN DE SOLICITUDES DE ASESORÍA
  // ==========================================
  loadRequests(callback?: (err?: any) => void) {
    this.apiService.getRequests().subscribe({
      next: (requests) => {
        if (requests && requests.length > 0) {
          this.requestsSubject.next(requests);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar solicitudes desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getRequests(): AdvisoryRequest[] {
    const all = this.requestsSubject.value;
    const role = this.activeRole;
    if (role === 'Administrador') return all;
    const currentUser = this.authService.getUser();
    if (role === 'Asesor') {
      const userId = currentUser?.id_usuario;
      const userName = currentUser?.nombre_completo?.toLowerCase();
      return all.filter(r => {
        if (userId && r.assignedAdvisorId === userId) return true;
        if (userName && r.assignedAdvisorName && r.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (!userId && !userName && (r.assignedAdvisorId === 2 || r.assignedAdvisorName?.includes('Juan'))) return true;
        return false;
      });
    }
    if (role === 'Cliente') {
      const userDni = currentUser?.dni;
      const userEmail = currentUser?.correo_electronico?.toLowerCase();
      const userName = currentUser?.nombre_completo?.toLowerCase();
      return all.filter(r => {
        if (userDni && r.clientDni === userDni) return true;
        if (userEmail && r.clientEmail?.toLowerCase() === userEmail) return true;
        if (userName && r.clientName && r.clientName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (!userDni && !userEmail && !userName && (r.clientDni === '72345678' || r.clientName?.includes('María'))) return true;
        return false;
      });
    }
    return all;
  }

  getAllRequests(): AdvisoryRequest[] {
    return this.requestsSubject.value;
  }

  addRequest(request: Omit<AdvisoryRequest, 'id' | 'status' | 'date' | 'estadoPago'> & { estadoPago?: PaymentStatus; id?: string }, callback?: (err?: any, createdId?: string) => void) {
    const current = this.requestsSubject.value;
    const newId = `SOL-${(current.length + 1).toString().padStart(3, '0')}`;

    const service = this.servicesSubject.value.find(s => s.id === request.serviceId);
    const provId = request.idProveedor || service?.idProveedor;
    let provName = request.proveedorNombre || service?.proveedorNombre;
    let comisionPct = request.comisionAliadoPct;

    if (provId) {
      const prov = this.proveedoresSubject.value.find(p => p.id === provId);
      if (prov) {
        provName = prov.nombreEmpresa;
        comisionPct = prov.comisionPct;
      }
    }

    const price = request.servicePrecio || service?.precio || 0;
    const comisionAmount = comisionPct ? Number((price * (comisionPct / 100)).toFixed(2)) : 0;

    const payload: Partial<AdvisoryRequest> = {
      ...request,
      serviceId: Number(request.serviceId),
      idProveedor: provId,
      proveedorNombre: provName,
      comisionAliadoPct: comisionPct,
      montoComisionBroker: comisionAmount,
      servicePrecio: price,
      estadoPago: request.estadoPago || 'Pendiente'
    };

    this.apiService.createRequest(payload).subscribe({
      next: (res: any) => {
        const returnedId = res?.id_solicitud || newId;
        this.loadRequests();
        this.loadClients();
        if (callback) callback(null, returnedId);
      },
      error: (err) => {
        console.warn('Error al crear solicitud en backend, aplicando fallback:', err);
        const newRequest: AdvisoryRequest = {
          ...request,
          id: newId,
          serviceId: Number(request.serviceId),
          idProveedor: provId,
          proveedorNombre: provName,
          comisionAliadoPct: comisionPct,
          montoComisionBroker: comisionAmount,
          servicePrecio: price,
          estadoPago: request.estadoPago || 'Pendiente',
          status: 'Nueva',
          date: new Date().toISOString().split('T')[0]
        };
        this.requestsSubject.next([newRequest, ...current]);
        if (callback) callback(err, newId);
      }
    });
  }

  assignAdvisorToRequest(requestId: string, advisorId: number, advisorName: string, callback?: (err?: any) => void) {
    this.apiService.assignAdvisorToRequest(requestId, advisorId).subscribe({
      next: () => {
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al asignar asesor a solicitud en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].assignedAdvisorId = advisorId;
          current[index].assignedAdvisorName = advisorName;
          if (current[index].status === 'Nueva') {
            current[index].status = 'Pendiente';
          }
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  updateRequestStatus(requestId: string, status: RequestStatus, callback?: (err?: any) => void) {
    this.apiService.updateRequestStatus(requestId, status).subscribe({
      next: () => {
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cambiar estado de solicitud en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].status = status;
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  logAdvisorySession(requestId: string, notes: string, outcome: string, callback?: (err?: any) => void) {
    this.apiService.logAdvisorySession(requestId, notes, outcome).subscribe({
      next: () => {
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al registrar sesión de asesoría en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].advisoryNotes = notes;
          current[index].advisoryOutcome = outcome;
          current[index].status = 'Atendida';
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  closeRequest(requestId: string, closureNotes: string, targetStatus: RequestStatus = 'Finalizada', callback?: (err?: any) => void) {
    this.apiService.closeRequest(requestId, closureNotes, targetStatus).subscribe({
      next: () => {
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cerrar solicitud en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].closureNotes = closureNotes;
          current[index].status = targetStatus;
          if (targetStatus === 'Nula / Abandonada') {
            current[index].montoComisionBroker = 0;
          }
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  validatePayment(requestId: string, data?: { monto_pagado?: number; numero_operacion_yape?: string }, callback?: (err?: any) => void) {
    this.apiService.validatePayment(requestId, data).subscribe({
      next: () => {
        this.loadRequests();
        this.loadClients();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al validar pago en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].estadoPago = 'Pagado';
          if (!current[index].montoPagado && current[index].servicePrecio) {
            current[index].montoPagado = current[index].servicePrecio;
          }
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  rejectPayment(requestId: string, callback?: (err?: any) => void) {
    this.apiService.rejectPayment(requestId).subscribe({
      next: () => {
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al rechazar pago en backend, aplicando fallback:', err);
        const current = this.requestsSubject.value;
        const index = current.findIndex(r => r.id === requestId);
        if (index !== -1) {
          current[index].estadoPago = 'Rechazado';
          this.requestsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 6. GESTIÓN DE CITAS (Appointments)
  // ==========================================
  loadAppointments(callback?: (err?: any) => void) {
    this.apiService.getAppointments().subscribe({
      next: (appointments) => {
        if (appointments && appointments.length > 0) {
          this.appointmentsSubject.next(appointments);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar citas desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getAppointments(): Appointment[] {
    const all = this.appointmentsSubject.value;
    const role = this.activeRole;
    if (role === 'Administrador') return all;
    const currentUser = this.authService.getUser();
    if (role === 'Asesor') {
      const userId = currentUser?.id_usuario;
      const userName = currentUser?.nombre_completo?.toLowerCase();
      return all.filter(a => {
        if (userId && a.advisorId === userId) return true;
        if (userName && a.advisorName && a.advisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (!userId && !userName && (a.advisorId === 2 || a.advisorName?.includes('Juan'))) return true;
        return false;
      });
    }
    if (role === 'Cliente') {
      const userName = currentUser?.nombre_completo?.toLowerCase();
      return all.filter(a => {
        if (userName && a.clientName && a.clientName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (!userName && (a.clientName?.includes('María') || a.clientName?.includes('Carlos'))) return true;
        return false;
      });
    }
    return all;
  }

  getAllAppointments(): Appointment[] {
    return this.appointmentsSubject.value;
  }

  addAppointment(appointment: Omit<Appointment, 'id' | 'status'>, callback?: (err?: any) => void) {
    const current = this.appointmentsSubject.value;
    const newId = `CIT-${(current.length + 1).toString().padStart(3, '0')}`;

    const payload: Partial<Appointment> = {
      ...appointment,
      id: newId,
      status: 'Programada'
    };

    this.apiService.createAppointment(payload).subscribe({
      next: () => {
        this.loadAppointments();
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al registrar cita en backend, aplicando fallback:', err);
        const newAppointment: Appointment = {
          ...appointment,
          id: newId,
          status: 'Programada'
        };
        this.appointmentsSubject.next([newAppointment, ...current]);
        if (appointment.requestId) {
          this.updateRequestStatus(appointment.requestId, 'En Proceso');
        }
        if (callback) callback(err);
      }
    });
  }

  updateAppointment(id: string, updated: Partial<Appointment>, callback?: (err?: any) => void) {
    this.apiService.updateAppointment(id, updated).subscribe({
      next: () => {
        this.loadAppointments();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar cita en backend, aplicando fallback:', err);
        const current = this.appointmentsSubject.value;
        const index = current.findIndex(a => a.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updated };
          this.appointmentsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  updateAppointmentStatus(id: string, status: AppointmentStatus, callback?: (err?: any) => void) {
    this.apiService.updateAppointmentStatus(id, status).subscribe({
      next: () => {
        this.loadAppointments();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cambiar estado de cita en backend, aplicando fallback:', err);
        const current = this.appointmentsSubject.value;
        const index = current.findIndex(a => a.id === id);
        if (index !== -1) {
          current[index].status = status;
          this.appointmentsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  logAppointmentAttention(id: string, notes: string, outcome?: string, callback?: (err?: any) => void) {
    this.apiService.logAppointmentAttention(id, notes, outcome).subscribe({
      next: () => {
        this.loadAppointments();
        this.loadRequests();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al registrar atención de cita en backend, aplicando fallback:', err);
        const current = this.appointmentsSubject.value;
        const index = current.findIndex(a => a.id === id);
        if (index !== -1) {
          current[index].status = 'Realizada';
          current[index].attentionNotes = notes;
          current[index].advisoryOutcome = outcome;
          this.appointmentsSubject.next([...current]);

          const reqId = current[index].requestId;
          if (reqId) {
            this.logAdvisorySession(reqId, notes, outcome || 'Atención en cita concluida exitosamente');
          }
        }
        if (callback) callback(err);
      }
    });
  }

  deleteAppointment(id: string, callback?: (err?: any) => void) {
    this.apiService.deleteAppointment(id).subscribe({
      next: () => {
        this.loadAppointments();
        if (callback) callback();
      },
      error: (err) => {
        const current = this.appointmentsSubject.value;
        this.appointmentsSubject.next(current.filter(a => a.id !== id));
        if (callback) callback(err);
      }
    });
  }

  // ==========================================
  // 7. GESTIÓN DE CAMPAÑAS DE MARKETING
  // ==========================================
  loadCampaigns(callback?: (err?: any) => void) {
    this.apiService.getCampaigns().subscribe({
      next: (campaigns) => {
        if (campaigns && campaigns.length > 0) {
          this.campaignsSubject.next(campaigns);
        }
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar campañas desde API backend:', err);
        if (callback) callback(err);
      }
    });
  }

  getCampaigns(): MarketingCampaign[] {
    return this.campaignsSubject.value;
  }

  addCampaign(campaign: Omit<MarketingCampaign, 'id' | 'createdAt'>, callback?: (err?: any) => void) {
    this.apiService.createCampaign(campaign).subscribe({
      next: () => {
        this.loadCampaigns();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al registrar campaña en backend, aplicando fallback:', err);
        const current = this.campaignsSubject.value;
        const newId = current.length ? Math.max(...current.map(c => c.id)) + 1 : 1;
        const newCampaign: MarketingCampaign = {
          ...campaign,
          id: newId,
          createdAt: new Date().toISOString().split('T')[0]
        };
        this.campaignsSubject.next([newCampaign, ...current]);
        if (callback) callback(err);
      }
    });
  }

  updateCampaign(id: number, updated: Partial<MarketingCampaign>, callback?: (err?: any) => void) {
    this.apiService.updateCampaign(id, updated).subscribe({
      next: () => {
        this.loadCampaigns();
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al actualizar campaña en backend, aplicando fallback:', err);
        const current = this.campaignsSubject.value;
        const index = current.findIndex(c => c.id === id);
        if (index !== -1) {
          current[index] = { ...current[index], ...updated };
          this.campaignsSubject.next([...current]);
        }
        if (callback) callback(err);
      }
    });
  }

  toggleCampaignStatus(id: number, callback?: (err?: any) => void) {
    const current = this.campaignsSubject.value;
    const campaign = current.find(c => c.id === id);
    if (!campaign) return;
    const nextStatus = campaign.status === 'Activa' ? 'Inactiva' : 'Activa';

    this.apiService.toggleCampaignStatus(id, nextStatus).subscribe({
      next: () => {
        this.loadCampaigns();
        if (callback) callback();
      },
      error: () => {
        const index = current.findIndex(c => c.id === id);
        if (index !== -1) {
          current[index].status = nextStatus;
          this.campaignsSubject.next([...current]);
        }
        if (callback) callback();
      }
    });
  }

  deleteCampaign(id: number, callback?: (err?: any) => void) {
    this.apiService.deleteCampaign(id).subscribe({
      next: () => {
        this.loadCampaigns();
        if (callback) callback();
      },
      error: (err) => {
        const current = this.campaignsSubject.value;
        this.campaignsSubject.next(current.filter(c => c.id !== id));
        if (callback) callback(err);
      }
    });
  }

  getActiveCampaignsForClient(clientDni: string = '72345678'): MarketingCampaign[] {
    const clientRequests = this.requestsSubject.value.filter(r => r.clientDni === clientDni);
    const serviceIds = clientRequests.map(r => r.serviceId);

    return this.campaignsSubject.value.filter(c => {
      if (c.status !== 'Activa') return false;
      const matchesService = !c.targetServiceId || serviceIds.includes(c.targetServiceId);
      return matchesService;
    });
  }
}
