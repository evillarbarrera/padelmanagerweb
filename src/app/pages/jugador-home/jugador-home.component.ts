import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { EvaluacionService } from '../../services/evaluacion.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-jugador-home',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './jugador-home.component.html',
  styleUrls: ['./jugador-home.component.scss']
})
export class JugadorHomeComponent implements OnInit {
  jugadorNombre = 'Jugador';
  jugadorFoto = '';
  stats: any = {
    pagadas: 0,
    reservadas: 0,
    disponibles: 0
  };
  isLoading = true;
  userId: number | null = null;
  chart: any;
  radarChart: any;

  constructor(
    private mysqlService: MysqlService,
    private router: Router,
    private evaluacionService: EvaluacionService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadStats();
    this.loadEvaluaciones();
  }

  loadStats(): void {
    if (!this.userId) return;

    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.jugadorNombre = res.user.nombre || 'Jugador';
          this.jugadorFoto = res.user.foto_perfil || '';
        }
      },
      error: (err: any) => console.error('Error loading profile:', err)
    });

    this.mysqlService.getHomeStats(this.userId).subscribe({
      next: (res: any) => {
        let packs = null;
        if (res && res.estadisticas && res.estadisticas.packs) {
          packs = res.estadisticas.packs;
        } else if (res && res.packs) {
          packs = res.packs;
        } else if (res && (res.pagada !== undefined || res.reservada !== undefined)) {
          packs = res;
        }

        if (packs) {
          this.stats.pagadas = parseInt(packs.pagadas || packs.pagada) || 0;
          this.stats.reservadas = parseInt(packs.reservadas || packs.reservada) || 0;
          this.stats.disponibles = parseInt(packs.disponibles || packs.disponible) || 0;
        }

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading stats:', err);
        this.isLoading = false;
      }
    });
  }

  loadEvaluaciones() {
    if (!this.userId) return;
    this.evaluacionService.getEvaluaciones(this.userId).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          // Sort by date ascending
          const sorted = data.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
          const labels = sorted.map(e => e.fecha);
          const values = sorted.map(e => Number(e.promedio_general));
          this.renderChart(labels, values);

          // Radar Chart (Latest Evaluation)
          const latest = sorted[sorted.length - 1];
          // Check if scores is object or needs parsing (backend sends object if handled correctly in PHP, but strictly typed it might be string if not cast)
          // In get_evaluaciones.php we did json_decode, so it should be object.
          if (latest && latest.scores) {
            const radarLabels = Object.keys(latest.scores);
            const radarData = radarLabels.map(key => {
              const s = latest.scores[key];
              // If s has tecnica, control etc as properties
              if (s && typeof s === 'object') {
                return (Number(s.tecnica) + Number(s.control) + Number(s.direccion) + Number(s.decision)) / 4;
              }
              return 0;
            });

            // Slight delay to ensure canvas exists and isn't blocking main thread
            setTimeout(() => this.renderRadarChart(radarLabels, radarData), 100);
          }
        }
      },
      error: (err) => console.error(err)
    });
  }

  renderChart(labels: string[], data: number[]) {
    const ctx = document.getElementById('progressChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Evolución de Rendimiento',
          data: data,
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
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111',
            titleColor: '#ccff00',
            bodyColor: '#fff',
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            grid: { color: '#f0f0f0' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  renderRadarChart(labels: string[], data: number[]) {
    const ctx = document.getElementById('radarChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.radarChart) this.radarChart.destroy();

    this.radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Habilidades',
          data: data,
          fill: true,
          backgroundColor: 'rgba(204, 255, 0, 0.2)',
          borderColor: '#ccff00',
          pointBackgroundColor: '#111',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#ccff00'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
          line: { borderWidth: 3 }
        },
        scales: {
          r: {
            angleLines: { color: '#eee' },
            grid: { color: '#eee' },
            suggestedMin: 0,
            suggestedMax: 10,
            pointLabels: {
              font: { size: 11, weight: 'bold' },
              color: '#444'
            },
            ticks: {
              backdropColor: 'transparent',
              display: false
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAPacks(): void {
    this.router.navigate(['/jugador-packs']);
  }

  irAPerfil(): void {
    this.router.navigate(['/perfil']);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }
}
