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

export type TechnicalDimension = 'Infraestructura' | 'Aplicaciones y BD' | 'Documentación' | 'Calendario' | 'Por Clasificar' | 'N/A - Mesa de Ayuda';
export type ChangeStatus = 'Abierto' | 'En Proceso' | 'Completado' | 'Rechazado';
export type ItilChangeType = 'Estándar (CHS)' | 'Normal (CHN)' | 'Emergencia (CHE)' | 'No Aplica';
export type ChangeApplicationFlag = 'Pendiente Evaluación' | 'Si Aplica (RFC)' | 'No Aplica (Soporte Directo)';

export interface SupportChangeTicket {
  id_ticket: string;
  codigo_jira: string;
  titulo: string;
  descripcion: string;
  tipo_solicitud: 'Soporte / Mesa de Ayuda' | 'Acceso / Credenciales' | 'Requerimiento de Cambio' | 'Incidente Técnico' | string;
  solicitante_nombre: string;
  solicitante_rol: UserRole | string;
  prioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  aplica_cambio: ChangeApplicationFlag;
  dimension_tecnica: TechnicalDimension;
  tipo_cambio_itil: ItilChangeType;
  estado: ChangeStatus;
  componente_afectado: string;
  ventana_calendarizacion: string;
  doc_pase_referencia: string;
  plan_rollback: string;
  resolucion_tecnica: string;
  fecha_registro?: string;
}

export interface DimensionMetricsRow {
  dimension: 'Infraestructura' | 'Aplicaciones y BD' | 'Documentación' | 'Calendario';
  abiertos: number;
  en_proceso: number;
  completados: number;
  total: number;
  porcentaje_completado: number;
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
  
  // Flags para evitar peticiones duplicadas en paralelo (deduplicación)
  private loadingUsers = false;
  private loadingProveedores = false;
  private loadingServices = false;
  private loadingClients = false;
  private loadingRequests = false;
  private loadingAppointments = false;
  private loadingCampaigns = false;

  private campaignsSubject = new BehaviorSubject<MarketingCampaign[]>([]);
  public campaigns$: Observable<MarketingCampaign[]> = this.campaignsSubject.asObservable();

  constructor() {
    this.authService.currentUser$.subscribe(user => {
      if (user?.rol) {
        this.activeRoleSubject.next(user.rol as UserRole);
      } else {
        this.usersSubject.next([]);
        this.proveedoresSubject.next([]);
        this.servicesSubject.next([]);
        this.clientsSubject.next([]);
        this.requestsSubject.next([]);
        this.appointmentsSubject.next([]);
        this.campaignsSubject.next([]);
      }
    });
  }

  // Carga global inicial desde la base de datos
  loadAllData() {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    const role = this.activeRole;
    if (role === 'Administrador') {
      this.loadUsers();
      this.loadProveedores();
      this.loadServices();
      this.loadClients();
      this.loadRequests();
      this.loadAppointments();
      this.loadCampaigns();
    } else if (role === 'Asesor') {
      this.loadServices();
      this.loadClients();
      this.loadRequests();
      this.loadAppointments();
    } else {
      this.loadServices();
      this.loadRequests();
      this.loadAppointments();
    }
  }

