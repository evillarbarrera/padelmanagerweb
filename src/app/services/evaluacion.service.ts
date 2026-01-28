import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EvaluacionService {
    private apiUrl = 'http://api.lamatek.cl/evaluaciones'; // Adjust if using localhost via proxy, but direct is standard here

    // Headers typically handled by interceptors, but adding basic auth header logic if needed or relying on explicit token passing
    private token = localStorage.getItem('token') || '';

    constructor(private http: HttpClient) { }

    private getHeaders() {
        return new HttpHeaders({
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${this.token}` // Uncomment if your API enforces auth
        });
    }

    crearEvaluacion(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/create_evaluacion.php`, data, { headers: this.getHeaders() });
    }

    getEvaluaciones(jugadorId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/get_evaluaciones.php?jugador_id=${jugadorId}`, { headers: this.getHeaders() });
    }
}
