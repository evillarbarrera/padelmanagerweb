import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { MysqlService } from '../../services/mysql.service';
import { AlumnoService } from '../../services/alumno.service';
import { HardGateComponent } from '../../components/hard-gate/hard-gate.component';

registerLocaleData(localeEs);

@Component({
    selector: 'app-entrenador-agendar',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent, HardGateComponent],
    templateUrl: './entrenador-agendar.component.html',
    styleUrls: ['./entrenador-agendar.component.scss']
})
export class EntrenadorAgendarComponent implements OnInit {
    isLoading = false;
    entrenadorId: number | null = null;
    coachNombre: string | null = null;
    coachFoto: string | null = null;

    // Calendar State
    currentDate: Date = new Date();
    weekDates: Date[] = [];
    displayDates: Date[] = []; // The filtered dates to show (1, 7 or 28-31)
    viewMode: 'day' | 'week' | 'month' = 'week';
    hours: string[] = [];
    
    // Data
    alumnos: any[] = [];
    alumnoSeleccionado: any = null;
    filtroAlumnos: string = '';
    
    // Mallas y Planificación
    mallas: any[] = [];
    mallasFiltradas: any[] = [];
    clasesDisponibles: any[] = [];
    
    planificacionId: number | null = null;
    claseMallaId: number | null = null;
    categoriaFiltro: 'adulto' | 'menor' | 'todos' = 'todos';
    contenidoClase: string = '';
    selectedClaseToPreview: any = null;

    // Asignación de Pack
    mostrarOpcionPack = false;
    packsDisponibles: any[] = [];
    packAAsignar: any = null;

    // Multi-student selection
    alumnosSeleccionados: any[] = [];

    slotsByDay: { [key: string]: any[] } = {};
    
    // Modal State
    showModal = false;
    showDetailModal = false;
    selectedSlot: any = null;
    recurrencia: number = 1;
    tipoClaseSeleccionado: 'individual' | 'multijugador' | 'grupal' = 'individual';

    get maxAlumnos(): number {
        if (this.tipoClaseSeleccionado === 'multijugador') return 4;
        if (this.tipoClaseSeleccionado === 'grupal') return 6;
        return 1;
    }

    get packsParaTipo(): any[] {
        const cant = this.alumnosSeleccionados.length || 1;
        
        if (this.tipoClaseSeleccionado === 'individual') {
            // Show packs for 1 person only
            return this.packsDisponibles.filter(p => {
                const personas = Number(p.cantidad_personas || 1);
                return personas === 1;
            });
        }
        if (this.tipoClaseSeleccionado === 'multijugador') {
            // Show packs where cantidad_personas matches selected count (2-4)
            return this.packsDisponibles.filter(p => {
                const personas = Number(p.cantidad_personas || 1);
                return personas >= 2 && personas <= 4 && personas >= cant;
            });
        }
        if (this.tipoClaseSeleccionado === 'grupal') {
            // Show grupal packs or packs with high capacity
            return this.packsDisponibles.filter(p => {
                const tipo = (p.tipo || '').toLowerCase();
                const personas = Number(p.cantidad_personas || 1);
                const capMax = Number(p.capacidad_maxima || personas);
                return tipo === 'grupal' || tipo === 'pack_grupal' || capMax >= 4 || personas >= 5;
            });
        }
        return this.packsDisponibles;
    }

    get alumnosFiltrados() {
        if (!this.filtroAlumnos) return this.alumnos;
        const f = this.filtroAlumnos.toLowerCase();
        return this.alumnos.filter(a =>
            (a.jugador_nombre || '').toLowerCase().includes(f) ||
            (a.pack_nombre || '').toLowerCase().includes(f)
        );
    }

    isEditingDetail: boolean = false;
    
    constructor(
        private entrenamientoService: EntrenamientoService,
        private alumnoService: AlumnoService,
        private mysqlService: MysqlService,
        private router: Router,
        private popupService: PopupService
    ) { 
        // Generate hours from 07:00 to 22:00
        for (let i = 7; i <= 22; i++) {
            this.hours.push(`${i.toString().padStart(2, '0')}:00`);
        }
    }

    ngOnInit(): void {
        const userRole = localStorage.getItem('userRole');
        this.entrenadorId = Number(localStorage.getItem('userId'));
        this.coachNombre = localStorage.getItem('userName');
        this.coachFoto = localStorage.getItem('userFoto');

        if (!this.entrenadorId || userRole !== 'entrenador') {
            this.router.navigate(['/login']);
            return;
        }

        this.calculateDates();
        this.loadAlumnos();
        this.loadDisponibilidad();
        this.loadMallas();
        this.loadPacks();
    }

