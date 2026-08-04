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

   Seguro de repetir contra una base ya sembrada: usa upsert por `id`/clave
   natural, así que volver a correrlo no duplica filas.
   ══════════════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { seedData } from '../src/lib/seed.js';
import { TABLAS, TABLAS_SYNCABLES } from '../src/lib/columnMap.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const db = seedData();

async function upsert(table, rows, conflictKey = 'id'){
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: ${rows.length} filas`);
}

async function main(){
  // Orden respeta llaves foráneas: empleados -> propiedades -> reservas ->
  // horarios/asistencia/estadias -> novedades. turnos_base y festivos ya
  // quedaron en la migración 0001, así que aquí solo se actualizan (upsert).
  await upsert('empleados', db.empleados.map(o => ({ id:o.id, ...TABLAS.empleados.toRow(o) })));
  await upsert('propiedades', db.propiedades.map(o => ({ id:o.id, ...TABLAS.propiedades.toRow(o) })));
  await upsert('reservas', db.reservas.map(o => ({ id:o.id, ...TABLAS.reservas.toRow(o) })));
  await upsert('turnos_base', db.turnosT.map(o => ({ id:o.id, ...TABLAS.turnosT.toRow(o) })));
  await upsert('horarios', db.horarios.map(o => ({ id:o.id, ...TABLAS.horarios.toRow(o) })));
  await upsert('asistencia', db.asistencia.map(o => ({ id:o.id, ...TABLAS.asistencia.toRow(o) })));
  await upsert('novedades', db.novedades.map(o => ({ id:o.id, ...TABLAS.novedades.toRow(o) })));
  await upsert('estadias', db.estadias.map(o => ({ id:o.id, ...TABLAS.estadias.toRow(o) })));
  await upsert('festivos', db.festivos.map(fecha => ({ fecha })), 'fecha');

  console.log('\nListo. Abre la app y deberías ver los mismos datos de ejemplo que tenía el prototipo.');
}

main().catch(err => { console.error('✗', err.message); process.exit(1); });
