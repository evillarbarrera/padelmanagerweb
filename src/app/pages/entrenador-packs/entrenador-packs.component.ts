import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PacksService } from '../../services/packs.service';
import { MysqlService } from '../../services/mysql.service';
import Swal from 'sweetalert2';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

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
    categoria: ''
  };

  constructor(
    private packsService: PacksService,
    private mysqlService: MysqlService,
    private router: Router
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
      Swal.fire('Campos incompletos', 'Por favor completa nombre y sesiones totales.', 'warning');
      return;
    }

    if (this.nuevoPack.id) {
      // EDITAR
      this.packsService.editarPack(this.nuevoPack).subscribe({
        next: (res) => {
          Swal.fire('¡Actualizado!', 'Pack actualizado correctamente', 'success');
          this.loadPacks();
          this.toggleFormulario();
        },
        error: (err) => {
          console.error('Error updating pack:', err);
          Swal.fire('Error', 'No se pudo actualizar el pack', 'error');
        }
      });
    } else {
      // CREAR
      this.nuevoPack.entrenador_id = this.userId; // Ensure trainer ID is attached
      this.packsService.crearPack(this.nuevoPack).subscribe({
        next: (res) => {
          Swal.fire('¡Creado!', 'Pack creado exitosamente', 'success');
          this.loadPacks();
          this.toggleFormulario();
        },
        error: (err) => {
          console.error('Error creating pack:', err);
          Swal.fire('Error', 'Error al crear el pack', 'error');
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
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        this.packsService.eliminarPack(packId).subscribe({
          next: (res) => {
            Swal.fire('¡Eliminado!', 'El pack ha sido eliminado.', 'success');
            this.loadPacks();
          },
          error: (err) => {
            console.error('Error deleting pack:', err);
            Swal.fire('Error', 'Error al eliminar el pack', 'error');
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
      categoria: ''
    };
  }

  volver(): void {
    this.router.navigate(['/entrenador-home']);
  }
}
