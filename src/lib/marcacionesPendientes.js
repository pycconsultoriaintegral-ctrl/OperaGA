/* ══════════════════════════════════════════════════════════════════════════
   COLA LOCAL DE MARCACIONES PENDIENTES
   ══════════════════════════════════════════════════════════════════════════
   Si al registrar una marcación falla el guardado en Supabase (sin señal en
   la propiedad, corte de datos, token vencido…), `useRemoteDB` revierte el
   cambio optimista y antes eso dejaba al trabajador creyendo que marcó sin
   que quedara nada. Ahora la marcación se guarda aquí, en el propio teléfono,
   y se reintenta sola al recuperar conexión. Cada fila lleva su `id` (uid);
   cuando ese `id` ya aparece en `db.asistencia` se da por sincronizada y se
   quita de la cola.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY = 'opera_marcaciones_pendientes';

export function leerPendientes(){
  try{
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}

function guardar(arr){
  try{ localStorage.setItem(KEY, JSON.stringify(arr)); }catch{ /* almacenamiento lleno o bloqueado */ }
}

export function agregarPendiente(row){
  const arr = leerPendientes().filter(r => r.id !== row.id);
  // `_ts`/`_intentos` primero para que, si `row` ya los trae (reintento), los
  // suyos manden y no se reinicie el contador de intentos.
  arr.push({ _ts: Date.now(), _intentos: 0, ...row });
  guardar(arr);
}

export function quitarPendiente(id){
  guardar(leerPendientes().filter(r => r.id !== id));
}

/** Descarta de la cola lo que ya llegó a la base (mismo id en db.asistencia). */
export function depurarPendientes(asistencia){
  const idsRemotos = new Set((asistencia || []).map(r => r.id));
  const arr = leerPendientes().filter(r => !idsRemotos.has(r.id));
  guardar(arr);
  return arr;
}
