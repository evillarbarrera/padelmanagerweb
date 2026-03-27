import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { MysqlService } from '../../services/mysql.service';
import { AlumnoService } from '../../services/alumno.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { PopupService } from '../../services/popup.service';
import { Chart, registerables } from 'chart.js';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import Swal from 'sweetalert2';

Chart.register(...registerables);

@Component({
    selector: 'app-alumno-progreso',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './alumno-progreso.component.html',
    styleUrls: ['./alumno-progreso.component.scss']
})
export class AlumnoProgresoComponent implements OnInit {
    userId: number | null = null;
    alumnoId: number | null = null;
    coachNombre = 'Entrenador';

    alumnoNombre: string = '';
    alumnoFoto: string | null = null;
    activeTab: string = 'gráficos';

    setActiveTab(tab: string) {
        this.activeTab = tab;
        if (tab === 'gráficos') {
            setTimeout(() => {
                this.renderRadarChart();
                this.renderLineChart();
            }, 100);
        }
    }
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

    golpesList = [
        'General', 'Derecha', 'Revés', 'Volea de Derecha', 'Volea de Revés', 'Bandeja', 'Víbora',
        'Rulo', 'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'
    ];

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

    ngOnInit() {
        this.userId = Number(localStorage.getItem('userId'));
        this.loadProfile();

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

    loadProfile(): void {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user) {
            this.coachNombre = user.nombre || 'Entrenador';
            let foto = user.foto_perfil || user.link_foto || user.foto || null;
            if (foto && !foto.startsWith('http')) {
                foto = `https://api.padelmanager.cl/${foto}`;
            }
            this.coachFoto = foto;
        }
    }

