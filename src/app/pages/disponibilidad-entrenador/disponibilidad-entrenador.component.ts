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
  ocupado: boolean; // Reserved by student
  lockedByOtherClub?: boolean;
  club_id?: number | null;
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

  clubes: any[] = [];
  selectedClubId: number = 1;
  dias: DiaSemana[] = [];
  diaSeleccionado: string = '';
  bloquesPorDia: { [fecha: string]: BloqueHorario[] } = {};

  // Cache of existing availability keys "YYYY-MM-DD HH:MM:00-YYYY-MM-DD HH:MM:00" -> club_id
  disponibilidadExistente: Map<string, number> = new Map();
  hasSlotsWithoutClub = false;

  // Default Week Config
  showDefaultModal = false;
  diasSemana = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' },
    { id: 0, name: 'Domingo' }
  ];
  templateBlocks: { [dayId: number]: { time: string, selected: boolean }[] } = {};
  selectedDayTemplate: number = 1; // Default Lunes

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
    this.cargarClubes();

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

    const TOTAL_DIAS = 30;
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    this.dias = [];

    for (let i = 0; i < TOTAL_DIAS; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);

      this.dias.push({
        nombre: nombresDias[fecha.getDay()],
        fecha: this.getLocalISODate(fecha),
        hora_inicio: '07:00',
        hora_fin: '21:00',
        duracion: 60
      });
    }
    this.diaSeleccionado = this.dias[0].fecha;
  }

  getLocalISODate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
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
      const savedClubId = this.disponibilidadExistente.get(key);
      const isThisClub = savedClubId === Number(this.selectedClubId);
      const isOtherClub = savedClubId && savedClubId !== Number(this.selectedClubId);

      bloques.push({
        fecha,
        hora_inicio: this.formatTime(inicio).slice(0, 5), // "HH:MM"
        hora_fin: this.formatTime(finBloque).slice(0, 5),
        seleccionado: isThisClub || false,
        ocupado: false,
        lockedByOtherClub: isOtherClub || false,
        club_id: savedClubId
      });

      inicio = finBloque;
    }
    return bloques;
  }

  /* =============================
     DATA LOADING
  ============================== */

  cargarClubes(): void {
    this.entrenamientoService.getClubes().subscribe({
      next: (res) => {
        this.clubes = res;
        if (res.length > 0 && !this.selectedClubId) {
          this.selectedClubId = res[0].id;
        }
      }
    });
  }

  onClubChange(): void {
    this.cargarDisponibilidadExistente();
  }

  cargarDisponibilidadExistente() {
    this.isLoading = true;
    if (!this.userId) return;
    this.hasSlotsWithoutClub = false;
    this.disponibilidadExistente.clear();

    this.entrenamientoService.getDisponibilidad(this.userId).subscribe({
      next: (data: any[]) => {
        data.forEach(d => {
          const key = `${d.fecha_inicio}-${d.fecha_fin}`;
          this.disponibilidadExistente.set(key, Number(d.club_id));

          if (!d.club_id || d.club_id === 0) {
            this.hasSlotsWithoutClub = true;
          }
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
    if (b.ocupado || b.lockedByOtherClub) return;
    b.seleccionado = !b.seleccionado;
  }

  seleccionarTodos() {
    const bloques = this.bloquesPorDia[this.diaSeleccionado];
    if (bloques) {
      bloques.forEach(b => {
        if (!b.ocupado && !b.lockedByOtherClub) b.seleccionado = true;
      });
    }
  }

  deseleccionarTodos() {
    const bloques = this.bloquesPorDia[this.diaSeleccionado];
    if (bloques) {
      bloques.forEach(b => {
        if (!b.ocupado && !b.lockedByOtherClub) b.seleccionado = false;
      });
    }
  }

  get todosSeleccionados(): boolean {
    const bloques = this.bloquesPorDia[this.diaSeleccionado];
    if (!bloques) return false;
    return bloques.every(b => b.seleccionado || b.ocupado || b.lockedByOtherClub);
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
        const existiaId = this.disponibilidadExistente.get(key);
        const existia = existiaId === Number(this.selectedClubId);

        if (b.seleccionado && !existia) {
          crear.push({
            profesor_id: this.userId,
            fecha_inicio: `${b.fecha} ${b.hora_inicio}:00`,
            fecha_fin: `${b.fecha} ${b.hora_fin}:00`,
            club_id: this.selectedClubId
          });
        }

        if (!b.seleccionado && existia) {
          eliminar.push({
            profesor_id: this.userId,
            fecha_inicio: `${b.fecha} ${b.hora_inicio}:00`,
            fecha_fin: `${b.fecha} ${b.hora_fin}:00`,
            club_id: this.selectedClubId
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
        this.hasSlotsWithoutClub = false;
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

  migrateSlots() {
    this.popupService.confirm('Vincular Horarios', 'Tienes horarios guardados que no están asociados a ningún club. ¿Deseas vincularlos todos al club seleccionado actualmente?')
      .then(conf => {
        if (conf) {
          this.isLoading = true;
          this.entrenamientoService.migrateAvailability(this.userId!, this.selectedClubId).subscribe({
            next: (res: any) => {
              this.popupService.success('Éxito', res.message || 'Horarios vinculados correctamente');
              this.cargarDisponibilidadExistente();
            },
            error: () => {
              this.isLoading = false;
              this.popupService.error('Error', 'No se pudieron vincular los horarios');
            }
          });
        }
      });
  }

  /* =============================
     DEFAULT WEEK CONFIG
  ============================== */

  openDefaultModal() {
    this.isLoading = true;
    this.initTemplateBlocks();
    this.entrenamientoService.getDefaultConfig(this.userId!).subscribe({
      next: (res) => {
        // Expand ranges to blocks
        res.forEach(range => {
          const dayId = range.dia_semana;
          const start = range.hora_inicio;
          const end = range.hora_fin;

          if (this.templateBlocks[dayId]) {
            this.templateBlocks[dayId].forEach(b => {
              if (b.time >= start && b.time < end) {
                b.selected = true;
              }
            });
          }
        });
        this.showDefaultModal = true;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudo cargar la configuración');
      }
    });
  }

  initTemplateBlocks() {
    this.templateBlocks = {};
    const horas: string[] = [];
    for (let h = 7; h <= 22; h++) {
      const hh = h < 10 ? '0' + h : h;
      horas.push(`${hh}:00`);
      // Si quieres bloques de 30 min, podrías añadir `${hh}:30` aquí
    }

    this.diasSemana.forEach(d => {
      this.templateBlocks[d.id] = horas.map(h => ({ time: h, selected: false }));
    });
  }

  toggleTemplateBlock(dayId: number, block: any) {
    block.selected = !block.selected;
  }

  seleccionarTodoDiaTemplate(dayId: number) {
    this.templateBlocks[dayId].forEach(b => b.selected = true);
  }

  deseleccionarTodoDiaTemplate(dayId: number) {
    this.templateBlocks[dayId].forEach(b => b.selected = false);
  }

  async saveDefaultConfig() {
    this.isLoading = true;
    const config: any[] = [];

    // Compress selected blocks back to ranges
    Object.keys(this.templateBlocks).forEach(dayKey => {
      const dayId = parseInt(dayKey);
      const blocks = this.templateBlocks[dayId];

      let currentRange: any = null;

      blocks.forEach((b, idx) => {
        if (b.selected) {
          if (!currentRange) {
            currentRange = {
              dia_semana: dayId,
              hora_inicio: b.time,
              duracion_bloque: 60
            };
          }
        } else {
          if (currentRange) {
            currentRange.hora_fin = b.time;
            config.push(currentRange);
            currentRange = null;
          }
        }

        // Si es el último bloque y está seleccionado
        if (idx === blocks.length - 1 && currentRange) {
          // Asumimos fin a la hora siguiente del último bloque
          const lastH = parseInt(b.time.split(':')[0]);
          currentRange.hora_fin = (lastH + 1 < 10 ? '0' : '') + (lastH + 1) + ':00';
          config.push(currentRange);
        }
      });
    });

    const payload = {
      entrenador_id: this.userId,
      config: config
    };

    this.entrenamientoService.saveDefaultConfig(payload).subscribe({
      next: () => {
        this.popupService.success('Éxito', 'Plantilla semanal guardada');
        this.showDefaultModal = false;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudo guardar la configuración');
      }
    });
  }

  applyDefaultConfig() {
    this.isLoading = true;
    // Primero verificamos si hay algo configurado
    this.entrenamientoService.getDefaultConfig(this.userId!).subscribe({
      next: (res) => {
        if (res.length === 0) {
          this.isLoading = false;
          this.popupService.info('Sin Plantilla', 'Primero debes configurar y guardar tu semana por defecto.');
          return;
        }

        this.popupService.confirm('Aplicar Plantilla', 'Esto generará automáticamente tus bloques de disponibilidad para los próximos 30 días. ¿Continuar?')
          .then(conf => {
            if (conf) {
              this.entrenamientoService.applyDefaultConfig({ entrenador_id: this.userId, days_ahead: 30 }).subscribe({
                next: () => {
                  this.popupService.success('Completado', 'Horarios aplicados para los próximos 30 días.');
                  this.disponibilidadExistente.clear();
                  this.cargarDisponibilidadExistente();
                },
                error: () => {
                  this.isLoading = false;
                  this.popupService.error('Error', 'No se pudo aplicar la plantilla');
                }
              });
            } else {
              this.isLoading = false;
            }
          });
      },
      error: () => {
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
