import { Component, OnInit } from '@angular/core';
import { PopupService } from '../../services/popup.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { PacksService } from '../../services/packs.service';
import { AlumnoService } from '../../services/alumno.service';

import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
    selector: 'app-jugador-packs',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './jugador-packs.component.html',
    styleUrls: ['./jugador-packs.component.scss']
})
export class JugadorPacksComponent implements OnInit {
    packs: any[] = [];
    packsFiltrados: any[] = [];
    entrenadores: any[] = [];
    selectedEntrenador: number | null = null;
    userId: number | null = null;

    // User Data matches other components
    jugadorNombre: string = 'Jugador';
    jugadorFoto: string | null = null;

    // Location Filter
    useLocation = true; // Enabled by default as requested
    userLat: number | null = null;
    userLng: number | null = null;
    searchRadius = 50; // Default 50km
    isLoadingLocation = false;

    // View State
    viewMode: 'trainers' | 'packs' = 'trainers';
    selectedTrainer: any = null;

    // Categorized Packs
    activeCategoryTab: 'individual' | 'multi' | 'grupal' = 'individual';
    nextSaturday: string = '';
    packsIndividual: any[] = [];
    packsSmallGroups: any[] = [];
    packsGrupales: any[] = [];

    constructor(
        private mysqlService: MysqlService,
        private packsService: PacksService,
        private alumnoService: AlumnoService,
        private router: Router,
        private route: ActivatedRoute,
        private popupService: PopupService
    ) { }

    ngOnInit(): void {
        this.userId = Number(localStorage.getItem('userId'));
        if (!this.userId) {
            this.router.navigate(['/login']);
            return;
        }
        this.loadUserProfile();
        this.getCurrentLocation(); // Auto-request location
        this.checkPaymentStatus();
        this.calculateNextSaturday();
    }

    calculateNextSaturday(): void {
        const today = new Date();
        const nextSat = new Date();
        // 6 is Saturday. If today is Sat, it adds 7 days to get NEXT sat.
        const daysToSaturday = (6 - today.getDay() + 7) % 7 || 7;
        nextSat.setDate(today.getDate() + daysToSaturday);

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
        this.nextSaturday = nextSat.toLocaleDateString('es-ES', options);
    }

