import { Component, Input, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ClubesService } from '../../services/clubes.service';
import Swal from 'sweetalert2';

import { SidebarService } from '../../services/sidebar.service';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss'],
    standalone: true,
    imports: [CommonModule, RouterModule]
})
export class SidebarComponent implements OnInit {
    @Input() userId: number | null = null;
    @Input() jugadorNombre: string = 'Usuario';
    @Input() activePage: string = '';
    @Input() role: 'jugador' | 'entrenador' | 'administrador_club' | 'administrador' = 'jugador';

    private _jugadorFoto: string | null = null;
    @Input() set jugadorFoto(val: string | null) {
        if (val) {
            this._jugadorFoto = this.formatPhotoUrl(val);
        } else {
            this.applyFallbackFoto();
        }
    }
    get jugadorFoto(): string | null {
        return this._jugadorFoto;
    }

    isOpen = false; // Mobile menu state
    isCollapsed = false; // Desktop collapse state
    showSwitchMenu = false; 

    availableProfiles: any[] = [];

    constructor(
        private router: Router,
        private authService: AuthService,
        private clubesService: ClubesService,
        public sidebarService: SidebarService
    ) { }

    get computedRole(): string {
        let r = (this.role || '').toLowerCase();
        
        // Priority for admin
        if (r === 'administrador') return 'administrador';

        // Fallback to localStorage if role is not provided or is default
        if (r === 'jugador' || !r) {
            const storedRole = localStorage.getItem('userRole');
            if (storedRole) r = storedRole.toLowerCase();
        }

        if (r === 'administrador' || r === 'superadmin') return 'administrador';
        if (r.includes('admin')) return 'administrador_club';
        if (r.includes('entrenador')) return 'entrenador';
        return 'jugador';
    }

    ngOnInit() {
        this.sidebarService.collapsed$.subscribe(v => {
            this.isCollapsed = v;
            if (v) document.body.classList.add('sidebar-collapsed');
            else document.body.classList.remove('sidebar-collapsed');
        });

        // Initial load from local storage
        this.availableProfiles = this.authService.getProfiles().filter(p => !['administrador_club', 'administrador'].includes(p.rol));

        // Subscribe to user changes
        this.authService.currentUser$.subscribe(currentUser => {
            if (currentUser) {
                if (!this.userId) this.userId = currentUser.id;
                if (!this.jugadorNombre || this.jugadorNombre === 'Usuario') {
                    this.jugadorNombre = currentUser.nombre || 'Usuario';
                }
                this.applyFallbackFoto(currentUser);
            }
        });

        // Force refresh from server
        const currentUser = this.authService.getCurrentUser();
        const currentUserId = this.userId || currentUser?.id;
        if (currentUserId) {
            this.authService.refreshSession(currentUserId).subscribe(() => {
                this.availableProfiles = this.authService.getProfiles().filter(p => !['administrador_club', 'administrador'].includes(p.rol));
            });
        }
    }

    private formatPhotoUrl(foto: string): string {
        if (!foto) return '';
        if (foto.startsWith('http')) return foto;
        const cleanPath = foto.startsWith('/') ? foto.substring(1) : foto;
        return `https://api.padelmanager.cl/${cleanPath}`;
    }

    private applyFallbackFoto(user?: any) {
        const currentUser = user || this.authService.getCurrentUser();
        if (currentUser) {
            const fotoRaw = currentUser.foto_perfil || currentUser.link_foto || currentUser.foto;
            if (fotoRaw) {
                this._jugadorFoto = this.formatPhotoUrl(fotoRaw);
            }
        }
    }

    toggleSidebar() {
        this.isOpen = !this.isOpen;
    }

    closeSidebar() {
        this.isOpen = false;
    }

    toggleSwitchMenu() {
        this.showSwitchMenu = !this.showSwitchMenu;
    }

    switchProfile(perfil: any) {
        this.authService.switchProfile(perfil);
    }

    createNewProfile() {
        Swal.fire({
            title: 'Crear Nuevo Perfil',
            html: `
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                    <div id="btn-entrenador" style="cursor: pointer; border: 2px solid #eee; border-radius: 12px; padding: 20px; width: 140px; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#ccff00'; this.style.background='#f9f9f9'"
                        onmouseout="this.style.borderColor='#eee'; this.style.background='transparent'">
                        <div style="font-size: 40px; margin-bottom: 10px;">🎾</div>
                        <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: #111;">Entrenador</h3>
                        <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">Quiero ofrecer clases</p>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => {
                const btnEntrenador = document.getElementById('btn-entrenador');
                btnEntrenador?.addEventListener('click', () => {
                    Swal.close();
                    this.flowEntrenador();
                });
            }
        });
    }

    flowEntrenador() {
        Swal.showLoading();
        this.clubesService.getClubes().subscribe(clubes => {
            Swal.close();
            const options: any = {};
            clubes.forEach(c => options[c.id] = c.nombre);
            let chosenClubId: number = 0;
            Swal.fire({
                title: 'Selecciona tu Club',
                input: 'select',
                inputOptions: options,
                inputPlaceholder: 'Selecciona un club',
                showCancelButton: true,
                confirmButtonText: 'Unirme',
                confirmButtonColor: '#111',
                showLoaderOnConfirm: true,
                preConfirm: (clubId) => {
                    if (!clubId) return Swal.showValidationMessage('Debes seleccionar un club');
                    chosenClubId = parseInt(clubId);
                    return this.authService.addProfile(this.userId!, chosenClubId, 'entrenador').toPromise()
                        .then(res => {
                            if (!res.success) throw new Error(res.message);
                            return this.authService.refreshSession(this.userId!).toPromise();
                        })
                        .catch(err => Swal.showValidationMessage(err.message));
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const profiles = this.authService.getProfiles();
                    const newProfile = profiles.find(p => p.rol === 'entrenador' && p.club_id == chosenClubId);
                    if (newProfile) this.authService.switchProfile(newProfile);
                }
            });
        });
    }

    navigate(path: string) {
        this.closeSidebar(); 
        if (path === 'create-profile') {
            this.createNewProfile();
        } else {
            this.router.navigate([path]);
        }
    }

    logout() {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
