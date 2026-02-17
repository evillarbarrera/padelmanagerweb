import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ApiService } from '../../services/api.service';
import { ClubesService } from '../../services/clubes.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-torneo-jugador',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './torneo-jugador.component.html',
    styleUrls: ['./torneo-jugador.component.scss']
})
export class TorneoJugadorComponent implements OnInit {
    userId: number = 0;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'jugador';

    misPartidos: any[] = [];
    miGrupo: any = null;
    rankingGrupo: any[] = [];

    // Available tournaments properties
    availableTournaments: any[] = [];
    isLoading: boolean = false;
    userRegion: string = '';
    userComuna: string = '';

    activeTab: 'mis-torneos' | 'disponibles' = 'mis-torneos';
    myTournaments: any[] = [];

    constructor(
        private apiService: ApiService,
        private clubesService: ClubesService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        if (user) {
            this.userId = user.id;
            this.userName = user.nombre || 'Jugador';
            this.userFoto = user.foto || null;
            this.userRole = user.rol || 'jugador';

            this.loadUserData();
            this.loadMyTournaments(); // Load registered tournaments
        } else {
            this.router.navigate(['/login']);
        }
    }

    viewTournamentDetails(t: any): void {
        this.isLoading = true;
        this.clubesService.getParticipantesTorneo(t.id).subscribe({
            next: (participantes: any[]) => {
                this.isLoading = false;
                let html = '<ul style="text-align: left; list-style: none; padding: 0;">';
                if (participantes.length === 0) {
                    html += '<li>No hay participantes aún.</li>';
                }
                participantes.forEach((p: any, index: number) => {
                    const isMe = (p.jugador_id == this.userId || p.jugador2_id == this.userId);
                    const bg = isMe ? '#f0f9ff' : 'transparent';
                    html += `<li style="padding: 8px; border-bottom: 1px solid #eee; background: ${bg}; border-radius: 4px;">
                        <b>${index + 1}.</b> ${p.nombre_pareja} ${isMe ? '(Tú)' : ''}
                    </li>`;
                });
                html += '</ul>';

                Swal.fire({
                    title: t.nombre,
                    html: `
                        <p style="color: #64748b;">${t.club_nombre} | ${t.fecha}</p>
                        <h4 style="margin-top: 15px; margin-bottom: 10px; border-bottom: 2px solid #2d5a27; display: inline-block;">Parejas Inscritas</h4>
                        <div style="max-height: 300px; overflow-y: auto; font-size: 14px;">
                            ${html}
                        </div>
                    `,
                    confirmButtonText: 'Cerrar',
                    confirmButtonColor: '#333'
                });
            },
            error: (err: any) => {
                this.isLoading = false;
                Swal.fire('Error', 'No se pudieron cargar los participantes', 'error');
            }
        });
    }

    loadUserData(): void {
        this.apiService.getPerfil(this.userId).subscribe({
            next: (res) => {
                if (res.success && res.user) {
                    this.userName = res.user.nombre || this.userName;
                    this.userFoto = res.user.foto_perfil || this.userFoto;
                    this.userRole = res.user.rol || this.userRole;
                }

                if (res.direccion) {
                    this.userRegion = res.direccion.region;
                    // this.userComuna = res.direccion.comuna; // Maybe relax comuna for broader search
                    this.loadAvailableTournaments();
                } else {
                    this.loadAvailableTournaments();
                }
            },
            error: (err) => {
                console.error('Error loading profile', err);
                this.loadAvailableTournaments();
            }
        });
    }

    loadMyTournaments(): void {
        this.clubesService.getMyTournaments(this.userId).subscribe({
            next: (res) => {
                this.myTournaments = res;
            },
            error: (err) => console.error('Error loading my tournaments', err)
        });
    }

    loadAvailableTournaments(showAll: boolean = false): void {
        this.isLoading = true;
        this.clubesService.getTorneosPublicos(this.userRegion, this.userComuna, showAll).subscribe({
            next: (res) => {
                this.availableTournaments = res;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading tournaments', err);
                this.isLoading = false;
            }
        });
    }

