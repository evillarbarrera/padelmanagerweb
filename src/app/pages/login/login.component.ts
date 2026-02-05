import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  error = '';
  showPassword = false;
  showRecoverForm = false;
  recoverEmail = '';
  recoverMessage = '';
  recoverError = '';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) { }

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Email y contraseña requeridos';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.apiService.login(this.email, this.password).subscribe({
      next: (response: any) => {
        if (response.id) {
          // Guardar en ambos servicios para evitar desincronización
          this.authService.setCurrentUser(response);
          this.apiService.setCurrentUser(response);

          // Redirige según el rol
          const userRole = (response.rol || 'jugador').toLowerCase();
          if (userRole.includes('administrador') || userRole.includes('admin')) {
            this.router.navigate(['/admin-club']);
          } else if (userRole.includes('entrenador')) {
            this.router.navigate(['/entrenador-home']);
          } else if (userRole.includes('jugador') || userRole.includes('alumno')) {
            this.router.navigate(['/jugador-home']);
          } else {
            this.router.navigate(['/']);
          }
        } else {
          this.error = 'Credenciales inválidas';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Login error:', err);
        this.error = 'Error al iniciar sesión. Verifica tus credenciales.';
        this.isLoading = false;
      }
    });
  }

  toggleRecoverMode(): void {
    this.showRecoverForm = !this.showRecoverForm;
    this.error = '';
    this.recoverError = '';
    this.recoverMessage = '';
  }

  sendRecovery(): void {
    if (!this.recoverEmail) {
      this.recoverError = 'Ingresa tu correo electrónico';
      return;
    }

    console.log('Iniciando recuperación para:', this.recoverEmail);
    this.isLoading = true;
    this.recoverError = '';
    this.recoverMessage = '';

    this.authService.recoverPassword(this.recoverEmail).subscribe({
      next: (res: any) => {
        console.log('Respuesta del servidor (Recovery):', res);
        this.isLoading = false;
        if (res.success) {
          this.recoverMessage = res.message || 'Instrucciones enviadas a tu correo.';
        } else {
          this.recoverError = res.message || 'No se pudo enviar el correo.';
        }
      },
      error: (err) => {
        console.error('Error en la petición de recuperación:', err);
        this.isLoading = false;
        this.recoverError = 'Error de conexión. Intenta más tarde.';
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.login();
    }
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }
}