    checkPaymentStatus(): void {
        this.route.queryParams.subscribe(params => {
            const status = params['status'];
            if (status === 'success') {
                this.popupService.success('¡Pago Exitoso!', 'El pack ha sido activado en tu cuenta.');
                // Clean URL
                this.router.navigate([], {
                    queryParams: { 'status': null },
                    queryParamsHandling: 'merge'
                });
            } else if (status === 'error_db' || status === 'error_token') {
                this.popupService.error('Error', 'Hubo un problema confirmando tu pago.');
            } else if (status === 'cancelled') {
                this.popupService.info('Cancelado', 'La compra fue anulada.');
            }
        });
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

    toggleLocation(): void {
        this.useLocation = !this.useLocation;
        if (this.useLocation) {
            this.getCurrentLocation();
        } else {
            this.userLat = null;
            this.userLng = null;
            this.loadPacks(); // Reload all
        }
    }

    getCurrentLocation(): void {
        if (!navigator.geolocation) {
            this.popupService.error('Error', 'Geolocalización no soportada en este navegador');
            this.useLocation = false;
            return;
        }

        this.isLoadingLocation = true;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLat = position.coords.latitude;
                this.userLng = position.coords.longitude;
                this.isLoadingLocation = false;
                this.loadPacks(); // Reload with location
            },
            (error) => {
                console.error('Error getting location', error);
                this.popupService.error('Error', 'No se pudo obtener tu ubicación. Verifica los permisos.');
                this.isLoadingLocation = false;
                this.useLocation = false;
            }
        );
    }

    onRadiusChange(event: any): void {
        this.searchRadius = Number(event.target.value);
        if (this.useLocation && this.userLat && this.userLng) {
            this.loadPacks(); // Reload with new radius
        }
    }

    loadPacks(): void {
        const lat = (this.useLocation && this.userLat) ? this.userLat : undefined;
        const lng = (this.useLocation && this.userLng) ? this.userLng : undefined;
        const rad = (this.useLocation) ? this.searchRadius : undefined;

        this.packsService.getAllPacks(lat, lng, rad).subscribe({
            next: (data: any[]) => {
                this.packs = data || [];
                this.cargarEntrenadores();
                this.filtrarPacks(); // Re-apply other filters if any
            },
            error: (err: any) => {
                console.error('Error al cargar packs', err);
            }
        });
    }

    cargarEntrenadores(): void {
        const map = new Map();
        this.packs.forEach(p => {
            if (p.entrenador_id && !map.has(p.entrenador_id)) {
                map.set(p.entrenador_id, {
                    id: p.entrenador_id,
                    nombre: p.entrenador_nombre,
                    foto: p.entrenador_foto,
                    descripcion: p.entrenador_descripcion || 'Sin descripción disponible.',
                    distancia: p.distancia,
                    comuna: p.trainer_comuna
                });
            }
        });
        // Sort by distance if available
        this.entrenadores = Array.from(map.values()).sort((a, b) => (a.distancia || 999) - (b.distancia || 999));
    }

    selectTrainer(trainer: any): void {
        this.selectedTrainer = trainer;
        this.selectedEntrenador = trainer.id;
        this.viewMode = 'packs';
        this.filtrarPacks();
    }

    backToTrainers(): void {
        this.selectedTrainer = null;
        this.selectedEntrenador = null;
        this.viewMode = 'trainers';
    }

    filtrarPacks(): void {
        let filtered = [...this.packs];

        if (this.selectedEntrenador) {
            filtered = filtered.filter(p => p.entrenador_id == this.selectedEntrenador);
        }

        this.packsFiltrados = filtered;

        // Sort by price (Lower to Higher)
        this.packsFiltrados.sort((a, b) => Number(a.precio) - Number(b.precio));

        // Categorize with more robust checks (handles strings and nulls)
        this.packsIndividual = this.packsFiltrados.filter(p =>
            p.tipo === 'individual' && (Number(p.cantidad_personas) <= 1 || !p.cantidad_personas)
        );
        this.packsSmallGroups = this.packsFiltrados.filter(p =>
            p.tipo === 'individual' && Number(p.cantidad_personas) > 1
        );
        this.packsGrupales = this.packsFiltrados.filter(p =>
            p.tipo === 'grupal'
        );
    }

    onEntrenadorChange(event: any): void {
        const val = event.target.value;
        this.selectedEntrenador = (val === 'null' || val === '') ? null : Number(val);
        this.filtrarPacks();
    }

    comprarPack(pack: any): void {
        this.popupService.confirm(
            '¿Confirmar compra?',
            `Vas a adquirir el pack "${pack.nombre}" por $${pack.precio}.`
        ).then((confirmed) => {
            if (confirmed) {
                this.procesarCompra(pack);
            }
        });
    }

    procesarCompra(pack: any): void {
        if (!this.userId) return;

        this.popupService.info('Procesando...', 'Estamos activando tu pack.');

        const payload = {
            pack_id: pack.id,
            jugador_id: this.userId
        };

        this.alumnoService.insertPack(payload).subscribe({
            next: (res: any) => {
                this.popupService.success('¡Pack Activado!', `El pack "${pack.nombre}" ya está disponible en tu cuenta.`);
                this.router.navigate(['/mis-packs-activos']);
            },
            error: (err) => {
                console.error('Error al activar pack:', err);
                this.popupService.error('Error', 'No se pudo activar el pack. Inténtalo más tarde.');
            }
        });
    }


    irAInicio(): void {
        this.router.navigate(['/jugador-home']);
    }

    irACalendario(): void {
        this.router.navigate(['/jugador-calendario']);
    }

    irAReservas(): void {
        this.router.navigate(['/jugador-reservas']);
    }

    irAPerfil(): void {
        this.router.navigate(['/perfil']);
    }

    logout(): void {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
