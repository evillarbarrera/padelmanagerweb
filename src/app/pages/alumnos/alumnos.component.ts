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

  // Creación de Alumno
  nuevoAlumno = { nombre: '', email: '' };
  isCreatingAlumno = false;

  // Paginación y Ordenamiento
  currentPage = 1;
  itemsPerPage = 6;
  pagedAlumnos: any[] = [];
  sortCriteria: 'nombre' | 'saldo' = 'nombre';

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.calcularItemsPerPage();
  }

  private calcularItemsPerPage() {
    if (window.innerWidth >= 1200) {
      this.itemsPerPage = 9; // 3 rows, 3 columns
    } else if (window.innerWidth >= 768) {
      this.itemsPerPage = 6; // iPad/Tablet
    } else {
      this.itemsPerPage = 4; // Mobile
    }
    this.updatePagedAlumnos();
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
            sesiones_pendientes: a.sesiones_pendientes,
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

  verClases(alumno: any): void {
    this.router.navigate(['/clases', alumno.jugador_id]);
  }

  verProgreso(alumno: any): void {
    this.router.navigate(['/progreso', alumno.jugador_id]);
  }

  mostrarModalCrear(): void {
    this.isCreatingAlumno = true;
    this.nuevoAlumno = { nombre: '', email: '' }; // Reset
  }

  cerrarModalCrear(): void {
    this.isCreatingAlumno = false;
  }

  crearAlumno(): void {
    if (!this.nuevoAlumno.nombre || !this.nuevoAlumno.email) {
      this.popupService.error('Campos incompletos', 'Por favor completa todos los campos');
      return;
    }

    if (!this.userId) return;

    this.isLoading = true;
    this.loadingMessage = 'Registrando alumno y enviando correo...';
    
    this.alumnoService.crearAlumno({
      ...this.nuevoAlumno,
      entrenador_id: this.userId
    }).subscribe({
      next: (res) => {
        if (res.success) {
          const mailMsg = res.mail_sent ? 'y se ha enviado el correo de bienvenida.' : 'pero ha fallado el envío del correo (revisar configuración).';
          this.popupService.success('Alumno Creado', `El alumno se registró con éxito ${mailMsg}`);
          this.cerrarModalCrear();
          this.loadAlumnos(); // Refrescar lista
        }
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.error || 'Error al crear alumno';
        this.popupService.error('Error', msg);
      }
    });
  }
}
