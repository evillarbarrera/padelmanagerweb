import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { InventarioService } from '../../services/inventario.service';

@Component({
    selector: 'app-club-reservas',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './club-reservas.component.html',
    styleUrls: ['./club-reservas.component.scss']
})
export class ClubReservasComponent implements OnInit {
    clubes: any[] = [];
    selectedClub: any = null;
    reservas: any[] = [];
    selectedFecha: string = '';

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    // Manual Reservation
    showAddForm = false;
    canchas: any[] = [];
    allUsers: any[] = [];
    filteredUsers: any[] = [];
    userSearchTerm: string = '';

    newReserva: any = {
        id: null,
        cancha_id: 0,
        duracion: 90,
        jugador_id: 0,
        jugador2_id: 0,
        jugador3_id: 0,
        jugador4_id: 0,
        nombre_externo: '',
        nombre_externo2: '',
        nombre_externo3: '',
        nombre_externo4: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        precio: 0,
        pagado: 1,
        estado: 'Confirmada',
        metodo_pago: 'total', // 'total' o 'proporcional'
        pagos: { p1: true, p2: false, p3: false, p4: false } // Estado de pago por jugador
    };

    activeDragReserva: any = null;

    weekDays: any[] = [];
    timeSlots: string[] = [];

    // User search per slot
    activePlayerSlot: number = 1;

    // TV Mode (Dashboard View)
    isTVMode: boolean = false;
    refreshInterval: any;
    currentTime: string = '';
    // Consumption feature
    showConsumoModal: boolean = false;
    activeReservaConsumo: any = null;
    activePlayerN: number = 0;
    productos: any[] = [];
    currentConsumos: any[] = [];

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private inventarioService: InventarioService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const storedRole = localStorage.getItem('userRole') || '';
        const storedUserId = localStorage.getItem('userId');
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        if (!currentUser) {
            this.router.navigate(['/login']);
            return;
        }

        this.userId = currentUser.id;
        this.userRole = currentUser.rol || 'administrador_club';
        if (!storedUserId || (!storedRole.toLowerCase().includes('admin') && !storedRole.toLowerCase().includes('staff'))) {
            this.router.navigate(['/login']);
            return;
        }

        this.userId = Number(storedUserId);
        this.userName = storedUser?.nombre || '';
        this.userFoto = storedUser?.foto_perfil || null;
        this.userRole = storedUser?.rol || storedRole;
        this.apiService.getPerfil(this.userId!).subscribe({
            next: (res) => {
                if (res.success && res.user) {
                    this.userFoto = res.user.foto_perfil || this.userFoto;
                    this.userName = res.user.nombre || this.userName;
                }
            }
        });

        this.selectedFecha = this.getLocalISODate();
        this.newReserva.fecha = this.selectedFecha;
        this.generateTimeSlots();
        this.generateCurrentWeek();

        if (this.userId) {
            this.clubesService.getClubes(this.userId).subscribe(res => {
                this.clubes = res;
                if (this.clubes.length > 0) {
                    const currentClubId = currentUser?.club_id;
                    const matchedClub = this.clubes.find(c => Number(c.id) === Number(currentClubId));
                    this.selectClub(matchedClub || this.clubes[0]);
                }
            });
        }

