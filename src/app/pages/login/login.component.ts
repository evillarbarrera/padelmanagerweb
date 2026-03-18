import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit {
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

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.initGoogleAuth();
  }

  @HostListener('window:resize')
  onResize() {
    this.initGoogleAuth();
  }

  initGoogleAuth(): void {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '786145270372-e637i46g6uu1kekcr1ioqdka901acud7.apps.googleusercontent.com',
        callback: (response: any) => this.handleGoogleLogin(response)
      });

      const btnContainer = document.getElementById("googleBtn");
      if (btnContainer) {
        // Clear previous button
        btnContainer.innerHTML = '';

        // Calculate available width
        const availableWidth = btnContainer.offsetWidth;
        const finalWidth = availableWidth > 0 ? Math.min(380, availableWidth) : 300;

        google.accounts.id.renderButton(
          btnContainer,
          {
            theme: "filled_blue",
            size: "large",
            width: finalWidth,
            text: "continue_with",
            shape: "pill",
            logo_alignment: "left"
          }
        );
      }
    } else {
      setTimeout(() => this.initGoogleAuth(), 1000);
    }
  }

  handleGoogleLogin(response: any): void {
    const payload = this.decodeToken(response.credential);
    const email = payload.email;
    const name = payload.name;

    this.isLoading = true;
    this.authService.googleCheck(email).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success && res.exists) {
          // Login existoso desde Google
          this.finalizeLogin(res, null);
        } else if (res.success && !res.exists) {
          // Usuario nuevo -> Redirigir a registro con datos precargados o mostrar selección de rol
          this.error = 'Usuario no registrado. Por favor regístrate primero.';
        } else {
          this.error = res.error || 'Error al autenticar con Google';
        }
      },
      error: (err) => {
        console.error('Google Check Error:', err);
        this.isLoading = false;
        this.error = 'Error de conexión con el servidor.';
      }
    });
  }

  private decodeToken(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  availableProfiles: any[] = [];
  showProfileSelector = false;

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Email y contraseña requeridos';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.apiService.login(this.email, this.password).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.id) {
          // Filtrar perfiles para excluir administrador_club (Pedido cliente: "sacar perfil admin club")
          const filteredProfiles = (response.perfiles || []).filter((p: any) => p.rol !== 'administrador_club');

          if (filteredProfiles.length > 1) {
            this.authService.setCurrentUser(response); // Guardamos user base
            this.availableProfiles = filteredProfiles;
            this.showProfileSelector = true;
          } else {
            // Caso único perfil (o legacy)
            const perfil = (filteredProfiles.length > 0) ? filteredProfiles[0] : null;
            this.finalizeLogin(response, perfil);
          }
        } else {
          this.error = 'Credenciales inválidas';
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        this.error = 'Error al iniciar sesión. Verifica tus credenciales.';
        this.isLoading = false;
      }
    });
  }

  selectProfile(perfil: any) {
    const user = this.authService.getCurrentUser();
    this.finalizeLogin(user, perfil);
  }

  finalizeLogin(user: any, perfil: any) {
    // Merge selected profile data into user object for session
    const finalUser = {
      ...user,
      rol: perfil ? perfil.rol : user.rol,
      club_id: perfil ? perfil.club_id : user.club_id,
      club_nombre: perfil ? perfil.club_nombre : ''
    };

    this.authService.setCurrentUser(finalUser);
    this.apiService.setCurrentUser(finalUser);

    // Redirige según el rol
    const userRole = (finalUser.rol || 'jugador').toLowerCase();

    if (userRole === 'administrador') {
      this.router.navigate(['/admin-dashboard']);
    } else if (userRole.includes('administrador') || userRole.includes('admin')) {
      this.router.navigate(['/admin-club']);
    } else if (userRole.includes('entrenador')) {
      this.router.navigate(['/entrenador-home']);
    } else if (userRole.includes('jugador') || userRole.includes('alumno')) {
      this.router.navigate(['/jugador-home']);
    } else {
      this.router.navigate(['/']);
    }
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
