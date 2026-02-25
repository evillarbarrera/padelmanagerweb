import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-entrenador-home',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './entrenador-home.component.html',
  styleUrls: ['./entrenador-home.component.scss']
})
export class EntrenadorHomeComponent implements OnInit {
  coachNombre = 'Entrenador';
  coachFoto: string | null = null;
  isLoading = true;
  userId: number | null = null;
  quickStats: any = {
    totalAlumnos: 0,
    clasesMes: 0,
    clasesGrupalesMes: 0,
    clasesHoy: 0
  };

  constructor(
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    const userRole = localStorage.getItem('userRole') || '';
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (user) {
      if (user.nombre) this.coachNombre = user.nombre;
      if (user.foto_perfil) this.coachFoto = user.foto_perfil;
    }

    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Redirección de seguridad
    const role = userRole.toLowerCase();
    if (role.includes('admin') || role.includes('administrador')) {
      this.router.navigate(['/admin-club']);
      return;
    } else if (role.includes('jugador') || role.includes('alumno')) {
      // Si un administrador entra aquí, o un jugador, etc.
      // Pero si somos entrenadores seguimos.
    } else if (!role.includes('entrenador')) {
      this.router.navigate(['/jugador-home']);
      return;
    }

    this.loadData();
  }

  clasesHoyList: any[] = [];
  hoyNombre: string = '';

  loadData(): void {
    if (!this.userId) return;

    // Load Profile
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.coachNombre = res.user.nombre || 'Entrenador';
          this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;

          // Address Validation
          // Check if address exists in the separate 'direccion' object
          if (!res.direccion || !res.direccion.calle) {
            this.popupService.warning(
              'Completa tu Perfil',
              'Es importante que registres tu dirección para que los jugadores puedan encontrarte fácilmente al buscar entrenamientos cercanos.'
            ).then(() => {
              this.router.navigate(['/perfil']);
            });
          }
        }
      },
      error: (err) => console.error(err)
    });

    // Load Agenda/Stats
    this.mysqlService.getEntrenadorStats(this.userId).subscribe({
      next: (res) => {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const formatDate = (date: Date) => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        const fechaHoy = formatDate(today);
        const fechaManana = formatDate(tomorrow);

        const diaSemanaHoy = today.getDay() === 0 ? 7 : today.getDay();
        const diaSemanaManana = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay();

        let clases = [];

        // 1. Individuales y Grupales con Fecha específica
        if (res.reservas_tradicionales) {
          const proximas = res.reservas_tradicionales.filter((r: any) => r.fecha === fechaHoy || r.fecha === fechaManana);
          clases.push(...proximas.map((r: any) => ({
            fecha: r.fecha,
            diaLabel: r.fecha === fechaHoy ? 'Hoy' : 'Mañana',
            hora: r.hora_inicio.substring(0, 5),
            tipo: r.tipo === 'pack_grupal' ? 'Grupal' : 'Individual',
            titulo: r.jugador_nombre || 'Clase Grupal',
            subtitulo: r.pack_nombre,
            estado: r.estado
          })));
        }

        // 2. Packs Grupales Recurrentes (solo si no hay reserva específica ya cargada para ese bloque)
        if (res.packs_grupales) {
          const grupHoy = res.packs_grupales.filter((g: any) =>
            Number(g.dia_semana) === diaSemanaHoy &&
            !clases.some(c => c.fecha === fechaHoy && c.hora === g.hora_inicio.substring(0, 5))
          );
          const grupManana = res.packs_grupales.filter((g: any) =>
            Number(g.dia_semana) === diaSemanaManana &&
            !clases.some(c => c.fecha === fechaManana && c.hora === g.hora_inicio.substring(0, 5))
          );

          clases.push(...grupHoy.map((g: any) => ({
            fecha: fechaHoy,
            diaLabel: 'Hoy',
            hora: g.hora_inicio.substring(0, 5),
            tipo: 'Grupal',
            titulo: g.pack_nombre,
            subtitulo: `${g.inscritos_confirmados || 0} inscritos`,
            estado: 'activo'
          })));

          clases.push(...grupManana.map((g: any) => ({
            fecha: fechaManana,
            diaLabel: 'Mañana',
            hora: g.hora_inicio.substring(0, 5),
            tipo: 'Grupal',
            titulo: g.pack_nombre,
            subtitulo: `${g.inscritos_confirmados || 0} inscritos`,
            estado: 'activo'
          })));
        }

        // Sort by date then time
        clases.sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
          return a.hora.localeCompare(b.hora);
        });

        this.clasesHoyList = clases;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading agenda:', err);
        this.isLoading = false;
      }
    });

    this.mysqlService.getDashboardStats(this.userId).subscribe({
      next: (res) => {
        this.quickStats = {
          totalAlumnos: res.total_alumnos || 0,
          clasesMes: res.clases_mes || 0,
          clasesGrupalesMes: res.clases_grupales_mes || 0,
          clasesHoy: res.clases_hoy || 0
        };
      }
    });
  }

  irAAlumnos(): void {
    this.router.navigate(['/alumnos']);
  }

  irACalendario(): void {
    this.router.navigate(['/entrenador-calendario']);
  }

  irAPacks(): void {
    this.router.navigate(['/entrenador-packs']);
  }

  irADisponibilidad(): void {
    this.router.navigate(['/disponibilidad-entrenador']);
  }

  irAPerfil(): void {
    this.router.navigate(['/perfil']);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }
}
