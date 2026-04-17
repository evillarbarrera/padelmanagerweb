import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../services/inventario.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-club-ventas',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './club-ventas.component.html',
    styleUrls: ['./club-ventas.component.scss']
})
export class ClubVentasComponent implements OnInit {
    ventas: any[] = [];
    fechaFiltro: string = new Date().toISOString().split('T')[0];
    clubId: number | null = null;
    isLoading: boolean = false;

    // Club Tabs
    clubes: any[] = [];
    selectedClubId: number | null = null; // 0 = Global
    
    // Sidebar Context
    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';
    
    // POS State
    showSaleModal: boolean = false;
    availableProducts: any[] = [];
    allPlayers: any[] = [];
    filteredPlayers: any[] = [];
    playerSearchTerm: string = '';
    selectedPlayer: any = null;
    cart: any[] = [];
    metodoPago: string = 'Efectivo';
    
    // UX & Categories
    selectedCategory: string = 'Todas';
    categories: string[] = ['Bebidas', 'Pelotas', 'Indumentaria', 'Accesorios', 'Otros'];

    globalStats: any = { total: 0, cash: 0, card: 0, ops: 0 };

    get isStaff(): boolean {
        const role = localStorage.getItem('userRole') || '';
        return role.toLowerCase().includes('staff');
    }

    constructor(
        private inventarioService: InventarioService,
        private apiService: ApiService
    ) { }

    ngOnInit(): void {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const profiles = JSON.parse(localStorage.getItem('availableProfiles') || '[]');
        const storedRole = localStorage.getItem('userRole') || '';

        this.userId = currentUser.id;
        this.userName = currentUser.nombre || 'Usuario';
        this.userFoto = currentUser.foto_perfil || null;
        this.userRole = storedRole || currentUser.rol || 'administrador_club';
        
        // Filtrar solo los que tienen club_id asignado (evitar perfiles genéricos)
        this.clubes = profiles.filter((p: any) => p.club_id && p.club_nombre);

        if (this.clubes.length > 0) {
            this.selectedClubId = this.clubes[0].club_id;
            this.clubId = this.selectedClubId;
            this.loadVentas();
        } else if (currentUser.club_id) {
            this.selectedClubId = currentUser.club_id;
            this.clubId = currentUser.club_id;
            this.loadVentas();
        }
    }

    loadGlobalVentas() {
        this.isLoading = true;
        this.globalStats = { total: 0, cash: 0, card: 0, reserve: 0, ops: 0 };
        
        let loaded = 0;
        this.clubes.forEach(c => {
            this.inventarioService.getVentas(c.club_id, this.fechaFiltro, this.fechaFiltro).subscribe({
                next: (res) => {
                    if (res.success) {
                        res.ventas.forEach((v: any) => {
                            const amt = parseFloat(v.total);
                            this.globalStats.total += amt;
                            this.globalStats.ops++;
                            if (v.metodo_pago === 'Efectivo') this.globalStats.cash += amt;
                            else if (v.metodo_pago === 'Reserva' || v.metodo_pago === 'Varios') this.globalStats.reserve += amt;
                            else this.globalStats.card += amt;
                        });
                    }
                    loaded++;
                    if (loaded === this.clubes.length) this.isLoading = false;
                },
                error: (err) => {
                    console.error(`Error cargando ventas del club ${c.club_id}:`, err);
                    loaded++;
                    if (loaded === this.clubes.length) this.isLoading = false;
                }
            });
        });
    }

    selectClub(id: number) {
        this.selectedClubId = id;
        if (id === 0) {
            this.loadGlobalVentas();
        } else {
            this.clubId = id;
            this.loadVentas();
        }
    }

