import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { MysqlService } from '../../services/mysql.service';
import { AlumnoService } from '../../services/alumno.service';
import { Chart, registerables } from 'chart.js';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import Swal from 'sweetalert2';

Chart.register(...registerables);

@Component({
    selector: 'app-mis-habilidades',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './mis-habilidades.component.html',
    styleUrls: ['./mis-habilidades.component.scss']
})
export class MisHabilidadesComponent implements OnInit {
    userId: number | null = null;
    jugadorNombre: string = 'Jugador';
    jugadorFoto: string | null = null;

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

    // Video Management
    videos: any[] = [];
    groupedVideos: { [category: string]: any[] } = {};
    activeCategory: string = 'Todos';
    activeOrigin: 'todos' | 'coach' | 'personal' = 'todos';
    availableCategories: string[] = ['Todos'];

    selectedVideoTab: string = 'clases'; // Old tab UI (keep for compat or migrate)
    selectedMainTab: string = 'habilidades';

    // Comparison Feature
    isComparisonMode = false;
    selectedVideos: any[] = [];
    showComparison = false;

    aiResults: { [key: number]: any } = {};
    aiActiveResult: any = null;
    isAnalyzing: { [key: number]: boolean } = {};

    // Multi-Trainer Support
    originalEvaluations: any[] = [];
    trainers: any[] = [];
    selectedTrainerId: number | null = null;

    constructor(
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
            this.popupService.info(golpe, 'Este golpe aún no ha sido evaluado en tu última sesión.');
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
        if (!this.userId) {
            this.router.navigate(['/login']);
            return;
        }

        this.loadProfile();
        this.loadEvaluaciones();
        this.loadVideos();
    }

    loadProfile() {
        if (!this.userId) return;
        this.mysqlService.getPerfil(this.userId).subscribe({
            next: (res) => {
                if (res.success) {
                    this.jugadorNombre = res.user.nombre;
                    this.jugadorFoto = res.user.foto_perfil || res.user.foto || null;
                }
            },
            error: (err) => console.error('Error al cargar perfil:', err)
        });
    }

