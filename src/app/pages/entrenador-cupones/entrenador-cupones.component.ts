import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { MysqlService } from '../../services/mysql.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
    selector: 'app-entrenador-cupones',
    standalone: true,
    imports: [CommonModule, FormsModule, SidebarComponent],
    templateUrl: './entrenador-cupones.component.html',
    styleUrls: ['./entrenador-cupones.component.scss']
})
export class EntrenadorCuponesComponent implements OnInit {
    cupones: any[] = [];
    alumnos: any[] = [];
    alumnosFiltrados: any[] = [];
    searchTermAlumno: string = '';
    packs: any[] = [];
    isLoading = true;
    isSaving = false;
    userId: number = Number(localStorage.getItem('userId'));
    coachNombre: string = 'Entrenador';
    coachFoto: string | null = null;
    isSearchingAlumno = false;
    private searchSubject = new Subject<string>();

    showModal = false;
    nuevoCupon: any = {
        id: null,
        entrenador_id: this.userId,
        codigo: '',
        tipo_descuento: 'porcentaje',
        valor: 0,
        fecha_inicio: '',
        fecha_fin: '',
        jugador_id: null,
        pack_id: null,
        uso_maximo: null
    };

    // Interactive Tutorial State
    showTutorial = false;
    currentTutorialStep = 0;
    tutorialTop = '0px';
    tutorialLeft = '0px';
    tutorialSteps = [
        { target: '.hero-section', title: '🎟️ Gestión de Cupones', content: 'Aquí puedes crear descuentos para fidelizar a tus alumnos o lanzar promociones especiales en tus packs.' },
        { target: '.btn-neon-action', title: '➕ Crear Cupón', content: 'Haz clic aquí para diseñar tu primer cupón. Podrás elegir entre descuento fijo o porcentaje.' },
        { target: '.modal-content', title: '🛠 Configuración Avanzada', content: 'Puedes limitar el cupón a un alumno específico, a un pack concreto o establecer un límite de usos.' },
        { target: '.coupons-grid', title: '📊 Control de Activos', content: 'En este listado verás todos tus cupones activos, cuántas veces se han usado y cuándo vencen.' }
    ];

    constructor(
        private entrenamientoService: EntrenamientoService,
        private mysqlService: MysqlService,
        private popupService: PopupService,
        private router: Router
    ) {
        // Setup remote search
        this.searchSubject.pipe(
            debounceTime(200),
            distinctUntilChanged(),
            switchMap(term => {
                if (!term.trim()) {
                    this.isSearchingAlumno = false;
                    return [[]];
                }
                this.isSearchingAlumno = true;
                return this.mysqlService.searchAlumnos(term);
            })
        ).subscribe({
            next: (results) => {
                this.alumnosFiltrados = results;
                this.isSearchingAlumno = false;
                console.log('Search results:', results);
            },
            error: (err) => {
                console.error('Search error:', err);
                this.isSearchingAlumno = false;
            }
        });
    }

    ngOnInit(): void {
        this.loadProfile();
        this.loadData();
        this.loadAlumnosYPacks();
    }

    loadProfile(): void {
        this.mysqlService.getPerfil(this.userId).subscribe({
            next: (res) => {
                if (res.success) {
                    this.coachNombre = res.user.nombre || 'Entrenador';
                    this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;
                }
            }
        });
    }

    loadData() {
        this.isLoading = true;
        this.entrenamientoService.getCupones(this.userId).subscribe({
            next: (res) => {
                this.cupones = res;
                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
            }
        });
    }

    loadAlumnosYPacks() {
        if (!this.userId) return;

        this.entrenamientoService.getMisAlumnos(this.userId).subscribe({
            next: (res) => {
                this.alumnos = res;
                this.alumnosFiltrados = res;
            },
            error: (err) => console.error('Error loadAlumnos:', err)
        });

        this.mysqlService.getAllPacks(this.userId).subscribe({
            next: (res) => {
                this.packs = res;
                console.log('Mis packs para cupones:', res);
            },
            error: (err) => console.error('Error loadPacks:', err)
        });
    }

