import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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
        estado: 'Confirmada'
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

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        const storedRole = localStorage.getItem('userRole') || '';

        if (!user || (!storedRole.toLowerCase().includes('admin') && !storedRole.toLowerCase().includes('administrador'))) {
            this.router.navigate(['/login']);
            return;
        }

        if (user) {
            this.userId = user.id;
            this.userName = user.nombre;
            this.userFoto = user.foto_perfil;
            this.userRole = user.rol;

            // Fetch fresh profile data
            this.apiService.getPerfil(this.userId!).subscribe({
                next: (res) => {
                    if (res.success && res.user) {
                        this.userFoto = res.user.foto_perfil || this.userFoto;
                        this.userName = res.user.nombre || this.userName;
                    }
                }
            });
        }

        this.selectedFecha = this.getLocalISODate();
        this.newReserva.fecha = this.selectedFecha;
        this.generateTimeSlots();
        this.generateCurrentWeek();

        if (this.userId) {
            this.clubesService.getClubes(this.userId).subscribe(res => {
                this.clubes = res;
                if (this.clubes.length > 0) {
                    this.selectClub(this.clubes[0]);
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
            if (this.canchas.length > 0) this.newReserva.cancha_id = this.canchas[0].id;
        });
    }

    loadReservas() {
        if (!this.selectedClub || !this.selectedFecha) return;
        this.clubesService.getClubReservas(this.selectedClub.id, this.selectedFecha).subscribe(res => {
            this.reservas = res;
        });
    }

    getReservaInSlot(canchaId: number, hora: string) {
        const [h, m] = hora.split(':').map(Number);
        const slotMinutes = h * 60 + m;

        return this.reservas.find(r => {
            if (r.cancha_id !== canchaId) return false;
            if (r.estado === 'Cancelada') return false;

            const [hStart, mStart] = r.hora_inicio.split(':').map(Number);
            const startMinutes = hStart * 60 + mStart;

            const [hEnd, mEnd] = r.hora_fin.split(':').map(Number);
            const endMinutes = hEnd * 60 + mEnd;

            return slotMinutes >= startMinutes && slotMinutes < endMinutes;
        });
    }

    isStartOfReserva(res: any, hora: string): boolean {
        const [hSlot] = hora.split(':').map(Number);
        const [hRes] = res.hora_inicio.split(':').map(Number);
        return hSlot === hRes;
    }

    getReservaClass(res: any): string {
        if (res.estado === 'Bloqueada') return 'blocked-slot';
        if (!res.usuario_id && res.nombre_externo) return 'admin-reserva';
        return 'player-reserva';
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
        this.showAddForm = true;
    }

    editarReserva(res: any) {
        this.newReserva = { ...res };
        // Si viene con segundos del mysql, los quitamos
        this.newReserva.hora_inicio = res.hora_inicio.substring(0, 5);
        this.newReserva.hora_fin = res.hora_fin.substring(0, 5);

        // Calcular duracion para el selector
        const [hS, mS] = this.newReserva.hora_inicio.split(':').map(Number);
        const [hE, mE] = this.newReserva.hora_fin.split(':').map(Number);
        this.newReserva.duracion = (hE * 60 + mE) - (hS * 60 + mS);

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
        if (this.activePlayerSlot === 2) term = this.newReserva.nombre_externo2;
        if (this.activePlayerSlot === 3) term = this.newReserva.nombre_externo3;
        if (this.activePlayerSlot === 4) term = this.newReserva.nombre_externo4;

        if (!term || !term.trim()) {
            this.filteredUsers = [];
            return;
        }

        // Si el usuario escribe manualmente, limpiamos el ID para que cuente como "Invitado"
        if (this.activePlayerSlot === 1) this.newReserva.jugador_id = 0;
        if (this.activePlayerSlot === 2) this.newReserva.jugador2_id = 0;
        if (this.activePlayerSlot === 3) this.newReserva.jugador3_id = 0;
        if (this.activePlayerSlot === 4) this.newReserva.jugador4_id = 0;

        const lowTerm = term.toLowerCase();
        this.filteredUsers = this.allUsers.filter(u =>
            u.nombre?.toLowerCase().includes(lowTerm) || u.usuario?.toLowerCase().includes(lowTerm)
        ).slice(0, 5);
    }

    selectUser(user: any) {
        if (this.activePlayerSlot === 1) {
            this.newReserva.jugador_id = user.id;
            this.newReserva.nombre_externo = user.nombre;
        } else if (this.activePlayerSlot === 2) {
            this.newReserva.jugador2_id = user.id;
            this.newReserva.nombre_externo2 = user.nombre;
        } else if (this.activePlayerSlot === 3) {
            this.newReserva.jugador3_id = user.id;
            this.newReserva.nombre_externo3 = user.nombre;
        } else if (this.activePlayerSlot === 4) {
            this.newReserva.jugador4_id = user.id;
            this.newReserva.nombre_externo4 = user.nombre;
        }
        this.filteredUsers = [];
    }

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

        // Para bloqueos administrativos, nos aseguramos que no cargue datos de jugadores previos
        if (this.newReserva.estado === 'Bloqueada') {
            this.newReserva.nombre_externo = 'BLOQUEO ADMINISTRATIVO';
            this.newReserva.jugador_id = null;
            this.newReserva.jugador2_id = null;
            this.newReserva.jugador3_id = null;
            this.newReserva.jugador4_id = null;
            this.newReserva.precio = 0;
        }

        // Calculate end time based on duration
        const [h, m] = this.newReserva.hora_inicio.split(':');
        let totalMinutes = parseInt(h) * 60 + parseInt(m) + Number(this.newReserva.duracion);
        let endH = Math.floor(totalMinutes / 60);
        let endM = totalMinutes % 60;
        this.newReserva.hora_fin = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        const action = this.newReserva.id ? this.clubesService.updateReserva(this.newReserva) : this.clubesService.addReserva(this.newReserva);

        action.subscribe(res => {
            Swal.fire({
                title: '¡Éxito!',
                text: 'La reserva se ha guardado correctamente.',
                icon: 'success',
                confirmButtonColor: '#111',
                timer: 2000
            });
            this.loadReservas();
            this.showAddForm = false;
            this.resetForm();
        }, err => {
            Swal.fire({
                title: 'Error',
                text: err.error?.error || 'No se pudo guardar la reserva',
                icon: 'error',
                confirmButtonColor: '#111'
            });
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
            pagado: 1,
            estado: 'Confirmada'
        };
        this.userSearchTerm = '';
        this.activePlayerSlot = 1;
    }

    cancelarReserva(id: number) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#111',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.cancelReserva(id).subscribe(res => {
                    Swal.fire('¡Cancelada!', 'La reserva ha sido eliminada.', 'success');
                    this.loadReservas();
                    this.showAddForm = false;
                });
            }
        });
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
}
