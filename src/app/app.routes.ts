import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { JugadorHomeComponent } from './pages/jugador-home/jugador-home.component';
import { JugadorReservasComponent } from './pages/jugador-reservas/jugador-reservas.component';
import { JugadorCalendarioComponent } from './pages/jugador-calendario/jugador-calendario.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { EntrenadorHomeComponent } from './pages/entrenador-home/entrenador-home.component';
import { AlumnosComponent } from './pages/alumnos/alumnos.component';
import { EntrenadorAgendaComponent } from './pages/entrenador-agenda/entrenador-agenda.component';
import { EntrenadorPacksComponent } from './pages/entrenador-packs/entrenador-packs.component';
import { DisponibilidadEntrenadorComponent } from './pages/disponibilidad-entrenador/disponibilidad-entrenador.component';
import { LandingComponent } from './pages/landing/landing.component';
import { JugadorPacksComponent } from './pages/jugador-packs/jugador-packs.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // Student Routes
  { path: 'jugador-home', component: JugadorHomeComponent },
  { path: 'jugador-reservas', component: JugadorReservasComponent },
  { path: 'jugador-calendario', component: JugadorCalendarioComponent },
  { path: 'jugador-packs', component: JugadorPacksComponent },

  // Trainer Routes
  { path: 'entrenador-home', component: EntrenadorHomeComponent },
  { path: 'alumnos', component: AlumnosComponent },
  { path: 'entrenador-calendario', component: EntrenadorAgendaComponent },
  { path: 'entrenador-packs', component: EntrenadorPacksComponent },
  { path: 'disponibilidad-entrenador', component: DisponibilidadEntrenadorComponent },

  // Shared Routes
  { path: 'perfil', component: PerfilComponent },
  {
    path: 'evaluar/:id',
    loadComponent: () => import('./pages/nueva-evaluacion/nueva-evaluacion.component').then(m => m.NuevaEvaluacionComponent)
  },
  {
    path: 'progreso/:id',
    loadComponent: () => import('./pages/alumno-progreso/alumno-progreso.component').then(m => m.AlumnoProgresoComponent)
  },

  { path: '**', redirectTo: '' }
];
