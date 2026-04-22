import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { NgIf, NgFor } from '@angular/common';

@Component({
    selector: 'app-planificacion-mallas',
    standalone: true,
    imports: [CommonModule, NgIf, NgFor, FormsModule, ReactiveFormsModule, SidebarComponent],
    templateUrl: './planificacion-mallas.component.html',
    styleUrls: ['./planificacion-mallas.component.scss']
})
export class PlanificacionMallasComponent implements OnInit {
    mallaForm: FormGroup;
    isPreviewMode: boolean = false;
    viewMode: 'list' | 'editor' = 'list';
    mallasList: any[] = [];
    currentMallaId: number | null = null;
    levels: string[] = ['Base', 'Intermedio', 'Avanzado', 'Competitivo'];
    
    // Sidebar Data
    entrenadorId: number = 0;
    coachNombre: string = 'Entrenador';
    coachFoto: string | null = null;
    
    // UI State
    selectedClaseIndex: number = 0;
    isLoading: boolean = false;
    // Tutorial State
    showTutorial: boolean = false;
    currentTutorialStep: number = 0;
    tutorialTop: string = '0px';
    tutorialLeft: string = '0px';
    tutorialSteps = [
        { target: '.section-title', title: '🏗️ Planificación Estratégica', content: 'Aquí puedes diseñar programas de entrenamiento completos para tus alumnos.' },
        { target: '.btn-save.btn-glow', title: '➕ Crear Nuevo Plan', content: 'Haz clic aquí para comenzar una nueva malla desde cero.' },
        { target: '.config-section', title: '⚙️ Configuración Base', content: 'Define el nombre, nivel y público objetivo. El sistema adaptará los módulos automáticamente.' },
        { target: '.tabs-nav', title: '📅 Organización Técnica', content: 'Navega entre las distintas clases de tu programa y dales una secuencia lógica.' },
        { target: '.builder-stage', title: '🎾 Contenido de la Clase', content: 'Detalla cada bloque técnico para que tu alumno sepa exactamente qué trabajaron.' },
        { target: '.footer-btns', title: '🚀 Guardar y Publicar', content: 'Al terminar, guarda tu plan para asignarlo como una plantilla oficial de tu academia.' }
    ];

    @HostListener('window:resize')
    onResize() {
        if (this.showTutorial) this.updateTutorialPosition();
    }

    startTutorial() {
        if (this.viewMode === 'editor') {
            this.viewMode = 'list';
        }
        this.showTutorial = true;
        this.currentTutorialStep = 0;
        setTimeout(() => this.updateTutorialPosition(), 100);
    }

