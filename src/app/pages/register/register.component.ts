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
    rol = 'jugador'; // Default role matching mobile app
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
            email: this.email, // Fixed: Send email instead of usuario
            password: this.password,
            rol: this.rol
        };

        this.apiService.register(userData).subscribe({
            next: (response: any) => {
                if (response.success || response.id) {
                    // Auto login after register
                    this.authService.setCurrentUser(response);
                    localStorage.setItem('userId', response.id);
                    localStorage.setItem('userRole', response.rol || 'jugador');
                    this.router.navigate(['/jugador-home']);
                } else {
                    this.error = response.message || 'Error al registrarse';
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Register error:', err);
                this.error = 'Error al registrarse. Inténtalo de nuevo.';
                this.isLoading = false;
            }
        });
    }

    goToLogin(): void {
        this.router.navigate(['/login']);
    }
}
