import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';

@Component({
    selector: 'app-entrenador-agendar',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './entrenador-agendar.component.html',
    styleUrls: ['./entrenador-agendar.component.scss']
})
export class EntrenadorAgendarComponent implements OnInit {
    isLoading = false;
    entrenadorId: number | null = null;

    // Data
    alumnos: any[] = [];
    alumnoSeleccionado: any = null;
    horariosPorDia: { [key: string]: any[] } = {};
    dias: string[] = [];
    diaSeleccionado: string = '';
    recurrencia: number = 1;

    constructor(
        private entrenamientoService: EntrenamientoService,
        private router: Router,
        private popupService: PopupService
    ) { }

    ngOnInit(): void {
        const userRole = localStorage.getItem('userRole');
        this.entrenadorId = Number(localStorage.getItem('userId'));

        if (!this.entrenadorId || userRole !== 'entrenador') {
            this.router.navigate(['/login']);
            return;
        }
        this.loadAlumnos();
        this.loadDisponibilidad();
    }

    loadAlumnos(): void {
        if (!this.entrenadorId) return;
        this.entrenamientoService.getMisAlumnos(this.entrenadorId).subscribe({
            next: (res) => {
                this.alumnos = res;
            },
            error: (err: any) => console.error('Error loading students:', err)
        });
    }

    loadDisponibilidad(packId?: number): void {
        if (!this.entrenadorId) {
            console.warn('No hay entrenadorId definido');
            return;
        }

        console.log('Cargando disponibilidad para entrenador:', this.entrenadorId, 'Pack:', packId);
        this.isLoading = true;
        this.horariosPorDia = {};
        this.dias = [];
        this.diaSeleccionado = '';

        this.entrenamientoService.getDisponibilidadEntrenador(this.entrenadorId, packId).subscribe({
            next: (res: any) => {
                console.log('Respuesta del servidor:', res);
                if (res && res.length > 0) {
                    this.generarBloquesHorarios(res);
                } else {
                    console.log('El servidor no devolvió bloques de disponibilidad');
                }
                this.isLoading = false;
            },
            error: (err: any) => {
                console.error('Error loading availability:', err);
                this.isLoading = false;
                this.popupService.error('Error de Conexión', 'No se pudo obtener tu disponibilidad. Revisa la consola para más detalles.');
            }
        });
    }

    generarBloquesHorarios(disponibilidades: any[]): void {
        this.horariosPorDia = {};
        this.dias = [];
        const bloquesUnicos = new Set<string>();
        const ahora = new Date();

        console.log('Generando bloques para ahora:', ahora.toLocaleString());

        if (!disponibilidades || disponibilidades.length === 0) return;

        disponibilidades.forEach(d => {
            let inicio = new Date(d.fecha_inicio.replace(' ', 'T'));
            const fin = new Date(d.fecha_fin.replace(' ', 'T'));
            const ocupado = Number(d.ocupado) === 1;

            while (inicio < fin) {
                const bloqueInicio = new Date(inicio);
                const bloqueFin = new Date(inicio);
                bloqueFin.setHours(bloqueFin.getHours() + 1);

                if (bloqueInicio > ahora && bloqueFin <= fin) {
                    const Y = bloqueInicio.getFullYear();
                    const M = (bloqueInicio.getMonth() + 1).toString().padStart(2, '0');
                    const D = bloqueInicio.getDate().toString().padStart(2, '0');
                    const fecha = `${Y}-${M}-${D}`;

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
                        ocupado,
                        jugador_nombre: d.jugador_nombre,
                        reserva_tipo: d.reserva_tipo
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

    seleccionarAlumno(alumno: any) {
        this.alumnoSeleccionado = alumno;
        // No pasamos pack_id ya que el entrenador debe ver toda su disponibilidad general
        this.loadDisponibilidad();
    }

    seleccionarDia(d: string): void {
        this.diaSeleccionado = d;
    }

    reservarHorario(horario: any): void {
        if (!this.alumnoSeleccionado) {
            this.popupService.warning('Selecciona un Alumno', 'Debes elegir a quién deseas agendar primero.');
            return;
        }

        if (horario.ocupado) return;

        const msgRecurrencia = this.recurrencia > 1 ? ` por ${this.recurrencia} semanas` : '';

        this.popupService.confirm(
            '¿Confirmar Agenda?',
            `Agendarás a ${this.alumnoSeleccionado.jugador_nombre} el día ${horario.fecha} a las ${horario.hora_inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${msgRecurrencia}.`
        ).then((confirmed) => {
            if (confirmed) {
                const payload = {
                    entrenador_id: this.entrenadorId,
                    pack_id: this.alumnoSeleccionado.pack_id,
                    pack_jugador_id: this.alumnoSeleccionado.pack_jugador_id,
                    fecha: horario.fecha,
                    hora_inicio: horario.hora_inicio.toTimeString().slice(0, 5),
                    hora_fin: horario.hora_fin.toTimeString().slice(0, 5),
                    jugador_id: this.alumnoSeleccionado.jugador_id,
                    estado: 'reservado',
                    recurrencia: this.recurrencia,
                    tipo: 'individual'
                };

                this.isLoading = true;
                this.entrenamientoService.crearReserva(payload).subscribe({
                    next: () => {
                        this.isLoading = false;
                        this.popupService.success('¡Agendado!', 'La clase se ha guardado correctamente.');
                        this.loadDisponibilidad(this.alumnoSeleccionado?.pack_id);
                        this.loadAlumnos(); // Update remaining sessions
                    },
                    error: (err: any) => {
                        this.isLoading = false;
                        console.error('Error creating reservation:', err);
                        this.popupService.error('Error', err.error?.message || 'Hubo un problema al crear la reserva.');
                    }
                });
            }
        });
    }

    getSlotsByCategory(dia: string, category: 'morning' | 'afternoon' | 'evening'): any[] {
        const slots = this.horariosPorDia[dia] || [];
        return slots.filter(slot => {
            const hora = slot.hora_inicio.getHours();
            if (category === 'morning') return hora < 12;
            if (category === 'afternoon') return hora >= 12 && hora < 18;
            if (category === 'evening') return hora >= 18;
            return false;
        });
    }
}
