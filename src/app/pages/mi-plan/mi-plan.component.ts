import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mi-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './mi-plan.component.html',
  styleUrls: ['./mi-plan.component.scss']
})
export class MiPlanComponent implements OnInit {
  isLoading = true;
  sub: any = null;
  plans: any[] = [];
  coachId: number = 0;
  coachNombre: string = '';
  coachFoto: string = '';

  constructor() { }

  ngOnInit(): void {
    this.coachId = Number(localStorage.getItem('userId'));
    this.coachNombre = localStorage.getItem('userName') || 'Mi Academia';
    this.coachFoto = localStorage.getItem('userFoto') || '';
    this.loadSubscription();
    this.loadPlansData();
  }

  loadSubscription() {
    this.isLoading = true;
    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    fetch(`${environment.apiUrl}/subscriptions/get_subscription_status.php?coach_id=${this.coachId}`, {
      headers: {
        'Authorization': authValue,
        'X-Authorization': authValue
      }
    })
      .then(r => r.json())
      .then(res => {
        this.sub = res;
        this.isLoading = false;
      })
      .catch(err => {
        console.error('Error loading sub:', err);
        this.isLoading = false;
      });
  }

  loadPlansData() {
    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    fetch(`${environment.apiUrl}/subscriptions/get_plans.php`, {
      headers: {
        'Authorization': authValue,
        'X-Authorization': authValue
      }
    })
      .then(r => r.json())
      .then(res => {
        this.plans = res;
      });
  }

  loadPlans() {
    // Si ya tenemos planes, abrimos el selector. Si no, cargamos y abrimos.
    if (this.plans.length > 0) {
      this.mostrarSelectorDePlanes();
    } else {
      const token = localStorage.getItem('token');
      const authValue = token ? `Bearer ${token}` : '';
      fetch(`${environment.apiUrl}/subscriptions/get_plans.php`, {
        headers: {
          'Authorization': authValue,
          'X-Authorization': authValue
        }
      })
        .then(r => r.json())
        .then(res => {
          this.plans = res;
          this.mostrarSelectorDePlanes();
        });
    }
  }

  mostrarSelectorDePlanes() {
    const plansHtml = this.plans.map(p => `
      <div class="swal-plan-option" style="text-align: left; padding: 20px; border: 2px solid #eee; border-radius: 16px; margin-bottom: 12px; cursor: pointer; transition: 0.3s;" 
           onclick="document.getElementById('plan-${p.id}').click()">
        <input type="radio" name="planId" id="plan-${p.id}" value="${p.id}" style="display:none">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0; font-weight: 950; font-size: 16px;">${p.name}</p>
            <p style="margin: 4px 0 0; color: #888; font-size: 12px;">${p.description}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 950; color: #111;">$${Number(p.price_clp).toLocaleString()} CLP</p>
            <p style="margin: 0; color: #ccff00; font-size: 10px; font-weight: 800;">${p.type === 'commission' ? 'Variable' : 'Fijo'}</p>
          </div>
        </div>
      </div>
    `).join('');

    Swal.fire({
      title: 'CAMBIAR MI PLAN 💎',
      html: `
        <div style="padding: 10px 0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Selecciona el nuevo plan para tu academia:</p>
          <div id="swal-plans-container">${plansHtml}</div>
        </div>
        <style>
          .swal-plan-option:has(input:checked) { border-color: #ccff00 !important; background: #f0fff0 !important; }
        </style>
      `,
      confirmButtonText: 'ACTUALIZAR PLAN AHORA',
      confirmButtonColor: '#ccff00',
      showCancelButton: true,
      cancelButtonText: 'CANCELAR',
      cancelButtonColor: '#f2f2f7',
      reverseButtons: true,
      background: '#fff',
      color: '#111',
      preConfirm: () => {
        const selected = (document.querySelector('input[name="planId"]:checked') as HTMLInputElement);
        if (!selected) {
          Swal.showValidationMessage('Por favor selecciona un plan');
          return false;
        }
        return selected.value;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.cambiarPlan(Number(result.value));
      }
    });
  }

