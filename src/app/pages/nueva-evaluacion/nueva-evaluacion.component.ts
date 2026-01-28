import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluacionService } from '../../services/evaluacion.service';
import Swal from 'sweetalert2';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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
    comentarios: string = '';

    // Data Structure
    golpes = [
        'Derecha', 'Reves', 'Voleas', 'Bandeja', 'Vibora',
        'Remate', 'Salida de Pared', 'Globo', 'Saque', 'Resto'
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
        private evaluacionService: EvaluacionService
    ) {
        console.log('NuevaEvaluacionComponent inicializado');
    }

    ngOnInit(): void {
        this.jugadorId = Number(this.route.snapshot.paramMap.get('id'));
        this.entrenadorId = Number(localStorage.getItem('userId'));

        // Initialize Data
        this.golpes.forEach(golpe => {
            this.evaluationData[golpe] = {
                tecnica: 5,
                control: 5,
                direccion: 5,
                decision: 5
            };
            this.accordionsState[golpe] = false; // All closed by default
        });

        // Open first one
        if (this.golpes.length > 0) this.accordionsState[this.golpes[0]] = true;
    }

    toggleAccordion(golpe: string) {
        this.accordionsState[golpe] = !this.accordionsState[golpe];
    }

    guardarEvaluacion() {
        Swal.fire({
            title: '¿Guardar Evaluación?',
            text: 'Se registrarán los puntajes asignados.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            confirmButtonColor: '#10b981'
        }).then((result) => {
            if (result.isConfirmed) {
                const payload = {
                    jugador_id: this.jugadorId,
                    entrenador_id: this.entrenadorId,
                    scores: this.evaluationData,
                    comentarios: this.comentarios
                };

                this.evaluacionService.crearEvaluacion(payload).subscribe({
                    next: () => {
                        Swal.fire('Guardado', 'La evaluación ha sido registrada.', 'success');
                        this.router.navigate(['/alumnos']);
                    },
                    error: (err) => {
                        console.error(err);
                        Swal.fire('Error', 'No se pudo guardar la evaluación.', 'error');
                    }
                });
            }
        });
    }

    cancelar() {
        this.router.navigate(['/alumnos']);
    }
}