    switchView(mode: 'day' | 'week' | 'month') {
        this.viewMode = mode;
        this.calculateDates();
        this.loadDisponibilidad();
    }

    calculateDates() {
        const start = new Date(this.currentDate);
        if (this.viewMode === 'week') {
            const day = start.getDay(); 
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);

            this.weekDates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                this.weekDates.push(d);
            }
            this.displayDates = [...this.weekDates];
        } else if (this.viewMode === 'month') {
            // Month View: Find 1st, then go back to Monday
            const first = new Date(start.getFullYear(), start.getMonth(), 1);
            const day = first.getDay();
            const diff = first.getDate() - day + (day === 0 ? -6 : 1);
            first.setDate(diff);
            
            this.displayDates = [];
            // Month view usually shows 5-6 weeks (35 or 42 days)
            for (let i = 0; i < 42; i++) {
                const d = new Date(first);
                d.setDate(first.getDate() + i);
                this.displayDates.push(d);
            }
        } else {
            // Day mode
            this.displayDates = [new Date(this.currentDate)];
        }
    }

    changeDate(offset: number) {
        if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + (offset * 7));
        } else if (this.viewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + offset);
        }
        this.calculateDates();
        this.loadDisponibilidad();
    }

    isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }

    loadAlumnos(): void {
        if (!this.entrenadorId) return;
        this.alumnoService.getAlumnos(this.entrenadorId).subscribe({
            next: (res: any[]) => { 
                this.alumnos = (res || []).map(a => ({
                    ...a,
                    pack_nombre: a.pack_nombres || a.pack_nombre,
                    sesiones_restantes: Number(a.sesiones_restantes || 0)
                })); 
            },
            error: (err: any) => console.error('Error loading students:', err)
        });
    }

    loadMallas(): void {
        if (!this.entrenadorId) return;
        this.entrenamientoService.getMallas(this.entrenadorId).subscribe({
            next: (res: any[]) => {
                this.mallas = res;
                this.filtrarMallas();
            },
            error: (err: any) => console.error('Error loading mallas:', err)
        });
    }

    loadPacks(): void {
        if (!this.entrenadorId) return;
        this.entrenamientoService.getPacks(this.entrenadorId).subscribe({
            next: (res: any[]) => { this.packsDisponibles = res; },
            error: (err: any) => console.error('Error loading packs:', err)
        });
    }

    filtrarMallas() {
        if (this.categoriaFiltro === 'todos') {
            this.mallasFiltradas = this.mallas;
        } else {
            this.mallasFiltradas = this.mallas.filter(m => 
                (m.publico || '').toLowerCase().includes(this.categoriaFiltro)
            );
        }
    }

    onCategoriaChange() {
        this.planificacionId = null;
        this.claseMallaId = null;
        this.clasesDisponibles = [];
        this.selectedClaseToPreview = null;
        this.contenidoClase = '';
        this.filtrarMallas();
    }

    onMallaChange() {
        if (!this.isEditingDetail) {
            this.claseMallaId = null;
            this.contenidoClase = '';
        }
        this.clasesDisponibles = [];
        if (!this.planificacionId) return;

        this.isLoading = true;
        this.mysqlService.getMallaById(this.planificacionId).subscribe((res: any) => {
            this.isLoading = false;
            this.clasesDisponibles = res.clases || [];
            if (this.isEditingDetail && this.claseMallaId) {
                this.onClaseChange();
            }
        });
    }

    onClaseChange() {
        const clase = this.clasesDisponibles.find(c => c.id == this.claseMallaId);
        this.selectedClaseToPreview = clase || null;
        if (clase) {
            this.contenidoClase = `OBJETIVO: ${clase.objetivo || 'N/A'}\nCALENTAMIENTO: ${clase.calentamiento || 'N/A'}\nDRILLS: ${clase.drills || 'N/A'}`;
        } else {
            this.contenidoClase = '';
        }
    }

    loadDisponibilidad(): void {
        if (!this.entrenadorId) return;
        this.isLoading = true;
        this.slotsByDay = {};

        forkJoin({
            dispo: this.entrenamientoService.getDisponibilidadEntrenador(this.entrenadorId),
            agenda: this.entrenamientoService.getAgenda(this.entrenadorId)
        }).subscribe({
            next: (res: { dispo: any[], agenda: any[] }) => {
                this.processSlots(res.dispo);
                this.mergeAgenda(res.agenda);
                this.isLoading = false;
            },
            error: (err: any) => {
                console.error('Error:', err);
                this.isLoading = false;
            }
        });
    }

    processSlots(rawSlots: any[]) {
        rawSlots.forEach(s => {
            const fecha = this.extractDate(s.fecha_inicio);
            if (!this.slotsByDay[fecha]) this.slotsByDay[fecha] = [];
            this.slotsByDay[fecha].push({ ...s, time: this.extractTime(s.fecha_inicio) });
        });
    }

    mergeAgenda(agendaData: any) {
        if (!agendaData) return;
        const reservas = agendaData.reservas_tradicionales || [];
        reservas.forEach((a: any) => this.applyToSlot(this.extractDate(a.fecha), a.hora_inicio.slice(0, 5), a));

        const templates = agendaData.packs_grupales || [];
        templates.forEach((t: any) => {
            const hora = t.hora_inicio.slice(0, 5);
            this.weekDates.forEach(date => {
                const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
                const dayRef = (t.dia_semana || '').toString().toLowerCase();
                if (dayName === dayRef) {
                    this.applyToSlot(this.formatDate(date), hora, t);
                }
            });
        });
    }

    applyToSlot(fecha: string, hora: string, data: any) {
        if (!this.slotsByDay[fecha]) this.slotsByDay[fecha] = [];
        let existing = this.slotsByDay[fecha].find(s => s.time === hora);
        if (existing) {
            existing.ocupado = true;
            existing.reserva_id = data.reserva_id || data.id;
            existing.jugador_nombre = data.jugador_nombre || data.nombre_jugador;
            existing.reserva_tipo = data.pack_nombre || data.tipo;
            existing.club_nombre = data.club_nombre;
            existing.club_id = data.club_id;
            existing.malla_nombre = data.malla_nombre;
            existing.clase_titulo = data.clase_titulo;
            existing.clase_contenido = data.clase_contenido;
            existing.clase_objetivo = data.clase_objetivo;
            existing.clase_calentamiento = data.clase_calentamiento;
            existing.clase_drills = data.clase_drills;
            existing.clase_juego = data.clase_juego;
            existing.clase_recursos = data.clase_recursos;
        } else {
            this.slotsByDay[fecha].push({
                fecha_inicio: `${fecha} ${hora}:00`,
                time: hora,
                ocupado: true,
                reserva_id: data.reserva_id || data.id,
                jugador_nombre: data.jugador_nombre || data.nombre_jugador,
                reserva_tipo: data.pack_nombre || data.tipo,
                club_nombre: data.club_nombre,
                club_id: data.club_id,
                malla_nombre: data.malla_nombre,
                clase_titulo: data.clase_titulo,
                clase_contenido: data.clase_contenido,
                clase_objetivo: data.clase_objetivo,
                clase_calentamiento: data.clase_calentamiento,
                clase_drills: data.clase_drills,
                clase_juego: data.clase_juego,
                clase_recursos: data.clase_recursos
            });
        }
    }

    extractDate(dStr: string) { return dStr.split(' ')[0]; }
    extractTime(dStr: string) { return dStr.split(' ')[1].slice(0, 5); }
    getSlotData(date: Date, hour: string) { return (this.slotsByDay[this.formatDate(date)] || []).find(s => s.time === hour); }
    formatDate(date: Date): string { return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`; }

    openBooking(date: Date, hour: string, slotData: any) {
        if (!slotData) return;
        
        if (slotData.ocupado) {
            this.selectedSlot = { date, dateStr: this.formatDate(date), hour, slotData };
            this.showDetailModal = true;
            return;
        }

        this.selectedSlot = { date, dateStr: this.formatDate(date), hour, slotData };
        this.tipoClaseSeleccionado = 'individual'; // Reset to default
        this.showModal = true;
    }

    confirmarCancelacion() {
        if (!this.selectedSlot?.slotData) return;
        this.popupService.confirm('¿Cancelar Clase?', `¿Deseas eliminar la clase de ${this.selectedSlot.slotData.jugador_nombre}?`)
            .then(confirmed => {
                if (confirmed) {
                    this.cancelarClase(this.selectedSlot.slotData);
                    this.showDetailModal = false;
                }
            });
    }

    cancelarClase(slot: any) {
        this.isLoading = true;
        const resId = slot.reserva_id || slot.id;
        if (!resId) {
            this.popupService.error('Error', 'No se pudo identificar la reserva para cancelar.');
            this.isLoading = false;
            return;
        }

        this.entrenamientoService.cancelarReserva(resId).subscribe({
            next: () => {
                this.isLoading = false;
                this.popupService.success('Cancelada', 'La clase ha sido eliminada.');
                this.loadDisponibilidad();
            },
            error: (err: any) => this.handleError(err)
        });
    }

    closeModal() {
        this.showModal = false;
        this.showDetailModal = false;
        this.isEditingDetail = false;
        this.selectedSlot = null;
        this.alumnoSeleccionado = null;
        this.alumnosSeleccionados = [];
        this.planificacionId = null;
        this.claseMallaId = null;
        this.packAAsignar = null;
        this.mostrarOpcionPack = false;
    }

    seleccionarAlumno(alumno: any) {
        if (this.tipoClaseSeleccionado === 'individual') {
            this.alumnoSeleccionado = alumno;
            this.alumnosSeleccionados = [alumno];
        } else {
            const idx = this.alumnosSeleccionados.findIndex(
                a => (a.jugador_id || a.id) === (alumno.jugador_id || alumno.id)
            );
            if (idx >= 0) {
                this.alumnosSeleccionados.splice(idx, 1);
            } else if (this.alumnosSeleccionados.length < this.maxAlumnos) {
                this.alumnosSeleccionados.push(alumno);
            }
            this.alumnoSeleccionado = this.alumnosSeleccionados[0] || null;
        }
        // Reset pack when selection changes
        this.packAAsignar = null;
    }

    isAlumnoSelected(alumno: any): boolean {
        return this.alumnosSeleccionados.some(
            a => (a.jugador_id || a.id) === (alumno.jugador_id || alumno.id)
        );
    }

    onTipoClaseChange(tipo: 'individual' | 'multijugador' | 'grupal') {
        this.tipoClaseSeleccionado = tipo;
        this.alumnosSeleccionados = [];
        this.alumnoSeleccionado = null;
        this.packAAsignar = null;
    }

    confirmarAgenda() {
        if (this.tipoClaseSeleccionado === 'individual') {
            if (!this.alumnoSeleccionado || !this.selectedSlot) return;
        } else {
            if (this.alumnosSeleccionados.length === 0 || !this.selectedSlot) return;
        }
        this.isLoading = true;

        // For individual: use first selected student
        // For multi/grupal: create reservation for each student
        const jugadores = this.tipoClaseSeleccionado === 'individual' 
            ? [this.alumnoSeleccionado] 
            : this.alumnosSeleccionados;

        const primerJugador = jugadores[0];
        const jugadorIds = jugadores.map((j: any) => j.jugador_id || j.id);

        // Check if we need to assign a pack
        const needsPack = this.tipoClaseSeleccionado === 'individual'
            ? (primerJugador.sesiones_restantes || 0) <= 0
            : true; // multi/grupal always reference a pack

        const obsPack = (needsPack && this.packAAsignar)
            ? this.entrenamientoService.insertPack({
                pack_id: this.packAAsignar.id || this.packAAsignar.pack_id,
                jugador_id: primerJugador.jugador_id || primerJugador.id,
                estado_pago: 'pendiente',
                metodo_pago: 'manual_entrenador',
                precio_pagado: 0
              })
            : new Observable(obs => {
                obs.next({ success: true, pack_jugador_id: primerJugador.pack_jugador_id });
                obs.complete();
              });

        obsPack.subscribe({
            next: (resP: any) => {
                const payloadReserva: any = {
                    entrenador_id: this.entrenadorId,
                    pack_id: (this.packAAsignar ? (this.packAAsignar.id || this.packAAsignar.pack_id) : (primerJugador.pack_id || 0)) || null,
                    pack_jugador_id: resP.pack_jugador_id || null,
                    fecha: this.selectedSlot.dateStr,
                    hora_inicio: this.selectedSlot.hour,
                    hora_fin: this.getHoraFin(this.selectedSlot.hour),
                    jugador_id: primerJugador.jugador_id || primerJugador.id,
                    estado: 'reservado',
                    recurrencia: this.recurrencia,
                    tipo: this.tipoClaseSeleccionado,
                    club_id: this.selectedSlot.slotData.club_id,
                    malla_id: this.planificacionId,
                    clase_id: this.claseMallaId,
                    clase_titulo: this.clasesDisponibles.find(c => c.id == this.claseMallaId)?.titulo || null
                };

                // For multi/grupal, send all player IDs
                if (this.tipoClaseSeleccionado !== 'individual' && jugadorIds.length > 1) {
                    payloadReserva.jugador_ids = jugadorIds;
                    payloadReserva.jugador_nombre = jugadores.map((j: any) => j.jugador_nombre).join(', ');
                }

                this.entrenamientoService.crearReserva(payloadReserva).subscribe({
                    next: () => {
                        if (this.planificacionId && this.claseMallaId) {
                            this.entrenamientoService.asignarMalla({
                                jugador_id: primerJugador.jugador_id || primerJugador.id,
                                malla_id: this.planificacionId,
                                entrenador_id: this.entrenadorId!
                            }).subscribe(() => this.postReservaExito());
                        } else {
                            this.postReservaExito();
                        }
                    },
                    error: (err: any) => this.handleError(err)
                });
            },
            error: (err: any) => this.handleError(err)
        });
    }

    private postReservaExito() {
        this.isLoading = false;
        this.popupService.success('¡Agendado!', 'La clase se ha guardado correctamente.');
        this.closeModal();
        this.loadDisponibilidad();
        this.loadAlumnos();
    }

    private handleError(err: any) {
        this.isLoading = false;
        this.popupService.error('Error', err.error?.error || 'No se pudo completar la operación.');
    }

    getHoraFin(horaInicio: string): string {
        const [h, m] = horaInicio.split(':').map(Number);
        const date = new Date();
        date.setHours(h + 1, m);
        return date.toTimeString().slice(0, 5);
    }

    onEditDetail() {
        if (!this.selectedSlot?.slotData) return;
        const d = this.selectedSlot.slotData;
        const mId = d.malla_id ? Number(d.malla_id) : null;
        const cId = d.clase_id ? Number(d.clase_id) : null;

        // Auto-detect category to show the malla in the dropdown
        if (mId) {
            const malla = this.mallas.find((m: any) => m.id == mId);
            if (malla) {
                this.categoriaFiltro = malla.categoria || 'todos';
                this.onCategoriaChange();
            }
        }

        this.planificacionId = mId;
        this.claseMallaId = cId;
        this.isEditingDetail = true;
        
        if (this.planificacionId) {
            this.onMallaChange(); 
        }
    }

    saveTechnicalEdit() {
        if (!this.selectedSlot?.slotData) return;
        this.isLoading = true;

        const updatedClass = this.clasesDisponibles.find(c => c.id == this.claseMallaId);
        const payload = {
            reserva_id: this.selectedSlot.slotData.reserva_id,
            malla_id: this.planificacionId,
            clase_id: this.claseMallaId,
            clase_titulo: updatedClass?.titulo || null
        };

        this.entrenamientoService.updateReservaTecnica(payload).subscribe({
            next: () => {
                this.isLoading = false;
                this.popupService.success('Actualizado', 'La planificación técnica ha sido actualizada.');
                
                // Update local state instantly for the detail view
                if (this.selectedSlot?.slotData) {
                    const mallaObj = this.mallas.find(m => m.id == this.planificacionId);
                    this.selectedSlot.slotData.malla_id = this.planificacionId;
                    this.selectedSlot.slotData.malla_nombre = mallaObj?.nombre || 'Malla Actualizada';
                    this.selectedSlot.slotData.clase_id = this.claseMallaId;
                    this.selectedSlot.slotData.clase_titulo = updatedClass?.titulo || 'Clase Actualizada';
                    this.selectedSlot.slotData.clase_objetivo = updatedClass?.objetivo;
                    this.selectedSlot.slotData.clase_calentamiento = updatedClass?.calentamiento;
                    this.selectedSlot.slotData.clase_contenido = updatedClass?.parte_tecnica;
                    this.selectedSlot.slotData.clase_drills = updatedClass?.drills;
                    this.selectedSlot.slotData.clase_juego = updatedClass?.juego;
                    this.selectedSlot.slotData.clase_recursos = updatedClass?.recursos;
                }

                this.isEditingDetail = false;
                this.showDetailModal = false;
                this.loadDisponibilidad();
            },
            error: (err: any) => this.handleError(err)
        });
    }
}
