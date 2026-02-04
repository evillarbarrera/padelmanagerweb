import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PopupService } from '../../services/popup.service';

@Component({
    selector: 'app-aceptar-invitacion',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './aceptar-invitacion.component.html',
    styleUrls: ['./aceptar-invitacion.component.scss']
})
export class AceptarInvitacionComponent implements OnInit {
    token: string = '';
    invitationData: any = null;
    loading: boolean = true;
    processing: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private authService: AuthService,
        private popupService: PopupService
    ) { }

    ngOnInit() {
        this.token = this.route.snapshot.queryParamMap.get('token') || '';
        if (!this.token) {
            this.popupService.error('Error', 'Token de invitación no válido');
            this.router.navigate(['/']);
            return;
        }
        this.loadInvitationInfo();
    }

    loadInvitationInfo() {
        this.loading = true;
        this.authService.getInvitationInfo(this.token).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.invitationData = res.data;
                } else {
                    this.popupService.error('Error', res.error || 'No se pudo cargar la información');
                }
                this.loading = false;
            },
            error: (err) => {
                console.error('Error invitacion:', err);
                this.popupService.error('Error', 'La invitación ha expirado o no es válida');
                this.loading = false;
            }
        });
    }

    confirmar() {
        this.processing = true;
        this.authService.aceptarInvitacion(this.token).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.popupService.success('¡Listo!', res.message).then(() => {
                        this.router.navigate(['/mis-packs-activos']);
                    });
                } else {
                    this.popupService.error('Error', res.error);
                }
                this.processing = false;
            },
            error: (err) => {
                this.popupService.error('Error', 'No se pudo aceptar la invitación');
                this.processing = false;
            }
        });
    }

    cancelar() {
        this.router.navigate(['/']);
    }
}
