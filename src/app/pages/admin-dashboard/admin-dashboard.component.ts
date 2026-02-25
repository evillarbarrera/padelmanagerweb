import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { environment } from '../../../environments/environment';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
    userId: number | null = null;
    adminNombre = 'Administrador';
    adminFoto: string | null = null;

    stats: any = null;
    isLoading = true;

    chartData: any = null;
    revenueChart: any;
    usersPacksChart: any;

    selectedYear: number = new Date().getFullYear();
    selectedMonth: number = new Date().getMonth() + 1; // 1-12

    years: number[] = [this.selectedYear - 1, this.selectedYear, this.selectedYear + 1];
    months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    constructor(private http: HttpClient, private router: Router) { }

    ngOnInit(): void {
        this.userId = Number(localStorage.getItem('userId')) || 0;
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user && user.nombre) {
            this.adminNombre = user.nombre;
            this.adminFoto = user.foto_perfil || user.foto || null;
            if (this.adminFoto && !this.adminFoto.startsWith('http')) {
                this.adminFoto = `${environment.apiUrl.replace('/api_training', '')}/${this.adminFoto}`;
            }
        }

        this.loadStats();
    }

    ngAfterViewInit() {
        this.loadChartData();
    }

    loadStats() {
        this.http.get<any>(`${environment.apiUrl}/admin/dashboard_stats.php`).subscribe({
            next: (res) => {
                if (res.success) {
                    this.stats = res.data;
                }
                setTimeout(() => {
                    this.isLoading = false;
                }, 500); // small delay to match
            },
            error: (err) => {
                console.error('Error fetching admin stats', err);
                this.isLoading = false;
            }
        });
    }

    loadChartData() {
        this.isLoading = true;
        this.http.get<any>(`${environment.apiUrl}/admin/dashboard_chart.php?year=${this.selectedYear}&month=${this.selectedMonth}`).subscribe({
            next: (res) => {
                this.isLoading = false;
                if (res.success) {
                    this.chartData = res;
                    setTimeout(() => {
                        this.renderCharts();
                    }, 550); // wait for DOM update of *ngIf (match loadStats delay)
                }
            },
            error: (err) => {
                console.error('Error fetching chart data', err);
                this.isLoading = false;
            }
        });
    }

    onFilterChange() {
        this.loadChartData();
    }

    renderCharts() {
        if (!this.chartData || !this.chartData.labels) return;

        if (this.revenueChart) this.revenueChart.destroy();
        if (this.usersPacksChart) this.usersPacksChart.destroy();

        const ctxRevenue = document.getElementById('revenueChart') as HTMLCanvasElement;
        const ctxUsersPacks = document.getElementById('usersPacksChart') as HTMLCanvasElement;

        if (ctxRevenue) {
            this.revenueChart = new Chart(ctxRevenue, {
                type: 'line',
                data: {
                    labels: this.chartData.labels,
                    datasets: [{
                        label: 'Ingresos Mensuales ($)',
                        data: this.chartData.datasets.ingresos,
                        borderColor: '#ccff00',
                        backgroundColor: 'rgba(204, 255, 0, 0.2)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (ctxUsersPacks) {
            this.usersPacksChart = new Chart(ctxUsersPacks, {
                type: 'bar',
                data: {
                    labels: this.chartData.labels,
                    datasets: [
                        {
                            label: 'Nuevos Usuarios',
                            data: this.chartData.datasets.usuarios,
                            backgroundColor: '#4a90e2',
                            borderRadius: 4
                        },
                        {
                            label: 'Packs Vendidos',
                            data: this.chartData.datasets.packs,
                            backgroundColor: '#e24a4a',
                            borderRadius: 4
                        }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    logout() {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
