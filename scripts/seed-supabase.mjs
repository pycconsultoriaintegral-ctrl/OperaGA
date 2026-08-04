/* ══════════════════════════════════════════════════════════════════════════
   Carga los datos de ejemplo (los mismos del prototipo original) en un
   proyecto Supabase real, para poder probar la app con información visible.

   USO (tú lo corres, la service role key nunca se comparte en el chat):

     SUPABASE_URL=https://xxxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=pega-aqui-la-service-role-key \
     node scripts/seed-supabase.mjs

   La "service role key" está en Project Settings → API → Project API keys
   → service_role (NO la "anon"). Bypasa RLS, por eso solo se usa aquí, en tu
   máquina, y nunca en el frontend ni en este chat.

   seedData() (src/lib/seed.js) usa ids cortos fijos para empleados/propiedades
   /reservas/novedades/estadias (p.ej. 'e1', 'p1') porque así nació el
   prototipo — no son UUID válidos para las columnas `uuid` de Postgres. Este
   script los reemplaza por UUID reales y actualiza todas las referencias
   cruzadas (mayordomo, propiedad, empleado, reserva) para mantener la
   integridad referencial.

   Seguro de repetir: usa upsert por `id`/clave natural, así que volver a
   correrlo no duplica filas (sí generará UUID nuevos cada vez si la tabla
   está vacía; si ya sembraste una vez, bórralas antes de repetir).
   ══════════════════════════════════════════════════════════════════════════ */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { seedData } from '../src/lib/seed.js';
import { TABLAS } from '../src/lib/columnMap.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.');
  process.exitCode = 1;
} else {
  run().catch(err => { console.error('✗', err.message); process.exitCode = 1; });
}

async function run(){
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const db = seedData();

  // Mapas de id-corto-del-prototipo -> UUID real, para las entidades cuyo id
  // no venía de uid() (empleados/propiedades/reservas/novedades/estadias).
  const empMap = new Map(db.empleados.map(e => [e.id, randomUUID()]));
  const propMap = new Map(db.propiedades.map(p => [p.id, randomUUID()]));
  const resMap = new Map(db.reservas.map(r => [r.id, randomUUID()]));
  const novMap = new Map(db.novedades.map(n => [n.id, randomUUID()]));
  const estMap = new Map(db.estadias.map(e => [e.id, randomUUID()]));
  const emp = id => empMap.get(id) || id;
  const prop = id => (id ? (propMap.get(id) || id) : id);
  const res = id => (id ? (resMap.get(id) || id) : id);

  async function upsert(table, rows, conflictKey = 'id'){
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`✓ ${table}: ${rows.length} filas`);
  }

  // Orden respeta llaves foráneas. turnos_base y festivos ya quedaron en la
  // migración 0001, aquí solo se re-confirman (upsert, sin conflicto de PK).
  await upsert('empleados', db.empleados.map(o =>
    ({ id: emp(o.id), ...TABLAS.empleados.toRow(o) })));

  await upsert('propiedades', db.propiedades.map(o =>
    ({ id: prop(o.id), ...TABLAS.propiedades.toRow(o), mayordomo_id: o.mayordomo ? emp(o.mayordomo) : null })));

  await upsert('reservas', db.reservas.map(o =>
    ({ id: res(o.id), ...TABLAS.reservas.toRow(o), propiedad_id: prop(o.propiedad) })));

  await upsert('turnos_base', db.turnosT.map(o => ({ id: o.id, ...TABLAS.turnosT.toRow(o) })));

  await upsert('horarios', db.horarios.map(o =>
    ({ id: o.id, ...TABLAS.horarios.toRow(o), empleado_id: emp(o.emp) })));

  await upsert('asistencia', db.asistencia.map(o =>
    ({ id: o.id, ...TABLAS.asistencia.toRow(o), empleado_id: emp(o.empleado), propiedad_id: prop(o.propiedad) })));

  await upsert('novedades', db.novedades.map(o =>
    ({ id: novMap.get(o.id), ...TABLAS.novedades.toRow(o), empleado_id: emp(o.empleado) })));

  await upsert('estadias', db.estadias.map(o =>
    ({ id: estMap.get(o.id), ...TABLAS.estadias.toRow(o),
       empleado_id: emp(o.empleado), propiedad_id: prop(o.propiedad), reserva_id: res(o.reserva) })));

  await upsert('festivos', db.festivos.map(fecha => ({ fecha })), 'fecha');

  console.log('\nListo. Abre la app y deberías ver los mismos datos de ejemplo que tenía el prototipo.');
}
