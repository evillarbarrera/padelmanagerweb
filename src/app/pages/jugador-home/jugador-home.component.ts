import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { EvaluacionService } from '../../services/evaluacion.service';
import { PopupService } from '../../services/popup.service';
import { AssetService } from '../../services/asset.service';
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
    disponibles: 0,
    grupales: 0,
    pendientes: 0
  };
  packsDetalle: any[] = [];
  isLoading = true;
  userId: number | null = null;
  chart: any;

  constructor(
    private mysqlService: MysqlService,
    private router: Router,
    private evaluacionService: EvaluacionService,
    private popupService: PopupService,
    public assetService: AssetService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    const userRole = localStorage.getItem('userRole') || '';

    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Redirección de seguridad si el rol no es jugador
    const role = userRole.toLowerCase();
    if (role.includes('admin') || role.includes('administrador')) {
      this.router.navigate(['/admin-club']);
      return;
    } else if (role.includes('entrenador')) {
      this.router.navigate(['/entrenador-home']);
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
          this.stats.grupales = parseInt(packs.grupales || packs.grupal) || 0;
          this.stats.pendientes = parseInt(packs.pendientes || packs.pendiente) || 0;
          this.packsDetalle = packs.detalle || [];
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



  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAReservarCancha(): void {
    this.router.navigate(['/clubes-reservar']);
  }

  irAPacks(): void {
    this.popupService.info('Información', 'Para adquirir un nuevo pack, debes seleccionar un horario en "Agendar Clase" una vez hayas completado tus clases actuales.');
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