  // ==========================================
  // 1. GESTIÓN DE USUARIOS
  // ==========================================
  loadUsers(callback?: (err?: any) => void) {
    if (!this.authService.isAuthenticated() || this.loadingUsers) { if (callback) callback(); return; }
    this.loadingUsers = true;
    this.apiService.getUsers().subscribe({
      next: (users) => {
        this.loadingUsers = false;
        this.usersSubject.next(users || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingUsers = false;
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
    if (!this.authService.isAuthenticated() || this.loadingProveedores) { if (callback) callback(); return; }
    this.loadingProveedores = true;
    this.apiService.getProveedores().subscribe({
      next: (provs) => {
        this.loadingProveedores = false;
        this.proveedoresSubject.next(provs || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingProveedores = false;
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
        this.loadingServices = false;
        this.servicesSubject.next(services || []);
        if (callback) callback();
      },
      error: (err) => {
        console.warn('Error al cargar servicios públicos desde API backend, usando fallback:', err);
        this.loadServices(callback);
      }
    });
  }

  loadServices(callback?: (err?: any) => void) {
    if (!this.authService.isAuthenticated() || this.loadingServices) { if (callback) callback(); return; }
    this.loadingServices = true;
    this.apiService.getServices().subscribe({
      next: (services) => {
        if (services && services.length > 0) {
          this.servicesSubject.next(services);
        }
        if (callback) callback();
      },
      error: (err) => {
        this.loadingServices = false;
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
    if (!this.authService.isAuthenticated() || this.loadingClients) { if (callback) callback(); return; }
    this.loadingClients = true;
    this.apiService.getClients().subscribe({
      next: (clients) => {
        this.loadingClients = false;
        this.clientsSubject.next(clients || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingClients = false;
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
      const requestsOfAdvisor = this.requestsSubject.value.filter(r => {
        if (userId && r.assignedAdvisorId === userId) return true;
        if (userName && r.assignedAdvisorName && r.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
        return false;
      });
      const clientDnis = new Set(requestsOfAdvisor.map(r => r.clientDni?.trim()).filter(Boolean));
      const clientEmails = new Set(requestsOfAdvisor.map(r => r.clientEmail?.trim().toLowerCase()).filter(Boolean));

      return all.filter(c => {
        if (userId && c.assignedAdvisorId === userId) return true;
        if (userName && c.assignedAdvisorName && c.assignedAdvisorName.toLowerCase().includes(userName.split(' ')[0])) return true;
        if (c.dni && clientDnis.has(c.dni.trim())) return true;
        if (c.email && clientEmails.has(c.email.trim().toLowerCase())) return true;
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
    if (!this.authService.isAuthenticated() || this.loadingRequests) { if (callback) callback(); return; }
    this.loadingRequests = true;
    this.apiService.getRequests().subscribe({
      next: (requests) => {
        this.loadingRequests = false;
        this.requestsSubject.next(requests || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingRequests = false;
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
    if (!this.authService.isAuthenticated() || this.loadingAppointments) { if (callback) callback(); return; }
    this.loadingAppointments = true;
    this.apiService.getAppointments().subscribe({
      next: (appointments) => {
        this.loadingAppointments = false;
        this.appointmentsSubject.next(appointments || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingAppointments = false;
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
    if (!this.authService.isAuthenticated() || this.loadingCampaigns) { if (callback) callback(); return; }
    this.loadingCampaigns = true;
    this.apiService.getCampaigns().subscribe({
      next: (campaigns) => {
        this.loadingCampaigns = false;
        this.campaignsSubject.next(campaigns || []);
        if (callback) callback();
      },
      error: (err) => {
        this.loadingCampaigns = false;
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

  getActiveCampaignsForClient(clientDni?: string, clientEmail?: string): MarketingCampaign[] {
    const user = this.authService.getUser();
    const dni = clientDni || user?.dni;
    const email = (clientEmail || user?.correo_electronico)?.toLowerCase();

    const clientRequests = this.requestsSubject.value.filter(r => {
      if (dni && r.clientDni === dni) return true;
      if (email && r.clientEmail?.toLowerCase() === email) return true;
      return false;
    });

    const serviceIds = clientRequests.map(r => r.serviceId).filter(Boolean);
    const providerIds = clientRequests.map(r => r.idProveedor).filter(Boolean);

    return this.campaignsSubject.value.filter(c => {
      if (c.status !== 'Activa') return false;
      // Si la campaña no tiene filtros específicos de servicio ni proveedor, aplica para TODOS los clientes
      const isGeneral = (!c.targetServiceId || c.targetServiceId === 0) && (!c.targetProveedorId || c.targetProveedorId === 0);
      if (isGeneral) return true;

      const matchesService = c.targetServiceId ? serviceIds.includes(c.targetServiceId) : true;
      const matchesProveedor = c.targetProveedorId ? providerIds.includes(c.targetProveedorId) : true;

      return (c.targetServiceId && matchesService) || (c.targetProveedorId && matchesProveedor);
    });
  }

  // =========================================================================
  // 8. MESA DE AYUDA Y CONTROL DE CAMBIOS POR DIMENSIÓN (SEMANA 10 & 11)
  // =========================================================================
  private readonly STORAGE_KEY_SUPPORT = 'finnova_support_changes_v1';

  private readonly DEFAULT_SUPPORT_TICKETS: SupportChangeTicket[] = [
    // DIMENSIÓN 1: INFRAESTRUCTURA (3 Cambios: 1 Completado, 1 En Proceso, 1 Abierto)
    {
      id_ticket: 'RFC-2026-001',
      codigo_jira: 'FCC-101',
      titulo: '[CHE01] Configuración de trust proxy en Render y calibración de Rate Limiting',
      descripcion: 'Ajuste crítico en server.js (app.set("trust proxy", 1)) para identificar la IP real detrás del balanceador de Render Cloud y evitar bloqueos masivos HTTP 429 en /api/auth/login.',
      tipo_solicitud: 'Incidente Técnico',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Crítica',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Infraestructura',
      tipo_cambio_itil: 'Emergencia (CHE)',
      estado: 'Completado',
      componente_afectado: 'Backend Express (Render Cloud)',
      ventana_calendarizacion: 'Ejecución Inmediata Hotfix (18/10/2026)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md#PASE-BE-2026-01',
      plan_rollback: 'Revertir configuración de express-rate-limit y ejecutar Rollback to previous deploy en consola Render (RTO < 3 min).',
      resolucion_tecnica: 'Desplegado exitosamente en producción. Cero errores HTTP 429 en pruebas de concurrencia.',
      fecha_registro: '2026-10-18'
    },
    {
      id_ticket: 'RFC-2026-002',
      codigo_jira: 'FCC-102',
      titulo: '[CHN01] Optimización de Pool de Conexiones SSL/TLS hacia TiDB Cloud AWS',
      descripcion: 'Ajuste de parámetros connectionLimit: 10, waitForConnections: true y cifrado TLS forzado (rejectUnauthorized: false) en src/config/db.js para estabilizar latencia entre Render y AWS.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Infraestructura',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'En Proceso',
      componente_afectado: 'TiDB Cloud Serverless / Render',
      ventana_calendarizacion: 'Ventana Domingos 01:00 AM - 03:00 AM (UTC-5)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Restaurar variables de entorno DB_SSL y pool por defecto en consola de Render.',
      resolucion_tecnica: 'En pruebas de estrés k6 validando estabilidad de 10 conexiones simultáneas.',
      fecha_registro: '2026-10-25'
    },
    {
      id_ticket: 'RFC-2026-003',
      codigo_jira: 'FCC-103',
      titulo: '[CHS01] Rotación trimestral de JWT_SECRET y endurecimiento de cabeceras Helmet',
      descripcion: 'Renovación programada de la llave criptográfica de firma de tokens JWT en variables de entorno de Render y actualización de políticas Cross-Origin en Helmet.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Carlos Mendoza (Seguridad TI)',
      solicitante_rol: 'Administrador',
      prioridad: 'Media',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Infraestructura',
      tipo_cambio_itil: 'Estándar (CHS)',
      estado: 'Abierto',
      componente_afectado: 'Backend Express (Render Cloud)',
      ventana_calendarizacion: 'Domingo 15/11/2026 01:30 AM (UTC-5)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Restaurar valor anterior de JWT_SECRET en panel Environment de Render en 1 minuto.',
      resolucion_tecnica: 'Pendiente de inicio de ventana programada.',
      fecha_registro: '2026-11-02'
    },

    // DIMENSIÓN 2: APLICACIONES Y BD (3 Cambios: 1 Completado, 1 En Proceso, 1 Abierto)
    {
      id_ticket: 'RFC-2026-004',
      codigo_jira: 'FCC-104',
      titulo: '[CHN02] Migración de columna id_asesor_preferente y auto-aprovisionamiento Cliente',
      descripcion: 'Alteración de esquema en tabla clientes (id_asesor_preferente) y lógica en solicitudController.js para crear automáticamente el usuario Cliente y enviar credenciales por Nodemailer al validar pago Yape.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Aplicaciones y BD',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'Completado',
      componente_afectado: 'Base de Datos TiDB + Backend Express + Angular',
      ventana_calendarizacion: 'Ejecutado en Ventana 25/10/2026 01:30 AM',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md#PASE-BE-2026-02',
      plan_rollback: 'Ejecutar script inverso ALTER TABLE clientes DROP COLUMN id_asesor_preferente y git revert del commit.',
      resolucion_tecnica: 'Migración aplicada sin pérdida de datos y validada en producción.',
      fecha_registro: '2026-10-25'
    },
    {
      id_ticket: 'RFC-2026-005',
      codigo_jira: 'FCC-105',
      titulo: '[CHN03] Despliegue de Módulo de Mesa de Ayuda y Bandeja de Control de Cambios',
      descripcion: 'Creación de tabla tickets_soporte_cambios en TiDB Cloud, endpoints REST /api/soporte-cambios y componente Angular /dashboard/support-changes para calificar solicitudes y escalarlas a RFC por dimensión.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Aplicaciones y BD',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'En Proceso',
      componente_afectado: 'Frontend Angular (Vercel) + Backend (Render) + TiDB',
      ventana_calendarizacion: 'Ventana Actual 06/11/2026',
      doc_pase_referencia: 'proyecto-finnova/docs/PASE_A_PRODUCCION.md#PASE-FE-2026-04',
      plan_rollback: 'Instant Rollback en Vercel y DROP TABLE tickets_soporte_cambios si se requiere reversión.',
      resolucion_tecnica: 'En validación funcional e integración con tablero de métricas por dimensión.',
      fecha_registro: '2026-11-06'
    },
    {
      id_ticket: 'RFC-2026-006',
      codigo_jira: 'FCC-106',
      titulo: '[CHN04] Creación de índice compuesto idx_estado_fecha en tabla solicitudes',
      descripcion: 'Optimización DDL en TiDB Cloud agregando índice sobre (estado_atencion, estado_pago, fecha_registro) para acelerar las consultas de reportes de comisiones de brokers.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Juan Pérez (Asesor Senior)',
      solicitante_rol: 'Asesor',
      prioridad: 'Media',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Aplicaciones y BD',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'Abierto',
      componente_afectado: 'Base de Datos (TiDB Cloud)',
      ventana_calendarizacion: 'Domingo 08/11/2026 02:00 AM (UTC-5)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'DROP INDEX idx_estado_fecha ON solicitudes;',
      resolucion_tecnica: 'Aprobado técnicamente por CAB, esperando ventana dominical.',
      fecha_registro: '2026-11-05'
    },

    // DIMENSIÓN 3: DOCUMENTACIÓN (3 Cambios: 1 Completado, 1 En Proceso, 1 Abierto)
    {
      id_ticket: 'RFC-2026-007',
      codigo_jira: 'FCC-107',
      titulo: '[CHS02] Publicación de Runbook y Acta de Pase a Producción en repositorios Front y Back',
      descripcion: 'Estandarización y versionamiento del archivo docs/PASE_A_PRODUCCION.md tanto en proyecto-finnova como en backend-finnova con pre-requisitos, comandos CI/CD, smoke tests y plan de rollback.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Documentación',
      tipo_cambio_itil: 'Estándar (CHS)',
      estado: 'Completado',
      componente_afectado: 'Repositorios GitHub (Front y Back)',
      ventana_calendarizacion: '06/11/2026 11:00 AM (Ventana Estándar)',
      doc_pase_referencia: 'proyecto-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Revertir commit de documentación vía git revert en rama main.',
      resolucion_tecnica: 'Documentación publicada y vinculada a las actas PASE-FE y PASE-BE.',
      fecha_registro: '2026-11-06'
    },
    {
      id_ticket: 'RFC-2026-008',
      codigo_jira: 'FCC-108',
      titulo: '[CHS03] Actualización de especificación de endpoints REST y Colección Postman v1.2',
      descripcion: 'Documentación de contratos JSON de entrada/salida para los nuevos endpoints /api/soporte-cambios y /api/solicitudes/:id/validar-pago incluyendo códigos de estado HTTP.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Media',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Documentación',
      tipo_cambio_itil: 'Estándar (CHS)',
      estado: 'En Proceso',
      componente_afectado: 'Swagger / Documentación Técnica API',
      ventana_calendarizacion: 'Jueves 06/11/2026 04:00 PM',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Restaurar versión v1.1 de la especificación de endpoints en el repositorio.',
      resolucion_tecnica: '85% completado; validando ejemplos de respuesta de métricas por dimensión.',
      fecha_registro: '2026-11-05'
    },
    {
      id_ticket: 'RFC-2026-009',
      codigo_jira: 'FCC-109',
      titulo: '[CHS04] Actualización del Diccionario de Datos Relacional y Diagrama Entidad-Relación',
      descripcion: 'Incorporación formal de las tablas tickets_soporte_cambios y logs_auditoria_seguridad en el diccionario de datos técnico del proyecto Finnova.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Ana Torres (Analista QA)',
      solicitante_rol: 'Asesor',
      prioridad: 'Baja',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Documentación',
      tipo_cambio_itil: 'Estándar (CHS)',
      estado: 'Abierto',
      componente_afectado: 'Diccionario de Datos BD Finnova',
      ventana_calendarizacion: 'Martes 10/11/2026 10:00 AM',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'No afecta disponibilidad operativa; reversión documental en Git.',
      resolucion_tecnica: 'Abierto para revisión del DBA.',
      fecha_registro: '2026-11-06'
    },

    // DIMENSIÓN 4: CALENDARIO (3 Cambios: 1 Completado, 1 En Proceso, 1 Abierto)
    {
      id_ticket: 'RFC-2026-010',
      codigo_jira: 'FCC-110',
      titulo: '[CHS05] Programación de Cron Job keepAlive.js (cada 10 min) en horario hábil',
      descripcion: 'Cambio de calendarización automatizada mediante scripts/keepAlive.js que ejecuta pings cada 10 minutos a /api/health entre las 08:00 y 22:00 h para evitar el Cold Start de Render sin consumir horas fuera de turno.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Calendario',
      tipo_cambio_itil: 'Estándar (CHS)',
      estado: 'Completado',
      componente_afectado: 'Cronograma Automatizado / scripts/keepAlive.js',
      ventana_calendarizacion: 'Ejecución continua Lunes a Sábado (08:00 - 22:00 h)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md#PASE-BE-2026-03',
      plan_rollback: 'Detener proceso programado keepAlive.js o ajustar INTERVAL_MS.',
      resolucion_tecnica: 'Activo y verificado. Tiempo de respuesta inicial reducido de 50s a 180ms.',
      fecha_registro: '2026-10-30'
    },
    {
      id_ticket: 'RFC-2026-011',
      codigo_jira: 'FCC-111',
      titulo: '[CHN05] Reprogramación de Ventana de Mantenimiento Oficial y Respaldo TiDB Cloud',
      descripcion: 'Cambio en el Calendario Oficial de Cambios (FSC): traslado de la ventana de mantenimiento y snapshot completo de base de datos al horario de menor tráfico (Domingos 01:00 AM a 03:00 AM UTC-5).',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Media',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Calendario',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'En Proceso',
      componente_afectado: 'Calendario FSC / Ventana de Mantenimiento',
      ventana_calendarizacion: 'Domingos 01:00 AM - 03:00 AM (UTC-5)',
      doc_pase_referencia: 'backend-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Retornar al horario previo de mantenimiento (Sábados 11:30 PM).',
      resolucion_tecnica: 'Notificado a asesores y configurado en cronograma de operaciones.',
      fecha_registro: '2026-11-03'
    },
    {
      id_ticket: 'RFC-2026-012',
      codigo_jira: 'FCC-112',
      titulo: '[CHN06] Programación de Periodo de Congelamiento (Code Freeze) por Cierre Contable',
      descripcion: 'Bloqueo programado en calendario de despliegues no críticos desde el 28 al 30 de cada mes para garantizar estabilidad durante la liquidación de comisiones de brokers y conciliación Yape.',
      tipo_solicitud: 'Requerimiento de Cambio',
      solicitante_nombre: 'Fiorella Gamarra',
      solicitante_rol: 'Administrador',
      prioridad: 'Alta',
      aplica_cambio: 'Si Aplica (RFC)',
      dimension_tecnica: 'Calendario',
      tipo_cambio_itil: 'Normal (CHN)',
      estado: 'Abierto',
      componente_afectado: 'Calendario de Releases GitHub / Vercel / Render',
      ventana_calendarizacion: 'Días 28 al 30 de cada mes (00:00 - 23:59 h)',
      doc_pase_referencia: 'proyecto-finnova/docs/PASE_A_PRODUCCION.md',
      plan_rollback: 'Habilitar excepción temporal firmada únicamente por comité eCAB para hotfixes críticos.',
      resolucion_tecnica: 'Programado en el Forward Schedule of Changes (FSC) de Noviembre.',
      fecha_registro: '2026-11-05'
    },

    // SOLICITUDES OPERATIVAS DE MESA DE AYUDA (SEMANA 10)
    {
      id_ticket: 'SRQ-2026-013',
      codigo_jira: 'SRQ-ACC-014',
      titulo: 'Desbloqueo de cuenta de usuario por límite de intentos fallidos (intentos_fallidos >= 5)',
      descripcion: 'El asesor reporta bloqueo preventivo de su cuenta tras 5 intentos fallidos de inicio de sesión. Solicita restablecimiento de acceso según procedimiento PROC-SOL-02.',
      tipo_solicitud: 'Acceso / Credenciales',
      solicitante_nombre: 'Juan Pérez (Asesor)',
      solicitante_rol: 'Asesor',
      prioridad: 'Alta',
      aplica_cambio: 'No Aplica (Soporte Directo)',
      dimension_tecnica: 'N/A - Mesa de Ayuda',
      tipo_cambio_itil: 'No Aplica',
      estado: 'Completado',
      componente_afectado: 'Módulo de Usuarios y Auditoría',
      ventana_calendarizacion: 'Atención Inmediata SLA < 15 min',
      doc_pase_referencia: 'PROC-SOL-02 (Gestión de Solicitudes)',
      plan_rollback: 'N/A - Operación estándar de Mesa de Ayuda.',
      resolucion_tecnica: 'Verificado en logs_auditoria_seguridad. Se limpió intentos_fallidos = 0 y bloqueado_hasta = NULL.',
      fecha_registro: '2026-11-04'
    },
    {
      id_ticket: 'SRQ-2026-014',
      codigo_jira: 'SRQ-SOP-015',
      titulo: 'Solicitud de evaluación para habilitar recordatorio automático 2h antes de cita virtual',
      descripcion: 'Los clientes solicitan que, además del correo electrónico por Nodemailer, se programe un recordatorio automático previo a la sesión de asesoría.',
      tipo_solicitud: 'Soporte / Mesa de Ayuda',
      solicitante_nombre: 'María López (Cliente)',
      solicitante_rol: 'Cliente',
      prioridad: 'Media',
      aplica_cambio: 'Pendiente Evaluación',
      dimension_tecnica: 'Por Clasificar',
      tipo_cambio_itil: 'No Aplica',
      estado: 'Abierto',
      componente_afectado: 'Módulo de Citas / Notificaciones',
      ventana_calendarizacion: 'Por definir en Comité CAB',
      doc_pase_referencia: 'Pendiente de Calificación en Bandeja',
      plan_rollback: 'Por definir al evaluar si escala a Control de Cambios (RFC).',
      resolucion_tecnica: 'Registrado desde el Formulario de Soporte en espera de calificación del Administrador.',
      fecha_registro: '2026-11-06'
    }
  ];

  private getInitialSupportTickets(): SupportChangeTicket[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_SUPPORT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage error
    }
    return [...this.DEFAULT_SUPPORT_TICKETS];
  }

  private saveSupportTicketsToStorage(tickets: SupportChangeTicket[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY_SUPPORT, JSON.stringify(tickets));
    } catch {
      // ignore storage error
    }
  }

  private supportTicketsSubject = new BehaviorSubject<SupportChangeTicket[]>(this.getInitialSupportTickets());
  public supportTickets$: Observable<SupportChangeTicket[]> = this.supportTicketsSubject.asObservable();

  loadSupportTickets(callback?: (err?: any) => void) {
    this.apiService.getSupportChangeTickets().subscribe({
      next: (rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped: SupportChangeTicket[] = rows.map(r => ({
            id_ticket: r.id_ticket,
            codigo_jira: r.codigo_jira || 'SIN-JIRA',
            titulo: r.titulo,
            descripcion: r.descripcion,
            tipo_solicitud: r.tipo_solicitud || 'Soporte / Mesa de Ayuda',
            solicitante_nombre: r.solicitante_nombre || 'Usuario Finnova',
            solicitante_rol: r.solicitante_rol || 'Cliente',
            prioridad: r.prioridad || 'Media',
            aplica_cambio: r.aplica_cambio || 'Pendiente Evaluación',
            dimension_tecnica: r.dimension_tecnica || 'Por Clasificar',
            tipo_cambio_itil: r.tipo_cambio_itil || 'No Aplica',
            estado: r.estado || 'Abierto',
            componente_afectado: r.componente_afectado || 'Plataforma Finnova',
            ventana_calendarizacion: r.ventana_calendarizacion || 'Por definir',
            doc_pase_referencia: r.doc_pase_referencia || 'docs/PASE_A_PRODUCCION.md',
            plan_rollback: r.plan_rollback || 'Revertir despliegue en Render/Vercel.',
            resolucion_tecnica: r.resolucion_tecnica || 'En evaluación.',
            fecha_registro: r.fecha_registro ? String(r.fecha_registro).split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          this.supportTicketsSubject.next(mapped);
          this.saveSupportTicketsToStorage(mapped);
        }
        if (callback) callback();
      },
      error: () => {
        // Fallback inmediato a la semilla persistida en localStorage si el servidor aún está despertando
        const local = this.getInitialSupportTickets();
        this.supportTicketsSubject.next(local);
        if (callback) callback();
      }
    });
  }

  getSupportTickets(): SupportChangeTicket[] {
    return this.supportTicketsSubject.value;
  }

  addSupportTicket(ticketData: Partial<SupportChangeTicket>, callback?: (err?: any) => void) {
    const user = this.authService.getUser();
    const isRfc = ticketData.aplica_cambio === 'Si Aplica (RFC)';
    const prefix = isRfc ? 'RFC' : 'SRQ';
    const randomNum = Math.floor(115 + Math.random() * 800);
    const newTicket: SupportChangeTicket = {
      id_ticket: ticketData.id_ticket || `${prefix}-2026-${randomNum}`,
      codigo_jira: ticketData.codigo_jira || (isRfc ? `FCC-${randomNum}` : `SRQ-SOP-${randomNum}`),
      titulo: ticketData.titulo || 'Nueva Solicitud Técnica',
      descripcion: ticketData.descripcion || '',
      tipo_solicitud: ticketData.tipo_solicitud || 'Soporte / Mesa de Ayuda',
      solicitante_nombre: ticketData.solicitante_nombre || user?.nombre_completo || 'Fiorella Gamarra',
      solicitante_rol: ticketData.solicitante_rol || this.activeRole,
      prioridad: ticketData.prioridad || 'Media',
      aplica_cambio: ticketData.aplica_cambio || 'Pendiente Evaluación',
      dimension_tecnica: ticketData.dimension_tecnica || 'Por Clasificar',
      tipo_cambio_itil: ticketData.tipo_cambio_itil || 'No Aplica',
      estado: ticketData.estado || 'Abierto',
      componente_afectado: ticketData.componente_afectado || 'Plataforma Finnova',
      ventana_calendarizacion: ticketData.ventana_calendarizacion || 'Por definir en Comité CAB',
      doc_pase_referencia: ticketData.doc_pase_referencia || 'docs/PASE_A_PRODUCCION.md',
      plan_rollback: ticketData.plan_rollback || 'Instant Rollback en Vercel / Render ante anomalía en Smoke Test.',
      resolucion_tecnica: ticketData.resolucion_tecnica || 'Registrado en bandeja para revisión técnica.',
      fecha_registro: new Date().toISOString().split('T')[0]
    };

    this.apiService.createSupportChangeTicket(newTicket).subscribe({
      next: () => {
        this.loadSupportTickets(callback);
      },
      error: () => {
        const updated = [newTicket, ...this.supportTicketsSubject.value];
        this.supportTicketsSubject.next(updated);
        this.saveSupportTicketsToStorage(updated);
        if (callback) callback();
      }
    });
  }

  qualifySupportTicket(id_ticket: string, changes: Partial<SupportChangeTicket>, callback?: (err?: any) => void) {
    // Actualizar primero de forma optimista para reflejar en tiempo real en los KPIs y tablas
    const current = [...this.supportTicketsSubject.value];
    const idx = current.findIndex(t => t.id_ticket === id_ticket);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...changes };
      if (changes.aplica_cambio === 'Si Aplica (RFC)' && current[idx].id_ticket.startsWith('SRQ-')) {
        // Conservar trazabilidad y asegurar código Jira RFC
        if (!current[idx].codigo_jira.startsWith('FCC-')) {
          current[idx].codigo_jira = `FCC-${Math.floor(115 + Math.random() * 80)}`;
        }
      }
      this.supportTicketsSubject.next(current);
      this.saveSupportTicketsToStorage(current);
    }

    this.apiService.qualifySupportChangeTicket(id_ticket, changes).subscribe({
      next: () => {
        this.loadSupportTickets(callback);
      },
      error: () => {
        if (callback) callback();
      }
    });
  }

  deleteSupportTicket(id_ticket: string, callback?: (err?: any) => void) {
    const filtered = this.supportTicketsSubject.value.filter(t => t.id_ticket !== id_ticket);
    this.supportTicketsSubject.next(filtered);
    this.saveSupportTicketsToStorage(filtered);

    this.apiService.deleteSupportChangeTicket(id_ticket).subscribe({
      next: () => {
        if (callback) callback();
      },
      error: () => {
        if (callback) callback();
      }
    });
  }

  resetSupportTicketsToDefault() {
    localStorage.removeItem(this.STORAGE_KEY_SUPPORT);
    this.supportTicketsSubject.next([...this.DEFAULT_SUPPORT_TICKETS]);
  }

  getChangeMetricsByDimension(): DimensionMetricsRow[] {
    const dimensiones: ('Infraestructura' | 'Aplicaciones y BD' | 'Documentación' | 'Calendario')[] = [
      'Infraestructura',
      'Aplicaciones y BD',
      'Documentación',
      'Calendario'
    ];
    const tickets = this.supportTicketsSubject.value;

    return dimensiones.map(dim => {
      const items = tickets.filter(t => t.dimension_tecnica === dim && t.aplica_cambio === 'Si Aplica (RFC)');
      const abiertos = items.filter(t => t.estado === 'Abierto').length;
      const en_proceso = items.filter(t => t.estado === 'En Proceso').length;
      const completados = items.filter(t => t.estado === 'Completado').length;
      const total = items.length;
      const porcentaje_completado = total > 0 ? Math.round((completados / total) * 100) : 0;
      return {
        dimension: dim,
        abiertos,
        en_proceso,
        completados,
        total,
        porcentaje_completado
      };
    });
  }
}
