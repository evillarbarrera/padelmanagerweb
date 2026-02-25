import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MysqlService } from '../../services/mysql.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { PacksService } from '../../services/packs.service';
import { AlumnoService } from '../../services/alumno.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-jugador-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './jugador-reservas.component.html',
  styleUrls: ['./jugador-reservas.component.scss']
})
export class JugadorReservasComponent implements OnInit {
  isLoading = false;
  userId: number | null = null;

  // Data
  entrenadores: any[] = [];
  packs: any[] = [];
  jugadorFoto: string | null = null;
  jugadorNombre: string = '';

  // Booking Data
  selectedEntrenador: number | null = null;
  selectedPack: any = null; // New: Selected Pack
  packsDelEntrenador: any[] = []; // New: Packs for the selected trainer
  horariosPorDia: { [key: string]: any[] } = {};
  dias: string[] = [];
  diaSeleccionado: string = '';
  recurrencia: number = 1;
  showCoachPicker: boolean = false;

  // Discovery & Location
  isLoadingDiscovery = false;
  useLocation = false; // Changed to false by default as we use region/comuna now
  userLat: number | null = null;
  userLng: number | null = null;
  searchRadius = 50;

  // New: Region and Comuna Filtering
  regionSeleccionada: string = '';
  comunaSeleccionada: string = '';
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

  tipoEntrenamiento: 'todos' | 'individual' | 'multiplayer' | 'grupal' = 'todos';

  getSlotsByCategory(dia: string, category: 'morning' | 'afternoon' | 'evening'): any[] {
    // ... (omitting for brevity as requested by tool logic)
    const slots = this.horariosPorDia[dia] || [];
    return slots.filter(slot => {
      // 1. Filter by time category
      const hora = slot.hora_inicio.getHours();
      let matchTime = false;
      if (category === 'morning') matchTime = hora < 12;
      else if (category === 'afternoon') matchTime = hora >= 12 && hora < 18;
      else if (category === 'evening') matchTime = hora >= 18;
      if (!matchTime) return false;

      // 2. Filter by training type (Updated)
      // Individual and Multiplayer share the same "availability" blocks (non-group)
      const isGrupal = slot.tipo === 'grupal';

      if (this.tipoEntrenamiento === 'grupal') return isGrupal;
      if (this.tipoEntrenamiento === 'individual' || this.tipoEntrenamiento === 'multiplayer') return !isGrupal;

      // If "TODOS", show everything
      if (this.tipoEntrenamiento === 'todos') return true;

      return true;
    });
  }

  isPackMatch(pack: any, type: string): boolean {
    const cant = Number(pack.cantidad_personas || 1);
    const pTipo = pack.tipo?.toLowerCase() || 'individual';

    if (type === 'individual') return cant === 1 && pTipo !== 'grupal';
    if (type === 'multiplayer') return cant > 1 && pTipo !== 'grupal';
    if (type === 'grupal') return pTipo === 'grupal';
    return false;
  }

  constructor(
    private mysqlService: MysqlService,
    // ... (omitting for brevity)
    private entrenamientoService: EntrenamientoService,
    private packsService: PacksService,
    private alumnoService: AlumnoService,
    public router: Router,
    private route: ActivatedRoute,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    const storedUserId = localStorage.getItem('userId');
    this.userId = storedUserId ? Number(storedUserId) : null;

    this.loadUserProfile();
    // Prefer loading profile first to set default location
    this.checkQueryParams();
  }

  updateComunas(keepComuna = false): void {
    const selectedRegion = this.regions.find(r => r.name === this.regionSeleccionada);
    if (selectedRegion) {
      this.filteredComunas = this.allComunas[selectedRegion.id] || [];
      if (!keepComuna) {
        this.comunaSeleccionada = '';
      }
    } else {
      this.filteredComunas = [];
    }
    this.loadEntrenadores(); // Reload when region changes
  }

  onComunaChange(): void {
    this.loadEntrenadores(); // Reload when comuna changes
  }