    filterAlumnos() {
        if (!this.searchTermAlumno) {
            this.alumnosFiltrados = this.alumnos;
            return;
        }

        // Trigger the observable search
        this.searchSubject.next(this.searchTermAlumno);
    }

    seleccionarAlumno(alumno: any) {
        // Support both id/nombre and jugador_id/jugador_nombre styles
        this.nuevoCupon.jugador_id = alumno.id || alumno.jugador_id;
        this.searchTermAlumno = alumno.nombre || alumno.jugador_nombre;
        this.alumnosFiltrados = [];
    }

    abrirModal(cupon: any = null) {
        if (cupon) {
            this.nuevoCupon = { ...cupon };
            const alu = this.alumnos.find(a => a.id == cupon.jugador_id);
            this.searchTermAlumno = alu ? alu.nombre : '';
        } else {
            this.nuevoCupon = {
                id: null,
                entrenador_id: this.userId,
                codigo: '',
                tipo_descuento: 'porcentaje',
                valor: 0,
                fecha_inicio: '',
                fecha_fin: '',
                jugador_id: null,
                pack_id: null,
                uso_maximo: null
            };
            this.searchTermAlumno = '';
        }
        this.alumnosFiltrados = this.alumnos;
        this.showModal = true;
    }

    cerrarModal() {
        this.showModal = false;
    }

    guardarCupon() {
        if (!this.nuevoCupon.codigo || !this.nuevoCupon.valor) {
            this.popupService.error('Error', 'Completa los campos obligatorios');
            return;
        }

        this.isSaving = true;
        this.entrenamientoService.saveCupon(this.nuevoCupon).subscribe({
            next: () => {
                this.isSaving = false;
                this.cerrarModal();
                this.loadData();
                this.popupService.success('Éxito', 'Cupón guardado correctamente');
            },
            error: (err) => {
                this.isSaving = false;
                this.popupService.error('Error', err.error?.error || 'No se pudo guardar el cupón');
            }
        });
    }

    eliminarCupon(id: number) {
        this.popupService.confirm('¿Eliminar cupón?', 'Esta acción desactivará el cupón permanentemente.')
            .then((confirmed: boolean) => {
                if (confirmed) {
                    this.entrenamientoService.deleteCupon(id).subscribe({
                        next: () => {
                            this.loadData();
                            this.popupService.success('Eliminado', 'El cupón ha sido desactivado');
                        },
                        error: (err) => {
                            this.popupService.error('Error', 'No se pudo eliminar el cupón');
                        }
                    });
                }
            });
    }

    goBack() {
        this.router.navigate(['/entrenador-home']);
    }

    // --- INTERACTIVE TUTORIAL METHODS ---
    startTutorial() {
        this.showTutorial = true;
        this.currentTutorialStep = 0;
        this.cerrarModal(); // Ensure we start clean
        setTimeout(() => this.updateTutorialPosition(), 50);
    }

    closeTutorial() {
        this.showTutorial = false;
        this.cerrarModal();
        localStorage.setItem('tutorial_cupones_done', 'true');
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
            this.currentTutorialStep++;

            // Interaction logic: Step 2 opens the creation modal to show fields
            if (this.currentTutorialStep === 2) {
                this.abrirModal();
            } else if (this.currentTutorialStep === 3) {
                this.cerrarModal();
            }

            setTimeout(() => this.updateTutorialPosition(), 150);
        } else {
            this.closeTutorial();
        }
    }

    updateTutorialPosition() {
        const step = this.tutorialSteps[this.currentTutorialStep];
        const el = document.querySelector(step.target);
        if (el) {
            const rect = el.getBoundingClientRect();
            const cardHeight = 180;
            const cardWidth = 340;
            
            let top = rect.bottom + 15;
            let left = rect.left + (rect.width / 2) - (cardWidth / 2);

            // Adjust if it goes off screen
            if (top + cardHeight > window.innerHeight) top = rect.top - cardHeight - 15;
            if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 20;
            if (left < 0) left = 20;

            this.tutorialTop = `${top}px`;
            this.tutorialLeft = `${left}px`;
            
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('tutorial-highlight');
            setTimeout(() => el.classList.remove('tutorial-highlight'), 2000);
        }
    }
}
