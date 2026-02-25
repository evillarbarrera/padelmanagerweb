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
    getClubes(adminId?: number): Observable<any[]> {
        let url = `${this.apiUrl}/clubes/get_clubes.php`;
        if (adminId) url += `?admin_id=${adminId}`;

        return this.http.get<any[]>(url, {
            headers: this.getHeaders()
        });
    }

    addClub(clubData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/add_club.php`, clubData, {
            headers: this.getHeaders()
        });
    }

    updateClub(clubData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/update_club.php`, clubData, {
            headers: this.getHeaders()
        });
    }

    deleteClub(id: number, adminId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/delete_club.php`, { id, admin_id: adminId }, {
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

    updateCancha(canchaData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/update_cancha.php`, canchaData, {
            headers: this.getHeaders()
        });
    }

    deleteCancha(id: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/clubes/delete_cancha.php`, { id }, {
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

    getMyTournaments(userId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_user_tournaments.php?user_id=${userId}`, {
            headers: this.getHeaders()
        });
    }

    getTorneosPublicos(region?: string, comuna?: string, showAll: boolean = false): Observable<any[]> {
        let url = `${this.apiUrl}/torneos/get_torneos_public.php?1=1`;
        if (region) url += `&region=${encodeURIComponent(region)}`;
        if (comuna) url += `&comuna=${encodeURIComponent(comuna)}`;
        if (showAll) url += `&all=1`;

        return this.http.get<any[]>(url, {
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

    joinTorneoManual(data: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/join_torneo.php`, data, {
            headers: this.getHeaders()
        });
    }

    cancelarTorneoAmericano(torneoId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/cancelar_americano.php`, {
            torneo_id: torneoId
        }, {
            headers: this.getHeaders()
        });
    }

    closeTorneoAmericano(torneoId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/close_americano.php`, {
            torneo_id: torneoId
        }, {
            headers: this.getHeaders()
        });
    }

    generatePlayoffs(torneoId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/close_groups_playoffs.php`, {
            torneo_id: torneoId
        }, {
            headers: this.getHeaders()
        });
    }

    generateFinals(torneoId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/generate_finals.php`, {
            torneo_id: torneoId
        }, {
            headers: this.getHeaders()
        });
    }

    removeParticipante(torneoId: number, participanteId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/remove_participante.php`, {
            torneo_id: torneoId,
            participante_id: participanteId
        }, {
            headers: this.getHeaders()
        });
    }

    updateParticipante(data: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/update_participante.php`, data, {
            headers: this.getHeaders()
        });
    }

    getRanking(categoria: string = 'General'): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_ranking.php?categoria=${categoria}`, {
            headers: this.getHeaders()
        });
    }

    // TORNEOS V2 (Groups + Playoffs)
    createTorneoV2(torneoData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/create_torneo_v2.php`, torneoData, {
            headers: this.getHeaders()
        });
    }

    updateTorneo(id: number, data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/update_torneo.php`, { id, ...data }, {
            headers: this.getHeaders()
        });
    }

    saveTorneoAvailability(torneoId: number, grid: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/update_torneo_availability.php`, { torneo_id: torneoId, grid }, {
            headers: this.getHeaders()
        });
    }

    getTorneoAvailability(torneoId: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/torneos/get_torneo_availability.php?torneo_id=${torneoId}`, {
            headers: this.getHeaders()
        });
    }

    getTorneosAdminV2(adminId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_torneos_admin_v2.php?admin_id=${adminId}`, {
            headers: this.getHeaders()
        });
    }

    getCategoriasTorneo(torneoId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_categorias.php?torneo_id=${torneoId}`, {
            headers: this.getHeaders()
        });
    }

    generarGrupos(categoriaId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/generar_grupos.php`, { categoria_id: categoriaId }, {
            headers: this.getHeaders()
        });
    }

    getRankingGrupo(grupoId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/torneos/get_ranking_grupo.php?grupo_id=${grupoId}`, {
            headers: this.getHeaders()
        });
    }

    getInscripciones(categoriaId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_inscripciones.php?categoria_id=${categoriaId}`, {
            headers: this.getHeaders()
        });
    }

    eliminarPareja(inscripcionId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/delete_inscripcion.php`, { inscripcion_id: inscripcionId }, {
            headers: this.getHeaders()
        });
    }

    validarInscripcion(inscripcionId: number, validado: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/validar_inscripcion.php`, {
            inscripcion_id: inscripcionId,
            validado: validado ? 1 : 0
        }, {
            headers: this.getHeaders()
        });
    }

    inscribirParejaV2(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/join_torneo_v2.php`, data, {
            headers: this.getHeaders()
        });
    }

    cerrarFaseGrupos(categoriaId: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/cerrar_grupos.php`, { categoria_id: categoriaId }, {
            headers: this.getHeaders()
        });
    }

    getPartidosRonda(categoriaId: number, ronda: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_partidos_ronda.php?categoria_id=${categoriaId}&ronda=${ronda}`, {
            headers: this.getHeaders()
        });
    }

    getPartidosCategoria(categoriaId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/torneos/get_partidos_categoria.php?categoria_id=${categoriaId}`, {
            headers: this.getHeaders()
        });
    }

    updateMatchResultV2(matchData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/torneos/update_match_result.php`, matchData, {
            headers: this.getHeaders()
        });
    }

    saveSchedule(programacion: any[]): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/torneos/save_schedule.php`, { programacion }, {
            headers: this.getHeaders()
        });
    }
}
