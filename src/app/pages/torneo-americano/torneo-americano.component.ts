import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-torneo-americano',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './torneo-americano.component.html',
    styleUrls: ['./torneo-americano.component.scss']
})
export class TorneoAmericanoComponent implements OnInit {
    clubes: any[] = [];
    torneos: any[] = [];
    selectedTorneo: any = null;
    participantes: any[] = [];
    matches: any[] = [];
    allUsers: any[] = [];
    filteredUsers: any[] = [];
    searchTerm: string = '';
    matchesGrouped: any[] = [];
    levelMapping: any = {
        'Primera': 1, 'Segunda': 2, 'Tercera': 3, 'Cuarta': 4, 'Quinta': 5, 'Sexta': 6,
        'A': 3, 'B': 4, 'C': 5, 'D': 6
    };

    // Slots para armar la pareja
    pairingSlot1: any = null;
    pairingSlot2: any = null;
    editingParticipanteId: number | null = null;

    userId: number = 0;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    // Tab State
    activeTab: 'create' | 'list' | 'history' = 'list';
    activeDetailTab: 'inscription' | 'fixture' | 'ranking' = 'inscription';
    activeRoundTab: number = 1;
    activeFaseTab: string = '';

    torneo = {
        club_id: 0,
        nombre: '',
        fecha: '',
        hora_inicio: '',
        num_canchas: 2,
        tiempo_por_partido: 20,
        puntos_ganado: 3,
        puntos_empate: 1,
        puntos_1er_lugar: 100,
        puntos_2do_lugar: 60,
        puntos_3er_lugar: 40,
        puntos_4to_lugar: 20,
        puntos_participacion: 5,
        max_parejas: 8,
        categoria: 'Cuarta',
        tipo_torneo: 'estandar',
        modalidad: 'unicategoria',
        valor_suma: null,
        genero: 'Varones'
    };

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const currentUser = this.apiService.getCurrentUser();