    inscribirse(torneoId: number): void {
        this.isLoading = true;
        this.apiService.getUsers('jugador').subscribe({
            next: (users) => {
                this.isLoading = false;

                let selectedUserId: number | null = null;
                let finalPartnerName = '';

                Swal.fire({
                    title: 'Inscribir Pareja',
                    html: `
                        <div style="text-align: left; padding: 0 5px;">
                            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Escribe el nombre de tu compañero:</p>
                            <div style="position: relative;">
                                <input id="partner-search" class="swal2-input" placeholder="Buscar usuario o escribir nombre..." 
                                       style="width: 100%; margin: 0; box-sizing: border-box; font-size: 15px;">
                                <div id="results-container" style="position: absolute; width: 100%; max-height: 180px; 
                                     overflow-y: auto; margin-top: 2px; border: 1px solid #ddd; border-radius: 8px; 
                                     display: none; background: #fff; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                </div>
                            </div>
                            <div id="selection-badge" style="display: none; margin-top: 10px; padding: 8px 12px; 
                                 background: #f0f4ef; border-radius: 20px; border: 1px solid #2d5a27; color: #2d5a27; font-weight: 600; font-size: 13px;">
                                <span id="selected-name"></span>
                                <span id="remove-selection" style="margin-left: 10px; cursor: pointer; color: #d32f2f;">✕</span>
                            </div>
                            <p id="hint-text" style="font-size: 11px; color: #999; margin-top: 10px;">
                                * Si aparece en la lista, selecciónalo para que el torneo cuente para su ranking.
                            </p>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Inscribirse',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#2d5a27',
                    didOpen: () => {
                        const input = document.getElementById('partner-search') as HTMLInputElement;
                        const container = document.getElementById('results-container') as HTMLElement;
                        const badge = document.getElementById('selection-badge') as HTMLElement;
                        const selectedNameSpan = document.getElementById('selected-name') as HTMLElement;
                        const removeBtn = document.getElementById('remove-selection') as HTMLElement;
                        const hint = document.getElementById('hint-text') as HTMLElement;

                        const updateSelection = (id: number | null, name: string) => {
                            selectedUserId = id;
                            finalPartnerName = name;
                            if (id) {
                                input.style.display = 'none';
                                container.style.display = 'none';
                                badge.style.display = 'inline-block';
                                selectedNameSpan.textContent = `Registrado: ${name}`;
                                hint.textContent = '✓ Vinculado a usuario registrado';
                            } else {
                                input.style.display = 'block';
                                badge.style.display = 'none';
                                hint.textContent = '* Si aparece en la lista, selecciónalo para su ranking.';
                            }
                        };

                        removeBtn.onclick = () => updateSelection(null, input.value);

                        input.addEventListener('input', (e) => {
                            const val = (e.target as HTMLInputElement).value.toLowerCase();
                            finalPartnerName = (e.target as HTMLInputElement).value;

                            if (val.length < 2) {
                                container.style.display = 'none';
                                return;
                            }

                            const filtered = users.filter((u: any) =>
                                u.nombre.toLowerCase().includes(val) && u.id !== this.userId
                            ).slice(0, 5);

                            if (filtered.length > 0) {
                                container.innerHTML = filtered.map((u: any) => `
                                    <div class="swal-search-item" data-id="${u.id}" data-name="${u.nombre}" 
                                         style="padding: 12px; cursor: pointer; border-bottom: 1px solid #f5f5f5; text-align: left;">
                                        <div style="font-weight: 600; font-size: 14px; color: #333;">${u.nombre}</div>
                                        <div style="font-size: 11px; color: #2d5a27;">Compañero Registrado • ${u.categoria || 'Sin nivel'}</div>
                                    </div>
                                `).join('');
                                container.style.display = 'block';

                                container.querySelectorAll('.swal-search-item').forEach(item => {
                                    (item as HTMLElement).onmouseover = () => (item as HTMLElement).style.background = '#f9f9f9';
                                    (item as HTMLElement).onmouseout = () => (item as HTMLElement).style.background = '#fff';
                                    (item as HTMLElement).onclick = () => {
                                        updateSelection(
                                            parseInt(item.getAttribute('data-id') || '0'),
                                            item.getAttribute('data-name') || ''
                                        );
                                    };
                                });
                            } else {
                                container.style.display = 'none';
                            }
                        });
                    },
                    preConfirm: () => {
                        const name = finalPartnerName || (document.getElementById('partner-search') as HTMLInputElement).value;
                        if (!name) {
                            Swal.showValidationMessage('¡El nombre es obligatorio!');
                            return false;
                        }
                        return { id: selectedUserId, name: name };
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        this.confirmRegistration(torneoId, result.value.id, result.value.name, !!result.value.id);
                    }
                });
            },
            error: (err) => {
                this.isLoading = false;
                Swal.fire({
                    title: 'Nombre de tu Pareja',
                    input: 'text',
                    showCancelButton: true,
                    confirmButtonColor: '#2d5a27'
                }).then(r => {
                    if (r.isConfirmed && r.value) this.confirmRegistration(torneoId, null, r.value, false);
                });
            }
        });
    }

    private confirmRegistration(torneoId: number, partnerId: any, partnerName: string, isRegistered: boolean): void {
        this.isLoading = true;

        const registrationData: any = {
            torneo_id: torneoId,
            usuario_id: this.userId
        };

        if (isRegistered) {
            registrationData.jugador2_id = partnerId;
            registrationData.nombre_pareja = 'Pareja con ' + partnerName;
        } else {
            registrationData.nombre_2 = partnerName;
            registrationData.nombre_pareja = 'Pareja con ' + partnerName;
        }

        this.clubesService.joinTorneoManual(registrationData).subscribe({
            next: (res) => {
                Swal.fire({
                    title: '¡Éxito!',
                    text: 'Inscripción realizada correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#2d5a27'
                });
                this.loadAvailableTournaments();
            },
            error: (err) => {
                this.isLoading = false;
                const errMsg = err.error?.error || 'Error al inscribirse';
                Swal.fire({
                    title: 'Error',
                    text: errMsg,
                    icon: 'error',
                    confirmButtonColor: '#2d5a27'
                });
            }
        });
    }

    navigate(path: string) {
        this.router.navigate([path]);
    }
}
