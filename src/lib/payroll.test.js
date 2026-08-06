import { describe, it, expect } from 'vitest';
import { CONFIG_DEFAULT } from './constants.js';
import {
  liquidar, valorizar, prestaciones, aportes,
  evaluarEstadia, compararProgramado, calcularCompensatorios, horasTurno
} from './payroll.js';

// 2023-01-01 es domingo (fecha de referencia estable para las pruebas)
const cfg = CONFIG_DEFAULT;

describe('liquidar', () => {
  it('clasifica una jornada ordinaria diurna sin recargos', () => {
    const regs = [{ fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'08:00', salida:'16:00' }]; // lunes, 8h
    const res = liquidar(regs, cfg, []);
    expect(res.horas.ordDiurna).toBeCloseTo(8, 5);
    expect(res.totalEfectivo).toBeCloseTo(8, 5);
    expect(res.alertas.length).toBe(0);
  });

  it('separa horas extras diurnas por encima del tope diario y genera alerta', () => {
    const regs = [{ fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'08:00', salida:'19:00' }]; // 11h, lunes
    const res = liquidar(regs, cfg, []);
    expect(res.horas.ordDiurna).toBeCloseTo(8, 5);
    expect(res.horas.extraDiurna).toBeCloseTo(3, 5);
    expect(res.horas.extraNocturna).toBeCloseTo(0, 5);
    expect(res.alertas.some(a => a.tipo === 'EXTRA_DIA')).toBe(true);
  });

  it('clasifica horas nocturnas dentro del tope ordinario como ordNocturna', () => {
    const regs = [{ fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'19:00', salida:'23:00' }]; // 4h nocturnas
    const res = liquidar(regs, cfg, []);
    expect(res.horas.ordNocturna).toBeCloseTo(4, 5);
    expect(res.horas.ordDiurna).toBeCloseTo(0, 5);
  });

  it('clasifica trabajo dominical como domDiurna', () => {
    const regs = [{ fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'08:00', salida:'16:00' }]; // domingo, 8h
    const res = liquidar(regs, cfg, []);
    expect(res.horas.domDiurna).toBeCloseTo(8, 5);
    expect(res.horas.ordDiurna).toBeCloseTo(0, 5);
  });

  it('una marcación abierta (entrada === salida, sin cerrar todavía) no cuenta como 24h trabajadas', () => {
    const regs = [{ fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'11:48', salida:'11:48' }];
    const res = liquidar(regs, cfg, []);
    expect(res.totalEfectivo).toBe(0);
  });

  it('combina extra + dominical + nocturna en el bucket extraDomNocturna', () => {
    const regs = [
      { fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'08:00', salida:'16:00' }, // 8h ordinarias dominicales
      { fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'19:00', salida:'21:00' }  // 2h extra + nocturna + dominical
    ];
    const res = liquidar(regs, cfg, []);
    expect(res.horas.domDiurna).toBeCloseTo(8, 5);
    expect(res.horas.extraDomNocturna).toBeCloseTo(2, 5);
  });

  it('no computa disponibilidad, descanso ni salidas como trabajo efectivo', () => {
    const regs = [
      { fecha:'2023-01-02', tipo:'DISPONIBLE', entrada:'08:00', salida:'10:00' },
      { fecha:'2023-01-02', tipo:'DESCANSO',    entrada:'10:00', salida:'12:00' },
      { fecha:'2023-01-02', tipo:'FUERA',       entrada:'12:00', salida:'13:00' }
    ];
    const res = liquidar(regs, cfg, []);
    expect(res.totalEfectivo).toBe(0);
    expect(res.disponibilidadHrs).toBeCloseTo(2, 5);
    expect(res.descansoHrs).toBeCloseTo(2, 5);
    expect(res.fueraHrs).toBeCloseTo(1, 5);
  });
});

describe('valorizar', () => {
  it('aplica el factor de recargo correcto por bucket sobre el valor hora', () => {
    const salario = 2400000;
    const regs = [
      { fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'08:00', salida:'16:00' }, // 8h domDiurna
      { fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'19:00', salida:'21:00' }  // 2h extraDomNocturna
    ];
    const res = liquidar(regs, cfg, []);
    const val = valorizar(res, salario, cfg);
    const vh = salario / cfg.divisorHora; // 10.000

    const domDiurna = val.lineas.find(l => l.k === 'domDiurna');
    expect(domDiurna.factor).toBeCloseTo(1 + cfg.recDominical/100, 5);
    expect(domDiurna.total).toBeCloseTo(8 * vh * (1 + cfg.recDominical/100), 2);

    const extraDomNoc = val.lineas.find(l => l.k === 'extraDomNocturna');
    expect(extraDomNoc.factor).toBeCloseTo(1 + cfg.recDominical/100 + cfg.recExtraNocturna/100, 5);
  });
});

