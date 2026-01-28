import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  stats: any = null;
  reservas: any[] = [];
  isLoading = false;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.apiService.getCurrentUser();
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDashboard();
  }

  loadDashboard(): void {
    if (!this.currentUser?.id) return;

    this.isLoading = true;

    // Load stats
    this.apiService.getHomeStats(this.currentUser.id).subscribe({
      next: (response) => {
        this.stats = response;
      },
      error: (err) => {
        console.error('Error loading stats:', err);
      }
    });

    // Load reservations
    this.apiService.getReservas(this.currentUser.id).subscribe({
      next: (response) => {
        this.reservas = response || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading reservas:', err);
        this.isLoading = false;
      }
    });
  }

  logout(): void {
    this.apiService.logout();
    this.router.navigate(['/login']);
  }
}
