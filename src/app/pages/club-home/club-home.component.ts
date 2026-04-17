import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ApiService } from '../../services/api.service';
import { ClubesService } from '../../services/clubes.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-club-home',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './club-home.component.html',
    styleUrls: ['./club-home.component.scss']
})
export class ClubHomeComponent implements OnInit {
    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';
    isLoading: boolean = true;

    stats = {
        ocupacion: '0%',
        ingresos_dia: 0,
        alumnos_mensuales: 0,
        torneos_activos: 0
    };

    actividadReciente: any[] = [];

    get isStaff(): boolean {
        const role = localStorage.getItem('userRole') || '';
        return role.toLowerCase().includes('staff');
    }

    constructor(
        private apiService: ApiService,
        private clubesService: ClubesService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const storedUserId = localStorage.getItem('userId');
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        const storedRole = localStorage.getItem('userRole') || '';

        if (!storedUserId || (!storedRole.toLowerCase().includes('admin') && !storedRole.toLowerCase().includes('staff'))) {
            this.router.navigate(['/login']);
            return;
        }

        this.userId = Number(storedUserId);
        this.userName = storedUser?.nombre || '';
        this.userFoto = storedUser?.foto_perfil || null;
        this.userRole = storedUser?.rol || storedRole;
        this.clubId = storedUser?.club_id || null;

        this.loadProfileData();
        this.loadStats();
    }

    clubId: number | null = null;

    loadProfileData() {
        this.apiService.getPerfil(this.userId!).subscribe(res => {
            if (res.success && res.user) {
                this.userFoto = res.user.foto_perfil || this.userFoto;
                this.userName = res.user.nombre || this.userName;
            }
        });
    }

    loadStats() {
        this.isLoading = true;
        // Si el usuario es staff, pasamos su clubId específicamente
        this.clubesService.getClubHomeStats(this.userId!, this.clubId!).subscribe({
            next: (res) => {
                if (res.success && res.stats) {
                    this.stats = {
                        ocupacion: res.stats.ocupacion || '0%',
                        ingresos_dia: res.stats.ingresos_dia || 0,
                        alumnos_mensuales: res.stats.alumnos_mensuales || 0,
                        torneos_activos: res.stats.torneos_activos || 0
                    };
                    this.actividadReciente = res.actividad_reciente || [];
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading club stats', err);
                this.isLoading = false;
            }
        });
    }

    navigate(path: string) {
        this.router.navigate([path]);
    }
}
