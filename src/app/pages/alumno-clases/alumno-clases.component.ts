import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MysqlService } from '../../services/mysql.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { EvaluacionService } from '../../services/evaluacion.service';
import { AlumnoService } from '../../services/alumno.service';
import { PopupService } from '../../services/popup.service';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { HttpEventType } from '@angular/common/http';

Chart.register(...registerables);

@Component({
    selector: 'app-alumno-clases',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './alumno-clases.component.html',
    styleUrls: ['./alumno-clases.component.scss']
})
export class AlumnoClasesComponent implements OnInit {
    // Basic Info
    alumnoId: number = 0;
    userId: number = 0;
    userRole: string = 'alumno';
    alumnoNombre: string = '';
    alumnoFoto: string = '';
    coachNombre: string = '';
    alumnoProfile: any = null;
    packActual: any = null;

    // View State
    activeTab: string = 'roadmap';
    activeProgresoSubTab: string = 'graficos';
    isLoading: boolean = false;
    isVideosLoading: boolean = false;
    
    // Pedagogical Data
    historialMalla: any[] = [];
    evaluaciones: any[] = [];
    
    // Performance Data (Charts)
    radarChart: any;
    lineChart: any;
    storedRadarLabels: string[] = [];
    storedRadarData: number[] = [];
    storedTacticoLabels: string[] = [];
    storedTacticoData: number[] = [];
    storedFisicoLabels: string[] = [];
    storedFisicoData: number[] = [];
    storedMentalLabels: string[] = [];
    storedMentalData: number[] = [];
    storedLineLabels: string[] = [];
    storedLineData: number[] = [];
    detailedScores: any = null;
    hasChartData = false;
    tacticoChart: any;
    fisicoChart: any;
    mentalChart: any;

    // Comité Técnico (Golpes)
    golpes: string[] = ['Derecha', 'Reves', 'Saque', 'Globo', 'Volea de Derecha', 'Volea de Reves', 'Bandeja', 'Vibora', 'Remate', 'Rulo', 'Salida de Pared', 'Resto'];
    evaluationData: { [key: string]: any } = {};

    // Comité Táctico
    tacticas: string[] = [
        'Posicionamiento fondo', 'Posicionamiento red', 'Decisiones fondo', 'Decisiones red', 
        'Golpes aéreos', 'Intenciones fondo', 'Intenciones red',
        'Globo vs Abajo', 'Volea Bloqueo vs Plana', 'Volea Plana vs Cortada',
        'Botar globo vs Remate Def', 'Remate Def vs Bandeja/Vibora',
        'Remate Def vs Ofensivo', 'Bajada Pared vs Globo'
    ];
    tacticalData: { [key: string]: any } = {};

    evaluacionComentarios: string = '';

    // Comité Físico
    fisicos: string[] = ['Coordinacion', 'Fuerza tren inf', 'Fuerza tren sup', 'Estabilidad', 'Agilidad', 'Explosividad'];
    fisicoData: { [key: string]: any } = {};

    // Comité Mental
    mentales: string[] = ['Dialogo interno', 'Dialogo externo', 'Confianza personal', 'Puntos importantes', 'Comunicacion compañero', 'Comportamiento post'];
    mentalData: { [key: string]: any } = {};

    // Videos
    videosCoach: any[] = [];
    groupedVideos: { [category: string]: any[] } = {};
    activeVideoCategory: string = '';
    availableVideoCategories: string[] = ['Todos'];
    aiResults: { [key: number]: any } = {};
    isAnalyzing: { [key: number]: boolean } = {};

