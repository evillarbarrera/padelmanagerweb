import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { MysqlService } from '../../services/mysql.service';
import { AlumnoService } from '../../services/alumno.service';
import { PopupService } from '../../services/popup.service';
import { Chart, registerables } from 'chart.js';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

Chart.register(...registerables);

@Component({
    selector: 'app-alumno-progreso',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './alumno-progreso.component.html',
    styleUrls: ['./alumno-progreso.component.scss']
})
export class AlumnoProgresoComponent implements OnInit {
    userId: number | null = null;
    alumnoId: number | null = null;
    coachNombre = 'Entrenador';

    alumnoNombre: string = '';
    alumnoFoto: string | null = null;
    coachFoto: string | null = null;

    isLoading = true;
    hasData = false;

    // Chart Data
    radarChart: any;
    lineChart: any;

    storedLineLabels: string[] = [];
    storedLineData: number[] = [];
    storedRadarLabels: string[] = [];
    storedRadarData: number[] = [];
    detailedScores: any = null;

    videos: any[] = [];
    videosCoach: any[] = [];
    videosPersonales: any[] = [];
    groupedVideos: { [category: string]: any[] } = {};
    activeCategory: string = 'Todos';
    activeOrigin: 'todos' | 'coach' | 'personal' = 'todos';
    availableCategories: string[] = ['Todos'];

    // Comparison Feature
    isComparisonMode = false;
    selectedVideos: any[] = [];
    showComparison = false;

