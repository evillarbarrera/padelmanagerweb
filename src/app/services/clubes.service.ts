import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ClubesService {
    private apiUrl = environment.apiUrl;
    private authToken = 'Bearer ' + btoa('1|padel_academy');

    constructor(private http: HttpClient) { }

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Authorization': this.authToken,
            'Content-Type': 'application/json'
        });
    }

    // CLUBES
    getClubes(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/clubes/get_clubes.php`, {
            headers: this.getHeaders()
        });
    }

    addClub(clubData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/add_club.php`, clubData, {
            headers: this.getHeaders()
        });
    }

    // CANCHAS
    getCanchas(clubId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/clubes/get_canchas.php?club_id=${clubId}`, {
            headers: this.getHeaders()
        });
    }

    addCancha(canchaData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/add_cancha.php`, canchaData, {
            headers: this.getHeaders()
        });
    }

    getDisponibilidadCancha(canchaId: number, fecha: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/clubes/get_disponibilidad.php?cancha_id=${canchaId}&fecha=${fecha}`, {
            headers: this.getHeaders()
        });
    }

    // TORNEOS
    createTorneoAmericano(torneoData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/create_americano.php`, torneoData, {
            headers: this.getHeaders()
        });
    }

    joinTorneo(torneoId: number, usuarioId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/join_torneo.php`, { torneo_id: torneoId, usuario_id: usuarioId }, {
            headers: this.getHeaders()
        });
    }

    generateMatches(torneoId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/generate_matches.php`, { torneo_id: torneoId }, {
            headers: this.getHeaders()
        });
    }

    getTorneoMatches(torneoId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_matches.php?torneo_id=${torneoId}`, {
            headers: this.getHeaders()
        });
    }

    getTorneosAdmin(adminId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_torneos_admin.php?admin_id=${adminId}`, {
            headers: this.getHeaders()
        });
    }

    getParticipantesTorneo(torneoId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_participantes.php?torneo_id=${torneoId}`, {
            headers: this.getHeaders()
        });
    }

    getClubReservas(clubId: number, fecha: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/clubes/get_club_reservas.php?club_id=${clubId}&fecha=${fecha}`, {
            headers: this.getHeaders()
        });
    }

    addReserva(reserva: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/clubes/add_reserva.php`, reserva, {
            headers: this.getHeaders()
        });
    }

    cancelReserva(reservaId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/clubes/cancel_reserva.php`, {
            reserva_id: reservaId
        }, {
            headers: this.getHeaders()
        });
    }

    updateReserva(reserva: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/clubes/update_reserva.php`, reserva, {
            headers: this.getHeaders()
        });
    }

    updateMatchResult(matchId: number, puntosT1: number, puntosT2: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/update_match_result.php`, {
            match_id: matchId,
            puntos_t1: puntosT1,
            puntos_t2: puntosT2
        }, {
            headers: this.getHeaders()
        });
    }

    getUsers(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/user/get_users.php`, {
            headers: this.getHeaders()
        });
    }

    joinTorneoManual(torneoId: number, userId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/join_torneo.php`, {
            torneo_id: torneoId,
            usuario_id: userId
        }, {
            headers: this.getHeaders()
        });
    }
}
