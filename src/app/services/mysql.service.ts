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
  private token = btoa('1|padel_academy');

  private headers = new HttpHeaders({
    'Authorization': `Bearer ${this.token}`,
    'Content-Type': 'application/json'
  });

  constructor(private http: HttpClient) { }

  getPerfil(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/get_perfil.php?user_id=${usuarioId}`, {
      headers: this.headers
    });
  }

  updatePerfil(usuarioId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/update_perfil.php`, {
      user_id: usuarioId,
      ...data
    }, { headers: this.headers });
  }

  getHomeStats(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/get_home_stats.php?jugador_id=${usuarioId}`, {
      headers: this.headers
    });
  }

  getEntrenadorStats(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entrenador/get_agenda.php?entrenador_id=${entrenadorId}`, {
      headers: this.headers
    });
  }

  getEstadisticasEntrenador(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entrenador/get_packs_grupales.php?entrenador_id=${entrenadorId}`, {
      headers: this.headers
    });
  }

  getReservasJugador(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alumno/get_reservas.php?jugador_id=${usuarioId}`, {
      headers: this.headers
    });
  }

  cancelarReserva(reservaId: number, jugadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/cancelar_reserva.php`, {
      reserva_id: reservaId,
      jugador_id: jugadorId
    }, { headers: this.headers });
  }

  cancelarInscripcionGrupal(inscripcionId: number, jugadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/cancelar_inscripcion_grupal.php`, {
      inscripcion_id: inscripcionId,
      jugador_id: jugadorId
    }, { headers: this.headers });
  }

  cancelarReservaEntrenador(reservaId: number, entrenadorId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/cancelar_reserva.php`, {
      reserva_id: reservaId,
      entrenador_id: entrenadorId
    }, { headers: this.headers });
  }

  subirFoto(usuarioId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('user_id', usuarioId.toString());
    formData.append('foto', file);

    const uploadHeaders = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`
    });

    return this.http.post(`${this.apiUrl}/user/subir_foto.php`, formData, {
      headers: uploadHeaders
    });
  }

  getPacks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/packs/get_packs.php`, {
      headers: this.headers
    });
  }
}
