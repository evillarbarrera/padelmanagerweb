import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { AuthService } from '../../services/auth.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit {
  isAuthenticated = false;
  userRole: 'jugador' | 'entrenador' | 'administrador_club' | null = null;
  userName = '';
  userId: number | null = null;
  isLoading = true;

  // Mock data for trainers
  trainers = [
    {
      nombre: 'Carlos Ruiz',
      especialidad: 'Técnica Avanzada y Estrategia',
      curriculum: 'Ex-jugador profesional con más de 10 años de experiencia en alta competición. Especialista en corrección biomécánica.',
      foto: 'assets/images/placeholder_avatar.png'
    },
    {
      nombre: 'Elena Martínez',
      especialidad: 'Iniciación y Menores',
      curriculum: 'Certificada por la Federación Internacional de Pádel. Experta en pedagogía deportiva y desarrollo de talentos jóvenes.',
      foto: 'assets/images/placeholder_avatar.png'
    },
    {
      nombre: 'Miguel Ángel Sos',
      especialidad: 'Preparación Física y Táctica',
      curriculum: 'Licenciado en Ciencias del Deporte. Diseña programas personalizados que combinan potencia física con inteligencia en pista.',
      foto: 'assets/images/placeholder_avatar.png'
    }
  ];

  // Datos para jugador
  alumnoStats = {
    pagadas: 0,
    reservadas: 0,
    disponibles: 0,
    proxima_clase: null as any
  };

  // Datos para entrenador
  entrenadorStats = {
    alumnos_totales: 0,
    clases_hoy: 0,
    packs_activos: 0,
    proximos_entrenamientos: [] as any[]
  };

  constructor(
    private router: Router,
    private mysqlService: MysqlService,
    private authService: AuthService,
    private entrenamientoService: EntrenamientoService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    const userRole = localStorage.getItem('userRole');

    if (!this.userId || !userRole) {
      this.isAuthenticated = false;
      this.isLoading = false;
      return;
    }

    // Redirect logic if already authenticated
    const role = (userRole as string).toLowerCase();
    if (role.includes('administrador') || role.includes('admin')) {
      // Keep on landing or redirect? For now, if they are here, we show the authenticated version or redirect
      // The HTML has a [class.not-authenticated]="!isAuthenticated"
      // But the logic below was redirecting. I'll comment out the redirect for now so we can see the landing.
      // this.router.navigate(['/admin-club']);
    }

    this.isAuthenticated = true;
    this.userRole = userRole as any;
    this.cargarDatos();
  }

  ngAfterViewInit(): void {
    if (!this.isAuthenticated) {
      setTimeout(() => {
        this.initLandingCharts();
      }, 500);
    }
  }

  initLandingCharts(): void {
    // Interactive Radar Chart for Landing
    const radarCtx = document.getElementById('landingRadarChart') as HTMLCanvasElement;
    if (radarCtx) {
      new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: ['Técnica', 'Control', 'Decisión', 'Saque', 'Volea', 'Fisico'],
          datasets: [{
            label: 'Tu Potencial',
            data: [8, 9, 7, 8, 8, 9],
            backgroundColor: 'rgba(204, 255, 0, 0.2)',
            borderColor: '#ccff00',
            pointBackgroundColor: '#111',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              suggestedMin: 0,
              suggestedMax: 10,
              grid: { color: 'rgba(255,255,255,0.1)' },
              angleLines: { color: 'rgba(255,255,255,0.1)' },
              pointLabels: { color: '#fff' }
            }
          }
        }
      });
    }

    // Line Chart for Landing
    const lineCtx = document.getElementById('landingLineChart') as HTMLCanvasElement;
    if (lineCtx) {
      new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: ['Clase 1', 'Clase 2', 'Clase 3', 'Clase 4', 'Clase 5'],
          datasets: [{
            label: 'Evolución',
            data: [4, 5, 6.5, 7.8, 9.2],
            borderColor: '#ccff00',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(204, 255, 0, 0.1)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { display: false },
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } }
          }
        }
      });
    }
  }

  cargarDatos(): void {
    if (!this.userId) return;

    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.userName = res.user.nombre || 'Usuario';
        }
      },
      error: (err) => console.error('Error cargando perfil:', err)
    });

    if (this.userRole === 'jugador') {
      this.cargarDatosAlumno();
    } else {
      this.cargarDatosEntrenador();
    }
  }

  cargarDatosAlumno(): void {
    if (!this.userId) return;
    this.mysqlService.getHomeStats(this.userId).subscribe({
      next: (res) => {
        let packs = res?.estadisticas?.packs || res?.packs || res;
        if (packs) {
          this.alumnoStats.pagadas = parseInt(packs.pagadas || packs.pagada) || 0;
          this.alumnoStats.reservadas = parseInt(packs.reservadas || packs.reservada) || 0;
          this.alumnoStats.disponibles = parseInt(packs.disponibles || packs.disponible) || 0;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando estadísticas:', err);
        this.isLoading = false;
      }
    });
  }

  cargarDatosEntrenador(): void {
    if (!this.userId) return;
    this.entrenamientoService.getAgenda(this.userId).subscribe({
      next: (res: any) => {
        if (res && Array.isArray(res)) {
          this.entrenadorStats.proximos_entrenamientos = res.slice(0, 5);
          this.entrenadorStats.clases_hoy = res.filter((e: any) => {
            const today = new Date().toDateString();
            return new Date(e.fecha).toDateString() === today;
          }).length;
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error cargando agenda:', err);
        this.isLoading = false;
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }

  irAHome(): void {
    const role = (this.userRole as string)?.toLowerCase() || '';
    if (role.includes('administrador') || role.includes('admin')) {
      this.router.navigate(['/admin-club']);
    } else if (role.includes('entrenador')) {
      this.router.navigate(['/entrenador-home']);
    } else {
      this.router.navigate(['/jugador-home']);
    }
  }

  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAAgenda(): void {
    this.router.navigate(['/entrenador-agenda']);
  }

  irAAlumnos(): void {
    this.router.navigate(['/alumnos']);
  }

  irAPacks(): void {
    this.router.navigate(['/entrenador-packs']);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUser');
    this.isAuthenticated = false;
    this.router.navigate(['/login']);
  }
}