    loadAlumnoPerfil() {
        if (!this.alumnoId) return;
        this.mysqlService.getPerfil(this.alumnoId).subscribe({
            next: (res) => {
                if (res && res.user) {
                    const u = res.user;
                    this.alumnoNombre = `${u.nombre || ''} ${u.apellido || ''}`.trim();
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

    // --- EVALUACIONES ---

    loadEvaluaciones() {
        if (!this.alumnoId) return;
        this.isLoading = true;
        this.evaluacionService.getEvaluaciones(this.alumnoId).subscribe({
            next: (data) => {
                console.log('Evaluaciones recibidas:', data);
                if (data && data.length > 0) {
                    const sorted = data.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
                    
                    this.storedLineLabels = sorted.map((e: any, idx: number) => {
                        const d = new Date(e.fecha);
                        return `S${idx + 1} (${d.getDate()}/${d.getMonth() + 1})`;
                    });
                    this.storedLineData = sorted.map((e: any) => Number(e.promedio_general || 0));

                    const latest = sorted[sorted.length - 1];
                    if (latest) {
                        let scores = latest.scores || latest.resultado_ia || latest.detalles || {};
                        if (typeof scores === 'string') {
                            try { scores = JSON.parse(scores); } catch (e) { scores = {}; }
                        }
                        this.detailedScores = scores;
                        
                        const golpesList = ['Derecha', 'Reves', 'Volea de Derecha', 'Volea de Reves', 'Bandeja', 'Vibora', 'Rulo', 'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'];
                        this.storedRadarLabels = golpesList;
                        this.storedRadarData = golpesList.map(key => {
                            const val = scores[key] || scores[key.toLowerCase()] || scores[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];
                            if (val && typeof val === 'object') {
                                return (Number(val.tecnica || 0) + Number(val.control || 0) + Number(val.direccion || 0) + Number(val.decision || 0)) / 4;
                            } else if (typeof val === 'number') {
                                return val;
                            }
                            return 0;
                        });

                        this.hasData = true;
                        this.cdr.detectChanges();
                        setTimeout(() => {
                            this.renderRadarChart();
                            this.renderLineChart();
                        }, 300);
                    }
                } else {
                    this.hasData = false;
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error cargando evaluaciones:', err);
                this.isLoading = false;
                this.hasData = false;
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

    // --- VIDEOS ---

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

                this.groupedVideos = {};
                const catsWithContent = new Set<string>(['Todos']);
                this.videosCoach.forEach((v: any) => {
                    const cat = v.categoria || 'General';
                    catsWithContent.add(cat);
                    if (!this.groupedVideos[cat]) this.groupedVideos[cat] = [];
                    this.groupedVideos[cat].push(v);
                });
                this.availableCategories = Array.from(catsWithContent);
                this.availableCategories.sort((a, b) => {
                    if (a === 'Todos') return -1;
                    if (b === 'Todos') return 1;
                    return this.golpesList.indexOf(a) - this.golpesList.indexOf(b);
                });
                if (!this.availableCategories.includes(this.activeCategory)) this.activeCategory = 'Todos';
            },
            error: (err) => console.error('Error al cargar videos:', err)
        });
    }

    get filteredVideos() {
        return this.activeCategory === 'Todos' ? this.videosCoach : (this.groupedVideos[this.activeCategory] || []);
    }

    async triggerVideoUpload() {
        if (!this.alumnoId) return;
        const { value: formValues } = await Swal.fire({
            title: 'Subir Video de Entrenamiento',
            html: `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Ingresa los detalles técnicos antes de seleccionar el video.</p>
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">Título del Clip</label>
                <input id="swal-input-title" class="swal2-input" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; border-radius: 8px; height: 45px;" placeholder="Ej: Análisis de Saque">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">¿A qué golpe corresponde?</label>
                <select id="swal-input-category" class="swal2-select" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; display: block; border-radius: 8px; background: #f8fafc; height: 45px;">
                    ${this.golpesList.map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
                <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #111;">Observaciones para el Alumno</label>
                <textarea id="swal-input-comment" class="swal2-textarea" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 8px; min-height: 100px;" placeholder="Detalles técnicos a mejorar..."></textarea>
            </div>
          `,
            showCancelButton: true,
            confirmButtonText: 'Seleccionar Video',
            confirmButtonColor: '#ccff00',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const titulo = (document.getElementById('swal-input-title') as HTMLInputElement).value;
                const categoria = (document.getElementById('swal-input-category') as HTMLSelectElement).value;
                const comentario = (document.getElementById('swal-input-comment') as HTMLTextAreaElement).value;
                if (!titulo) { Swal.showValidationMessage('El título es obligatorio'); return false; }
                return { titulo, categoria, comentario };
            }
        });

        if (formValues) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'video/*';
            fileInput.onchange = (e: any) => {
                const file = e.target.files[0];
                if (!file) return;
                this.ejecutarSubida(file, formValues.titulo, formValues.categoria, formValues.comentario);
            };
            fileInput.click();
        }
    }

    private ejecutarSubida(file: File, title: string, category: string, comment: string) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('jugador_id', this.alumnoId?.toString() || '');
        formData.append('entrenador_id', this.userId?.toString() || '');
        formData.append('titulo', title);
        formData.append('categoria', category);
        formData.append('comentario', comment || '');

        this.isLoading = true;
        this.alumnoService.uploadVideo(formData).subscribe({
            next: () => {
                this.isLoading = false;
                this.popupService.success('¡Éxito!', 'Video subido correctamente.');
                this.loadVideos();
            },
            error: (err) => {
                this.isLoading = false;
                console.error(err);
                this.popupService.error('Error', 'No se pudo subir el video.');
            }
        });
    }

    setCategory(cat: string) { this.activeCategory = cat; }
    setOrigin(origin: 'todos' | 'coach' | 'personal') { this.activeOrigin = origin; }

    toggleComparisonMode() {
        this.isComparisonMode = !this.isComparisonMode;
        if (!this.isComparisonMode) this.selectedVideos = [];
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
        if (this.selectedVideos.length === 2) this.showComparison = true;
        else this.popupService.info('Selecciona 2 videos', 'Debes elegir exactamente dos videos para comparar.');
    }

    closeComparison() { this.showComparison = false; }

    togglePlayBoth() {
        const videos = document.querySelectorAll('.comp-vid-wrapper video') as NodeListOf<HTMLVideoElement>;
        let anyPaused = false;
        videos.forEach(v => { if (v.paused) anyPaused = true; });
        videos.forEach(v => { if (anyPaused) v.play(); else v.pause(); });
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

    verReporte(vid: any) { this.aiActiveResult = this.aiResults[vid.id]; }

    confirmDeleteVideo(video: any) {
        this.popupService.confirm('¿Eliminar video?', 'Esta acción no se puede deshacer.')
            .then((result) => {
                if (result === true) {
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

    volver() { this.router.navigate(['/alumnos']); }
}
