import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent {
  contactEmail = 'soporte@padelmanager.cl';
  
  faqs = [
    {
      q: '¿Cómo inicio sesión con Apple?',
      a: 'Puedes usar el botón "Continuar con Apple" en la pantalla de inicio de sesión. Si es tu primera vez, se creará una cuenta automáticamente con tu correo de Apple.'
    },
    {
      q: '¿Cómo puedo recuperar mi contraseña?',
      a: 'En la pantalla de inicio de sesión, haz clic en "¿Olvidaste tu contraseña?" e ingresa tu correo electrónico para recibir un enlace de recuperación.'
    },
    {
      q: '¿Cómo contacto a soporte técnico?',
      a: 'Puedes escribirnos directamente a soporte@padelmanager.cl para cualquier duda técnica o problema con tu cuenta.'
    }
  ];
}
