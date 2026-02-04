import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PopupService } from '../../services/popup.service';

@Component({
  selector: 'app-mantenimiento',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mantenimiento-container">
      <div class="card-mantenimiento">
        <div class="header">
          <span class="icon">⚙️</span>
          <h1>Panel de Control</h1>
          <p>Mantenimiento y Actualizaciones del Sistema</p>
        </div>

        <div class="actions">
          <div class="action-item">
            <div class="info">
              <h3>Activar Recuperación por Email</h3>
              <p>Crea las columnas necesarias en la base de datos para habilitar el sistema de tokens de seguridad.</p>
            </div>
            <button (click)="ejecutarAccion('update_reset_columns')" [disabled]="isLoading">
              {{ isLoading ? 'PROCESANDO...' : 'APLICAR CAMBIOS' }}
            </button>
          </div>

          <div class="action-item">
            <div class="info">
              <h3>Habilitar Sistema de Invitaciones</h3>
              <p>Actualiza la base de datos para soportar invitaciones por email y estados de aceptación.</p>
            </div>
            <button (click)="ejecutarAccion('update_invitation_columns')" [disabled]="isLoading">
              {{ isLoading ? 'PROCESANDO...' : 'ACTIVAR INVITACIONES' }}
            </button>
          </div>
          
          <div class="action-item">
            <div class="info">
              <h3>Soporte para Recurrencia</h3>
              <p>Habilita la capacidad de repetir reservas por varias semanas.</p>
            </div>
            <button (click)="ejecutarAccion('add_recurrence_support')" [disabled]="isLoading" style="background: #ff007b; color: #fff;">
              {{ isLoading ? 'PROCESANDO...' : 'ACTIVAR RECURRENCIA' }}
            </button>
          </div>

          <div class="action-item">
            <div class="info">
              <h3>Actualizar Perfil (Categoría)</h3>
              <p>Agrega el campo de categoría a los perfiles de usuario.</p>
            </div>
            <button (click)="ejecutarAccion('add_categoria_column')" [disabled]="isLoading" style="background: #00e5ff;">
              {{ isLoading ? 'PROCESANDO...' : 'HABILITAR CATEGORÍA' }}
            </button>
          </div>

          <div class="action-item">
            <div class="info">
              <h3>Volver al Sistema</h3>
              <p>Regresa a la pantalla de inicio de sesión.</p>
            </div>
            <button class="secondary" (click)="irALogin()">IR AL LOGIN</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mantenimiento-container {
      min-height: 100vh;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: 'Inter', sans-serif;
      background-image: radial-gradient(circle at 50% 50%, #111 0%, #000 100%);
    }
    .card-mantenimiento {
      background: rgba(20, 20, 20, 0.95);
      width: 100%;
      max-width: 600px;
      border-radius: 20px;
      padding: 50px;
      border: 1px solid #333;
      box-shadow: 0 30px 60px rgba(0,0,0,0.8);
      backdrop-filter: blur(10px);
    }
    .header {
      text-align: center;
      margin-bottom: 50px;
    }
    .header .icon { font-size: 60px; display: block; margin-bottom: 15px; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 4px; font-weight: 900; }
    .header p { color: #666; margin-top: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    
    .actions { display: flex; flex-direction: column; gap: 20px; }
    .action-item {
      background: rgba(255,255,255,0.03);
      padding: 25px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      border: 1px solid rgba(255,255,255,0.05);
      transition: all 0.3s;
    }
    .action-item:hover { background: rgba(255,255,255,0.05); border-color: #ccff00; }
    .info { flex: 1; }
    .info h3 { color: #ccff00; margin: 0; font-size: 16px; font-weight: 700; text-transform: uppercase; }
    .info p { color: #999; margin: 8px 0 0; font-size: 13px; line-height: 1.5; }
    
    button {
      background: #ccff00;
      color: #000;
      border: none;
      padding: 14px 24px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.3s;
      white-space: nowrap;
      font-size: 12px;
      letter-spacing: 1px;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(204, 255, 0, 0.3); }
    button:active { transform: translateY(0); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary { background: transparent; color: #fff; border: 1px solid #444; }
    button.secondary:hover { background: #fff; color: #000; border-color: #fff; }
    
    @media (max-width: 600px) {
      .action-item { flex-direction: column; text-align: center; }
      .card-mantenimiento { padding: 30px; }
    }
  `]
})
export class MantenimientoComponent {
  isLoading = false;
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private popupService: PopupService
  ) { }

  ejecutarAccion(accion: string) {
    this.isLoading = true;
    this.http.post(`${this.apiUrl}/system/mantenimiento.php`, { accion }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.success) {
          this.popupService.success('¡ACTUALIZADO!', res.message);
        } else {
          this.popupService.error('Error', res.message);
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        this.popupService.error('Error', 'No se pudo conectar con el servidor');
      }
    });
  }

  irALogin() {
    location.href = '/login';
  }
}
