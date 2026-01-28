import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AlumnoService {
  private apiUrl = 'http://api.lamatek.cl';
  private token = btoa('1|padel_academy');

  private headers = new HttpHeaders({
    'Authorization': `Bearer ${this.token}`,
    'Content-Type': 'application/json'
  });

  constructor(private http: HttpClient) { }

  getAlumnos(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/alumno/get_alumno.php?entrenador_id=${entrenadorId}`,
      { headers: this.headers }
    );
  }

  getAlumno(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/alumno/get_alumno.php?entrenador_id=${entrenadorId}`,
      { headers: this.headers }
    );
  }

  getPack(jugadorId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/alumno/get_pack.php?jugador_id=${jugadorId}`,
      { headers: this.headers }
    );
  }

  insertPack(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/insert_pack.php`, data, {
      headers: this.headers
    });
  }

  initTransaction(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/init_transaction.php`, data, {
      headers: this.headers
    });
  }
}
