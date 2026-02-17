import { Component, OnInit } from '@angular/core';
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
        this.alumnos = res || [];
        // Map API fields to UI-friendly names (now fully aggregated by backend)
        this.alumnos = this.alumnos.map(a => ({
          ...a,
          sesiones_pagadas: Number(a.sesiones_pagadas),
          sesiones_reservadas: a.sesiones_reservadas,
          sesiones_grupales: a.sesiones_grupales,
          sesiones_restantes: a.sesiones_pendientes,
          // If we want to show current active pack names
          pack_nombre: a.pack_nombres
        }));
        this.alumnosFiltrados = this.alumnos; // Initialize filtered list
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading alumnos:', err);
        this.isLoading = false;
      }
    });
  }

  filtrarAlumnos(): void {
    if (!this.searchTerm) {
      this.alumnosFiltrados = this.alumnos;
    } else {
      this.alumnosFiltrados = this.alumnos.filter(a =>
        a.jugador_nombre.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  volver(): void {
    this.router.navigate(['/entrenador-home']);
  }

  verDetalles(alumno: any): void {
    // Placeholder for future detail view
    // Swal.fire('Detalles', `Ver detalles de ${alumno.jugador_nombre}`, 'info');
  }

  irAEvaluar(alumno: any): void {
    console.log('Intento de evaluar:', alumno);
    console.log('ID Jugador:', alumno.jugador_id);
    if (!alumno.jugador_id) {
      console.error('ERROR: jugador_id es undefined/null');
      return;
    }
    // Navigate to evaluation form with student ID
    this.router.navigate(['/evaluar', alumno.jugador_id]);
  }

  verProgreso(alumno: any): void {
    this.router.navigate(['/progreso', alumno.jugador_id]);
  }

  triggerVideoUpload(alumno: any): void {
    const input = document.getElementById('videoInput-' + alumno.jugador_id) as HTMLInputElement;
    if (input) {
      this.popupService.info(
        'Subir Video de Entrenamiento',
        'Requisitos:\n- Formato: MP4, MOV\n- Tamaño Máx: 20MB\n- Contenido: Puntos o técnica específica.'
      ).then(() => {
        input.click();
      });
    }
  }

  onVideoSelected(event: any, alumno: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validation
    const allowedExtensions = ['mp4', 'mov', 'avi', 'wmv'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      this.popupService.error('Error', 'Formato de video no permitido. Usa MP4 o MOV.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      this.popupService.error('Error', 'El video supera los 20MB permitidos.');
      return;
    }

    // Friendly prompt for details using SweetAlert2 directly
    Swal.fire({
      title: 'Detalles del Video',
      html: `
        <div style="text-align: left;">
          <label style="display: block; margin-bottom: 8px; font-weight: bold; font-family: 'Inter', sans-serif;">Título del video</label>
          <input id="swal-title" class="swal2-input" placeholder="Ej: Técnica de Drive" style="margin: 0; width: 100%; box-sizing: border-box;">
          
          <label style="display: block; margin-top: 20px; margin-bottom: 8px; font-weight: bold; font-family: 'Inter', sans-serif;">Comentario para el alumno</label>
          <textarea id="swal-comment" class="swal2-textarea" placeholder="Ej: Fíjate en la posición de los pies..." style="margin: 0; width: 100%; height: 100px; box-sizing: border-box;"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Subir Ahora',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#111',
      cancelButtonColor: '#888',
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
        formData.append('titulo', title || ('Entrenamiento ' + new Date().toLocaleDateString()));
        formData.append('comentario', comment || '');

        this.loadingMessage = 'Subiendo video de entrenamiento... 0%';
        this.isLoading = true;
        this.alumnoService.uploadVideo(formData).subscribe({
          next: (event: any) => {
            if (event.type === HttpEventType.UploadProgress) {
              const percentDone = Math.round(100 * event.loaded / event.total);
              this.loadingMessage = `Subiendo video de entrenamiento... ${percentDone}%`;
            } else if (event.type === HttpEventType.Response) {
              this.isLoading = false;
              this.popupService.success('¡Éxito!', 'Video subido correctamente.');
              event.target.value = ''; // Reset input
            }
          },
          error: (err: any) => {
            this.isLoading = false;
            console.error('Error uploading video:', err);
            this.popupService.error('Error', err.error?.error || 'No se pudo subir el video.');
            event.target.value = ''; // Reset input
          }
        });
      } else {
        event.target.value = ''; // Reset input if cancelled
      }
    });
  }
}
