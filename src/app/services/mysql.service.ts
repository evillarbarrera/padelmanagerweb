import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MysqlService {
  private apiUrl = environment.apiUrl;
  private getHeaders(isMultipart: boolean = false): HttpHeaders {
    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    const headers: any = {
      'Authorization': authValue,
      'X-Authorization': authValue
    };
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    return new HttpHeaders(headers);
  }

  constructor(private http: HttpClient) { }

  getPerfil(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/get_perfil.php?user_id=${usuarioId}`, {
      headers: this.getHeaders()
    });
  }

  updatePerfil(usuarioId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/update_perfil.php`, {
      user_id: usuarioId,
      ...data
    }, { headers: this.getHeaders() });
  }

  getHomeStats(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/get_home_stats.php?jugador_id=${usuarioId}`, {
      headers: this.getHeaders()
    });
  }

  checkPendientesEntrenador(jugadorId: number, entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/check_pendientes_entrenador.php?jugador_id=${jugadorId}&entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  getEntrenadorStats(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entrenador/get_agenda.php?entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  getDashboardStats(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entrenador/get_dashboard_stats.php?entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  getEstadisticasEntrenador(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entrenador/get_packs_grupales.php?entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  getReservasJugador(usuarioId: number, entrenadorId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/alumno/get_reservas.php?jugador_id=${usuarioId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  cancelarReserva(reservaId: number, jugadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/cancelar_reserva.php`, {
      reserva_id: reservaId,
      jugador_id: jugadorId
    }, { headers: this.getHeaders() });
  }

  cancelarInscripcionGrupal(inscripcionId: number, jugadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/cancelar_inscripcion_grupal.php`, {
      inscripcion_id: inscripcionId,
      jugador_id: jugadorId
    }, { headers: this.getHeaders() });
  }

  cancelarReservaEntrenador(reservaId: number, entrenadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/cancelar_reserva.php`, {
      reserva_id: reservaId,
      entrenador_id: entrenadorId
    }, { headers: this.getHeaders() });
  }

  subirFoto(usuarioId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('user_id', usuarioId.toString());
    formData.append('foto', file);

    return this.http.post(`${this.apiUrl}/user/subir_foto.php`, formData, {
      headers: this.getHeaders(true)
    });
  }

  getPacks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/packs/get_packs.php`, {
      headers: this.getHeaders()
    });
  }

  getEntrenadores(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user/get_users.php?rol=entrenador`, {
      headers: this.getHeaders()
    });
  }

  getAllPacks(entrenadorId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/packs/get_all_packs.php`;
    if (entrenadorId) {
      url += `?entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  searchAlumnos(term: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/user/get_users.php?rol=jugador&search=${term}&limit=10`,
      { headers: this.getHeaders() }
    );
  }

  getMisPacksAlumno(jugadorId: number, entrenadorId?: number): Observable<any> {
    let url = `${this.apiUrl}/alumno/get_mis_packs_alumno.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getMallaById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/mallas/get_mallas.php?id=${id}`, { headers: this.getHeaders() });
  }

  postApi(endpoint: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${endpoint}`, data, {
      headers: this.getHeaders()
    });
  }
}
