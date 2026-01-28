import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { MysqlService } from '../../services/mysql.service';
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

    isLoading = true;
    hasData = false;

    // Chart Data
    radarChart: any;
    lineChart: any;

    storedLineLabels: string[] = [];
    storedLineData: number[] = [];
    storedRadarLabels: string[] = [];
    storedRadarData: number[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private evaluacionService: EvaluacionService,
        private mysqlService: MysqlService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.userId = Number(localStorage.getItem('userId'));
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user) {
            this.coachNombre = user.nombre || 'Entrenador';
        }

        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.alumnoId = Number(id);
                this.loadAlumnoPerfil();
                this.loadEvaluaciones();
            }
        });
    }

    loadAlumnoPerfil() {
        if (!this.alumnoId) return;
        this.mysqlService.getPerfil(this.alumnoId).subscribe({
            next: (res) => {
                if (res) {
                    this.alumnoNombre = res.nombre;
                    this.alumnoFoto = res.foto_perfil || res.link_foto || null;
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

                    // Store Line Data
                    this.storedLineLabels = sorted.map((e: any) => {
                        const d = new Date(e.fecha);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                    });
                    this.storedLineData = sorted.map((e: any) => Number(e.promedio_general));

                    // Store Radar Data
                    const latest = sorted[sorted.length - 1];
                    if (latest && latest.scores) {
                        this.storedRadarLabels = Object.keys(latest.scores);
                        this.storedRadarData = this.storedRadarLabels.map(key => {
                            const s = latest.scores[key];
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

    volver() {
        this.router.navigate(['/alumnos']);
    }
}
