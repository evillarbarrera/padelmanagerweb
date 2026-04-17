import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AssetService } from '../../services/asset.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-clubes-jugador',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './clubes-jugador.component.html',
    styleUrls: ['./clubes-jugador.component.scss']
})
export class ClubesJugadorComponent implements OnInit {
    @ViewChild('dateContainerRef') dateContainerRef!: ElementRef;
    
    // Core Data
    clubes: any[] = [];
    canchas: any[] = [];
    horarios: any[] = [];
    torneos: any[] = [];
    americanos: any[] = [];
    
    // UI State
    selectedClub: any = null;
    selectedCancha: any = null;
    selectedFecha: string = '';
    weekDays: any[] = [];
    showOnlyAvailable: boolean = true;
    activeSubTab: 'reservar' | 'torneos' | 'americanos' = 'reservar';
    selectedRegion: string = '';
    
    // Discovery
    regiones: string[] = [
        'Región Metropolitana', 'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 
        'Coquimbo', 'Valparaíso', 'O\'Higgins', 'Maule', 'Ñuble', 'Biobío', 'Araucanía', 
        'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'
    ];
    
    placeholderImg: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='45%25' font-family='sans-serif' font-size='14' font-weight='bold' fill='%2394a3b8' text-anchor='middle'%3ECLUB%3C/text%3E%3Ctext x='50%25' y='62%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'%3EDE PADEL%3C/text%3E%3C/svg%3E";

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'jugador';

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private assetService: AssetService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        if (user) {
            this.userId = user.id;
            this.userName = user.nombre;
            this.userFoto = user.foto_perfil;
            this.userRole = user.rol;
        }
        this.selectedFecha = this.getLocalISODate(new Date());
        this.generateWeekDays();
        this.loadClubes();
    }

    getLocalISODate(date: Date): string {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    generateWeekDays() {
        const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        const result = [];
        const today = new Date();

        // 30 days view (Playtomic style scroller)
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            const dateStr = this.getLocalISODate(d);
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

    scrollDates(direction: number) {
        if (!this.dateContainerRef) return;
        const container = this.dateContainerRef.nativeElement;
        const scrollAmount = 250;
        container.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });
    }

    loadClubes() {
        this.clubesService.getClubes().subscribe(res => {
            this.clubes = res.map(club => {
                club.logo = this.assetService.getAssetUrl(club.logo, 'club');
                return club;
            });
        });
    }

    get filteredClubes() {
        if (!this.selectedRegion) return this.clubes;
        return this.clubes.filter(c => c.region === this.selectedRegion);
    }

    onSelectClub(club: any) {
        this.selectedClub = club;
        this.selectedCancha = null;
        this.horarios = [];
        this.activeSubTab = 'reservar';
        
        // Load court data
        this.clubesService.getCanchas(club.id).subscribe(res => {
            this.canchas = res;
            if (this.canchas.length > 0) {
                this.onSelectCancha(this.canchas[0]);
            }
        });

        // Load tournament data
        this.loadTorneosClub();
    }

    loadTorneosClub() {
        if (!this.selectedClub) return;
        this.clubesService.getTorneosPublicos().subscribe(res => {
            // Filter only for this club and by type
            const clubMatches = res.filter(t => t.club_id === this.selectedClub.id);
            this.torneos = clubMatches.filter(t => t.tipo !== 'Americano');
            this.americanos = clubMatches.filter(t => t.tipo === 'Americano');
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

    // Modal de Reserva (Playtomic Experience)
    reservar(horario: any) {
        if (!horario.disponible) return;

        Swal.fire({
            title: 'Confirmar Reserva',
            html: `
                <div style="text-align: left; font-family: 'Outfit', sans-serif;">
                    <div style="background: #0f172a; color: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="font-size: 14px; opacity: 0.7;">${this.selectedClub.nombre}</div>
                        <div style="font-size: 18px; font-weight: 800;">${this.selectedCancha.nombre}</div>
                        <div style="display: flex; gap: 15px; margin-top: 10px; font-size: 13px;">
                            <span>📅 ${this.selectedFecha}</span>
                            <span>⏰ ${horario.hora_inicio.slice(0, 5)}</span>
                        </div>
                    </div>
                    <div>
                        <p style="font-weight: 800; font-size: 14px; margin-bottom: 10px;">Duración del Partido</p>
                        <select id="swal-duration" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit;">
                            <option value="60">60 Minutos</option>
                            <option value="90" selected>90 Minutos</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Reservar Ahora',
            confirmButtonColor: '#ccff00',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'swal-elite-confirm'
            },
            preConfirm: () => {
                const dur = (document.getElementById('swal-duration') as HTMLSelectElement).value;
                return parseInt(dur);
            }
        }).then(result => {
            if (result.isConfirmed) {
                const duration = result.value;
                const [h, m] = horario.hora_inicio.split(':');
                const totalMin = parseInt(h) * 60 + parseInt(m) + duration;
                const hEnd = Math.floor(totalMin / 60).toString().padStart(2, '0');
                const mEnd = (totalMin % 60).toString().padStart(2, '0');
                
                const reserva = {
                    cancha_id: this.selectedCancha.id,
                    usuario_id: this.userId,
                    jugador_id: this.userId,
                    fecha: this.selectedFecha,
                    hora_inicio: horario.hora_inicio,
                    hora_fin: `${hEnd}:${mEnd}:00`,
                    duracion: duration,
                    estado: 'Confirmada',
                    pagado: 0
                };

                this.clubesService.addReserva(reserva).subscribe({
                    next: () => {
                        Swal.fire('¡Éxito!', 'Tu cancha ha sido reservada.', 'success');
                        this.loadDisponibilidad();
                    },
                    error: (err) => Swal.fire('Error', 'No se pudo completar la reserva', 'error')
                });
            }
        });
    }

    irATorneo(torneo: any) {
        Swal.fire({
            title: torneo.nombre,
            text: `¿Deseas ver más detalles de este torneo?`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Ver Detalles',
            confirmButtonColor: '#0f172a'
        }).then(res => {
            if (res.isConfirmed) {
                this.router.navigate(['/mis-torneos']);
            }
        });
    }
}
