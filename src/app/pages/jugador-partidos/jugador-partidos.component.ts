import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { Router } from '@angular/router';
import { AssetService } from '../../services/asset.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-jugador-partidos',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './jugador-partidos.component.html',
  styleUrl: './jugador-partidos.component.scss'
})
export class JugadorPartidosComponent implements OnInit {
  userId = Number(localStorage.getItem('userId'));
  jugadorNombre = localStorage.getItem('nombre') || '';
  jugadorFoto = localStorage.getItem('foto') || '';

  partidos: any[] = [];
  jugados: any[] = [];
  proximos: any[] = [];
  isLoading = true;

  // Stats
  totalJugados = 0;
  victorias = 0;
  derrotas = 0;
  categoriaMasJugada = 'N/A';

  selectedTab: 'proximos' | 'historial' = 'proximos';

  // Filters
  filterClub = '';
  filterCategoria = '';
  filterFecha = '';
  clubesList: any[] = [];

  // Modal Result
  showResultModal = false;
  showDetailModal = false;
  selectedMatch: any = null;
  categoria = '';
  
  // Scoring Sets
  set1A: number | null = null;
  set1B: number | null = null;
  set2A: number | null = null;
  set2B: number | null = null;
  set3A: number | null = null;
  set3B: number | null = null;
  
  idGanador: number | null = null;
  
  // Charts
  winLossChart: any;
  activityChart: any;

  constructor(
    public mysql: MysqlService, 
    public router: Router,
    public assetService: AssetService
  ) {}

  ngOnInit() {
    this.loadPartidos();
  }

  loadPartidos() {
    this.isLoading = true;
    this.mysql.getMisPartidos().subscribe({
      next: (res: any[]) => {
        this.partidos = res;
        this.updateLists();
        this.calculateStats();

        // Extract clubs
        const cMap = new Map();
        res.forEach(p => {
            if (p.club_id && !cMap.has(p.club_id)) {
                cMap.set(p.club_id, p.club_nombre);
            }
        });
        this.clubesList = Array.from(cMap.entries()).map(([id, nombre]) => ({ id, nombre }));

        this.isLoading = false;
        setTimeout(() => {
          this.renderCharts();
        }, 100);
      },
      error: (err: any) => {
        console.error('Error loading matches:', err);
        this.isLoading = false;
      }
    });
  }

  updateLists() {
    this.jugados = this.partidos.filter(p => p.jugado);
    this.proximos = this.partidos.filter(p => !p.jugado).sort((a,b) => a.fecha.localeCompare(b.fecha));

    if (this.filterClub) {
        this.jugados = this.jugados.filter(p => p.club_id == this.filterClub);
    }
    if (this.filterCategoria) {
        this.jugados = this.jugados.filter(p => p.categoria === this.filterCategoria);
    }
    if (this.filterFecha) {
        this.jugados = this.jugados.filter(p => p.fecha === this.filterFecha);
    }
  }

  calculateStats() {
    const list = this.partidos.filter(p => p.jugado);
    this.totalJugados = list.length;
    this.victorias = list.filter(p => p.id_ganador && ((p.id_ganador == 1 && (p.usuario_id == this.userId || p.jugador2_id == this.userId)) || (p.id_ganador == 2 && (p.jugador3_id == this.userId || p.jugador4_id == this.userId)))).length;
    this.derrotas = list.filter(p => p.resultado_registrado && !this.isWinner(p)).length;
    
    const cats = list.filter(p => p.categoria).map(p => p.categoria);
    if (cats.length > 0) {
      const counts: any = {};
      cats.forEach(c => counts[c] = (counts[c] || 0) + 1);
      this.categoriaMasJugada = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    } else {
        this.categoriaMasJugada = 'N/A';
    }
  }

  isWinner(p: any): boolean {
    if (!p.id_ganador) return false;
    const isTeam1 = (p.usuario_id == this.userId || p.jugador2_id == this.userId);
    const isTeam2 = (p.jugador3_id == this.userId || p.jugador4_id == this.userId);
    return (p.id_ganador == 1 && isTeam1) || (p.id_ganador == 2 && isTeam2);
  }

  openResultModal(match: any, event: Event) {
    event.stopPropagation();
    this.selectedMatch = match;
    this.categoria = match.categoria || '';
    this.set1A = null; this.set1B = null;
    this.set2A = null; this.set2B = null;
    this.set3A = null; this.set3B = null;
    this.idGanador = null;
    this.showResultModal = true;
  }

  openMatchDetail(match: any) {
    this.selectedMatch = match;
    this.categoria = match.categoria || 'Todos';
    this.showDetailModal = true;
  }

  updateGanadorManual() {
     let winsA = 0; let winsB = 0;
     if (this.set1A !== null && this.set1B !== null) { if (this.set1A > this.set1B) winsA++; else if (this.set1B > this.set1A) winsB++; }
     if (this.set2A !== null && this.set2B !== null) { if (this.set2A > this.set2B) winsA++; else if (this.set2B > this.set2A) winsB++; }
     if (this.set3A !== null && this.set3B !== null) { if (this.set3A > this.set3B) winsA++; else if (this.set3B > this.set3A) winsB++; }
     if (winsA > winsB) this.idGanador = 1; else if (winsB > winsA) this.idGanador = 2; else this.idGanador = null;
  }

  saveResult() {
    this.updateGanadorManual();
    if (this.set1A === null || this.set1B === null || !this.categoria || !this.idGanador) {
        alert('Al menos el primer set y la categoría son obligatorios');
        return;
    }

    let marcadorStr = `${this.set1A}-${this.set1B}`;
    if (this.set2A !== null && this.set2B !== null) marcadorStr += ` ${this.set2A}-${this.set2B}`;
    if (this.set3A !== null && this.set3B !== null) marcadorStr += ` ${this.set3A}-${this.set3B}`;

    const payload = {
        reserva_id: this.selectedMatch.id,
        marcador: marcadorStr,
        categoria: this.categoria,
        id_ganador: this.idGanador
    };

    this.mysql.saveMatchResult(payload).subscribe(() => {
        this.showResultModal = false;
        this.loadPartidos();
    });
  }

  renderCharts() {
    this.renderWinLossChart();
    this.renderActivityChart();
  }

  renderWinLossChart() {
    const ctx = document.getElementById('winLossChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.winLossChart) this.winLossChart.destroy();

    this.winLossChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Victorias', 'Derrotas'],
        datasets: [{
          data: [this.victorias, this.derrotas],
          backgroundColor: ['#ccff00', '#111'],
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { weight: 'bold' }, color: '#000' } }
        },
        cutout: '75%'
      }
    });
  }

  renderActivityChart() {
    const ctx = document.getElementById('activityChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.activityChart) this.activityChart.destroy();

    // Prepare data (last 6 months)
    const months: any = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString('es-ES', { month: 'short' });
        months[label] = 0;
    }

    this.partidos.forEach(p => {
        const d = new Date(p.fecha);
        const label = d.toLocaleString('es-ES', { month: 'short' });
        if (months[label] !== undefined) {
            months[label]++;
        }
    });

    this.activityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(months),
        datasets: [{
          label: 'Partidos',
          data: Object.values(months),
          backgroundColor: '#ccff00',
          borderRadius: 8,
          barThickness: 25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { display: false }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}
