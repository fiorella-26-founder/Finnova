import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { 
  Client, 
  FinancialService, 
  Proveedor, 
  AdvisoryRequest, 
  Appointment, 
  MarketingCampaign, 
  SystemUser, 
  UserRole, 
  RequestStatus, 
  PaymentStatus, 
  AppointmentStatus 
} from './finnova-data.service';

export interface ReportDashboardMetrics {
  solicitudes?: {
    total_solicitudes?: number;
    solicitudes_finalizadas?: number;
    solicitudes_atendidas?: number;
    solicitudes_en_proceso?: number;
    solicitudes_pendientes?: number;
    pagos_validados?: number;
    total_recaudado?: number;
    comisiones_ganadas_broker?: number;
    [key: string]: any;
  } | any;
  ingresos?: any;
  comisiones?: any;
  usuarios?: any;
  citas?: {
    total_citas?: number;
    citas_realizadas?: number;
    citas_programadas?: number;
    [key: string]: any;
  } | any;
  servicios?: {
    total_servicios?: number;
    servicios_activos?: number;
    total_categorias?: number;
    [key: string]: any;
  } | any;
  campanias?: {
    total_campanias?: number;
    campanias_activas?: number;
    campanias_inactivas?: number;
    [key: string]: any;
  } | any;
  clientes?: {
    total_clientes?: number;
    clientes_activos?: number;
    [key: string]: any;
  } | any;
  proveedores?: {
    total_proveedores?: number;
    promedio_comision_aliados?: number;
    [key: string]: any;
  } | any;
  rendimiento_general?: any;
  [key: string]: any;
}

export interface ReportComisionItem {
  id_solicitud: string;
  fecha_registro: string;
  nombre_cliente: string;
  dni_cliente: string;
  correo_cliente?: string;
  titulo_servicio: string;
  nombre_proveedor: string;
  nombre_asesor: string;
  monto_servicio: number;
  monto_pagado: number;
  estado_pago: string;
  porcentaje_comision_aliado: number;
  monto_comision_broker: number;
  estado_atencion: string;
  [key: string]: any;
}

export interface ReportGananciaPeriodoItem {
  periodo: string;
  total_solicitudes: number;
  solicitudes_exitosas: number;
  monto_total_solicitado: number;
  total_recaudado: number;
  comisiones_broker: number;
  [key: string]: any;
}

export interface ReportServicioItem {
  id_servicio: number;
  titulo: string;
  categoria: string;
  nombre_proveedor: string;
  precio_tarifa: number;
  total_solicitudes: number;
  solicitudes_exitosas: number;
  total_recaudado: number;
  total_comisiones_broker: number;
  estado_servicio: string;
  [key: string]: any;
}

export interface ReportAsesorItem {
  id_usuario: number;
  nombre_asesor: string;
  correo_electronico: string;
  total_solicitudes: number;
  solicitudes_finalizadas: number;
  solicitudes_atendidas: number;
  total_citas_asignadas: number;
  citas_realizadas: number;
  total_recaudado: number;
  total_comisiones_generadas: number;
  estado_asesor: string;
  [key: string]: any;
}

export interface ReportCampaniaItem {
  id_campana: number;
  titulo: string;
  servicio_promovido: string;
  aliado_proveedor: string;
  publico_objetivo: string;
  fecha_creacion?: string;
  fecha_programada?: string;
  usuario_creador: string;
  estado: string;
  [key: string]: any;
}

export interface BackendUsuario {
  id_usuario: number;
  dni: string;
  nombre_completo: string;
  correo_electronico: string;
  telefono?: string | null;
  id_rol: number;
  nombre_rol: UserRole;
  estado: 'Activo' | 'Inactivo';
  fecha_registro?: string;
}

export interface BackendCliente {
  id_cliente: number;
  id_usuario?: number | null;
  dni: string;
  nombre_completo: string;
  correo_electronico: string;
  telefono?: string | null;
  direccion?: string | null;
  id_asesor_preferente?: number | null;
  nombre_asesor?: string | null;
  correo_asesor?: string | null;
  estado: 'Activo' | 'Inactivo';
  fecha_registro?: string;
}

