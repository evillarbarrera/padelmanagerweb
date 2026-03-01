import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-club-admin',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './club-admin.component.html',
    styleUrls: ['./club-admin.component.scss']
})
export class ClubAdminComponent implements OnInit {
    clubes: any[] = [];
    canchas: any[] = [];
    selectedClub: any = null;

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    activeTab: 'list' | 'create' = 'list';
    isLoading: boolean = false;

    newClub = {
        nombre: '',
        direccion: '',
        region: '',
        comuna: '',
        telefono: '',
        instagram: '',
        email: '',
        admin_id: 0
    };

    regions = [
        { id: '13', name: 'Metropolitana de Santiago' },
        { id: '15', name: 'Arica y Parinacota' },
        { id: '1', name: 'Tarapacá' },
        { id: '2', name: 'Antofagasta' },
        { id: '3', name: 'Atacama' },
        { id: '4', name: 'Coquimbo' },
        { id: '5', name: 'Valparaíso' },
        { id: '6', name: 'O\'Higgins' },
        { id: '7', name: 'Maule' },
        { id: '16', name: 'Ñuble' },
        { id: '8', name: 'Biobío' },
        { id: '9', name: 'Araucanía' },
        { id: '14', name: 'Los Ríos' },
        { id: '10', name: 'Los Lagos' },
        { id: '11', name: 'Aysén' },
        { id: '12', name: 'Magallanes' }
    ];

    allComunas: any = {
        '13': ['Santiago', 'Las Condes', 'Providencia', 'Ñuñoa', 'Maipú', 'Puente Alto', 'La Florida', 'Vitacura', 'Lo Barnechea', 'Colina', 'Lampa', 'San Bernardo', 'Peñalolén'],
        '15': ['Arica', 'Camarones', 'Putre', 'General Lagos'],
        '1': ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Pica', 'Huara'],
        '2': ['Antofagasta', 'Calama', 'Mejillones', 'Taltal', 'Tocopilla'],
        '3': ['Copiapó', 'Vallenar', 'Caldera', 'Chañaral', 'Huasco'],
        '4': ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Vicuña', 'Salamanca'],
        '5': ['Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'Limache', 'Quillota', 'San Antonio', 'Los Andes', 'San Felipe'],
        '6': ['Rancagua', 'Machalí', 'Rengo', 'San Fernando', 'Pichilemu', 'Santa Cruz'],
        '7': ['Talca', 'Curicó', 'Linares', 'Constitución', 'Cauquenes', 'Parral'],
        '16': ['Chillán', 'Chillán Viejo', 'San Carlos', 'Bulnes', 'Yungay'],
        '8': ['Concepción', 'Talcahuano', 'San Pedro de la Paz', 'Chiguayante', 'Hualpén', 'Los Ángeles', 'Coronel', 'Lota', 'Tomé', 'Penco'],
        '9': ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Victoria', 'Lautaro'],
        '14': ['Valdivia', 'La Unión', 'Río Bueno', 'Panguipulli', 'Paillaco', 'Mariquina'],
        '10': ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro', 'Ancud', 'Quellón', 'Frutillar'],
        '11': ['Coyhaique', 'Puerto Aysén', 'Chile Chico', 'Cochrane'],
        '12': ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Cabo de Hornos']
    };

    filteredComunas: string[] = [];

    newCancha = {
        club_id: 0,
        nombre: '',
        tipo: 'Outdoor',
        superficie: 'Césped Sintético',
        precio_hora: 0
    };

    updateComunas(): void {
        const selectedRegion = this.regions.find(r => r.name === this.newClub.region);
        if (selectedRegion) {
            this.filteredComunas = this.allComunas[selectedRegion.id] || [];
            this.newClub.comuna = '';
        } else {
            this.filteredComunas = [];
            this.newClub.comuna = '';
        }
    }

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const storedRole = localStorage.getItem('userRole') || '';
        const storedUserId = localStorage.getItem('userId');
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        if (!storedUserId || (!storedRole.toLowerCase().includes('admin') && !storedRole.toLowerCase().includes('administrador'))) {
            this.router.navigate(['/login']);
            return;
        }

        this.userId = Number(storedUserId);
        this.userName = storedUser?.nombre || '';
        this.userFoto = storedUser?.foto_perfil || null;
        this.userRole = storedUser?.rol || storedRole;
        this.newClub.admin_id = this.userId;
        this.loadClubes();

        // Fetch fresh profile data to ensure photo is correct
        this.apiService.getPerfil(this.userId!).subscribe({
            next: (res) => {
                if (res.success && res.user) {
                    this.userFoto = res.user.foto_perfil || this.userFoto;
                    this.userName = res.user.nombre || this.userName;
                }
            }
        });
    }

    loadClubes() {
        if (!this.userId) return;
        this.clubesService.getClubes(this.userId).subscribe(res => {
            this.clubes = res;
        });
    }

    editingCanchaId: number | null = null;
    editingClubId: number | null = null;

    // ... existing properties ...

