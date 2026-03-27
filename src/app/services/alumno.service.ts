import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AlumnoService {
  private apiUrl = environment.apiUrl;
  private getHeaders(isMultipart: boolean = false): HttpHeaders {
    const token = localStorage.getItem('token');
    const headers: any = {
      'Authorization': token ? `Bearer ${token}` : ''
    };
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    return new HttpHeaders(headers);
  }

  constructor(private http: HttpClient) { }

  crearAlumno(data: { nombre: string, email: string, entrenador_id: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/create_alumno.php`, data, {
      headers: this.getHeaders()
    });
  }

  getAlumnos(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/alumno/get_alumno.php?entrenador_id=${entrenadorId}`,
      { headers: this.getHeaders() }
    );
  }

  getAlumno(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/alumno/get_alumno.php?entrenador_id=${entrenadorId}`,
      { headers: this.getHeaders() }
    );
  }

  getPack(jugadorId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/alumno/get_pack.php?jugador_id=${jugadorId}`,
      { headers: this.getHeaders() }
    );
  }

  insertPack(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/insert_pack.php`, data, {
      headers: this.getHeaders()
    });
  }

  initTransaction(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/init_transaction.php`, data, {
      headers: this.getHeaders()
    });
  }

  getMisPacks(jugadorId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/alumno/get_mis_packs_alumno.php?jugador_id=${jugadorId}`,
      { headers: this.getHeaders() }
    );
  }

  invitarJugador(packJugadoresId: number, emailInvitado: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/alumno/invitar_jugador_pack.php`,
      { pack_jugadores_id: packJugadoresId, email_invitado: emailInvitado },
      { headers: this.getHeaders() }
    );
  }

  uploadVideo(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/add_video.php`, formData, {
      headers: this.getHeaders(true),
      reportProgress: true,
      observe: 'events'
    });
  }

  getVideos(jugadorId: number, entrenadorId?: number): Observable<any[]> {
    let url = `${this.apiUrl}/entrenador/get_videos.php?jugador_id=${jugadorId}`;
    if (entrenadorId) {
      url += `&entrenador_id=${entrenadorId}`;
    }
    return this.http.get<any[]>(url, { headers: this.getHeaders() });
  }

  deleteVideo(videoId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/entrenador/delete_video.php`, { video_id: videoId }, {
      headers: this.getHeaders()
    });
  }
}
