import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlumnoMisPacks } from './alumno-mis-packs';

describe('AlumnoMisPacks', () => {
  let component: AlumnoMisPacks;
  let fixture: ComponentFixture<AlumnoMisPacks>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlumnoMisPacks]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlumnoMisPacks);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
