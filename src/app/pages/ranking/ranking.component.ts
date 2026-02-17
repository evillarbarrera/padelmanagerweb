import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
    selector: 'app-ranking',
    standalone: true,
    imports: [CommonModule, SidebarComponent],
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.scss']
})
export class RankingComponent implements OnInit {
    ranking: any[] = [];
    userId: number = 0;
    userName: string = '';
    userFoto: string = '';
    userRole: 'jugador' | 'entrenador' | 'administrador_club' = 'jugador';
    selectedCategoria: string = 'General';
    loading: boolean = true;

    categorias: string[] = [
        'General',
        'Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta',
        'Primera Damas', 'Segunda Damas', 'Tercera Damas', 'Cuarta Damas', 'Quinta Damas', 'Sexta Damas'
    ];

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        if (user) {
            this.userId = user.id;
            this.userName = user.nombre;
            this.userFoto = user.foto;
            this.userRole = (user.rol || user.role || 'jugador') as any;

            // Fetch fresh profile data
            this.apiService.getPerfil(this.userId).subscribe({
                next: (res) => {
                    if (res.success && res.user) {
                        this.userFoto = res.user.foto_perfil || this.userFoto;
                        this.userName = res.user.nombre || this.userName;
                    }
                }
            });
        } else {
            const storedRole = localStorage.getItem('userRole');
            if (storedRole) this.userRole = storedRole as any;
        }
        this.loadRanking();
    }

    setCategoria(cat: string) {
        this.selectedCategoria = cat;
        this.loadRanking();
    }

    loadRanking() {
        this.loading = true;
        this.ranking = []; // Clear previous for visual feedback
        this.clubesService.getRanking(this.selectedCategoria).subscribe({
            next: (res) => {
                console.log('Ranking data received:', res);
                this.ranking = res;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading ranking:', err);
                this.loading = false;
            }
        });
    }
}
