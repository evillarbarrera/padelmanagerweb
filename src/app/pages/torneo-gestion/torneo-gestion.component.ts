import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
    calendarDays: any[] = []; // For calendar view
    selectedDayIndex: number = 0;

    // UI State
    activeTab: 'create' | 'list' = 'list';
    activeDetailTab: 'config' | 'inscripciones' | 'grupos' | 'playoffs' | 'programacion' | 'resumen' | 'generar' = 'config';

    // New Availability Grid Config
    // key: 'YYYY-MM-DD', value: array of hours [8, 9, 10, ... 23] enabled
    availabilityGrid: { [key: string]: number[] } = {};
    gridDays: string[] = [];
    gridHours: number[] = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00 to 23:00 default

    // Summary Stats
    tournamentStats: any = {
        totalInscritos: 0,
        totalPartidosEstimados: 0,
        horasNecesarias: 0,
        horasDisponibles: 0,
        deficit: 0,
        categorias: []
    };

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

    matchDuration: number = 90; // Default match duration in minutes

    hasFictionalMatches(): boolean {
        return this.matchesToSchedule.some(m => m.id < 0 || m.dummy);
    }

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private router: Router
    ) { }

    generateSchedule() {
        if (!this.selectedTorneo) return;

        // Ensure courts are loaded before generation
        if (this.clubCanchas.length === 0) {
            this.clubesService.getCanchas(this.selectedTorneo.club_id).subscribe(res => {
                this.clubCanchas = res;
                this.executeGeneration();
            });
        } else {
            this.executeGeneration();
        }
    }

    private executeGeneration() {
        console.log('Starting schedule generation...');
        Swal.fire({
            title: 'Generando Calendario',
            text: 'Calculando grupos y asignando horarios...',
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 1. Get all categories and their inscriptions
        const observables = this.categorias.map(cat =>
            this.clubesService.getInscripciones(cat.id)
        );

        if (observables.length === 0) {
            Swal.fire('Atención', 'No hay categorías definidas en este torneo.', 'warning');
            return;
        }

        forkJoin(observables).subscribe({
            next: (results: any[]) => {
                try {
                    const allInscripciones = results;

                    // Ensure grid is initialized if user hasn't visited 'Conf. Horarios'
                    if (this.gridDays.length === 0) {
                        this.initAvailabilityGrid();
                    }

                    this.processSchedule(allInscripciones);
                    this.organizeCalendar();

                    Swal.close();
                    Swal.fire({
                        title: 'Calendario Generado',
                        text: 'Se han calculado los grupos y partidos automáticamente.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } catch (e) {
                    console.error('Error during schedule processing', e);
                    Swal.close();
                    Swal.fire('Error', 'Ocurrió un error al procesar el calendario: ' + (e as any).message, 'error');
                }
            },
            error: (err) => {
                console.error('Error fetching inscriptions', err);
                Swal.close();
                Swal.fire('Error', 'No se pudieron obtener las inscripciones o el servidor no responde.', 'error');
            }
        });
    }



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

        // Reset grid
        this.availabilityGrid = {};
        this.gridDays = [];

        // Initialize planParams with tournament dates if available
        if (torneo.fecha_inicio) this.planParams.startDate = torneo.fecha_inicio.split(' ')[0];
        if (torneo.fecha_fin) this.planParams.endDate = torneo.fecha_fin.split(' ')[0];

        // Load courts and auto-select them
        this.loadCanchasClub();

        // Load availability from DB
        this.clubesService.getTorneoAvailability(torneo.id).subscribe({
            next: (res: any) => {
                if (res.status === 'success' && res.grid) {
                    this.availabilityGrid = res.grid;
                }
            },
            error: (err) => console.error('Error loading availability', err)
        });

        // Load courts
        this.loadCanchasClub();
    }

    processSchedule(allInscripciones: any[][]) {
        console.log('Processing schedule for', this.categorias.length, 'categories');
        this.matchesToSchedule = [];

        // 1. Prepare Available Slots (Time x Courts)
        // usage of "this" works correctly here
        let usableCourts = this.clubCanchas.filter(c => this.planParams.selectedCanchasIds.includes(c.id));
        if (usableCourts.length === 0) usableCourts = this.clubCanchas;

        // Create a pool of "Assignable Slots"
        const slots: any[] = [];
        this.gridDays.forEach(day => {
            if (this.availabilityGrid[day]) {
                this.availabilityGrid[day].sort((a, b) => a - b).forEach(h => {
                    const parts = day.split('-');
                    // month is 0-indexed in JS Date
                    const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), h, 0, 0);

                    usableCourts.forEach((court) => {
                        slots.push({
                            date: day,
                            hour: h,
                            courtId: court.id,
                            courtName: court.nombre,
                            timestamp: dObj.getTime(),
                            label: `${day} ${h}:00 - ${court.nombre}`
                        });
                    });
                });
            }
        });

        // Sort slots by time
        slots.sort((a, b) => a.timestamp - b.timestamp);

        let slotIndex = 0;

        // 2. Generate Matches per Category
        this.categorias.forEach((cat, index) => {
            let inscritos = [...(allInscripciones[index] || [])];

            // NEW LOGIC: Always fill categories to their max_parejas or at least 4 pairs for full visualization
            const targetTotal = (cat.max_parejas && cat.max_parejas > 0) ? cat.max_parejas : (inscritos.length > 0 ? inscritos.length : 4);
            const remainder = targetTotal % 4;
            const fullTarget = remainder === 0 ? targetTotal : targetTotal + (4 - remainder);
            let needed = fullTarget - inscritos.length;

            for (let i = 0; i < needed; i++) {
                const dummyIndex = inscritos.length + 1;
                const dummyId = -(index + 1) * 100 - dummyIndex;
                inscritos.push({
                    id: dummyId,
                    nombre_jugador_1: `Jugador Ficticio ${dummyIndex}`,
                    nombre_jugador_2: `Pareja Ficticia ${dummyIndex}`,
                    dummy: true
                });
            }

            console.log(`Category ${cat.nombre}: ${inscritos.length} pairs (Total after filling with Ficticios)`);

            // Creates Groups (Chunks of 4)
            const groups = [];
            for (let i = 0; i < inscritos.length; i += 4) {
                groups.push(inscritos.slice(i, i + 4));
            }

            // Generate Group Matches (Round Robin)
            groups.forEach((group, gIdx) => {
                const groupName = String.fromCharCode(65 + gIdx); // A, B, C...

                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {
                        // Create Match Object
                        const p1 = group[i];
                        const p2 = group[j];

                        const match: any = {
                            id: -1, // Temporary ID for simulated matches
                            category: cat.nombre,
                            categoryId: cat.id,
                            ronda: `Grupo ${groupName}`,
                            team1: p1,
                            team2: p2,
                            pareja1_nombre: p1.nombre_jugador_1 ? `${p1.nombre_jugador_1} ${p1.nombre_jugador_2 ? '/ ' + p1.nombre_jugador_2 : ''}` : (p1.nombre_pareja || 'Pareja TBD'),
                            pareja2_nombre: p2.nombre_jugador_1 ? `${p2.nombre_jugador_1} ${p2.nombre_jugador_2 ? '/ ' + p2.nombre_jugador_2 : ''}` : (p2.nombre_pareja || 'Pareja TBD'),
                            tempDate: 'Sin Cupo',
                            tempTime: '--:--',
                            court: 'Pendiente',
                            duration: this.matchDuration
                        };

                        // Assign Slot
                        if (slotIndex < slots.length) {
                            const slot = slots[slotIndex];
                            match.tempDate = slot.date;
                            match.tempTime = `${slot.hour}:00`;
                            match.court = slot.courtName;
                            slotIndex++;
                        }

                        this.matchesToSchedule.push(match);
                    }
                }
            });

            // 3. Generate Simulated Playoff Structure (Fictional)
            // This is for visualization of the complete tournament path
            const generateSimulatedPlayoffs = (numPairs: number) => {
                let eliminationRounds: string[] = [];
                if (numPairs >= 32) eliminationRounds = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
                else if (numPairs >= 16) eliminationRounds = ['Cuartos de Final', 'Semifinal', 'Final'];
                else if (numPairs >= 8) eliminationRounds = ['Semifinal', 'Final'];
                else if (numPairs >= 4) eliminationRounds = ['Final'];

                eliminationRounds.forEach(round => {
                    const matchCount = round === 'Octavos de Final' ? 8 : (round === 'Cuartos de Final' ? 4 : (round === 'Semifinal' ? 2 : 1));
                    for (let i = 0; i < matchCount; i++) {
                        const match: any = {
                            id: -2000 - (eliminationRounds.indexOf(round) * 10) - i, // Unique simulated ID
                            category: cat.nombre,
                            categoryId: cat.id,
                            ronda: round,
                            pareja1_nombre: round === 'Octavos de Final' ? `Clasificado G${(i * 2 + 1)}` : `Ganador M${i * 2 + 10}`,
                            pareja2_nombre: round === 'Octavos de Final' ? `Clasificado G${(i * 2 + 2)}` : `Ganador M${i * 2 + 11}`,
                            tempDate: 'Sin Cupo',
                            tempTime: '--:--',
                            court: 'Pendiente',
                            duration: this.matchDuration,
                            dummy: true
                        };

                        // Assign Slot
                        if (slotIndex < slots.length) {
                            const slot = slots[slotIndex];
                            match.tempDate = slot.date;
                            match.tempTime = `${slot.hour}:00`;
                            match.court = slot.courtName;
                            slotIndex++;
                        }
                        this.matchesToSchedule.push(match);
                    }
                });
            };

            generateSimulatedPlayoffs(inscritos.length);
        });

        console.log('Matches generated (Groups + Simulated Playoffs):', this.matchesToSchedule);

        // Update playoffRounds locally for the "Cuadro Final" tab view
        const simulatedPlayoffs = this.matchesToSchedule.filter(m => m.id < -1000);
        this.organizeBracket(simulatedPlayoffs);
    }

    // ...

    saveTorneoFechas() {
        if (!this.selectedTorneo) return;

        // 1. Update basic info (dates)
        this.selectedTorneo.fecha_inicio = this.planParams.startDate;
        this.selectedTorneo.fecha_fin = this.planParams.endDate;

        // 2. Filter grid to only include current date range
        const gridPayload: any = {};
        this.gridDays.forEach(day => {
            if (this.availabilityGrid[day] && this.availabilityGrid[day].length > 0) {
                gridPayload[day] = this.availabilityGrid[day];
            }
        });

        const updateTorneo$ = this.clubesService.updateTorneo(this.selectedTorneo.id, this.selectedTorneo);
        const updateGrid$ = this.clubesService.saveTorneoAvailability(this.selectedTorneo.id, gridPayload);

        // Run in parallel
        forkJoin({
            torneo: updateTorneo$,
            grid: updateGrid$
        }).subscribe({
            next: (results) => {
                console.log('Update results:', results);
                Swal.fire('Guardado', 'Fechas y horarios del torneo actualizados correctamente', 'success');
            },
            error: (err) => {
                console.error('Error saving tournament data:', err);

                let msg = 'No se pudo actualizar la configuración.';
                if (err.url && err.url.includes('update_torneo.php')) {
                    msg += ' Error al actualizar fechas del torneo.';
                } else if (err.url && err.url.includes('update_torneo_availability.php')) {
                    msg += ' Error al actualizar horarios.';
                }

                Swal.fire('Error', msg, 'error');
            }
        });
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
        this.loadGroupData(cat.id);
        this.loadPlayoffs(cat.id);
    }

    selectCategoryForInscriptions(cat: any) {
        this.selectedCategoria = cat;
        this.loadInscripciones(cat.id);
        this.loadGroupData(cat.id);
        this.loadPlayoffs(cat.id);
        // Prepare data for calendar view
        this.loadCanchasClub(); // Load courts for scheduling
        this.prepareScheduleData();
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

    playoffRounds: any = { octavos: [], cuartos: [], semi: [], final: [] };

    loadPlayoffs(catId: number) {
        this.clubesService.getPartidosRonda(catId, '').subscribe(res => {
            this.playoffMatches = res;
            this.organizeBracket(res);
        });
    }

    organizeBracket(matches: any[]) {
        this.playoffRounds = { octavos: [], cuartos: [], semi: [], final: [] };
        matches.forEach(m => {
            const r = (m.ronda || '').toLowerCase();
            if (r.includes('octavos') || r.includes('16')) this.playoffRounds.octavos.push(m);
            else if (r.includes('cuartos') || r.includes('quarter')) this.playoffRounds.cuartos.push(m);
            else if (r.includes('semi')) this.playoffRounds.semi.push(m);
            else if (r.includes('final')) this.playoffRounds.final.push(m);
        });

        // Sort matches to ensure they align in the bracket visually if needed
        // This is a naive sort, a real bracket sort requires knowing the draw positions
        this.playoffRounds.octavos.sort((a: any, b: any) => a.id - b.id);
        this.playoffRounds.cuartos.sort((a: any, b: any) => a.id - b.id);
        this.playoffRounds.semi.sort((a: any, b: any) => a.id - b.id);
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
    // SCORE MODAL LOGIC
    showScoreModal: boolean = false;
    currentMatchForScore: any = null;
    scoreInput: any = {
        s1p1: '', s1p2: '',
        s2p1: '', s2p2: '',
        s3p1: '', s3p2: ''
    };

    cargarResultado(partido: any) {
        this.currentMatchForScore = partido;
        this.scoreInput = { s1p1: '', s1p2: '', s2p1: '', s2p2: '', s3p1: '', s3p2: '' };
        this.showScoreModal = true;
    }

    closeScoreModal() {
        this.showScoreModal = false;
        this.currentMatchForScore = null;
    }

    // PLANIFICACIÓN
    planParams: any = {
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '22:00',
        duration: 90,
        selectedCanchasIds: []
    };
    clubCanchas: any[] = [];
    matchesToSchedule: any[] = []; // Partidos para mostrar en la lista

    // Cargar canchas
    loadCanchasClub() {
        if (this.selectedTorneo) {
            this.clubesService.getCanchas(this.selectedTorneo.club_id).subscribe(res => {
                this.clubCanchas = res;
                // Auto-select all courts by default if none selected
                if (this.planParams.selectedCanchasIds.length === 0) {
                    this.planParams.selectedCanchasIds = res.map((c: any) => c.id);
                }
            });
        }
    }

    // Unificar partidos
    prepareScheduleData() {
        if (!this.groupMatches.length) this.loadGroupData(this.selectedCategoria.id);
        if (!this.playoffMatches.length) this.loadPlayoffs(this.selectedCategoria.id);

        setTimeout(() => {
            const all = [...this.groupMatches, ...this.playoffMatches];
            this.matchesToSchedule = all.map(m => ({
                id: m.id,
                pareja1_id: m.pareja1_id,
                pareja1_nombre: m.pareja1_nombre,
                pareja2_id: m.pareja2_id,
                pareja2_nombre: m.pareja2_nombre,
                ronda: m.ronda || 'Grupo ' + m.grupo_nombre,
                fecha_hora_inicio: m.fecha_hora_inicio,
                cancha_id: m.cancha_id,
                tempDate: m.fecha_hora_inicio ? m.fecha_hora_inicio.split(' ')[0] : '',
                tempTime: m.fecha_hora_inicio ? m.fecha_hora_inicio.split(' ')[1]?.substring(0, 5) : '',
                tempCanchaId: m.cancha_id || null,
                isScheduled: !!m.fecha_hora_inicio
            }));
            this.organizeCalendar();
        }, 800);
    }

    organizeCalendar() {
        // Group matches by date
        const groups: { [key: string]: any[] } = {};

        this.matchesToSchedule.forEach(m => {
            // Use tempDate if set, otherwise 'Sin Programar'
            const dateKey = m.tempDate || 'Sin Programar';
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(m);
        });

        // Convert to array and sort
        this.calendarDays = Object.keys(groups).sort().map(date => {
            return {
                date: date,
                matches: groups[date].sort((a: any, b: any) => {
                    return (a.tempTime || '').localeCompare(b.tempTime || '');
                })
            };
        });

        // Reset selected day index
        this.selectedDayIndex = 0;
    }



    toggleCanchaSelection(canchaId: number) {
        if (this.planParams.selectedCanchasIds.includes(canchaId)) {
            this.planParams.selectedCanchasIds = this.planParams.selectedCanchasIds.filter((id: number) => id !== canchaId);
        } else {
            this.planParams.selectedCanchasIds.push(canchaId);
        }
    }

    autoSchedule() {
        if (this.planParams.selectedCanchasIds.length === 0) {
            if (this.clubCanchas.length > 0) {
                this.planParams.selectedCanchasIds = this.clubCanchas.map(c => c.id);
            } else {
                Swal.fire('Error', 'No hay canchas cargadas para este club. Por favor, asegúrate de que el club tenga canchas configuradas.', 'error');
                return;
            }
        }
        if (!this.planParams.startDate || !this.planParams.endDate) {
            Swal.fire('Error', 'Selecciona fecha de inicio y fin', 'error');
            return;
        }

        // Fix timezone issue by parsing YYYY-MM-DD manually
        const [sy, sm, sd] = this.planParams.startDate.split('-').map(Number);
        const [ey, em, ed] = this.planParams.endDate.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd);
        const endDate = new Date(ey, em - 1, ed);

        const [startH, startM] = this.planParams.startTime.split(':').map(Number);
        const [endH, endM] = this.planParams.endTime.split(':').map(Number);
        const duration = this.planParams.duration; // minutes

        // Calculate daily limits in minutes from midnight
        const dayStartMins = startH * 60 + startM;
        const dayEndMins = endH * 60 + endM;

        let pending = this.matchesToSchedule.filter(m => !m.tempTime || m.tempTime === '');

        if (pending.length === 0) {
            Swal.fire('Info', 'No hay partidos pendientes de programar', 'info');
            return;
        }

        // Sort pending matches by Priority: Groups -> Octavos -> Cuartos -> Semis -> Final
        pending.sort((a, b) => {
            const getPriority = (ronda: string) => {
                const r = (ronda || '').toLowerCase();
                if (r.includes('grupo')) return 1;
                if (r.includes('32')) return 2;
                if (r.includes('16') || r.includes('octavos')) return 3;
                if (r.includes('cuartos') || r.includes('quarter')) return 4;
                if (r.includes('semi')) return 5;
                if (r.includes('final')) return 6;
                return 99;
            };
            return getPriority(a.ronda) - getPriority(b.ronda);
        });

        const gamesPerPlayerPerDay: { [key: string]: number } = {};

        let currentDate = new Date(startDate);

        let scheduledCount = 0;
        let dayLimit = 0;

        while (currentDate <= endDate && pending.length > 0 && dayLimit < 365) {
            dayLimit++;
            const yyyy = currentDate.getFullYear();
            const MM = String(currentDate.getMonth() + 1).padStart(2, '0');
            const dd = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${MM}-${dd}`;

            let currentMins = dayStartMins;

            while (currentMins + duration <= dayEndMins && pending.length > 0) {
                const h = Math.floor(currentMins / 60);
                const m = currentMins % 60;
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                const availableCourts = [...this.planParams.selectedCanchasIds];
                const playersInSlot = new Set<number>();

                let courtIndex = 0;
                let matchIdx = 0;

                while (courtIndex < availableCourts.length && matchIdx < pending.length) {
                    const match = pending[matchIdx];
                    const p1 = match.pareja1_id;
                    const p2 = match.pareja2_id;

                    // Concurrency Check
                    if (p1 && playersInSlot.has(p1)) { matchIdx++; continue; }
                    if (p2 && playersInSlot.has(p2)) { matchIdx++; continue; }

                    // Daily Limit Check
                    const k1 = `${dateStr}_${p1}`;
                    const k2 = `${dateStr}_${p2}`;
                    const c1 = gamesPerPlayerPerDay[k1] || 0;
                    const c2 = gamesPerPlayerPerDay[k2] || 0;

                    if (c1 >= 2 || c2 >= 2) {
                        matchIdx++;
                        continue;
                    }

                    // Schedule
                    match.tempDate = dateStr;
                    match.tempTime = timeStr;
                    match.tempCanchaId = availableCourts[courtIndex];
                    match.isScheduled = true;

                    if (p1) gamesPerPlayerPerDay[k1] = c1 + 1;
                    if (p2) gamesPerPlayerPerDay[k2] = c2 + 1;
                    if (p1) playersInSlot.add(p1);
                    if (p2) playersInSlot.add(p2);

                    pending.splice(matchIdx, 1);

                    courtIndex++;
                    scheduledCount++;
                }
                currentMins += duration;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        this.organizeCalendar();

        if (pending.length > 0) {
            Swal.fire('Atención', `Se programaron ${scheduledCount} partidos, pero quedaron ${pending.length} sin asignar.`, 'warning');
        } else {
            Swal.fire('Planificado', `Se han propuesto horarios para ${scheduledCount} partidos exitosamente.`, 'success');
        }
    }

    savePlanificacion() {
        const changes = this.matchesToSchedule.filter(m => m.tempDate && m.tempTime).map(m => ({
            partido_id: m.id,
            fecha_inicio: `${m.tempDate} ${m.tempTime}:00`,
            cancha_id: m.tempCanchaId || 0
        }));

        this.clubesService.saveSchedule(changes).subscribe({
            next: () => Swal.fire('Guardado', 'La programación se ha actualizado.', 'success'),
            error: () => Swal.fire('Error', 'No se pudo guardar.', 'error')
        });
    }

    saveScore() {
        if (!this.currentMatchForScore) return;

        const s = this.scoreInput;
        let sets = [];

        // Basic validation: ensure values are not empty strings
        if (s.s1p1 !== '' && s.s1p2 !== '') sets.push({ p1: s.s1p1, p2: s.s1p2 });
        if (s.s2p1 !== '' && s.s2p2 !== '') sets.push({ p1: s.s2p1, p2: s.s2p2 });
        if (s.s3p1 !== '' && s.s3p2 !== '') sets.push({ p1: s.s3p1, p2: s.s3p2 });

        if (sets.length === 0) {
            Swal.fire('Atención', 'Ingresa al menos el resultado del primer set', 'warning');
            return;
        }

        const scoreString = sets.map(set => `${set.p1}-${set.p2}`).join(', ');

        // Handle fictional/simulated matches (ID < 0)
        if (this.currentMatchForScore.id < 0) {
            // Update locally for visualization only
            this.currentMatchForScore.resultado = scoreString;
            this.currentMatchForScore.isFinished = true;

            Swal.fire({
                title: 'Marcador Simulado',
                text: 'Este es un partido ficticio. El resultado se muestra solo de forma visual.',
                icon: 'info',
                timer: 2000,
                showConfirmButton: false
            });
            this.closeScoreModal();
            return;
        }

        this.clubesService.updateMatchResultV2({
            partido_id: this.currentMatchForScore.id,
            resultado: sets,
            categoria_id: this.currentMatchForScore.categoryId || this.selectedCategoria.id
        }).subscribe({
            next: () => {
                Swal.fire({
                    title: '¡Marcador Actualizado!',
                    text: 'El resultado se ha guardado correctamente.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                // Only refresh DB data if they are real
                if (this.selectedCategoria) {
                    this.loadPlayoffs(this.selectedCategoria.id);
                    this.loadGroupData(this.selectedCategoria.id);
                }
                this.closeScoreModal();
                this.organizeCalendar(); // Update calendar view
            },
            error: (err) => {
                console.error('Error saving score:', err);
                Swal.fire('Error', 'No se pudo guardar el resultado', 'error');
            }
        });
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
            // Damas (Chile style)
            { nombre: 'Damas A', max_parejas: 16, puntos_repartir: 500 },
            { nombre: 'Damas B', max_parejas: 16, puntos_repartir: 250 },
            { nombre: 'Damas C', max_parejas: 24, puntos_repartir: 100 },
            { nombre: 'Damas D', max_parejas: 24, puntos_repartir: 50 },
            { nombre: 'Damas E', max_parejas: 24, puntos_repartir: 25 }
        ];
        Swal.fire('Cargadas', 'Se han cargado las categorías estándar (Varones 1-6, Damas A-E)', 'success');
    }

    // INSCRIPCIÓN MANUAL CON BÚSQUEDA
    manualInscripcion: any = {
        jugador1_id: 0,
        jugador1_nombre: '', // Para visualización/input
        jugador1_seleccionado: false, // Flag para saber si viene de DB

        jugador2_id: 0,
        jugador2_nombre: '',
        jugador2_seleccionado: false,

        nombre_pareja: ''
    };

    // Resultados de búsqueda
    searchResults1: any[] = [];
    searchResults2: any[] = [];
    isSearching1: boolean = false;
    isSearching2: boolean = false;

    searchUser(query: string, playerNum: number) {
        if (query.length < 2) {
            if (playerNum === 1) this.searchResults1 = [];
            else this.searchResults2 = [];
            return;
        }

        const normalizedQuery = query.toLowerCase();
        // Filtrar de allUsers que ya tenemos cargados (optimización local)
        const results = this.allUsers.filter(u =>
            u.nombre.toLowerCase().includes(normalizedQuery) ||
            (u.email && u.email.toLowerCase().includes(normalizedQuery))
        ).slice(0, 5); // Top 5

        if (playerNum === 1) this.searchResults1 = results;
        else this.searchResults2 = results;
    }

    selectUser(user: any, playerNum: number) {
        if (playerNum === 1) {
            this.manualInscripcion.jugador1_id = user.id;
            this.manualInscripcion.jugador1_nombre = user.nombre;
            this.manualInscripcion.jugador1_seleccionado = true;
            this.searchResults1 = [];
        } else {
            this.manualInscripcion.jugador2_id = user.id;
            this.manualInscripcion.jugador2_nombre = user.nombre;
            this.manualInscripcion.jugador2_seleccionado = true;
            this.searchResults2 = [];
        }
    }

    clearUserSelection(playerNum: number) {
        if (playerNum === 1) {
            this.manualInscripcion.jugador1_id = 0;
            this.manualInscripcion.jugador1_nombre = '';
            this.manualInscripcion.jugador1_seleccionado = false;
        } else {
            this.manualInscripcion.jugador2_id = 0;
            this.manualInscripcion.jugador2_nombre = '';
            this.manualInscripcion.jugador2_seleccionado = false;
        }
    }

    inscribirParejaManual() {
        if (!this.selectedCategoria) return;

        // Validar nombres
        const j1Name = this.manualInscripcion.jugador1_nombre;
        const j2Name = this.manualInscripcion.jugador2_nombre;

        if (!j1Name || !j2Name) {
            Swal.fire('Atención', 'Ambos nombres de jugadores son obligatorios', 'warning');
            return;
        }

        const payload = {
            categoria_id: this.selectedCategoria.id,
            jugador1_id: this.manualInscripcion.jugador1_id || 0,
            jugador1_nombre_manual: this.manualInscripcion.jugador1_id ? '' : j1Name,
            jugador2_id: this.manualInscripcion.jugador2_id || 0,
            jugador2_nombre_manual: this.manualInscripcion.jugador2_id ? '' : j2Name,
            nombre_pareja: this.manualInscripcion.nombre_pareja || `${j1Name} / ${j2Name}`,
            es_admin: true
        };

        this.clubesService.inscribirParejaV2(payload).subscribe({
            next: () => {
                Swal.fire('¡Inscrito!', 'Pareja añadida correctamente.', 'success');
                this.loadInscripciones(this.selectedCategoria.id);
                // Reset form
                this.manualInscripcion = {
                    jugador1_id: 0, jugador1_nombre: '', jugador1_seleccionado: false,
                    jugador2_id: 0, jugador2_nombre: '', jugador2_seleccionado: false,
                    nombre_pareja: ''
                };
            },
            error: (err) => Swal.fire('Error', err.error?.error || 'No se pudo inscribir', 'error')
        });
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
                        this.loadGroupData(this.selectedCategoria.id); // Refresh group data immediately
                        this.activeDetailTab = 'grupos';
                    },
                    error: (err) => {
                        Swal.fire('Error', err.error?.error || 'No se pudieron generar los grupos', 'error');
                    }
                });
            }
        });
    }

    // ==========================================
    // NEW: AVAILABILITY GRID LOGIC
    // ==========================================

    initAvailabilityGrid() {
        if (!this.planParams.startDate || !this.planParams.endDate) {
            Swal.fire('Info', 'Define primero las fechas de inicio y fin en la pestaña de categorías o configuración.', 'info');
            return;
        }

        const [sy, sm, sd] = this.planParams.startDate.split('-').map(Number);
        const [ey, em, ed] = this.planParams.endDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);

        // Always rebuild gridDays array to ensure UI updates
        this.gridDays = [];
        let curr = new Date(start);

        while (curr <= end) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            const dateKey = `${y}-${m}-${d}`;

            this.gridDays.push(dateKey);

            // Should persist existing config if available, otherwise default
            if (!this.availabilityGrid[dateKey]) {
                this.availabilityGrid[dateKey] = [...this.gridHours];
            }

            curr.setDate(curr.getDate() + 1);
        }
        console.log('Grid Days initialized:', this.gridDays);
    }

    // Drag Selection State
    isDragging = false;
    dragMode: 'enable' | 'disable' = 'enable'; // What we are doing in this drag session

    onMouseDown(dateKey: string, hour: number) {
        this.isDragging = true;

        // Determine mode based on the initial cell clicked
        const isCurrentlyEnabled = this.isHourEnabled(dateKey, hour);
        this.dragMode = isCurrentlyEnabled ? 'disable' : 'enable';

        // Apply to start cell
        this.applyDragState(dateKey, hour);
    }

    onMouseEnter(dateKey: string, hour: number) {
        if (this.isDragging) {
            this.applyDragState(dateKey, hour);
        }
    }

    onMouseUp() {
        this.isDragging = false;
    }

    applyDragState(dateKey: string, hour: number) {
        if (!this.availabilityGrid[dateKey]) return;

        const index = this.availabilityGrid[dateKey].indexOf(hour);
        const isEnabled = index > -1;

        if (this.dragMode === 'enable' && !isEnabled) {
            this.availabilityGrid[dateKey].push(hour);
            this.availabilityGrid[dateKey].sort((a, b) => a - b);
        } else if (this.dragMode === 'disable' && isEnabled) {
            this.availabilityGrid[dateKey].splice(index, 1);
        }
    }

    toggleHour(dateKey: string, hour: number) {
        // Kept for backward compat or single click if needed, 
        // but MouseDown handles single clicks usually.
        // We can leave this empty or redirect to applyDragState 
        // if we change the template events.
    }

    isHourEnabled(dateKey: string, hour: number): boolean {
        return this.availabilityGrid[dateKey]?.includes(hour) ?? false;
    }

    // ==========================================
    // NEW: SUMMARY STATS LOGIC
    // ==========================================

    calculateStats() {
        // Mock calculation - needs real data iteration
        let totalMatches = 0;
        let totalIns = 0;
        let catsStats = [];

        // Count enrolled
        // We need to iterate all categories ideally, but we might only have loaded one.
        // For accurate summary, we should probably fetch summary from backend or iterate if we have them.
        // We'll iterate what we have locally or assume data is loaded.

        // For specific categories stats
        for (let cat of this.categorias) {
            // This requires fetching enrollment count for each category if not already loaded
            // We can assume we might need to load them or display placeholders
            catsStats.push({
                nombre: cat.nombre,
                inscritos: 0, // Need to fill this
                partidos: 0
            });
        }

        // Calculate Available Hours
        let totalHoursAvailable = 0;
        this.gridDays.forEach(d => {
            const hours = this.availabilityGrid[d]?.length || 0;
            totalHoursAvailable += hours;
        });

        // Multiply by courts
        this.loadCanchasClub(); // ensure courts are loaded
        const courtCount = this.clubCanchas.length || 1; // Default 1 to avoid div by zero zero
        const totalMinutesAvailable = totalHoursAvailable * 60 * courtCount;

        this.tournamentStats = {
            totalInscritos: totalIns,
            totalPartidosEstimados: totalMatches, // Approx formula
            horasNecesarias: (totalMatches * this.planParams.duration) / 60,
            horasDisponibles: totalHoursAvailable * courtCount, // In slot-hours
            deficit: 0,
            categorias: catsStats
        };
    }


    eliminarPareja(inscripcionId: number) {
        Swal.fire({
            title: '¿Eliminar?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar'
        }).then(result => {
            if (result.isConfirmed) {
                this.clubesService.eliminarPareja(inscripcionId).subscribe({
                    next: () => {
                        Swal.fire('Eliminado', 'Pareja eliminada.', 'success');
                        if (this.selectedCategoria) this.loadInscripciones(this.selectedCategoria.id);
                    },
                    error: (err) => Swal.fire('Error', 'No se pudo eliminar', 'error')
                });
            }
        });
    }
}