    loadEvaluaciones() {
        if (!this.userId) return;

        this.evaluacionService.getEvaluaciones(this.userId).subscribe({
            next: (data) => {
                this.originalEvaluations = data || [];

                // Extract unique trainers
                const trainerMap = new Map();
                this.originalEvaluations.forEach(e => {
                    const tId = e.entrenador_id || 0; // Handle null/0 as ID 0
                    if (!trainerMap.has(tId)) {
                        trainerMap.set(tId, {
                            id: tId,
                            nombre: e.entrenador || (tId === 0 ? 'General' : 'Entrenador Desconocido'),
                            email: e.email_entrenador
                        });
                    }
                });

                this.trainers = Array.from(trainerMap.values());

                if (this.trainers.length > 0) {
                    // Try to restore previous selection, or default to first
                    const initialId = (this.selectedTrainerId && trainerMap.has(this.selectedTrainerId))
                        ? this.selectedTrainerId
                        : this.trainers[0].id;

                    this.selectTrainer(initialId);
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

    selectTrainer(trainerId: number) {
        this.selectedTrainerId = trainerId;
        this.processDataForTrainer(trainerId);
    }

    processDataForTrainer(trainerId: number) {
        // Filter evaluations by trainer
        const trainerEvals = this.originalEvaluations.filter(e => (e.entrenador_id || 0) === trainerId);

        if (trainerEvals && trainerEvals.length > 0) {
            const sorted = trainerEvals.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

            this.storedLineLabels = sorted.map((e: any, idx: number) => {
                const d = new Date(e.fecha);
                return `E${idx + 1} (${d.getDate()}/${d.getMonth() + 1})`;
            });
            this.storedLineData = sorted.map((e: any) => Number(e.promedio_general));

            const latest = sorted[sorted.length - 1]; // Latest evaluation determines current skills
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

                // Standardize strokes list to include new ones
                const golpesList = [
                    'Derecha', 'Reves', 'Volea de Derecha', 'Volea de Reves', 'Bandeja', 'Vibora',
                    'Rulo', 'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'
                ];

                this.detailedScores = scores;
                this.storedRadarLabels = golpesList;
                this.storedRadarData = golpesList.map(key => {
                    const s = scores[key];
                    if (s && typeof s === 'object') {
                        return (Number(s.tecnica) + Number(s.control) + Number(s.direccion) + Number(s.decision)) / 4;
                    }
                    return 0; // Default to 0 if not evaluated yet
                });

                this.hasData = true;
                this.cdr.detectChanges();

                setTimeout(() => {
                    this.renderCharts();
                }, 300);
            }
        } else {
            this.hasData = false;
        }
    }

    renderCharts() {
        this.renderRadarChart();
        this.renderLineChart();
    }

    renderRadarChart() {
        const ctx = document.getElementById('radarChart') as HTMLCanvasElement;
        if (!ctx) return;
        if (this.radarChart) this.radarChart.destroy();

        this.radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: this.storedRadarLabels,
                datasets: [{
                    label: 'Mi Técnica',
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
                scales: {
                    r: {
                        angleLines: { color: '#eee' },
                        grid: { color: '#f0f0f0' },
                        suggestedMin: 0,
                        suggestedMax: 10,
                        pointLabels: {
                            font: { size: 12, weight: 'bold' },
                            color: '#444'
                        },
                        ticks: { display: false }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    renderLineChart() {
        const ctx = document.getElementById('lineChart') as HTMLCanvasElement;
        if (!ctx) return;
        if (this.lineChart) this.lineChart.destroy();

        this.lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.storedLineLabels,
                datasets: [{
                    label: 'Mi Evolución',
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
                        grid: { color: '#f0f0f0' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    get filteredVideos() {
        let vids = this.activeCategory === 'Todos' ? this.videos : (this.groupedVideos[this.activeCategory] || []);

        if (this.activeOrigin === 'coach') {
            vids = vids.filter((v: any) => v.entrenador_id && Number(v.entrenador_id) > 0);
        } else if (this.activeOrigin === 'personal') {
            vids = vids.filter((v: any) => !v.entrenador_id || Number(v.entrenador_id) === 0);
        }

        return vids;
    }

    setCategory(cat: string) {
        this.activeCategory = cat;
    }

    setOrigin(origin: 'todos' | 'coach' | 'personal') {
        this.activeOrigin = origin;
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
                this.popupService.info('Límite alcanzado', 'Solo puedes comparar 2 videos.');
            }
        }
    }

    openComparison() {
        if (this.selectedVideos.length === 2) {
            this.showComparison = true;
        } else {
            this.popupService.info('Selecciona 2 videos', 'Elige dos videos para comparar.');
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

    async subirVideoPersonal() {
        if (!this.userId) {
            Swal.fire('Error', 'No se identificó al usuario. Por favor inicia sesión.', 'error');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Subir Video Personal',
            html: `
                <div style="text-align: left;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Título</label>
                    <input id="swal-input-title" class="swal2-input" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box;" placeholder="Ej: Mi Volea de Derecha">
                    
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">¿Qué golpe es?</label>
                    <select id="swal-input-category" class="swal2-select" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; display: block;">
                        <option value="General">General</option>
                        <option value="Derecha">Derecha</option>
                        <option value="Revés">Revés</option>
                        <option value="Volea de Derecha">Volea de Derecha</option>
                        <option value="Volea de Revés">Volea de Revés</option>
                        <option value="Bandeja">Bandeja</option>
                        <option value="Víbora">Víbora</option>
                        <option value="Rulo">Rulo</option>
                        <option value="Remate">Remate</option>
                        <option value="Salida de Pared">Salida de Pared</option>
                        <option value="Globo">Globo</option>
                        <option value="Saque">Saque</option>
                    </select>

                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Comentarios</label>
                    <textarea id="swal-input-comment" class="swal2-textarea" style="margin: 0; width: 100%; box-sizing: border-box;" placeholder="Alguna nota sobre este video..."></textarea>
                </div>
            `,
            focusConfirm: false,
            confirmButtonText: 'Siguiente: Seleccionar Archivo',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const titulo = (document.getElementById('swal-input-title') as HTMLInputElement).value;
                const categoria = (document.getElementById('swal-input-category') as HTMLSelectElement).value;
                const comentario = (document.getElementById('swal-input-comment') as HTMLTextAreaElement).value;
                if (!titulo) {
                    Swal.showValidationMessage('El título es obligatorio');
                    return false;
                }
                return { titulo, categoria, comentario };
            }
        });

        if (formValues) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*';
            input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (!file) return;
                this.ejecutarSubida(file, formValues.titulo, formValues.categoria, formValues.comentario);
            };
            input.click();
        }
    }

    async ejecutarSubida(file: File, titulo: string, categoria: string, comentario: string) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('jugador_id', this.userId?.toString() || '');
        formData.append('tipo', 'personal');
        formData.append('titulo', titulo);
        formData.append('categoria', categoria);
        formData.append('comentario', comentario);

        // UI loading state (using Swal)
        Swal.fire({
            title: 'Subiendo video...',
            text: 'Preparando análisis AI',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        this.http.post<any>('https://api.padelmanager.cl/entrenador/add_video.php', formData, {
            headers: { 'Authorization': 'Bearer ' + btoa('1|padel_academy') }
        }).subscribe({
            next: (res) => {
                if (res.success) {
                    Swal.fire('¡Éxito!', 'Video subido correctamente', 'success');
                    this.loadVideos();
                    this.selectedVideoTab = 'personales';
                } else {
                    Swal.fire('Error', res.error || 'No se pudo subir el video', 'error');
                }
            },
            error: (err) => {
                console.error('Detalle error HTTP:', err);
                let msg = 'Error desconocido';

                if (err.status === 200 && typeof err.error === 'string') {
                    // Posible error de PHP que rompió el JSON
                    msg = 'Respuesta del servidor no válida (posible error de PHP). Revisa la consola.';
                } else if (err.error?.error) {
                    msg = err.error.error;
                } else if (err.message) {
                    msg = err.message;
                }

                Swal.fire('Error', 'Error al subir video: ' + msg, 'error');
            }
        });
    }

    loadVideos() {
        if (!this.userId) return;
        this.alumnoService.getVideos(this.userId).subscribe({
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
                    }

                    return { ...v, video_url: url, categoria: v.categoria || 'General' };
                });

                this.videos = processedVideos;

                // Group by category
                const catsSet = new Set<string>(['Todos']);
                this.groupedVideos = {};
                processedVideos.forEach((v: any) => {
                    const cat = v.categoria || 'General';
                    catsSet.add(cat);
                    if (!this.groupedVideos[cat]) this.groupedVideos[cat] = [];
                    this.groupedVideos[cat].push(v);
                });

                this.availableCategories = Array.from(catsSet);
            },
            error: (err) => console.error('Error al cargar videos:', err)
        });
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
}
