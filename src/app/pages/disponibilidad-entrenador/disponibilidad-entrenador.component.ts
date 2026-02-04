import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';

interface BloqueHorario {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  seleccionado: boolean;
  ocupado: boolean;
}

interface DiaSemana {
  nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
}

@Component({
  selector: 'app-disponibilidad-entrenador',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './disponibilidad-entrenador.component.html',
  styleUrls: ['./disponibilidad-entrenador.component.scss']
})
export class DisponibilidadEntrenadorComponent implements OnInit {

  userId: number | null = null;
  coachNombre = 'Entrenador';
  coachFoto: string | null = null;
  isLoading = true;

  club_id = 1;
  dias: DiaSemana[] = [];
  diaSeleccionado: string = '';
  bloquesPorDia: { [fecha: string]: BloqueHorario[] } = {};

  // Cache of existing availability keys "YYYY-MM-DD HH:MM:00-YYYY-MM-DD HH:MM:00"
  disponibilidadExistente: Set<string> = new Set();

  constructor(
    private entrenamientoService: EntrenamientoService,
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadProfile();

    this.crearSemanaDesdeHoy();
    this.generarBloquesSemana();
    this.cargarDisponibilidadExistente();
  }

  loadProfile(): void {
    if (!this.userId) return;
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.coachNombre = res.user.nombre || 'Entrenador';
          this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;
        }
      },
      error: (err: any) => console.error(err)
    });
  }

  /* =============================
     INIT & GENERATION
  ============================== */

  crearSemanaDesdeHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const TOTAL_DIAS = 10;
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    this.dias = [];

    for (let i = 0; i < TOTAL_DIAS; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);

      this.dias.push({
        nombre: nombresDias[fecha.getDay()],
        fecha: fecha.toISOString().split('T')[0],
        hora_inicio: '07:00',
        hora_fin: '21:00',
        duracion: 60
      });
    }
    this.diaSeleccionado = this.dias[0].fecha;
  }

  generarBloquesSemana() {
    this.bloquesPorDia = {};
    this.dias.forEach(dia => {
      this.bloquesPorDia[dia.fecha] = this.generarBloquesDia(
        dia.fecha,
        dia.hora_inicio,
        dia.hora_fin,
        dia.duracion
      );
    });
  }

  generarBloquesDia(fecha: string, horaInicio: string, horaFin: string, duracion: number): BloqueHorario[] {
    const bloques: BloqueHorario[] = [];
    let inicio = new Date(`${fecha}T${horaInicio}:00`);
    const fin = new Date(`${fecha}T${horaFin}:00`);

    while (inicio < fin) {
      const finBloque = new Date(inicio.getTime() + duracion * 60000);
      if (finBloque > fin) break;

      const key = `${fecha} ${this.formatTime(inicio)}-${fecha} ${this.formatTime(finBloque)}`;

      bloques.push({
        fecha,
        hora_inicio: this.formatTime(inicio).slice(0, 5), // "HH:MM"
        hora_fin: this.formatTime(finBloque).slice(0, 5),
        seleccionado: this.disponibilidadExistente.has(key),
        ocupado: false
      });

      inicio = finBloque;
    }
    return bloques;
  }

  /* =============================
     DATA LOADING
  ============================== */

  cargarDisponibilidadExistente() {
    this.isLoading = true;
    if (!this.userId) return;

    this.entrenamientoService.getDisponibilidad(this.userId, this.club_id).subscribe({
      next: (data: any[]) => {
        data.forEach(d => {
          // Format expected by generated keys: "YYYY-MM-DD HH:MM:00-YYYY-MM-DD HH:MM:00"
          const key = `${d.fecha_inicio}-${d.fecha_fin}`;
          this.disponibilidadExistente.add(key);
        });

        // Re-generate to apply selection state
        this.generarBloquesSemana();

        // Load reservations to mark occupied blocks
        this.cargarReservasExistentes();
      },
      error: (err: any) => {
        console.error('Error loading disponibilidad:', err);
        this.isLoading = false;
      }
    });
  }

  cargarReservasExistentes() {
    if (!this.userId) return;

    this.entrenamientoService.getReservasEntrenador(this.userId).subscribe({
      next: (data: any) => {
        const reservas = [
          ...(data.reservas_tradicionales || []),
          ...(data.packs_grupales || [])
        ];

        // Mark blocks as occupied if they match a reservation time
        Object.keys(this.bloquesPorDia).forEach(fecha => {
          this.bloquesPorDia[fecha].forEach(bloque => {
            const tieneReserva = reservas.some(reserva => {
              if (!reserva.fecha || !reserva.hora_inicio) return false;

              const fechaReserva = reserva.fecha;
              const horaReserva = String(reserva.hora_inicio).slice(0, 5); // "HH:MM"

              // Only block if confirmed or active (not cancelled)
              const status = reserva.estado || reserva.estado_grupo;
              if (status === 'cancelado') return false;

              return fechaReserva === fecha && horaReserva === bloque.hora_inicio;
            });

            if (tieneReserva) {
              bloque.ocupado = true;
            }
          });
        });

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading reservations:', err);
        this.isLoading = false;
      }
    });
  }

  /* =============================
     INTERACTION
  ============================== */

  toggleBloque(b: BloqueHorario) {
    if (b.ocupado) return;
    b.seleccionado = !b.seleccionado;
  }

  seleccionarTodos() {
    this.bloquesPorDia[this.diaSeleccionado].forEach(b => {
      if (!b.ocupado) b.seleccionado = true;
    });
  }

  deseleccionarTodos() {
    this.bloquesPorDia[this.diaSeleccionado].forEach(b => {
      if (!b.ocupado) b.seleccionado = false;
    });
  }

  get todosSeleccionados(): boolean {
    const bloques = this.bloquesPorDia[this.diaSeleccionado];
    if (!bloques) return false;
    return bloques.every(b => b.seleccionado || b.ocupado);
  }

  seleccionarDia(fecha: string) {
    this.diaSeleccionado = fecha;
  }

  get bloquesActuales() {
    return this.bloquesPorDia[this.diaSeleccionado] || [];
  }

  /* =============================
     SAVING
  ============================== */

  guardarDisponibilidad() {
    const crear: any[] = [];
    const eliminar: any[] = [];

    // Analyze all days
    Object.values(this.bloquesPorDia).forEach(bloques => {
      bloques.forEach(b => {
        const key = `${b.fecha} ${b.hora_inicio}:00-${b.fecha} ${b.hora_fin}:00`;
        const existia = this.disponibilidadExistente.has(key);

        if (b.seleccionado && !existia) {
          crear.push({
            profesor_id: this.userId,
            fecha_inicio: `${b.fecha} ${b.hora_inicio}:00`,
            fecha_fin: `${b.fecha} ${b.hora_fin}:00`,
            club_id: this.club_id
          });
        }

        if (!b.seleccionado && existia) {
          eliminar.push({
            profesor_id: this.userId,
            fecha_inicio: `${b.fecha} ${b.hora_inicio}:00`,
            fecha_fin: `${b.fecha} ${b.hora_fin}:00`,
            club_id: this.club_id
          });
        }
      });
    });

    if (crear.length === 0 && eliminar.length === 0) {
      this.popupService.info('Sin cambios', 'No hay cambios para guardar.');
      return;
    }

    this.isLoading = true;
    this.entrenamientoService.syncDisponibilidad({ crear, eliminar }).subscribe({
      next: () => {
        this.popupService.success('Guardado', 'Horario actualizado correctamente');

        // Refresh local state
        this.disponibilidadExistente.clear();
        this.dias = []; // Reset days to regenerate everything cleanly
        this.crearSemanaDesdeHoy();
        this.cargarDisponibilidadExistente(); // Reload fresh from DB
      },
      error: (err: any) => {
        console.error('Error syncing disponibilidad:', err);
        this.popupService.error('Error', 'No se pudieron guardar los cambios');
        this.isLoading = false;
      }
    });
  }

  /* =============================
     HELPERS
  ============================== */

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 8); // "HH:MM:SS"
  }
}
