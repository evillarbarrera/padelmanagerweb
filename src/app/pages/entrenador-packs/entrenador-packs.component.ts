import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PacksService } from '../../services/packs.service';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-entrenador-packs',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './entrenador-packs.component.html',
  styleUrls: ['./entrenador-packs.component.scss']
})
export class EntrenadorPacksComponent implements OnInit {
  packs: any[] = [];
  filtro: string = '';
  mostrarFormulario = false;
  isLoading = true;
  userId: number | null = null;
  coachNombre = 'Entrenador';
  coachFoto: string | null = null;

  // Tutorial State
  showTutorial = false;
  currentTutorialStep = 0;
  tutorialTop = '0px';
  tutorialLeft = '0px';
  tutorialSteps = [
    { target: '.add-btn', title: '➕ Crea tu Pack', content: 'Haz clic aquí para abrir el formulario y empezar a ofrecer tus servicios.' },
    { target: 'input[name="nombre"]', title: '🏷️ Nombre del Pack', content: 'Dale un nombre atractivo, por ejemplo: "Pack Pro 10 Clases" o "Clínica de Verano".' },
    { target: 'select[name="tipo"]', title: '🎾 Tipo de Clase', content: 'Elige entre Individual o Grupal. Recuerda que Grupal es para 4-6 alumnos.' },
    { target: 'input[name="cant_personas"]', title: '👥 Jugadores', content: 'Define cuántas personas incluye el pack. Útil para "Packs Duplas" o "Tríos". El sistema dividirá los créditos.' },
    { target: 'input[name="sesiones"]', title: '🔢 Cantidad de Sesiones', content: 'Define cuántas clases incluye el pack (comúnmente 4, 8 o 12).' },
    { target: 'input[name="precio"]', title: '💰 Define tu Precio', content: 'Ponle valor a tu trabajo. El pago se gestionará según el pack seleccionado.' },
    { target: 'input[name="r_inicio"]', title: '🕒 Horario Permitido', content: 'Opcional. Útil para packs "Hora Valle" o promociones matutinas. Limita cuándo se pueden usar los créditos.' },
    { target: 'textarea[name="descripcion"]', title: '📝 Descripción', content: 'Cuéntales a tus alumnos qué incluye el pack, beneficios o requisitos especiales.' },
    { target: '.btn-submit', title: '🚀 ¡Publicar!', content: 'Guarda tu pack para que aparezca en tu lista y puedas empezar a agendar alumnos.' }
  ];

  nuevoPack: any = {
    id: null,
    nombre: '',
    tipo: 'individual',
    sesiones_totales: null,
    duracion_sesion_min: 60,
    precio: null,
    descripcion: '',
    capacidad_minima: 4,
    capacidad_maxima: 6,
    dia_semana: null,
    hora_inicio: null,
    categoria: '',
    rango_horario_inicio: null,
    rango_horario_fin: null,
    cantidad_personas: 1
  };

  constructor(
    private packsService: PacksService,
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();
    this.loadPacks();
  }

  loadProfile(): void {
    if (!this.userId) return;
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.coachNombre = res.user.nombre || 'Entrenador';
          this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;
        }
      },
      error: (err) => console.error(err)
    });
  }

  loadPacks(): void {
    if (!this.userId) return;
    this.isLoading = true;

    this.packsService.getMisPacks(this.userId).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.packs = res;
        } else if (res && res.success && res.data) {
          this.packs = res.data;
        } else {
          this.packs = [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading packs:', err);
        this.isLoading = false;
      }
    });
  }

  get packsFiltrados(): any[] {
    return this.packs.filter(p =>
      p.nombre.toLowerCase().includes(this.filtro.toLowerCase())
    );
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.resetFormulario();
    }
  }

  crearPack(): void {
    if (!this.nuevoPack.nombre || !this.nuevoPack.sesiones_totales) {
      this.popupService.warning('Campos incompletos', 'Por favor completa nombre y sesiones totales.');
      return;
    }

    if (this.nuevoPack.id) {
      // EDITAR
      this.nuevoPack.entrenador_id = this.userId;
      this.packsService.editarPack(this.nuevoPack).subscribe({
        next: (res) => {
          this.popupService.success('¡Actualizado!', 'Pack actualizado correctamente');
          this.loadPacks();
          this.toggleFormulario();
        },
        error: (err) => {
          console.error('Error updating pack:', err);
          this.popupService.error('Error', 'No se pudo actualizar el pack');
        }
      });
    } else {
      // CREAR
      this.nuevoPack.entrenador_id = this.userId;
      this.packsService.crearPack(this.nuevoPack).subscribe({
        next: (res) => {
          this.popupService.success('¡Creado!', 'Pack creado exitosamente');
          this.loadPacks();
          this.toggleFormulario();
        },
        error: (err) => {
          console.error('Error creating pack:', err);
          this.popupService.error('Error', 'Error al crear el pack');
        }
      });
    }
  }

  editarPack(pack: any): void {
    this.nuevoPack = { ...pack };
    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  eliminarPack(packId: number): void {
    this.popupService.confirm(
      '¿Estás seguro?',
      "No podrás revertir esto"
    ).then((confirmed) => {
      if (confirmed) {
        this.packsService.eliminarPack(packId).subscribe({
          next: (res) => {
            this.popupService.success('¡Eliminado!', 'El pack ha sido eliminado.');
            this.loadPacks();
          },
          error: (err) => {
            console.error('Error deleting pack:', err);
            this.popupService.error('Error', 'Error al eliminar el pack');
          }
        });
      }
    });
  }

  resetFormulario(): void {
    this.nuevoPack = {
      id: null,
      nombre: '',
      tipo: 'individual',
      sesiones_totales: null,
      duracion_sesion_min: 60,
      precio: null,
      descripcion: '',
      capacidad_minima: 4,
      capacidad_maxima: 6,
      dia_semana: null,
      hora_inicio: null,
      categoria: '',
      rango_horario_inicio: null,
      rango_horario_fin: null,
      cantidad_personas: 1
    };
  }

  // --- TUTORIAL METHODS ---
  startTutorial() {
    this.showTutorial = true;
    this.currentTutorialStep = 0;
    this.updateTutorialPosition();
  }

  nextTutorialStep() {
    if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
      this.currentTutorialStep++;
      
      // Auto-open form for step 2 if it's closed
      if (this.currentTutorialStep === 1 && !this.mostrarFormulario) {
        this.toggleFormulario();
      }

      // Force "Individual" type for steps that require it (like "Jugadores" or "Horario")
      if (this.currentTutorialStep === 3) {
        this.nuevoPack.tipo = 'individual';
      }

      setTimeout(() => this.updateTutorialPosition(), 50);
    } else {
      this.closeTutorial();
    }
  }

  updateTutorialPosition() {
    const step = this.tutorialSteps[this.currentTutorialStep];
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

    setTimeout(() => {
      const el = document.querySelector(step.target) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        el.classList.add('tutorial-highlight');

        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;

        if (rect.top > vh / 2) {
          this.tutorialTop = (rect.top - 200) + 'px';
        } else {
          this.tutorialTop = (rect.bottom + 40) + 'px';
        }
        this.tutorialLeft = Math.max(20, Math.min(vw - 420, rect.left)) + 'px';
      } else {
        this.tutorialTop = '40%';
        this.tutorialLeft = 'calc(50% - 200px)';
      }
    }, 10);
  }

  closeTutorial() {
    this.showTutorial = false;
    this.currentTutorialStep = 0;
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  }

  volver(): void {
    this.router.navigate(['/entrenador-home']);
  }
}