    closeTutorial() {
        this.showTutorial = false;
        // Optional: reload mallas to be safe
        this.loadMallas();
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
            this.currentTutorialStep++;
            
            // If moving to step 2 (Config), open the editor
            if (this.currentTutorialStep === 2 && this.viewMode === 'list') {
                this.nuevaMalla();
            }

            // High timeout for step 2 to allow editor rendering
            const waitTime = this.currentTutorialStep === 2 ? 400 : 100;
            setTimeout(() => this.updateTutorialPosition(), waitTime);
        } else {
            this.closeTutorial();
            this.viewMode = 'list';
        }
    }

    updateTutorialPosition() {
        const step = this.tutorialSteps[this.currentTutorialStep];
        const el = document.querySelector(step.target);
        
        if (el) {
            const rect = el.getBoundingClientRect();
            const cardHeight = 220;
            const cardWidth = 340;
            
            let top = rect.bottom + 20;
            let left = rect.left + (rect.width / 2) - (cardWidth / 2);

            if (top + cardHeight > window.innerHeight) top = rect.top - cardHeight - 20;
            if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 20;
            if (left < 0) left = 20;

            this.tutorialTop = `${top + window.scrollY}px`;
            this.tutorialLeft = `${left + window.scrollX}px`;
            
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('tutorial-highlight');
            setTimeout(() => el.classList.remove('tutorial-highlight'), 2500);
        } else {
            // Self-healing: if target not found and we have more steps, skip to next
            if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
                console.warn('Target not found, skipping to next step:', step.target);
                this.nextTutorialStep();
            }
        }
    }

    constructor(
        private fb: FormBuilder,
        public router: Router,
        private popupService: PopupService
    ) {
        this.mallaForm = this.fb.group({
            nombreMalla: ['', Validators.required],
            nivel: ['Intermedio', Validators.required],
            publico: ['Adultos', Validators.required],
            numClases: [4, [Validators.required, Validators.min(1), Validators.max(20)]],
            clases: this.fb.array([])
        });
    }

    ngOnInit(): void {
        this.loadUserData();
        this.loadMallas();
        
        // Listen to changes in numClases to regenerate array
        this.mallaForm.get('numClases')?.valueChanges.subscribe(val => {
            if (val >= 1 && val <= 20 && this.viewMode === 'editor') {
                this.generateClases(val);
            }
        });
    }

    private loadUserData() {
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
    }

    loadMallas() {
        this.isLoading = true;
        const token = localStorage.getItem('token');
        const authValue = token ? `Bearer ${token}` : '';
        fetch(`${environment.apiUrl}/mallas/get_mallas.php?entrenador_id=${this.entrenadorId}`, {
            headers: {
                'Authorization': authValue,
                'X-Authorization': authValue
            }
        })
            .then(r => r.json())
            .then(res => {
                this.mallasList = Array.isArray(res) ? res : [];
                this.isLoading = false;
            })
            .catch(err => {
                console.error('Error loading mallas:', err);
                this.isLoading = false;
            });
    }

    nuevaMalla() {
        this.currentMallaId = null;
        this.resetForm();
        this.viewMode = 'editor';
        this.isPreviewMode = false;
        this.selectedClaseIndex = 0;
        this.generateClases(4);
    }

    editarMalla(id: number) {
        this.isLoading = true;
        this.currentMallaId = id;
        const token = localStorage.getItem('token');
        const authValue = token ? `Bearer ${token}` : '';
        fetch(`${environment.apiUrl}/mallas/get_mallas.php?id=${id}`, {
            headers: {
                'Authorization': authValue,
                'X-Authorization': authValue
            }
        })
            .then(r => r.json())
            .then(res => {
                this.isLoading = false;
                if (res && res.id) {
                    this.viewMode = 'editor';
                    this.isPreviewMode = false;
                    this.selectedClaseIndex = 0;
                    
                    // Llenar el formulario
                    this.mallaForm.patchValue({
                        nombreMalla: res.nombre,
                        nivel: res.nivel,
                        publico: res.publico,
                        numClases: res.clases.length
                    }, { emitEvent: false });

                    // Limpiar y regenerar clases
                    this.clases.clear();
                    res.clases.forEach((c: any, index: number) => {
                        const group = this.fb.group({
                            titulo: [c.titulo, Validators.required],
                            objetivo: [c.objetivo_decoded || c.objetivo, Validators.required],
                            contenido: this.fb.group({
                                calentamiento: [c.calentamiento || ''],
                                parteTecnica: [c.parte_tecnica || ''],
                                drills: [c.drills || ''],
                                juego: [c.juego || '']
                            }),
                            recursos: [c.recursos || '']
                        });
                        this.clases.push(group);
                    });
                }
            })
            .catch(err => {
                this.isLoading = false;
                this.popupService.error('Error', 'No se pudo cargar el detalle de la malla.');
            });
    }

    volverAlListado() {
        if (this.mallaForm.dirty) {
            this.popupService.confirm('Cambios sin guardar', '¿Deseas volver al listado? Perderás los cambios no guardados.')
                .then(conf => {
                    if (conf) {
                        this.viewMode = 'list';
                        this.loadMallas();
                    }
                });
        } else {
            this.viewMode = 'list';
            this.loadMallas();
        }
    }

    resetForm() {
        this.mallaForm.reset({
            nivel: 'Intermedio',
            publico: 'Adultos',
            numClases: 4
        });
        this.clases.clear();
    }

    get clases() {
        return this.mallaForm.get('clases') as FormArray;
    }

    generateClases(num: number) {
        const currentClases = this.clases.length;
        if (num > currentClases) {
            for (let i = currentClases; i < num; i++) {
                this.clases.push(this.createClase(i + 1));
            }
        } else if (num < currentClases) {
            for (let i = currentClases; i > num; i--) {
                this.clases.removeAt(i - 1);
            }
            if (this.selectedClaseIndex >= num) {
                this.selectedClaseIndex = num - 1;
            }
        }
    }

    createClase(index: number): FormGroup {
        return this.fb.group({
            titulo: [`Clase ${index}`, Validators.required],
            objetivo: ['', Validators.required],
            contenido: this.fb.group({
                calentamiento: [''],
                parteTecnica: [''],
                drills: [''],
                juego: ['']
            }),
            recursos: ['']
        });
    }

    selectClase(index: number) {
        this.selectedClaseIndex = index;
    }

    togglePreview() {
        if (this.mallaForm.invalid && !this.isPreviewMode) {
            this.popupService.error('Formulario Incompleto', 'Por favor completa los campos obligatorios antes de previsualizar.');
            return;
        }
        this.isPreviewMode = !this.isPreviewMode;
    }

    moverClase(index: number, direccion: number) {
        const newIndex = index + direccion;
        if (newIndex < 0 || newIndex >= this.clases.length) return;

        const claseControl = this.clases.at(index);
        this.clases.removeAt(index);
        this.clases.insert(newIndex, claseControl);
        
        // Update selected index to follow the moved item
        this.selectedClaseIndex = newIndex;
    }

    getProgreso(): number {
        const total = this.clases.length;
        if (total === 0) return 0;
        let completadas = 0;
        this.clases.controls.forEach(clase => {
            if (clase.get('titulo')?.value && clase.get('objetivo')?.value) {
                completadas++;
            }
        });
        return Math.round((completadas / total) * 100);
    }

    guardarMalla() {
        if (this.mallaForm.invalid) {
            this.popupService.error('Error', 'Completa todos los campos obligatorios.');
            return;
        }

        const msg = this.currentMallaId ? '¿Actualizar Malla?' : '¿Guardar Malla?';
        this.popupService.confirm(msg, 'Se guardará como una plantilla para asignar a tus alumnos.')
            .then(confirmed => {
                if (confirmed) {
                    this.isLoading = true;
                    
                    const payload = {
                        ...this.mallaForm.value,
                        mallaId: this.currentMallaId,
                        entrenador_id: this.entrenadorId
                    };

                    const url = `${environment.apiUrl}/mallas/save_template.php`;
                    const token = localStorage.getItem('token');
                    const authValue = token ? `Bearer ${token}` : '';
                    fetch(url, {
                        method: 'POST',
                        headers: { 
                            'Authorization': authValue,
                            'X-Authorization': authValue,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify(payload)
                    })
                    .then(r => r.json())
                    .then(res => {
                        this.isLoading = false;
                        if (res.success) {
                            this.popupService.success('Éxito', 'Malla guardada correctamente.');
                            this.viewMode = 'list';
                            this.loadMallas();
                        } else {
                            this.popupService.error('Error', res.error || 'No se pudo guardar la malla.');
                        }
                    })
                    .catch(err => {
                        this.isLoading = false;
                        console.error('Save error:', err);
                        this.popupService.error('Error de Conexión', 'Ocurrió un problema al conectar con el servidor.');
                    });
                }
            });
    }
}
