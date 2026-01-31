import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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

  constructor(
    private mysqlService: MysqlService,
    private entrenamientoService: EntrenamientoService,
    private router: Router
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
      error: (err) => console.error('Error loading profile:', err)
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

      return isTrainer && hasSessions;
    });



    // Sort by fecha_compra_pack ASC (oldest first)
    this.packsDelEntrenador.sort((a, b) => {
      const dateA = new Date(a.fecha_compra_pack).getTime();
      const dateB = new Date(b.fecha_compra_pack).getTime();
      return dateA - dateB;
    });

    // Auto-select the first pack if available
    if (this.packsDelEntrenador.length > 0) {
      this.selectedPack = this.packsDelEntrenador[0];
    } else {
      this.selectedPack = null;
    }

    this.entrenamientoService.getDisponibilidadEntrenador(this.selectedEntrenador).subscribe({
      next: (res: any) => {
        this.generarBloquesHorarios(res);
      },
      error: (err: any) => console.error('Error loading availability:', err)
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

    Swal.fire({
      title: '¿Confirmar Reserva?',
      text: `Clase para el ${horario.fecha} a las ${horario.hora_inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        // Validar que exista un pack seleccionado con cupo
        // Validar que exista un pack seleccionado con cupo
        if (!this.selectedPack) {
          // Debug info for user
          const trainerId = Number(this.selectedEntrenador);
          const totalPacks = this.packs.length;
          const trainerPacks = this.packs.filter(p => p.entrenador_id == trainerId).length;
          const validPacks = this.packs.filter(p => p.entrenador_id == trainerId && p.sesiones_restantes > 0).length;

          const firstPack = this.packs.find(p => p.entrenador_id == trainerId);
          Swal.fire({
            title: 'Sin cupos disponibles',
            text: 'No tienes un pack activo con sesiones disponibles para este entrenador.',
            icon: 'error'
          });
          return;
        }

        // Proceed with booking
        const bookingPackId = this.selectedPack.pack_id;

        const payload = {
          entrenador_id: this.selectedEntrenador,
          pack_id: bookingPackId,
          // Sending pack_jugador_id might be necessary if the API supports it to debit the exact pack.
          // If not, the backend likely decrements any valid pack or the oldest one automatically?
          // The USER REQUEST says "tomar el pack mas antiguo para asociarlo a la reserva".
          // If I select it here, I should probably send its specific ID if the API allows.
          // Since I can't check `reservas.php`, I will inject `pack_jugador_id` into the payload
          // IF the service/backend accepts extra fields. It's safer to add it.
          pack_jugador_id: this.selectedPack ? this.selectedPack.pack_jugador_id : null,
          fecha: horario.fecha,
          hora_inicio: horario.hora_inicio.toTimeString().slice(0, 5),
          hora_fin: horario.hora_fin.toTimeString().slice(0, 5),
          jugador_id: this.userId,
          estado: 'reservado'
        };

        this.entrenamientoService.crearReserva(payload).subscribe({
          next: () => {
            Swal.fire({
              title: '¡Reservado!',
              text: 'Tu clase ha sido agendada con éxito.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
            this.onEntrenadorChange(); // Refresh availability
            this.router.navigate(['/jugador-calendario']); // Redirect to Calendar/My Bookings
          },
          error: (err: any) => {
            console.error('Error creating reservation:', err);
            Swal.fire({
              title: 'Error',
              text: 'Hubo un problema al crear la reserva. Inténtalo de nuevo.',
              icon: 'error'
            });
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
