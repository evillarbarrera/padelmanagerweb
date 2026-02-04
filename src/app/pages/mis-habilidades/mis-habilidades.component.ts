import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { MysqlService } from '../../services/mysql.service';
import { AlumnoService } from '../../services/alumno.service';
import { Chart, registerables } from 'chart.js';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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

    videos: any[] = [];

    constructor(
        private router: Router,
        private evaluacionService: EvaluacionService,
        private mysqlService: MysqlService,
        private alumnoService: AlumnoService,
        private cdr: ChangeDetectorRef
    ) { }

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
                if (data && data.length > 0) {
                    const sorted = data.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

                    this.storedLineLabels = sorted.map((e: any) => {
                        const d = new Date(e.fecha);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                    });
                    this.storedLineData = sorted.map((e: any) => Number(e.promedio_general));

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
                            this.renderCharts();
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
            }
        });
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

    loadVideos() {
        if (!this.userId) return;
        this.alumnoService.getVideos(this.userId).subscribe({
            next: (vids) => {
                this.videos = vids || [];
            },
            error: (err) => console.error('Error al cargar videos:', err)
        });
    }
}
