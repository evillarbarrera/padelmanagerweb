import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-hard-gate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hard-gate.component.html',
  styleUrls: ['./hard-gate.component.scss']
})
export class HardGateComponent implements OnInit {
  isLocked = false;
  isLoading = true;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const role = localStorage.getItem('userRole') || '';
    // Apply Hard Gate only to coaches for now
    if (role.toLowerCase().includes('entrenador')) {
      this.checkSubscription();
    } else {
      this.isLoading = false;
    }
  }

  checkSubscription() {
    const coachId = localStorage.getItem('userId');
    if (!coachId) {
      this.isLoading = false;
      return;
    }

    const token = localStorage.getItem('token');
    const authValue = token ? `Bearer ${token}` : '';
    fetch(`${environment.apiUrl}/subscriptions/get_subscription_status.php?coach_id=${coachId}`, {
      headers: {
        'Authorization': authValue,
        'X-Authorization': authValue
      }
    })
      .then(r => r.json())
      .then(res => {
        // If status is 'inactive', it means they haven't registered a card/trial yet
        if (res.status === 'inactive') {
          this.isLocked = true;
        }
        // If status is 'past_due', we might also want to lock or show a different message
        if (res.status === 'past_due') {
            this.isLocked = true;
        }
        this.isLoading = false;
      })
      .catch(() => {
        this.isLoading = false;
      });
  }

  goToPlans() {
    this.router.navigate(['/mi-plan']);
  }
}
