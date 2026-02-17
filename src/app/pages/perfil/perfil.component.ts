import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { ClubesService } from '../../services/clubes.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {

  profile: any = {
    nombre: '',
    usuario: '',
    rol: '',
    telefono: '',
    instagram: '',
    facebook: '',
    foto_perfil: '',
    categoria: '',
    descripcion: ''
  };

  userRole: 'jugador' | 'entrenador' | 'administrador_club' = 'jugador';

  openRoleRequest() {
    Swal.fire({
      title: 'Solicitar Nuevo Rol',
      text: '¿Qué rol te gustaría añadir a tu perfil?',
      input: 'radio',
      inputOptions: {
        'entrenador': '🎾 Entrenador',
        'administrador_club': '🏢 Administrador de Club'
      },
      showCancelButton: true,
      confirmButtonText: 'Enviar Solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0f172a'
    }).then((result) => {
      if (result.isConfirmed) {
        const role = result.value;
        if (!role) return;

        Swal.fire({
          icon: 'success',
          title: 'Solicitud Enviada',
          text: 'Un administrador revisará tu solicitud para ' + (role === 'entrenador' ? 'Entrenador' : 'Admin Club') + '.'
        });
      }
    });
  }

  direccion: any = {
    region: '',
    comuna: '',
    calle: '',
    numero_casa: '',
    referencia: '',
    latitud: null,
    longitud: null
  };

  // Tournament Filters
  filterRegion: string = '';
  filterComuna: string = '';
  filteredComunasFilter: string[] = [];
  availableTournaments: any[] = [];
  activeTab: string = 'profile'; // 'profile' | 'tournaments'

  regions = [
    { id: '13', name: 'Metropolitana de Santiago' },
    { id: '15', name: 'Arica y Parinacota' },
    { id: '1', name: 'Tarapacá' },
    { id: '2', name: 'Antofagasta' },
    { id: '3', name: 'Atacama' },
    { id: '4', name: 'Coquimbo' },
    { id: '5', name: 'Valparaíso' },
    { id: '6', name: 'O\'Higgins' },
    { id: '7', name: 'Maule' },
    { id: '16', name: 'Ñuble' },
    { id: '8', name: 'Biobío' },
    { id: '9', name: 'Araucanía' },
    { id: '14', name: 'Los Ríos' },
    { id: '10', name: 'Los Lagos' },
    { id: '11', name: 'Aysén' },
    { id: '12', name: 'Magallanes' }
  ];

  allComunas: any = {
    '13': ['Santiago', 'Las Condes', 'Providencia', 'Ñuñoa', 'Maipú', 'Puente Alto', 'La Florida', 'Vitacura', 'Lo Barnechea', 'Colina', 'Lampa', 'San Bernardo', 'Peñalolén'],
    '15': ['Arica', 'Camarones', 'Putre', 'General Lagos'],
    '1': ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Pica', 'Huara'],
    '2': ['Antofagasta', 'Calama', 'Mejillones', 'Taltal', 'Tocopilla'],
    '3': ['Copiapó', 'Vallenar', 'Caldera', 'Chañaral', 'Huasco'],
    '4': ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Vicuña', 'Salamanca'],
    '5': ['Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'Limache', 'Quillota', 'San Antonio', 'Los Andes', 'San Felipe'],
    '6': ['Rancagua', 'Machalí', 'Rengo', 'San Fernando', 'Pichilemu', 'Santa Cruz'],
    '7': ['Talca', 'Curicó', 'Linares', 'Constitución', 'Cauquenes', 'Parral'],
    '16': ['Chillán', 'Chillán Viejo', 'San Carlos', 'Bulnes', 'Yungay'],
    '8': ['Concepción', 'Talcahuano', 'San Pedro de la Paz', 'Chiguayante', 'Hualpén', 'Los Ángeles', 'Coronel', 'Lota', 'Tomé', 'Penco'],
    '9': ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Victoria', 'Lautaro'],
    '14': ['Valdivia', 'La Unión', 'Río Bueno', 'Panguipulli', 'Paillaco', 'Mariquina'],
    '10': ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro', 'Ancud', 'Quellón', 'Frutillar'],
    '11': ['Coyhaique', 'Puerto Aysén', 'Chile Chico', 'Cochrane'],
    '12': ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Cabo de Hornos']
  };

  filteredComunas: string[] = [];

  isLoading = false;
  userId: number | null = null;

  constructor(
    private mysqlService: MysqlService,
    private clubesService: ClubesService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    const storedRole = localStorage.getItem('userRole') as any;
    if (storedRole) {
      this.userRole = storedRole;
    }

    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();
  }

  loadProfile(): void {
    if (!this.userId) return;
    this.isLoading = true;

    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.profile = { ...this.profile, ...res.user };
          this.userRole = res.user.rol; // Update userRole based on fetched profile
          if (res.direccion) {
            this.direccion = { ...res.direccion };
            this.updateComunas(true);

            // Initialize filters for tournaments
            if (this.userRole === 'jugador') {
              this.filterRegion = this.direccion.region;
              this.updateFilterComunas(true);
              this.filterComuna = this.direccion.comuna;
              this.loadTournaments();
            }
          }
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading profile:', err);
        this.isLoading = false;
      }
    });
  }

  updateComunas(keepComuna = false): void {
    const selectedRegion = this.regions.find(r => r.name === this.direccion.region);
    if (selectedRegion) {
      this.filteredComunas = this.allComunas[selectedRegion.id] || [];
      if (!keepComuna) {
        this.direccion.comuna = '';
      }
    } else {
      this.filteredComunas = [];
    }
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.uploadPhoto(file);
    }
  }

  uploadPhoto(file: File): void {
    if (!this.userId) return;
    this.isLoading = true;

    this.mysqlService.subirFoto(this.userId, file).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          // Robust update of the local photo URL
          this.profile.foto_perfil = res.foto_url;
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error uploading photo:', err);
        this.popupService.error('Error', 'Hubo un problema al subir la foto.');
      }
    });
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.popupService.error('Error', 'Geolocalización no soportada');
      return;
    }

    this.isLoading = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.direccion.latitud = pos.coords.latitude;
        this.direccion.longitud = pos.coords.longitude;
        this.isLoading = false;
        this.popupService.success('Éxito', 'Ubicación detectada correctamente. No olvides guardar los cambios.');
      },
      (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudo obtener la ubicación. Verifica permisos.');
      }
    );
  }

  guardarCambios(): void {
    if (!this.userId) return;
    this.isLoading = true;

    const payload = {
      user_id: this.userId,
      nombre: this.profile.nombre,
      telefono: this.profile.telefono,
      instagram: this.profile.instagram,
      facebook: this.profile.facebook,
      foto_perfil: this.profile.foto_perfil, // Include the photo URL
      categoria: this.profile.categoria,
      descripcion: this.profile.descripcion,
      ...this.direccion
    };

    this.mysqlService.updatePerfil(this.userId, payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.popupService.success('¡Guardado!', 'Perfil actualizado correctamente');
        } else {
          this.popupService.warning('Atención', 'No se pudieron guardar los cambios');
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error updating profile:', err);
        this.popupService.error('Error', 'Error al actualizar el perfil');
      }
    });
  }

  irAInicio(): void {
    const role = this.userRole?.toLowerCase() || '';
    if (role.includes('administrador') || role.includes('admin')) {
      this.router.navigate(['/admin-club']);
    } else if (role.includes('entrenador')) {
      this.router.navigate(['/entrenador-home']);
    } else {
      this.router.navigate(['/jugador-home']);
    }
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irAPerfil(): void {
    // Already here
  }

  logout(): void {
    this.popupService.confirm('Cerrar Sesión', '¿Estás seguro de que deseas salir?').then(confirm => {
      if (confirm) {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  updateFilterComunas(keepComuna = false): void {
    const selectedRegion = this.regions.find(r => r.name === this.filterRegion);

    if (selectedRegion) {
      this.filteredComunasFilter = this.allComunas[selectedRegion.id] || [];
      if (!keepComuna) {
        this.filterComuna = '';
        this.loadTournaments();
      }
    } else {
      this.filteredComunasFilter = [];
      this.filterComuna = '';
      this.loadTournaments();
    }
  }

  onFilterRegionChange(): void {
    this.updateFilterComunas();
  }

  onFilterComunaChange(): void {
    this.loadTournaments();
  }

  loadTournaments(): void {
    this.clubesService.getTorneosPublicos(this.filterRegion, this.filterComuna).subscribe({
      next: (res) => {
        this.availableTournaments = res;
      },
      error: (err) => console.error(err)
    });
  }

}
