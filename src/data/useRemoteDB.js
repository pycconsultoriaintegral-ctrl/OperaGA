import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { TABLAS, TABLAS_SYNCABLES, cfgFromRow, cfgToRow } from '../lib/columnMap.js';

const fmtFechaHora = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ──────────────────────────────────────────────────────────────────────────
   La Data API de Supabase corta toda respuesta en "Max rows" (1000 por
   defecto) y NO avisa: devuelve las primeras 1000 filas como si fueran todas.
   `horarios` ya pasa de 4000, así que la app solo veía las más viejas. Las
   celdas de la semana en curso salían vacías, el supervisor las llenaba, y
   como la fila sí existía en el servidor el guardado se resolvía como UPDATE
   (por eso en la auditoría había 26 UPDATE y ningún INSERT). Al recargar
   volvían a llegar las mismas 1000 viejas y su trabajo "desaparecía" —
   aunque en la base nunca se borró nada.

   `traerTodo` pide la tabla por páginas con .range() hasta agotarla, y
   ordena por `id` para que el paginado sea estable entre peticiones.
   ────────────────────────────────────────────────────────────────────────── */
const PAGINA = 1000;

export async function traerTodo(tabla, columnas = '*'){
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase.from(tabla).select(columnas)
      .order('id', { ascending: true }).range(desde, desde + PAGINA - 1);
    if (error) return { data: null, error };
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) break;   // última página
  }
  return { data: filas, error: null };
}

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
    traerTodo('empleados_publico'),
    // Paginadas: son las que crecen con la operación. `horarios` ya pasa de
    // 4000 filas y sin paginar llegaban solo las primeras 1000.
    ...TABLAS_SYNCABLES.map(key => traerTodo(TABLAS[key].table))
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

/** Error legible cuando la base acepta la sentencia pero RLS la deja en 0 filas. */
function errorPermiso(tabla, accion, cuantas){
  const e = new Error(`La base de datos no dejó ${accion} ${cuantas} registro(s) en "${tabla}": `
    + `tu rol no tiene ese permiso. Pide a un administrador que lo habilite en Configuración → Roles.`);
  e.code = 'SIN_PERMISO';
  e.tabla = tabla;
  return e;
}

/** Sincroniza una tabla insertando/actualizando/eliminando solo lo que cambió
 *  entre `prevRows` y `nextRows` (comparados por `id`). Exportada para poder
 *  probar en test la detección de escrituras que RLS deja en 0 filas. */
