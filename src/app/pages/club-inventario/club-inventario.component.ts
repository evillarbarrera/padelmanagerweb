import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../services/inventario.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-club-inventario',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './club-inventario.component.html',
    styleUrls: ['./club-inventario.component.scss']
})
export class ClubInventarioComponent implements OnInit {
    productos: any[] = [];
    searchTerm: string = '';
    clubId: number | null = null;
    isLoading: boolean = false;
    
    // Club Tabs
    clubes: any[] = [];
    selectedClubId: number | null = null; // 0 = Global / Admin view
    globalStats: any = { total: 0, lowStock: 0, totalValue: 0 };
    allClubProductos: any[] = [];

    // Sidebar Context
    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    // Modal State
    showModal: boolean = false;
    isEditing: boolean = false;
    editingProd: any = this.resetProd();

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
            this.loadProductos();
        } else if (currentUser.club_id) {
            this.selectedClubId = currentUser.club_id;
            this.clubId = currentUser.club_id;
            this.loadProductos();
        }
    }

    loadGlobalData() {
        this.isLoading = true;
        this.allClubProductos = [];
        this.globalStats = { total: 0, lowStock: 0, totalValue: 0 };
        
        let loaded = 0;
        this.clubes.forEach(c => {
            this.inventarioService.getProductos(c.club_id).subscribe(res => {
                if (res.success) {
                    this.allClubProductos = [...this.allClubProductos, ...res.productos];
                    this.globalStats.total += res.productos.length;
                    this.globalStats.lowStock += res.productos.filter((p: any) => p.stock_actual <= p.stock_minimo).length;
                    this.globalStats.totalValue += res.productos.reduce((acc: number, p: any) => acc + (p.stock_actual * p.precio_venta), 0);
                }
                loaded++;
                if (loaded === this.clubes.length) this.isLoading = false;
            });
        });
    }

    selectClub(id: number) {
        this.selectedClubId = id;
        if (id === 0) {
            this.loadGlobalData();
        } else {
            this.clubId = id;
            this.loadProductos();
        }
    }

    loadProductos() {
        if (!this.clubId) return;
        this.inventarioService.getProductos(this.clubId).subscribe(res => {
            if (res.success) {
                this.productos = res.productos;
            }
        });
    }

    get filteredProductos() {
        return this.productos.filter(p => 
            p.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            p.categoria.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    // Stats Getters
    get lowStockCount() {
        return this.productos.filter(p => p.stock_actual <= p.stock_minimo).length;
    }

    get totalInventoryValue() {
        return this.productos.reduce((acc, p) => acc + (p.stock_actual * p.precio_venta), 0);
    }

    resetProd() {
        return {
            nombre: '',
            categoria: 'Otros',
            precio_costo: 0,
            precio_venta: 0,
            stock_actual: 0,
            stock_minimo: 5
        };
    }

    openAddModal() {
        this.isEditing = false;
        this.editingProd = this.resetProd();
        this.showModal = true;
    }

    editarProducto(p: any) {
        this.isEditing = true;
        this.editingProd = { ...p };
        this.showModal = true;
    }

    eliminarProducto(p: any) {
        Swal.fire({
            title: '¿Eliminar producto?',
            text: `¿Estás seguro de desactivar ${p.nombre}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.inventarioService.deleteProducto(p.id).subscribe(res => {
                    if (res.success) {
                        this.loadProductos();
                        Swal.fire('Eliminado', 'El producto ha sido desactivado', 'success');
                    }
                });
            }
        });
    }

    closeModal() {
        this.showModal = false;
    }

    saveProducto() {
        if (!this.editingProd.nombre || this.editingProd.precio_venta < 0) {
            alert('Por favor completa los campos correctamente.');
            return;
        }

        this.isLoading = true;
        const payload = { ...this.editingProd, club_id: this.clubId };

        this.inventarioService.addProducto(payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                if (res.success) {
                    this.loadProductos();
                    this.closeModal();
                }
            },
            error: (err) => {
                this.isLoading = false;
                console.error('Error saving product', err);
            }
        });
    }
}
