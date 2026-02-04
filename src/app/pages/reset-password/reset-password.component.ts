import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PopupService } from '../../services/popup.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reset-password.component.html',
    styleUrls: ['../login/login.component.scss'] // Reutilizar estilos de login
})
export class ResetPasswordComponent implements OnInit {
    token = '';
    password = '';
    confirmPassword = '';
    isLoading = false;
    showPassword = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute,
        private popupService: PopupService
    ) { }

    ngOnInit(): void {
        this.token = this.route.snapshot.queryParamMap.get('token') || '';

        if (!this.token) {
            this.popupService.error('Error', 'Token de recuperación no válido').then(() => {
                this.router.navigate(['/login']);
            });
        }
    }

    resetPassword(): void {
        if (!this.password || !this.confirmPassword) {
            this.popupService.warning('Atención', 'Debes completar ambos campos');
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.popupService.error('Error', 'Las contraseñas no coinciden');
            return;
        }

        if (this.password.length < 6) {
            this.popupService.warning('Atención', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        this.isLoading = true;

        this.authService.resetPassword(this.token, this.password).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                if (res.success) {
                    this.popupService.success('¡Éxito!', 'Tu contraseña ha sido actualizada').then(() => {
                        this.router.navigate(['/login']);
                    });
                } else {
                    this.popupService.error('Error', res.message || 'No se pudo restablecer la contraseña');
                }
            },
            error: (err) => {
                this.isLoading = false;
                console.error('Reset error:', err);
                this.popupService.error('Error', 'El enlace ha expirado o no es válido');
            }
        });
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }
}
