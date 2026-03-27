import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private collapsed = new BehaviorSubject<boolean>(localStorage.getItem('sidebarCollapsed') === 'true');
  collapsed$ = this.collapsed.asObservable();

  setCollapsed(val: boolean) {
    this.collapsed.next(val);
    localStorage.setItem('sidebarCollapsed', val ? 'true' : 'false');
    if (val) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }

  toggle() {
    this.setCollapsed(!this.collapsed.value);
  }

  isCollapsed() {
    return this.collapsed.value;
  }
}
