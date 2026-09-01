import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { TABLAS, TABLAS_SYNCABLES, cfgFromRow, cfgToRow } from '../lib/columnMap.js';

const fmtFechaHora = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Trae todas las tablas de Supabase y arma el mismo objeto `db` que ya
 *  consumen los 11 módulos (misma forma que el localStorage del prototipo). */
async function fetchAll(){
  const [
    cfgRes, festivosRes, profilesRes, auditoriaRes, rolesRes, permisosRes, cargosRes, empPublicoRes,
    ...tablaRes
  ] = await Promise.all([
    supabase.from('configuracion').select('*').eq('id', 1).maybeSingle(),
    supabase.from('festivos').select('fecha').order('fecha'),
    supabase.from('profiles').select('id,nombre,email,estado,rol_id,empleado_id,roles(codigo,nombre)'),
    supabase.from('auditoria').select('id,fecha,usuario_id,accion,entidad,entidad_id')
      .order('fecha', { ascending: false }).limit(200),
    supabase.from('roles').select('id,codigo,nombre,descripcion').order('id'),
    supabase.from('permisos').select('id,rol_id,modulo,ver,crear,editar,eliminar,exportar'),
    supabase.from('cargos').select('id,nombre').order('nombre'),
    // Vista sin campos sensibles (salario, banco, EPS/AFP/ARL): la usan roles
    // que solo tienen ver=true en 'empleados_publico' (ej. Supervisor), ya que
    // la tabla `empleados` les bloquea todo salvo su propia fila (RLS).
    supabase.from('empleados_publico').select('*'),
    ...TABLAS_SYNCABLES.map(key => supabase.from(TABLAS[key].table).select('*'))
  ]);

  for (const res of [cfgRes, festivosRes, profilesRes, auditoriaRes, rolesRes, permisosRes, ...tablaRes]) {
    if (res.error) throw res.error;
  }
  // La tabla `cargos` es de la migración 0008: si todavía no se ha corrido en
  // este proyecto de Supabase, no tiene que tumbar el resto de la app.
  if (cargosRes.error) console.warn('Tabla `cargos` no disponible (¿falta correr la migración 0008?):', cargosRes.error.message);
  // Igual con la vista `empleados_publico` sin RLS propia (migración 0009).
  if (empPublicoRes.error) console.warn('Vista `empleados_publico` no disponible (¿falta correr la migración 0009?):', empPublicoRes.error.message);

  const db = {
    cfg: cfgFromRow(cfgRes.data),
    festivos: (festivosRes.data || []).map(f => f.fecha),
    empleadosPublico: (empPublicoRes.data || []).map(TABLAS.empleados.fromRow)
  };
  TABLAS_SYNCABLES.forEach((key, i) => {
    db[key] = (tablaRes[i].data || []).map(TABLAS[key].fromRow);
  });

  const perfilesPorId = {};
  (profilesRes.data || []).forEach(p => { perfilesPorId[p.id] = p; });

  db.usuarios = (profilesRes.data || []).map(p => ({
    id: p.id, nombre: p.nombre, email: p.email || '',
    rolId: p.rol_id, rolCodigo: p.roles?.codigo || '', empleadoId: p.empleado_id || '',
    rol: (p.roles?.codigo || '—').toUpperCase(), estado: p.estado
  }));

  db.roles = (rolesRes.data || []).map(r => ({ id: r.id, codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion || '' }));

  db.cargos = (cargosRes.data || []).map(c => ({ id: c.id, nombre: c.nombre }));

  db.permisos = (permisosRes.data || []).map(p => ({
    id: p.id, rolId: p.rol_id, modulo: p.modulo,
    ver: !!p.ver, crear: !!p.crear, editar: !!p.editar, eliminar: !!p.eliminar, exportar: !!p.exportar
  }));

  db.auditoria = (auditoriaRes.data || []).map(a => ({
    id: a.id, fecha: fmtFechaHora(a.fecha),
    usuario: perfilesPorId[a.usuario_id]?.nombre || (a.usuario_id ? a.usuario_id.slice(0,8) : 'Sistema'),
    accion: a.accion, entidad: a.entidad,
    detalle: a.entidad_id ? `${a.entidad} · ${a.entidad_id.slice(0,8)}…` : a.entidad
  }));

  db.turnos = []; // registro crudo de turnos del prototipo original: ningún módulo lo usa hoy

  return db;
}

/** Sincroniza una tabla insertando/actualizando/eliminando solo lo que cambió
 *  entre `prevRows` y `nextRows` (comparados por `id`). */
async function syncTabla(key, prevRows, nextRows){
  const { table, toRow, onConflict } = TABLAS[key];
  const prevMap = new Map(prevRows.map(r => [r.id, r]));
  const nextMap = new Map(nextRows.map(r => [r.id, r]));

  const inserts = [];
  const updates = [];
  for (const [id, row] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev) inserts.push({ id, ...toRow(row) });
    else if (JSON.stringify(prev) !== JSON.stringify(row)) updates.push({ id, ...toRow(row) });
  }
  const deletes = [...prevMap.keys()].filter(id => !nextMap.has(id));

  // Primero borrar, después insertar: varios módulos (ej. Horarios) "reemplazan"
  // una fila por otra para la misma llave natural (empleado_id, fecha) — si el
  // insert corre antes del delete, la fila vieja todavía existe y choca contra
  // la restricción unique. Con el delete primero nunca coexisten las dos.
  if (deletes.length) { const { error } = await supabase.from(table).delete().in('id', deletes); if (error) throw error; }
  for (const { id, ...rest } of updates) {
    const { error } = await supabase.from(table).update(rest).eq('id', id);
    if (error) throw error;
  }
  if (inserts.length) {
    // Con onConflict (ej. horarios: empleado_id+fecha), dos sesiones creando
    // "algo nuevo" para la misma llave natural al mismo tiempo se resuelven
    // como UPDATE en vez de reventar el unique — red de seguridad además del
    // manejo por id que ya hace cada módulo (ver Horarios.jsx `asignar`).
    // Nota: en ese choque puntual el `id` de la fila que sobrevive queda
    // siendo el de quien ganó la carrera, no el de esta sesión; el estado
    // local se recompone solo con el siguiente refresco (la suscripción
    // Realtime a `horarios` ya dispara uno).
    const { error } = onConflict
      ? await supabase.from(table).upsert(inserts, { onConflict })
      : await supabase.from(table).insert(inserts);
    if (error) throw error;
  }
}

