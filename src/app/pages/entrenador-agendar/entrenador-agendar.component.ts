import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import Swal from 'sweetalert2';
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
    
    // Tutorial State
    showTutorial = false;
    currentTutorialStep = 0;
    tutorialSteps = [
        { 
            target: '.slot-cell:not(.booked):not(.past)', 
            title: '📅 Elige tu Horario', 
            content: 'Haz clic en una celda vacía para iniciar tu agendamiento. Los bloques claros indican disponibilidad.' 
        },
        { 
            target: '.type-selector', 
            title: '🎾 Tipo de Clase', 
            content: 'Elige entre Individual, Multijugador (2 a 4 alumnos) o Grupal (4 a 6 alumnos). El sistema filtrará los packs correspondientes.' 
        },
        { 
            target: '.search-box', 
            title: '👤 Asigna al Alumno', 
            content: 'Busca a tu alumno por nombre. Veremos al instante si tiene créditos en su pack.' 
        },
        { 
            target: '.plan-section', 
            title: '📋 Dossier Técnico', 
            content: 'Opcional: Añade qué entrenarán hoy. El alumno podrá verlo desde su app.' 
        },
        { 
            target: '.current-pack', 
            title: '💳 Créditos y Pack', 
            content: 'Verifica si el alumno tiene créditos. Si no le quedan, selecciona su nuevo pack aquí mismo.' 
        },
        { 
            target: '.b-confirm', 
            title: '🚀 ¡Todo Listo!', 
            content: 'Revisa los detalles finales y confirma la reserva para notificar al alumno.' 
        },
    ];

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
    packsParaTipoList: any[] = [];
    alumnosFiltradosList: any[] = [];

    // Multi-student selection
    alumnosSeleccionados: any[] = [];

    slotsByDay: { [key: string]: any[] } = {};
    alumnosPacks: any[] = []; // Packs of the currently selected student
    cargandoPacks = false;
    mostrarSelectorPackManual = false;
    
    // Modal State
    showModal = false;
    showDetailModal = false;
    selectedSlot: any = null;
    recurrencia: number = 1;
    tipoClaseSeleccionado: 'individual' | 'multijugador' | 'grupal' | 'evaluacion' = 'individual';

    packMatchesTipo(p: any, type: string): boolean {
        if (!p) return false;
        // Check multiple possible field names as well as the name/title of the pack
        const name = (p.pack_nombre || p.nombre || p.titulo || p.pack_nombres || '').toLowerCase();
        const rawTipo = (p.tipo || p.pack_tipo || p.reserva_tipo || p.tipo_reserva || '').toLowerCase();
        const combined = rawTipo + ' ' + name;
        
        // Prioritize explicit person count, fallback to keywords
        const personas = Number(p.cantidad_personas || (combined.includes('duo') ? 2 : combined.includes('trio') ? 3 : (combined.includes('grupal') ? 4 : 1)));
        const capMax = Number(p.capacidad_maxima || (p.cantidad_personas ? personas : (combined.includes('grupal') ? 6 : personas)));

        if (type === 'individual' || type === 'evaluacion') {
            // Strictly 1 person and not a multi/group keyword
            return personas === 1 && !combined.includes('duo') && !combined.includes('trio') && !combined.includes('grupal') && !combined.includes('multi');
        } else if (type === 'multijugador') {
            // Strictly 2-3 people or multi keywords
            return (personas >= 2 && personas <= 3) || combined.includes('duo') || combined.includes('trio') || combined.includes('multi');
        } else if (type === 'grupal') {
            // Strictly 4+ people or grupal keyword
            return personas >= 4 || capMax >= 4 || combined.includes('grupal');
        }
        return true;
    }

    getTipoLabel(tipo: string): string {
        if (tipo === 'individual') return 'Individual';
        if (tipo === 'multijugador') return 'Multi';
        if (tipo === 'grupal') return 'Grupal';
        return tipo;
    }

    get alumnosPacksConCredito(): any[] {
        // Only show packs that have REAL available credits
        // Math: Total Sessions - Total Scheduled (Reservadas includes past/done)
        return (this.alumnosPacks || [])
            .map(p => {
                const total = Number(p.sesiones_totales || p.sesiones || 0);
                const reservadas = Number(p.sesiones_reservadas || 0);
                
                // Real available = Total contracted - Total scheduled/reserved
                p._disponibles = total - reservadas;

                // Fallback for UI if sesiones_restantes isn't what we expect
                if (p.sesiones_restantes === undefined) p.sesiones_restantes = total - Number(p.sesiones_usadas || 0);
                
                return p;
            })
            .filter(p => p._disponibles > 0 && this.packMatchesTipo(p, this.tipoClaseSeleccionado));
    }

    get maxAlumnos(): number {
        if (this.tipoClaseSeleccionado === 'multijugador') return 4;
        if (this.tipoClaseSeleccionado === 'grupal') return 6;
        return 1;
    }

    actualizarPacksParaTipo() {
        if (!this.packsDisponibles) return;
        this.packsParaTipoList = this.packsDisponibles.filter(p => this.packMatchesTipo(p, this.tipoClaseSeleccionado));
    }

    filtrarListaAlumnos() {
        // PERF: Do not render full list. Only render if they type something.
        if (!this.filtroAlumnos || this.filtroAlumnos.trim().length < 2) {
            this.alumnosFiltradosList = this.alumnos.filter(a => this.isAlumnoSelected(a));
            return;
        }
        
        const f = this.filtroAlumnos.trim().toLowerCase();
        this.alumnosFiltradosList = this.alumnos.filter(a =>
            this.isAlumnoSelected(a) ||
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

    isPast(date: Date, hour: string): boolean {
        const now = new Date();
        const [hours, minutes] = hour.split(':');
        const slotDate = new Date(date);
        slotDate.setHours(parseInt(hours), parseInt(minutes), 0);
        return slotDate < now;
    }

    // --- TUTORIAL METHODS ---
    startTutorial() {
        this.showTutorial = true;
        this.currentTutorialStep = 0;
        this.updateTutorialPosition();
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
            this.currentTutorialStep++;
            this.updateTutorialPosition();
            
            // Auto-open modal for step 2 if we are in step 1
            if (this.currentTutorialStep === 1 && !this.showModal) {
                this.openBooking(new Date(), '10:00', { available: true });
                // Re-calculate after modal animation
                setTimeout(() => this.updateTutorialPosition(), 500);
            }
        } else {
            this.closeTutorial();
        }
    }

    tutorialTop = '0px';
    tutorialLeft = '0px';

    updateTutorialPosition() {
        const step = this.tutorialSteps[this.currentTutorialStep];
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        setTimeout(() => {
            const el = document.querySelector(step.target) as HTMLElement;
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'center' }); // Instant scroll
                el.classList.add('tutorial-highlight');
                
                const rect = el.getBoundingClientRect();
                const vh = window.innerHeight;
                const vw = window.innerWidth;

                // Position the card near the element
                if (rect.top > vh / 2) {
                    // Place above
                    this.tutorialTop = (rect.top - 200) + 'px';
                } else {
                    // Place below
                    this.tutorialTop = (rect.bottom + 40) + 'px';
                }

                this.tutorialLeft = Math.max(20, Math.min(vw - 420, rect.left)) + 'px';
            } else {
                // Fallback to center
                this.tutorialTop = '40%';
                this.tutorialLeft = 'calc(50% - 200px)';
            }
        }, 0);
    }



    closeTutorial() {
        this.showTutorial = false;
        this.currentTutorialStep = 0;
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    }

    isPastDay(date: Date): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        return compareDate < today;
    }

    getCalendarTitle(): string {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        if (this.viewMode === 'month') {
            return `${meses[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        } else if (this.viewMode === 'week') {
            const start = this.weekDates[0];
            const end = this.weekDates[6];
            if (start.getMonth() !== end.getMonth()) {
                return `${start.getDate()} ${meses[start.getMonth()].substring(0, 3)} - ${end.getDate()} ${meses[end.getMonth()].substring(0, 3)} ${this.currentDate.getFullYear()}`;
            }
            return `Semana ${start.getDate()} al ${end.getDate()} ${meses[start.getMonth()]} ${this.currentDate.getFullYear()}`;
        } else {
            return `${this.currentDate.getDate()} de ${meses[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }
    }

    getReservasCount(day: Date): number {
        const slots = this.slotsByDay[this.formatDate(day)];
        if (!slots) return 0;
        // Count only booked slots to show the number of classes that day
        return slots.filter((s: any) => s.reserva_id != null).length;
    }

    loadAlumnos(): void {
        if (!this.entrenadorId) return;
        this.alumnoService.getAlumnos(this.entrenadorId).subscribe({
            next: (res: any[]) => { 
                this.alumnos = (res || []).map(a => {
                    const restantes = Number(a.sesiones_restantes || 0);
                    const reservadas = Number(a.sesiones_reservadas || 0);
                    return {
                        ...a,
                        pack_nombre: a.pack_nombres || a.pack_nombre,
                        sesiones_restantes: restantes,
                        sesiones_reservadas: reservadas,
                        creditos_reales: Number(a.creditos_reales || 0)
                    };
                }); 
                this.filtrarListaAlumnos();
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
            next: (res: any[]) => { 
                this.packsDisponibles = res; 
                this.actualizarPacksParaTipo();
            },
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
        reservas.forEach((a: any) => {
            const h = a.hora_inicio ? a.hora_inicio.slice(0, 5) : '08:00';
            this.applyToSlot(this.extractDate(a.fecha), h, a);
        });

        const templates = agendaData.packs_grupales || [];
        templates.forEach((t: any) => {
            const hora = t.hora_inicio ? t.hora_inicio.slice(0, 5) : '08:00';
            
            if (t.fecha) {
                // Specific date session
                this.applyToSlot(t.fecha, hora, {
                    ...t,
                    reserva_id: t.pack_id,
                    reserva_tipo: 'Entrenamiento Grupal',
                    jugador_nombre: t.jugador_nombre || 'Abierto para inscripción'
                });
            } else {
                // Recurring template
                this.weekDates.forEach(date => {
                    const dayIndex = date.getDay(); // 0 (Sun) - 6 (Sat)
                    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
                    const dayRef = (t.dia_semana != null) ? t.dia_semana.toString().toLowerCase() : '';
                    
                    // Match by index or name
                    const daysMap = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                    if (dayRef === dayIndex.toString() || dayRef === dayName || dayRef === daysMap[dayIndex]) {
                        this.applyToSlot(this.formatDate(date), hora, {
                            ...t,
                            reserva_id: t.pack_id,
                            reserva_tipo: 'Entrenamiento Grupal (Recurrente)',
                            jugador_nombre: 'Clase Grupal'
                        });
                    }
                });
            }
        });
    }

    applyToSlot(fecha: string, hora: string, data: any) {
        if (!this.slotsByDay[fecha]) this.slotsByDay[fecha] = [];
        let existing = this.slotsByDay[fecha].find(s => s.time === hora);
        
        const slotUpdate = {
            ocupado: true,
            reserva_id: data.reserva_id || data.id,
            pack_id: data.pack_id || data.id, // Para clases grupales
            jugador_nombre: data.jugador_nombre || data.nombre_jugador,
            reserva_tipo: data.pack_nombre || data.tipo,
            club_nombre: data.club_nombre,
            club_id: data.club_id,
            malla_nombre: data.malla_nombre,
            malla_id: data.malla_id,
            clase_id: data.clase_id,
            clase_titulo: data.clase_titulo,
            clase_contenido: data.clase_contenido,
            clase_objetivo: data.clase_objetivo,
            clase_calentamiento: data.clase_calentamiento,
            clase_drills: data.clase_drills,
            clase_juego: data.clase_juego,
            clase_recursos: data.clase_recursos,
            inscritos: data.inscritos || [],
            capacidad_maxima: data.capacidad_maxima || 6,
            cupos_ocupados: data.cupos_ocupados || (data.inscritos ? data.inscritos.length : 0)
        };

        if (existing) {
            Object.assign(existing, slotUpdate);
        } else {
            this.slotsByDay[fecha].push({
                fecha_inicio: `${fecha} ${hora}:00`,
                time: hora,
                ...slotUpdate
            });
        }
    }

    extractDate(dStr: string) { return dStr.split(' ')[0]; }
    extractTime(dStr: string) { return dStr.split(' ')[1].slice(0, 5); }
    getSlotData(date: Date, hour: string) { return (this.slotsByDay[this.formatDate(date)] || []).find(s => s.time === hour); }
    formatDate(date: Date): string { return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`; }

    openBooking(date: Date, hour: string, slotData: any) {
        // If no slotData exists (availability not opened), create a virtual one for the coach
        if (!slotData) {
            slotData = {
                fecha_inicio: `${this.formatDate(date)} ${hour}:00`,
                time: hour,
                club_id: 1, // Default club fallback
                ocupado: false,
                is_virtual: true // Flag to know it wasn't in the DB
            };
        }
        
        if (slotData.ocupado) {
            this.selectedSlot = { date, dateStr: this.formatDate(date), hour, slotData };
            this.showDetailModal = true;
            return;
        }

        this.selectedSlot = { date, dateStr: this.formatDate(date), hour, slotData };
        this.tipoClaseSeleccionado = 'individual'; // Reset to default
        this.filtroAlumnos = '';
        this.filtrarListaAlumnos();
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

        // Si tiene pack_id o el tipo es grupal, usamos la lógica de eliminar pack
        const isGrupal = slot.pack_id || slot.reserva_tipo?.toLowerCase().includes('grupal') || slot.reserva_tipo?.toLowerCase().includes('warriors');

        if (isGrupal) {
            this.entrenamientoService.deletePack(resId).subscribe({
                next: () => {
                    this.isLoading = false;
                    this.popupService.success('Eliminada', 'El entrenamiento grupal ha sido eliminado.');
                    this.loadDisponibilidad();
                },
                error: (err: any) => this.handleError(err)
            });
        } else {
            this.entrenamientoService.cancelarReserva(resId).subscribe({
                next: () => {
                    this.isLoading = false;
                    this.popupService.success('Cancelada', 'La clase ha sido eliminada.');
                    this.loadDisponibilidad();
                },
                error: (err: any) => this.handleError(err)
            });
        }
    }

    closeModal() {
        this.showModal = false;
        this.showDetailModal = false;
        this.isEditingDetail = false;
        this.selectedSlot = null;
        this.alumnoSeleccionado = null;
        this.alumnosSeleccionados = [];
        this.mostrarOpcionPack = false;
    }

    filtroJugadoresModal: string = '';
    jugadoresFiltradosModal: any[] = [];

    filtrarJugadoresModal() {
        if (!this.filtroJugadoresModal || this.filtroJugadoresModal.trim().length < 2) {
            this.jugadoresFiltradosModal = [];
            return;
        }
        const f = this.filtroJugadoresModal.toLowerCase();
        this.jugadoresFiltradosModal = this.alumnos.filter(a => 
            (a.jugador_nombre || '').toLowerCase().includes(f)
        ).slice(0, 5);
    }

    agregarJugadorAPack(alumno: any) {
        if (!this.selectedSlot?.slotData?.pack_id) return;
        
        const packId = this.selectedSlot.slotData.pack_id;
        const jugadorId = alumno.jugador_id || alumno.id;

        this.isLoading = true;
        this.entrenamientoService.addJugadorAPack(packId, jugadorId).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.popupService.success('¡Agregado!', 'El jugador ha sido agregado al entrenamiento.');
                this.filtroJugadoresModal = '';
                this.jugadoresFiltradosModal = [];
                this.loadDisponibilidad();
                // Update local list if possible
                if (this.selectedSlot.slotData.inscritos) {
                    this.selectedSlot.slotData.inscritos.push({
                        id: jugadorId,
                        nombre: alumno.jugador_nombre,
                        foto: alumno.foto_perfil || alumno.link_foto
                    });
                }
            },
            error: (err: any) => {
                this.isLoading = false;
                this.popupService.error('Error', err.error?.error || 'No se pudo agregar al jugador');
            }
        });
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
        
        // Load full pack info for the student regardless of list position
        // This ensures compatibility info (Duo vs Individual) is accurate for the UI
        if (this.isAlumnoSelected(alumno)) {
            this.cargarPacksAlumno(alumno.jugador_id || alumno.id, alumno);
        }

        // Reset global assignment pack if primary student changes
        this.packAAsignar = null;
    }

    cargarPacksAlumno(jugadorId: number, targetAlumno?: any) {
        this.cargandoPacks = true;
        this.entrenamientoService.getPacksAlumno(jugadorId).subscribe({
            next: (res: any) => {
                const packs = Array.isArray(res) ? res : (res.data || res.packs || []);
                
                // Use provided student or fallback to the primary one
                const target = targetAlumno || this.alumnoSeleccionado;
                
                if (target) {
                    // Update this specific student's info to reflect current modality compatibility
                    const matching = packs.filter((p: any) => this.packMatchesTipo(p, this.tipoClaseSeleccionado));
                    if (matching.length > 0) {
                        // Sort by remaining sessions to show the most useful one
                        const best = matching.sort((a: any, b: any) => (b.sesiones_restantes || 0) - (a.sesiones_restantes || 0))[0];
                        target.pack_nombre = best.pack_nombre;
                        
                        const total = Number(best.sesiones_totales || best.sesiones || 0);
                        const reservadas = Number(best.sesiones_reservadas || 0);
                        
                        // Critical Balance: Total sessions minus EVERYTHING already in the calendar (past or future)
                        target.creditos_reales = total - reservadas;
                        
                        target.sesiones_restantes = Number(best.sesiones_restantes || 0);
                        target.sesiones_reservadas = reservadas;
                        
                        // Sync IDs for reservation logic
                        target.pack_id = best.pack_id || best.id_pack || best.id;
                        target.pack_jugador_id = best.id || best.pack_jugador_id;
                    } else if (packs.length > 0) {
                        // If they have packs but none at this level, clearly show it
                        target.creditos_reales = 0;
                        target.sesiones_restantes = 0;
                        target.pack_nombre = 'Sin pack ' + this.getTipoLabel(this.tipoClaseSeleccionado);
                    }
                }

                // If this is the primary student (alumnosSeleccionados[0]), 
                // fill the global store used for the "Existing Pack" selector dropdown
                if (this.alumnosSeleccionados.length > 0 && (target === this.alumnosSeleccionados[0])) {
                    this.alumnosPacks = packs;
                }
                
                this.cargandoPacks = false;
            },
            error: () => this.cargandoPacks = false
        });
    }

    onPackAlumnoToggle() {
        if (!this.alumnoSeleccionado) return;
        const pack = this.alumnosPacks.find(p => (p.id || p.pack_jugador_id) == this.alumnoSeleccionado.pack_jugador_id);
        if (pack) {
            this.alumnoSeleccionado.pack_id = pack.pack_id;
            this.alumnoSeleccionado.pack_nombre = pack.pack_nombre;
            this.alumnoSeleccionado.sesiones_restantes = pack.sesiones_restantes;
        }
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
        this.alumnosPacks = [];
        this.actualizarPacksParaTipo();
    }

    confirmarAgenda() {
        if (this.tipoClaseSeleccionado === 'individual') {
            if (!this.alumnoSeleccionado || !this.selectedSlot) return;
        } else if (this.tipoClaseSeleccionado === 'grupal') {
            // Permitir agendar sin alumnos para crear clase abierta
            if (!this.selectedSlot) return;
        } else {
            if (this.alumnosSeleccionados.length === 0 || !this.selectedSlot) return;
        }

        // --- LÓGICA ESPECIAL PARA GRUPAL ---
        if (this.tipoClaseSeleccionado === 'grupal') {
            this.ejecutarAgendamientoGrupal();
            return;
        }

        // --- SAFEGUARD: Validaciones de Pack ---
        if (this.mostrarSelectorPackManual && !this.packAAsignar) {
            Swal.fire('Atención', 'Activaste la opción de vender un pack nuevo, pero no seleccionaste ninguno del menú.', 'warning');
            return;
        }

        // Si no tiene saldo activo y tampoco seleccionó uno nuevo para comprar
        const requiereNuevoPack = this.tipoClaseSeleccionado === 'individual' 
            ? (this.alumnosPacksConCredito.length === 0 && (this.alumnoSeleccionado?.creditos_reales || 0) <= 0)
            : (this.alumnosPacksConCredito.length === 0);

        if (requiereNuevoPack && !this.packAAsignar) {
            Swal.fire('Sin Saldo', 'El alumno no tiene sesiones disponibles. Selecciona un pack nuevo para asignarle antes de agendar.', 'error');
            return;
        }

        this.isLoading = true;

        // For individual: use first selected student
        // For multi/grupal: create reservation for each student
        const jugadores = this.tipoClaseSeleccionado === 'individual' 
            ? [this.alumnoSeleccionado] 
            : this.alumnosSeleccionados;

        const primerJugador = jugadores[0] || null;
        const jugadorIds = jugadores.map((j: any) => j.jugador_id || j.id);

        // Check if we need to assign a pack
        // If a new pack was manually selected from the dropdown, always purchase it.
        const needsPack = this.packAAsignar 
            ? true 
            : (this.tipoClaseSeleccionado === 'multijugador'
                ? true
                : (this.tipoClaseSeleccionado === 'individual' ? (primerJugador?.sesiones_restantes || 0) <= 0 : false));

        const obsPack = (needsPack && this.packAAsignar && primerJugador)
            ? this.entrenamientoService.insertPack({
                pack_id: this.packAAsignar.id || this.packAAsignar.pack_id,
                jugador_id: primerJugador.jugador_id || primerJugador.id,
                estado_pago: 'pendiente',
                metodo_pago: 'manual_entrenador'
              })
            : new Observable(obs => {
                obs.next({ success: true, pack_jugador_id: primerJugador?.pack_jugador_id || 0 });
                obs.complete();
              });

        obsPack.subscribe({
            next: async (resP: any) => {
                // Ensure we have a valid pack_id
                let fId: any = 0;
                let fJugadorId: any = 0;

                // 1. PRIMARY: Match from specific NEW pack assignment first
                if (this.packAAsignar) {
                    fId = this.packAAsignar.id || this.packAAsignar.pack_id || 0;
                    fJugadorId = resP.pack_jugador_id || 0;
                } 
                // 2. SECONDARY: Match from loaded packs with credits (highest accuracy for existing packs)
                else if (this.alumnosPacksConCredito.length > 0) {
                    // Respect the user's manual dropdown selection
                    let best = this.alumnosPacksConCredito.find(p => String(p.id || p.pack_jugador_id) === String(primerJugador.pack_jugador_id));
                    if (!best) { best = this.alumnosPacksConCredito[0]; } // Fallback to first available
                    
                    fId = best.pack_id || best.id_pack || best.id || 0;
                    fJugadorId = best.id || best.pack_jugador_id || best.pack_id || fId || 0;
                    
                    // If we found a pack but ID are still shaky, use the primary key 'id'
                    if (fId === fJugadorId && best.pack_id) {
                         fId = best.pack_id;
                    }
                } 
                // 3. TERTIARY: Detection from student object - Exhaustive key search
                else if (primerJugador) {
                    const keys = [
                        'pack_id', 'id_pack', 'idPack', 'id_pack_entrenador', 
                        'pack_ids', 'pack_jugador_id', 'id_pack_jugador', 
                        'idPackJugador', 'pack_jugador_ids', 'pack_jugadores_id',
                        'id_pack_jugadores', 'pack_compra_id', 'id'
                    ];
                    
                    // Priority 1: Check known keys
                    for(const k of keys) {
                        const val = primerJugador[k];
                        if (val && String(val) !== '0' && String(val).length > 0) {
                            if (k === 'id' && Number(val) === Number(primerJugador.jugador_id || primerJugador.id_jugador)) continue;
                            fId = String(val).includes(',') ? val.split(',')[0].trim() : val;
                            break;
                        }
                    }

                    // Priority 2: Speculative search
                    if (!fId || fId === 0) {
                        for(const k in primerJugador) {
                            if (k.toLowerCase().includes('id') && !k.toLowerCase().includes('jugador') && !k.toLowerCase().includes('usuario')) {
                                const val = primerJugador[k];
                                if (val && !isNaN(Number(val)) && Number(val) > 0 && Number(val) !== Number(primerJugador.jugador_id)) {
                                    fId = val;
                                    break;
                                }
                            }
                        }
                    }
                    
                    fJugadorId = primerJugador.pack_jugador_id || primerJugador.id_pack_jugador || primerJugador.pack_jugadores_id || fId || 0;
                    
                // Priority 3: Case for Liz Silva - We have a name ('Bienvenida') but no ID
                if ((!fId || fId === 0) && primerJugador.pack_nombre && (primerJugador.creditos_reales > 0 || primerJugador.sesiones_restantes > 0)) {
                    console.log('Searching for pack ID by name:', primerJugador.pack_nombre);
                    // Match against all available packs (this.packsDisponibles)
                    const foundInCatalog = (this.packsDisponibles || []).find((p: any) => (p.nombre || p.titulo) === primerJugador.pack_nombre);
                    if (foundInCatalog) {
                        fId = foundInCatalog.id || foundInCatalog.pack_id || 0;
                        fJugadorId = fId; // We use the base pack_id as fallback
                        console.log('Recovery by name successful! ID:', fId);
                    }
                }

                // Priority 4: Fallback if we STILL don't have an ID
                if ((!fId || fId === 0) && (primerJugador.creditos_reales > 0 || primerJugador.sesiones_restantes > 0)) {
                    console.log('Force fetching pack via getPack for jugador_id:', primerJugador.jugador_id || primerJugador.id);
                    try {
                        const resG: any = await this.alumnoService.getPack(primerJugador.jugador_id || primerJugador.id).toPromise();
                        const target = Array.isArray(resG) ? resG[0] : resG;
                        if (target && (target.pack_id || target.id)) {
                             fId = target.pack_id || target.id;
                             fJugadorId = target.id || target.pack_jugador_id || fId;
                             console.log('Emergency ID recovered:', fId);
                        }
                    } catch (e) { console.error('Emergency fetch failed:', e); }
                }
                }

                // If still 0, block and notify user to avoid 400
                if (!fId || Number(fId) === 0) {
                    if (!this.packAAsignar) {
                        this.isLoading = false;
                        const debugInfo = `ID Alumno: ${primerJugador?.jugador_id || primerJugador?.id}. Pack detectado: ${fId}. Packs cargados: ${this.alumnosPacksConCredito.length}`;
                        const allKeys = Object.keys(primerJugador || {}).join(', ');
                        alert(`⚠️ No se pudo asignar automáticamente un pack a este alumno.\n\n${debugInfo}\n\nCampos disponibles: ${allKeys}\n\nPor favor, selecciona uno manualmente.`);
                        return;
                    }
                }

                const payloadReserva: any = {
                    entrenador_id: String(this.entrenadorId),
                    pack_id: String(fId),
                    pack_jugador_id: String(fJugadorId),
                    fecha: this.selectedSlot.dateStr,
                    hora_inicio: this.selectedSlot.hour,
                    hora_fin: this.getHoraFin(this.selectedSlot.hour),
                    jugador_id: String(primerJugador.jugador_id || primerJugador.id),
                    jugador_nombre: primerJugador.jugador_nombre || 'Alumno',
                    estado: 'reservado',
                    recurrencia: String(this.recurrencia || 1),
                    tipo: this.tipoClaseSeleccionado,
                    club_id: String(this.selectedSlot.slotData?.club_id || 1),
                    malla_id: String(this.planificacionId || 0),
                    clase_id: String(this.claseMallaId || 0),
                    clase_titulo: this.selectedClaseToPreview?.titulo || ''
                };

                // For multi/grupal, send all player IDs
                if (this.tipoClaseSeleccionado !== 'individual' && jugadorIds.length > 1) {
                    payloadReserva.jugador_ids = jugadorIds;
                    payloadReserva.jugador_nombre = jugadores.map((j: any) => j.jugador_nombre).join(', ');
                }

                console.log('Enviando reserva:', payloadReserva);

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

    ejecutarAgendamientoGrupal() {
        if (!this.packAAsignar) {
            Swal.fire('Selecciona Pack', 'Debes elegir un Pack Grupal (ej. Padel Warriors) para crear el entrenamiento.', 'warning');
            return;
        }

        this.isLoading = true;
        const template = this.packAAsignar;
        const totalSemanas = this.recurrencia || 1;
        const creationTasks: Observable<any>[] = [];

        for (let i = 0; i < totalSemanas; i++) {
            const targetDate = new Date(this.selectedSlot.date);
            targetDate.setDate(targetDate.getDate() + (i * 7));
            const dateStr = this.formatDate(targetDate);

            const payloadPack = {
                entrenador_id: this.entrenadorId,
                nombre: template.nombre || template.titulo,
                descripcion: template.descripcion || '',
                tipo: 'grupal',
                sesiones_totales: 1,
                duracion_sesion_min: template.duracion_sesion_min || 60,
                precio: template.precio || 0,
                capacidad_minima: template.capacidad_minima || 4,
                capacidad_maxima: template.capacidad_maxima || 6,
                fecha: dateStr,
                hora_inicio: this.selectedSlot.hour,
                categoria: this.categoriaFiltro === 'todos' ? 'adulto' : this.categoriaFiltro,
                permite_inscripcion: 1,
                club_id: this.selectedSlot.slotData.club_id || 1
            };

            creationTasks.push(this.mysqlService.postApi('packs/create_pack.php', payloadPack));
        }

        forkJoin(creationTasks).subscribe({
            next: (results: any[]) => {
                const enrollmentTasks: Observable<any>[] = [];
                
                if (this.alumnosSeleccionados.length > 0) {
                    results.forEach(res => {
                        const newPackId = res.id;
                        this.alumnosSeleccionados.forEach(alumno => {
                            enrollmentTasks.push(this.entrenamientoService.addJugadorAPack(newPackId, alumno.jugador_id || alumno.id));
                        });
                    });
                }

                if (enrollmentTasks.length > 0) {
                    forkJoin(enrollmentTasks).subscribe({
                        next: () => this.postReservaExito(),
                        error: (err) => {
                            console.error('Error inscribiendo:', err);
                            this.postReservaExito();
                        }
                    });
                } else {
                    this.postReservaExito();
                }
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

    getTimeOfDay(hour: string): 'manana' | 'tarde' | 'noche' {
        const h = parseInt(hour.split(':')[0]);
        if (h < 12) return 'manana';
        if (h < 17) return 'tarde';
        return 'noche';
    }
}
