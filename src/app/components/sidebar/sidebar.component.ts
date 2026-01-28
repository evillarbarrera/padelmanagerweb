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
    @Input() role: 'jugador' | 'entrenador' = 'jugador'; // Added role input

    constructor(private router: Router) { }

    ngOnInit() { }

    // Navigation Helper
    navigate(path: string) {
        this.router.navigate([path]);
    }

    // Role-specific navigations are handled in template via navigate()
    // but keeping specific methods for backward compatibility if needed, 
    // though generic navigate is cleaner for the template.

    logout() {
        localStorage.clear();
        this.router.navigate(['/login']);
    }
}
