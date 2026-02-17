import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-torneo-gestion',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './torneo-gestion.component.html',
    styleUrls: ['./torneo-gestion.component.scss']
})
export class TorneoGestionComponent implements OnInit {
    clubes: any[] = [];
    torneos: any[] = [];
    selectedTorneo: any = null;
    categorias: any[] = [];
    selectedCategoria: any = null;
    inscripciones: any[] = [];
    allUsers: any[] = [];
    playoffMatches: any[] = [];
    groupMatches: any[] = [];
    groupRankings: any[] = [];
    grupos: any[] = [];

    // UI State
    activeTab: 'create' | 'list' = 'list';
    activeDetailTab: 'config' | 'inscripciones' | 'grupos' | 'playoffs' = 'config';

    userId: number = 0;
    userRole: any = 'administrador_club';
    userName: string = '';
    userFoto: string | null = null;

    newTorneo: any = {
        club_id: 0,
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        tipo: 'Grupos + Playoffs',
        categorias: [
            { nombre: 'Iniciación', max_parejas: 12, puntos_repartir: 100 },
            { nombre: 'Intermedio', max_parejas: 16, puntos_repartir: 250 },
            { nombre: 'Open', max_parejas: 8, puntos_repartir: 500 }
        ]
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
            this.userRole = currentUser.rol || 'administrador_club';
            this.userName = currentUser.nombre || 'Usuario';
            this.userFoto = currentUser.foto || null;
            this.loadInitialData();
            this.loadUsers();

            // Fetch fresh profile data
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

    loadInitialData() {
        this.clubesService.getTorneosAdminV2(this.userId).subscribe(res => {
            console.log('Torneos recibidos del API:', res);
            this.torneos = res;
        });

        this.clubesService.getClubes(this.userId).subscribe(res => {
            this.clubes = res;
            if (this.clubes.length > 0) {
                this.newTorneo.club_id = this.clubes[0].id;
            }
        });
    }

    loadUsers() {
        this.clubesService.getUsers().subscribe(res => this.allUsers = res);
    }

    selectTorneo(torneo: any) {
        this.selectedTorneo = torneo;
        this.activeTab = 'list';
        this.activeDetailTab = 'config';
        this.loadCategorias(torneo.id);
    }

    loadCategorias(torneoId: number) {
        this.clubesService.getCategoriasTorneo(torneoId).subscribe(res => {
            this.categorias = res;
            if (this.categorias.length > 0) {
                this.selectCategoria(this.categorias[0]);
            }
        });
    }

    selectCategoria(cat: any) {
        this.selectedCategoria = cat;
        this.loadInscripciones(cat.id);
        this.loadPlayoffs(cat.id);
        this.loadGroupData(cat.id);
    }

    loadGroupData(catId: number) {
        this.clubesService.getPartidosCategoria(catId).subscribe(res => {
            this.groupMatches = res.filter(m => m.grupo_id !== null);

            // Extract unique groups
            const groupIds = [...new Set(this.groupMatches.map(m => m.grupo_id))];
            this.grupos = [];
            groupIds.forEach(gid => {
                const match = this.groupMatches.find(m => m.grupo_id === gid);
                this.grupos.push({ id: gid, nombre: match.grupo_nombre });
                this.loadRankingGrupo(gid);
            });
        });
    }

    loadRankingGrupo(grupoId: number) {
        this.clubesService.getRankingGrupo(grupoId).subscribe(res => {
            this.groupRankings[grupoId] = res;
        });
    }

    loadInscripciones(catId: number) {
        this.clubesService.getInscripciones(catId).subscribe(res => {
            this.inscripciones = res;
        });
    }

    loadPlayoffs(catId: number) {
        this.clubesService.getPartidosRonda(catId, '').subscribe(res => {
            this.playoffMatches = res;
        });
    }

    cerrarGrupos() {
        if (!this.selectedCategoria) return;

        Swal.fire({
            title: '¿Cerrar Fase de Grupos?',
            text: 'Se calcularán los clasificados y se generará el Cuadro Eliminatorio.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar y generar Playoffs'
        }).then(result => {
            if (result.isConfirmed) {
                this.clubesService.cerrarFaseGrupos(this.selectedCategoria.id).subscribe({
                    next: (res) => {
                        Swal.fire('¡Éxito!', res.mensaje, 'success');
                        this.activeDetailTab = 'playoffs';
                        this.loadPlayoffs(this.selectedCategoria.id);
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudo cerrar la fase de grupos', 'error');
                    }
                });
            }
        });
    }

    validarInscripcion(ins: any) {
        this.clubesService.validarInscripcion(ins.id, !ins.validado).subscribe({
            next: () => {
                ins.validado = ins.validado ? 0 : 1;
                ins.pagado = ins.validado;
                Swal.fire('Actualizado', 'Estado de inscripción cambiado.', 'success');
            }
        });
    }

    // CARGA DE RESULTADOS
    async cargarResultado(partido: any) {
        const { value: formValues } = await Swal.fire({
            title: 'Ingresar Resultado',
            html: `
                <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-top: 15px;">
                    <div style="text-align: center;">
                        <div style="font-weight: 800; font-size: 12px; margin-bottom: 5px;">${partido.pareja1_nombre}</div>
                        <input id="set1_p1" class="swal2-input" type="number" placeholder="Set 1" style="width: 60px; margin: 0;">
                        <input id="set2_p1" class="swal2-input" type="number" placeholder="Set 2" style="width: 60px; margin: 0; margin-top: 5px;">
                    </div>
                    <div style="font-weight: 900; margin-top: 20px;">VS</div>
                    <div style="text-align: center;">
                        <div style="font-weight: 800; font-size: 12px; margin-bottom: 5px;">${partido.pareja2_nombre}</div>
                        <input id="set1_p2" class="swal2-input" type="number" placeholder="Set 1" style="width: 60px; margin: 0;">
                        <input id="set2_p2" class="swal2-input" type="number" placeholder="Set 2" style="width: 60px; margin: 0; margin-top: 5px;">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar Resultado',
            preConfirm: () => {
                return {
                    sets: [
                        { p1: (document.getElementById('set1_p1') as HTMLInputElement).value, p2: (document.getElementById('set1_p2') as HTMLInputElement).value },
                        { p1: (document.getElementById('set2_p1') as HTMLInputElement).value, p2: (document.getElementById('set2_p2') as HTMLInputElement).value }
                    ]
                }
            }
        });

        if (formValues) {
            this.clubesService.updateMatchResultV2({
                partido_id: partido.id,
                resultado: formValues.sets,
                categoria_id: this.selectedCategoria.id
            }).subscribe({
                next: () => {
                    Swal.fire('Guardado', 'Resultado actualizado correctamente.', 'success');
                    this.loadPlayoffs(this.selectedCategoria.id);
                    this.loadGroupData(this.selectedCategoria.id);
                },
                error: (err) => Swal.fire('Error', 'No se pudo guardar el resultado', 'error')
            });
        }
    }

    crearTorneo() {
        if (!this.newTorneo.nombre || !this.newTorneo.fecha_inicio) {
            Swal.fire('Atención', 'Nombre y Fecha son obligatorios', 'warning');
            return;
        }

        this.clubesService.createTorneoV2({ ...this.newTorneo, creator_id: this.userId }).subscribe({
            next: (res) => {
                Swal.fire('¡Éxito!', 'Torneo principal creado. Ahora configura las categorías.', 'success');
                this.loadInitialData();
                this.selectTorneo(res.torneo); // Assuming backend returns the created object
            },
            error: (err) => {
                Swal.fire('Error', 'No se pudo crear el torneo', 'error');
            }
        });
    }

    cargarCategoriasStandard() {
        this.newTorneo.categorias = [
            // Varones
            { nombre: '1ra Varones', max_parejas: 16, puntos_repartir: 1000 },
            { nombre: '2da Varones', max_parejas: 16, puntos_repartir: 750 },
            { nombre: '3ra Varones', max_parejas: 24, puntos_repartir: 500 },
            { nombre: '4ta Varones', max_parejas: 32, puntos_repartir: 250 },
            { nombre: '5ta Varones', max_parejas: 32, puntos_repartir: 100 },
            { nombre: '6ta Varones', max_parejas: 32, puntos_repartir: 50 },
            // Damas
            { nombre: 'Damas A', max_parejas: 16, puntos_repartir: 500 },
            { nombre: 'Damas B', max_parejas: 16, puntos_repartir: 250 },
            { nombre: 'Damas C', max_parejas: 24, puntos_repartir: 100 },
            { nombre: 'Damas D', max_parejas: 24, puntos_repartir: 50 }
        ];
        Swal.fire('Cargadas', 'Se han cargado las categorías estándar (Varones 1-6, Damas A-D)', 'success');
    }

    // INSCRIPCIÓN MANUAL
    manualInscripcion: any = {
        jugador1_id: 0,
        jugador1_nombre_manual: '',
        jugador2_id: 0,
        jugador2_nombre_manual: '',
        nombre_pareja: ''
    };

    inscribirParejaManual() {
        if (!this.selectedCategoria) return;

        // Validar que al menos haya nombres
        const j1 = this.manualInscripcion.jugador1_id || this.manualInscripcion.jugador1_nombre_manual;
        const j2 = this.manualInscripcion.jugador2_id || this.manualInscripcion.jugador2_nombre_manual;

        if (!j1 || !j2) {
            Swal.fire('Atención', 'Ambos jugadores son obligatorios', 'warning');
            return;
        }

        const payload = {
            categoria_id: this.selectedCategoria.id,
            jugador1_id: this.manualInscripcion.jugador1_id,
            jugador1_nombre_manual: this.manualInscripcion.jugador1_nombre_manual,
            jugador2_id: this.manualInscripcion.jugador2_id,
            jugador2_nombre_manual: this.manualInscripcion.jugador2_nombre_manual,
            nombre_pareja: this.manualInscripcion.nombre_pareja || `${this.obtenerNombreJ(1)} / ${this.obtenerNombreJ(2)}`,
            es_admin: true
        };

        this.clubesService.inscribirParejaV2(payload).subscribe({
            next: () => {
                Swal.fire('¡Inscrito!', 'Pareja añadida correctamente.', 'success');
                this.loadInscripciones(this.selectedCategoria.id);
                this.manualInscripcion = { jugador1_id: 0, jugador1_nombre_manual: '', jugador2_id: 0, jugador2_nombre_manual: '', nombre_pareja: '' };
            },
            error: (err) => Swal.fire('Error', err.error?.error || 'No se pudo inscribir', 'error')
        });
    }

    obtenerNombreJ(num: number): string {
        const id = num === 1 ? this.manualInscripcion.jugador1_id : this.manualInscripcion.jugador2_id;
        const manual = num === 1 ? this.manualInscripcion.jugador1_nombre_manual : this.manualInscripcion.jugador2_nombre_manual;
        if (id > 0) {
            return this.allUsers.find(u => u.id == id)?.nombre || 'S/N';
        }
        return manual || 'S/N';
    }

    generarGrupos() {
        if (!this.selectedCategoria) return;

        Swal.fire({
            title: '¿Generar Grupos?',
            text: 'Esto distribuirá a las parejas inscritas automáticamente.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, generar'
        }).then(result => {
            if (result.isConfirmed) {
                this.clubesService.generarGrupos(this.selectedCategoria.id).subscribe({
                    next: () => {
                        Swal.fire('¡Listo!', 'Grupos generados exitosamente.', 'success');
                        this.activeDetailTab = 'grupos';
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudieron generar los grupos', 'error');
                    }
                });
            }
        });
    }
}
