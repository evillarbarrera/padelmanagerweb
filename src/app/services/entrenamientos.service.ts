import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EntrenamientoService {
  private apiUrl = environment.apiUrl;
  private token = btoa('1|padel_academy');

  private headers = new HttpHeaders({
    'Authorization': `Bearer ${this.token}`,
    'Content-Type': 'application/json'
  });

  constructor(private http: HttpClient) { }

  getDisponibilidad(entrenadorId: number, clubId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/disponibilidad/get.php?entrenador_id=${entrenadorId}&club_id=${clubId}`,
      { headers: this.headers }
    );
  }

  addDisponibilidad(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/add.php`, data, {
      headers: this.headers
    });
  }

  crearReserva(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/reservas.php`, payload, {
      headers: this.headers
    });
  }

  syncDisponibilidad(payload: { crear: any[]; eliminar: any[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/sync.php`, payload, {
      headers: this.headers
    });
  }

  getDisponibilidadEntrenador(entrenadorId: number, packId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/entrenador/get_disponibilidad.php?entrenador_id=${entrenadorId}`;
    if (packId) {
      url += `&pack_id=${packId}`;
    }
    return this.http.get<any[]>(url, { headers: this.headers });
  }

  getEntrenadorPorJugador(jugadorId: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/alumno/get_pack.php?jugador_id=${jugadorId}&t=${new Date().getTime()}`,
      { headers: this.headers }
    );
  }

  getAgenda(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/entrenador/get_agenda.php?entrenador_id=${entrenadorId}`,
      { headers: this.headers }
    );
  }

  getReservasEntrenador(entrenadorId: number): Observable<any> {
    return this.getAgenda(entrenadorId);
  }

  getMisAlumnos(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/entrenador/get_mis_alumnos.php?entrenador_id=${entrenadorId}`,
      { headers: this.headers }
    );
  }

  preReservar(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/pre_reserva.php`, payload, {
      headers: this.headers
    });
  }

  initTransaction(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/init_transaction.php`, payload, {
      headers: this.headers
    });
  }

  getDefaultConfig(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/disponibilidad/get_config.php?entrenador_id=${entrenadorId}`, {
      headers: this.headers
    });
  }

  saveDefaultConfig(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/save_config.php`, payload, {
      headers: this.headers
    });
  }

  applyDefaultConfig(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/disponibilidad/apply_config.php`, payload, {
      headers: this.headers
    });
  }
}