    aiResults: { [key: number]: any } = {};
    aiActiveResult: any = null;
    isAnalyzing: { [key: number]: boolean } = {};

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private evaluacionService: EvaluacionService,
        private mysqlService: MysqlService,
        private alumnoService: AlumnoService,
        private popupService: PopupService,
        private cdr: ChangeDetectorRef,
        private http: HttpClient
    ) { }

    verDetalleGolpe(golpe: string) {
        const detail = this.detailedScores ? this.detailedScores[golpe] : null;

        if (!detail) {
            this.popupService.info(golpe, 'Este golpe aún no ha sido evaluado en la última sesión de este alumno.');
            return;
        }

        let message = `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border-left: 4px solid #ccff00; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; color: #111; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">💡 Feedback del Coach</h4>
                    <p style="margin: 0; color: #444; font-style: italic; line-height: 1.5;">
                        ${detail.comentario ? `"${detail.comentario}"` : 'Sin comentarios específicos para este golpe.'}
                    </p>
                </div>
                
                <h4 style="margin: 0 0 12px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📊 Desglose de Puntos</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="padding: 8px; background: #fafafa; border-radius: 8px;"><b>Técnica:</b> ${detail.tecnica || 0}/10</div>
                    <div style="padding: 8px; background: #fafafa; border-radius: 8px;"><b>Control:</b> ${detail.control || 0}/10</div>
                    <div style="padding: 8px; background: #fafafa; border-radius: 8px;"><b>Dirección:</b> ${detail.direccion || 0}/10</div>
                    <div style="padding: 8px; background: #fafafa; border-radius: 8px;"><b>Decisión:</b> ${detail.decision || 0}/10</div>
                </div>
            </div>
        `;

        this.popupService.open({
            title: `${golpe}`,
            message: message,
            icon: 'info',
            buttons: [{ text: 'Entendido', value: true, type: 'primary' }]
        });
    }

    ngOnInit() {
        this.userId = Number(localStorage.getItem('userId'));
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user) {
            this.coachNombre = user.nombre || 'Entrenador';
            let foto = user.foto_perfil || user.link_foto || user.foto || null;
            if (foto && !foto.startsWith('http')) {
                foto = `https://api.padelmanager.cl/${foto}`;
            }
            this.coachFoto = foto;
        }

        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.alumnoId = Number(id);
                this.loadAlumnoPerfil();
                this.loadEvaluaciones();
                this.loadVideos();
            }
        });
    }

    loadAlumnoPerfil() {
        if (!this.alumnoId) return;
        this.mysqlService.getPerfil(this.alumnoId).subscribe({
            next: (res) => {
                if (res && res.user) {
                    this.alumnoNombre = res.user.nombre;
                    let foto = res.user.foto_perfil || res.user.foto || null;
                    if (foto && !foto.startsWith('http')) {
                        foto = `https://api.padelmanager.cl/${foto}`;
                    }
                    this.alumnoFoto = foto;
                }
            },
            error: (err) => console.error('Error al cargar perfil del alumno:', err)
        });
    }

    loadEvaluaciones() {
        if (!this.alumnoId) return;

        this.evaluacionService.getEvaluaciones(this.alumnoId).subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    // Sort by date ascending
                    const sorted = data.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

                    // Store Line Data - UNIQUE labels for sessions
                    this.storedLineLabels = sorted.map((e: any, idx: number) => {
                        const d = new Date(e.fecha);
                        return `S${idx + 1} (${d.getDate()}/${d.getMonth() + 1})`;
                    });
                    this.storedLineData = sorted.map((e: any) => Number(e.promedio_general));

                    // Store Radar Data
                    const latest = sorted[sorted.length - 1];
                    if (latest && latest.scores) {
                        let scores = latest.scores;
                        if (typeof scores === 'string') {
                            try {
                                scores = JSON.parse(scores);
                            } catch (e) {
                                console.error('Error parsing scores:', e);
                                scores = {};
                            }
                        }
                        this.detailedScores = scores;

                        // Standardize strokes list
                        const golpesList = [
                            'Derecha', 'Reves', 'Volea de Derecha', 'Volea de Reves', 'Bandeja', 'Vibora',
                            'Rulo', 'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'
                        ];

                        this.storedRadarLabels = golpesList;
                        this.storedRadarData = golpesList.map(key => {
                            const s = scores[key];
                            if (s && typeof s === 'object') {
                                return (Number(s.tecnica) + Number(s.control) + Number(s.direccion) + Number(s.decision)) / 4;
                            }
                            return 0;
                        });

                        this.hasData = true;
                        this.cdr.detectChanges();

                        setTimeout(() => {
                            this.renderRadarChart();
                            this.renderLineChart();
                        }, 200);
                    }
                } else {
                    this.hasData = false;
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error cargando evaluaciones:', err);
                this.isLoading = false;
            }
        });
    }

    renderRadarChart() {
        const ctx = document.getElementById('webRadarChart') as HTMLCanvasElement;
        if (!ctx) return;
        if (this.radarChart) this.radarChart.destroy();

        this.radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: this.storedRadarLabels,
                datasets: [{
                    label: 'Habilidades',
                    data: this.storedRadarData,
                    fill: true,
                    backgroundColor: 'rgba(204, 255, 0, 0.2)',
                    borderColor: '#ccff00',
                    borderWidth: 3,
                    pointBackgroundColor: '#111',
                    pointBorderColor: '#fff',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: { line: { borderWidth: 3 } },
                scales: {
                    r: {
                        angleLines: { color: '#eee' },
                        grid: { color: '#f0f0f0' },
                        suggestedMin: 0,
                        suggestedMax: 10,
                        pointLabels: {
                            font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
                            color: '#444',
                            padding: 20
                        },
                        ticks: { backdropColor: 'transparent', display: false }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    renderLineChart() {
        const ctx = document.getElementById('webLineChart') as HTMLCanvasElement;
        if (!ctx) return;
        if (this.lineChart) this.lineChart.destroy();

        this.lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.storedLineLabels,
                datasets: [{
                    label: 'Promedio General',
                    data: this.storedLineData,
                    borderColor: '#ccff00',
                    backgroundColor: 'rgba(204, 255, 0, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#111',
                    pointBorderColor: '#ccff00',
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        grid: { color: '#f0f0f0' },
                        ticks: { color: '#666', font: { weight: 'bold' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#666', font: { weight: 'bold' } }
                    }
                }
            }
        });
    }

    loadVideos() {
        if (!this.alumnoId) return;
        this.alumnoService.getVideos(this.alumnoId).subscribe({
            next: (vids) => {
                const processedVideos = (vids || []).map((v: any) => {
                    let url = v.video_url || '';
                    if (url && !url.startsWith('http')) {
                        const cleanPath = url.startsWith('/') ? url.substring(1) : url;
                        url = `https://api.padelmanager.cl/${cleanPath}`;
                    }

                    if (v.ai_report) {
                        try {
                            const parsed = typeof v.ai_report === 'string' ? JSON.parse(v.ai_report) : v.ai_report;
                            this.aiResults[v.id] = parsed;
                        } catch (e) {
                            console.error('Error parsing backend ai_report', e);
                        }
                    } else {
                        const saved = localStorage.getItem(`ai_report_${v.id}`);
                        if (saved) this.aiResults[v.id] = JSON.parse(saved);
                    }

                    return { ...v, video_url: url, categoria: v.categoria || 'General' };
                });

                this.videos = processedVideos;
                this.videosCoach = processedVideos.filter((v: any) => v.entrenador_id && Number(v.entrenador_id) > 0);
                this.videosPersonales = processedVideos.filter((v: any) => !v.entrenador_id || Number(v.entrenador_id) === 0);

                // Grouping only coach videos
                this.groupedVideos = {};
                const catsSet = new Set<string>(['Todos']);

                this.videosCoach.forEach((v: any) => {
                    const cat = v.categoria || 'General';
                    catsSet.add(cat);
                    if (!this.groupedVideos[cat]) this.groupedVideos[cat] = [];
                    this.groupedVideos[cat].push(v);
                });

                this.availableCategories = Array.from(catsSet);

                // Keep active category if it still exists
                if (!this.availableCategories.includes(this.activeCategory)) {
                    this.activeCategory = 'Todos';
                }
            },
            error: (err) => console.error('Error al cargar videos:', err)
        });
    }

    setCategory(cat: string) {
        this.activeCategory = cat;
    }

    setOrigin(origin: 'todos' | 'coach' | 'personal') {
        this.activeOrigin = origin;
    }

    get filteredVideos() {
        return this.activeCategory === 'Todos' ? this.videosCoach : (this.groupedVideos[this.activeCategory] || []);
    }

    toggleComparisonMode() {
        this.isComparisonMode = !this.isComparisonMode;
        if (!this.isComparisonMode) {
            this.selectedVideos = [];
        }
    }

    selectVideoToCompare(vid: any) {
        const index = this.selectedVideos.findIndex(v => v.id === vid.id);
        if (index > -1) {
            this.selectedVideos.splice(index, 1);
        } else {
            if (this.selectedVideos.length < 2) {
                this.selectedVideos.push(vid);
            } else {
                this.popupService.info('Límite alcanzado', 'Solo puedes comparar 2 videos a la vez.');
            }
        }
    }

    openComparison() {
        if (this.selectedVideos.length === 2) {
            this.showComparison = true;
        } else {
            this.popupService.info('Selecciona 2 videos', 'Debes elegir exactamente dos videos para comparar.');
        }
    }

    closeComparison() {
        this.showComparison = false;
    }

    togglePlayBoth() {
        const videos = document.querySelectorAll('.comp-vid-wrapper video') as NodeListOf<HTMLVideoElement>;
        let anyPaused = false;
        videos.forEach(v => { if (v.paused) anyPaused = true; });

        videos.forEach(v => {
            if (anyPaused) {
                v.play();
            } else {
                v.pause();
            }
        });
    }

    isVideoSelected(vid: any): boolean {
        return this.selectedVideos.some(v => v.id === vid.id);
    }

    async analizarVideo(vid: any) {
        this.isAnalyzing[vid.id] = true;
        this.cdr.detectChanges();

        const formData = new FormData();
        formData.append('video_id', vid.id);
        formData.append('video_url', vid.video_url);

        this.http.post<any>('https://api.padelmanager.cl/ia/gemini_analyze.php', formData)
            .subscribe({
                next: (res) => {
                    this.isAnalyzing[vid.id] = false;
                    if (res.success) {
                        this.aiResults[vid.id] = res.analysis;
                        localStorage.setItem(`ai_report_${vid.id}`, JSON.stringify(res.analysis));
                        this.cdr.detectChanges();
                    } else {
                        alert('Error en análisis: ' + (res.error || 'Intente nuevamente'));
                    }
                },
                error: (err) => {
                    this.isAnalyzing[vid.id] = false;
                    console.error('AI Analysis Error:', err);
                    alert('Error de conexión con Gemini.');
                }
            });
    }

    verReporte(vid: any) {
        this.aiActiveResult = this.aiResults[vid.id];
    }

    confirmDeleteVideo(video: any) {
        this.popupService.confirm(
            '¿Eliminar video?',
            'Esta acción no se puede deshacer.'
        ).then((result) => {
            if (result === true) {
                this.isLoading = true;
                this.alumnoService.deleteVideo(video.id).subscribe({
                    next: (res) => {
                        this.isLoading = false;
                        this.popupService.success('Eliminado', 'El video ha sido eliminado.');
                        this.loadVideos();
                    },
                    error: (err) => {
                        this.isLoading = false;
                        console.error('Error deleting video:', err);
                        this.popupService.error('Error', 'No se pudo eliminar el video.');
                    }
                });
            }
        });
    }

    volver() {
        this.router.navigate(['/alumnos']);
    }
}
