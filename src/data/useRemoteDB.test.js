import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Fake mínimo del cliente de Supabase: encadena igual que el real y devuelve
   lo que le indique `respuestas`. Sirve para comprobar cómo reacciona
   syncTabla cuando la base acepta la sentencia pero no afecta a ninguna fila,
   que es exactamente lo que hace Row Level Security con un DELETE o un UPDATE
   que la política no permite (0 filas y "éxito", sin error). */
const llamadas = [];
let respuestas = {};

function tabla(){
  const q = {
    _op: null, _select: false,
    delete(){ q._op = 'delete'; return q; },
    update(){ q._op = 'update'; return q; },
    insert(){ q._op = 'insert'; return q; },
    upsert(){ q._op = 'upsert'; return q; },
    in(){ return q; },
    eq(){ return q; },
    select(){ q._select = true; return q; },
    then(res, rej){
      llamadas.push(q._op);
      return Promise.resolve(respuestas[q._op] ?? { data: [], error: null }).then(res, rej);
    }
  };
  return q;
}

vi.mock('../lib/supabaseClient.js', () => ({ supabase: { from: () => tabla() } }));

const { syncTabla } = await import('./useRemoteDB.js');

const fila = (id, tur) => ({ id, emp: 'e1', fecha: '2026-09-01', tur });

describe('syncTabla · escrituras que RLS deja en 0 filas', () => {
  beforeEach(() => { llamadas.length = 0; respuestas = {}; });

  it('lanza error cuando el DELETE no borra nada (rol sin permiso de eliminar)', async () => {
    respuestas.delete = { data: [], error: null };   // RLS: 0 filas, sin error
    await expect(syncTabla('horarios', [fila('h1', 'DIA')], []))
      .rejects.toMatchObject({ code: 'SIN_PERMISO', tabla: 'horarios' });
  });

  it('acepta el DELETE cuando la base confirma las filas borradas', async () => {
    respuestas.delete = { data: [{ id: 'h1' }], error: null };
    await expect(syncTabla('horarios', [fila('h1', 'DIA')], [])).resolves.toBeUndefined();
    expect(llamadas).toContain('delete');
  });

  it('lanza error cuando el UPDATE no modifica nada (rol sin permiso de editar)', async () => {
    respuestas.update = { data: [], error: null };
    await expect(syncTabla('horarios', [fila('h1', 'DIA')], [fila('h1', 'NOC')]))
      .rejects.toMatchObject({ code: 'SIN_PERMISO' });
  });

  it('acepta el UPDATE cuando la base confirma la fila modificada', async () => {
    respuestas.update = { data: [{ id: 'h1' }], error: null };
    await expect(syncTabla('horarios', [fila('h1', 'DIA')], [fila('h1', 'NOC')])).resolves.toBeUndefined();
  });

  it('propaga el error real de la base sin disfrazarlo', async () => {
    respuestas.delete = { data: null, error: new Error('permission denied') };
    await expect(syncTabla('horarios', [fila('h1', 'DIA')], [])).rejects.toThrow('permission denied');
  });

  it('no toca la base cuando no hay diferencias', async () => {
    await syncTabla('horarios', [fila('h1', 'DIA')], [fila('h1', 'DIA')]);
    expect(llamadas).toEqual([]);
  });
});
