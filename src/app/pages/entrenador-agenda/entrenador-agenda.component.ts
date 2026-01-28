import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service'; // Changed from EntrenamientoService to match source pattern if available, or keep using existing service but properly
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

interface DiaAgenda {
  nombre: string;
  fecha: string;
  diaNumero: number;
  data: any[];
}

@Component({
  selector: 'app-entrenador-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './entrenador-agenda.component.html',
  styleUrls: ['./entrenador-agenda.component.scss']
})
export class EntrenadorAgendaComponent implements OnInit {
  coachNombre = 'Entrenador';
  coachFoto: string | null = null;
  isLoading = true;
  userId: number | null = null;

  // Logic ported from source
  dias: DiaAgenda[] = [];
  diaSeleccionado: string = '';

  constructor(
    private mysqlService: MysqlService, // Using mysqlService as in source
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Load coach profile for sidebar/header
    this.mysqlService.getPerfil(this.userId).subscribe(res => {
      if (res.success) {
        this.coachNombre = res.user.nombre;
        this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;
      }
    });

    this.generarFechas();
    this.loadAgenda();
  }

  generarFechas() {
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const hoy = new Date();

    for (let i = 0; i < 6; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      const diaNumero = fecha.getDay();

      this.dias.push({
        nombre: i === 0 ? 'Hoy' : nombresDias[diaNumero],
        fecha: fechaStr,
        diaNumero: diaNumero,
        data: []
      });
    }
    this.diaSeleccionado = this.dias[0].fecha;
  }

  loadAgenda(): void {
    if (!this.userId) return;
    this.isLoading = true;

    // Assuming getEntrenadorAgenda exists in MysqlService as per source code analysis.
    // If not, we might need to use the existing service or add the method.
    // Given the source code used mysqlService.getEntrenadorAgenda, I'll attempt to use that.
    // If it fails compile, I will check mysqlService.ts. 
    this.mysqlService.getEntrenadorStats(this.userId).subscribe({
      next: (res: any) => {
        const todasReservas: any[] = [];

        // Add traditional reservations
        if (res.reservas_tradicionales && Array.isArray(res.reservas_tradicionales)) {
          todasReservas.push(...res.reservas_tradicionales);
        }

        // Add group packs
        if (res.packs_grupales && Array.isArray(res.packs_grupales)) {
          const packsGrupalesMapeados = res.packs_grupales.map((pack: any) => ({
            ...pack,
            reserva_id: pack.id || pack.pack_id,
            fecha: null, // Group packs are recurrent, handled by day_of_week match
            tipo: 'grupal',
            estado: pack.estado_grupo,
            estado_grupo: pack.estado_grupo
          }));
          todasReservas.push(...packsGrupalesMapeados);
        }

        // Distribute into days
        this.dias.forEach(dia => {
          const diaBDFormato = dia.diaNumero; // 0-6

          dia.data = todasReservas.filter(r => {
            if (r.tipo === 'grupal') {
              // Group packs match by day of week (0-6)
              return diaBDFormato === r.dia_semana;
            } else {
              // Traditional reservations match by exact date
              return r.fecha === dia.fecha;
            }
          });
        });

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading agenda:', err);
        this.isLoading = false;
      }
    });
  }

  get agendaActual(): any[] {
    const dia = this.dias.find(d => d.fecha === this.diaSeleccionado);
    return dia ? dia.data : [];
  }

  seleccionarDia(fecha: string) {
    this.diaSeleccionado = fecha;
  }

  cancelarClase(item: any): void {
    Swal.fire({
      title: 'Cancelar Entrenamiento',
      text: `¿Estás seguro de que deseas cancelar este ${item.tipo === 'grupal' ? 'pack' : 'entrenamiento'}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#d33',
      confirmButtonText: 'SÍ, CANCELAR',
      cancelButtonText: 'VOLVER'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarCancelacion(item);
      }
    });
  }

  ejecutarCancelacion(item: any) {
    this.mysqlService.cancelarReservaEntrenador(item.reserva_id, this.userId!).subscribe({
      next: () => {
        Swal.fire(
          'Cancelado',
          'El entrenamiento ha sido cancelado y el horario liberado.',
          'success'
        );
        this.loadAgenda();
      },
      error: (err) => {
        console.error('Error al cancelar:', err);
        Swal.fire('Error', 'No se pudo cancelar la reserva.', 'error');
      }
    });
  }

  getEstadoText(item: any): string {
    return item.tipo === 'grupal' ? (item.estado_grupo || 'desconocido') : (item.estado || 'desconocido');
  }
}
