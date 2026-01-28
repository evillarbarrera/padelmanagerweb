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
          // Guardar en auth service y localStorage
          this.authService.setCurrentUser(response);
          localStorage.setItem('userId', response.id);
          localStorage.setItem('userRole', response.rol || 'jugador');

          // Redirige según el rol
          const userRole = response.rol || 'jugador';
          if (userRole === 'jugador') {
            this.router.navigate(['/jugador-home']);
          } else if (userRole === 'entrenador') {
            this.router.navigate(['/entrenador-home']);
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
