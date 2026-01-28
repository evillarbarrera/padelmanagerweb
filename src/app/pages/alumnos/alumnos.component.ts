import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AlumnoService } from '../../services/alumno.service';
import { MysqlService } from '../../services/mysql.service';
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

  constructor(
    private alumnoService: AlumnoService,
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
    this.alumnoService.getAlumnos(this.userId).subscribe({
      next: (res) => {
        this.alumnos = res || [];
        // Map API fields to UI-friendly names (now fully aggregated by backend)
        this.alumnos = this.alumnos.map(a => ({
          ...a,
          sesiones_pagadas: Number(a.sesiones_pagadas),
          sesiones_reservadas: a.sesiones_reservadas,
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
}
