import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class EvaluacionService {
    private apiUrl = `${environment.apiUrl}/evaluaciones`;

    constructor(private http: HttpClient) { }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        });
    }

    crearEvaluacion(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/create_evaluacion.php`, data, { headers: this.getHeaders() });
    }

    getEvaluaciones(jugadorId: number, entrenadorId?: number): Observable<any[]> {
        let url = `${this.apiUrl}/get_evaluaciones.php?jugador_id=${jugadorId}`;
        if (entrenadorId) {
            url += `&entrenador_id=${entrenadorId}`;
        }
        return this.http.get<any[]>(url, { headers: this.getHeaders() });
    }
}
