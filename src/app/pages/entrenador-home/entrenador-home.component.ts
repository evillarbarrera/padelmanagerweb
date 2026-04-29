import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PopupService } from '../../services/popup.service';
import { HardGateComponent } from '../../components/hard-gate/hard-gate.component';

@Component({
  selector: 'app-entrenador-home',
  standalone: true,
  imports: [CommonModule, SidebarComponent, HardGateComponent],
  templateUrl: './entrenador-home.component.html',
  styleUrls: ['./entrenador-home.component.scss']
})
export class EntrenadorHomeComponent implements OnInit {
  coachNombre = 'Entrenador';
  coachFoto: string | null = null;
  isLoading = true;
  userId: number | null = null;
  quickStats: any = {
    totalAlumnos: 0,
    clasesMes: 0,
    clasesGrupalesMes: 0,
    clasesHoy: 0
  };
  
  // Onboarding Logic
  showOnboarding = false;
  onboardingProgress = 0;
  steps = [
    { id: 1, label: 'Crear tu Pack', done: false, info: 'Define los servicios que ofrecerás (Individual, Grupal, etc.) y sus precios.', route: '/entrenador-packs', showInfo: false },
    { id: 2, label: 'Generar Disponibilidad', done: false, info: 'Configura tus horarios y bloques disponibles en el calendario.', route: '/disponibilidad-entrenador', showInfo: false },
    { id: 3, label: 'Registrar Perfil', done: false, info: 'Completa tu información personal y sube una foto profesional.', route: '/perfil', showInfo: false },
    { id: 4, label: 'Crear Alumno', done: false, info: 'Registra a tus alumnos actuales para llevar su control de packs.', route: '/alumnos', showInfo: false },
    { id: 5, label: 'Reservar Entrenamiento', done: false, info: 'Realiza tu primera reserva en el calendario para confirmar la agenda.', route: '/entrenador-agendar', showInfo: false }
  ];
  showMPReminder = false;
  hoyNombre = '';
  fechaHoyFormatted = '';

  // Finanzas Chart Data
  totalRecaudado: number = 0;
  ventasPorDia: any[] = [];
  maxVentaDia: number = 0;

  totalRecaudadoAnio: number = 0;
  ventasPorMes: any[] = [];
  maxVentaMes: number = 0;

  // Sales Details Modal
  showSalesModal = false;
  selectedSalesDetails: any[] = [];
  selectedSalesTotal: number = 0;
  selectedSalesPeriod: string = '';
  isLoadingSales = false;

  constructor(
    private mysqlService: MysqlService,
    private router: Router,
    private popupService: PopupService
  ) { }

  ngOnInit(): void {
    this.userId = Number(localStorage.getItem('userId'));
    const userRole = localStorage.getItem('userRole') || '';
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (user) {
      if (user.nombre) this.coachNombre = user.nombre;
      if (user.foto_perfil) this.coachFoto = user.foto_perfil;
    }

    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Redirección de seguridad
    const role = userRole.toLowerCase();
    if (role.includes('admin') || role.includes('administrador')) {
      this.router.navigate(['/admin-club']);
      return;
    } else if (role.includes('jugador') || role.includes('alumno')) {
      // Entrenador logic continues
    } else if (!role.includes('entrenador')) {
      this.router.navigate(['/jugador-home']);
      return;
    }

    this.loadData();
  }

  clasesHoyList: any[] = [];

