import { Component, Input, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ClubesService } from '../../services/clubes.service';
import Swal from 'sweetalert2';

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
    @Input() jugadorFoto: string | null = null;
    @Input() activePage: string = '';
    @Input() role: 'jugador' | 'entrenador' | 'administrador_club' = 'jugador';

    isOpen = false; // Mobile menu state
    showSwitchMenu = false; // Profile switcher state
    availableProfiles: any[] = [];

    constructor(
        private router: Router,
        private authService: AuthService,
        private clubesService: ClubesService
    ) { }

    get computedRole(): string {
        let r = (this.role || '').toLowerCase();
        // Fallback to localStorage if role is not provided or is default
        if (r === 'jugador' || !r) {
            const storedRole = localStorage.getItem('userRole');
            if (storedRole) r = storedRole.toLowerCase();
        }

        if (r.includes('admin')) return 'administrador_club';
        if (r.includes('entrenador')) return 'entrenador';
        return 'jugador';
    }

    ngOnInit() {
        // Initial load from local storage
        this.availableProfiles = this.authService.getProfiles();

        // Force refresh from server to ensure we have the latest roles (Global, etc.)
        const currentUserId = this.userId || this.authService.getCurrentUser()?.id;
        if (currentUserId) {
            this.authService.refreshSession(currentUserId).subscribe(() => {
                this.availableProfiles = this.authService.getProfiles();
            });
        }
    }

    toggleSidebar() {
        this.isOpen = !this.isOpen;
    }

    closeSidebar() {
        this.isOpen = false;
    }

    // NEW: Profile Switcher
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

                    <div id="btn-admin" style="cursor: pointer; border: 2px solid #eee; border-radius: 12px; padding: 20px; width: 140px; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#ccff00'; this.style.background='#f9f9f9'"
                        onmouseout="this.style.borderColor='#eee'; this.style.background='transparent'">
                        <div style="font-size: 40px; margin-bottom: 10px;">🏢</div>
                        <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: #111;">Encargado Club</h3>
                        <p style="font-size: 11px; color: #666; margin: 5px 0 0 0;">Gestionar mi club</p>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => {
                const btnEntrenador = document.getElementById('btn-entrenador');
                const btnAdmin = document.getElementById('btn-admin');

                btnEntrenador?.addEventListener('click', () => {
                    Swal.close();
                    this.flowEntrenador();
                });

                btnAdmin?.addEventListener('click', () => {
                    Swal.close();
                    this.flowAdmin();
                });
            }
        });
    }

    flowAdmin() {
        Swal.fire({
            title: 'Crear Nuevo Club',
            text: 'Ingresa el nombre de tu club para comenzar',
            input: 'text',
            inputPlaceholder: 'Ej: Padel Center Santiago',
            showCancelButton: true,
            confirmButtonText: 'Crear Club',
            confirmButtonColor: '#111',
            showLoaderOnConfirm: true,
            preConfirm: (nombre) => {
                if (!nombre) return Swal.showValidationMessage('El nombre es requerido');

                const payload = {
                    nombre: nombre,
                    direccion: '',
                    telefono: '',
                    instagram: '',
                    email: '',
                    admin_id: this.userId
                };

                return this.clubesService.addClub(payload).toPromise()
                    .then(response => {
                        if (!response.success && !response.id) {
                            throw new Error(response.message || 'Error al crear');
                        }
                        return this.authService.refreshSession(this.userId!).toPromise();
                    })
                    .catch(error => {
                        Swal.showValidationMessage(`Error: ${error.message}`);
                    });
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Auto-switch to the new Admin profile
                const profiles = this.authService.getProfiles();
                // Find the newest admin profile (or just the first one found, logically unique per club usually, but user could be admin of multiple)
                // Since we just refreshed, it should be there. 
                // We don't have the new club ID easily accessible unless we parse it from response, but simple search is enough for UX improvement.
                const newProfile = profiles.find(p => p.rol === 'administrador_club');

                Swal.fire({
                    icon: 'success',
                    title: '¡Club Creado!',
                    text: 'Cambiando a tu perfil de administrador...',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    if (newProfile) {
                        this.authService.switchProfile(newProfile);
                    } else {
                        window.location.reload();
                    }
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
                text: '¿En qué club realizarás las clases?',
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
                    // Auto-switch to the new Trainer profile
                    const profiles = this.authService.getProfiles();
                    const newProfile = profiles.find(p => p.rol === 'entrenador' && p.club_id == chosenClubId);

                    Swal.fire({
                        icon: 'success',
                        title: '¡Listo!',
                        text: 'Cambiando a tu perfil de entrenador...',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        if (newProfile) {
                            this.authService.switchProfile(newProfile);
                        } else {
                            window.location.reload();
                        }
                    });
                }
            });
        });
    }

    addProfileRemote(role: string, clubId: number) {
        // Deprecated by new flows
    }

    // Navigation Helper
    navigate(path: string) {
        this.closeSidebar(); // Close on navigation
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
