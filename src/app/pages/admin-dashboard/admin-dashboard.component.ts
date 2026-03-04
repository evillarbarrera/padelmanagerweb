import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';

Chart.register(...registerables);

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
    userId: number | null = null;
    adminNombre = 'Administrador';
    adminFoto: string | null = null;

    stats: any = null;
    isLoading = true;
    activeTab: string = 'resumen';

    // Entrenadores
    entrenadores: any[] = [];
    loadingEntrenadores = false;

    chartData: any = null;
    revenueChart: any;
    usersPacksChart: any;

    selectedYear: number = new Date().getFullYear();
    selectedMonth: number = new Date().getMonth() + 1;

    years: number[] = [this.selectedYear - 1, this.selectedYear, this.selectedYear + 1];
    months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    private apiUrl = environment.apiUrl;
    private token = btoa('1|padel_academy');
    private headers = new HttpHeaders({
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
    });

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

    navigate(path: string) {
        this.router.navigate([path]);
    }

    // ===== STATS =====
    loadStats() {
        this.http.get<any>(`${this.apiUrl}/admin/dashboard_stats.php`, { headers: this.headers }).subscribe({
            next: (res) => {
                if (res.success) {
                    this.stats = res.data;
                }
                setTimeout(() => {
                    this.isLoading = false;
                }, 500);
            },
            error: (err) => {
                console.error('Error fetching admin stats', err);
                this.isLoading = false;
            }
        });
    }

    // ===== CHARTS =====
    loadChartData() {
        this.isLoading = true;
        this.http.get<any>(`${this.apiUrl}/admin/dashboard_chart.php?year=${this.selectedYear}&month=${this.selectedMonth}`, { headers: this.headers }).subscribe({
            next: (res) => {
                this.isLoading = false;
                if (res.success) {
                    this.chartData = res;
                    setTimeout(() => {
                        this.renderCharts();
                    }, 550);
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

    // ===== ENTRENADORES =====
    loadEntrenadores() {
        if (this.entrenadores.length > 0) return; // already loaded
        this.loadingEntrenadores = true;
        this.http.get<any>(`${this.apiUrl}/admin/get_entrenadores.php`, { headers: this.headers }).subscribe({
            next: (res) => {
                this.loadingEntrenadores = false;
                if (res.success) {
                    this.entrenadores = res.data || [];
                    // Fix photo URLs
                    this.entrenadores.forEach(e => {
                        if (e.foto_perfil && !e.foto_perfil.startsWith('http')) {
                            e.foto_perfil = `${this.apiUrl.replace('/api_training', '')}/${e.foto_perfil}`;
                        }
                    });
                } else {
                    this.entrenadores = [];
                }
            },
            error: (err) => {
                this.loadingEntrenadores = false;
                console.error('Error loading entrenadores', err);
            }
        });
    }

    toggleTransbank(e: any) {
        e.transbank_activo = e.transbank_activo == 1 ? 0 : 1;
        this.updateEntrenadorConfig(e);
    }


    toggleComision(e: any) {
        e.comision_activa = e.comision_activa == 1 ? 0 : 1;
        this.updateEntrenadorConfig(e);
    }

    updateComision(e: any) {
        this.updateEntrenadorConfig(e);
    }

    updateEntrenadorConfig(e: any) {
        this.http.post<any>(`${this.apiUrl}/admin/update_entrenador_config.php`, {
            entrenador_id: e.id,
            transbank_activo: e.transbank_activo,
            comision_activa: e.comision_activa,
            comision_porcentaje: e.comision_porcentaje,
            mp_collector_id: e.mp_collector_id
        }, { headers: this.headers }).subscribe({

            next: () => { },
            error: (err) => console.error('Error updating config', err)
        });
    }

    verDatosBancarios(e: any) {
        Swal.fire({
            title: `Configuración de Pagos - ${e.nombre}`,
            html: `
                <div style="text-align: left; font-size: 14px; line-height: 2;">
                    <p style="color: #64748b; margin-bottom: 15px;">Vincular cuenta de Mercado Pago para split automático.</p>
                    <label style="font-weight: 700;">Mercado Pago Collector ID</label>
                    <input id="swal-mp-id" class="swal2-input" value="${e.mp_collector_id || ''}" placeholder="Ej: 12345678" style="width:100%; margin: 4px 0 10px 0;">
                </div>
            `,

            confirmButtonText: 'Guardar',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#111',
            preConfirm: () => {
                const mpId = (document.getElementById('swal-mp-id') as HTMLInputElement).value;
                return { mp_collector_id: mpId };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const data = result.value;
                e.mp_collector_id = data.mp_collector_id;
                this.updateEntrenadorConfig(e);
                Swal.fire({ icon: 'success', title: 'Guardado', text: 'Configuración de pagos actualizada.', timer: 1500 });
            }
        });
    }


    logout() {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
