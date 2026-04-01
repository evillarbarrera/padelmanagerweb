import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {
    this.initTracking();
  }

  private initTracking() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.logVisit(event.urlAfterRedirects);
    });
  }

  private logVisit(page: string) {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole') || 'visitante';
    
    // Detectar dispositivo
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const dispositivo = isMobile ? 'Mobile' : 'PC';
    
    if (page.includes('admin-dashboard')) return;

    const payload = {
      pagina: page,
      usuario_id: userId ? Number(userId) : null,
      rol: userRole,
      dispositivo: dispositivo
    };

    this.http.post(`${this.apiUrl}/admin/log_visit.php`, payload).subscribe({
      error: (err) => console.log('Analytics Error:', err)
    });
  }
}
