import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PacksService {
  private apiUrl = `${environment.apiUrl}/packs`;
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  constructor(private http: HttpClient) { }

  getMisPacks(entrenadorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/get_mis_packs.php?entrenador_id=${entrenadorId}`,
      { headers: this.getHeaders() }
    );
  }

  getAllPacks(lat?: number, lng?: number, radius?: number, region?: string, comuna?: string): Observable<any> {
    let params = new HttpParams();
    if (lat) params = params.set('lat', lat.toString());
    if (lng) params = params.set('lng', lng.toString());
    if (radius) params = params.set('radius', radius.toString());
    if (region) params = params.set('region', region);
    if (comuna) params = params.set('comuna', comuna);

    return this.http.get(`${this.apiUrl}/get_all_packs.php`, { headers: this.getHeaders(), params });
  }

  crearPack(pack: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create_pack.php`, pack, {
      headers: this.getHeaders()
    });
  }

  editarPack(pack: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/editar_pack.php`, pack, {
      headers: this.getHeaders()
    });
  }

  eliminarPack(packId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/eliminar_pack.php`, {
      pack_id: packId
    }, { headers: this.getHeaders() });
  }

  getInscripcionesGrupales(packId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.apiUrl}/packs/get_inscripciones_grupales.php?pack_id=${packId}`,
      { headers: this.getHeaders() }
    );
  }
}