        this.clubesService.getUsers().subscribe(res => {
            this.allUsers = res;
        });

        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
    }

    getLocalISODate(date: Date = new Date()): string {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    updateTime() {
        const now = new Date();
        this.currentTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    toggleTVMode() {
        this.isTVMode = !this.isTVMode;
        if (this.isTVMode) {
            // Auto-refresh every 60s in TV mode
            this.refreshInterval = setInterval(() => {
                this.loadReservas();
            }, 60000);
            // Optional: Request fullscreen
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        }
    }

    generateTimeSlots() {
        const slots = [];
        for (let i = 6; i <= 23; i++) {
            slots.push(`${i.toString().padStart(2, '0')}:00`);
        }
        this.timeSlots = slots;
    }

    generateCurrentWeek() {
        if (!this.selectedFecha) return;
        const [y, m, d] = this.selectedFecha.split('-').map(Number);
        const curr = new Date(y, m - 1, d);

        // Find Monday of the current week
        const dayOfWeek = curr.getDay(); // 0 is Sunday, 1 is Monday
        const diff = curr.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(y, m - 1, diff);

        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);

            week.push({
                full: this.getLocalISODate(date),
                short: date.toLocaleDateString('es-ES', { weekday: 'short' }),
                num: date.getDate()
            });
        }
        this.weekDays = week;
    }

    selectClub(club: any) {
        this.selectedClub = club;
        this.loadReservas();
        this.loadCanchas();
    }

    loadCanchas() {
        if (!this.selectedClub) return;
        this.clubesService.getCanchas(this.selectedClub.id).subscribe(res => {
            this.canchas = res;
            if (this.canchas.length > 0) {
                if (!this.newReserva.cancha_id) this.newReserva.cancha_id = this.canchas[0].id;
                this.updateCanchaPrice();
            }
        });
    }

    getCanchaName(id: number): string {
        const c = this.canchas.find(x => x.id === id);
        return c ? c.nombre : 'Cancha ' + id;
    }

    updateCanchaPrice() {
        if (!this.newReserva.cancha_id) return;
        const cancha = this.canchas.find(c => c.id === this.newReserva.cancha_id);
        if (cancha) {
            const duration = Number(this.newReserva.duracion);
            if (duration === 60) this.newReserva.precio = cancha.precio_60;
            else if (duration === 90) this.newReserva.precio = cancha.precio_90;
            else if (duration === 120) this.newReserva.precio = cancha.precio_120;
        }
    }

    get montoPorPersona(): number {
        const total = this.newReserva.precio || 0;
        let count = 1;
        if (this.newReserva.nombre_externo2 || this.newReserva.jugador2_id) count++;
        if (this.newReserva.nombre_externo3 || this.newReserva.jugador3_id) count++;
        if (this.newReserva.nombre_externo4 || this.newReserva.jugador4_id) count++;
        return Math.round(total / count);
    }

    getPaymentStatus(res: any): 'total' | 'parcial' | 'pendiente' {
        const metodo = res.metodo_pago || 'total';
        
        if (metodo === 'total') {
            return Number(res.pagado) === 1 ? 'total' : 'pendiente';
        }
        
        // Lógica Proporcional: Verificar cada jugador activo
        let jugadoresActivos = 0;
        let jugadoresPagados = 0;

        if (res.nombre_externo || res.jugador_id || res.usuario_id) {
            jugadoresActivos++;
            if (Number(res.pago_p1) === 1) jugadoresPagados++;
        }
        if (res.nombre_externo2 || res.jugador2_id) {
            jugadoresActivos++;
            if (Number(res.pago_p2) === 1) jugadoresPagados++;
        }
        if (res.nombre_externo3 || res.jugador3_id) {
            jugadoresActivos++;
            if (Number(res.pago_p3) === 1) jugadoresPagados++;
        }
        if (res.nombre_externo4 || res.jugador4_id) {
            jugadoresActivos++;
            if (Number(res.pago_p4) === 1) jugadoresPagados++;
        }

        if (jugadoresActivos === 0) return 'pendiente';
        if (jugadoresPagados === jugadoresActivos) return 'total';
        if (jugadoresPagados > 0) return 'parcial';
        
        return 'pendiente';
    }

    loadReservas() {
        if (!this.selectedClub || !this.selectedFecha) return;
        this.clubesService.getClubReservas(this.selectedClub.id, this.selectedFecha).subscribe(res => {
            this.reservas = res;
        });
    }

    getReservaInSlot(canchaId: number, hora: string) {
        const [h, m] = hora.split(':').map(Number);
        const slotMinutes = h * 60 + (m || 0);
        const slotEnd = slotMinutes + 60; // Each slot represents 1 hour

        return this.reservas.find(r => {
            if (Number(r.cancha_id) !== Number(canchaId)) return false;
            if (r.estado === 'Cancelada') return false;

            const [hStart, mStart] = r.hora_inicio.split(':').map(Number);
            const startMinutes = hStart * 60 + mStart;

            const [hEnd, mEnd] = r.hora_fin.split(':').map(Number);
            const endMinutes = hEnd * 60 + mEnd;

            // Overlap: reservation overlaps with this slot's hour
            return startMinutes < slotEnd && endMinutes > slotMinutes;
        });
    }

    isStartOfReserva(res: any, hora: string): boolean {
        const [hSlot, mSlot] = hora.split(':').map(Number);
        const slotMinutes = hSlot * 60 + (mSlot || 0);
        const slotEnd = slotMinutes + 60;

        const [hRes, mRes] = res.hora_inicio.split(':').map(Number);
        const startMinutes = hRes * 60 + mRes;

        // The reservation starts within this slot's hour range
        return startMinutes >= slotMinutes && startMinutes < slotEnd;
    }

    getReservaClass(res: any): string {
        if (res.estado === 'Bloqueada') return 'blocked-slot';
        
        let classes = '';
        if ((!res.usuario_id || res.usuario_id === 0) && res.nombre_externo) {
            classes = 'admin-reserva';
        } else {
            classes = 'player-reserva';
        }

        const status = this.getPaymentStatus(res);
        return `${classes} status-${status}`;
    }

    getReservaStyle(res: any): any {
        try {
            const [hS, mS] = res.hora_inicio.split(':').map(Number);
            const [hE, mE] = res.hora_fin.split(':').map(Number);
            const durationMinutes = (hE * 60 + mE) - (hS * 60 + mS);

            const heightPercent = (durationMinutes / 60) * 100;
            const topPercent = (mS / 60) * 100;

            return {
                'height': `calc(${heightPercent}% - 2px)`,
                'top': `calc(${topPercent}% + 1px)`,
                'position': 'absolute',
                'left': '1px',
                'width': 'calc(100% - 2px)',
                'z-index': '15'
            };
        } catch (e) {
            return { height: '100%' };
        }
    }

    openQuickBook(canchaId: number, hora: string) {
        this.resetForm();
        this.newReserva.cancha_id = canchaId;
        this.newReserva.hora_inicio = hora;
        this.newReserva.fecha = this.selectedFecha;
        this.updateCanchaPrice();
        this.showAddForm = true;
    }

    editarReserva(res: any) {
        // Saneamiento agresivo del método de pago
        let metodo = (res.metodo_pago || 'total').toString().toLowerCase().trim();
        if (metodo !== 'total' && metodo !== 'proporcional') {
            metodo = 'total';
        }

        this.newReserva = { 
            ...res,
            jugador_id: res.usuario_id,
            jugador2_id: res.jugador2_id || 0,
            jugador3_id: res.jugador3_id || 0,
            jugador4_id: res.jugador4_id || 0,
            metodo_pago: metodo,
            pagos: {
                p1: Number(res.pago_p1) === 1,
                p2: Number(res.pago_p2) === 1,
                p3: Number(res.pago_p3) === 1,
                p4: Number(res.pago_p4) === 1
            }
        };

        // Si es proporcional, rellenamos con nombres ficticios los espacios vacíos para dividir por 4
        if (this.newReserva.metodo_pago === 'proporcional') {
            if (!this.newReserva.nombre_externo2 && !this.newReserva.jugador2_id) this.newReserva.nombre_externo2 = 'Jugador 2';
            if (!this.newReserva.nombre_externo3 && !this.newReserva.jugador3_id) this.newReserva.nombre_externo3 = 'Jugador 3';
            if (!this.newReserva.nombre_externo4 && !this.newReserva.jugador4_id) this.newReserva.nombre_externo4 = 'Jugador 4';
        }

        // Forzar actualización de UI para que los botones se marquen
        setTimeout(() => {
            this.newReserva.metodo_pago = metodo;
            this.updateCanchaPrice();
        }, 0);

        // Limpiar formatos de hora
        this.newReserva.hora_inicio = res.hora_inicio.substring(0, 5);
        this.newReserva.hora_fin = res.hora_fin.substring(0, 5);

        const [hS, mS] = this.newReserva.hora_inicio.split(':').map(Number);
        const [hE, mE] = this.newReserva.hora_fin.split(':').map(Number);
        this.newReserva.duracion = (hE * 60 + mE) - (hS * 60 + mS);
        
        this.updateCanchaPrice();
        this.loadConsumos(res.id);
        this.showAddForm = true;
    }

    onDragStart(res: any) {
        this.activeDragReserva = res;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
    }

    onDrop(canchaId: number, hora: string) {
        if (!this.activeDragReserva) return;

        const res = this.activeDragReserva;
        const [hOld, mOld] = res.hora_inicio.split(':').map(Number);
        const [hEndOld, mEndOld] = res.hora_fin.split(':').map(Number);
        const duration = (hEndOld * 60 + mEndOld) - (hOld * 60 + mOld);

        const [hNew, mNew] = hora.split(':').map(Number);
        const totalMinEnd = (hNew * 60 + mNew) + duration;
        const hEnd = Math.floor(totalMinEnd / 60);
        const mEnd = totalMinEnd % 60;
        const horaFinNew = `${hEnd.toString().padStart(2, '0')}:${mEnd.toString().padStart(2, '0')}`;

        const updatedRes = {
            ...res,
            cancha_id: canchaId,
            hora_inicio: hora,
            hora_fin: horaFinNew
        };

        this.clubesService.updateReserva(updatedRes).subscribe({
            next: () => {
                this.loadReservas();
                this.activeDragReserva = null;
            },
            error: (err) => {
                alert('Error al mover: ' + (err.error?.error || 'Conflicto de horario'));
                this.activeDragReserva = null;
            }
        });
    }

    searchUsers() {
        let term = '';
        if (this.activePlayerSlot === 1) term = this.newReserva.nombre_externo;
        else if (this.activePlayerSlot === 2) term = this.newReserva.nombre_externo2;
        else if (this.activePlayerSlot === 3) term = this.newReserva.nombre_externo3;
        else if (this.activePlayerSlot === 4) term = this.newReserva.nombre_externo4;

        console.log('Searching for term:', term, 'in slot:', this.activePlayerSlot);

        if (!term || term.length < 2) {
            this.filteredUsers = [];
            return;
        }

        // Si el usuario escribe manualmente, limpiamos el ID para que cuente como "Invitado"
        if (this.activePlayerSlot === 1) this.newReserva.jugador_id = 0;
        if (this.activePlayerSlot === 2) this.newReserva.jugador2_id = 0;
        if (this.activePlayerSlot === 3) this.newReserva.jugador3_id = 0;
        if (this.activePlayerSlot === 4) this.newReserva.jugador4_id = 0;

        // Buscamos sin filtrar por rol estrictamente para probar
        this.clubesService.getUsers('any', term).subscribe({
            next: (res) => {
                console.log('Users found:', res);
                this.filteredUsers = res.slice(0, 5);
            },
            error: (err) => console.error('Error on search:', err)
        });
    }

    selectUser(user: any) {
        if (this.activePlayerSlot === 1) {
            this.newReserva.jugador_id = user.id;
            this.newReserva.nombre_externo = user.nombre;
            this.newReserva.categoria1 = user.categoria;
        } else if (this.activePlayerSlot === 2) {
            this.newReserva.jugador2_id = user.id;
            this.newReserva.nombre_externo2 = user.nombre;
            this.newReserva.categoria2 = user.categoria;
        } else if (this.activePlayerSlot === 3) {
            this.newReserva.jugador3_id = user.id;
            this.newReserva.nombre_externo3 = user.nombre;
            this.newReserva.categoria3 = user.categoria;
        } else if (this.activePlayerSlot === 4) {
            this.newReserva.jugador4_id = user.id;
            this.newReserva.nombre_externo4 = user.nombre;
            this.newReserva.categoria4 = user.categoria;
        }
        this.filteredUsers = [];
    }

    isSaving: boolean = false;

    crearReserva() {
        if (!this.newReserva.cancha_id || !this.newReserva.hora_inicio) {
            Swal.fire({
                title: 'Horario incompleto',
                text: 'Por favor, selecciona una cancha y hora válida.',
                icon: 'warning',
                confirmButtonColor: '#111'
            });
            return;
        }

        // Si es una reserva normal (Confirmada), validamos jugador. Si es Bloqueo, no hace falta.
        if (this.newReserva.estado === 'Confirmada' && !this.newReserva.nombre_externo && !this.newReserva.jugador_id) {
            Swal.fire({
                title: 'Faltan datos',
                text: 'Debes ingresar al menos el Jugador 1 para confirmar una reserva.',
                icon: 'info',
                confirmButtonColor: '#111'
            });
            return;
        }

        // Para bloqueos administrativos
        if (this.newReserva.estado === 'Bloqueada') {
            this.newReserva.nombre_externo = 'BLOQUEO ADMINISTRATIVO';
            this.newReserva.jugador_id = null;
            this.newReserva.jugador2_id = null;
            this.newReserva.jugador3_id = null;
            this.newReserva.jugador4_id = null;
            this.newReserva.precio = 0;
        }

        // Calcular hora_fin
        const [h, m] = this.newReserva.hora_inicio.split(':');
        let totalMinutes = parseInt(h) * 60 + parseInt(m) + Number(this.newReserva.duracion);
        let endH = Math.floor(totalMinutes / 60);
        let endM = totalMinutes % 60;
        this.newReserva.hora_fin = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        this.isSaving = true;
        
        // Recalcular el estado 'pagado' global de forma estricta
        let isFullyPaid = Number(this.newReserva.pagado) === 1;
        if (this.newReserva.metodo_pago === 'proporcional') {
            let activos = 0;
            let pagadosCount = 0;
            
            if (this.newReserva.nombre_externo || this.newReserva.jugador_id) { activos++; if(this.newReserva.pagos.p1) pagadosCount++; }
            if (this.newReserva.nombre_externo2 || this.newReserva.jugador2_id) { activos++; if(this.newReserva.pagos.p2) pagadosCount++; }
            if (this.newReserva.nombre_externo3 || this.newReserva.jugador3_id) { activos++; if(this.newReserva.pagos.p3) pagadosCount++; }
            if (this.newReserva.nombre_externo4 || this.newReserva.jugador4_id) { activos++; if(this.newReserva.pagos.p4) pagadosCount++; }

            isFullyPaid = (activos > 0 && pagadosCount === activos);
        }

        const reservaData = {
            ...this.newReserva,
            pagado: isFullyPaid ? 1 : 0,
            pago_p1: this.newReserva.pagos.p1 ? 1 : 0,
            pago_p2: this.newReserva.pagos.p2 ? 1 : 0,
            pago_p3: this.newReserva.pagos.p3 ? 1 : 0,
            pago_p4: this.newReserva.pagos.p4 ? 1 : 0
        };

        const action = this.newReserva.id ? this.clubesService.updateReserva(reservaData) : this.clubesService.addReserva(reservaData);

        action.subscribe({
            next: (res) => {
                if (res.success) {
                    if (res.warning) {
                        Swal.fire({
                            title: 'Reserva Guardada',
                            text: 'La reserva se guardó, pero hubo un detalle con el inventario: ' + res.warning,
                            icon: 'warning',
                            confirmButtonColor: '#0f172a'
                        });
                    } else {
                        Swal.fire({
                            title: '¡Éxito!',
                            text: this.newReserva.id ? 'Reserva actualizada correctamente' : 'Reserva creada correctamente',
                            icon: 'success',
                            confirmButtonColor: '#0f172a'
                        });
                    }
                    this.showAddForm = false;
                    this.loadReservas();
                }
                this.isSaving = false;
                this.resetForm();
            },
            error: (err) => {
                this.isSaving = false;
                console.error('Error capturado:', err);
                
                let message = 'No se pudo guardar la reserva';
                if (err.status === 409) {
                    message = 'La cancha ya se encuentra reservada en este intervalo.';
                    Swal.fire('Choque de Horario', message, 'error');
                } else {
                    // Extraer mensaje de error de forma segura
                    if (typeof err.error === 'string') {
                        message = err.error;
                    } else if (err.error && err.error.error) {
                        message = err.error.error;
                    } else if (err.message) {
                        message = err.message;
                    }
                    Swal.fire('Error', String(message), 'error');
                }
            }
        });
    }

    eliminarReserva() {
        if (!this.newReserva.id) return;

        Swal.fire({
            title: '¿Eliminar reserva?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                this.isSaving = true;
                this.clubesService.cancelReserva(this.newReserva.id).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.showAddForm = false;
                        this.loadReservas();
                        Swal.fire('Eliminada', 'La reserva ha sido eliminada', 'success');
                    },
                    error: () => {
                        this.isSaving = false;
                        Swal.fire('Error', 'No se pudo eliminar', 'error');
                    }
                });
            }
        });
    }

    resetForm() {
        this.newReserva = {
            id: null,
            cancha_id: this.canchas[0]?.id || 0,
            duracion: 90,
            jugador_id: 0,
            jugador2_id: 0,
            jugador3_id: 0,
            jugador4_id: 0,
            nombre_externo: '',
            nombre_externo2: '',
            nombre_externo3: '',
            nombre_externo4: '',
            fecha: this.selectedFecha,
            hora_inicio: '',
            hora_fin: '',
            precio: 0,
            pagado: 0, // Inicia en 0 (Debe)
            estado: 'Confirmada',
            metodo_pago: 'total',
            pagos: { p1: false, p2: false, p3: false, p4: false } // Todos en Debe
        };
        this.updateCanchaPrice();
        this.userSearchTerm = '';
        this.activePlayerSlot = 1;
    }

    onFechaChange() {
        this.newReserva.fecha = this.selectedFecha;
        this.generateCurrentWeek();
        this.loadReservas();
    }

    selectWeekDay(day: string) {
        this.selectedFecha = day;
        this.onFechaChange();
    }
    setPaymentMethod(metodo: 'total' | 'proporcional') {
        this.newReserva.metodo_pago = metodo;
        if (metodo === 'proporcional') {
            if (!this.newReserva.nombre_externo2 && !this.newReserva.jugador2_id) this.newReserva.nombre_externo2 = 'Jugador 2';
            if (!this.newReserva.nombre_externo3 && !this.newReserva.jugador3_id) this.newReserva.nombre_externo3 = 'Jugador 3';
            if (!this.newReserva.nombre_externo4 && !this.newReserva.jugador4_id) this.newReserva.nombre_externo4 = 'Jugador 4';
        }
    }

    // CONSUMOS METHODS
    openConsumo(reserva: any, playerN: number) {
        this.activeReservaConsumo = reserva;
        this.activePlayerN = playerN;
        this.loadProductos();
        this.loadConsumos(reserva.id);
        this.showConsumoModal = true;
    }

    loadProductos() {
        if (!this.selectedClub) return;
        this.inventarioService.getProductos(this.selectedClub.id).subscribe(res => {
            if (res.success) this.productos = res.productos;
        });
    }

    loadConsumos(reservaId: number) {
        this.inventarioService.getConsumosReserva(reservaId).subscribe(res => {
            if (res.success) this.currentConsumos = res.consumos;
        });
    }

    addConsumo(producto: any) {
        if (!this.activeReservaConsumo) return;
        
        const data = {
            reserva_id: this.activeReservaConsumo.id,
            jugador_n: this.activePlayerN,
            producto_id: producto.id,
            cantidad: 1
        };

        this.inventarioService.addConsumoReserva(data).subscribe(res => {
            if (res.success) {
                this.loadConsumos(this.activeReservaConsumo.id);
                // Mini feedback (Toast) o nada para que sea fluido
            }
        });
    }

    removeConsumo(consumoId: number) {
        Swal.fire({
            title: '¿Quitar este consumo?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, quitar',
            cancelButtonText: 'No'
        }).then(result => {
            if (result.isConfirmed) {
                this.inventarioService.deleteConsumo(consumoId).subscribe(res => {
                    if (res.success) {
                        this.loadConsumos(this.activeReservaConsumo.id);
                    }
                });
            }
        });
    }

    getJugadorTotalConsumo(playerN: number): number {
        return this.currentConsumos
            .filter(c => Number(c.jugador_n) === Number(playerN))
            .reduce((sum, c) => sum + Number(c.subtotal), 0);
    }

    getReservaTotalConsumo(): number {
        return this.currentConsumos.reduce((sum, c) => sum + Number(c.subtotal), 0);
    }

    getConsumosByPlayer(playerN: number): any[] {
        return this.currentConsumos.filter(c => Number(c.jugador_n) === Number(playerN));
    }
}
