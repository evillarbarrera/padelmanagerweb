import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-clubes-jugador',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './clubes-jugador.component.html',
    styleUrls: ['./clubes-jugador.component.scss']
})
export class ClubesJugadorComponent implements OnInit {
    clubes: any[] = [];
    canchas: any[] = [];
    horarios: any[] = [];
    selectedClub: any = null;
    selectedCancha: any = null;
    selectedFecha: string = new Date().toISOString().split('T')[0];
    weekDays: any[] = [];

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'jugador';

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        if (user) {
            this.userId = user.id;
            this.userName = user.nombre;
            this.userFoto = user.foto_perfil;
            this.userRole = user.rol;
        }
        this.generateWeekDays();
        this.loadClubes();
    }

    generateWeekDays() {
        const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        const result = [];
        const today = new Date();

        for (let i = 0; i < 6; i++) { // Mostramos solo los próximos 6 días
            const d = new Date();
            d.setDate(today.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            result.push({
                nombre: days[d.getDay()],
                numero: d.getDate(),
                fullDate: dateStr
            });
        }
        this.weekDays = result;
    }

    onSelectDate(date: string) {
        this.selectedFecha = date;
        this.loadDisponibilidad();
    }

    loadClubes() {
        this.clubesService.getClubes().subscribe(res => {
            this.clubes = res;
        });
    }

    onSelectClub(club: any) {
        this.selectedClub = club;
        this.selectedCancha = null;
        this.horarios = [];
        this.clubesService.getCanchas(club.id).subscribe(res => {
            this.canchas = res;
        });
    }

    onSelectCancha(cancha: any) {
        this.selectedCancha = cancha;
        this.loadDisponibilidad();
    }

    loadDisponibilidad() {
        if (!this.selectedCancha || !this.selectedFecha) return;
        this.clubesService.getDisponibilidadCancha(this.selectedCancha.id, this.selectedFecha).subscribe(res => {
            this.horarios = res;
        });
    }

    reservar(horario: any) {
        if (!horario.disponible) {
            Swal.fire('Ocupado', 'Este horario ya no está disponible.', 'error');
            return;
        }

        // Primero preguntamos la duración
        Swal.fire({
            title: '¿Cuánto tiempo quieres jugar?',
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '90 Minutos',
            denyButtonText: '60 Minutos',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#111',
            denyButtonColor: '#444',
        }).then((result) => {
            if (result.isDismissed) return;

            const duracion = result.isConfirmed ? 90 : 60;
            const desc = result.isConfirmed ? '90 minutos' : '60 minutos';

            // Ahora confirmamos la reserva con la duración elegida
            Swal.fire({
                title: 'Confirmar Reserva',
                text: `¿Reservar ${this.selectedCancha.nombre} a las ${horario.hora_inicio.substring(0, 5)} por ${desc}?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#111',
                cancelButtonColor: '#aaa',
                confirmButtonText: 'Sí, reservar',
                cancelButtonText: 'Volver'
            }).then((confirmRes) => {
                if (confirmRes.isConfirmed) {
                    const [h, m] = horario.hora_inicio.split(':');
                    let totalMin = parseInt(h) * 60 + parseInt(m) + duracion;
                    let hEnd = Math.floor(totalMin / 60);
                    let mEnd = totalMin % 60;
                    const horaFin = `${hEnd.toString().padStart(2, '0')}:${mEnd.toString().padStart(2, '0')}:00`;

                    const reserva = {
                        cancha_id: this.selectedCancha.id,
                        usuario_id: this.userId,
                        nombre_externo: this.userName,
                        fecha: this.selectedFecha,
                        hora_inicio: horario.hora_inicio,
                        hora_fin: horaFin,
                        precio: duracion === 90 ? 20.00 : 15.00, // Precios ejemplo diferenciados
                        pagado: 0,
                        estado: 'Confirmada',
                        jugador_id: this.userId,
                        nombre_externo2: '',
                        nombre_externo3: '',
                        nombre_externo4: ''
                    };

                    this.clubesService.addReserva(reserva).subscribe({
                        next: () => {
                            Swal.fire('¡Reservado!', 'Tu cancha ha sido reservada con éxito.', 'success');
                            this.loadDisponibilidad();
                        },
                        error: (err) => {
                            Swal.fire('Error', err.error?.error || 'No se pudo completar la reserva', 'error');
                        }
                    });
                }
            });
        });
    }
}
