import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';

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
  alumnosEncontrados: any[] = [];

  dias: DiaAgenda[] = [];
  diaSeleccionado: string = '';

  constructor(
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService,
    private entrenamientoService: EntrenamientoService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

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

    for (let i = 0; i < 10; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      const fechaStr = this.getLocalISODate(fecha);
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

  getLocalISODate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  buscarAlumnosAgenda(term: string) {
    if (term.length < 3) {
      this.alumnosEncontrados = [];
      return;
    }
    this.mysqlService.searchAlumnos(term).subscribe({
      next: (res: any[]) => this.alumnosEncontrados = res,
      error: () => this.alumnosEncontrados = []
    });
  }

  agregarAlumnoAClase(item: any, alumno: any) {
    const packId = item.pack_id;
    const jugadorId = alumno.id || alumno.jugador_id;

    if (!packId || !jugadorId) {
      this.popupService.error('Error', 'No se pudo identificar la clase o el alumno.');
      return;
    }

    this.entrenamientoService.addJugadorAPack(packId, jugadorId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.popupService.success('¡Agendado!', `${alumno.nombre} se ha unido a la clase.`);
          item.showAddPlayer = false;
          this.alumnosEncontrados = [];
          this.loadAgenda();
        } else {
          this.popupService.error('Atención', res.error || 'No se pudo inscribir al alumno.');
        }
      },
      error: (err) => {
        this.popupService.error('Error', err.error?.error || 'Hubo un problema al inscribir al alumno.');
      }
    });
  }

  loadAgenda(): void {
    if (!this.userId) return;
    this.isLoading = true;

    this.mysqlService.getEntrenadorStats(this.userId).subscribe({
      next: (res: any) => {
        const todasReservas: any[] = [];

        if (res.reservas_tradicionales && Array.isArray(res.reservas_tradicionales)) {
          const mappedReservas = res.reservas_tradicionales.map((r: any) => {
            const isGrupal = r.tipo === 'grupal' || r.tipo === 'pack_grupal' || r.tipo === 'grupal_template';
            const dur = this.calculateDuration(r.hora_inicio, r.hora_fin);

            const processedInscritos = (r.inscritos || []).map((ins: any) => {
              let foto = ins.foto;
              if (foto && foto.length > 5 && !foto.includes('imagen_defecto')) {
                if (!foto.startsWith('http')) {
                  const cleanPath = foto.startsWith('/') ? foto.substring(1) : foto;
                  foto = `https://api.padelmanager.cl/${cleanPath}`;
                }
              } else {
                foto = `https://ui-avatars.com/api/?name=${encodeURIComponent(ins.nombre)}&background=ccff00&color=000`;
              }
              return { ...ins, foto };
            });

            return {
              ...r,
              inscritos: processedInscritos,
              cupos_ocupados: r.cupos_ocupados !== undefined ? r.cupos_ocupados : (isGrupal ? processedInscritos.length : 1),
              capacidad_maxima: r.capacidad_maxima || r.capacidad || 4,
              duracion_calculada: r.duracion_calculada || dur || r.duracion_original || 60
            };
          });
          todasReservas.push(...mappedReservas);
        }

        if (res.packs_grupales && Array.isArray(res.packs_grupales)) {
          const packsGrupalesMapeados = res.packs_grupales.map((pack: any) => {
            const dur = this.calculateDuration(pack.hora_inicio, pack.hora_fin);
            const processedInscritos = (pack.inscritos || []).map((ins: any) => {
              let foto = ins.foto;
              if (foto && foto.length > 5 && !foto.includes('imagen_defecto')) {
                if (!foto.startsWith('http')) {
                  const cleanPath = foto.startsWith('/') ? foto.substring(1) : foto;
                  foto = `https://api.padelmanager.cl/${cleanPath}`;
                }
              } else {
                foto = `https://ui-avatars.com/api/?name=${encodeURIComponent(ins.nombre)}&background=ccff00&color=000`;
              }
              return { ...ins, foto };
            });

            return {
              ...pack,
              pack_id: pack.pack_id || pack.id,
              reserva_id: pack.id || pack.pack_id,
              fecha: pack.fecha || null,
              tipo: 'grupal',
              estado: pack.estado_grupo,
              estado_grupo: pack.estado_grupo,
              inscritos: processedInscritos,
              cupos_ocupados: pack.cupos_ocupados || processedInscritos.length || 0,
              capacidad_maxima: pack.capacidad_maxima || 6,
              duracion_calculada: dur || pack.duracion_calculada || pack.duracion_dinamica || 60
            };
          });
          todasReservas.push(...packsGrupalesMapeados);
        }

        this.dias.forEach(dia => {
          let diaBDFormato = dia.diaNumero;

          const directReservations = todasReservas.filter(r => r.fecha === dia.fecha && r.tipo !== 'grupal_template');
          dia.data = [...directReservations];
          dia.data.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
        });

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading agenda:', err);
        this.isLoading = false;
      }
    });
  }

  calculateDuration(start: string, end: string): number {
    if (!start || !end) return 0;
    try {
      const [hS, mS] = start.split(':').map(Number);
      const [hE, mE] = end.split(':').map(Number);
      return (hE * 60 + mE) - (hS * 60 + mS);
    } catch (e) {
      return 0;
    }
  }

  get agendaActual(): any[] {
    const dia = this.dias.find(d => d.fecha === this.diaSeleccionado);
    return dia ? dia.data : [];
  }

  seleccionarDia(fecha: string) {
    this.diaSeleccionado = fecha;
  }

  cancelarClase(item: any): void {
    this.popupService.open({
      title: 'Cancelar Entrenamiento',
      message: `¿Cómo deseas proceder con este ${item.tipo === 'grupal' ? 'pack' : 'entrenamiento'}?`,
      icon: 'question',
      buttons: [
        { text: 'Cancelar y Notificar', value: 'notify', type: 'primary' },
        { text: 'Solo Cancelar', value: 'silent', type: 'secondary' },
        { text: 'Cerrar', value: null, type: 'danger' }
      ]
    }).then((action) => {
      if (action) {
        this.ejecutarCancelacion(item);
      }
    });
  }

  ejecutarCancelacion(item: any) {
    const isGrupal = item.tipo === 'grupal_template' || item.tipo === 'grupal_fecha' || item.tipo === 'pack_grupal';
    const endpoint = isGrupal ? 'packs/eliminar_pack.php' : 'entrenador/cancelar_reserva.php';

    this.mysqlService.postApi(endpoint, {
      reserva_id: item.reserva_id,
      pack_id: item.reserva_id,
      id: item.reserva_id,
      entrenador_id: this.userId!
    }).subscribe({
      next: () => {
        this.popupService.success(
          'Eliminado',
          'El entrenamiento ha sido eliminado correctamente.'
        );
        this.loadAgenda();
      },
      error: (err) => {
        console.error('Error al eliminar:', err);
        this.popupService.error('Error', 'No se pudo eliminar el entrenamiento.');
      }
    });
  }

  getEstadoText(item: any): string {
    if (item.tipo === 'grupal' || item.tipo === 'pack_grupal' || item.tipo === 'grupal_template') {
      return item.estado_grupo || 'activo';
    }
    return item.status || item.estado || 'activo';
  }

  openWhatsAppGroup(item: any) {
    if (!item.inscritos || item.inscritos.length === 0) return;

    const phones = item.inscritos
      .map((ins: any) => ins.telefono)
      .filter((tel: string) => tel && tel.length > 5);

    if (phones.length === 0) {
      this.popupService.info('Sin teléfonos', 'No hay números de teléfono registrados para este grupo.');
      return;
    }

    // Since official WhatsApp group links require being an admin and creating a link,
    // we use a workaround to open a chat with multiple numbers or just inform.
    // For now, we'll open a chat with the first one or prompt about the group.
    const message = encodeURIComponent(`Hola alumnos de la clase de las ${item.hora_inicio.slice(0, 5)}...`);
    window.open(`https://wa.me/${phones[0]}?text=${message}`, '_blank');
  }
}