export interface BackendProveedor {
  id_proveedor: number;
  ruc?: string | null;
  nombre_empresa: string;
  tipo_alianza: string;
  porcentaje_comision: number | string;
  contacto_nombre?: string | null;
  contacto_email?: string | null;
  contacto_telefono?: string | null;
  estado: 'Activo' | 'Inactivo';
  fecha_registro?: string;
}

export interface BackendServicio {
  id_servicio: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  precio_tarifa: number | string;
  url_imagen?: string | null;
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  estado: 'Activo' | 'Inactivo';
  fecha_creacion?: string;
}

export interface BackendSolicitud {
  id_solicitud: string;
  id_cliente: number;
  id_servicio: number;
  monto_servicio: number | string;
  notas_consulta?: string | null;
  estado_pago: PaymentStatus;
  numero_operacion_yape?: string | null;
  monto_pagado?: number | string | null;
  fecha_pago_validado?: string | null;
  id_asesor_asignado?: number | null;
  estado_atencion: RequestStatus;
  porcentaje_comision_aliado?: number | string | null;
  monto_comision_broker?: number | string | null;
  conclusion_cierre?: string | null;
  observaciones_asesoria?: string | null;
  resultado_asesoria?: string | null;
  url_voucher_imagen?: string | null;
  fecha_registro: string;
  fecha_cierre?: string | null;
  nombre_cliente?: string;
  dni_cliente?: string;
  correo_cliente?: string;
  telefono_cliente?: string;
  titulo_servicio?: string;
  precio_servicio?: number | string;
  id_proveedor_servicio?: number;
  nombre_proveedor?: string;
  comision_proveedor_pct?: number | string;
  nombre_asesor?: string;
  correo_asesor?: string;
}

export interface BackendCita {
  id_cita: string;
  id_solicitud: string;
  id_cliente: number;
  id_asesor: number;
  fecha_hora: string;
  modalidad: 'Virtual' | 'Presencial';
  lugar_o_enlace?: string | null;
  estado: AppointmentStatus;
  indicaciones_previas?: string | null;
  observaciones_atencion?: string | null;
  resultados_acuerdos?: string | null;
  fecha_registro?: string;
  nombre_cliente?: string;
  dni_cliente?: string;
  nombre_asesor?: string;
  titulo_servicio?: string;
}

export interface BackendCampania {
  id_campana: number;
  titulo: string;
  mensaje_promocional: string;
  publico_objetivo?: string | null;
  categoria?: string | null;
  url_imagen?: string | null;
  estado: 'Activa' | 'Inactiva' | 'Borrador';
  id_servicio?: number | null;
  id_proveedor?: number | null;
  fecha_programada?: string | null;
  fecha_creacion?: string;
  titulo_servicio?: string;
  nombre_proveedor?: string;
  nombre_creador?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = (environment as any).apiUrl || 'http://localhost:3000/api';

  // ==========================================
  // SERVICIOS FINANCIEROS (Backend MySQL)
  // ==========================================

  getPublicServices(): Observable<FinancialService[]> {
    return this.http.get<BackendServicio[]>(`${this.baseUrl}/servicios/publicos`).pipe(
      map(servicios => (servicios || []).map(s => this.mapBackendServiceToFrontend(s)))
    );
  }

  getServices(): Observable<FinancialService[]> {
    return this.http.get<BackendServicio[]>(`${this.baseUrl}/servicios`).pipe(
      map(servicios => servicios.map(s => this.mapBackendServiceToFrontend(s)))
    );
  }

  getServiceById(id: number): Observable<FinancialService> {
    return this.http.get<BackendServicio>(`${this.baseUrl}/servicios/${id}`).pipe(
      map(s => this.mapBackendServiceToFrontend(s))
    );
  }

