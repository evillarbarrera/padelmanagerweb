import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
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
    return this.http.post(`${this.apiUrl}/auth/login.php`, { usuario, password });
  }

  recoverPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/recover-password.php`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password.php`, { token, password });
  }

  getInvitationInfo(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/alumno/get_invitacion_info.php?token=${token}`);
  }

  aceptarInvitacion(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/alumno/aceptar_invitacion.php`, { token });
  }

  register(nombre: string, email: string, password: string, rol: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register.php`, {
      nombre,
      email,
      password,
      rol
    }, { headers: this.getHeaders() });
  }

  setCurrentUser(user: any): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userRole', user.rol || 'alumno');
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  getUserRole(): string {
    return localStorage.getItem('userRole') || 'alumno';
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
    localStorage.removeItem('userRole');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
