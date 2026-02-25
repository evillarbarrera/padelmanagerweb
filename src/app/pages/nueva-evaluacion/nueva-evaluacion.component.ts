import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { MysqlService } from '../../services/mysql.service';
import { PopupService } from '../../services/popup.service';

@Component({
    selector: 'app-nueva-evaluacion',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './nueva-evaluacion.component.html',
    styleUrls: ['./nueva-evaluacion.component.scss']
})
export class NuevaEvaluacionComponent implements OnInit {
    jugadorId: number = 0;
    entrenadorId: number = 0;
    coachNombre: string = 'Entrenador';
    coachFoto: string | null = null;
    alumnoNombre: string = 'Alumno';
    alumnoFoto: string | null = null;
    comentarios: string = '';

    // Data Structure
    golpes = [
        'Derecha', 'Reves', 'Volea de Derecha', 'Volea de Reves', 'Bandeja', 'Vibora',
        'Rulo', 'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'
    ]; // Removed 11th for symmetry or exact requirement? Requirement said 11 strokes. Let's check.
    // Requirement: "Derecha, Revés, Voleas, Bandeja, Víbora, Remate, Salida de pared, Globo, Saque, Resto". 
    // User listed 10 names in the prompt? No, 11th might be missing or I miscounted.
    // Prompt: "Derecha, Revés, Voleas, Bandeja, Víbora, Remate, Salida de pared, Globo, Saque, Resto" -> That's 10.
    // I will stick to these 10 unless user specified an 11th implicitly (maybe "Bajada de pared"?). 
    // I'll list the 10 from prompt.

    evaluationData: any = {};
    accordionsState: { [key: string]: boolean } = {};

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private evaluacionService: EvaluacionService,
        private mysqlService: MysqlService,
        private popupService: PopupService
    ) {
        console.log('NuevaEvaluacionComponent inicializado');
    }

    ngOnInit(): void {
        this.jugadorId = Number(this.route.snapshot.paramMap.get('id'));
        this.entrenadorId = Number(localStorage.getItem('userId'));

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user) {
            this.coachNombre = user.nombre || 'Entrenador';
            let foto = user.foto_perfil || user.link_foto || user.foto || null;
            if (foto && !foto.startsWith('http')) {
                foto = `https://api.padelmanager.cl/${foto}`;
            }
            this.coachFoto = foto;
        }

        // Initialize Data with defaults (5s)
        this.golpes.forEach(golpe => {
            this.evaluationData[golpe] = {
                tecnica: 5,
                control: 5,
                direccion: 5,
                decision: 5,
                comentario: ''
            };
            this.accordionsState[golpe] = false; // All closed by default
        });

        // Open first one
        if (this.golpes.length > 0) this.accordionsState[this.golpes[0]] = true;

        this.loadAlumnoPerfil();
        this.loadUltimaEvaluacion();
    }

    private loadUltimaEvaluacion() {
        if (!this.jugadorId) return;

        this.evaluacionService.getEvaluaciones(this.jugadorId).subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    // Sort by ID descending to get the absolute latest entry
                    const sorted = data.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
                    const latest = sorted[0];

                    if (latest && latest.scores) {
                        let scores = latest.scores;
                        if (typeof scores === 'string') {
                            try {
                                scores = JSON.parse(scores);
                            } catch (e) {
                                console.error('Error parsing scores:', e);
                                scores = null;
                            }
                        }

                        if (scores) {
                            // Merge previous scores into current data structure
                            this.golpes.forEach(golpe => {
                                const prevScore = scores[golpe] || scores[golpe.toLowerCase()]; // Case-insensitive fallback
                                if (prevScore) {
                                    this.evaluationData[golpe] = {
                                        tecnica: Number(prevScore.tecnica) || 5,
                                        control: Number(prevScore.control) || 5,
                                        direccion: Number(prevScore.direccion) || 5,
                                        decision: Number(prevScore.decision) || 5,
                                        comentario: ''
                                    };
                                }
                            });
                            console.log('Datos de la última evaluación (ID ' + latest.id + ') cargados correctamente.');
                        }
                    }
                }
            },
            error: (err) => console.error('Error cargando evaluación previa:', err)
        });
    }

    private loadAlumnoPerfil() {
        if (!this.jugadorId) return;
        this.mysqlService.getPerfil(this.jugadorId).subscribe({
            next: (res) => {
                if (res && res.user) {
                    this.alumnoNombre = res.user.nombre;
                    let foto = res.user.foto_perfil || res.user.foto || null;
                    if (foto && !foto.startsWith('http')) {
                        foto = `https://api.padelmanager.cl/${foto}`;
                    }
                    this.alumnoFoto = foto;
                }
            },
            error: (err) => console.error('Error al cargar perfil del alumno:', err)
        });
    }

    setAllScores(value: number) {
        this.golpes.forEach(golpe => {
            this.setStrokeScores(golpe, value);
        });
    }

    setStrokeScores(golpe: string, value: number) {
        this.evaluationData[golpe].tecnica = value;
        this.evaluationData[golpe].control = value;
        this.evaluationData[golpe].direccion = value;
        this.evaluationData[golpe].decision = value;
    }

    updateScore(golpe: string, metric: string, delta: number) {
        let val = this.evaluationData[golpe][metric] + delta;
        if (val < 1) val = 1;
        if (val > 10) val = 10;
        this.evaluationData[golpe][metric] = val;
    }

    setScore(golpe: string, metric: string, value: number) {
        this.evaluationData[golpe][metric] = value;
    }

    toggleAccordion(golpe: string) {
        this.accordionsState[golpe] = !this.accordionsState[golpe];
    }

    guardarEvaluacion() {
        this.popupService.confirm(
            '¿Guardar Evaluación?',
            'Se registrarán los puntajes asignados.'
        ).then((confirmed) => {
            if (confirmed) {
                const payload = {
                    jugador_id: this.jugadorId,
                    entrenador_id: this.entrenadorId,
                    scores: this.evaluationData,
                    comentarios: this.comentarios
                };

                this.evaluacionService.crearEvaluacion(payload).subscribe({
                    next: () => {
                        this.popupService.success('Guardado', 'La evaluación ha sido registrada.').then(() => {
                            this.router.navigate(['/alumnos']);
                        });
                    },
                    error: (err) => {
                        console.error(err);
                        this.popupService.error('Error', 'No se pudo guardar la evaluación.');
                    }
                });
            }
        });
    }

    cancelar() {
        this.router.navigate(['/alumnos']);
    }
}