  loadData(): void {
    if (!this.userId) return;

    this.setDates();
    let profileRes: any = null;
    let statsRes: any = null;
    let dashboardRes: any = null;

    const tryCheck = () => {
      if (profileRes && statsRes && dashboardRes) {
        this.isLoading = false;
        this.loadOnboardingStatus();
      }
    };

    // Load Profile
    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        profileRes = res;
        if (res.success) {
          this.coachNombre = res.user.nombre || 'Entrenador';
          this.coachFoto = res.user.foto_perfil || res.user.link_foto || null;

          const hideReminder = localStorage.getItem('hideMPReminder');
          if (!res.user.mp_collector_id && hideReminder !== 'true') {
            this.showMPReminder = true;
          } else {
            this.showMPReminder = false;
          }
        }
        tryCheck();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });

    // Load Agenda/Stats
    this.mysqlService.getEntrenadorStats(this.userId).subscribe({
      next: (res) => {
        statsRes = res;
        // ... navigation/agenda logic ...
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const formatDate = (date: Date) => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        const fechaHoy = formatDate(today);
        const fechaManana = formatDate(tomorrow);
        const diaSemanaHoy = today.getDay() === 0 ? 7 : today.getDay();
        const diaSemanaManana = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay();

        let clases = [];
        if (res.reservas_tradicionales) {
          const proximas = res.reservas_tradicionales.filter((r: any) => r.fecha === fechaHoy || r.fecha === fechaManana);
          clases.push(...proximas.map((r: any) => ({
            fecha: r.fecha,
            diaLabel: r.fecha === fechaHoy ? 'Hoy' : 'Mañana',
            hora: (r.hora_inicio || '08:00:00').substring(0, 5),
            tipo: r.tipo === 'pack_grupal' ? 'Grupal' : 'Individual',
            titulo: r.jugador_nombre || 'Clase Grupal',
            subtitulo: r.pack_nombre,
            estado: r.estado
          })));
        }

        if (res.packs_grupales) {
          const grupHoy = res.packs_grupales.filter((g: any) =>
            Number(g.dia_semana) === diaSemanaHoy &&
            !clases.some(c => c.fecha === fechaHoy && c.hora === (g.hora_inicio || '08:00:00').substring(0, 5))
          );
          const grupManana = res.packs_grupales.filter((g: any) =>
            Number(g.dia_semana) === diaSemanaManana &&
            !clases.some(c => c.fecha === fechaManana && c.hora === (g.hora_inicio || '08:00:00').substring(0, 5))
          );

          clases.push(...grupHoy.map((g: any) => ({
            fecha: fechaHoy,
            diaLabel: 'Hoy',
            hora: (g.hora_inicio || '08:00:00').substring(0, 5),
            tipo: 'Grupal',
            titulo: g.pack_nombre,
            subtitulo: `${g.inscritos_confirmados || 0} inscritos`,
            estado: 'activo'
          })));

          clases.push(...grupManana.map((g: any) => ({
            fecha: fechaManana,
            diaLabel: 'Mañana',
            hora: (g.hora_inicio || '08:00:00').substring(0, 5),
            tipo: 'Grupal',
            titulo: g.pack_nombre,
            subtitulo: `${g.inscritos_confirmados || 0} inscritos`,
            estado: 'activo'
          })));
        }

        clases.sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
          return a.hora.localeCompare(b.hora);
        });

        this.clasesHoyList = clases;
        tryCheck();
      },
      error: (err) => {
        console.error('Error loading agenda:', err);
        this.isLoading = false;
      }
    });

    this.mysqlService.getDashboardStats(this.userId).subscribe({
      next: (res) => {
        dashboardRes = res;
        this.quickStats = {
          totalAlumnos: res.total_alumnos || 0,
          clasesMes: res.clases_mes || 0,
          clasesGrupalesMes: res.clases_grupales_mes || 0,
          clasesHoy: res.clases_hoy || 0,
          clasesPendientes: res.clases_pendientes || 0,
          promoActiva: res.promo_activa || false,
          promoDiasRestantes: res.promo_dias_restantes || 0
        };
        tryCheck();
      },
      error: (err) => {
        console.error('Error dashboard stats:', err);
        this.isLoading = false;
      }
    });

    this.mysqlService.getFinanzas(this.userId).subscribe({
      next: (res: any) => {
        this.totalRecaudado = res.recaudado || 0;
        const dias = res.ventas_por_dia || [];
        if (dias.length > 0) {
          this.maxVentaDia = Math.max(...dias.map((d: any) => d.total));
          this.ventasPorDia = dias.map((d: any) => ({
            ...d,
            dayString: new Date(d.fecha + 'T00:00:00').getDate(),
            heightPercent: this.maxVentaDia > 0 ? (d.total / this.maxVentaDia) * 100 : 0
          }));
        }

        this.totalRecaudadoAnio = res.recaudado_anio || 0;
        const meses = res.ventas_por_mes || [];
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        if (meses.length > 0) {
          this.maxVentaMes = Math.max(...meses.map((m: any) => m.total));
          this.ventasPorMes = meses.map((m: any) => {
            const monthIdx = parseInt(m.mes.split('-')[1], 10) - 1;
            return {
              ...m,
              monthString: monthNames[monthIdx],
              heightPercent: this.maxVentaMes > 0 ? (m.total / this.maxVentaMes) * 100 : 0
            };
          });
        }
      }
    });
  }

  irAAlumnos(): void {
    this.router.navigate(['/alumnos']);
  }

  irACalendario(): void {
    this.router.navigate(['/entrenador-agendar']);
  }

  get onboardingDone(): boolean {
    return this.onboardingProgress === 100;
  }

  loadOnboardingStatus() {
    if (!this.userId) return;
    this.mysqlService.getOnboardingStatus(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          // Map API steps to local steps array
          res.steps.forEach((apiStep: any) => {
            const localStep = this.steps.find(s => s.id === apiStep.id);
            if (localStep) localStep.done = apiStep.done;
          });
          this.onboardingProgress = res.progress;
          this.showOnboarding = this.onboardingProgress < 100;
        }
      },
      error: (err) => console.error('Error validation onboarding:', err)
    });
  }

  isNextStep(step: any): boolean {
    const nextStep = this.steps.find(s => !s.done);
    return nextStep ? nextStep.id === step.id : false;
  }

  getStepStroke(id: number): string {
    const strokes: { [key: number]: string } = {
      1: 'EL SAQUE',
      2: 'VOLEA DE RED',
      3: 'LA EMPUÑADURA',
      4: 'LA BANDEJA',
      5: 'EL SMASH FINAL'
    };
    return strokes[id] || 'GOLPE';
  }

  toggleStepInfo(step: any, event: Event) {
    event.stopPropagation();
    step.showInfo = !step.showInfo;
  }

  irAPacks(): void {
    this.router.navigate(['/entrenador-packs']);
  }

  irADisponibilidad(): void {
    this.router.navigate(['/disponibilidad-entrenador']);
  }

  irACupones(): void {
    this.router.navigate(['/entrenador-cupones']);
  }

  irAPerfil(): void {
    this.router.navigate(['/perfil']);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }

  dismissMPReminder() {
    this.showMPReminder = false;
    localStorage.setItem('hideMPReminder', 'true');
  }

  setDates() {
    const options: any = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date();
    const formatted = new Intl.DateTimeFormat('es-CL', options).format(date);
    this.hoyNombre = formatted.split(' ')[0].replace(',', '');
    this.fechaHoyFormatted = formatted;
  }

  openSalesDetail(mes?: string, fecha?: string, title?: string) {
    if (!this.userId) return;

    this.selectedSalesPeriod = title || (fecha ? `Ventas del ${fecha}` : (mes ? `Ventas de ${mes}` : 'Detalle de Ventas'));
    this.showSalesModal = true;
    this.isLoadingSales = true;
    this.selectedSalesDetails = [];
    this.selectedSalesTotal = 0;

    this.mysqlService.getDetalleVentas(this.userId, mes, fecha).subscribe({
      next: (res) => {
        if (res.success) {
          this.selectedSalesDetails = res.ventas || [];
          this.selectedSalesTotal = res.total || 0;
        }
        this.isLoadingSales = false;
      },
      error: (err) => {
        console.error('Error loading sales details:', err);
        this.isLoadingSales = false;
      }
    });
  }

  closeSalesModal() {
    this.showSalesModal = false;
  }
}
