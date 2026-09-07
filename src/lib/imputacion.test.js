import { describe, it, expect } from 'vitest';
import { CONFIG_DEFAULT } from './constants.js';
import { imputarEstadias, liquidar, valorizar } from './payroll.js';

const cfg = CONFIG_DEFAULT;
const est = (o={}) => ({ id:'es1', empleado:'e1', propiedad:'p1', reserva:'r1',
  desde:'2026-09-01', hasta:'2026-09-05', estado:'FINALIZADA', ...o });

describe('imputarEstadias', () => {
  it('imputa la jornada ordinaria en los días de estadía sin marcación', () => {
    const { registros, dias } = imputarEstadias([est()], [], 'e1', '2026-09-01', '2026-09-05', cfg);
    expect(dias).toEqual(['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05']);
    expect(registros).toHaveLength(5);
    expect(registros[0]).toMatchObject({ tipo:'EFECTIVO', metodo:'IMPUTADO', imputado:true, estadia:'es1' });
  });

  it('imputa una jornada DIURNA, sin recargo nocturno', () => {
    // La franja nocturna va de 19:00 a 06:00: imputar desde medianoche habría
    // pagado 6 h de recargo nocturno que nadie trabajó.
    const { registros } = imputarEstadias([est()], [], 'e1', '2026-09-01', '2026-09-01', cfg);
    expect(registros[0].entrada).toBe('08:00');
    expect(registros[0].salida).toBe('16:00');
    const res = liquidar(registros, cfg, []);
    expect(res.horas.ordNocturna).toBe(0);
    expect(res.horas.extraNocturna).toBe(0);
    expect(res.horas.ordDiurna).toBeCloseTo(cfg.horasDiarias, 5);
    expect(res.totalEfectivo).toBeCloseTo(cfg.horasDiarias, 5);
  });

  it('respeta lo marcado: un día con marcación real no se imputa', () => {
    const real = [{ empleado:'e1', fecha:'2026-09-03', tipo:'EFECTIVO', entrada:'07:00', salida:'11:00' }];
    const { dias } = imputarEstadias([est()], real, 'e1', '2026-09-01', '2026-09-05', cfg);
    expect(dias).not.toContain('2026-09-03');
    expect(dias).toHaveLength(4);
  });

  it('recorta la estadía al período liquidado', () => {
    const { dias } = imputarEstadias([est()], [], 'e1', '2026-09-03', '2026-09-04', cfg);
    expect(dias).toEqual(['2026-09-03','2026-09-04']);
  });

  it('no imputa días futuros de una estadía en curso', () => {
    const enCurso = est({ estado:'ACTIVA', hasta:'2026-09-30' });
    const { dias } = imputarEstadias([enCurso], [], 'e1', '2026-09-01', '2026-09-30', cfg, '2026-09-03');
    expect(dias).toEqual(['2026-09-01','2026-09-02','2026-09-03']);
  });

  it('ignora las estadías PROGRAMADAS y las de otro empleado', () => {
    const otras = [est({ id:'es2', estado:'PROGRAMADA' }), est({ id:'es3', empleado:'e9' })];
    const { dias } = imputarEstadias(otras, [], 'e1', '2026-09-01', '2026-09-05', cfg);
    expect(dias).toEqual([]);
  });

  it('no duplica días cuando dos estadías se solapan', () => {
    const solapadas = [est(), est({ id:'es2', desde:'2026-09-04', hasta:'2026-09-07' })];
    const { dias, registros } = imputarEstadias(solapadas, [], 'e1', '2026-09-01', '2026-09-07', cfg);
    expect(new Set(dias).size).toBe(dias.length);
    expect(registros).toHaveLength(7);
  });

  it('el tiempo imputado sí llega a valorizarse como salario', () => {
    const { registros } = imputarEstadias([est()], [], 'e1', '2026-09-01', '2026-09-05', cfg);
    const val = valorizar(liquidar(registros, cfg, []), cfg.salarioMinimo, cfg);
    expect(val.total).toBeGreaterThan(0);
  });

  it('un domingo dentro de la estadía se paga con recargo dominical', () => {
    // 2026-09-06 es domingo
    const dom = est({ desde:'2026-09-06', hasta:'2026-09-06' });
    const { registros } = imputarEstadias([dom], [], 'e1', '2026-09-06', '2026-09-06', cfg);
    const conDom = valorizar(liquidar(registros, cfg, []), cfg.salarioMinimo, cfg);
    const lun = est({ desde:'2026-09-07', hasta:'2026-09-07' });
    const { registros: rl } = imputarEstadias([lun], [], 'e1', '2026-09-07', '2026-09-07', cfg);
    const sinDom = valorizar(liquidar(rl, cfg, []), cfg.salarioMinimo, cfg);
    expect(conDom.total).toBeGreaterThan(sinDom.total);
  });

  it('no inventa horas de disponibilidad', () => {
    const { registros } = imputarEstadias([est()], [], 'e1', '2026-09-01', '2026-09-05', cfg);
    expect(liquidar(registros, cfg, []).disponibilidadHrs).toBe(0);
  });
});
