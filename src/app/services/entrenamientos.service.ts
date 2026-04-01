import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EntrenamientoService {
  private apiUrl = environment.apiUrl;
  private getHeaders(isMultipart: boolean = false): HttpHeaders {
    const token = localStorage.getItem('token');
    const headers: any = {
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Authorization': token ? `Bearer ${token}` : ''
    };
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    return new HttpHeaders(headers);
  }

  constructor(private http: HttpClient) { }

  getDisponibilidad(entrenadorId: number, clubId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/disponibilidad/get.php?entrenador_id=${entrenadorId}`;
    if (clubId) url += `&club_id=${clubId}`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  addDisponibilidad(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/add.php`, data, {
      headers: this.getHeaders()
    });
  }

  crearReserva(payload: any): Observable<any> {
    // Ensure everything is a simple primitive for JSON safety
    const cleanPayload: any = {};
    Object.keys(payload).forEach(key => {
        if (payload[key] !== null && payload[key] !== undefined) {
          cleanPayload[key] = payload[key];
        }
    });

    return this.http.post(`${this.apiUrl}/disponibilidad/reservas.php`, cleanPayload, {
      headers: this.getHeaders()
    });
  }

  syncDisponibilidad(payload: { crear: any[]; eliminar: any[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/sync.php`, payload, {
      headers: this.getHeaders()
    });
  }

  getDisponibilidadEntrenador(entrenadorId: number, packId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/entrenador/get_disponibilidad.php?entrenador_id=${entrenadorId}`;
    if (packId) {
      url += `&pack_id=${packId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getEntrenadorPorJugador(jugadorId: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/alumno/get_pack.php?jugador_id=${jugadorId}&t=${new Date().getTime()}`,
      { headers: this.getHeaders() }
    );
  }

  getAgenda(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/entrenador/get_agenda.php?entrenador_id=${entrenadorId}`,
      { headers: this.getHeaders() }
    );
  }

  getReservasEntrenador(entrenadorId: number): Observable<any> {
    return this.getAgenda(entrenadorId);
  }

  getMisAlumnos(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/entrenador/get_mis_alumnos.php?entrenador_id=${entrenadorId}`,
      { headers: this.getHeaders() }
    );
  }

  preReservar(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/pre_reserva.php`, payload, {
      headers: this.getHeaders()
    });
  }

  initTransaction(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/init_transaction.php`, payload, {
      headers: this.getHeaders()
    });
  }

  getDefaultConfig(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/disponibilidad/get_config.php?entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  saveDefaultConfig(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/save_config.php`, payload, {
      headers: this.getHeaders()
    });
  }

  applyDefaultConfig(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/apply_config.php`, payload, {
      headers: this.getHeaders()
    });
  }

  getClubes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clubes/get_clubes.php`, { headers: this.getHeaders() });
  }

  migrateAvailability(entrenadorId: number, clubId: number): Observable<any> {
    const payload = { entrenador_id: entrenadorId, club_id: clubId };
    return this.http.post<any>(`${this.apiUrl}/disponibilidad/migrate_to_club.php`, payload, { headers: this.getHeaders() });
  }

  // --- CUPONES ---
  getCupones(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/entrenador/get_cupones.php?entrenador_id=${entrenadorId}`, { headers: this.getHeaders() });
  }

  saveCupon(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/entrenador/save_cupon.php`, payload, { headers: this.getHeaders() });
  }

  deleteCupon(cuponId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/entrenador/delete_cupon.php`, { id: cuponId }, { headers: this.getHeaders() });
  }

  validateCupon(codigo: string, entrenadorId: number, jugadorId: number, packId?: number): Observable<any> {
    let url = `${this.apiUrl}/packs/validate_cupon.php?codigo=${codigo}&entrenador_id=${entrenadorId}&jugador_id=${jugadorId}`;
    if (packId) url += `&pack_id=${packId}`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // --- MALLAS Y SEGUIMIENTO ---
  getMallas(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mallas/get_mallas.php?entrenador_id=${entrenadorId}`, { headers: this.getHeaders() });
  }

  getAlumnoMalla(jugadorId: number, entrenadorId?: number): Observable<any> {
    let url = `${this.apiUrl}/mallas/get_alumno_malla.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  asignarMalla(data: { jugador_id: number, malla_id: number, entrenador_id: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/mallas/asignar_malla.php`, data, { headers: this.getHeaders() });
  }

  getHistorialMalla(jugadorId: number, entrenadorId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/mallas/get_historial.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  getHistorialTotal(jugadorId: number, entrenadorId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/mallas/get_historial_total.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  saveAsistencia(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/mallas/save_asistencia.php`, data, { headers: this.getHeaders() });
  }

  // --- PACKS DEL ENTRENADOR ---
  getPacks(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alumno/get_pack.php?entrenador_id=${entrenadorId}`, { headers: this.getHeaders() });
  }

  insertPack(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/insert_pack.php`, data, { headers: this.getHeaders() });
  }

  cancelarReserva(reservaId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/cancelar_reserva.php`, { id: reservaId }, { headers: this.getHeaders() });
  }

  updateReservaTecnica(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/update_reserva_tecnica.php`, payload, {
      headers: this.getHeaders()
    });
  }

  getPacksAlumno(jugadorId: number, entrenadorId?: number): Observable<any> {
    let url = `${this.apiUrl}/alumno/get_mis_packs_alumno.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  marcarPackPagado(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/marcar_pack_pagado.php`, payload, {
      headers: this.getHeaders()
    });
  }

  enviarRecordatorioPago(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/recordar_pago.php`, payload, {
      headers: this.getHeaders()
    });
  }
}