    loadVentas() {
        if (!this.clubId) return;
        this.isLoading = true;
        this.inventarioService.getVentas(this.clubId, this.fechaFiltro, this.fechaFiltro).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                if (res.success) {
                    this.ventas = res.ventas;
                }
            },
            error: () => this.isLoading = false
        });
    }

    // Getters for summary values
    get totalRecaudado() {
        return this.ventas.reduce((acc, v) => acc + parseFloat(v.total), 0);
    }

    get totalEfectivo() {
        return this.ventas
            .filter(v => v.metodo_pago === 'Efectivo')
            .reduce((acc, v) => acc + parseFloat(v.total), 0);
    }

    get totalReservas() {
        return this.ventas
            .filter(v => v.metodo_pago === 'Reserva' || v.metodo_pago === 'Varios')
            .reduce((acc, v) => acc + parseFloat(v.total), 0);
    }

    get totalTarjetas() {
        return this.ventas
            .filter(v => v.metodo_pago !== 'Efectivo' && v.metodo_pago !== 'Reserva' && v.metodo_pago !== 'Varios')
            .reduce((acc, v) => acc + parseFloat(v.total), 0);
    }

    // POS Methods
    openNewSale() {
        if (!this.clubId || this.selectedClubId === 0) {
            Swal.fire('Atención', 'Selecciona un club específico para generar una venta', 'warning');
            return;
        }
        this.showSaleModal = true;
        this.cart = [];
        this.selectedPlayer = null;
        this.playerSearchTerm = "";
        this.loadPOSData();
    }

    loadPOSData() {
        this.inventarioService.getProductos(this.clubId!).subscribe(res => {
            if (res.success) this.availableProducts = res.productos;
        });
        this.apiService.getUsers().subscribe(res => {
            if (Array.isArray(res)) {
                this.allPlayers = res;
                this.filteredPlayers = [];
            }
        });
    }

    searchPlayers() {
        if (!this.playerSearchTerm.trim()) {
            this.filteredPlayers = [];
            return;
        }
        const term = this.playerSearchTerm.toLowerCase();
        this.filteredPlayers = this.allPlayers.filter(u => 
            u.nombre.toLowerCase().includes(term) || (u.email && u.email.toLowerCase().includes(term))
        ).slice(0, 5);
    }

    selectPlayer(p: any) {
        this.selectedPlayer = p;
        this.playerSearchTerm = p.nombre;
        this.filteredPlayers = [];
    }

    addToCart(p: any) {
        const existing = this.cart.find(item => item.id === p.id);
        if (existing) {
            existing.cantidad++;
        } else {
            this.cart.push({ ...p, cantidad: 1 });
        }
    }

    removeFromCart(id: number) {
        this.cart = this.cart.filter(item => item.id !== id);
    }

    get cartTotal() {
        return this.cart.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0);
    }

    get filteredAvailableProducts() {
        return this.availableProducts.filter(p => {
            const matchesCat = this.selectedCategory === 'Todas' || p.categoria === this.selectedCategory;
            return matchesCat;
        });
    }

    finalizarVenta() {
        if (this.cart.length === 0) return;
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const venta = {
            club_id: this.clubId,
            usuario_id: currentUser.id,
            jugador_id: this.selectedPlayer ? this.selectedPlayer.id : null,
            total: this.cartTotal,
            metodo_pago: this.metodoPago,
            items: this.cart.map(item => ({
                id: item.id,
                cantidad: item.cantidad,
                precio_venta: item.precio_venta
            }))
        };

        this.inventarioService.registrarVenta(venta).subscribe(res => {
            if (res.success) {
                Swal.fire('Venta Exitosa', 'La venta ha sido registrada correctamente', 'success');
                this.showSaleModal = false;
                this.loadVentas();
            } else {
                Swal.fire('Error', res.error || 'No se pudo registrar la venta', 'error');
            }
        });
    }

    anularVenta(id: number) {
        Swal.fire({
            title: '¿Anular venta?',
            text: 'Esta acción revertirá el stock de los productos. ¿Estás seguro?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                // Implementar endpoint de anulación si existe
                // Por ahora simulamos éxito local o llamamos a delete si el backend lo soporta
                this.inventarioService.deleteVenta(id).subscribe({
                    next: (res) => {
                        if (res.success) {
                            Swal.fire('Anulada', 'La venta ha sido anulada con éxito', 'success');
                            this.loadVentas();
                        } else {
                            Swal.fire('Error', res.error || 'No se pudo anular la venta', 'error');
                        }
                    },
                    error: (err) => {
                        console.error('Error al anular venta:', err);
                        Swal.fire('Error', 'No se pudo contactar con el servidor para anular la venta. Verifica que delete_venta.php existe.', 'error');
                    }
                });
            }
        });
    }

    editarVenta(v: any) {
        // Lógica futura para editar metadatos de la venta
        Swal.fire('Información', 'La edición de ventas ya realizadas estará disponible próximamente.', 'info');
    }
}
