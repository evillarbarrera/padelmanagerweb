import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClubesService } from '../../services/clubes.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-club-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './club-reportes.component.html',
  styleUrls: ['./club-reportes.component.scss']
})
export class ClubReportesComponent implements OnInit {
  @ViewChild('salesChart') salesChartCanvas!: ElementRef;
  @ViewChild('resChart') resChartCanvas!: ElementRef;

  userId: number = 0;
  userName: string = '';
  userFoto: string = '';
  userRole: any = '';
  clubId: number = 0;
  clubes: any[] = [];

  activeTab: 'ventas' | 'reservas' = 'ventas';
  salesData: any = { daily: [], weekly: [], monthly: [] };
  resData: any = { daily: [], weekly: [], monthly: [] };

  salesChart: any;
  resChart: any;

  constructor(private clubesService: ClubesService) {
    const userDataStr = localStorage.getItem('user') || localStorage.getItem('currentUser');
    const userData = JSON.parse(userDataStr || '{}');
    this.userId = userData.id || Number(localStorage.getItem('userId'));
    this.userName = userData.nombre || '';
    this.userFoto = userData.foto || userData.foto_perfil || '';
    this.userRole = (userData.rol || localStorage.getItem('userRole')) as any;
    this.clubId = userData.club_id || 0;
  }

  ngOnInit() {
    this.loadClubes();
  }

  loadClubes() {
    this.clubesService.getClubes(this.userId).subscribe(res => {
      this.clubes = res;
      // If we don't have a specific clubId yet, choose the first one available
      if (this.clubes.length > 0 && (!this.clubId || this.clubId === 0)) {
        this.clubId = this.clubes[0].id;
      }
      this.refreshData();
    });
  }

  onClubChange() {
    this.refreshData();
  }

  refreshData() {
    if (!this.clubId) return;
    this.loadSalesData();
    this.loadResData();
  }

  loadSalesData() {
    this.clubesService.getReporteVentas(this.clubId).subscribe(res => {
      this.salesData = res;
      if (this.activeTab === 'ventas') {
        setTimeout(() => this.createSalesChart(), 100);
      }
    });
  }

  loadResData() {
    this.clubesService.getReporteReservas(this.clubId).subscribe(res => {
      this.resData = res;
      if (this.activeTab === 'reservas') {
        setTimeout(() => this.createResChart(), 100);
      }
    });
  }

  switchTab(tab: 'ventas' | 'reservas') {
    this.activeTab = tab;
    if (tab === 'ventas') {
      setTimeout(() => this.createSalesChart(), 100);
    } else {
      setTimeout(() => this.createResChart(), 100);
    }
  }

  createSalesChart() {
    if (this.salesChart) this.salesChart.destroy();
    if (!this.salesChartCanvas) return;

    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    const labels = this.salesData.monthly.map((m: any) => m.label);
    const values = this.salesData.monthly.map((m: any) => m.value);

    this.salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas Mensuales ($)',
          data: values,
          backgroundColor: 'rgba(37, 99, 235, 0.7)',
          borderColor: '#2563eb',
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  createResChart() {
    if (this.resChart) this.resChart.destroy();
    if (!this.resChartCanvas) return;

    const ctx = this.resChartCanvas.nativeElement.getContext('2d');
    const labels = this.resData.daily.map((d: any) => d.label);
    const values = this.resData.daily.map((d: any) => d.value);

    this.resChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Reservas Diarias',
          data: values,
          fill: true,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: '#10b981',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  getTotal(list: any[]): number {
    return list.reduce((acc, curr) => acc + parseFloat(curr.value), 0);
  }

  getLatest(list: any[]): number {
    return list.length > 0 ? parseFloat(list[list.length - 1].value) : 0;
  }
}
