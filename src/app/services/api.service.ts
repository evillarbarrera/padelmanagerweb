import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUser();
  }

  private getHeaders(): HttpHeaders {
    let token = localStorage.getItem('token');
    
    // Auto-repair missing token if we have a user session
    if (!token) {
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            try {
                const currentUser = JSON.parse(currentUserStr);
                if (currentUser && currentUser.id) {
                    token = btoa(currentUser.id + '|padel_academy');
                    localStorage.setItem('token', token || '');
                }
            } catch (e) {
                console.error("Error repairing token", e);
            }
        }
    }

    const authValue = token ? `Bearer ${token}` : '';
    return new HttpHeaders({
      'Authorization': authValue,
      'X-Authorization': authValue,
      'Content-Type': 'application/json'
    });
  }

  login(usuario: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login.php`, { usuario, password });
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register.php`, userData, {
      headers: this.getHeaders()
    });
  }

  getPerfil(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/get_perfil.php?user_id=${userId}`, {
      headers: this.getHeaders()
    });
  }

  updatePerfil(userId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/update_perfil.php`, { user_id: userId, ...data }, {
      headers: this.getHeaders()
    });
  }

  getUsers(rol?: string): Observable<any> {
    let url = `${this.apiUrl}/user/get_users.php`;
    if (rol) url += `?rol=${rol}`;
    return this.http.get(url, { headers: this.getHeaders() });
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
    if (user.token) {
        localStorage.setItem('token', user.token);
    }
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userRole', user.rol || 'jugador');
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
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
