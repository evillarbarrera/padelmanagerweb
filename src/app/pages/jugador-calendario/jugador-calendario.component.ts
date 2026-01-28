import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-jugador-calendario',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './jugador-calendario.component.html',
  styleUrls: ['./jugador-calendario.component.scss']
})
export class JugadorCalendarioComponent implements OnInit {
  // View State
  vistaActual: 'activas' | 'historial' = 'activas';
  isLoading = true;
  userId: number | null = null;

  // Pagination
  itemsPerPage = 8;
  currentPage = 1;

  // User Data
  jugadorNombre: string = 'Jugador';
  jugadorFoto: string | null = null;

  // Data
  reservasFuturas: any[] = [];
  reservasPasadas: any[] = [];

  constructor(
    private mysqlService: MysqlService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUserProfile();
    this.loadReservas();
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

  cambiarVista(vista: 'activas' | 'historial'): void {
    this.vistaActual = vista;
    this.currentPage = 1;
  }

  get paginatedReservas(): any[] {
    const source = this.vistaActual === 'activas' ? this.reservasFuturas : this.reservasPasadas;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return source.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    const source = this.vistaActual === 'activas' ? this.reservasFuturas : this.reservasPasadas;
    return Math.ceil(source.length / this.itemsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  loadReservas(): void {
    if (!this.userId) return;
    this.isLoading = true;

    this.mysqlService.getReservasJugador(this.userId).subscribe({
      next: (res: any) => {
        let allReservas = [];
        if (Array.isArray(res)) {
          allReservas = res;
        } else {
          const individuales = res.reservas_individuales || [];
          const grupales = res.entrenamientos_grupales || [];
          allReservas = [...individuales, ...grupales];
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.reservasFuturas = allReservas.filter(r => {
          const rDate = new Date((r.fecha || '') + 'T' + (r.hora_inicio || '00:00'));
          return rDate >= today;
        }).sort((a, b) => new Date((a.fecha || '') + 'T' + (a.hora_inicio || '00:00')).getTime() - new Date((b.fecha || '') + 'T' + (b.hora_inicio || '00:00')).getTime());

        this.reservasPasadas = allReservas.filter(r => {
          const rDate = new Date((r.fecha || '') + 'T' + (r.hora_inicio || '00:00'));
          return rDate < today;
        }).sort((a, b) => new Date((b.fecha || '') + 'T' + (b.hora_inicio || '00:00')).getTime() - new Date((a.fecha || '') + 'T' + (a.hora_inicio || '00:00')).getTime());

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading reservations:', err);
        this.isLoading = false;
      }
    });
  }

  cancelarReserva(reserva: any): void {


    // Determine ID
    const id = reserva.id || reserva.reserva_id || reserva.inscripcion_id;

    if (!id) {
      console.error('No se encontró ID válido para cancelar:', reserva);
      Swal.fire('Error', 'No se pudo identificar la reserva. Contacta a soporte.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: "Cancelarás tu reserva y dejarás el horario libre.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, mantener'
    }).then((result) => {
      if (result.isConfirmed) {
        if (!this.userId) return; // Paranoia check
        this.mysqlService.cancelarReserva(id, this.userId).subscribe({
          next: () => {
            Swal.fire(
              '¡Cancelada!',
              'Tu reserva ha sido cancelada.',
              'success'
            );
            this.loadReservas();
          },
          error: (err: any) => {
            console.error('Error canceling reservation:', err);
            // Verify if it is a 400 to give a better message
            const msg = err.status === 400 ? 'Datos incorrectos (400). ID inválido.' : 'No se pudo cancelar la reserva.';
            Swal.fire(
              'Error',
              msg,
              'error'
            );
          }
        });
      }
    });
  }

  // Navigation
  irAInicio(): void { this.router.navigate(['/jugador-home']); }
  irACalendario(): void { } // Self
  irAReservas(): void { this.router.navigate(['/jugador-reservas']); }
  irAPerfil(): void { this.router.navigate(['/perfil']); }
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }
}
