import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
    selector: 'app-club-admin',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './club-admin.component.html',
    styleUrls: ['./club-admin.component.scss']
})
export class ClubAdminComponent implements OnInit {
    clubes: any[] = [];
    canchas: any[] = [];
    selectedClub: any = null;

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    newClub = {
        nombre: '',
        direccion: '',
        telefono: '',
        instagram: '',
        email: '',
        admin_id: 0
    };

    newCancha = {
        club_id: 0,
        nombre: '',
        tipo: 'Outdoor',
        superficie: 'Césped Sintético',
        precio_hora: 0
    };

    constructor(
        private clubesService: ClubesService,
        private apiService: ApiService,
        private router: Router
    ) { }

    ngOnInit(): void {
        const user = this.apiService.getCurrentUser();
        const storedRole = localStorage.getItem('userRole') || '';

        if (!user || (!storedRole.toLowerCase().includes('admin') && !storedRole.toLowerCase().includes('administrador'))) {
            this.router.navigate(['/login']);
            return;
        }

        if (user) {
            this.userId = user.id;
            this.userName = user.nombre;
            this.userFoto = user.foto_perfil;
            this.userRole = user.rol;
            this.newClub.admin_id = user.id;
            this.loadClubes();
        }
    }

    loadClubes() {
        this.clubesService.getClubes().subscribe(res => {
            this.clubes = res;
        });
    }

    selectClub(club: any) {
        this.selectedClub = club;
        this.newCancha.club_id = club.id;
        this.loadCanchas(club.id);
    }

    loadCanchas(clubId: number) {
        this.clubesService.getCanchas(clubId).subscribe(res => {
            this.canchas = res;
        });
    }

    createClub() {
        if (!this.newClub.nombre) return;
        this.clubesService.addClub(this.newClub).subscribe(() => {
            this.loadClubes();
            this.newClub.nombre = '';
        });
    }

    createCancha() {
        if (!this.newCancha.nombre || !this.newCancha.club_id) return;
        this.clubesService.addCancha(this.newCancha).subscribe(() => {
            this.loadCanchas(this.newCancha.club_id);
            this.newCancha.nombre = '';
        });
    }
}
