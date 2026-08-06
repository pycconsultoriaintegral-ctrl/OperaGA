-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Acceso individual del personal operativo
-- Vincula una cuenta de acceso (profiles) con su ficha de empleado, para que
-- puedan ver SOLO su propio horario y marcar SOLO su propia asistencia,
-- aunque su rol no tenga permiso amplio sobre esos módulos.
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

alter table profiles add column if not exists empleado_id uuid references empleados(id);

-- Rol de conveniencia para personal operativo: solo necesita ver su horario
-- y marcar su propia asistencia. (Vincular profiles.empleado_id funciona con
-- cualquier rol, este es solo un preset con permisos mínimos.)
-- Sin filas en `permisos` a propósito: el rol 'operativo' no tiene ningún
-- permiso amplio (ver todo/crear todo) — su acceso a horarios/asistencia
-- viene ÚNICAMENTE de las políticas "propio" de abajo, que lo restringen a
-- sus propias filas. Si le diéramos aquí ver=true de una vez vería el
-- horario y la asistencia de TODOS, no solo lo suyo.
insert into roles (codigo, nombre, descripcion) values
  ('operativo', 'Operativo', 'Personal operativo: ve su horario y marca su propia asistencia')
on conflict (codigo) do nothing;

-- ── Políticas adicionales "propio" — se suman (OR) a las que ya existen
-- basadas en has_permiso(), sin reemplazarlas. Un administrador/supervisor
-- sigue viendo todo por su permiso amplio; alguien vinculado a un empleado
-- ve además su propio registro aunque su rol no tenga el permiso general.

drop policy if exists empleados_select_propio on empleados;
create policy empleados_select_propio on empleados for select to authenticated
  using (id = (select empleado_id from profiles where id = auth.uid()));

drop policy if exists horarios_select_propio on horarios;
create policy horarios_select_propio on horarios for select to authenticated
  using (empleado_id = (select empleado_id from profiles where id = auth.uid()));

drop policy if exists asistencia_select_propio on asistencia;
create policy asistencia_select_propio on asistencia for select to authenticated
  using (empleado_id = (select empleado_id from profiles where id = auth.uid()));

drop policy if exists asistencia_insert_propio on asistencia;
create policy asistencia_insert_propio on asistencia for insert to authenticated
  with check (empleado_id = (select empleado_id from profiles where id = auth.uid()));

drop policy if exists asistencia_update_propio on asistencia;
create policy asistencia_update_propio on asistencia for update to authenticated
  using (empleado_id = (select empleado_id from profiles where id = auth.uid()));

-- También necesitan leer las propiedades (para el kiosco de marcación) y los
-- turnos (para interpretar su horario) — esto sí es información no sensible,
-- se las damos a cualquier usuario autenticado con perfil activo.
drop policy if exists propiedades_select_autenticado on propiedades;
create policy propiedades_select_autenticado on propiedades for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and estado = 'ACTIVO'));

drop policy if exists turnos_select_autenticado on turnos_base;
create policy turnos_select_autenticado on turnos_base for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and estado = 'ACTIVO'));