    // Administración
    availableMallas: any[] = [];
    alumnoPacks: any[] = [];
    activeEvalSubTab: 'tecnico' | 'tactico' | 'fisico' | 'mental' = 'tecnico';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private mysqlService: MysqlService,
        private entrenamientoService: EntrenamientoService,
        private evaluacionService: EvaluacionService,
        private alumnoService: AlumnoService,
        private popupService: PopupService,
        private cdr: ChangeDetectorRef,
        private http: HttpClient
    ) { 
        // INIT EVAL DATA
        this.golpes.forEach(g => {
            this.evaluationData[g] = { tecnica: 1, control: 1, direccion: 1, decision: 1, comentario: '' };
        });
        this.tacticas.forEach(t => {
            this.tacticalData[t] = { valor: 1, comentario: '' };
        });
        this.fisicos.forEach(f => {
            this.fisicoData[f] = { valor: 1, comentario: '' };
        });
        this.mentales.forEach(m => {
            this.mentalData[m] = { valor: 1, comentario: '' };
        });
    }

    ngOnInit() {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            this.userId = user.id;
            this.userRole = user.rol || 'alumno';
            this.coachNombre = user.nombre || 'Entrenador';
        }

        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.alumnoId = Number(id);
                this.loadInitialData();
                this.restoreAnalysisState();
            }
        });
    }

    private restoreAnalysisState() {
        const stored = localStorage.getItem(`analyzing_videos_${this.alumnoId}`);
        if (stored) {
            try {
                const analyzing = JSON.parse(stored);
                // Si el analisis fue hace mas de 2 horas, probablemente fallo o termino
                const now = Date.now();
                Object.keys(analyzing).forEach(vidId => {
                    if (now - analyzing[vidId] < 7200000) {
                        this.isAnalyzing[Number(vidId)] = true;
                        // Simular polling si el backend no lo notifica via sockets
                        // this.pollAnalysisStatus(Number(vidId));
                    }
                });
            } catch(e) {}
        }
    }

    loadInitialData() {
        this.loadAlumnoPerfil();
        this.loadMallaData();
        this.loadEvaluaciones();
        this.loadVideos();
        this.loadPacksAlumno();
        this.loadAvailableMallas(); 
    }

    loadAvailableMallas() {
        this.entrenamientoService.getMallas(this.userId).subscribe({
            next: (res: any) => this.availableMallas = res || []
        });
    }

    loadAlumnoPerfil() {
        if (!this.alumnoId) return;
        this.mysqlService.getPerfil(this.alumnoId).subscribe({
            next: (res: any) => {
                if (res.user) {
                    this.alumnoNombre = res.user.nombre || 'Estudiante';
                    this.alumnoProfile = res.user;
                    let foto = res.user.foto_perfil || res.user.foto || null;
                    if (foto && !foto.startsWith('http')) {
                        foto = `https://api.padelmanager.cl/${foto.startsWith('/') ? foto.substring(1) : foto}`;
                    } else if (!foto) {
                        foto = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.alumnoNombre)}&background=ccff00&color=111&bold=true`;
                    }
                    this.alumnoFoto = foto;
                    this.packActual = res.user.pack_nombre ? { nombre: res.user.pack_nombre } : null;
                    this.cdr.detectChanges();
                }
            }
        });
    }

    loadMallaData() {
        if (!this.alumnoId) return;
        this.isLoading = true;
        this.entrenamientoService.getHistorialMalla(this.alumnoId, this.userId).subscribe({
            next: (res: any) => {
                this.historialMalla = Array.isArray(res) ? res : [];
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => this.isLoading = false
        });
    }

    loadEvaluaciones() {
        if (!this.alumnoId) return;
        
        // Coach only sees their own evaluations, student sees all.
        const currentCoachId = (this.userRole === 'entrenador') ? this.userId : undefined;
        
        this.evaluacionService.getEvaluaciones(this.alumnoId, currentCoachId).subscribe({
            next: (res: any) => {
                const list = (res || []).filter((e:any) => e.scores);
                this.evaluaciones = list;
                if (list.length > 0) {
                    this.processPerformanceCharts(list);
                    this.prepopulateEvaluationData(list[0]);
                }
            }
        });
    }

    prepopulateEvaluationData(lastEval: any) {
        if (!lastEval || !lastEval.scores) return;
        try {
            const scoresRaw = typeof lastEval.scores === 'string' ? JSON.parse(lastEval.scores) : lastEval.scores;
            
            // Handle nested (Physical/Mental/etc) or flat (legacy) format
            const tecnico = scoresRaw.tecnico || scoresRaw;
            const tactico = scoresRaw.tactico || {};
            const fisico = scoresRaw.fisico || {};
            const mental = scoresRaw.mental || {};

            // Técnico
            Object.keys(tecnico).forEach(golpe => {
                if (this.evaluationData[golpe]) {
                    this.evaluationData[golpe] = { ...tecnico[golpe], comentario: '' };
                }
            });

            // Táctico
            Object.keys(tactico).forEach(tactica => {
                if (this.tacticalData[tactica]) {
                    this.tacticalData[tactica] = { ...tactico[tactica], comentario: '' };
                }
            });

            // Físico
            Object.keys(fisico).forEach(f => {
                if (this.fisicoData[f]) {
                    this.fisicoData[f] = { ...fisico[f], comentario: '' };
                }
            });

            // Mental
            Object.keys(mental).forEach(m => {
                if (this.mentalData[m]) {
                    this.mentalData[m] = { ...mental[m], comentario: '' };
                }
            });

            this.cdr.detectChanges();
        } catch(e) { console.error("Error pre-populating:", e); }
    }

    processPerformanceCharts(evals: any[]) {
        if (!evals || evals.length === 0) return;
        const last = evals[0];
        try {
            const raw = typeof last.scores === 'string' ? JSON.parse(last.scores) : last.scores;
            const tecnico = raw.tecnico || raw;
            const tactico = raw.tactico || {};
            const fisico = raw.fisico || {};
            const mental = raw.mental || {};

            // RADAR TÉCNICO (Golpes)
            this.storedRadarLabels = Object.keys(tecnico);
            if (this.storedRadarLabels.length === 0) this.storedRadarLabels = this.golpes;
            this.storedRadarData = this.storedRadarLabels.map(l => {
                const g = tecnico[l];
                if (!g) return 0;
                return (Number(g.tecnica || 0) + Number(g.control || 0) + Number(g.direccion || 0) + Number(g.decision || 0)) / 4;
            });

            // RADAR TÁCTICO
            this.storedTacticoLabels = Object.keys(tactico);
            if (this.storedTacticoLabels.length === 0) this.storedTacticoLabels = this.tacticas;
            this.storedTacticoData = this.storedTacticoLabels.map(l => (tactico[l]?.valor || 0));

            // RADAR FÍSICO
            this.storedFisicoLabels = Object.keys(fisico);
            if (this.storedFisicoLabels.length === 0) this.storedFisicoLabels = this.fisicos;
            this.storedFisicoData = this.storedFisicoLabels.map(l => (fisico[l]?.valor || 0));

            // RADAR MENTAL
            this.storedMentalLabels = Object.keys(mental);
            if (this.storedMentalLabels.length === 0) this.storedMentalLabels = this.mentales;
            this.storedMentalData = this.storedMentalLabels.map(l => (mental[l]?.valor || 0));

            // EVOLUCIÓN LINEAL
            this.storedLineLabels = evals.slice().reverse().map((e, idx) => `S${idx + 1}`);
            this.storedLineData = evals.slice().reverse().map(e => {
                const n = typeof e.scores === 'string' ? JSON.parse(e.scores) : e.scores;
                const scoresTecnico = n.tecnico || n;
                const averages = Object.values(scoresTecnico).map((g: any) => {
                    return (Number(g.tecnica || 0) + Number(g.control || 0) + Number(g.direccion || 0) + Number(g.decision || 0)) / 4;
                });
                return averages.length > 0 ? averages.reduce((a, b: any) => a + b, 0) / averages.length : 0;
            });

            this.hasChartData = true;
            if (this.activeTab === 'progreso') {
                setTimeout(() => this.renderCharts(), 100);
            }
        } catch(e) {
            console.error("Error processing charts:", e);
        }
    }

    loadVideos() {
        if (!this.alumnoId || !this.userId) return;
        this.isVideosLoading = true;
        this.alumnoService.getVideos(this.alumnoId, this.userId).subscribe({
            next: (vids) => {
                const processed = (vids || []).filter((v:any) => v.entrenador_id && Number(v.entrenador_id) === this.userId || this.userRole === 'alumno').map((v:any) => {
                    if (v.video_url && !v.video_url.startsWith('http')) {
                        v.video_url = `https://api.padelmanager.cl/${v.video_url.startsWith('/') ? v.video_url.substring(1) : v.video_url}`;
                    }
                    if (v.ai_report) {
                        try { 
                            this.aiResults[v.id] = typeof v.ai_report === 'string' ? JSON.parse(v.ai_report) : v.ai_report; 
                            // Si tiene reporte, ya no se esta analizando
                            if (this.isAnalyzing[v.id]) {
                                delete this.isAnalyzing[v.id];
                                this.saveAnalysisState();
                            }
                        } catch(e){}
                    }
                    return { ...v, categoria: v.categoria || 'General' };
                });

                this.videosCoach = processed;
                this.groupedVideos = {};
                const cats = new Set<string>();
                processed.forEach((v:any) => {
                    const c = v.categoria || 'General';
                    cats.add(c);
                    if (!this.groupedVideos[c]) this.groupedVideos[c] = [];
                    this.groupedVideos[c].push(v);
                });
                this.availableVideoCategories = Array.from(cats);
                
                if (this.availableVideoCategories.length > 0 && !this.availableVideoCategories.includes(this.activeVideoCategory)) {
                    this.activeVideoCategory = this.availableVideoCategories[0];
                }
                this.isVideosLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isVideosLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private saveAnalysisState() {
        const analyzing: any = {};
        Object.keys(this.isAnalyzing).forEach(id => {
            if (this.isAnalyzing[Number(id)]) {
                analyzing[id] = Date.now();
            }
        });
        localStorage.setItem(`analyzing_videos_${this.alumnoId}`, JSON.stringify(analyzing));
    }

    get filteredVideos() {
        if (!this.activeVideoCategory) return this.videosCoach;
        return this.groupedVideos[this.activeVideoCategory] || [];
    }

    packsGrupales: any[] = [];
    packsIndividuales: any[] = [];
    activePacksSubTab: 'grupales' | 'individuales' = 'individuales';

    // Grouping for Grupales
    groupedPacksGrupales: { [key: string]: any[] } = {};
    grupalPeriodKeys: string[] = [];
    activeGrupalPeriod: string = '';

    loadPacksAlumno() {
        if (!this.alumnoId) return;
        const currentCoachId = (this.userRole === 'entrenador') ? this.userId : undefined;
        
        this.entrenamientoService.getPacksAlumno(this.alumnoId, currentCoachId).subscribe({
            next: (res: any) => {
                const allPacks = res.data ? res.data : (Array.isArray(res) ? res : []);
                this.alumnoPacks = allPacks;
                
                // Grouping logic
                this.packsGrupales = allPacks.filter((p: any) => p.tipo === 'grupal');
                this.packsIndividuales = allPacks.filter((p: any) => p.tipo !== 'grupal');

                // Advanced Grouping for Grupales (By Month/Year)
                this.groupedPacksGrupales = {};
                const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                
                this.packsGrupales.forEach(p => {
                    const date = new Date(p.fecha_inicio);
                    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    if (!this.groupedPacksGrupales[key]) this.groupedPacksGrupales[key] = [];
                    this.groupedPacksGrupales[key].push(p);
                });

                // Sort keys chronologically (newest first)
                this.grupalPeriodKeys = Object.keys(this.groupedPacksGrupales).sort((a, b) => {
                    const [ma, ya] = a.split(' ');
                    const [mb, yb] = b.split(' ');
                    const da = new Date(Number(ya), months.indexOf(ma));
                    const db = new Date(Number(yb), months.indexOf(mb));
                    return db.getTime() - da.getTime();
                });

                if (this.grupalPeriodKeys.length > 0 && !this.activeGrupalPeriod) {
                    this.activeGrupalPeriod = this.grupalPeriodKeys[0];
                }

                // Auto-switch to groups only if no individuals available
                if (this.packsIndividuales.length === 0 && this.packsGrupales.length > 0) {
                    this.activePacksSubTab = 'grupales';
                }
                
                this.cdr.detectChanges();
            }
        });
    }

    marcarPagado(p: any) {
        if (!p || !p.pack_jugador_id) return;
        
        const payload = {
            pack_jugador_id: p.pack_jugador_id,
            precio_pagado: p.precio_pagado || 0,
            metodo_pago: 'Transferencia'
        };

        this.isLoading = true;
        this.entrenamientoService.marcarPackPagado(payload).subscribe({
            next: () => {
                this.isLoading = false;
                this.popupService.success('Pago Confirmado', 'El pack ha sido marcado como PAGADO correctamente.');
                this.loadPacksAlumno();
            },
            error: () => {
                this.isLoading = false;
                this.popupService.error('Error', 'No se pudo actualizar el estado de pago.');
            }
        });
    }

    enviarRecordatorioPago(p: any) {
        if (!p || !p.pack_jugador_id || !this.alumnoId) return;

        const payload = {
            pack_jugador_id: p.pack_jugador_id,
            jugador_id: this.alumnoId
        };

        this.isLoading = true;
        this.entrenamientoService.enviarRecordatorioPago(payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.popupService.success('Recordatorio Enviado', res.message || 'El alumno ha sido notificado.');
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.popupService.error('Error', 'No se pudo enviar el aviso. Verifique que el alumno tenga email.');
                this.cdr.detectChanges();
            }
        });
    }

    // --- 🛠 SHARED ACTIONS ---

    setTab(t: string) {
        this.activeTab = t;
        this.cdr.detectChanges();
        if (t === 'progreso') {
            setTimeout(() => {
                this.renderCharts();
                this.cdr.detectChanges();
            }, 300);
        }
    }

    actualizarNivel(event: any) {
        const nuevoNivel = event.target.value;
        if (!this.alumnoId || !nuevoNivel) return;
        this.isLoading = true;
        this.mysqlService.updatePerfil(this.alumnoId, { categoria: nuevoNivel, nivel: nuevoNivel }).subscribe({
            next: () => {
                if (this.alumnoProfile) this.alumnoProfile.categoria = nuevoNivel;
                this.popupService.success('Categoría Actualizada', `El nivel oficial de ${this.alumnoNombre} ahora es ${nuevoNivel}`);
                this.loadAlumnoPerfil();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.popupService.error('Error', 'No se pudo guardar la categoría oficial.');
            }
        });
    }

    renderCharts() {
        if (!this.hasChartData) return;
        
        const rCtx = document.getElementById('webRadarChart') as HTMLCanvasElement;
        if (rCtx) {
            if (this.radarChart) this.radarChart.destroy();
            this.radarChart = new Chart(rCtx, {
                type: 'radar',
                data: {
                    labels: this.storedRadarLabels,
                    datasets: [{
                        label: 'Fuerza Técnica',
                        data: this.storedRadarData,
                        borderColor: '#ccff00',
                        backgroundColor: 'rgba(204, 255, 0, 0.05)',
                        pointBackgroundColor: '#111',
                        pointBorderColor: '#ccff00',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: '#111', titleFont: { size: 14, weight: 'bold' }, padding: 12, cornerRadius: 10 }
                    },
                    scales: { 
                        r: { 
                            min: 0, max: 10,
                            ticks: { display: false },
                            grid: { color: 'rgba(0,0,0,0.03)', lineWidth: 1 },
                            angleLines: { color: 'rgba(0,0,0,0.03)' },
                            pointLabels: { font: { size: 11, weight: 900 }, color: '#111' }
                        } 
                    } 
                }
            });
        }

        const tCtx = document.getElementById('webTacticoChart') as HTMLCanvasElement;
        if (tCtx) {
            if (this.tacticoChart) this.tacticoChart.destroy();
            this.tacticoChart = new Chart(tCtx, {
                type: 'radar',
                data: {
                    labels: this.storedTacticoLabels,
                    datasets: [{
                        label: 'Fuerza Táctica',
                        data: this.storedTacticoData,
                        borderColor: '#00f2ff',
                        backgroundColor: 'rgba(0, 242, 255, 0.05)',
                        pointBackgroundColor: '#111',
                        pointBorderColor: '#00f2ff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { r: { min: 0, max: 10, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.03)' }, angleLines: { color: 'rgba(0,0,0,0.03)' }, pointLabels: { font: { size: 10, weight: 700 } } } }
                }
            });
        }

        const fCtx = document.getElementById('webFisicoChart') as HTMLCanvasElement;
        if (fCtx) {
            if (this.fisicoChart) this.fisicoChart.destroy();
            this.fisicoChart = new Chart(fCtx, {
                type: 'radar',
                data: {
                    labels: this.storedFisicoLabels,
                    datasets: [{
                        label: 'Fuerza Física',
                        data: this.storedFisicoData,
                        borderColor: '#ff4757',
                        backgroundColor: 'rgba(255, 71, 87, 0.05)',
                        pointBackgroundColor: '#111',
                        pointBorderColor: '#ff4757',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { r: { min: 0, max: 10, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.03)' }, angleLines: { color: 'rgba(0,0,0,0.03)' }, pointLabels: { font: { size: 10, weight: 700 } } } }
                }
            });
        }

        const mCtx = document.getElementById('webMentalChart') as HTMLCanvasElement;
        if (mCtx) {
            if (this.mentalChart) this.mentalChart.destroy();
            this.mentalChart = new Chart(mCtx, {
                type: 'radar',
                data: {
                    labels: this.storedMentalLabels,
                    datasets: [{
                        label: 'Fuerza Mental',
                        data: this.storedMentalData,
                        borderColor: '#2ed573',
                        backgroundColor: 'rgba(46, 213, 115, 0.05)',
                        pointBackgroundColor: '#111',
                        pointBorderColor: '#2ed573',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { r: { min: 0, max: 10, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.03)' }, angleLines: { color: 'rgba(0,0,0,0.03)' }, pointLabels: { font: { size: 10, weight: 700 } } } }
                }
            });
        }

        const lCtx = document.getElementById('webLineChart') as HTMLCanvasElement;
        if (lCtx) {
            if (this.lineChart) this.lineChart.destroy();
            this.lineChart = new Chart(lCtx, {
                type: 'line',
                data: {
                    labels: this.storedLineLabels,
                    datasets: [{
                        label: 'Evolución',
                        data: this.storedLineData,
                        borderColor: '#ccff00',
                        backgroundColor: 'rgba(204, 255, 0, 0.05)',
                        borderWidth: 3,
                        pointBackgroundColor: '#111',
                        pointBorderColor: '#ccff00',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: '#111', padding: 12, cornerRadius: 10 }
                    },
                    scales: { 
                        y: { 
                            min: 0, max: 10,
                            grid: { display: false },
                            border: { display: false },
                            ticks: { font: { weight: 800 }, color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: { font: { weight: 800 }, color: '#94a3b8' }
                        }
                    } 
                }
            });
        }
    }

    abrirPanelDetalle(sesion: any) {
        this.popupService.info('Detalle de Sesión', `Objetivos: ${sesion.lista_objetivos || 'No definidos'}`);
    }

    verDetalleGolpe(label: string) {
        if (this.detailedScores && this.detailedScores[label]) {
            const s = this.detailedScores[label];
            const msg = `Técnica: ${s.tecnica} | Control: ${s.control} | Dirección: ${s.direccion} | Decisión: ${s.decision}`;
            this.popupService.info(`Detalle: ${label}`, msg);
        }
    }

    async triggerVideoUpload() {
        if (!this.alumnoId) return;
        
        const categories = ['General', ...this.golpes];
        
        Swal.fire({
            title: 'Subir Video de Entrenamiento',
            html: `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Ingresa los detalles técnicos antes de seleccionar el video.</p>
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">Título del Clip</label>
                <input id="swal-input-title" class="swal2-input" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; border-radius: 8px; height: 45px;" placeholder="Ej: Análisis de Saque">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">¿A qué golpe corresponde?</label>
                <select id="swal-input-category" class="swal2-select" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; display: block; border-radius: 8px; background: #f8fafc; height: 45px;">
                    ${categories.map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">Observaciones para el Alumno</label>
                <textarea id="swal-input-comment" class="swal2-textarea" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px; min-height: 100px;" placeholder="Detalles técnicos a mejorar..."></textarea>
            </div>
          `,
            showCancelButton: true,
            confirmButtonText: 'Seleccionar Video',
            confirmButtonColor: '#ccff00',
            cancelButtonColor: '#ff4b5c',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const titulo = (document.getElementById('swal-input-title') as HTMLInputElement).value;
                const categoria = (document.getElementById('swal-input-category') as HTMLSelectElement).value;
                const comentario = (document.getElementById('swal-input-comment') as HTMLTextAreaElement).value;
                if (!titulo) { Swal.showValidationMessage('El título es obligatorio'); return false; }
                return { titulo, categoria, comentario };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'video/*';
                fileInput.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    // Show initial loading swal
                    Swal.fire({
                        title: 'Subiendo Video...',
                        html: 'Iniciando transferencia...',
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
                    
                    this.ejecutarSubida(file, result.value.titulo, result.value.categoria, result.value.comentario);
                };
                fileInput.click();
            }
        });
    }

    private ejecutarSubida(file: File, title: string, category: string, comment: string) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('jugador_id', this.alumnoId.toString());
        formData.append('entrenador_id', this.userId.toString());
        formData.append('titulo', title);
        formData.append('categoria', category);
        formData.append('comentario', comment || '');

        this.isLoading = true;
        this.alumnoService.uploadVideo(formData).subscribe({
            next: (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    const percentDone = Math.round(100 * event.loaded / event.total);
                    Swal.update({
                        title: 'Subiendo Video...',
                        html: `Progreso: <b>${percentDone}%</b>`,
                    });
                } else if (event.type === HttpEventType.Response) {
                    this.isLoading = false;
                    Swal.close();
                    this.popupService.success('¡Éxito!', 'Video subido correctamente.');
                    this.loadVideos();
                }
            },
            error: (err) => {
                this.isLoading = false;
                Swal.close();
                console.error(err);
                this.popupService.error('Error', 'No se pudo subir el video.');
            }
        });
    }

    confirmDeleteVideo(video: any) {
        Swal.fire({
            title: '¿Eliminar video?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4b5c',
            cancelButtonColor: '#cccccc',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.isLoading = true;
                this.alumnoService.deleteVideo(video.id).subscribe({
                    next: () => {
                        this.isLoading = false;
                        this.popupService.success('Eliminado', 'El video ha sido eliminado.');
                        this.loadVideos();
                    },
                    error: (err) => {
                        this.isLoading = false;
                        this.popupService.error('Error', 'No se pudo eliminar el video.');
                    }
                });
            }
        });
    }

    // --- 🛠 COACH METHODS ---

    asignarMalla(mallaId: any) {
        if (!mallaId || !this.alumnoId) {
            this.popupService.error('Error', 'Debes seleccionar un plan de entrenamiento.');
            return;
        }

        const data = {
            jugador_id: this.alumnoId,
            malla_id: Number(mallaId),
            entrenador_id: this.userId
        };

        this.isLoading = true;
        this.entrenamientoService.asignarMalla(data).subscribe({
            next: () => {
                this.isLoading = false;
                this.loadMallaData();
                this.popupService.success('Plan Iniciado', 'Plan de Entrenamiento iniciado con éxito.');
            },
            error: (err) => {
                this.isLoading = false;
                console.error('Error asignando malla:', err);
                this.popupService.error('Error', 'No se pudo asignar el plan. Verifique la conexión.');
            }
        });
    }

    setAllEvaluationScores(score: number) {
        this.golpes.forEach(g => {
            if (this.evaluationData[g]) {
                this.evaluationData[g].tecnica = score;
                this.evaluationData[g].control = score;
                this.evaluationData[g].direccion = score;
                this.evaluationData[g].decision = score;
            }
        });
    }

    updateEvaluationScore(golpe: string, metric: string, delta: number) {
        if (this.evaluationData[golpe]) {
            let val = (this.evaluationData[golpe][metric] || 0) + delta;
            if (val < 1) val = 1;
            if (val > 10) val = 10;
            this.evaluationData[golpe][metric] = val;
        }
    }

    getGolpePromedio(golpe: string): number {
        const d = this.evaluationData[golpe];
        if (!d) return 0;
        return (d.tecnica + d.control + d.direccion + d.decision) / 4;
    }

    updateTacticoScore(tactica: string, delta: number) {
        if (this.tacticalData[tactica]) {
            let val = (this.tacticalData[tactica].valor || 0) + delta;
            if (val < 1) val = 1;
            if (val > 10) val = 10;
            this.tacticalData[tactica].valor = val;
        }
    }

    updateFisicoScore(ref: string, delta: number) {
        if (this.fisicoData[ref]) {
            let val = (this.fisicoData[ref].valor || 0) + delta;
            if (val < 1) val = 1;
            if (val > 10) val = 10;
            this.fisicoData[ref].valor = val;
        }
    }

    updateMentalScore(ref: string, delta: number) {
        if (this.mentalData[ref]) {
            let val = (this.mentalData[ref].valor || 0) + delta;
            if (val < 1) val = 1;
            if (val > 10) val = 10;
            this.mentalData[ref].valor = val;
        }
    }

    guardarEvaluacion() {
        if (!this.alumnoId || !this.userId) return;

        // Mostrar indicador de carga
        Swal.fire({
            title: 'Publicando Evaluación',
            text: 'Guardando métricas y notificando al alumno...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const payload = {
            jugador_id: this.alumnoId,
            entrenador_id: this.userId,
            comentarios: this.evaluacionComentarios,
            scores: {
                tecnico: this.evaluationData,
                tactico: this.tacticalData,
                fisico: this.fisicoData,
                mental: this.mentalData
            }
        };

        this.evaluacionService.crearEvaluacion(payload).subscribe({
            next: () => {
                Swal.close();
                this.popupService.success('Evaluación Publicada', 'La evaluación trazable se ha guardado correctamente y ya está disponible en el panel del alumno.');
                this.loadEvaluaciones();
                this.setTab('progreso');
            },
            error: (err) => {
                Swal.close();
                console.error('Save error detailed:', err);
                this.popupService.error('Error de Publicación', 'Hubo un problema al guardar la evaluación. Por favor, revisa tu conexión e inténtalo de nuevo.');
            }
        });
    }
}