        if (currentUser) {
            this.userId = currentUser.id;
            this.userName = currentUser.nombre || 'Usuario';
            this.userRole = currentUser.rol || 'administrador_club';
            this.userFoto = currentUser.foto || null;

            this.loadTorneos(this.userId);
            this.clubesService.getUsers().subscribe(res => this.allUsers = res);
            this.clubesService.getClubes(this.userId).subscribe(res => {
                this.clubes = res;
                if (this.clubes.length > 0) {
                    this.torneo.club_id = this.clubes[0].id;
                }
            });

            // Fetch fresh profile data (photo URL)
            this.apiService.getPerfil(this.userId).subscribe({
                next: (res) => {
                    if (res.success && res.user) {
                        this.userFoto = res.user.foto_perfil || this.userFoto;
                        this.userName = res.user.nombre || this.userName;
                    }
                }
            });
        } else {
            // Fallback to manual localStorage if BehaviorSubject is empty (e.g. on direct refresh)
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                this.userId = user.id;
                this.userName = user.nombre || 'Usuario';
                this.userRole = user.rol || 'administrador_club';
                this.userFoto = user.foto || null;

                this.loadTorneos(this.userId);
                this.clubesService.getUsers().subscribe(res => this.allUsers = res);
                this.clubesService.getClubes(this.userId).subscribe(res => {
                    this.clubes = res;
                    if (this.clubes.length > 0) {
                        this.torneo.club_id = this.clubes[0].id;
                    }
                });

                // Fetch fresh profile data (photo URL)
                this.apiService.getPerfil(this.userId).subscribe({
                    next: (res) => {
                        if (res.success && res.user) {
                            this.userFoto = res.user.foto_perfil || this.userFoto;
                            this.userName = res.user.nombre || this.userName;
                        }
                    }
                });
            } else {
                this.router.navigate(['/login']);
            }
        }
    }

    loadTorneos(adminId: number) {
        this.clubesService.getTorneosAdmin(adminId).subscribe((res: any) => {
            this.torneos = res;
            // Sync selectedTorneo if it exists
            if (this.selectedTorneo) {
                const updated = this.torneos.find(t => t.id === this.selectedTorneo.id);
                if (updated) {
                    this.selectedTorneo = { ...updated };
                }
            }
        });
    }

    resetForm() {
        this.torneo = {
            ...this.torneo,
            nombre: '',
            fecha: '',
            hora_inicio: '',
            num_canchas: 2,
            tiempo_por_partido: 20,
            tipo_torneo: 'estandar',
            modalidad: 'unicategoria'
        };
    }

    crearTorneo() {
        if (!this.torneo.nombre || !this.torneo.club_id || !this.torneo.fecha) {
            Swal.fire('Atención', 'Por favor completa el nombre, club y fecha.', 'warning');
            return;
        }

        this.clubesService.createTorneoAmericano({ ...this.torneo, creator_id: this.userId }).subscribe({
            next: () => {
                Swal.fire('¡Éxito!', 'Torneo creado correctamente.', 'success');
                this.loadTorneos(this.userId);
                this.activeTab = 'list';
                this.resetForm();
            },
            error: (err) => {
                Swal.fire('Error', err.error?.error || 'No se pudo crear el torneo.', 'error');
            }
        });
    }

    cancelarTorneo(torneoId: number) {
        Swal.fire({
            title: '¿Cancelar Torneo?',
            text: "El torneo desaparecerá para los jugadores y no se podrán registrar más parejas.",
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: 'Sí, cancelar torneo',
            confirmButtonColor: '#d33',
            cancelButtonText: 'Volver'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.cancelarTorneoAmericano(torneoId).subscribe({
                    next: () => {
                        Swal.fire('Cancelado', 'El torneo ha sido cerrado.', 'success');
                        this.loadTorneos(this.userId);
                        this.selectedTorneo.estado = 'Cerrado';
                    },
                    error: (err: any) => Swal.fire('Error', 'No se pudo cancelar el torneo.', 'error')
                });
            }
        });
    }

    cerrarTorneo(torneoId: number) {
        Swal.fire({
            title: '¿Cerrar Americano?',
            text: "Se distribuirán los puntos a los jugadores y no se podrán realizar más cambios.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar y repartir puntos',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.closeTorneoAmericano(torneoId).subscribe({
                    next: (res: any) => {
                        Swal.fire('¡Cerrado!', res.mensaje || 'Torneo finalizado con éxito.', 'success');
                        if (this.selectedTorneo) {
                            this.selectedTorneo.estado = 'Cerrado';
                        }
                        this.loadTorneos(this.userId);
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo cerrar el torneo.', 'error');
                    }
                });
            }
        });
    }

    get isCerrado(): boolean {
        return this.selectedTorneo?.estado === 'Cerrado';
    }

    get isGrupos(): boolean {
        return this.selectedTorneo?.tipo_torneo === 'grupos';
    }

    selectTorneo(torneo: any) {
        if (!torneo) return;
        this.selectedTorneo = { ...torneo };
        this.activeDetailTab = 'inscription';
        this.loadParticipantes(torneo.id);
        this.loadMatches(torneo.id);
    }

    loadParticipantes(torneoId: number) {
        this.clubesService.getParticipantesTorneo(torneoId).subscribe(res => {
            this.participantes = res;
        });
    }

    loadMatches(torneoId: number) {
        this.clubesService.getTorneoMatches(torneoId).subscribe(res => {
            this.matches = res || [];
            this.groupMatches();
        });
    }

    groupMatches() {
        if (!this.matches || this.matches.length === 0) {
            this.matchesGrouped = [];
            return;
        }

        const groups = this.matches.reduce((acc: any, m: any) => {
            const faseKey = m.fase || 'Grupos';
            if (!acc[faseKey]) acc[faseKey] = {};

            const grupoKey = m.grupo_id || 'General';
            if (!acc[faseKey][grupoKey]) acc[faseKey][grupoKey] = {};

            if (!acc[faseKey][grupoKey][m.ronda]) acc[faseKey][grupoKey][m.ronda] = [];
            acc[faseKey][grupoKey][m.ronda].push(m);
            return acc;
        }, {});

        // Re-estructuramos para la vista
        this.matchesGrouped = Object.keys(groups).map(fase => ({
            name: fase,
            groups: Object.keys(groups[fase]).map(grupo => {
                const rounds = Object.keys(groups[fase][grupo]).map(r => ({
                    number: parseInt(r),
                    matches: groups[fase][grupo][r]
                })).sort((a, b) => a.number - b.number);

                return {
                    name: grupo,
                    rounds: rounds,
                    activeRound: rounds.length > 0 ? rounds[0].number : 1
                };
            })
        }));

        if (this.matchesGrouped.length > 0) {
            if (!this.activeFaseTab || !this.matchesGrouped.find(f => f.name === this.activeFaseTab)) {
                this.activeFaseTab = this.matchesGrouped[0].name;
            }
        }
    }

    closeGroupsAndGeneratePlayoffs() {
        if (!this.selectedTorneo) return;

        Swal.fire({
            title: '¿Cerrar Grupos y Generar Playoffs?',
            text: "Se calcularán las posiciones y se crearán las llaves de Oro y Plata.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, generar playoffs'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.generatePlayoffs(this.selectedTorneo.id).subscribe({
                    next: () => {
                        Swal.fire('¡Éxito!', 'Llaves generadas correctamente.', 'success');
                        this.loadMatches(this.selectedTorneo.id);
                        this.activeFaseTab = 'Semifinales';
                    },
                    error: (err: any) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo generar los playoffs.', 'error');
                    }
                });
            }
        });
    }

    hasPhase(name: string): boolean {
        return !!this.matchesGrouped.find(g => g.name === name);
    }

    generateFinals() {
        if (!this.selectedTorneo) return;

        // Check if semifinals are done
        const semis = this.matches.filter(m => m.fase === 'Semifinales');
        if (semis.length === 0) {
            Swal.fire('Error', 'No hay semifinales generadas.', 'warning');
            return;
        }
        const pending = semis.filter(m => !m.finalizado);
        if (pending.length > 0) {
            Swal.fire('Semifinales en curso', 'Debes finalizar todos los partidos de semifinales antes de generar las finales.', 'warning');
            return;
        }

        Swal.fire({
            title: '¿Generar Finales?',
            text: "Se crearán los partidos finales de Oro y Plata.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, generar finales'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.generateFinals(this.selectedTorneo.id).subscribe({
                    next: () => {
                        Swal.fire('¡Éxito!', 'Finales generadas correctamente.', 'success');
                        this.loadMatches(this.selectedTorneo.id);
                        this.activeFaseTab = 'Finales'; // Switch tab
                    },
                    error: (err: any) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo generar las finales.', 'error');
                    }
                });
            }
        });
    }

    searchPlayers() {
        if (!this.searchTerm.trim()) {
            this.filteredUsers = [];
            return;
        }
        const term = this.searchTerm.toLowerCase();
        this.filteredUsers = this.allUsers.filter(u =>
            u.nombre?.toLowerCase().includes(term) || u.usuario?.toLowerCase().includes(term)
        ).slice(0, 5);
    }

    selectPlayerForPair(user: any) {
        const playerObj = { ...user, isManual: false };
        if (!this.pairingSlot1) {
            this.pairingSlot1 = playerObj;
        } else if (!this.pairingSlot2) {
            if (!playerObj.isManual && this.pairingSlot1.id === playerObj.id) {
                Swal.fire('Error', 'No puedes seleccionar al mismo jugador dos veces.', 'error');
                return;
            }
            this.pairingSlot2 = playerObj;
        }
        this.searchTerm = '';
        this.filteredUsers = [];
    }

    addManualPlayer(name: string) {
        if (!name.trim()) return;
        const manualObj = { id: null, nombre: name + ' (Invitado)', isManual: true, realName: name };
        if (!this.pairingSlot1) {
            this.pairingSlot1 = manualObj;
        } else if (!this.pairingSlot2) {
            this.pairingSlot2 = manualObj;
        }
    }

    removePlayerFromPair(slotNum: number) {
        if (slotNum === 1) this.pairingSlot1 = null;
        if (slotNum === 2) this.pairingSlot2 = null;
    }

    addPair() {
        if (!this.selectedTorneo || !this.pairingSlot1 || !this.pairingSlot2) return;
        if (this.isCerrado) {
            Swal.fire('Torneo Cerrado', 'No puedes inscribir más parejas.', 'info');
            return;
        }

        if (this.selectedTorneo.modalidad === 'suma' && this.selectedTorneo.valor_suma) {
            const sum = this.calculatePairSum();
            if (sum !== this.selectedTorneo.valor_suma) {
                Swal.fire('Atención', `La suma de niveles (${sum}) no coincide con el valor del torneo (${this.selectedTorneo.valor_suma}).`, 'warning');
                // Podríamos bloquearlo o solo avisar. El prompt dice "validando nivel".
            }
        }

        const payload: any = {
            torneo_id: this.selectedTorneo.id,
            jugador1_id: this.pairingSlot1.id,
            jugador2_id: this.pairingSlot2.id,
            nombre_pareja: `${this.pairingSlot1.nombre} & ${this.pairingSlot2.nombre}`
        };

        if (this.pairingSlot1.isManual) payload.nombre_1 = this.pairingSlot1.realName;
        if (this.pairingSlot2.isManual) payload.nombre_2 = this.pairingSlot2.realName;

        if (this.editingParticipanteId) {
            payload.id = this.editingParticipanteId;
            this.clubesService.updateParticipante(payload).subscribe({
                next: (res) => {
                    Swal.fire('¡Éxito!', res.mensaje || 'Pareja actualizada.', 'success');
                    this.loadParticipantes(this.selectedTorneo.id);
                    this.loadMatches(this.selectedTorneo.id);
                    this.loadTorneos(this.userId);
                    this.cancelEdit();
                },
                error: (err) => {
                    Swal.fire('Error', err.error?.error || 'No se pudo actualizar.', 'error');
                }
            });
        } else {
            this.clubesService.joinTorneoManual(payload).subscribe({
                next: () => {
                    Swal.fire('¡Éxito!', 'Pareja inscrita.', 'success');
                    this.loadParticipantes(this.selectedTorneo.id);
                    this.pairingSlot1 = null;
                    this.pairingSlot2 = null;
                },
                error: (err) => {
                    Swal.fire('Error', err.error?.error || 'No se pudo agregar la pareja.', 'error');
                }
            });
        }
    }

    editPair(p: any) {
        if (this.isCerrado) return;
        this.editingParticipanteId = p.id;

        this.pairingSlot1 = {
            id: p.jugador_id,
            nombre: p.jugador1_nombre,
            isManual: !!p.nombre_externo_1,
            realName: p.nombre_externo_1 || p.jugador1_nombre
        };
        this.pairingSlot2 = {
            id: p.jugador2_id,
            nombre: p.jugador2_nombre,
            isManual: !!p.nombre_externo_2,
            realName: p.nombre_externo_2 || p.jugador2_nombre
        };

        // Scroll up to the builder
        const el = document.querySelector('.pair-builder-container');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        this.editingParticipanteId = null;
        this.pairingSlot1 = null;
        this.pairingSlot2 = null;
    }

    removePair(participanteId: number) {
        if (this.isCerrado) return;

        Swal.fire({
            title: '¿Quitar pareja?',
            text: "Se eliminarán los partidos generados y deberás crearlos de nuevo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, quitar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.removeParticipante(this.selectedTorneo.id, participanteId).subscribe({
                    next: (res) => {
                        Swal.fire('Eliminado', res.mensaje || 'Pareja removida correctamente.', 'success');
                        this.loadParticipantes(this.selectedTorneo.id);
                        this.loadMatches(this.selectedTorneo.id);
                        this.loadTorneos(this.userId);
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo quitar la pareja.', 'error');
                    }
                });
            }
        });
    }

    updateMatch(match: any) {
        this.saveScore(match);
    }

    saveScore(match: any, silent: boolean = false) {
        if (this.isCerrado) {
            if (!silent) Swal.fire('Torneo Cerrado', 'No puedes editar resultados.', 'info');
            return;
        }
        if (match.puntos_t1 == null || match.puntos_t2 == null) {
            if (!silent) Swal.fire('Atención', 'Ingresa los puntos.', 'warning');
            return;
        }

        this.clubesService.updateMatchResult(match.id, match.puntos_t1, match.puntos_t2).subscribe({
            next: () => {
                if (!silent) Swal.fire('Guardado', 'Resultado actualizado.', 'success');
                match.finalizado = 1;
                this.loadParticipantes(this.selectedTorneo.id);
            },
            error: (err) => {
                if (!silent) Swal.fire('Error', err.error?.error || 'No se pudo guardar.', 'error');
            }
        });
    }

    saveRound(round: number) {
        if (this.isCerrado) {
            Swal.fire('Torneo Cerrado', 'No puedes editar resultados.', 'info');
            return;
        }
        const pending = this.matches.filter(m => m.ronda === round && m.puntos_t1 != null && m.puntos_t2 != null);
        if (pending.length === 0) {
            Swal.fire('Atención', 'No hay resultados válidos.', 'warning');
            return;
        }

        Swal.fire({
            title: `¿Guardar Ronda ${round}?`,
            text: `Se actualizarán ${pending.length} partidos.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar'
        }).then((result) => {
            if (result.isConfirmed) {
                pending.forEach(m => this.saveScore(m, true));
                Swal.fire('Procesado', 'Resultados de la ronda enviados.', 'success');
            }
        });
    }

    getCoupleLabel(playerId: number | null, name: string = ''): string {
        if (!playerId && !name) return '?';
        const index = this.participantes.findIndex(p =>
            (playerId && (p.jugador_id === playerId || p.jugador2_id === playerId)) ||
            (name && (p.jugador1_nombre === name || p.jugador2_nombre === name))
        );
        return index !== -1 ? `P${index + 1}` : '?';
    }

    generarPartidos(torneoId: number) {
        if (this.isCerrado) {
            Swal.fire('Torneo Cerrado', 'No puedes regenerar partidos.', 'info');
            return;
        }
        if (this.participantes.length < 4) {
            Swal.fire('Faltan jugadores', 'Necesitas al menos 4 jugadores.', 'warning');
            return;
        }

        Swal.fire({
            title: '¿Generar Fixture?',
            text: "Se borrarán los partidos previos.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, generar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clubesService.generateMatches(torneoId).subscribe({
                    next: () => {
                        Swal.fire('¡Listo!', 'Fixture generado.', 'success');
                        this.loadMatches(torneoId);
                        this.loadTorneos(this.userId);
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo generar.', 'error');
                    }
                });
            }
        });
    }

    calculatePairSum(): number {
        const getLevelNum = (player: any) => {
            if (!player) return 0;
            // Primero intentamos buscar nivel en el perfil (si existiera)
            if (player.nivel && this.levelMapping[player.nivel]) return this.levelMapping[player.nivel];
            // Si no, podríamos tener una selección manual o fallback
            return 0;
        };

        const s1 = getLevelNum(this.pairingSlot1);
        const s2 = getLevelNum(this.pairingSlot2);
        return s1 + s2;
    }

    hasActiveTournaments(): boolean {
        return this.torneos.some(t => t.estado === 'Abierto');
    }

    hasHistoryTournaments(): boolean {
        return this.torneos.some(t => t.estado !== 'Abierto');
    }
}
