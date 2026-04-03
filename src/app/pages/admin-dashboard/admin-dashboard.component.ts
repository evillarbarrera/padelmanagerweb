import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
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
    imports: [CommonModule, FormsModule, NgIf, NgFor],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
    userId: number | null = null;
    adminNombre = 'Administrador';
    adminFoto: string | null = null;
    activeTab: 'resumen' | 'entrenadores' | 'analiticas' | 'config' = 'resumen';
    isSidebarOpen = false;

    stats: any = null;
    isLoading = true;
    
    // New Analytics Properties
    socialStats: any = null;
    analyticsData: any[] = [];
    growthStats: any = null;

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    switchTab(tab: any) {
        this.activeTab = tab;
        this.isSidebarOpen = false; // Cierra menú en móvil al navegar
        
        if (tab === 'resumen' || tab === 'analiticas') {
            setTimeout(() => this.renderCharts(), 200);
        }
        if (tab === 'entrenadores') {
            this.loadEntrenadores();
        }
    }

    // Entrenadores
    entrenadores: any[] = [];
    loadingEntrenadores = false;
    selectedEntrenador: any = null;
    entrenadorStats: any = null;
    loadingStats = false;

    chartData: any = null;
    revenueChart: any;
    usersPacksChart: any;

    // Analytics Charts
    deviceChart: any;
    genderChart: any;
    regionChart: any;
    communeChart: any;
    trafficChart: any;

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
    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
        });
    }

    isBlocked = false;
    subMessage = '';

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

        this.checkSubStatus();
        this.loadStats();
    }

    checkSubStatus() {
        const coachId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        const authValue = token ? `Bearer ${token}` : '';
        
        fetch(`${environment.apiUrl}/subscriptions/get_subscription_status.php?coach_id=${coachId}`, {
            headers: { 'Authorization': authValue, 'X-Authorization': authValue }
        })
        .then(r => r.json())
        .then(res => {
            if (res.status === 'blocked') {
                this.isBlocked = true;
                this.subMessage = res.message;
            }
        })
        .catch(err => console.error('Error sub check:', err));
    }

    goToBilling() {
        this.router.navigate(['/mi-plan']);
    }

    ngAfterViewInit() {
        this.loadChartData();
    }

    navigate(path: string) {
        this.router.navigate([path]);
    }

    navigateExternal(url: string) {
        window.open(url, '_blank');
    }

    // ===== STATS =====
    loadStats() {
        this.isLoading = true;
        this.http.get<any>(`${this.apiUrl}/admin/dashboard_stats.php?year=${this.selectedYear}&month=${this.selectedMonth}`, { headers: this.getHeaders() }).subscribe({
            next: (res) => {
                if (res.success) {
                    this.stats = res.data;
                    this.socialStats = res.data.social;
                    this.analyticsData = res.data.top_paginas;
                    this.growthStats = res.data.crecimiento;
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
        this.http.get<any>(`${this.apiUrl}/admin/dashboard_chart.php?year=${this.selectedYear}&month=${this.selectedMonth}`, { headers: this.getHeaders() }).subscribe({
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
        this.loadStats();
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

        // --- NEW ANALYTICS CHARTS ---
        if (this.activeTab === 'analiticas' && this.stats) {
            // 1. Device Chart
            const ctxDevice = document.getElementById('deviceChart') as HTMLCanvasElement;
            if (ctxDevice) {
                if (this.deviceChart) this.deviceChart.destroy();
                this.deviceChart = new Chart(ctxDevice, {
                    type: 'doughnut',
                    data: {
                        labels: ['Mobile', 'PC'],
                        datasets: [{
                            data: [this.stats.dispositivos.Mobile, this.stats.dispositivos.PC],
                            backgroundColor: ['#ccff00', '#111'],
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
            }

            // 2. Gender Chart
            const ctxGender = document.getElementById('genderChart') as HTMLCanvasElement;
            if (ctxGender) {
                if (this.genderChart) this.genderChart.destroy();
                this.genderChart = new Chart(ctxGender, {
                    type: 'doughnut',
                    data: {
                        labels: ['Hombres', 'Mujeres'],
                        datasets: [{
                            data: [this.stats.genero[0].count, this.stats.genero[1].count],
                            backgroundColor: ['#4a90e2', '#e24a4a'],
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
            }

            // 3. Region Chart
            const ctxRegion = document.getElementById('regionChart') as HTMLCanvasElement;
            if (ctxRegion) {
                if (this.regionChart) this.regionChart.destroy();
                this.regionChart = new Chart(ctxRegion, {
                    type: 'bar',
                    data: {
                        labels: this.stats.regiones.map((r: any) => r.region),
                        datasets: [{
                            label: 'Usuarios por Región',
                            data: this.stats.regiones.map((r: any) => r.count),
                            backgroundColor: '#ccff00',
                            borderRadius: 6
                        }]
                    },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
                });
            }

            // 4. Commune Chart
            const ctxCommune = document.getElementById('communeChart') as HTMLCanvasElement;
            if (ctxCommune && this.stats.comunas) {
                if (this.communeChart) this.communeChart.destroy();
                this.communeChart = new Chart(ctxCommune, {
                    type: 'bar',
                    data: {
                        labels: this.stats.comunas.map((c: any) => c.comuna),
                        datasets: [{
                            label: 'Usuarios por Comuna',
                            data: this.stats.comunas.map((c: any) => c.count),
                            backgroundColor: '#4a90e2',
                            borderRadius: 6
                        }]
                    },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
                });
            }

            // 5. Daily Traffic Chart
            const ctxTraffic = document.getElementById('trafficChart') as HTMLCanvasElement;
            if (ctxTraffic && this.chartData && this.chartData.datasets && this.chartData.datasets.trafico) {
                if (this.trafficChart) this.trafficChart.destroy();
                this.trafficChart = new Chart(ctxTraffic, {
                    type: 'bar',
                    data: {
                        labels: this.chartData.labels,
                        datasets: [{
                            label: 'Visitas Diarias',
                            data: this.chartData.datasets.trafico,
                            backgroundColor: 'rgba(204, 255, 0, 0.7)',
                            borderColor: '#ccff00',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        }
    }

    // ===== ENTRENADORES =====
    loadEntrenadores() {
        if (this.entrenadores.length > 0) return; // already loaded
        this.loadingEntrenadores = true;
        this.http.get<any>(`${this.apiUrl}/admin/get_entrenadores.php`, { headers: this.getHeaders() }).subscribe({
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
                    
                    // Auto-select first trainer if none selected
                    if (this.entrenadores.length > 0 && !this.selectedEntrenador) {
                        this.verDetalle(this.entrenadores[0]);
                    }
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

    verDetalle(e: any) {
        this.selectedEntrenador = e;
        this.loadingStats = true;
        this.entrenadorStats = null;
        
        this.http.get<any>(`${this.apiUrl}/admin/get_entrenador_stats.php?entrenador_id=${e.id}`, { headers: this.getHeaders() }).subscribe({
            next: (res) => {
                this.loadingStats = false;
                if (res.success) {
                    this.entrenadorStats = res.data;
                }
            },
            error: (err) => {
                this.loadingStats = false;
                console.error('Error loading trainer stats', err);
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
        }, { headers: this.getHeaders() }).subscribe({

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
