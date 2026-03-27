import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PizarraService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  saveTactica(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/p_save_pizarra.php`, data, {
      headers: this.getHeaders()
    });
  }

  getTacticas(idEntrenador: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/p_get_pizarra.php?id_entrenador=${idEntrenador}`, {
      headers: this.getHeaders()
    });
  }
}
