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

    // UI & Features State
    activeConfigIndex: number = 0;
    simSubTab: 'agenda' | 'grupos' = 'agenda';
    viewMode: 'day' | 'week' = 'day';
    presetCategories: any[] = [
        { nombre: '1ra Varones', type: 'varones', color: '#1e40af' },
        { nombre: '2da Varones', type: 'varones', color: '#1d4ed8' },
        { nombre: '3ra Varones', type: 'varones', color: '#2563eb' },
        { nombre: '4ta Varones', type: 'varones', color: '#3b82f6' },
        { nombre: '5ta Varones', type: 'varones', color: '#60a5fa' },
        { nombre: '6ta Varones', type: 'varones', color: '#93c5fd' },
        { nombre: 'Damas A', type: 'damas', color: '#be185d' },
        { nombre: 'Damas B', type: 'damas', color: '#db2777' },
        { nombre: 'Damas C', type: 'damas', color: '#e91e63' },
        { nombre: 'Damas D', type: 'damas', color: '#f06292' },
        { nombre: 'Damas E', type: 'damas', color: '#f48fb1' }
    ];

    simulatedGroupsSummary: any[] = [];
    selectedBracketCategoryId: number | null = null;

    onTabChange(tab: any) {
        this.activeDetailTab = tab;
        
        // Always DEFAULT to "All Tournament" when entering these tabs
        if (tab === 'generar' || tab === 'resumen' || tab === 'programacion') {
            const previousCat = this.selectedCategoria;
            this.selectedCategoria = null;
            
            // If we previously had a filter, we must reload all inscriptions and stats
            if (previousCat && this.selectedTorneo) {
                this.loadCategorias(this.selectedTorneo.id);
            } else {
                this.calculateStats();
            }
        }
    }

    isCategorySelected(name: string): boolean {
        return this.newTorneo.categorias.some((c: any) => c.nombre === name);
    }

    toggleCategory(p: any) {
        const index = this.newTorneo.categorias.findIndex((c: any) => c.nombre === p.nombre);
        if (index > -1) {
            this.newTorneo.categorias.splice(index, 1);
        } else {
            this.newTorneo.categorias.push({
                nombre: p.nombre,
                max_parejas: 16,
                puntos_repartir: 100
            });
            this.activeConfigIndex = this.newTorneo.categorias.length - 1;
        }
    }

    getCategoryColor(name: string): string {
        if (!name) return '#64748b';
        
        const normalized = name.toLowerCase().trim();
        
        // 1. Try to find in presets
        const cat = this.presetCategories.find(p => 
            p.nombre.toLowerCase().trim() === normalized || 
            normalized.includes(p.nombre.toLowerCase().trim())
        );
        if (cat) return cat.color;

        // 2. Dynamic Fallback: Use the Golden Ratio to maximize visual distance
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Golden ratio constant (~0.618) helps distribute values as far as possible
        const goldenRatio = 0.618033988749895;
        let h = (Math.abs(hash) * goldenRatio) % 1;
        const hue = Math.floor(h * 360);
        
        // Return professional HSL (Saturation 75%, Lightness 50% for vibrancy)
        return `hsl(${hue}, 75%, 50%)`;
    }

    getVisibleHours(): number[] {
        return this.gridHours;
    }

    getMatchScore(m: any, teamNum: number): string {
        if (!m.resultado_json) return '';
        try {
            const results = typeof m.resultado_json === 'string' ? JSON.parse(m.resultado_json) : m.resultado_json;
            return results.map((set: any) => teamNum === 1 ? set.p1 : set.p2).join(' ');
        } catch (e) {
            return '';
        }
    }

    selectBracketCategory(id: number) {
        this.selectedBracketCategoryId = id;
        
        // Priority 1: If we have simulated matches, use them
        const simMatches = this.matchesToSchedule.filter(m => m.categoryId == id && m.id < -1000);
        
        if (simMatches.length > 0) {
            this.playoffMatches = simMatches;
            this.organizeBracket(simMatches);
        } else {
            // Priority 2: Fallback to real data
            this.loadPlayoffs(id);
        }
    }

    anadirNuevaCategoria() {
        this.newTorneo.categorias.push({
            nombre: 'Nueva Categoría',
            max_parejas: 16,
            puntos_repartir: 100
        });
        this.activeConfigIndex = this.newTorneo.categorias.length - 1;
    }

    eliminarCategoria(id: number, event: any) {
        event.stopPropagation();
        Swal.fire({
            title: '¿Eliminar Categoría?',
            text: 'Se eliminarán también las inscripciones de esta categoría. Esta acción es irreversible.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar categoría',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444', // Red for danger
            cancelButtonColor: '#f1f5f9'
        }).then(result => {
            if (result.isConfirmed) {
                this.clubesService.deleteCategoria(id).subscribe(() => {
                    this.loadCategorias(this.selectedTorneo.id);
                });
            }
        });
    }

    editCategoriaCapacidad(cat: any) {
        Swal.fire({
            title: 'Editar Capacidad',
            input: 'number',
            inputValue: cat.max_parejas,
            showCancelButton: true
        }).then(res => {
            if (res.isConfirmed) {
                cat.max_parejas = res.value;
                this.clubesService.updateCategoria(cat.id, cat).subscribe();
            }
        });
    }

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

        if (this.categorias.length === 0) {
            Swal.fire({
                title: 'Atención',
                text: 'No hay categorías definidas en este torneo.',
                icon: 'warning',
                confirmButtonColor: '#0f172a'
            });
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
                        confirmButtonColor: '#0f172a'
                    });
                } catch (e) {
                    console.error('Error during schedule processing', e);
                    Swal.fire({
                        title: 'Error de Proyección',
                        text: 'Ocurrió un error al procesar el calendario: ' + (e as any).message,
                        icon: 'error',
                        confirmButtonColor: '#0f172a'
                    });
                }
            },
            error: (err) => {
                console.error('Error fetching inscriptions', err);
                Swal.fire({
                    title: 'Error de Conexión',
                    text: 'No se pudieron obtener las inscripciones o el servidor no responde.',
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
            }
        });
    }

    simulateTournamentAtCapacity() {
        if (!this.selectedTorneo) return;

        Swal.fire({
            title: 'Simulación a Capacidad Máxima',
            text: '¿Deseas proyectar el torneo usando el máximo de parejas configurado en cada categoría?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, simular todo',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0f172a',
            cancelButtonColor: '#f1f5f9'
        }).then(result => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Simulando...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const simulationData = this.categorias.map((cat, index) => {
                    const max = cat.max_parejas || 12;
                    let dummies = [];
                    for (let i = 1; i <= max; i++) {
                        dummies.push({
                            id: -(index + 1) * 1000 - i,
                            nombre_pareja: `Pareja Sim ${i} (${cat.nombre})`,
                            categoria_id: cat.id,
                            categoria_nombre: cat.nombre,
                            dummy: true
                        });
                    }
                    return dummies;
                });

                this.inscripciones = simulationData.flat();
                
                // Initialize grid if empty
                if (this.gridDays.length === 0) {
                    this.initAvailabilityGrid();
                }

                // Execute the processing
                this.processSchedule(simulationData);
                this.calculateStats();
                this.organizeCalendar(); // CRITICAL: Updates the view data

                // Switch to simulation view
                this.activeDetailTab = 'generar';
                this.simSubTab = 'agenda';

                Swal.close();
                Swal.fire({
                    title: 'Proyección Lista',
                    text: 'Se ha generado el calendario simulado a capacidad máxima.',
                    icon: 'success',
                    showConfirmButton: true,
                    showCancelButton: false,
                    showDenyButton: false,
                    confirmButtonText: 'Ver Agenda',
                    confirmButtonColor: '#0f172a'
                });
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
        const allGroupMatches: any[] = [];
        
        // Use a map to collect playoff matches by round across ALL categories
        const playoffRoundsMap: { [key: string]: any[] } = {
            'Dieciseisavos': [],
            'Octavos': [],
            'Cuartos': [],
            'Semi': [],
            'Final': []
        };

        // 2. Collection Phase
        this.categorias.forEach((cat, index) => {
            let inscritos = [...(allInscripciones[index] || [])];
            const targetTotal = (cat.max_parejas && cat.max_parejas > 0) ? cat.max_parejas : (inscritos.length > 0 ? inscritos.length : 4);
            const remainder = targetTotal % 4;
            const fullTarget = remainder === 0 ? targetTotal : targetTotal + (4 - remainder);
            let needed = fullTarget - inscritos.length;

            for (let i = 0; i < needed; i++) {
                inscritos.push({
                    id: -(index + 1) * 100 - (inscritos.length + 1),
                    nombre_jugador_1: `Jugador Ficticio`,
                    nombre_jugador_2: `Pareja Ficticia`,
                    dummy: true
                });
            }

            // Groups
            for (let i = 0; i < inscritos.length; i += 4) {
                const group = inscritos.slice(i, i + 4);
                const groupName = String.fromCharCode(65 + Math.floor(i / 4));
                for (let x = 0; x < group.length; x++) {
                    for (let y = x + 1; y < group.length; y++) {
                        allGroupMatches.push({
                            id: -1,
                            category: cat.nombre,
                            categoryId: cat.id,
                            ronda: `Grupo ${groupName}`,
                            team1: group[x],
                            team2: group[y],
                            pareja1_nombre: group[x].nombre_jugador_1 ? `${group[x].nombre_jugador_1} / ${group[x].nombre_jugador_2}` : (group[x].nombre_pareja || 'TBD'),
                            pareja2_nombre: group[y].nombre_jugador_1 ? `${group[y].nombre_jugador_1} / ${group[y].nombre_jugador_2}` : (group[y].nombre_pareja || 'TBD'),
                            duration: this.matchDuration
                        });
                    }
                }
            }

            // Playoffs
            const numPairs = inscritos.length;
            let rounds: string[] = [];
            if (numPairs >= 32) rounds = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semi', 'Final'];
            else if (numPairs >= 16) rounds = ['Octavos', 'Cuartos', 'Semi', 'Final'];
            else if (numPairs >= 8) rounds = ['Cuartos', 'Semi', 'Final'];
            else if (numPairs >= 4) rounds = ['Semi', 'Final'];

            rounds.forEach(round => {
                const matchCount = round === 'Dieciseisavos' ? 16 : (round === 'Octavos' ? 8 : (round === 'Cuartos' ? 4 : (round === 'Semi' ? 2 : 1)));
                for (let i = 0; i < matchCount; i++) {
                    playoffRoundsMap[round].push({
                        id: -2000 - (index * 1000) - (rounds.indexOf(round) * 100) - i,
                        category: cat.nombre,
                        categoryId: cat.id,
                        ronda: round,
                        pareja1_nombre: `Clasificado ${i * 2 + 1}`,
                        pareja2_nombre: `Clasificado ${i * 2 + 2}`,
                        duration: this.matchDuration,
                        dummy: true
                    });
                }
            });
        });

        // 3. Sequential Phased Scheduling with Mixed Categories
        // Order: Groups -> Dieciseisavos -> Octavos -> Cuartos -> Semi -> Final
        
        const scheduleBatch = (batch: any[]) => {
            // SHUFFLE the batch to interleave categories within the same round
            const shuffled = batch.sort(() => Math.random() - 0.5);
            shuffled.forEach(m => {
                if (slotIndex < slots.length) {
                    const slot = slots[slotIndex++];
                    m.tempDate = slot.date;
                    m.tempTime = `${slot.hour}:00`;
                    m.court = slot.courtName;
                    this.matchesToSchedule.push(m);
                }
            });
        };

        // Clear current schedule to avoid duplicates
        this.matchesToSchedule = [];

        // Execution of phases
        scheduleBatch(allGroupMatches);
        scheduleBatch(playoffRoundsMap['Dieciseisavos']);
        scheduleBatch(playoffRoundsMap['Octavos']);
        scheduleBatch(playoffRoundsMap['Cuartos']);
        scheduleBatch(playoffRoundsMap['Semi']);
        scheduleBatch(playoffRoundsMap['Final']);

        console.log('Matches scheduled in logical order and mixed by category.');

        // 4. Update Views
        // Update the bracket backing array so *ngIf="playoffMatches.length > 0" passes
        this.playoffMatches = this.matchesToSchedule.filter(m => m.id < -1000);
        
        // Auto-select first category if none selected to show visual content immediately
        if (this.categorias.length > 0 && !this.selectedBracketCategoryId) {
            this.selectedBracketCategoryId = this.categorias[0].id;
        }

        this.organizeBracket(this.playoffMatches);
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
                Swal.fire({
                    title: '¡Guardado!',
                    text: 'Fechas y horarios del torneo actualizados correctamente',
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
            },
            error: (err) => {
                console.error('Error saving tournament data:', err);

                let msg = 'No se pudo actualizar la configuración.';
                if (err.url && err.url.includes('update_torneo.php')) {
                    msg += ' Error al actualizar fechas del torneo.';
                } else if (err.url && err.url.includes('update_torneo_availability.php')) {
                    msg += ' Error al actualizar horarios.';
                }

                Swal.fire({
                    title: 'Error',
                    text: msg,
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
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

    playoffRounds: any = {
        left: { dieciseisavos: [], octavos: [], cuartos: [], semi: [] },
        right: { dieciseisavos: [], octavos: [], cuartos: [], semi: [] },
        final: null
    };

    loadPlayoffs(catId: number) {
        this.clubesService.getPartidosRonda(catId, '').subscribe(res => {
            this.playoffMatches = res;
            this.organizeBracket(res);
        });
    }

    organizeBracket(matches: any[]) {
        // Reset structure
        this.playoffRounds = {
            left: { dieciseisavos: [], octavos: [], cuartos: [], semi: [] },
            right: { dieciseisavos: [], octavos: [], cuartos: [], semi: [] },
            final: null
        };

        if (!matches || matches.length === 0) return;

        // 1. Separate Final
        this.playoffRounds.final = matches.find(m => (m.ronda || '').toLowerCase().includes('final')) || null;

        // 2. Helper to distribute rounds
        const distributeRound = (roundMatches: any[], targetKey: string) => {
            roundMatches.sort((a,b) => a.id - b.id);
            const mid = Math.ceil(roundMatches.length / 2);
            this.playoffRounds.left[targetKey] = roundMatches.slice(0, mid);
            this.playoffRounds.right[targetKey] = roundMatches.slice(mid);
        };

        // 3. Process each round
        const r16 = matches.filter(m => (m.ronda || '').toLowerCase().includes('dieciseis') || (m.ronda || '').includes('16'));
        const r8 = matches.filter(m => (m.ronda || '').toLowerCase().includes('octavos') || (m.ronda || '').includes(' 8'));
        const r4 = matches.filter(m => (m.ronda || '').toLowerCase().includes('cuartos') || (m.ronda || '').includes(' 4'));
        const r2 = matches.filter(m => (m.ronda || '').toLowerCase().includes('semi'));

        distributeRound(r16, 'dieciseisavos');
        distributeRound(r8, 'octavos');
        distributeRound(r4, 'cuartos');
        distributeRound(r2, 'semi');

        console.log('Bracket organized bilateral:', this.playoffRounds);
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
                        Swal.fire({
                            title: '¡Listo!',
                            text: res.mensaje,
                            icon: 'success',
                            confirmButtonColor: '#0f172a'
                        });
                        this.activeDetailTab = 'playoffs';
                        this.loadPlayoffs(this.selectedCategoria.id);
                    },
                    error: (err) => {
                        Swal.fire({
                            title: 'Error',
                            text: err.error?.error || 'No se pudo cerrar la fase de grupos',
                            icon: 'error',
                            confirmButtonColor: '#0f172a'
                        });
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
                Swal.fire({
                    title: 'Actualizado',
                    text: 'Estado de inscripción cambiado.',
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
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
            const dateKey = m.tempDate || 'Sin Programar';
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(m);
        });

        // Convert to array and sort
        this.calendarDays = Object.keys(groups).sort().map(date => {
            const dayMatches = groups[date];
            
            // Group by hour for the timeline-v3 view
            const hourGroupsMap: { [key: string]: any[] } = {};
            dayMatches.forEach((m: any) => {
                const hour = m.tempTime || '09:00'; // Fallback to 09:00 if not set
                if (!hourGroupsMap[hour]) hourGroupsMap[hour] = [];
                hourGroupsMap[hour].push(m);
            });

            const hourGroups = Object.keys(hourGroupsMap).sort((a,b) => a.localeCompare(b)).map(h => ({
                hour: h,
                matches: hourGroupsMap[h]
            }));

            return {
                date: date,
                matches: dayMatches.sort((a: any, b: any) => (a.tempTime || '').localeCompare(b.tempTime || '')),
                hourGroups: hourGroups
            };
        });

        // Reset selected day index to show the first day available
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
                Swal.fire({
                    title: 'Error de Configuración',
                    text: 'No hay canchas cargadas para este club. Por favor, asegúrate de que el club tenga canchas configuradas.',
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
                return;
            }
        }
        if (!this.planParams.startDate || !this.planParams.endDate) {
            Swal.fire({
                title: 'Fechas Requeridas',
                text: 'Selecciona fecha de inicio y fin para la programación.',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
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
            Swal.fire({
                title: 'Sin Pendientes',
                text: 'No hay partidos pendientes de programar en esta selección.',
                icon: 'info',
                confirmButtonColor: '#0f172a'
            });
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
            Swal.fire({
                title: 'Programación Parcial',
                text: `Se programaron ${scheduledCount} partidos, pero quedaron ${pending.length} sin asignar por falta de cupos.`,
                icon: 'warning',
                confirmButtonColor: '#0f172a'
            });
        } else {
            Swal.fire({
                title: 'Planificación Exitosa',
                text: `Se han propuesto horarios para ${scheduledCount} partidos exitosamente.`,
                icon: 'success',
                showCancelButton: false,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#0f172a'
            });
        }
    }

    savePlanificacion() {
        const changes = this.matchesToSchedule.filter(m => m.tempDate && m.tempTime).map(m => ({
            partido_id: m.id,
            fecha_inicio: `${m.tempDate} ${m.tempTime}:00`,
            cancha_id: m.tempCanchaId || 0
        }));

        this.clubesService.saveSchedule(changes).subscribe({
            next: () => Swal.fire({
                title: 'Planificación Guardada',
                text: 'La programación oficial se ha actualizado correctamente.',
                icon: 'success',
                confirmButtonColor: '#0f172a'
            }),
            error: () => Swal.fire({
                title: 'Error de Guardado',
                text: 'No se pudo sincronizar la programación con el servidor.',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            })
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
            Swal.fire({
                title: 'Marcador Vacío',
                text: 'Ingresa al menos el resultado del primer set para guardar.',
                icon: 'warning',
                confirmButtonColor: '#0f172a'
            });
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
                Swal.fire({
                    title: 'Error de Guardado',
                    text: 'No se pudo registrar el resultado en el servidor.',
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
            }
        });
    }

    crearTorneo() {
        if (!this.newTorneo.nombre || !this.newTorneo.fecha_inicio) {
            Swal.fire({
                title: 'Datos Incompletos',
                text: 'El nombre del torneo y la fecha de inicio son campos obligatorios.',
                icon: 'warning',
                confirmButtonColor: '#0f172a'
            });
            return;
        }

        this.clubesService.createTorneoV2({ ...this.newTorneo, creator_id: this.userId }).subscribe({
            next: (res) => {
                Swal.fire({
                    title: '¡Torneo Creado!',
                    text: 'El torneo principal se ha registrado. Procede a configurar las categorías.',
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
                this.loadInitialData();
                this.selectTorneo(res.torneo); // Assuming backend returns the created object
            },
            error: (err) => {
                Swal.fire({
                    title: 'Error de Registro',
                    text: 'No se pudo crear el torneo. Verifica los datos e intenta nuevamente.',
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
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
        Swal.fire({
            title: 'Plantillas Cargadas',
            text: 'Se han generado las categorías estándar (Varones 1-6, Damas A-E).',
            icon: 'success',
            showCancelButton: false,
            confirmButtonText: 'Genial',
            confirmButtonColor: '#0f172a'
        });
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
            Swal.fire({
                title: 'Nombres Requeridos',
                text: 'Debes ingresar el nombre de ambos jugadores para registrar la pareja.',
                icon: 'warning',
                confirmButtonColor: '#0f172a'
            });
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
                Swal.fire({
                    title: '¡Inscrito!',
                    text: 'Pareja añadida correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
                this.loadInscripciones(this.selectedCategoria.id);
                // Reset form
                this.manualInscripcion = {
                    jugador1_id: 0, jugador1_nombre: '', jugador1_seleccionado: false,
                    jugador2_id: 0, jugador2_nombre: '', jugador2_seleccionado: false,
                    nombre_pareja: ''
                };
            },
            error: (err) => {
                Swal.fire({
                    title: 'Error de Inscripción',
                    text: err.error?.error || 'No se pudo realizar la inscripción. Revisa los datos.',
                    icon: 'error',
                    confirmButtonColor: '#0f172a'
                });
            }
        });
    }

    anadirParejaManual() {
        Swal.fire({
            title: 'Añadir Pareja Manual',
            html: `
                <div style="text-align: left;">
                    <label style="font-size: 12px; font-weight: bold; color: #64748b;">Jugador 1</label>
                    <input id="swal-input1" class="swal2-input" placeholder="Nombre Jugador 1" style="font-size: 14px; margin-top: 5px;">
                    
                    <label style="font-size: 12px; font-weight: bold; color: #64748b; margin-top: 15px; display: block;">Jugador 2</label>
                    <input id="swal-input2" class="swal2-input" placeholder="Nombre Jugador 2" style="font-size: 14px; margin-top: 5px;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar Inscripción',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const j1 = (document.getElementById('swal-input1') as HTMLInputElement).value;
                const j2 = (document.getElementById('swal-input2') as HTMLInputElement).value;
                if (!j1 || !j2) {
                    Swal.showValidationMessage('Ambos nombres son requeridos');
                    return false;
                }
                return { j1, j2 };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.manualInscripcion = {
                    jugador1_id: 0,
                    jugador1_nombre: result.value.j1,
                    jugador2_id: 0,
                    jugador2_nombre: result.value.j2,
                    nombre_pareja: `${result.value.j1} / ${result.value.j2}`
                };
                this.inscribirParejaManual();
            }
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
                        Swal.fire({
                            title: '¡Listo!',
                            text: 'Grupos generados exitosamente.',
                            icon: 'success',
                            confirmButtonColor: '#0f172a'
                        });
                        this.loadGroupData(this.selectedCategoria.id); // Refresh group data immediately
                        this.activeDetailTab = 'grupos';
                    },
                    error: (err) => {
                        Swal.fire({
                            title: 'Error',
                            text: err.error?.error || 'No se pudieron generar los grupos',
                            icon: 'error',
                            confirmButtonColor: '#0f172a'
                        });
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
            Swal.fire({
                title: 'Configuración Requerida',
                text: 'Define primero las fechas de inicio y fin en la pestaña de categorías o configuración.',
                icon: 'info',
                confirmButtonColor: '#0f172a'
            });
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
                        Swal.fire({
                            title: 'Eliminado',
                            text: 'Pareja eliminada correctamente.',
                            icon: 'success',
                            confirmButtonColor: '#0f172a'
                        });
                        if (this.selectedCategoria) this.loadInscripciones(this.selectedCategoria.id);
                    },
                    error: (err) => {
                        Swal.fire({
                            title: 'Error',
                            text: 'No se pudo eliminar la pareja.',
                            icon: 'error',
                            confirmButtonColor: '#0f172a'
                        });
                    }
                });
            }
        });
    }
}
