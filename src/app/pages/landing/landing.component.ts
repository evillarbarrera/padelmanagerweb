import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MysqlService } from '../../services/mysql.service';
import { AuthService } from '../../services/auth.service';
import { EntrenamientoService } from '../../services/entrenamientos.service';
import { CurrencyService } from '../../services/currency.service';
import { Chart, registerables } from 'chart.js';
import { Title, Meta } from '@angular/platform-browser';

Chart.register(...registerables);

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  isAuthenticated = false;
  userRole: 'jugador' | 'entrenador' | 'administrador_club' | null = null;
  userName = '';
  userId: number | null = null;
  isLoading = true;

  // Currency Detection
  isInternational = false;
  currencySymbol = '$';
  currencyCode = 'CLP';

  // Plans Data
  plans = [
    { 
        name: 'EMPRENDEDOR', 
        clp: 0, 
        usd: 0, 
        period: '/mes', 
        sessions: 'Gestión de Alumnos', 
        fee: 'Calendario Básico', 
        promo: '90 Días 0% Comisión',
        btnText: 'EMPEZAR GRATIS'
    },
    { 
        name: 'INICIAL 20', 
        clp: 19990, 
        usd: 21, 
        period: '/mes', 
        sessions: 'Hasta 20 Alumnos', 
        fee: 'IA & Pizarra Táctica', 
        promo: '3 Meses GRATIS', 
        featured: true, 
        badge: 'PARA EMPEZAR',
        btnText: 'PRUEBA GRATUITA'
    },
    { 
        name: 'PRO 40', 
        clp: 29990, 
        usd: 32, 
        period: '/mes', 
        sessions: 'Hasta 40 Alumnos', 
        fee: 'Gestión Completa', 
        promo: '3 Meses GRATIS', 
        featured: true, 
        badge: 'MÁS POPULAR',
        btnText: 'PRUEBA GRATUITA'
    },
    { 
        name: 'ELITE ILIMITADO', 
        clp: 49990, 
        usd: 53, 
        period: '/mes', 
        sessions: 'Alumnos Ilimitados', 
        fee: 'Asistencia VIP', 
        promo: '3 Meses GRATIS',
        btnText: 'COMIENZA AHORA'
    }
  ];

  // Mock data for trainers
  trainers = [
    {
      nombre: 'Carlos Ruiz',
      especialidad: 'Técnica Avanzada y Estrategia',
      curriculum: 'Ex-jugador profesional con más de 10 años de experiencia en alta competición. Especialista en corrección biomécánica.',
      foto: 'assets/images/trainer-carlos.png'
    },
    {
      nombre: 'Elena Martínez',
      especialidad: 'Iniciación y Menores',
      curriculum: 'Certificada por la Federación Internacional de Pádel. Experta en pedagogía deportiva y desarrollo de talentos jóvenes.',
      foto: 'assets/images/trainer-elena.png'
    },
    {
      nombre: 'Miguel Ángel Sos',
      especialidad: 'Preparación Física y Táctica',
      curriculum: 'Licenciado en Ciencias del Deporte. Diseña programas personalizados que combinan potencia física con inteligencia en pista.',
      foto: 'assets/images/trainer-miguel.png'
    }
  ];

  // Datos para jugador
  alumnoStats = {
    pagadas: 0,
    reservadas: 0,
    disponibles: 0,
    proxima_clase: null as any
  };

  // Slider logic
  currentSlide = 0;
  slides = [
    {
      badge: 'GESTIÓN TOTAL',
      title: 'SOFTWARE DE ADMIN',
      highlight: 'PARA TU ACADEMIA',
      description: 'Lleva el control absoluto de tu negocio de pádel. Gestión de alumnos, pagos automatizados y agenda inteligente en un solo panel profesional.',
      image: 'assets/images/app-screenshot-v2.png'
    },
    {
      badge: 'AUTOMATIZACIÓN ⚡',
      title: 'CONTROLA TUS CLASES',
      highlight: 'REDUCE LA CARGA ADMIN',
      description: 'Optimiza tu tiempo como entrenador. Seguimiento de packs, asistencias y pagos automáticos para que te enfoques solo en enseñar en pista.',
      image: 'assets/images/slide-coaches.jpg'
    },
    {
      badge: 'MÉTRICAS DE NEGOCIO',
      title: 'POTENCIA TU CLUB',
      highlight: 'CON DATOS REALES',
      description: 'Visualiza la rentabilidad de tus pistas y el progreso de tus alumnos. La herramienta de administración de pádel más completa del mercado.',
      image: 'assets/images/slide-players.jpg'
    }
  ];

  entrenadorStats = {
    alumnos_totales: 0,
    clases_hoy: 0,
    packs_activos: 0,
    proximos_entrenamientos: [] as any[]
  };

  private slideInterval: any;

  faqs = [
    {
      q: '¿Cómo funcionan los 90 días gratis?',
      a: 'Al registrarte como entrenador, obtienes acceso total a la plataforma sin costo por 3 meses. No requerimos tarjeta de crédito para empezar.',
      open: false
    },
    {
      q: '¿Puedo gestionar múltiples sedes o clubes?',
      a: 'Sí, el plan ELITE está diseñado para administradores de clubes que necesitan gestionar múltiples pistas, profesores y calendarios centralizados.',
      open: false
    },
    {
      q: '¿Qué incluye el análisis por IA?',
      a: 'Nuestra tecnología analiza la biomecánica de tus golpes base (Saque, Drive, Revés) mediante clips de video, entregando correcciones técnicas automáticas.',
      open: false
    },
    {
      q: '¿La app es compatible con iOS y Android?',
      a: 'Absolutamente. PadelManager está optimizada como una PWA (Progressive Web App) y pronto disponible en tiendas oficiales.',
      open: false
    }
  ];

  constructor(
    private router: Router,
    private mysqlService: MysqlService,
    private authService: AuthService,
    private entrenamientoService: EntrenamientoService,
    private currencyService: CurrencyService,
    private titleService: Title,
    private metaService: Meta
  ) { }

  ngOnInit(): void {
    this.setSeoTags();
    this.detectCurrency();
    this.userId = Number(localStorage.getItem('userId'));
    const userRole = localStorage.getItem('userRole');

    if (!this.userId || !userRole) {
      this.isAuthenticated = false;
      this.isLoading = false;
      return;
    }

    this.isAuthenticated = true;
    this.userRole = userRole as any;
    this.cargarDatos();
  }

  setSeoTags(): void {
    this.titleService.setTitle('PadelManager | Software de Gestión para Academias de Pádel');
    this.metaService.addTags([
      { name: 'description', content: 'La plataforma líder para entrenadores y clubes de pádel. Gestión de alumnos, pagos, agenda inteligente y análisis por IA. Prueba 90 días gratis.' },
      { name: 'keywords', content: 'software padel, gestion academias padel, app entrenadores padel, reservas pistas padel, clases padel' },
      { property: 'og:title', content: 'PadelManager | Eleva tu Academia al Siguiente Nivel' },
      { property: 'og:description', content: 'Digitaliza tu academia de pádel con el software más potente del mercado.' },
      { property: 'og:image', content: 'assets/images/app-screenshot-v2.png' }
    ]);
  }

  toggleFaq(index: number) {
    this.faqs[index].open = !this.faqs[index].open;
  }

  detectCurrency(): void {
    this.currencyService.detectLocation().subscribe((country: string) => {
      this.isInternational = country !== 'CL';
      this.currencySymbol = this.isInternational ? 'USD $' : '$';
      this.currencyCode = this.isInternational ? 'USD' : 'CLP';
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initLandingCharts();
      this.initScrollAnimations();
      this.startSlider();
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  startSlider(): void {
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 6000);
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  setSlide(index: number): void {
    this.currentSlide = index;
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.startSlider();
    }
  }

  initScrollAnimations(): void {
    const observerOptions = {
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));
  }

  initLandingCharts(): void {
    const radarCtx = document.getElementById('landingRadarChart') as HTMLCanvasElement;
    if (radarCtx) {
      new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: ['Técnica', 'Control', 'Decisión', 'Saque', 'Volea', 'Fisico'],
          datasets: [{
            label: 'Tu Potencial',
            data: [8, 9, 7, 8, 8, 9],
            backgroundColor: 'rgba(204, 255, 0, 0.2)',
            borderColor: '#ccff00',
            pointBackgroundColor: '#111',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              suggestedMin: 0,
              suggestedMax: 10,
              grid: { color: 'rgba(255,255,255,0.1)' },
              angleLines: { color: 'rgba(255,255,255,0.1)' },
              pointLabels: {
                color: '#fff',
                font: {
                  size: window.innerWidth < 768 ? 10 : 12,
                  weight: 'bold'
                }
              }
            }
          }
        }
      });
    }

    const lineCtx = document.getElementById('landingLineChart') as HTMLCanvasElement;
    if (lineCtx) {
      new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: ['Clase 1', 'Clase 2', 'Clase 3', 'Clase 4', 'Clase 5'],
          datasets: [{
            label: 'Evolución',
            data: [4, 5, 6.5, 7.8, 9.2],
            borderColor: '#ccff00',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(204, 255, 0, 0.1)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { display: false },
            x: {
              grid: { display: false },
              ticks: {
                color: 'rgba(255,255,255,0.5)',
                font: { size: window.innerWidth < 768 ? 9 : 11 }
              }
            }
          }
        }
      });
    }
  }

  cargarDatos(): void {
    if (!this.userId) return;

    this.mysqlService.getPerfil(this.userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.userName = res.user.nombre || 'Usuario';
        }
      },
      error: (err) => console.error('Error cargando perfil:', err)
    });

    if (this.userRole === 'jugador') {
      this.cargarDatosAlumno();
    } else {
      this.cargarDatosEntrenador();
    }
  }

  cargarDatosAlumno(): void {
    if (!this.userId) return;
    this.mysqlService.getHomeStats(this.userId).subscribe({
      next: (res) => {
        let packs = res?.estadisticas?.packs || res?.packs || res;
        if (packs) {
          this.alumnoStats.pagadas = parseInt(packs.pagadas || packs.pagada) || 0;
          this.alumnoStats.reservadas = parseInt(packs.reservadas || packs.reservada) || 0;
          this.alumnoStats.disponibles = parseInt(packs.disponibles || packs.disponible) || 0;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando estadísticas:', err);
        this.isLoading = false;
      }
    });
  }

  cargarDatosEntrenador(): void {
    if (!this.userId) return;
    this.entrenamientoService.getAgenda(this.userId).subscribe({
      next: (res: any) => {
        if (res && Array.isArray(res)) {
          this.entrenadorStats.proximos_entrenamientos = res.slice(0, 5);
          this.entrenadorStats.clases_hoy = res.filter((e: any) => {
            const today = new Date().toDateString();
            return new Date(e.fecha).toDateString() === today;
          }).length;
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error cargando agenda:', err);
        this.isLoading = false;
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }

  irAHome(): void {
    const role = (this.userRole as string)?.toLowerCase() || '';
    if (role.includes('administrador') || role.includes('admin')) {
      this.router.navigate(['/admin-dashboard']);
    } else if (role.includes('entrenador')) {
      this.router.navigate(['/entrenador-home']);
    } else {
      this.router.navigate(['/jugador-home']);
    }
  }

  irAReservas(): void {
    this.router.navigate(['/jugador-reservas']);
  }

  irACalendario(): void {
    this.router.navigate(['/jugador-calendario']);
  }

  irAAgenda(): void {
    this.router.navigate(['/entrenador-agenda']);
  }

  irAAlumnos(): void {
    this.router.navigate(['/alumnos']);
  }

  irAPacks(): void {
    this.router.navigate(['/entrenador-packs']);
  }

  logout(): void {
    localStorage.clear();
    this.isAuthenticated = false;
    this.router.navigate(['/login']);
  }
}
