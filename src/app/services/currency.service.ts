import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private conversionRate = 950; // default CLP to USD rate (1 USD = 950 CLP)
  private readonly CURRENCY_MOCK_ENV: string | null = null; 
  private userCountry: string = ''; // Dejar vacío para detección por IP en producción

  constructor(private http: HttpClient) {
    this.detectOnStart();
  }

  private detectOnStart(): void {
    this.detectLocation().subscribe();
  }

  /**
   * Detects user country based on IP
   */
  detectLocation(): Observable<string> {
    // MOCK SOLO PARA DESARROLLO (Localhost -> MX, Producción -> Real)
    if (this.CURRENCY_MOCK_ENV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      this.userCountry = this.CURRENCY_MOCK_ENV;
      return of(this.CURRENCY_MOCK_ENV);
    }

    if (this.userCountry) {
      return of(this.userCountry);
    }
    return this.http.get<any>('https://ipapi.co/json/').pipe(
      map(res => {
        this.userCountry = res.country_code || 'CL';
        return this.userCountry;
      }),
      catchError(() => {
        this.userCountry = 'CL';
        return of('CL');
      })
    );
  }

  isInternational(): boolean {
    return this.userCountry !== 'CL';
  }

  getUsdAmount(clpAmount: number): number {
    return Number((clpAmount / this.conversionRate).toFixed(2));
  }

  getExchangeRate(): number {
    return this.conversionRate;
  }

  /**
   * Optional: Fetch real-time rate from a free API
   */
  updateRealTimeRate() {
    this.http.get<any>('https://api.exchangerate-api.com/v4/latest/CLP').pipe(
      catchError(() => of(null))
    ).subscribe(res => {
      if (res && res.rates && res.rates.USD) {
        this.conversionRate = 1 / res.rates.USD;
        console.log('Exchange rate updated to:', this.conversionRate);
      }
    });
  }
}
