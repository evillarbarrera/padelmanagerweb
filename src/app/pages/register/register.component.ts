import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
    nombre = '';
    email = '';
    password = '';
    confirmPassword = '';
    rol = 'jugador'; // Default role
    showPassword = false;
    isLoading = false;
    error = '';

    constructor(
        private apiService: ApiService,
        private authService: AuthService,
        private router: Router
    ) { }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    handleKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            this.register();
        }
    }

    register(): void {
        if (!this.nombre || !this.email || !this.password || !this.confirmPassword) {
            this.error = 'Todos los campos son obligatorios';
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.error = 'Las contraseñas no coinciden';
            return;
        }

        this.isLoading = true;
        this.error = '';

        const userData = {
            nombre: this.nombre,
            email: this.email,
            password: this.password,
            rol: this.rol
        };

        this.apiService.register(userData).subscribe({
            next: (response: any) => {
                if (response.success) {
                    // Extract user data from response
                    const user = response.usuario;

                    // Auto login after register - sync both services
                    this.authService.setCurrentUser(user);
                    this.apiService.setCurrentUser(user);

                    // Redirige según el rol
                    const role = (user.rol || '').toLowerCase();
                    if (role.includes('administrador') || role.includes('admin')) {
                        this.router.navigate(['/admin-club']);
                    } else if (role.includes('entrenador')) {
                        this.router.navigate(['/entrenador-home']);
                    } else if (role.includes('jugador') || role.includes('alumno')) {
                        this.router.navigate(['/jugador-home']);
                    } else {
                        this.router.navigate(['/']);
                    }
                } else {
                    this.error = response.error || 'Error al registrarse';
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Register error:', err);
                this.error = err.error?.error || 'Error al registrarse. Inténtalo de nuevo.';
                this.isLoading = false;
            }
        });
    }

    goToLogin(): void {
        this.router.navigate(['/login']);
    }
}