  createService(serviceData: Partial<FinancialService>): Observable<any> {
    const payload = {
      titulo: serviceData.title,
      descripcion: serviceData.description,
      categoria: serviceData.category,
      precio_tarifa: serviceData.precio,
      url_imagen: serviceData.imageUrl || null,
      id_proveedor: serviceData.idProveedor || null,
      estado: serviceData.status || 'Activo'
    };
    return this.http.post(`${this.baseUrl}/servicios`, payload);
  }

  updateService(id: number, serviceData: Partial<FinancialService>): Observable<any> {
    const payload = {
      titulo: serviceData.title,
      descripcion: serviceData.description,
      categoria: serviceData.category,
      precio_tarifa: serviceData.precio,
      url_imagen: serviceData.imageUrl || null,
      id_proveedor: serviceData.idProveedor || null,
      estado: serviceData.status
    };
    return this.http.put(`${this.baseUrl}/servicios/${id}`, payload);
  }

  toggleServiceStatus(id: number, estado: 'Activo' | 'Inactivo'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/servicios/${id}/estado`, { estado });
  }

  deleteService(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/servicios/${id}`);
  }

  // ==========================================
  // PROVEEDORES Y ALIADOS (Backend MySQL)
  // ==========================================

  getProveedores(): Observable<Proveedor[]> {
    return this.http.get<BackendProveedor[]>(`${this.baseUrl}/proveedores`).pipe(
      map(proveedores => proveedores.map(p => this.mapBackendProveedorToFrontend(p)))
    );
  }

  getProveedorById(id: number): Observable<Proveedor> {
    return this.http.get<BackendProveedor>(`${this.baseUrl}/proveedores/${id}`).pipe(
      map(p => this.mapBackendProveedorToFrontend(p))
    );
  }

  createProveedor(proveedorData: Partial<Proveedor>): Observable<any> {
    const payload = {
      nombre_empresa: proveedorData.nombreEmpresa,
      tipo_alianza: proveedorData.tipoAlianza,
      porcentaje_comision: proveedorData.comisionPct || 0,
      contacto: proveedorData.contacto,
      estado: proveedorData.status || 'Activo'
    };
    return this.http.post(`${this.baseUrl}/proveedores`, payload);
  }

  updateProveedor(id: number, proveedorData: Partial<Proveedor>): Observable<any> {
    const payload = {
      nombre_empresa: proveedorData.nombreEmpresa,
      tipo_alianza: proveedorData.tipoAlianza,
      porcentaje_comision: proveedorData.comisionPct,
      contacto: proveedorData.contacto,
      estado: proveedorData.status
    };
    return this.http.put(`${this.baseUrl}/proveedores/${id}`, payload);
  }

  toggleProveedorStatus(id: number, estado: 'Activo' | 'Inactivo'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/proveedores/${id}/estado`, { estado });
  }

  deleteProveedor(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/proveedores/${id}`);
  }

  // ==========================================
  // CLIENTES (Backend MySQL)
  // ==========================================

  getClients(): Observable<Client[]> {
    return this.http.get<BackendCliente[]>(`${this.baseUrl}/clientes`).pipe(
      map(clientes => clientes.map(c => this.mapBackendClientToFrontend(c)))
    );
  }

  getClientById(id: number): Observable<Client> {
    return this.http.get<BackendCliente>(`${this.baseUrl}/clientes/${id}`).pipe(
      map(c => this.mapBackendClientToFrontend(c))
    );
  }

  createClient(clientData: Partial<Client>): Observable<any> {
    const payload = {
      dni: clientData.dni,
      nombre_completo: clientData.name,
      correo_electronico: clientData.email,
      telefono: clientData.phone,
      direccion: clientData.address,
      id_asesor_preferente: clientData.assignedAdvisorId || null,
      estado: clientData.status || 'Activo'
    };
    return this.http.post(`${this.baseUrl}/clientes`, payload);
  }

  updateClient(id: number, clientData: Partial<Client>): Observable<any> {
    const payload = {
      dni: clientData.dni,
      nombre_completo: clientData.name,
      correo_electronico: clientData.email,
      telefono: clientData.phone,
      direccion: clientData.address,
      id_asesor_preferente: clientData.assignedAdvisorId || null,
      estado: clientData.status
    };
    return this.http.put(`${this.baseUrl}/clientes/${id}`, payload);
  }

  assignAdvisorToClient(clientId: number, advisorId: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/clientes/${clientId}/asesor`, { id_asesor: advisorId });
  }

  toggleClientStatus(id: number, estado: 'Activo' | 'Inactivo'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/clientes/${id}/estado`, { estado });
  }

  deleteClient(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clientes/${id}`);
  }

  // ==========================================
  // SOLICITUDES DE ASESORÍA (Backend MySQL)
  // ==========================================

  getRequests(): Observable<AdvisoryRequest[]> {
    return this.http.get<BackendSolicitud[]>(`${this.baseUrl}/solicitudes`).pipe(
      map(solicitudes => solicitudes.map(s => this.mapBackendSolicitudToFrontend(s)))
    );
  }

  getRequestById(id: string): Observable<AdvisoryRequest> {
    return this.http.get<BackendSolicitud>(`${this.baseUrl}/solicitudes/${id}`).pipe(
      map(s => this.mapBackendSolicitudToFrontend(s))
    );
  }

  createRequest(requestData: Partial<AdvisoryRequest>): Observable<any> {
    const payload = {
      id_solicitud: requestData.id || undefined,
      clientDni: requestData.clientDni,
      clientName: requestData.clientName,
      clientEmail: requestData.clientEmail,
      clientPhone: requestData.clientPhone,
      serviceId: Number(requestData.serviceId),
      id_servicio: Number(requestData.serviceId),
      monto_servicio: Number(requestData.servicePrecio) || 0,
      notes: requestData.notes,
      estado_pago: requestData.estadoPago || 'Pendiente',
      numero_operacion_yape: requestData.numeroOperacionYape,
      monto_pagado: Number(requestData.montoPagado) || Number(requestData.servicePrecio) || 0,
      assignedAdvisorId: requestData.assignedAdvisorId,
      url_voucher_imagen: requestData.urlVoucherImagen
    };
    return this.http.post(`${this.baseUrl}/solicitudes`, payload);
  }

  updateRequest(id: string, requestData: Partial<AdvisoryRequest>): Observable<any> {
    return this.http.put(`${this.baseUrl}/solicitudes/${id}`, requestData);
  }

  assignAdvisorToRequest(requestId: string, advisorId: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/asignar-asesor`, { id_asesor: advisorId });
  }

  updateRequestStatus(requestId: string, status: RequestStatus): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/estado`, { status });
  }

  logAdvisorySession(requestId: string, notes: string, outcome: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/sesion-asesoria`, {
      advisoryNotes: notes,
      advisoryOutcome: outcome
    });
  }

  closeRequest(requestId: string, closureNotes: string, targetStatus: RequestStatus = 'Finalizada'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/cerrar`, {
      closureNotes,
      status: targetStatus
    });
  }

  validatePayment(requestId: string, data?: { monto_pagado?: number; numero_operacion_yape?: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/validar-pago`, {
      estado_pago: 'Pagado',
      monto_pagado: data?.monto_pagado,
      numero_operacion_yape: data?.numero_operacion_yape
    });
  }

  rejectPayment(requestId: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/solicitudes/${requestId}/validar-pago`, {
      estado_pago: 'Rechazado'
    });
  }

  deleteRequest(requestId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/solicitudes/${requestId}`);
  }

  // ==========================================
  // CITAS DE ASESORÍA (Backend MySQL)
  // ==========================================

  getAppointments(): Observable<Appointment[]> {
    return this.http.get<BackendCita[]>(`${this.baseUrl}/citas`).pipe(
      map(citas => citas.map(c => this.mapBackendCitaToFrontend(c)))
    );
  }

  getAppointmentById(id: string): Observable<Appointment> {
    return this.http.get<BackendCita>(`${this.baseUrl}/citas/${id}`).pipe(
      map(c => this.mapBackendCitaToFrontend(c))
    );
  }

  createAppointment(appointmentData: Partial<Appointment>): Observable<any> {
    const payload = {
      id_cita: appointmentData.id,
      id_solicitud: appointmentData.requestId,
      dateTime: appointmentData.dateTime,
      modality: appointmentData.modality || 'Virtual',
      locationOrLink: appointmentData.locationOrLink,
      notes: appointmentData.notes,
      estado: appointmentData.status || 'Programada'
    };
    return this.http.post(`${this.baseUrl}/citas`, payload);
  }

  updateAppointment(id: string, appointmentData: Partial<Appointment>): Observable<any> {
    const payload = {
      dateTime: appointmentData.dateTime,
      modality: appointmentData.modality,
      locationOrLink: appointmentData.locationOrLink,
      notes: appointmentData.notes,
      estado: appointmentData.status
    };
    return this.http.put(`${this.baseUrl}/citas/${id}`, payload);
  }

  updateAppointmentStatus(id: string, status: AppointmentStatus): Observable<any> {
    return this.http.patch(`${this.baseUrl}/citas/${id}/estado`, { status });
  }

  logAppointmentAttention(id: string, notes: string, outcome?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/citas/${id}/atencion`, {
      observaciones_atencion: notes,
      resultados_acuerdos: outcome
    });
  }

  deleteAppointment(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/citas/${id}`);
  }

  // ==========================================
  // CAMPAÑAS DE MARKETING (Backend MySQL)
  // ==========================================

  getCampaigns(): Observable<MarketingCampaign[]> {
    return this.http.get<BackendCampania[]>(`${this.baseUrl}/campanias`).pipe(
      map(campanias => campanias.map(c => this.mapBackendCampaniaToFrontend(c)))
    );
  }

  getCampaignById(id: number): Observable<MarketingCampaign> {
    return this.http.get<BackendCampania>(`${this.baseUrl}/campanias/${id}`).pipe(
      map(c => this.mapBackendCampaniaToFrontend(c))
    );
  }

  createCampaign(campaignData: Partial<MarketingCampaign>): Observable<any> {
    const payload = {
      titulo: campaignData.title,
      mensaje_promocional: campaignData.message,
      url_imagen: campaignData.imageUrl || null,
      id_servicio: campaignData.targetServiceId || null,
      id_proveedor: campaignData.targetProveedorId || null,
      estado: campaignData.status || 'Activa'
    };
    return this.http.post(`${this.baseUrl}/campanias`, payload);
  }

  updateCampaign(id: number, campaignData: Partial<MarketingCampaign>): Observable<any> {
    const payload = {
      titulo: campaignData.title,
      mensaje_promocional: campaignData.message,
      url_imagen: campaignData.imageUrl,
      id_servicio: campaignData.targetServiceId || null,
      id_proveedor: campaignData.targetProveedorId || null,
      estado: campaignData.status
    };
    return this.http.put(`${this.baseUrl}/campanias/${id}`, payload);
  }

  toggleCampaignStatus(id: number, estado: 'Activa' | 'Inactiva'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/campanias/${id}/estado`, { estado });
  }

  deleteCampaign(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/campanias/${id}`);
  }

  // ==========================================
  // 8. REPORTES Y ANALÍTICA (Backend MySQL)
  // ==========================================

  getReportsDashboard(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/dashboard`, { params });
  }

  getComisionesReport(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/comisiones`, { params });
  }

  getGananciasHistoricas(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/ganancias`, { params });
  }

  getServiciosRendimiento(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/servicios`, { params });
  }

  getAsesoresDesempeno(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/asesores`, { params });
  }

  getCampaniasReport(params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reportes/campanias`, { params });
  }

  // ==========================================
  // USUARIOS DEL SISTEMA (Backend MySQL)
  // ==========================================

  getUsers(): Observable<SystemUser[]> {
    return this.http.get<BackendUsuario[]>(`${this.baseUrl}/usuarios`).pipe(
      map(usuarios => usuarios.map(u => this.mapBackendUserToFrontend(u)))
    );
  }

  getUserById(id: number): Observable<SystemUser> {
    return this.http.get<BackendUsuario>(`${this.baseUrl}/usuarios/${id}`).pipe(
      map(u => this.mapBackendUserToFrontend(u))
    );
  }

  createUser(userData: Partial<SystemUser> & { contrasena?: string; phone?: string; telefono?: string }): Observable<any> {
    const payload = {
      dni: userData.dni,
      nombre_completo: userData.name,
      correo_electronico: userData.email,
      telefono: userData.phone || userData.telefono || null,
      id_rol: userData.role === 'Administrador' ? 1 : userData.role === 'Asesor' ? 2 : 3,
      estado: userData.status || 'Activo',
      contrasena: userData.contrasena || 'password123'
    };
    return this.http.post(`${this.baseUrl}/usuarios`, payload);
  }

  updateUser(id: number, userData: Partial<SystemUser> & { contrasena?: string; phone?: string; telefono?: string }): Observable<any> {
    const payload = {
      dni: userData.dni,
      nombre_completo: userData.name,
      correo_electronico: userData.email,
      telefono: userData.phone || userData.telefono || null,
      id_rol: userData.role === 'Administrador' ? 1 : userData.role === 'Asesor' ? 2 : 3,
      estado: userData.status,
      contrasena: userData.contrasena || undefined
    };
    return this.http.put(`${this.baseUrl}/usuarios/${id}`, payload);
  }

  toggleUserStatus(id: number, estado: 'Activo' | 'Inactivo'): Observable<any> {
    return this.http.patch(`${this.baseUrl}/usuarios/${id}/estado`, { estado });
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/usuarios/${id}`);
  }

  // ==========================================
  // MAPPER HELPERS
  // ==========================================

  private mapBackendServiceToFrontend(bs: BackendServicio): FinancialService {
    return {
      id: bs.id_servicio,
      title: bs.titulo,
      description: bs.descripcion || '',
      precio: Number(bs.precio_tarifa) || 0,
      idProveedor: bs.id_proveedor || undefined,
      proveedorNombre: bs.nombre_proveedor || undefined,
      imageUrl: bs.url_imagen || 'assets/images/afp.jpg',
      category: bs.categoria || 'Financiero',
      status: bs.estado || 'Activo'
    };
  }

  private mapBackendProveedorToFrontend(bp: BackendProveedor): Proveedor {
    const contactoInfo = [bp.contacto_nombre, bp.contacto_email, bp.contacto_telefono]
      .filter(Boolean)
      .join(' | ') || 'Sin información de contacto';

    return {
      id: bp.id_proveedor,
      nombreEmpresa: bp.nombre_empresa,
      tipoAlianza: bp.tipo_alianza,
      contacto: contactoInfo,
      comisionPct: Number(bp.porcentaje_comision) || 0,
      status: bp.estado || 'Activo'
    };
  }

  private mapBackendClientToFrontend(backendClient: BackendCliente): Client {
    return {
      id: backendClient.id_cliente,
      dni: backendClient.dni,
      name: backendClient.nombre_completo,
      email: backendClient.correo_electronico,
      phone: backendClient.telefono || '',
      address: backendClient.direccion || '',
      status: backendClient.estado,
      assignedAdvisorId: backendClient.id_asesor_preferente || undefined,
      assignedAdvisorName: backendClient.nombre_asesor || undefined
    };
  }

  private mapBackendSolicitudToFrontend(sol: BackendSolicitud): AdvisoryRequest {
    const rawDate = sol.fecha_registro || new Date().toISOString();
    const formattedDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(' ')[0];

    return {
      id: sol.id_solicitud,
      clientDni: sol.dni_cliente || '',
      clientName: sol.nombre_cliente || '',
      clientEmail: sol.correo_cliente || '',
      clientPhone: sol.telefono_cliente || '',
      serviceId: sol.id_servicio,
      serviceTitle: sol.titulo_servicio || 'Servicio Financiero',
      servicePrecio: Number(sol.monto_servicio || sol.precio_servicio) || 0,
      montoPagado: sol.monto_pagado !== null && sol.monto_pagado !== undefined ? Number(sol.monto_pagado) : undefined,
      idProveedor: sol.id_proveedor_servicio || undefined,
      proveedorNombre: sol.nombre_proveedor || undefined,
      comisionAliadoPct: sol.porcentaje_comision_aliado !== null ? Number(sol.porcentaje_comision_aliado) : (Number(sol.comision_proveedor_pct) || 0),
      montoComisionBroker: sol.monto_comision_broker !== null ? Number(sol.monto_comision_broker) : 0,
      numeroOperacionYape: sol.numero_operacion_yape || undefined,
      urlVoucherImagen: sol.url_voucher_imagen || undefined,
      estadoPago: sol.estado_pago || 'Pendiente',
      date: formattedDate,
      assignedAdvisorId: sol.id_asesor_asignado || undefined,
      assignedAdvisorName: sol.nombre_asesor || undefined,
      status: sol.estado_atencion || 'Nueva',
      notes: sol.notas_consulta || undefined,
      advisoryNotes: sol.observaciones_asesoria || undefined,
      advisoryOutcome: sol.resultado_asesoria || undefined,
      closureNotes: sol.conclusion_cierre || undefined
    };
  }

  private mapBackendCitaToFrontend(bc: BackendCita): Appointment {
    let formattedDateTime = bc.fecha_hora;
    if (bc.fecha_hora && bc.fecha_hora.includes('T')) {
      const [datePart, timePart] = bc.fecha_hora.split('T');
      formattedDateTime = `${datePart} ${timePart.substring(0, 5)}`;
    }

    return {
      id: bc.id_cita,
      requestId: bc.id_solicitud,
      clientId: bc.id_cliente,
      clientName: bc.nombre_cliente || 'Cliente',
      advisorId: bc.id_asesor,
      advisorName: bc.nombre_asesor || 'Asesor Asignado',
      dateTime: formattedDateTime,
      modality: bc.modalidad || 'Virtual',
      locationOrLink: bc.lugar_o_enlace || 'https://meet.google.com/finnova-asesoria',
      status: bc.estado || 'Programada',
      notes: bc.indicaciones_previas || undefined,
      attentionNotes: bc.observaciones_atencion || undefined,
      advisoryOutcome: bc.resultados_acuerdos || undefined
    };
  }

  private mapBackendCampaniaToFrontend(bc: BackendCampania): MarketingCampaign {
    return {
      id: bc.id_campana,
      title: bc.titulo,
      message: bc.mensaje_promocional,
      imageUrl: bc.url_imagen || 'assets/images/afp.jpg',
      targetServiceId: bc.id_servicio || null,
      targetServiceName: bc.titulo_servicio || (bc.id_servicio ? `Servicio #${bc.id_servicio}` : undefined),
      targetProveedorId: bc.id_proveedor || null,
      targetProveedorName: bc.nombre_proveedor || (bc.id_proveedor ? `Aliado #${bc.id_proveedor}` : undefined),
      status: bc.estado === 'Inactiva' || bc.estado === 'Borrador' ? 'Inactiva' : 'Activa',
      createdAt: bc.fecha_creacion ? bc.fecha_creacion.split('T')[0] : new Date().toISOString().split('T')[0]
    };
  }

  private mapBackendUserToFrontend(bu: BackendUsuario): SystemUser {
    return {
      id: bu.id_usuario,
      dni: bu.dni,
      name: bu.nombre_completo,
      email: bu.correo_electronico,
      phone: bu.telefono || '',
      role: (bu.nombre_rol as UserRole) || (bu.id_rol === 1 ? 'Administrador' : bu.id_rol === 2 ? 'Asesor' : 'Cliente'),
      status: bu.estado || 'Activo',
      createdAt: bu.fecha_registro ? (bu.fecha_registro.includes('T') ? bu.fecha_registro.split('T')[0] : bu.fecha_registro.split(' ')[0]) : new Date().toISOString().split('T')[0]
    };
  }
}
