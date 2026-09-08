import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { hoy, ahoraLocal, addDias, diffDias, nombreDia } from './utils.js';

// Colombia = UTC-5. Es la zona en la que corre la operación.
beforeAll(() => { process.env.TZ = 'America/Bogota'; });
afterEach(() => { vi.useRealTimers(); });

const enColombia = iso => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };

describe('hoy() usa la fecha LOCAL, no la UTC', () => {
  it('a las 19:00 de Colombia sigue siendo el mismo día', () => {
    // 2026-09-07 19:00 -05:00  ==  2026-09-08 00:00 UTC
    enColombia('2026-09-08T00:00:00Z');
    expect(new Date().toISOString().slice(0,10)).toBe('2026-09-08'); // lo que devolvía antes
    expect(hoy()).toBe('2026-09-07');                                 // lo correcto
  });

  it('el turno nocturno que entra a las 22:00 queda en el día correcto', () => {
    // 2026-09-07 22:00 -05:00  ==  2026-09-08 03:00 UTC
    enColombia('2026-09-08T03:00:00Z');
    expect(hoy()).toBe('2026-09-07');
  });

  it('a las 23:59 todavía es el mismo día', () => {
    enColombia('2026-09-08T04:59:00Z');
    expect(hoy()).toBe('2026-09-07');
  });

  it('pasada la medianoche local sí cambia de día', () => {
    enColombia('2026-09-08T05:01:00Z');
    expect(hoy()).toBe('2026-09-08');
  });

  it('en la mañana no había diferencia (por eso no se notaba)', () => {
    enColombia('2026-09-07T14:00:00Z');
    expect(hoy()).toBe('2026-09-07');
  });
});

describe('ahoraLocal() para auditoría', () => {
  it('registra la hora de Colombia, no la UTC', () => {
    enColombia('2026-09-08T00:30:00Z');   // 19:30 en Bogotá
    expect(ahoraLocal()).toBe('2026-09-07 19:30');
  });
});

describe('el resto de utilidades de fecha siguen bien', () => {
  it('addDias no se corre de día', () => {
    expect(addDias('2026-09-07', 1)).toBe('2026-09-08');
    expect(addDias('2026-09-01', -1)).toBe('2026-08-31');
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('diffDias y nombreDia son consistentes', () => {
    expect(diffDias('2026-09-07','2026-09-14')).toBe(7);
    expect(nombreDia('2026-09-07')).toBe('Lun');   // 7 sep 2026 = lunes
  });
  it('una semana completa desde el lunes no repite ni salta días', () => {
    const dias = Array.from({length:7},(_,i)=>addDias('2026-09-07',i));
    expect(dias).toEqual(['2026-09-07','2026-09-08','2026-09-09','2026-09-10',
                          '2026-09-11','2026-09-12','2026-09-13']);
  });
});
