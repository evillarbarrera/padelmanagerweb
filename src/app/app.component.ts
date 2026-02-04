import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PopupComponent } from './components/popup/popup.component';
import { PopupService } from './services/popup.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, PopupComponent],
  template: `
    <router-outlet></router-outlet>
    
    <app-popup 
      *ngIf="activePopup"
      [title]="activePopup.title"
      [message]="activePopup.message"
      [icon]="activePopup.icon"
      [buttons]="activePopup.buttons"
      (result)="handlePopupResult($event)"
    ></app-popup>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  activePopup: any = null;

  constructor(private popupService: PopupService) { }

  ngOnInit() {
    this.popupService.popupState$.subscribe(data => {
      this.activePopup = data;
    });
  }

  handlePopupResult(value: any) {
    const resolver = this.activePopup.resolve;
    this.activePopup = null;
    resolver(value);
  }
}
