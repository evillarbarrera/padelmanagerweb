import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PizarraService } from '../../services/pizarra.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pizarra-tactica',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './pizarra-tactica.component.html',
  styleUrls: ['./pizarra-tactica.component.scss']
})
export class PizarraTacticaComponent implements OnInit {
  activeTab: string = 'coach'; // 'coach' o 'archivo'
  coachSubTab: 'pizarra' | 'datos' = 'pizarra'; // Sub-tab para móvil/iPad
  activeTool: string = 'select';

  // --- PLAYERS & NAMES ---
  players = [
    { key: 'j1', name: 'Jugador 1', label: 'J1', color: '#cc3333' },
    { key: 'j2', name: 'Jugador 2', label: 'J2', color: '#cc3333' },
    { key: 'r1', name: 'Rival 1', label: 'R1', color: '#eab308' },
    { key: 'r2', name: 'Rival 2', label: 'R2', color: '#eab308' }
  ];

  // --- MARCADOR ---
  setsMarcador = [
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 }
  ];

  // --- STATS PER PLAYER ---
  statList: string[] = [
    'SAQUE',
    'DEV. SAQUE',
    'DERECHA',
    'REVÉS',
    'VOLEA DER.',
    'VOLEA REV.',
    'BANDEJA',
    'RULO',
    'SMASH/X3/X4',
    'BAJADA DE PARED',
    'ERRORES NO FORZADOS'
  ];

  playerStats: any = {
    j1: {}, j2: {}, r1: {}, r2: {}
  };

  // --- TACTICAL BOARD ---
  isActionActive = false;
  draggedElement: any = null;
  currentPath: string = '';
  
  currentTacticaId: number | null = null;
  nombreSesion: string = 'Nuevo Analisis';
  notas: string = '';

  elements: any[] = [
    { id: 1, type: 'player', color: '#cc3333', x: 150, y: 180, label: 'J1', key: 'j1' },
    { id: 2, type: 'player', color: '#cc3333', x: 350, y: 180, label: 'J2', key: 'j2' },
    { id: 3, type: 'player', color: '#eab308', x: 180, y: 550, label: 'R1', key: 'r1' },
    { id: 4, type: 'player', color: '#eab308', x: 320, y: 550, label: 'R2', key: 'r2' },
    { id: 5, type: 'ball', color: '#ccff00', x: 250, y: 400 },
    { id: 6, type: 'cone', color: '#ff7711', x: 250, y: 710 }
  ];

  drawings: any[] = []; 
  savedSessions: any[] = [];
  idEntrenador: number | null = null;
  selectedSessionPreview: any = null;

  constructor(
    private pizarraService: PizarraService,
    private authService: AuthService
  ) { 
    this.resetPlayerStats();
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.idEntrenador = user.id;
      this.loadSessions();
    }
  }

  resetPlayerStats() {
    ['j1', 'j2', 'r1', 'r2'].forEach(pk => {
      this.playerStats[pk] = {};
      this.statList.forEach(s => this.playerStats[pk][s] = 0);
    });
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  onNameChange(index: number) {
    const p = this.players[index];
    
    // 1. Generate new label (initials or 2 letters)
    let newLabel = '';
    if (p.name) {
      const parts = p.name.trim().split(' ');
      if (parts.length >= 2) {
        newLabel = (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
      } else {
        newLabel = p.name.substring(0, 2).toUpperCase();
      }
    } else {
       newLabel = p.key.toUpperCase();
    }
    
    // 2. Update players array label (for the Metrics table)
    p.label = newLabel;

    // 3. Sync with tactical board elements if they exist
    const el = this.elements.find(e => e.key === p.key);
    if (el) {
      el.label = newLabel;
    }
  }

  // --- ACTIONS ---
  updateScore(setIndex: number, pareja: number, delta: number) {
    if (pareja === 1) {
      this.setsMarcador[setIndex].p1 = Math.max(0, this.setsMarcador[setIndex].p1 + delta);
    } else {
      this.setsMarcador[setIndex].p2 = Math.max(0, this.setsMarcador[setIndex].p2 + delta);
    }
  }

  updatePlayerStat(playerKey: string, stat: string, delta: number) {
    this.playerStats[playerKey][stat] = Math.max(0, this.playerStats[playerKey][stat] + delta);
  }

  // --- TACTICAL SYSTEM ---
  loadSessions() {
    if (!this.idEntrenador) return;
    this.pizarraService.getTacticas(this.idEntrenador).subscribe(res => {
      if (res.success) this.savedSessions = res.data;
    });
  }

  setTool(tool: string) {
    this.activeTool = tool;
  }

  startAction(event: MouseEvent | TouchEvent, element?: any) {
    this.isActionActive = true;
    const svg = (event.currentTarget as HTMLElement).closest('svg') || (event.target as HTMLElement).closest('svg');
    if (!svg) return;
    const svgPoint = this.getSVGPoint(event, svg);
    if (this.activeTool === 'select' && element) {
      this.draggedElement = element;
    } else if (this.activeTool === 'draw') {
      this.currentPath = `M ${svgPoint.x} ${svgPoint.y}`;
      this.drawings.push({ d: this.currentPath, color: '#ffffff' });
    }
    event.preventDefault();
  }

  doAction(event: MouseEvent | TouchEvent) {
    if (!this.isActionActive) return;
    const svg = (event.currentTarget as HTMLElement).closest('svg') || (event.target as HTMLElement).closest('svg');
    if (!svg) return;
    const svgPoint = this.getSVGPoint(event, svg);
    if (this.activeTool === 'select' && this.draggedElement) {
      this.draggedElement.x = svgPoint.x;
      this.draggedElement.y = svgPoint.y;
    } else if (this.activeTool === 'draw') {
      const lastLine = ` L ${svgPoint.x} ${svgPoint.y}`;
      this.currentPath += lastLine;
      if (this.drawings.length > 0) this.drawings[this.drawings.length - 1].d = this.currentPath;
    }
  }

  stopAction() {
    this.isActionActive = false;
    this.draggedElement = null;
    this.currentPath = '';
  }

  getSVGPoint(event: any, svg: SVGSVGElement) {
    const pt = svg.createSVGPoint();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM()?.inverse());
  }

  saveSession() {
    if (!this.idEntrenador) return;
    Swal.fire({
      title: 'Guardar Sesión Coach',
      input: 'text',
      inputValue: this.currentTacticaId ? this.nombreSesion : 'Análisis ' + new Date().toLocaleDateString(),
      inputLabel: 'Nombre del análisis/partido',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#ccff00'
    }).then(result => {
      if (result.isConfirmed && result.value) {
        this.nombreSesion = result.value;
        const payload = {
          id: this.currentTacticaId,
          id_entrenador: this.idEntrenador,
          nombre: this.nombreSesion,
          notas: this.notas,
          players_data: this.players,
          marcador_data: this.setsMarcador,
          stats_data: this.playerStats,
          elements_data: this.elements,
          drawings_data: this.drawings
        };

        this.pizarraService.saveTactica(payload).subscribe(res => {
          if (res.success) {
            this.currentTacticaId = res.id;
            this.loadSessions();
            Swal.fire({ icon: 'success', title: '¡Guardado!', timer: 2000, showConfirmButton: false });
          }
        });
      }
    });
  }

  loadTactica(t: any) {
    this.currentTacticaId = t.id;
    this.nombreSesion = t.nombre_sesion || t.nombre;
    this.notas = t.notas;
    
    // API should return already decoded json from my PHP
    this.setsMarcador = t.marcador_data || [{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }, { p1: 0, p2: 0 }];
    this.playerStats = t.stats_data || this.playerStats;
    this.players = t.players_data || this.players;
    this.elements = t.elements_data || this.elements; 
    this.drawings = t.drawings_data || [];
    this.activeTab = 'coach';
  }

  selectSessionToPreview(t: any) {
    this.selectedSessionPreview = t;
  }

  getTotalStats(playerKey: string): number {
    if (!this.selectedSessionPreview?.stats_data?.[playerKey]) return 0;
    const stats = this.selectedSessionPreview.stats_data[playerKey];
    return Object.values(stats).reduce((acc: any, val: any) => acc + (Number(val) || 0), 0) as number;
  }

  getWinningPoints(playerKey: string): number {
     if (!this.selectedSessionPreview?.stats_data?.[playerKey]) return 0;
     const stats = this.selectedSessionPreview.stats_data[playerKey];
     const winnerKeys = ['VOLEA DER.', 'VOLEA REV.', 'BANDEJA', 'SMASH/X3/X4'];
     return winnerKeys.reduce((acc, key) => acc + (Number(stats[key]) || 0), 0);
  }

  getErrors(playerKey: string): number {
     if (!this.selectedSessionPreview?.stats_data?.[playerKey]) return 0;
     const stats = this.selectedSessionPreview.stats_data[playerKey];
     return Number(stats['ERRORES NO FORZADOS']) || 0;
  }

  getWinnerTeam(): number {
    if (!this.selectedSessionPreview?.marcador_data) return 0;
    let setsP1 = 0;
    let setsP2 = 0;
    this.selectedSessionPreview.marcador_data.forEach((s: any) => {
       if (Number(s.p1) > Number(s.p2)) setsP1++;
       else if (Number(s.p2) > Number(s.p1)) setsP2++;
    });
    if (setsP1 > setsP2) return 1;
    if (setsP2 > setsP1) return 2;
    return 0;
  }


  newSession() {
    this.currentTacticaId = null;
    this.nombreSesion = 'Nueva Sesión Coach';
    this.notas = '';
    this.drawings = [];
    this.elements = [
      { id: 1, type: 'player', color: '#cc3333', x: 150, y: 180, label: 'J1', key: 'j1' },
      { id: 2, type: 'player', color: '#cc3333', x: 350, y: 180, label: 'J2', key: 'j2' },
      { id: 3, type: 'player', color: '#eab308', x: 180, y: 550, label: 'R1', key: 'r1' },
      { id: 4, type: 'player', color: '#eab308', x: 320, y: 550, label: 'R2', key: 'r2' },
      { id: 5, type: 'ball', color: '#ccff00', x: 250, y: 400 },
      { id: 6, type: 'cone', color: '#ff7711', x: 250, y: 710 }
    ];
    this.setsMarcador = [{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }, { p1: 0, p2: 0 }];
    this.resetPlayerStats();
  }

  undo() {
    if (this.drawings.length > 0) this.drawings.pop();
  }

  addPlayer(color: string) {
    const newId = this.elements.length + 1;
    this.elements.push({ id: newId, type: 'player', color: color, x: 250, y: 400, label: 'P' + newId });
  }

  addCone() {
    const newId = this.elements.length + 1;
    this.elements.push({ id: newId, type: 'cone', color: '#ff7711', x: 250, y: 400 });
  }

  clearAll() {
    this.elements = [];
    this.drawings = [];
  }
}
