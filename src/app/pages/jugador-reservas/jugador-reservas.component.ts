import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-jugador-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './jugador-reservas.component.html',
  styleUrls: ['./jugador-reservas.component.scss']
})
export class JugadorReservasComponent implements OnInit {
  isLoading = false;
  userId: number | null = null;

  // Data
  entrenadores: any[] = [];
  packs: any[] = [];
  jugadorFoto: string | null = null;
  jugadorNombre: string = '';

  // Booking Data
  selectedEntrenador: number | null = null;
  selectedPack: any = null; // New: Selected Pack
  packsDelEntrenador: any[] = []; // New: Packs for the selected trainer
  horariosPorDia: { [key: string]: any[] } = {};
  dias: string[] = [];
  diaSeleccionado: string = '';
  recurrencia: number = 1;
  showCoachPicker: boolean = false; // New: for custom picker

  constructor(
    private mysqlService: MysqlService,
    private entrenamientoService: EntrenamientoService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUserProfile();
    this.loadEntrenadores();
  }

  loadUserProfile(): void {
    if (!this.userId) return;
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.jugadorNombre = res.user.nombre;
          this.jugadorFoto = res.user.foto_perfil || res.user.foto || null;
        }
      },
      error: (err: any) => console.error('Error loading profile:', err)
    });
  }

  // --- Logic for "Agendar Nueva" (Booking Only) ---

  loadEntrenadores(): void {
    if (!this.userId) return;
    this.entrenamientoService.getEntrenadorPorJugador(this.userId).subscribe({
      next: (res: any[]) => {
        this.packs = res || [];
        this.extraerEntrenadores();
      },
      error: (err: any) => console.error('Error loading trainers:', err)
    });
  }

  extraerEntrenadores(): void {
    const map = new Map();
    if (this.packs) {
      this.packs.forEach(p => {
        if (!map.has(p.entrenador_id)) {
          map.set(p.entrenador_id, {
            id: p.entrenador_id,
            nombre: p.entrenador_nombre,
            foto: p.entrenador_foto || p.foto || null // Try to find photo in response
          });
        }
      });
    }
    this.entrenadores = Array.from(map.values());
  }

  get currentCoachPhoto(): string | null {
    if (!this.selectedEntrenador) return null;
    return this.entrenadores.find(e => e.id == this.selectedEntrenador)?.foto || null;
  }

  onEntrenadorChange(): void {
    if (!this.selectedEntrenador) return;

    // Filter packs for this trainer that have remaining sessions


    this.packsDelEntrenador = this.packs.filter(p => {
      const isTrainer = Number(p.entrenador_id) === Number(this.selectedEntrenador);
      const hasSessions = Number(p.sesiones_restantes) > 0;
      // Filter out group packs (keep only individual or those with capacity <= 1)
      const isIndividual = p.tipo === 'individual' || Number(p.cantidad_personas || 1) <= 1;

      return isTrainer && hasSessions && isIndividual;
    });



    // Sort by fecha_compra_pack DESC (newest first)
    this.packsDelEntrenador.sort((a, b) => {
      const dateA = new Date(a.fecha_compra_pack).getTime();
      const dateB = new Date(b.fecha_compra_pack).getTime();
      return dateB - dateA;
    });

    // Auto-select the first pack if available
    if (this.packsDelEntrenador.length > 0) {
      this.selectedPack = this.packsDelEntrenador[0];
      console.log("Pack Seleccionado ID:", this.selectedPack.pack_id);
    } else {
      this.selectedPack = null;
    }

    const packId = this.selectedPack ? this.selectedPack.pack_id : undefined;

    this.entrenamientoService.getDisponibilidadEntrenador(this.selectedEntrenador!, packId).subscribe({
      next: (res: any) => {
        this.generarBloquesHorarios(res);
      },
      error: (err: any) => console.error('Error loading availability:', err)
    });
  }

  onPackChange(): void {
    if (!this.selectedPack || !this.selectedEntrenador) return;

    const packId = this.selectedPack.pack_id;
    console.log("Cambio de Pack - Nuevo ID:", packId);

    this.entrenamientoService.getDisponibilidadEntrenador(this.selectedEntrenador!, packId).subscribe({
      next: (res: any) => {
        this.generarBloquesHorarios(res);
      },
      error: (err: any) => console.error('Error loading availability after pack change:', err)
    });
  }

  seleccionarDia(d: string): void {

    this.diaSeleccionado = d;
  }

  generarBloquesHorarios(disponibilidades: any[]): void {
    this.horariosPorDia = {};
    this.dias = [];
    const bloquesUnicos = new Set<string>();
    const ahora = new Date();

    if (!disponibilidades) return;

    disponibilidades.forEach(d => {
      let inicio = new Date(d.fecha_inicio);
      const fin = new Date(d.fecha_fin);
      const ocupado = Boolean(d.ocupado);

      while (inicio < fin) {
        const bloqueInicio = new Date(inicio);
        const bloqueFin = new Date(inicio);
        bloqueFin.setHours(bloqueFin.getHours() + 1);

        // Filter past times
        if (bloqueInicio > ahora && bloqueFin <= fin) {
          const fecha = bloqueInicio.toISOString().split('T')[0];
          const horaInicio = bloqueInicio.toTimeString().slice(0, 5);
          const horaFin = bloqueFin.toTimeString().slice(0, 5);
          const key = `${fecha} ${horaInicio}-${horaFin}`;

          if (bloquesUnicos.has(key)) {
            inicio.setHours(inicio.getHours() + 1);
            continue;
          }
          bloquesUnicos.add(key);

          if (!this.horariosPorDia[fecha]) {
            this.horariosPorDia[fecha] = [];
            this.dias.push(fecha);
          }

          this.horariosPorDia[fecha].push({
            fecha,
            hora_inicio: bloqueInicio,
            hora_fin: bloqueFin,
            ocupado
          });
        }
        inicio.setHours(inicio.getHours() + 1);
      }
    });

    this.dias.sort();
    if (this.dias.length > 0) {
      this.diaSeleccionado = this.dias[0];
    }
  }

  reservarHorario(horario: any): void {
    if (horario.ocupado) return;

    const msgRecurrencia = this.recurrencia > 1 ? ` por ${this.recurrencia} semanas` : '';
    this.popupService.confirm(
      '¿Confirmar Reserva?',
      `Clase para el ${horario.fecha} a las ${horario.hora_inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${msgRecurrencia}`
    ).then((confirmed) => {
      if (confirmed) {
        if (!this.selectedPack) {
          this.popupService.error('Sin cupos disponibles', 'No tienes un pack activo con sesiones disponibles.');
          return;
        }

        const payload = {
          entrenador_id: this.selectedEntrenador,
          pack_id: this.selectedPack.pack_id,
          pack_jugador_id: this.selectedPack.pack_jugador_id,
          fecha: horario.fecha,
          hora_inicio: horario.hora_inicio.toTimeString().slice(0, 5),
          hora_fin: horario.hora_fin.toTimeString().slice(0, 5),
          jugador_id: this.userId,
          estado: 'reservado',
          recurrencia: this.recurrencia
        };

        this.entrenamientoService.crearReserva(payload).subscribe({
          next: () => {
            this.popupService.success('¡Reservado!', 'Tu clase ha sido agendada con éxito.').then(() => {
              this.router.navigate(['/jugador-calendario']);
            });
            this.onEntrenadorChange();
          },
          error: (err: any) => {
            console.error('Error creating reservation:', err);
            this.popupService.error('Error', 'Hubo un problema al crear la reserva.');
          }
        });
      }
    });
  }

  // Helpers
  getCoachName(id: number | null): string {
    if (!id) return '';
    return this.entrenadores.find(e => e.id === id)?.nombre || '';
  }



  // Sidebar Navigation
  irAInicio(): void { this.router.navigate(['/jugador-home']); }
  irACalendario(): void { this.router.navigate(['/jugador-calendario']); }
  irAReservas(): void { } // Self
  irAPerfil(): void { this.router.navigate(['/perfil']); }
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }
}
