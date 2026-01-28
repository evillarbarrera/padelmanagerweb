import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://api.lamatek.cl';
  private authToken = 'Bearer ' + btoa('1|padel_academy');
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUser();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': this.authToken,
      'Content-Type': 'application/json'
    });
  }

  login(usuario: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login.php`, { usuario, password });
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register.php`, userData, {
      headers: this.getHeaders()
    });
  }

  getPerfil(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/get_perfil.php?user_id=${userId}`, {
      headers: this.getHeaders()
    });
  }

  updatePerfil(userId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update_perfil.php`, { user_id: userId, ...data }, {
      headers: this.getHeaders()
    });
  }

  getHomeStats(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/get_home_stats.php?jugador_id=${usuarioId}`, {
      headers: this.getHeaders()
    });
  }

  getReservas(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/get_reservas.php?jugador_id=${usuarioId}`, {
      headers: this.getHeaders()
    });
  }

  getDisponibilidad(entrenadorId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/disponibilidad/get.php?entrenador_id=${entrenadorId}`, {
      headers: this.getHeaders()
    });
  }

  setCurrentUser(user: any): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  loadUser(): void {
    const user = localStorage.getItem('currentUser');
    if (user) {
      this.currentUserSubject.next(JSON.parse(user));
    }
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
