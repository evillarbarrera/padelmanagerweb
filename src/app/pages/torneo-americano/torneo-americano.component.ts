import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubesService } from '../../services/clubes.service';
import { ApiService } from '../../services/api.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
    selector: 'app-torneo-americano',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './torneo-americano.component.html',
    styleUrls: ['./torneo-americano.component.scss']
})
export class TorneoAmericanoComponent implements OnInit {
    clubes: any[] = [];
    torneos: any[] = [];
    selectedTorneo: any = null;
    participantes: any[] = [];
    matches: any[] = [];
    allUsers: any[] = [];
    filteredUsers: any[] = [];
    searchTerm: string = '';

    userId: number | null = null;
    userName: string = '';
    userFoto: string | null = null;
    userRole: any = 'administrador_club';

    torneo = {
        club_id: 0,
        nombre: '',
        fecha: '',
        hora_inicio: '',
        num_canchas: 2,
        tiempo_por_partido: 20,
        puntos_ganado: 3,
        puntos_empate: 1,
        puntos_1er_lugar: 100,
        puntos_2do_lugar: 50,
        puntos_3er_lugar: 25
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
            this.loadTorneos(user.id);
        }

        this.clubesService.getClubes().subscribe(res => {
            this.clubes = res;
            if (this.clubes.length > 0) {
                this.torneo.club_id = this.clubes[0].id;
            }
        });

        this.clubesService.getUsers().subscribe(res => {
            this.allUsers = res;
        });
    }

    loadTorneos(adminId: number) {
        this.clubesService.getTorneosAdmin(adminId).subscribe(res => {
            this.torneos = res;
        });
    }

    crearTorneo() {
        if (!this.torneo.nombre || !this.torneo.club_id) return;
        this.clubesService.createTorneoAmericano(this.torneo).subscribe(res => {
            alert('Torneo creado exitosamente. ID: ' + res.id);
            if (this.userId) this.loadTorneos(this.userId);
        });
    }

    selectTorneo(torneo: any) {
        this.selectedTorneo = torneo;
        this.loadParticipantes(torneo.id);
        this.loadMatches(torneo.id);
    }

    loadParticipantes(torneoId: number) {
        this.clubesService.getParticipantesTorneo(torneoId).subscribe(res => {
            this.participantes = res;
        });
    }

    loadMatches(torneoId: number) {
        this.clubesService.getTorneoMatches(torneoId).subscribe(res => {
            this.matches = res;
        });
    }

    searchPlayers() {
        if (!this.searchTerm.trim()) {
            this.filteredUsers = [];
            return;
        }
        const term = this.searchTerm.toLowerCase();
        this.filteredUsers = this.allUsers.filter(u =>
            u.nombre?.toLowerCase().includes(term) || u.usuario?.toLowerCase().includes(term)
        ).slice(0, 5);
    }

    addPlayer(user: any) {
        if (!this.selectedTorneo) return;
        this.clubesService.joinTorneoManual(this.selectedTorneo.id, user.id).subscribe(res => {
            alert('Jugador agregado: ' + user.nombre);
            this.loadParticipantes(this.selectedTorneo.id);
            this.searchTerm = '';
            this.filteredUsers = [];
        });
    }

    saveScore(m: any) {
        this.clubesService.updateMatchResult(m.id, m.puntos_t1 || 0, m.puntos_t2 || 0).subscribe(res => {
            alert('Resultado guardado');
            m.finalizado = 1;
        });
    }

    generarPartidos(torneoId: number) {
        this.clubesService.generateMatches(torneoId).subscribe(res => {
            alert('Partidos generados exitosamente');
            this.loadMatches(torneoId);
        }, err => {
            alert('Error: ' + (err.error?.error || 'Error desconocido'));
        });
    }
}
