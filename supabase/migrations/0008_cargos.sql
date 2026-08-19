-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Cargos administrables desde la plataforma
-- Antes CARGOS era una lista fija en el código (Mayordomo, Mucama, Conductor,
-- Mantenimiento, Supervisor, Administrativo). Ahora vive en esta tabla para
-- que se puedan crear cargos nuevos desde Configuración → Cargos, sin tocar código.
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists cargos (
  id serial primary key,
  nombre text unique not null,
  created_at timestamptz not null default now()
);

insert into cargos (nombre) values
  ('Mayordomo'),('Mucama'),('Conductor'),('Mantenimiento'),('Supervisor'),('Administrativo')
on conflict (nombre) do nothing;

alter table cargos enable row level security;

-- Cualquier usuario autenticado puede leer (lo necesita el formulario de
-- Empleados); solo quien tenga permiso 'empleados'.'editar' puede administrar.
drop policy if exists cargos_select on cargos;
create policy cargos_select on cargos for select to authenticated using (true);
drop policy if exists cargos_write on cargos;
create policy cargos_write on cargos for all to authenticated
  using (has_permiso('empleados','editar')) with check (has_permiso('empleados','editar'));

alter publication supabase_realtime add table cargos;
