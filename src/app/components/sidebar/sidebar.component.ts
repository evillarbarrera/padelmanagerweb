import { Component, Input, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss'],
    standalone: true,
    imports: [CommonModule, RouterModule]
})
export class SidebarComponent implements OnInit {
    @Input() userId: number | null = null;
    @Input() jugadorNombre: string = 'Usuario';
    @Input() jugadorFoto: string | null = null;
    @Input() activePage: string = '';
    @Input() role: 'jugador' | 'entrenador' | 'administrador_club' = 'jugador';

    isOpen = false; // Mobile menu state

    constructor(private router: Router) { }

    get computedRole(): string {
        let r = (this.role || '').toLowerCase();
        // Fallback to localStorage if role is not provided or is default
        if (r === 'jugador' || !r) {
            const storedRole = localStorage.getItem('userRole');
            if (storedRole) r = storedRole.toLowerCase();
        }

        if (r.includes('admin')) return 'administrador_club';
        if (r.includes('entrenador')) return 'entrenador';
        return 'jugador';
    }

    ngOnInit() { }

    toggleSidebar() {
        this.isOpen = !this.isOpen;
    }

    closeSidebar() {
        this.isOpen = false;
    }

    // Navigation Helper
    navigate(path: string) {
        this.closeSidebar(); // Close on navigation
        this.router.navigate([path]);
    }

    logout() {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
