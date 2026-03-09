import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AlumnoService } from '../../services/alumno.service';
import { MysqlService } from '../../services/mysql.service';
import { PopupService } from '../../services/popup.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-alumnos',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './alumnos.component.html',
  styleUrls: ['./alumnos.component.scss']
})
export class AlumnosComponent implements OnInit {
  alumnos: any[] = [];
  alumnosFiltrados: any[] = [];
  isLoading = true;
  userId: number | null = null;
  searchTerm = '';
  coachNombre = 'Entrenador'; // Default
  coachFoto: string | null = null;
  loadingMessage = 'Cargando alumnos...';

  // Paginación y Ordenamiento
  currentPage = 1;
  itemsPerPage = 6;
  pagedAlumnos: any[] = [];
  sortCriteria: 'nombre' | 'saldo' = 'nombre';

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.calcularItemsPerPage();
  }

  private calcularItemsPerPage() {
    if (window.innerWidth >= 768) {
      this.itemsPerPage = 9999;
      this.updatePagedAlumnos();
      return;
    }
    // En web usamos un grid de 3 columnas (aprox 350px de alto por card)
    // Restamos aprox 250px de cabecera/filtros
    const alturaDisponible = window.innerHeight - 250;
    const filas = Math.max(2, Math.floor(alturaDisponible / 350));

    // Asumimos 3 columnas en desktop (> 1200), 2 en medianos (> 768), 1 en móvil
    let columnas = 1;
    this.itemsPerPage = filas * columnas;
    this.updatePagedAlumnos();
    console.log(`Paginación Web dinámica: ${this.itemsPerPage} items (${filas}x${columnas})`);
  }

  constructor(
    private alumnoService: AlumnoService,
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
    this.calcularItemsPerPage();
    this.loadProfile();
    this.loadAlumnos();
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

  loadAlumnos(): void {
    if (!this.userId) return;
    this.loadingMessage = 'Cargando alumnos...';
    this.isLoading = true;
    this.alumnoService.getAlumnos(this.userId).subscribe({
      next: (res) => {
        this.alumnos = (res || []).map(a => {
          const p1 = a.foto_perfil && String(a.foto_perfil).length > 5 ? a.foto_perfil : null;
          const p2 = a.foto && String(a.foto).length > 5 ? a.foto : null;
          let fotoRaw = p1 || p2;
          let fotoUrl = "";

          if (fotoRaw && !fotoRaw.includes('imagen_defecto')) {
            if (!fotoRaw.startsWith('http')) {
              const cleanPath = fotoRaw.startsWith('/') ? fotoRaw.substring(1) : fotoRaw;
              fotoUrl = `https://api.padelmanager.cl/${cleanPath}`;
            } else {
              fotoUrl = fotoRaw;
            }
          } else {
            fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.jugador_nombre)}&background=ccff00&color=000`;
          }

          return {
            ...a,
            sesiones_pagadas: Number(a.sesiones_pagadas),
            sesiones_reservadas: a.sesiones_reservadas,
            sesiones_grupales: a.sesiones_grupales,
            sesiones_restantes: a.sesiones_pendientes,
            pack_nombre: a.pack_nombres,
            foto: fotoUrl
          };
        });
        this.alumnosFiltrados = this.alumnos;
        this.updatePagedAlumnos();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
      }
    });
  }

  filtrarAlumnos(): void {
    let filtered = this.alumnos;
    if (this.searchTerm) {
      filtered = this.alumnos.filter(a =>
        a.jugador_nombre.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    this.alumnosFiltrados = this.aplicarOrdenamiento(filtered);
    this.currentPage = 1;
    this.updatePagedAlumnos();
  }

  cambiarOrden(criteria: 'nombre' | 'saldo'): void {
    this.sortCriteria = criteria;
    this.alumnosFiltrados = this.aplicarOrdenamiento(this.alumnosFiltrados);
    this.currentPage = 1;
    this.updatePagedAlumnos();
  }

  aplicarOrdenamiento(list: any[]): any[] {
    if (this.sortCriteria === 'nombre') {
      return [...list].sort((a, b) => a.jugador_nombre.localeCompare(b.jugador_nombre));
    } else {
      return [...list].sort((a, b) => (Number(a.sesiones_restantes) || 0) - (Number(b.sesiones_restantes) || 0));
    }
  }

  updatePagedAlumnos(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.pagedAlumnos = this.alumnosFiltrados.slice(startIndex, endIndex);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedAlumnos();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedAlumnos();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.alumnosFiltrados.length / this.itemsPerPage);
  }

  volver(): void {
    this.router.navigate(['/entrenador-home']);
  }

  irAEvaluar(alumno: any): void {
    if (!alumno.jugador_id) return;
    this.router.navigate(['/evaluar', alumno.jugador_id]);
  }

  verProgreso(alumno: any): void {
    this.router.navigate(['/progreso', alumno.jugador_id]);
  }

  triggerVideoUpload(alumno: any): void {
    const input = document.getElementById('videoInput-' + alumno.jugador_id) as HTMLInputElement;
    if (input) {
      this.popupService.info(
        'Subir Video',
        'Formatos permitidos: MP4, MOV (Máx 20MB)'
      ).then(() => input.click());
    }
  }

  onVideoSelected(event: any, alumno: any): void {
    const file = event.target.files[0];
    if (!file) return;

    Swal.fire({
      title: 'Detalles del Video',
      html: `
        <input id="swal-title" class="swal2-input" placeholder="Título">
        <textarea id="swal-comment" class="swal2-textarea" placeholder="Comentario"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Subir',
      preConfirm: () => {
        return {
          title: (document.getElementById('swal-title') as HTMLInputElement).value,
          comment: (document.getElementById('swal-comment') as HTMLTextAreaElement).value
        };
      }
    }).then((result: any) => {
      if (result.isConfirmed) {
        const { title, comment } = result.value;
        const formData = new FormData();
        formData.append('video', file);
        formData.append('jugador_id', alumno.jugador_id.toString());
        formData.append('entrenador_id', this.userId?.toString() || '');
        formData.append('titulo', title || 'Video Entrenamiento');
        formData.append('comentario', comment || '');

        this.isLoading = true;
        this.alumnoService.uploadVideo(formData).subscribe({
          next: (ev: any) => {
            if (ev.type === HttpEventType.Response) {
              this.isLoading = false;
              this.popupService.success('¡Éxito!', 'Video subido.');
            }
          },
          error: () => {
            this.isLoading = false;
          }
        });
      }
    });
  }
}
