import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

export interface PopupButton {
  text: string;
  value: any;
  type: 'primary' | 'secondary' | 'danger';
}

@Component({
  selector: 'app-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="popup-overlay" [@fadeInOut]>
      <div class="popup-card" [@scaleInOut] (click)="$event.stopPropagation()">
        <div class="popup-header">
          <div class="icon-wrapper" [ngClass]="icon">
            <span *ngIf="icon === 'success'">✔️</span>
            <span *ngIf="icon === 'error'">✖️</span>
            <span *ngIf="icon === 'warning'">⚠️</span>
            <span *ngIf="icon === 'question'">❓</span>
            <span *ngIf="icon === 'info'">ℹ️</span>
          </div>
          <h2>{{ title }}</h2>
        </div>
        
        <div class="popup-body">
          <p>{{ message }}</p>
        </div>

        <div class="popup-footer" [ngClass]="'buttons-' + buttons.length">
          <button 
            *ngFor="let btn of buttons" 
            type="button"
            [class]="'btn-' + btn.type"
            (click)="close(btn.value)"
          >
            {{ btn.text }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .popup-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .popup-card {
      background: var(--bg-secondary, #fff);
      border-radius: 24px;
      width: 100%;
      max-width: 440px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      color: var(--text-main, #111);
      text-align: center;
      border: 1px solid var(--card-border, #eee);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .popup-header {
      margin-bottom: 20px;
      
      .icon-wrapper {
        font-size: 32px;
        margin-bottom: 16px;
        height: 64px;
        width: 64px;
        background: #f8fafc;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        
        &.success { background: #f0fdf4; color: #16a34a; }
        &.error { background: #fef2f2; color: #dc2626; }
        &.warning { background: #fffbeb; color: #d97706; }
        &.info { background: #eff6ff; color: #2563eb; }
        &.question { background: #f8fafc; color: #475569; }
      }

      h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 800;
        color: var(--text-main, #111);
        letter-spacing: -1px;
        text-transform: uppercase;
      }
    }

    .popup-body {
      margin-bottom: 28px;
      p {
        color: var(--text-secondary, #64748b);
        line-height: 1.6;
        font-size: 16px;
        margin: 0;
        font-weight: 500;
      }
    }

    .popup-footer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      
      &.buttons-2 {
        flex-direction: row;
        button { flex: 1; }
      }
    }

    button {
      padding: 16px 24px;
      border-radius: 12px;
      border: none;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-family: 'Inter', sans-serif;

      &.btn-primary {
        background: #000;
        color: #fff;
        &:hover { background: #222; }
      }

      &.btn-secondary {
        background: #f3f4f6;
        color: #4b5563;
        &:hover { background: #e5e7eb; color: #111; }
      }

      &.btn-danger {
        background: #fef2f2;
        color: #dc2626;
        &:hover { background: #fee2e2; }
      }
    }
  `],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ transform: 'scale(0.9)', opacity: 0 }),
        animate('250ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'scale(0.95)', opacity: 0 }))
      ])
    ])
  ]
})
export class PopupComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() icon: 'success' | 'error' | 'warning' | 'info' | 'question' = 'info';
  @Input() buttons: PopupButton[] = [];

  @Output() result = new EventEmitter<any>();

  close(value: any) {
    this.result.emit(value);
  }

  handleBackdropClick(event: MouseEvent) {
    // Optional: Allow closing on backdrop click if buttons are few?
    // For confirmation, it's safer to force a button click.
  }
}