async function syncFestivos(prevFestivos, nextFestivos){
  const prevSet = new Set(prevFestivos), nextSet = new Set(nextFestivos);
  const toInsert = nextFestivos.filter(f => !prevSet.has(f)).map(fecha => ({ fecha }));
  const toDelete = prevFestivos.filter(f => !nextSet.has(f));
  if (toInsert.length) { const { error } = await supabase.from('festivos').insert(toInsert); if (error) throw error; }
  if (toDelete.length) { const { error } = await supabase.from('festivos').delete().in('fecha', toDelete); if (error) throw error; }
}

async function syncCfg(prevCfg, nextCfg){
  if (JSON.stringify(prevCfg) === JSON.stringify(nextCfg)) return;
  const { error } = await supabase.from('configuracion').update(cfgToRow(nextCfg)).eq('id', 1);
  if (error) throw error;
}

/** Envía a Supabase solo lo que cambió entre dos versiones de `db`. */
async function syncChanges(prevDb, nextDb){
  await Promise.all([
    ...TABLAS_SYNCABLES.map(key =>
      prevDb[key] !== nextDb[key] ? syncTabla(key, prevDb[key], nextDb[key]) : Promise.resolve()),
    prevDb.festivos !== nextDb.festivos ? syncFestivos(prevDb.festivos, nextDb.festivos) : Promise.resolve(),
    prevDb.cfg !== nextDb.cfg ? syncCfg(prevDb.cfg, nextDb.cfg) : Promise.resolve()
  ]);
}

/**
 * Reemplazo de useState(loadDB)+saveDB (Fase 0, localStorage) por datos reales
 * de Supabase: carga inicial, escritura optimista con sincronización en
 * segundo plano, y refresco automático por Realtime cuando otro usuario
 * cambia algo — así todos ven la misma información sin recargar la página.
 */
export function useRemoteDB(toast){
  const [db, setDbState] = useState(null);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Cada set() local incrementa esto. El refresco automático por Realtime
  // (recargar) tarda un rato en ir y volver a Supabase — si mientras tanto
  // el usuario edita otra fila (ej. pasa al siguiente empleado en Horarios),
  // ese recargar() llegaba con una foto vieja y pisaba el cambio recién
  // hecho apenas un instante después de que el usuario lo viera reflejado.
  // Comparando la generación antes/después del fetch, un recargar() que
  // quedó desactualizado por una edición local no se aplica — el propio
  // guardado de esa edición dispara su propio recargar() más adelante.
  const genRef = useRef(0);

  const recargar = useCallback(async () => {
    const startGen = genRef.current;
    try {
      const fresh = await fetchAll();
      if (genRef.current !== startGen) return; // hubo una edición local durante el fetch: descartar esta foto vieja
      dbRef.current = fresh;
      setDbState(fresh);
    } catch (err) {
      console.error(err);
      toastRef.current?.('No se pudo cargar la información: ' + err.message, 'rose');
    }
  }, []);

  useEffect(() => {
    recargar().finally(() => setLoading(false));

    const tablasRealtime = [...TABLAS_SYNCABLES.map(k => TABLAS[k].table), 'festivos', 'configuracion', 'cargos'];
    let timeoutId = null;
    const debounceRecargar = () => { clearTimeout(timeoutId); timeoutId = setTimeout(recargar, 400); };

    const channel = supabase.channel('opera-realtime');
    tablasRealtime.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounceRecargar);
    });
    channel.subscribe();

    return () => { clearTimeout(timeoutId); supabase.removeChannel(channel); };
  }, [recargar]);

  // Cola de sincronizaciones: dos `set()` seguidos (doble clic, clics rápidos
  // en varias celdas) antes disparaban syncChanges() en paralelo, y la red
  // podía entregar esas peticiones fuera de orden — el delete de la segunda
  // llegaba antes que el insert de la primera y la fila vieja "revivía",
  // chocando contra el unique (empleado_id, fecha) de `horarios`. Encolar
  // aquí obliga a que cada sincronización espere a que termine la anterior,
  // preservando el orden real en que se aplicaron los cambios de estado.
  const syncQueueRef = useRef(Promise.resolve());

  const set = useCallback((fn) => {
    setDbState(prev => {
      const base = prev || dbRef.current;
      if (!base) return prev;
      const next = typeof fn === 'function' ? fn(base) : fn;
      dbRef.current = next;
      genRef.current++;
      syncQueueRef.current = syncQueueRef.current.then(() => syncChanges(base, next)).catch(err => {
        console.error(err);
        toastRef.current?.('No se pudo guardar en la base de datos: ' + err.message, 'rose');
        recargar(); // revierte cualquier cambio optimista que no se haya podido guardar
      });
      return next;
    });
  }, [recargar]);

  return { db, set, loading, refrescar: recargar };
}
