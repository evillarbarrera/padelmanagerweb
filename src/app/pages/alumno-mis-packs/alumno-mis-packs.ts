import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AlumnoService } from '../../services/alumno.service';
import { MysqlService } from '../../services/mysql.service';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-alumno-mis-packs',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './alumno-mis-packs.html',
  styleUrls: ['./alumno-mis-packs.css']
})
export class AlumnoMisPacks implements OnInit {
  userId: number | null = null;
  jugadorNombre: string = 'Jugador';
  jugadorFoto: string | null = null;

  packs: any[] = [];
  isLoading = true;

  // Modal Invitation
  showModalInvitacion = false;
  selectedPack: any = null;
  emailInvitado: string = '';

  constructor(
    private alumnoService: AlumnoService,
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit() {
    this.userId = Number(localStorage.getItem('userId'));
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();
    this.loadPacks();
  }

  loadProfile() {
    if (!this.userId) return;
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.jugadorNombre = res.user.nombre;
          this.jugadorFoto = res.user.foto_perfil || res.user.foto;
        }
      }
    });
  }

  loadPacks() {
    if (!this.userId) return;
    this.isLoading = true;
    this.alumnoService.getMisPacks(this.userId).subscribe({
      next: (res: any) => {
        this.packs = res.data || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Error cargando packs", err);
        this.isLoading = false;
      }
    });
  }

  irAComprar() {
    this.router.navigate(['/jugador-packs']);
  }

  // --- Invitation Logic ---

  abrirModalInvitacion(pack: any) {
    this.selectedPack = pack;
    this.emailInvitado = '';
    this.showModalInvitacion = true;
  }

  cerrarModal() {
    this.showModalInvitacion = false;
    this.selectedPack = null;
  }

  enviarInvitacion() {
    if (!this.emailInvitado || !this.emailInvitado.includes('@')) {
      this.popupService.warning('Error', 'Ingresa un email válido');
      return;
    }

    if (!this.selectedPack) return;

    // Loading indicator using popup
    this.popupService.info('Enviando...', 'Espera un momento mientras procesamos la invitación.');

    this.alumnoService.invitarJugador(this.selectedPack.pack_jugador_id, this.emailInvitado).subscribe({
      next: (res: any) => {
        this.popupService.success('¡Listo!', res.message || 'Jugador agregado al equipo.');
        this.cerrarModal();
        this.loadPacks();
      },
      error: (err: any) => {
        console.error(err);
        this.popupService.error('Error', err.error?.error || 'No se pudo invitar al jugador.');
      }
    });
  }
}
