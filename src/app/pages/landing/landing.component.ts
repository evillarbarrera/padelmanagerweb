import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { AuthService } from '../../services/auth.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  isAuthenticated = false;
  userRole: 'jugador' | 'entrenador' | null = null;
  userName = '';
  userId: number | null = null;
  isLoading = true;

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

    // Redirect to the actual home page based on role
    if (userRole === 'jugador') {
      this.router.navigate(['/jugador-home']);
    } else if (userRole === 'entrenador') {
      this.router.navigate(['/entrenador-home']);
    } else {
      this.isAuthenticated = true;
      this.userRole = userRole as 'jugador' | 'entrenador';
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    if (!this.userId) return;

    // Cargar nombre del usuario
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


        let packs = null;
        if (res && res.estadisticas && res.estadisticas.packs) {
          packs = res.estadisticas.packs;
        } else if (res && res.packs) {
          packs = res.packs;
        } else if (res && (res.pagada !== undefined || res.reservada !== undefined)) {
          packs = res;
        }

        if (packs) {
          // Try plural first (as seen in API response), fall back to singular
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
    if (this.userRole === 'jugador') {
      this.router.navigate(['/jugador-home']);
    } else {
      this.router.navigate(['/entrenador-home']);
    }
  }

  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAAgenda(): void {
    this.router.navigate(['/entrenador-calendario']);
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
