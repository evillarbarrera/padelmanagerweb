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
    useLocation = false;
    userLat: number | null = null;
    userLng: number | null = null;
    searchRadius = 20; // Default 20km
    isLoadingLocation = false;

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
        this.loadPacks(); // Initial load without location
        this.checkPaymentStatus();
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
                    nombre: p.entrenador_nombre
                });
            }
        });
        this.entrenadores = Array.from(map.values());
    }

    filtrarPacks(): void {
        let filtered = [...this.packs];

        // Filter by Coach
        if (this.selectedEntrenador) {
            filtered = filtered.filter(p => p.entrenador_id == this.selectedEntrenador);
        }

        this.packsFiltrados = filtered;
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

        // CLIENT-SIDE TOKEN GENERATION (Bypass Remote Mock Bank)
        try {
            const payload = JSON.stringify({
                pack_id: pack.id,
                jugador_id: this.userId,
                origin: window.location.href.split('?')[0]
            });
            const token = btoa(payload);
            const confirmUrl = 'https://api.padelmanager.cl/pagos/confirm_transaction.php';

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = confirmUrl;

            const inputToken = document.createElement('input');
            inputToken.type = 'hidden';
            inputToken.name = 'token_ws';
            inputToken.value = token;

            form.appendChild(inputToken);
            document.body.appendChild(form);
            form.submit();
        } catch (e) {
            console.error('Error constructing purchase token', e);
            this.popupService.error('Error', 'No se pudo iniciar la compra.');
        }
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