  getCurrentLocation(): void {
    // We can still use geolocation to potentially find the comuna (simplified: no reverse geocoding here, just keeping standard lat/lng if needed)
    if (!navigator.geolocation) {
      this.loadEntrenadores();
      return;
    }
    this.isLoadingDiscovery = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        // As we don't have reverse geocoding easily, we still prioritize the selects but allow geolocation for Haversine
        this.loadEntrenadores();
      },
      (err) => {
        console.error('Location error', err);
        this.loadEntrenadores();
      }
    );
  }

  checkQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      // ... (omitting for brevity)
      if (params['status'] === 'success' && params['reserva'] === 'confirmed') {
        this.popupService.success(
          '¡Reserva confirmada!',
          'Tus próximas clases las puedes agendar aquí mismo usando tus créditos del pack. No se te cobrará nada adicional hasta que agotes todas tus clases disponibles.'
        ).then(() => {
          // Limpiar parámetros para no repetir el mensaje al recargar
          this.router.navigate([], { relativeTo: this.route, queryParams: {} });
        });
      }
    });
  }

  loadUserProfile(): void {
    if (!this.userId) {
      this.loadEntrenadores();
      return;
    }
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.jugadorNombre = res.user.nombre;
          this.jugadorFoto = res.user.foto_perfil || res.user.foto || null;

          // Set default filters from user profile
          if (res.direccion) {
            this.regionSeleccionada = res.direccion.region || '';
            const selectedRegionObj = this.regions.find(r => r.name === this.regionSeleccionada);
            if (selectedRegionObj) {
              this.filteredComunas = this.allComunas[selectedRegionObj.id] || [];
              this.comunaSeleccionada = res.direccion.comuna || '';
            }
          }
        }
        this.loadEntrenadores();
      },
      error: (err: any) => {
        console.error('Error loading profile:', err);
        this.loadEntrenadores();
      }
    });
  }

  // --- Logic for "Agendar Nueva" (Booking Only) ---

  loadEntrenadores(): void {
    this.isLoadingDiscovery = true;

    // If region/comuna are selected, we might want to ignore the radius filter
    const radiusParam = (this.regionSeleccionada || this.comunaSeleccionada) ? undefined : this.searchRadius;

    this.packsService.getAllPacks(
      this.userLat || undefined,
      this.userLng || undefined,
      radiusParam,
      this.regionSeleccionada || undefined,
      this.comunaSeleccionada || undefined
    ).subscribe({
      next: (res: any[]) => {
        const map = new Map();
        res.forEach(p => {
          if (p.entrenador_id && !map.has(p.entrenador_id)) {
            map.set(p.entrenador_id, {
              id: p.entrenador_id,
              nombre: p.entrenador_nombre,
              foto: p.entrenador_foto,
              descripcion: p.entrenador_descripcion,
              distancia: p.distancia,
              comuna: p.trainer_comuna
            });
          }
        });
        this.entrenadores = Array.from(map.values()).sort((a, b) => (a.distancia || 999) - (b.distancia || 999));

        if (this.userId) {
          this.entrenamientoService.getEntrenadorPorJugador(this.userId).subscribe({
            next: (resPacks: any[]) => {
              this.packs = resPacks || [];
            }
          });
        }
        this.isLoadingDiscovery = false;
      },
      error: (err: any) => {
        console.error('Error loading trainers:', err);
        this.isLoadingDiscovery = false;
      }
    });
  }

  extraerEntrenadores(): void {
    const map = new Map();
    if (this.packs) {
      this.packs.forEach(p => {
        if (!map.has(p.entrenador_id)) {
          map.set(p.entrenador_id, {
            id: p.entrenador_id,
            nombre: p.entrenador_nombre,
            foto: p.entrenador_foto || p.foto || null // Try to find photo in response
          });
        }
      });
    }
    this.entrenadores = Array.from(map.values());
  }

  get currentCoachPhoto(): string | null {
    if (!this.selectedEntrenador) return null;
    return this.entrenadores.find(e => e.id == this.selectedEntrenador)?.foto || null;
  }

  totalTrainerPacks: any[] = [];

  onEntrenadorChange(): void {
    if (!this.selectedEntrenador) return;

    this.isLoading = true;

    // 1. Load availability (flexible slots)
    this.entrenamientoService.getDisponibilidadEntrenador(this.selectedEntrenador!).subscribe({
      next: (availabilityRes: any) => {
        // 2. Load all packs to extract recurring group sessions
        this.mysqlService.getAllPacks(this.selectedEntrenador!).subscribe({
          next: (packsRes: any) => {
            this.totalTrainerPacks = packsRes || [];
            this.generarVistaSemanal(availabilityRes, this.totalTrainerPacks);
            this.isLoading = false;
          },
          error: (err: any) => {
            console.error('Error loading coach packs:', err);
            this.generarVistaSemanal(availabilityRes, []);
            this.isLoading = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading availability:', err);
        this.isLoading = false;
      }
    });

    // Cargar packs del usuario para este entrenador (para cobro/créditos)
    this.packsDelEntrenador = this.packs.filter(p =>
      Number(p.entrenador_id) === Number(this.selectedEntrenador) &&
      Number(p.sesiones_restantes) > 0
    );
  }

  get filteredDias(): string[] {
    if (this.tipoEntrenamiento === 'todos' || this.dias.length === 0) return this.dias;

    return this.dias.filter(dia => {
      const slots = this.horariosPorDia[dia] || [];
      return slots.some(slot => {
        const isGrupal = slot.tipo === 'grupal';
        if (this.tipoEntrenamiento === 'grupal') return isGrupal;
        // individual and multiplayer share same slots (not group)
        return !isGrupal;
      });
    });
  }

  setFilter(tipo: any): void {
    this.tipoEntrenamiento = tipo;
    const currentFiltered = this.filteredDias;
    // If current selected day is not in the new filtered list, jump to first available
    if (this.diaSeleccionado && !currentFiltered.includes(this.diaSeleccionado)) {
      if (currentFiltered.length > 0) {
        this.diaSeleccionado = currentFiltered[0];
      }
    }
  }

  generarVistaSemanal(disponibilidades: any[], packsList: any[] = []): void {
    const slotsMap = new Map<string, any>();
    this.horariosPorDia = {};
    const nuevasFechas: string[] = [];
    const ahora = new Date();
    const limite = new Date();
    limite.setDate(ahora.getDate() + 14);

    // 1. Process explicit availability from the 'disponibilidad' table
    disponibilidades.forEach(d => {
      const isBlockOcupado = d.ocupado == 1 || d.ocupado === '1' || d.ocupado === true || d.ocupado === 'true';
      const isGrupal = d.tipo === 'grupal';

      if (isGrupal) {
        const bloqueInicio = new Date(d.fecha_inicio);
        const bloqueFin = new Date(d.fecha_fin);
        if (bloqueInicio >= ahora && bloqueFin <= limite) {
          const fechaStr = `${bloqueInicio.getFullYear()}-${(bloqueInicio.getMonth() + 1).toString().padStart(2, '0')}-${bloqueInicio.getDate().toString().padStart(2, '0')}`;
          const horaStr = bloqueInicio.toTimeString().slice(0, 5);
          const timeKey = `${fechaStr}_${horaStr}`;

          slotsMap.set(timeKey, {
            fecha: fechaStr,
            hora_inicio: bloqueInicio,
            hora_fin: bloqueFin,
            ocupado: isBlockOcupado,
            inscritos: Number(d.inscritos_count || 0),
            capacidad: Number(d.cantidad_personas || 6),
            tipo: 'grupal',
            pack_id: d.pack_id,
            nombre: d.nombre_pack || 'Clase Grupal'
          });
          if (!nuevasFechas.includes(fechaStr)) nuevasFechas.push(fechaStr);
        }
      } else {
        let inicio = new Date(d.fecha_inicio);
        const fin = new Date(d.fecha_fin);
        while (inicio < fin) {
          const bloqueInicio = new Date(inicio.getTime());
          const bloqueFin = new Date(inicio.getTime());
          bloqueFin.setHours(bloqueFin.getHours() + 1);

          if (bloqueInicio >= ahora && bloqueFin <= limite) {
            const fechaStr = `${bloqueInicio.getFullYear()}-${(bloqueInicio.getMonth() + 1).toString().padStart(2, '0')}-${bloqueInicio.getDate().toString().padStart(2, '0')}`;
            const horaStr = bloqueInicio.toTimeString().slice(0, 5);
            const timeKey = `${fechaStr}_${horaStr}`;

            const existing = slotsMap.get(timeKey);
            // Don't overwrite an existing 'grupal' slot with 'individual'
            if (!existing || (existing.tipo !== 'grupal' && (isBlockOcupado || !existing.ocupado))) {
              slotsMap.set(timeKey, {
                fecha: fechaStr,
                hora_inicio: bloqueInicio,
                hora_fin: bloqueFin,
                ocupado: existing ? (existing.ocupado || isBlockOcupado) : isBlockOcupado,
                cantidad_personas: Number(d.cantidad_personas || 1),
                tipo: 'individual'
              });
            }
            if (!nuevasFechas.includes(fechaStr)) nuevasFechas.push(fechaStr);
          }
          inicio.setHours(inicio.getHours() + 1);
        }
      }
    });

    // 2. Project recurring group classes from the 'packs' table
    packsList.forEach(p => {
      if (p.tipo === 'grupal' && p.dia_semana && p.hora_inicio) {
        // Map dia_semana: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7/0=Sun
        const packDay = Number(p.dia_semana);
        const [h, m] = p.hora_inicio.split(':');
        const duration = Number(p.duracion_sesion_min || 60);

        // Scan the next 14 days
        for (let i = 0; i <= 14; i++) {
          const checkDate = new Date();
          checkDate.setDate(ahora.getDate() + i);

          let jsDay = checkDate.getDay(); // 0=Sun, 1=Mon...
          // If the DB uses 0=Sun... 6=Sat, then jsDay is already correct.
          // However, if the code previously had (jsDay === 0) jsDay = 7, it means it expected 1-7.
          // Let's make it robust: try both if needed, but normally checkDate.getDay() is 0-6.

          if (jsDay === packDay || (jsDay === 0 && packDay === 7)) {
            const start = new Date(checkDate.getTime());
            start.setHours(Number(h), Number(m), 0, 0);

            const end = new Date(start.getTime());
            end.setMinutes(start.getMinutes() + duration);

            if (start >= ahora) {
              const fechaStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`;
              const horaStr = start.toTimeString().slice(0, 5);
              const timeKey = `${fechaStr}_${horaStr}`;

              // Don't overwrite if there's already a group session (explicit or recurring) for this time
              if (!slotsMap.has(timeKey) || slotsMap.get(timeKey).tipo !== 'grupal') {
                slotsMap.set(timeKey, {
                  fecha: fechaStr,
                  hora_inicio: start,
                  hora_fin: end,
                  ocupado: Number(p.cupos_ocupados) >= Number(p.capacidad_maxima),
                  inscritos: Number(p.cupos_ocupados || 0),
                  capacidad: Number(p.capacidad_maxima || 8),
                  cantidad_personas: Number(p.capacidad_maxima || 8),
                  tipo: 'grupal',
                  nombre: p.nombre,
                  categoria: p.categoria,
                  pack_id: p.id // This is crucial for reservation logic
                });
                if (!nuevasFechas.includes(fechaStr)) nuevasFechas.push(fechaStr);
              }
            }
          }
        }
      }
    });

    // Reconstruct grouped object and clean up overlaps
    const sortedSlots = Array.from(slotsMap.values()).sort((a, b) => a.hora_inicio.getTime() - b.hora_inicio.getTime());
    const finalSlotsMap = new Map<string, any>();

    sortedSlots.forEach(slot => {
      const timeKey = `${slot.fecha}_${slot.hora_inicio.toTimeString().slice(0, 5)}`;

      // If this time is already covered by a previous class's duration, skip it
      let isCovered = false;
      finalSlotsMap.forEach(existing => {
        if (existing.fecha === slot.fecha && slot.hora_inicio >= existing.hora_inicio && slot.hora_inicio < existing.hora_fin) {
          isCovered = true;
        }
      });

      if (!isCovered) {
        finalSlotsMap.set(timeKey, slot);
      }
    });

    finalSlotsMap.forEach(slot => {
      if (!this.horariosPorDia[slot.fecha]) this.horariosPorDia[slot.fecha] = [];
      this.horariosPorDia[slot.fecha].push(slot);
    });

    this.dias = nuevasFechas.sort();

    // Sort slots by time within each day
    Object.keys(this.horariosPorDia).forEach(dia => {
      this.horariosPorDia[dia].sort((a: any, b: any) => a.hora_inicio.getTime() - b.hora_inicio.getTime());
    });

    if (this.dias.length > 0) {
      if (!this.diaSeleccionado || !this.dias.includes(this.diaSeleccionado)) {
        this.diaSeleccionado = this.dias[0];
      }
    } else {
      this.diaSeleccionado = '';
    }
  }

  onPackChange(): void {
    if (!this.selectedPack || !this.selectedEntrenador) return;

    const packId = this.selectedPack.pack_id;
    console.log("Cambio de Pack - Nuevo ID:", packId);

    this.entrenamientoService.getDisponibilidadEntrenador(this.selectedEntrenador!, packId).subscribe({
      next: (res: any) => {
        this.generarVistaSemanal(res);
      },
      error: (err: any) => console.error('Error loading availability after pack change:', err)
    });
  }



  reservarHorario(horario: any): void {
    if (horario.ocupado) return;

    if (!this.userId) {
      this.popupService.confirm('Iniciar Sesión', 'Debes iniciar sesión para realizar una reserva. ¿Deseas ir al login?')
        .then(conf => { if (conf) this.router.navigate(['/login']); });
      return;
    }

    const msgRecurrencia = this.recurrencia > 1 ? ` por ${this.recurrencia} semanas` : '';

    // Determine target type based on filter or slot
    let targetType = this.tipoEntrenamiento;
    if (targetType === 'todos') {
      targetType = horario.tipo === 'grupal' ? 'grupal' : 'individual';
    }

    // Verificar si el usuario ya tiene un pack activo que coincida con el tipo
    const packActivo = this.packs.find(p => {
      const basicMatch = Number(p.entrenador_id) === Number(this.selectedEntrenador) &&
        Number(p.sesiones_restantes) > 0 &&
        this.isPackMatch(p, targetType);

      // If it's a group slot, it MUST match the specific group pack ID
      if (horario.tipo === 'grupal' && horario.pack_id) {
        return basicMatch && Number(p.pack_id) === Number(horario.pack_id);
      }

      return basicMatch;
    });

    if (packActivo) {
      this.popupService.confirm(
        '¿Confirmar Reserva?',
        `Clase para el ${horario.fecha} a las ${horario.hora_inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${msgRecurrencia}. Se descontará 1 crédito de tu pack.`
      ).then((confirmed) => {
        if (confirmed) {
          const payload = {
            entrenador_id: this.selectedEntrenador,
            pack_id: packActivo.pack_id,
            pack_jugador_id: packActivo.pack_jugador_id,
            fecha: horario.fecha,
            hora_inicio: horario.hora_inicio.toTimeString().slice(0, 5),
            hora_fin: horario.hora_fin.toTimeString().slice(0, 5),
            jugador_id: this.userId,
            estado: 'reservado',
            recurrencia: this.recurrencia,
            tipo: targetType,
            cantidad_personas: 1 // Joining as 1 person
          };

          this.entrenamientoService.crearReserva(payload).subscribe({
            next: () => {
              this.popupService.success('¡Reservado!', 'Tu clase ha sido agendada con éxito.').then(() => {
                this.router.navigate(['/jugador-calendario']);
              });
              this.onEntrenadorChange();
            },
            error: (err: any) => {
              console.error('Error creating reservation:', err);
              const errorMsg = err.error?.error || 'Hubo un problema al crear la reserva.';
              this.popupService.error('Error', errorMsg);
            }
          });
        }
      });
    } else {
      // NO TIENE PACK: Mostrar packs disponibles para comprar
      this.mostrarPacksDisponibles(horario);
    }
  }

  showPackModal = false;
  availablePacks: any[] = [];
  pendingHorario: any = null;

  mostrarPacksDisponibles(horario: any): void {
    console.log('DEBUG: Mostrando packs para horario:', horario);
    this.pendingHorario = horario;
    this.isLoading = true;

    // Determine filtering type for the purchase modal
    let targetType = this.tipoEntrenamiento;
    if (targetType === 'todos') {
      targetType = horario.tipo === 'grupal' ? 'grupal' : 'individual';
    }

    this.mysqlService.getAllPacks(this.selectedEntrenador!).subscribe({
      next: (res) => {
        console.log('DEBUG: Todos los packs del entrenador:', res);
        // If it's a specific group slot, we should ideally only show THAT pack
        if (horario.tipo === 'grupal' && horario.pack_id) {
          this.availablePacks = res.filter(p => Number(p.id || p.id_pack || p.pack_id) === Number(horario.pack_id));
          console.log('DEBUG: Packs filtrados por horario.pack_id:', this.availablePacks);
        } else {
          // Otherwise filter by type (Individual/Multi)
          this.availablePacks = res.filter(p => this.isPackMatch(p, targetType))
            .sort((a, b) => Number(a.precio) - Number(b.precio));
          console.log('DEBUG: Packs filtrados por tipo:', this.availablePacks);
        }

        this.showPackModal = true;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading available packs:', err);
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudieron cargar los packs del entrenador.');
      }
    });
  }

  comprarPackYReservar(pack: any): void {
    console.log('ComprarPackYReservar - Pack seleccionado:', pack);
    console.log('ComprarPackYReservar - Horario pendiente:', this.pendingHorario);

    this.showPackModal = false;

    // Search for ID in all possible fields (id, pack_id, id_pack)
    const rawId = pack.id || pack.pack_id || pack.id_pack;
    const packId = Number(rawId);

    if (isNaN(packId) || packId <= 0) {
      this.popupService.error('Error de Datos', 'El pack seleccionado no tiene un ID válido. Por favor, intenta de nuevo.');
      return;
    }

    this.isLoading = true;

    // 1. Primero registramos la "compra" del pack
    const packPayload = {
      pack_id: packId,
      jugador_id: Number(this.userId)
    };

    console.log('Registrando compra del pack...', packPayload);

    this.alumnoService.insertPack(packPayload).subscribe({
      next: (packRes: any) => {
        const newPackJugadorId = packRes.pack_jugador_id;
        console.log('Pack registrado con ID:', newPackJugadorId);

        // Detectar tipo real del pack para la reserva
        let finalTipo = 'individual';
        const packTypeStr = (pack.tipo || '').toLowerCase();
        if (packTypeStr.includes('grupal') || packTypeStr.includes('multi')) {
          finalTipo = 'grupal';
        }

        const payload = {
          entrenador_id: Number(this.selectedEntrenador),
          fecha: this.pendingHorario.fecha,
          hora_inicio: this.pendingHorario.hora_inicio.toTimeString().slice(0, 5),
          hora_fin: this.pendingHorario.hora_fin.toTimeString().slice(0, 5),
          jugador_id: Number(this.userId),
          pack_id: packId,
          pack_jugador_id: newPackJugadorId,
          estado: 'reservado',
          tipo: finalTipo,
          cantidad_personas: 1,
          recurrencia: 1
        };

        console.log('Enviando reserva vinculada al nuevo pack:', payload);

        this.entrenamientoService.crearReserva(payload).subscribe({
          next: () => {
            this.isLoading = false;
            this.popupService.success('¡Listo!', 'Pack activado y clase agendada correctamente.').then(() => {
              this.router.navigate(['/jugador-calendario']);
            });
          },
          error: (err) => {
            console.error('Error al agendar reserva:', err);
            this.isLoading = false;
            this.popupService.error('Error en Agenda', 'El pack se activó pero no pudimos agendar la clase. Por favor, intenta agendarla manualmente desde el calendario.');
          }
        });
      },
      error: (err) => {
        console.error('Error al registrar pack:', err);
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudo procesar la compra del pack. Por favor, intenta de nuevo.');
      }
    });
  }

  // Helpers
  getCoachName(id: number | null): string {
    if (!id) return '';
    return this.entrenadores.find(e => e.id === id)?.nombre || '';
  }



  // Sidebar Navigation
  irAInicio(): void { this.router.navigate(['/jugador-home']); }
  irACalendario(): void { this.router.navigate(['/jugador-calendario']); }
  irAReservas(): void { } // Self
  irAPerfil(): void { this.router.navigate(['/perfil']); }
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }
}