    selectClub(club: any) {
        this.selectedClub = club;
        this.cancelEditCancha(); // Reset form
        this.newCancha.club_id = club.id;
        this.loadCanchas(club.id);
    }

    loadCanchas(clubId: number) {
        this.clubesService.getCanchas(clubId).subscribe(res => {
            this.canchas = res;
        });
    }

    editClub(club: any, event: Event) {
        event.stopPropagation();
        this.editingClubId = club.id;
        this.newClub = {
            ...club,
            admin_id: this.userId || 0
        };
        this.updateComunas(); // To load the correct comunas for the region
        this.newClub.comuna = club.comuna; // Re-set because updateComunas might clear it
        this.activeTab = 'create';
    }

    cancelEditClub() {
        this.editingClubId = null;
        this.newClub = {
            nombre: '',
            direccion: '',
            region: '',
            comuna: '',
            telefono: '',
            instagram: '',
            email: '',
            admin_id: this.userId || 0
        };
        this.activeTab = 'list';
    }

    createClub() {
        if (!this.newClub.nombre) return;

        this.isLoading = true;

        if (this.editingClubId) {
            this.clubesService.updateClub({ ...this.newClub, id: this.editingClubId }).subscribe({
                next: () => {
                    Swal.fire('Actualizado', 'Club actualizado correctamente', 'success');
                    this.loadClubes();
                    this.cancelEditClub();
                    this.isLoading = false;
                },
                error: (err) => {
                    console.error('Update error:', err);
                    let msg = 'No se pudo actualizar el club';
                    if (err.error) {
                        msg = typeof err.error.error === 'string' ? err.error.error :
                            (typeof err.error === 'string' ? err.error : JSON.stringify(err.error));
                    }
                    Swal.fire('Error', msg, 'error');
                    this.isLoading = false;
                }
            });
        } else {
            this.clubesService.addClub(this.newClub).subscribe({
                next: () => {
                    Swal.fire('Creado', 'Club creado correctamente', 'success');
                    this.loadClubes();
                    this.cancelEditClub();
                    this.isLoading = false;
                },
                error: (err) => {
                    console.error('Create error:', err);
                    let msg = 'No se pudo crear el club';
                    if (err.error) {
                        msg = typeof err.error.error === 'string' ? err.error.error :
                            (typeof err.error === 'string' ? err.error : JSON.stringify(err.error));
                    }
                    Swal.fire('Error', msg, 'error');
                    this.isLoading = false;
                }
            });
        }
    }

    deleteClub(club: any, event: Event) {
        event.stopPropagation(); // Evitar que se seleccione el club al hacer click en borrar

        Swal.fire({
            title: '¿Confirmar eliminación?',
            text: `¿Estás seguro de que deseas eliminar el club "${club.nombre}"? Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33',
        }).then((result) => {
            if (result.isConfirmed && this.userId) {
                this.clubesService.deleteClub(club.id, this.userId).subscribe({
                    next: (res) => {
                        Swal.fire('¡Eliminado!', res.message, 'success');
                        this.loadClubes();
                        if (this.selectedClub?.id === club.id) {
                            this.selectedClub = null;
                        }
                    },
                    error: (err) => {
                        const errMsg = err.error?.error || 'No se pudo eliminar el club';
                        Swal.fire('Error', errMsg, 'error');
                    }
                });
            }
        });
    }

    editCancha(cancha: any) {
        this.editingCanchaId = cancha.id;
        this.newCancha = { ...cancha, club_id: this.selectedClub.id };

        // Scroll to form (optional UX)
        setTimeout(() => {
            const form = document.querySelector('.cancha-form-section');
            if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    cancelEditCancha() {
        this.editingCanchaId = null;
        this.newCancha = {
            club_id: this.selectedClub?.id || 0,
            nombre: '',
            tipo: 'Outdoor',
            superficie: 'Césped Sintético',
            precio_hora: 0
        };
    }

    saveCancha() {
        if (!this.newCancha.nombre || !this.newCancha.club_id) return;

        if (this.editingCanchaId) {
            this.clubesService.updateCancha({ ...this.newCancha, id: this.editingCanchaId }).subscribe({
                next: () => {
                    Swal.fire('Actualizado', 'Cancha actualizada correctamente', 'success');
                    this.loadCanchas(this.newCancha.club_id);
                    this.cancelEditCancha();
                },
                error: (err) => Swal.fire('Error', 'No se pudo actualizar', 'error')
            });
        } else {
            this.clubesService.addCancha(this.newCancha).subscribe(() => {
                Swal.fire('Creada', 'Cancha creada correctamente', 'success');
                this.loadCanchas(this.newCancha.club_id);
                this.cancelEditCancha(); // Resets form but keeps club_id
            });
        }
    }

    deleteCancha(cancha: any) {
        Swal.fire({
            title: '¿Eliminar cancha?',
            text: `Se eliminará la cancha "${cancha.nombre}".`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.deleteCancha(cancha.id).subscribe({
                    next: () => {
                        Swal.fire('Eliminado', 'Cancha eliminada', 'success');
                        this.loadCanchas(this.selectedClub.id);
                    },
                    error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
                });
            }
        });
    }
}
