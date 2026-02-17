import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
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
    localStorage.setItem('userRole', user.rol || 'jugador');

    if (user.perfiles && user.perfiles.length > 0) {
      localStorage.setItem('availableProfiles', JSON.stringify(user.perfiles));
    }

    this.currentUserSubject.next(user);
  }

  getProfiles(): any[] {
    const p = localStorage.getItem('availableProfiles');
    return p ? JSON.parse(p) : [];
  }

  switchProfile(perfil: any): void {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) return;

    const updatedUser = {
      ...currentUser,
      rol: perfil.rol,
      club_id: perfil.club_id,
      club_nombre: perfil.club_nombre,
      // Keep perfiles array intact
      perfiles: this.getProfiles()
    };

    localStorage.setItem('currentUser', JSON.stringify(updatedUser)); // Update stored session
    localStorage.setItem('userRole', updatedUser.rol);
    this.currentUserSubject.next(updatedUser);

    // Force reload/navigation to apply new role permissions
    window.location.href = '/';
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  getUserRole(): string {
    return localStorage.getItem('userRole') || 'jugador';
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

  addProfile(usuario_id: number, club_id: number, rol: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/clubes/add_profile.php`, { usuario_id, club_id, rol });
  }

  refreshSession(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/refresh_session.php?user_id=${userId}`).pipe(
      tap((res: any) => {
        if (res.success && res.user) {
          const freshUser = res.user;
          const currentSession = this.currentUserSubject.value || {};

          if (freshUser.perfiles && freshUser.perfiles.length > 0) {
            localStorage.setItem('availableProfiles', JSON.stringify(freshUser.perfiles));

            const updatedUser = { ...currentSession, perfiles: freshUser.perfiles };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);
          }
        }
      })
    );
  }
}