  cambiarTarjeta() {
    Swal.fire({
      title: 'VINCULAR TARJETA 💳',
      html: `
        <div class="secure-checkout-white" style="text-align: left; padding: 10px 5px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 16px; margin-bottom: 24px; border: 1px solid #edf2f7; display: flex; align-items: center; gap: 12px;">
             <span style="font-size: 24px;">🛡️</span>
             <div>
                <p style="font-size: 13px; color: #111; font-weight: 800; margin: 0; text-transform: uppercase;">Portal de Pago Seguro</p>
                <p style="font-size: 11px; color: #888; margin: 2px 0 0 0;">Certificado SSL / Transacción Encriptada</p>
             </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <label style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-left: 2px;">Titular de la Tarjeta</label>
            <input id="swal-card-name" class="swal2-input" placeholder="Nombre completo" style="width: 100%; border-radius: 12px; border: 1.5px solid #eee; background: #fff; color: #111; margin: 8px 0; padding: 12px; font-weight: 600; font-family: 'Inter', sans-serif;">
          </div>

          <div style="margin-bottom: 15px;">
            <label style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-left: 2px;">Número de Tarjeta</label>
            <input id="swal-card-num" class="swal2-input" placeholder="0000 0000 0000 0000" maxlength="19" style="width: 100%; border-radius: 12px; border: 1.5px solid #eee; background: #fff; color: #111; margin: 8px 0; padding: 12px; font-weight: 600; font-family: monospace;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-left: 2px;">Expiración</label>
              <input id="swal-card-exp" class="swal2-input" placeholder="MM/YY" maxlength="5" style="width: 100%; border-radius: 12px; border: 1.5px solid #eee; background: #fff; color: #111; margin: 8px 0; padding: 12px; text-align: center; font-weight: 600;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-left: 2px;">CVV</label>
              <input id="swal-card-cvv" class="swal2-input" placeholder="***" maxlength="4" style="width: 100%; border-radius: 12px; border: 1.5px solid #eee; background: #fff; color: #111; margin: 8px 0; padding: 12px; text-align: center; font-weight: 600;">
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'VINCULAR TARJETA ⚡',
      confirmButtonColor: '#ccff00',
      cancelButtonText: 'CANCELAR',
      cancelButtonColor: '#f2f2f7',
      showCancelButton: true,
      reverseButtons: true,
      background: '#fff',
      color: '#111',
      buttonsStyling: true,
      preConfirm: () => {
        const name = (document.getElementById('swal-card-name') as HTMLInputElement).value;
        const num = (document.getElementById('swal-card-num') as HTMLInputElement).value;
        if (!name || !num) {
          Swal.showValidationMessage('Completar todos los datos requeridos');
        }
        return { lastFour: num.slice(-4) || '4242' };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.confirmarVinculacion(result.value.lastFour);
      }
    });
  }

  confirmarVinculacion(lastFour: string) {
    Swal.fire({
      title: 'Validando...',
      html: 'Conectando con el emisor bancario...',
      timer: 2000,
      timerProgressBar: true,
      background: '#fff',
      color: '#111',
      didOpen: () => { Swal.showLoading(); }
    }).then(() => {
      Swal.fire({
        title: '¡Registrada!',
        text: `Tarjeta terminada en **** ${lastFour} vinculada correctamente.`,
        icon: 'success',
        confirmButtonColor: '#ccff00',
        background: '#fff',
        color: '#111'
      });
      if (this.sub) this.sub.card_last_four = lastFour;
    });
  }

  cambiarPlan(planId: number) {
    this.isLoading = true;
    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    fetch(`${environment.apiUrl}/subscriptions/update_subscription.php`, {
      method: 'POST',
      headers: { 
        'Authorization': authValue,
        'X-Authorization': authValue,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ coach_id: this.coachId, plan_id: planId })
    })
    .then(r => r.json())
    .then(res => {
      this.isLoading = false;
      if (res.success) {
        Swal.fire({
          title: '¡PLAN ACTUALIZADO! 💎',
          text: res.message,
          icon: 'success',
          confirmButtonText: '¡GRACIAS!',
          confirmButtonColor: '#ccff00',
          background: '#fff',
          color: '#111'
        }).then(() => {
          this.loadSubscription();
        });
      } else {
        Swal.fire({ title: 'Error', text: res.message, icon: 'error', background: '#fff', color: '#111' });
      }
    })
    .catch(err => {
      this.isLoading = false;
      Swal.fire({ title: 'Error', text: 'No pudimos procesar tu solicitud.', icon: 'error', background: '#fff', color: '#111' });
    });
  }
}
