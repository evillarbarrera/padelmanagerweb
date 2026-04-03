import { Component, OnInit } from '@angular/core';
import { PopupService } from '../../services/popup.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { PacksService } from '../../services/packs.service';
import { AlumnoService } from '../../services/alumno.service';
import { CurrencyService } from '../../services/currency.service';

import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-jugador-packs',
    standalone: true,
    imports: [CommonModule, SidebarComponent, FormsModule],
    templateUrl: './jugador-packs.component.html',
    styleUrls: ['./jugador-packs.component.scss']
})
export class JugadorPacksComponent implements OnInit {
    packs: any[] = [];
    packsFiltrados: any[] = [];
    entrenadores: any[] = [];
    selectedEntrenador: number | null = null;
    userId: number | null = null;

    // User Data
    jugadorNombre: string = 'Jugador';
    jugadorFoto: string | null = null;

    // Location Filter
    useLocation = true;
    userLat: number | null = null;
    userLng: number | null = null;
    searchRadius = 50;
    isLoadingLocation = false;

    // Currency & PayPal
    isInternational = false;
    usdPrice: number | null = null;
    selectedPackForPaypal: any = null;
    paypalLoaded = false;

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
        private currencyService: CurrencyService,
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
        this.detectCurrency();
        this.getCurrentLocation();
        this.checkPaymentStatus();
        this.calculateNextSaturday();
    }

    detectCurrency(): void {
        this.currencyService.detectLocation().subscribe(country => {
            this.isInternational = country !== 'CL';
            if (this.isInternational) {
                this.loadPaypalScript();
            }
        });
    }

    loadPaypalScript(): void {
        if (this.paypalLoaded) return;
        const script = document.createElement('script');
        script.src = 'https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD';
        script.onload = () => {
            this.paypalLoaded = true;
        };
        document.body.appendChild(script);
    }

    calculateNextSaturday(): void {
        const today = new Date();
        const nextSat = new Date();
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
                this.router.navigate([], { queryParams: { 'status': null }, queryParamsHandling: 'merge' });
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
            this.loadPacks();
        }
    }

    getCurrentLocation(): void {
        if (!navigator.geolocation) {
            this.popupService.error('Error', 'Geolocalización no soportada');
            this.useLocation = false;
            return;
        }
        this.isLoadingLocation = true;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLat = position.coords.latitude;
                this.userLng = position.coords.longitude;
                this.isLoadingLocation = false;
                this.loadPacks();
            },
            (error) => {
                this.isLoadingLocation = false;
                this.loadPacks();
            }
        );
    }

    onRadiusChange(event: any): void {
        this.searchRadius = Number(event.target.value);
        if (this.useLocation && this.userLat && this.userLng) {
            this.loadPacks();
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
                this.filtrarPacks();
            },
            error: (err: any) => console.error('Error al cargar packs', err)
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
        this.packsFiltrados.sort((a, b) => Number(a.precio) - Number(b.precio));
        this.packsIndividual = this.packsFiltrados.filter(p => p.tipo === 'individual' && (Number(p.cantidad_personas) <= 1 || !p.cantidad_personas));
        this.packsSmallGroups = this.packsFiltrados.filter(p => p.tipo === 'individual' && Number(p.cantidad_personas) > 1);
        this.packsGrupales = this.packsFiltrados.filter(p => p.tipo === 'grupal');
    }

    onEntrenadorChange(event: any): void {
        const val = event.target.value;
        this.selectedEntrenador = (val === 'null' || val === '') ? null : Number(val);
        this.filtrarPacks();
    }

    async comprarPack(pack: any) {
        if (this.isInternational) {
            this.selectedPackForPaypal = pack;
            this.usdPrice = this.currencyService.getUsdAmount(pack.precio);
            
            this.popupService.confirm(
                'Pago Internacional',
                `El monto es $${pack.precio} CLP. Para pagos internacionales se convertirá a $${this.usdPrice} USD. ¿Proceder con PayPal?`
            ).then(confirmed => {
                if (confirmed) {
                    this.renderPaypalButton(pack);
                }
            });
            return;
        }

        this.mysqlService.getHomeStats(Number(this.userId)).subscribe({
            next: (res: any) => {
                const disponibles = res.estadisticas?.packs?.disponibles || 0;
                if (disponibles > 0) {
                    this.popupService.warning('Acción restringida', 'Ya tienes créditos disponibles.');
                    return;
                }
                this.popupService.confirm('¿Confirmar compra?', `Vas a adquirir "${pack.nombre}" por $${pack.precio}.`).then((confirmed) => {
                    if (confirmed) {
                        if (pack.transbank_activo == 1 || pack.transbank_activo == '1') {
                            this.iniciarPagoTransbank(pack);
                        } else {
                            this.procesarCompraManual(pack);
                        }
                    }
                });
            }
        });
    }

    renderPaypalButton(pack: any): void {
        setTimeout(() => {
            const container = document.getElementById('paypal-button-container');
            if (container) {
                container.innerHTML = '';
                (window as any).paypal.Buttons({
                    createOrder: (data: any, actions: any) => {
                        return actions.order.create({
                            purchase_units: [{
                                amount: { value: this.currencyService.getUsdAmount(pack.precio).toString() },
                                description: `Pack: ${pack.nombre}`
                            }]
                        });
                    },
                    onApprove: (data: any, actions: any) => {
                        return actions.order.capture().then((details: any) => {
                            this.verifyPaypalPayment(data.orderID, pack);
                        });
                    }
                }).render('#paypal-button-container');
            }
        }, 100);
    }

    verifyPaypalPayment(orderID: string, pack: any): void {
        this.popupService.info('Verificando pago...', 'No cierres esta ventana.');
        this.mysqlService.postApi('pagos/paypal_capture.php', {
            orderID: orderID,
            pack_id: pack.id,
            jugador_id: this.userId,
            amount_usd: this.currencyService.getUsdAmount(pack.precio)
        }).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.popupService.success('¡Pago Exitoso!', 'Tu pack ha sido activado.');
                    this.router.navigate(['/alumno-clases']);
                } else {
                    this.popupService.error('Error', res.error || 'No se pudo validar el pago.');
                }
            },
            error: () => this.popupService.error('Error', 'Error de conexión.')
        });
    }

    async iniciarPagoTransbank(pack: any) {
        this.isLoadingLocation = true;
        const packId = Number(pack.id || pack.pack_id);
        const paymentPayload = { pack_id: packId, jugador_id: Number(this.userId), amount: pack.precio, origin: window.location.origin + window.location.pathname };
        this.alumnoService.initTransaction(paymentPayload).subscribe({
            next: (payRes: any) => {
                this.isLoadingLocation = false;
                if (payRes.token && payRes.url) {
                    window.location.href = `${payRes.url}${payRes.url.includes('?') ? '&' : '?'}token_ws=${payRes.token}`;
                } else {
                    this.popupService.error('Error', 'No se pudo generar el enlace de pago.');
                }
            },
            error: (err) => {
                this.isLoadingLocation = false;
                this.popupService.error('Error', 'Error al conectar con la pasarela.');
            }
        });
    }

    procesarCompraManual(pack: any): void {
        if (!this.userId) return;
        this.popupService.info('Procesando...', 'Estamos activando tu pack.');
        const payload = { pack_id: pack.id, jugador_id: this.userId };
        this.alumnoService.insertPack(payload).subscribe({
            next: (res: any) => {
                this.popupService.success('¡Pack Activado!', `El pack "${pack.nombre}" ya está disponible.`);
                this.router.navigate(['/mis-packs-activos']);
            },
            error: (err) => this.popupService.error('Error', 'No se pudo activar el pack.')
        });
    }

    logout(): void {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