export async function syncTabla(key, prevRows, nextRows){
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
  //
  // OJO con RLS: un DELETE o un UPDATE que la política no permite NO devuelve
  // error — la fila simplemente es invisible para esa sentencia, afecta a 0
  // filas y Postgres responde "éxito". Así, a un rol sin `eliminar` (p. ej.
  // Supervisor sobre `horarios`) la app le decía que había guardado, la celda
  // desaparecía de la pantalla y al recargar el turno volvía a aparecer.
  // Por eso cada delete/update pide de vuelta los ids realmente afectados y
  // se compara la cuenta: si faltan, se levanta un error explícito.
  if (deletes.length) {
    const { data, error } = await supabase.from(table).delete().in('id', deletes).select('id');
    if (error) throw error;
    if ((data || []).length < deletes.length) throw errorPermiso(table, 'eliminar', deletes.length - (data || []).length);
  }
  for (const { id, ...rest } of updates) {
    const { data, error } = await supabase.from(table).update(rest).eq('id', id).select('id');
    if (error) throw error;
    if (!(data || []).length) throw errorPermiso(table, 'modificar', 1);
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
export function useRemoteDB(toast, userId){
  const [db, setDbState] = useState(null);
  const [loading, setLoading] = useState(true);
  // Para que la persona VEA si la app está recibiendo cambios en vivo y de
  // cuándo son los datos que tiene delante, en vez de mirar una pantalla
  // desactualizada creyendo que está al día.
  const [ultimaCarga, setUltimaCarga] = useState(null);
  const [enVivo, setEnVivo] = useState(false);
  const dbRef = useRef(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Cada set() local incrementa esto. El refresco automático por Realtime
  // (recargar) tarda un rato en ir y volver a Supabase — si mientras tanto
  // el usuario edita otra fila (ej. pasa al siguiente empleado en Horarios),
  // ese recargar() llegaba con una foto vieja y pisaba el cambio recién
  // hecho apenas un instante después de que el usuario lo viera reflejado.
  // Comparando la generación antes/después del fetch, un recargar() que
  // quedó desactualizado por una edición local no se aplica — el propio
  // guardado de esa edición dispara su propio recargar() más adelante.
  const genRef = useRef(0);

  // Con clics rápidos en varias celdas, cada guardado dispara su propio
  // evento Realtime y por lo tanto su propio recargar() ~400ms después. Si
  // uno de esos fetches tarda más que el siguiente, podían resolver fuera de
  // orden: el más lento (con una foto más vieja) llegaba DESPUÉS del más
  // rápido y pisaba una celda recién asignada, hacía que "no se quedara
  // seleccionada" sin ningún error visible. Encolar los recargar() (igual
  // que ya se hace con los guardados en `set`) obliga a que cada fetch
  // empiece solo cuando el anterior ya terminó, así siempre se aplican en
  // el mismo orden en que se dispararon.
  const recargarQueueRef = useRef(Promise.resolve());

  const recargar = useCallback(() => {
    const startGen = genRef.current;
    const p = recargarQueueRef.current.then(async () => {
      try {
        const fresh = await fetchAll();
        if (genRef.current !== startGen) return; // hubo una edición local durante el fetch: descartar esta foto vieja
        dbRef.current = fresh;
        setDbState(fresh);
        setUltimaCarga(Date.now());
      } catch (err) {
        console.error(err);
        toastRef.current?.('No se pudo cargar la información: ' + err.message, 'rose');
      }
    });
    recargarQueueRef.current = p;
    return p;
  }, []);

  useEffect(() => {
    recargar().finally(() => setLoading(false));

    const tablasRealtime = [...TABLAS_SYNCABLES.map(k => TABLAS[k].table), 'festivos', 'configuracion', 'cargos'];
    let timeoutId = null;
    const debounceRecargar = () => { clearTimeout(timeoutId); timeoutId = setTimeout(recargar, 400); };

    // Refrescar al volver a la pestaña y cada 3 min mientras esté visible.
    // Realtime NO se puede dar por garantizado: el websocket se cae al
    // suspender el portátil o perder la red, la tabla puede no estar en la
    // publicación `supabase_realtime`, y RLS filtra los eventos. Si eso falla
    // en silencio, quien deja la pestaña abierta nunca ve lo que otro guardó
    // —justo el "Mauricio creó los horarios y a mí no se me reflejan"—.
    // Estas dos redes de seguridad hacen que la información llegue igual.
    const alVolver = () => { if (document.visibilityState === 'visible') recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    const intervalo = setInterval(alVolver, 180000);

    // Encolar los recargar() (arriba) evita que se resuelvan fuera de orden
    // entre sí, pero no evita el caso más común: esta MISMA sesión recibe el
    // aviso Realtime de su PROPIO guardado exitoso y se recarga a sí misma
    // ~400ms después — si para entonces ya hizo otro clic optimista más
    // reciente, ese recargar "propio" igual competía con él. La causa de
    // fondo es innecesaria: si el cambio lo hizo esta sesión, ya lo tiene
    // reflejado optimistamente, no necesita recargar nada. `created_by`/
    // `updated_by` dicen quién hizo cada insert/update — si coincide con el
    // usuario actual, se ignora el evento; recargar() solo se dispara ante
    // cambios de OTRA persona u otro dispositivo.
    const esCambioPropio = payload => {
      const fila = payload.new || payload.old;
      const autor = fila?.updated_by ?? fila?.created_by;
      return autor && userIdRef.current && autor === userIdRef.current;
    };

    const channel = supabase.channel('opera-realtime');
    tablasRealtime.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        if (esCambioPropio(payload)) return;
        debounceRecargar();
      });
    });
    // `subscribe()` iba sin callback: si el canal fallaba (tabla fuera de la
    // publicación, token vencido, websocket caído) nadie se enteraba y las
    // actualizaciones en vivo se morían para siempre, en silencio. Ahora se
    // registra el estado —para poder mostrarlo en pantalla— y al reconectar
    // se recarga, porque durante la caída pudo cambiar cualquier cosa.
    channel.subscribe(status => {
      const vivo = status === 'SUBSCRIBED';
      setEnVivo(vivo);
      if (vivo) recargar();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Realtime:', status);
    });

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      supabase.removeChannel(channel);
    };
  }, [recargar]);

  // Cola de sincronizaciones: dos `set()` seguidos (doble clic, clics rápidos
  // en varias celdas) antes disparaban syncChanges() en paralelo, y la red
  // podía entregar esas peticiones fuera de orden — el delete de la segunda
  // llegaba antes que el insert de la primera y la fila vieja "revivía",
  // chocando contra el unique (empleado_id, fecha) de `horarios`. Encolar
  // aquí obliga a que cada sincronización espere a que termine la anterior,
  // preservando el orden real en que se aplicaron los cambios de estado.
  const syncQueueRef = useRef(Promise.resolve());

  // Aviso persistente de "no se pudo guardar", con reintento. Ver encolarSync.
  const [errorSync, setErrorSync] = useState(null);
  // Cuántos cambios quedaron sin guardar. Hace falta porque después de un fallo
  // la persona sigue trabajando y esos guardados posteriores sí pueden ir bien:
  // el aviso no se puede quitar solo porque el último haya funcionado, mientras
  // siga habiendo un cambio anterior que nunca llegó a la base.
  const fallosRef = useRef(0);

  const encolarSync = useCallback((base, next, onError) => {
    syncQueueRef.current = syncQueueRef.current
      .then(() => syncChanges(base, next))
      .then(() => { if (fallosRef.current === 0) setErrorSync(null); })
      .catch(err => {
        console.error(err);
        // El módulo que llamó puede hacerse cargo (Marcación encola la marca en
        // el teléfono); ahí sí se recarga, porque ya guardó una copia aparte.
        if (onError) { onError(err); recargar(); return; }
        // Sin manejador propio NO se recarga. Recargar descartaba de la
        // pantalla todo lo que la persona llevaba editado y aún sin guardar
        // —así se vivía el "tenía todo diligenciado y se borró"—. Ahora el
        // trabajo se conserva en pantalla y se avisa de forma persistente,
        // con la opción de reintentar el guardado.
        fallosRef.current++;
        setErrorSync({
          mensaje: err.message || 'Error desconocido',
          sinPermiso: err.code === 'SIN_PERMISO',
          reintentar: () => {
            fallosRef.current = Math.max(0, fallosRef.current - 1);
            setErrorSync(null);
            encolarSync(base, next);
          },
          descartar: () => { fallosRef.current = 0; setErrorSync(null); recargar(); }
        });
      });
  }, [recargar]);

  // `onError(err)` opcional: si el guardado en Supabase falla, en vez del aviso
  // persistente se llama a este callback (lo usa Marcación para dejar la marca
  // en una cola local del teléfono y reintentarla al reconectar).
  //
  // El cálculo se hace FUERA del updater de setDbState: React puede invocar un
  // updater más de una vez, y aquí dentro había efectos secundarios (mutar
  // dbRef/genRef y encolar la sincronización) que entonces se duplicaban.
  const set = useCallback((fn, onError) => {
    const base = dbRef.current;
    if (!base) return;
    const next = typeof fn === 'function' ? fn(base) : fn;
    dbRef.current = next;
    genRef.current++;
    setDbState(next);
    encolarSync(base, next, onError);
  }, [encolarSync]);

  return { db, set, loading, refrescar: recargar, errorSync, ultimaCarga, enVivo };
}
