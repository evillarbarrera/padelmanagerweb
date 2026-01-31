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
    @Input() role: 'jugador' | 'entrenador' = 'jugador';

    isOpen = false; // Mobile menu state

    constructor(private router: Router) { }

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
