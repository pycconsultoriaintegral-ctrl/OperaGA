import { describe, it, expect, vi, beforeEach } from 'vitest';

/* La Data API de Supabase corta toda respuesta en "Max rows" (1000 en este
   proyecto) sin avisar. Este fake reproduce ese comportamiento: por más filas
   que tenga la tabla, nunca devuelve más de `MAX` por petición, y respeta el
   .range() que se le pida. Sirve para comprobar que traerTodo() pagina hasta
   agotar la tabla en vez de quedarse con la primera página. */
const MAX = 1000;
let tablaFalsa = [];
let errorForzado = null;
const peticiones = [];

function query(){
  let desde = 0, hasta = MAX - 1;
  const q = {
    select(){ return q; },
    order(){ return q; },
    range(a, b){ desde = a; hasta = b; return q; },
    then(res, rej){
      if (errorForzado) return Promise.resolve({ data:null, error:errorForzado }).then(res, rej);
      const tope = Math.min(hasta - desde + 1, MAX);          // el servidor nunca da más de MAX
      const data = tablaFalsa.slice(desde, desde + tope);
      peticiones.push({ desde, hasta, devueltas: data.length });
      return Promise.resolve({ data, error:null }).then(res, rej);
    }
  };
  return q;
}

vi.mock('../lib/supabaseClient.js', () => ({ supabase: { from: () => query() } }));

const { traerTodo } = await import('./useRemoteDB.js');

const filas = n => Array.from({ length:n }, (_, i) => ({ id:`h${String(i).padStart(5,'0')}` }));

describe('traerTodo · paginación por encima del tope de la Data API', () => {
  beforeEach(() => { peticiones.length = 0; errorForzado = null; });

  it('trae las 4008 filas de horarios, no solo las primeras 1000', async () => {
    tablaFalsa = filas(4008);
    const { data, error } = await traerTodo('horarios');
    expect(error).toBeNull();
    expect(data).toHaveLength(4008);
    expect(peticiones).toHaveLength(5);   // 1000+1000+1000+1000+8
  });

  it('no pierde ni duplica filas al unir las páginas', async () => {
    tablaFalsa = filas(2500);
    const { data } = await traerTodo('horarios');
    expect(new Set(data.map(r => r.id)).size).toBe(2500);
    expect(data[0].id).toBe(tablaFalsa[0].id);
    expect(data[2499].id).toBe(tablaFalsa[2499].id);
  });

  it('con una sola página hace una sola petición', async () => {
    tablaFalsa = filas(29);                // como `asistencia` hoy
    const { data } = await traerTodo('asistencia');
    expect(data).toHaveLength(29);
    expect(peticiones).toHaveLength(1);
  });

  it('una tabla exactamente en el tope pide una página más para confirmar el final', async () => {
    tablaFalsa = filas(1000);
    const { data } = await traerTodo('horarios');
    expect(data).toHaveLength(1000);
    expect(peticiones).toHaveLength(2);
    expect(peticiones[1].devueltas).toBe(0);
  });

  it('una tabla vacía devuelve lista vacía sin reventar', async () => {
    tablaFalsa = [];
    const { data, error } = await traerTodo('horarios');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('propaga el error de la base en vez de devolver datos a medias', async () => {
    tablaFalsa = filas(3000);
    errorForzado = { message:'permission denied' };
    const { data, error } = await traerTodo('horarios');
    expect(data).toBeNull();
    expect(error.message).toBe('permission denied');
  });
});
