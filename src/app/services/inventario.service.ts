import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  private apiUrl = environment.apiUrl + '/inventario';

  constructor(private http: HttpClient) {}

  private getHeaders() {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  getProductos(clubId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/get_productos.php?club_id=${clubId}`);
  }

  addProducto(producto: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/add_producto.php`, producto, { headers: this.getHeaders() });
  }

  registrarVenta(venta: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registrar_venta.php`, venta, { headers: this.getHeaders() });
  }

  deleteProducto(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete_producto.php`, { id }, { headers: this.getHeaders() });
  }

  // Reportes básicos
  getVentas(clubId: number, fechaInicio?: string, fechaFin?: string): Observable<any> {
    let url = `${this.apiUrl}/get_ventas.php?club_id=${clubId}`;
    if (fechaInicio) url += `&finicio=${fechaInicio}`;
    if (fechaFin) url += `&ffin=${fechaFin}`;
    return this.http.get(url);
  }

  deleteVenta(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete_venta.php`, { id }, { headers: this.getHeaders() });
  }

  // Métodos para Consumos en Reservas
  getConsumosReserva(reservaId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/get_consumos_reserva.php?reserva_id=${reservaId}`);
  }

  addConsumoReserva(data: { reserva_id: number, jugador_n: number, producto_id: number, cantidad: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/add_consumo_reserva.php`, data, { headers: this.getHeaders() });
  }

  deleteConsumo(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete_consumo.php`, { id }, { headers: this.getHeaders() });
  }
}
