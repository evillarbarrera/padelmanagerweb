import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface PopupOptions {
    title: string;
    message: string;
    icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
    buttons?: any[]; // Simple array of button objects
}

@Injectable({
    providedIn: 'root'
})
export class PopupService {
    private popupSubject = new Subject<any>();
    popupState$ = this.popupSubject.asObservable();

    constructor() { }

    /**
     * Muestra un popup y retorna una promesa con el valor del botón pulsado
     */
    open(options: PopupOptions): Promise<any> {
        return new Promise((resolve) => {
            const popupData = {
                ...options,
                icon: options.icon || 'info',
                buttons: options.buttons || [{ text: 'Aceptar', value: true, type: 'primary' }],
                resolve
            };
            this.popupSubject.next(popupData);
        });
    }

    // Shorthands
    success(title: string, message: string): Promise<any> {
        return this.open({ title, message, icon: 'success' });
    }

    error(title: string, message: string): Promise<any> {
        return this.open({ title, message, icon: 'error' });
    }

    warning(title: string, message: string): Promise<any> {
        return this.open({ title, message, icon: 'warning' });
    }

    info(title: string, message: string): Promise<any> {
        return this.open({ title, message, icon: 'info' });
    }

    confirm(title: string, message: string, buttons?: any[]): Promise<any> {
        const defaultButtons = [
            { text: 'Si', value: true, type: 'primary' },
            { text: 'No', value: false, type: 'secondary' }
        ];
        return this.open({
            title,
            message,
            icon: 'question',
            buttons: buttons || defaultButtons
        });
    }

    /**
     * Específico para el requerimiento de "3 botones"
     */
    confirmThree(title: string, message: string, btn1: any, btn2: any, btn3: any): Promise<any> {
        return this.open({
            title,
            message,
            icon: 'question',
            buttons: [btn1, btn2, btn3]
        });
    }
}
