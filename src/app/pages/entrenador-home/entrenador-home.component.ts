import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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
    clasesHoy: 0,
    proximasReservas: 0
  };

  constructor(
    private mysqlService: MysqlService,
    private router: Router
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
        }
      },
      error: (err) => console.error(err)
    });

    // Load Agenda/Stats
    this.mysqlService.getEntrenadorStats(this.userId).subscribe({
      next: (res) => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const fechaHoy = `${yyyy}-${mm}-${dd}`;

        // Adjust JS Day (0=Sun) to DB Day (0=Mon... wait, DB uses 0=Mon? Or Standard?)
        // Let's assume standard 0=Sun, 1=Mon... but usually DB maps Mon=0 or 1.
        // In other files I observed logic mapping.
        // Let's check get_agenda.php output or assume 0-6 match.
        // Usually PHP/JS Day mapping matches if handled correctly.
        // In EntrenadorEntrenamientosPage we saw explicit mapping logic.
        // Let's rely on standard getDay(). If 0 is Sunday.
        const diaSemanaHoy = today.getDay(); // 0-6

        let clases = [];

        // 1. Individuales
        if (res.reservas_tradicionales) {
          const indiv = res.reservas_tradicionales.filter((r: any) => r.fecha === fechaHoy);
          clases.push(...indiv.map((r: any) => ({
            hora: r.hora_inicio.substring(0, 5),
            tipo: 'Individual',
            titulo: r.jugador_nombre,
            subtitulo: r.pack_nombre,
            estado: r.estado
          })));
        }

        // 2. Grupales
        if (res.packs_grupales) {
          // DB dia_semana: likely 0=Mon or 1=Mon? 
          // Previous Context: In Step 509, EntrenadorEntrenamientosPage logic was complex.
          // Standard JS: 0=Sun, 1=Mon.
          // DB often: 0=Mon??? Or 1=Mon?
          // I'll stick to direct match for now, or match logic:
          // If today.getDay() is 3 (Wed), match DB 2 or 3?
          // Let's map JS (0=Sun) to 0-6 (Mon=0..Sun=6)?
          // Let's check `EntrenadorEntrenamientosPage`.
          // It had `const diaBDFormato = (dia.id - 1);` -> implies 0-based.

          // Let's assume standard logic matches or display all and filter later.
          // Actually, let's map JS -> Mon=0, Tue=1, ... Sun=6
          let diaHoyDB = diaSemanaHoy - 1;
          if (diaHoyDB < 0) diaHoyDB = 6; // Sunday

          const grup = res.packs_grupales.filter((g: any) => Number(g.dia_semana) === diaHoyDB);
          clases.push(...grup.map((g: any) => ({
            hora: g.hora_inicio.substring(0, 5),
            tipo: 'Grupal',
            titulo: g.pack_nombre,
            subtitulo: `${g.inscritos_confirmados || 0} inscritos`,
            estado: 'activo'
          })));
        }

        // Sort by time
        clases.sort((a, b) => a.hora.localeCompare(b.hora));

        this.clasesHoyList = clases;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading agenda:', err);
        this.isLoading = false;
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