describe('prestaciones', () => {
  it('mantiene las proporciones legales entre conceptos', () => {
    const p = prestaciones(1000000, 30, cfg);
    expect(p.cesantias).toBeCloseTo(p.prima, 5);           // ambas base*dias/360
    expect(p.vacaciones).toBeCloseTo(p.cesantias / 2, 5);  // dias/720 = mitad de dias/360
  });
});

describe('aportes', () => {
  it('calcula los porcentajes fijos de empleado y empleador', () => {
    const a = aportes(1000000);
    expect(a.empleado.salud).toBeCloseTo(40000, 2);
    expect(a.empleado.pension).toBeCloseTo(40000, 2);
    expect(a.empleador.salud).toBeCloseTo(85000, 2);
    expect(a.empleador.pension).toBeCloseTo(120000, 2);
    expect(a.empleador.arl).toBeCloseTo(5220, 2);
  });
});

describe('evaluarEstadia', () => {
  it('marca conforme un día con 8h efectivas y 16h de descanso continuo', () => {
    const registros = [
      { empleado:'e1', fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'06:00', salida:'14:00' },
      { empleado:'e1', fecha:'2023-01-01', tipo:'SUENO',    entrada:'14:00', salida:'06:00' }
    ];
    const ev = evaluarEstadia({ empleado:'e1', desde:'2023-01-01', hasta:'2023-01-01' }, registros, cfg, []);
    expect(ev.dias[0].cumple).toBe(true);
    expect(ev.dias[0].sinClasificar).toBeCloseTo(0, 5);
  });

  it('marca crítico un día que excede el tope de jornada y no da el descanso mínimo', () => {
    const registros = [
      { empleado:'e1', fecha:'2023-01-01', tipo:'EFECTIVO', entrada:'06:00', salida:'14:00' },
      { empleado:'e1', fecha:'2023-01-01', tipo:'SUENO',    entrada:'14:00', salida:'06:00' },
      { empleado:'e1', fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'06:00', salida:'18:00' } // 12h, sin descanso
    ];
    const ev = evaluarEstadia({ empleado:'e1', desde:'2023-01-01', hasta:'2023-01-02' }, registros, cfg, []);
    expect(ev.dias[0].cumple).toBe(true);
    expect(ev.dias[1].cumple).toBe(false);
    expect(ev.diasConformes).toBe(1);
    expect(ev.criticos).toBeGreaterThanOrEqual(2); // jornada excedida + descanso insuficiente
    expect(ev.compensatorio).toBeCloseTo(2 * cfg.compensatorioPorDia, 5);
    expect(ev.excedeConsecutivos).toBe(false);
  });
});

describe('compararProgramado', () => {
  it('detecta tardanza fuera de tolerancia', () => {
    const turnos = [{ id:'DIA', label:'Diurno', ini:'08:00', fin:'17:00', desc:60, interno:false }];
    const horarios = [{ emp:'e1', fecha:'2023-01-02', tur:'DIA' }];
    const asistencia = [{ empleado:'e1', fecha:'2023-01-02', tipo:'EFECTIVO', entrada:'08:20', salida:'17:00' }];
    const empIdx = { e1: { nombre:'Empleado Prueba', doc:'1', cargo:'Mayordomo' } };
    const res = compararProgramado(horarios, asistencia, turnos, cfg, empIdx);
    const fila = res.filas[0];
    expect(fila.estado).toBe('TARDANZA');
    expect(fila.minTarde).toBe(20);
    expect(fila.hProg).toBeCloseTo(horasTurno(turnos[0]), 5);
  });

  it('marca ausencia cuando hay turno programado pero no hay marcación', () => {
    const turnos = [{ id:'DIA', label:'Diurno', ini:'08:00', fin:'17:00', desc:60, interno:false }];
    const horarios = [{ emp:'e1', fecha:'2023-01-02', tur:'DIA' }];
    const res = compararProgramado(horarios, [], turnos, cfg, {});
    expect(res.filas[0].estado).toBe('AUSENTE');
    expect(res.ausencias).toBe(1);
  });
});

describe('calcularCompensatorios', () => {
  it('clasifica como habitual (3+ domingos/mes) y ocasional (<3) correctamente', () => {
    const empleados = [{ id:'e1' }, { id:'e2' }];
    // enero 2023: domingos 1, 8, 15, 22, 29 -> 5 domingos para e1 (habitual)
    const domingosEnero = ['2023-01-01','2023-01-08','2023-01-15','2023-01-22','2023-01-29'];
    const horarios = [
      ...domingosEnero.map(f => ({ emp:'e1', fecha:f, tur:'DIA' })),
      { emp:'e2', fecha:'2023-02-05', tur:'DIA' } // un solo domingo -> ocasional
    ];
    const comps = calcularCompensatorios(empleados, horarios, [], [], [], cfg);
    const c1 = comps.find(c => c.emp.id === 'e1');
    const c2 = comps.find(c => c.emp.id === 'e2');
    expect(c1.habitual).toBe(true);
    expect(c1.ganados).toBe(5);
    expect(c2.habitual).toBe(false);
    expect(c2.ganados).toBe(1);
  });
});
