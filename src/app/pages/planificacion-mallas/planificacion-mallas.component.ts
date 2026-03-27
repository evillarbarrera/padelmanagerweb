import { Component, OnInit } from '@angular/core';
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
