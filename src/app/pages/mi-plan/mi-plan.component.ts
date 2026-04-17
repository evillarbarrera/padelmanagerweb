import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { environment } from '../../../environments/environment';
import { CurrencyService } from '../../services/currency.service';
import { Router } from '@angular/router';
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
  userRole: 'jugador' | 'entrenador' | 'administrador_club' | 'administrador' | 'staff_club' = 'entrenador';

  // Currency & Location
  isInternational = false;
  currencySymbol = '$';
  currencyCode = 'CLP';

  constructor(
    public currencyService: CurrencyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const storedRole = localStorage.getItem('userRole') || '';
    const storedUserId = localStorage.getItem('userId');
    
    // 🔐 SEGURIDAD: Los usuarios de Staff no pueden gestionar el plan/pago
    if (!storedUserId || storedRole.toLowerCase().includes('staff')) {
        this.router.navigate(['/club-home']);
        return;
    }

        this.userRole = storedRole as any;
        this.coachId = Number(storedUserId);
    this.coachNombre = localStorage.getItem('userName') || 'Mi Academia';
    this.coachFoto = localStorage.getItem('userFoto') || '';
    this.detectCurrency();
    this.loadSubscription();
    this.loadPlansData();
  }

  detectCurrency(): void {
    this.currencyService.detectLocation().subscribe(country => {
      this.isInternational = country !== 'CL';
      this.currencySymbol = this.isInternational ? 'USD $' : '$';
      this.currencyCode = this.isInternational ? 'USD' : 'CLP';
    });
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
      })
      .catch(() => {
          this.plans = [
            { id: 1, name: 'EMPRENDEDOR', price_clp: 0, description: 'Hasta 5 alumnos, con comisión' },
            { id: 2, name: 'INICIAL 20', price_clp: 19990, description: 'Hasta 20 alumnos, sin comisión' },
            { id: 3, name: 'PRO 40', price_clp: 29990, description: 'Hasta 40 alumnos, sin comisión' },
            { id: 4, name: 'ELITE ILIMITADO', price_clp: 49990, description: 'Alumnos ilimitados, sin comisión' }
          ];
      });
  }

  loadPlans() {
    if (this.plans.length > 0) {
      this.mostrarSelectorDePlanes();
    } else {
        this.loadPlansData();
        setTimeout(() => this.mostrarSelectorDePlanes(), 500);
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
            <p style="margin: 0; font-weight: 950; color: #111;">${this.isInternational ? ('USD $' + this.currencyService.getUsdAmount(p.price_clp)) : ('$' + Number(p.price_clp).toLocaleString() + ' CLP')}</p>
          </div>
        </div>
      </div>
    `).join('');

    Swal.fire({
      title: 'ELIGE TU PLAN 💎',
      html: `
        <div style="padding: 10px 0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Selecciona el plan para activar el cobro automático:</p>
          <div id="swal-plans-container">${plansHtml}</div>
        </div>
        <style>
          .swal-plan-option:has(input:checked) { border-color: #ccff00 !important; background: #f0fff0 !important; }
        </style>
      `,
      confirmButtonText: 'CONTINUAR AL PAGO ⚡',
      confirmButtonColor: '#ccff00',
      showCancelButton: true,
      cancelButtonText: 'CANCELAR',
      cancelButtonColor: '#f2f2f7',
      reverseButtons: true,
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
        this.vincularReal(Number(result.value));
      }
    });
  }

  cambiarTarjeta() {
    this.loadPlans();
  }

  vincularReal(planId: number) {
    if (this.isInternational) {
      this.iniciarFlujoPaypal(planId);
      return;
    }

    this.isLoading = true;
    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    
    const body = {
      coach_id: this.coachId,
      plan_id: planId,
      origin: window.location.origin + window.location.pathname
    };

    fetch(`${environment.apiUrl}/subscriptions/create_subscription_link.php`, {
      method: 'POST',
      headers: {
        'Authorization': authValue,
        'X-Authorization': authValue,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(r => r.json())
    .then(res => {
      this.isLoading = false;
      if (res.success && res.redirect) {
        window.location.href = res.init_point;
      } else if (res.success && !res.redirect) {
        Swal.fire({ title: '¡Éxito!', text: 'Plan activado correctamente.', icon: 'success' });
        this.loadSubscription();
      } else {
        Swal.fire({ title: 'Atención', text: res.message || 'Error al conectar.', icon: 'info' });
      }
    })
    .catch(err => {
      this.isLoading = false;
      Swal.fire({ title: 'Error', text: 'No se pudo iniciar el pago.', icon: 'error' });
    });
  }

  // --- NUEVA LÓGICA PAYPAL ---

  iniciarFlujoPaypal(planId: number) {
    Swal.fire({
      title: 'SUSCRIPCIÓN PAYPAL 💵',
      text: 'Se habilitará el botón de PayPal para que actives tu cobro mensual en dólares.',
      icon: 'info',
      confirmButtonText: 'MOSTRAR BOTÓN',
      confirmButtonColor: '#0070ba'
    }).then(() => {
        this.renderPaypalButton(planId);
    });
  }

  renderPaypalButton(planId: number) {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;
    container.innerHTML = ''; 

    if (!(window as any).paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=AaDdNdD9u3UQPHwYkECkzduiGXAll7ZEKrqG-jIUgJhyQNHzaqGXf4bssmnARVdXAjPqgJN5MGZ4e10p&vault=true&intent=subscription`;
        script.onload = () => this.buildPaypalButton(planId);
        document.body.appendChild(script);
    } else {
        this.buildPaypalButton(planId);
    }
  }

  buildPaypalButton(planId: number) {
    const planIds: any = {
        1: 'P-PLAN_EMPRENDEDOR_ID',
        2: 'P-7W798993Y3711311RM6S5Q2Y',
        3: 'P-3N798993BA817112RM6S5Q2Y',
        4: 'P-9A798993CK917113RM6S5Q2Y'
    };

    (window as any).paypal.Buttons({
      style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
      createSubscription: (data: any, actions: any) => {
        return actions.subscription.create({ 'plan_id': planIds[planId] });
      },
      onApprove: (data: any, actions: any) => {
        Swal.fire({ title: '¡EXITO!', text: 'Suscripción activada con PayPal.', icon: 'success' });
        this.loadSubscription();
      },
      onError: (err: any) => {
        Swal.fire({ title: 'Error', text: 'No se pudo activar PayPal.', icon: 'error' });
      }
    }).render('#paypal-button-container');
  }

  cambiarPlan(planId: number) {
    this.vincularReal(planId);
  }
}
