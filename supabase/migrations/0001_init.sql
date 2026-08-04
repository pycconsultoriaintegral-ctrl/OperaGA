-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Fase 2 — Esquema inicial, roles/permisos, auditoría y RLS
-- Ejecutar completo en el SQL Editor de Supabase (proyecto opera-dev primero).
-- Es seguro volver a correrlo: usa IF NOT EXISTS / CREATE OR REPLACE donde aplica.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. ROLES Y PERMISOS
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists roles (
  id serial primary key,
  codigo text unique not null,          -- 'administrador' | 'gestion_humana' | 'supervisor' | 'consulta'
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create table if not exists permisos (
  id serial primary key,
  rol_id int not null references roles(id) on delete cascade,
  modulo text not null,                 -- 'empleados' | 'empleados_publico' | 'propiedades' | 'horarios'
                                         -- 'asistencia' | 'novedades' | 'liquidacion' | 'reportes'
                                         -- 'configuracion' | 'usuarios' | 'auditoria'
  ver boolean not null default false,
  crear boolean not null default false,
  editar boolean not null default false,
  eliminar boolean not null default false,
  exportar boolean not null default false,
  unique (rol_id, modulo)
);

-- Perfil de cada usuario autenticado (1:1 con auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol_id int not null references roles(id),
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Función central de autorización: se usa en TODAS las políticas RLS.
-- SECURITY DEFINER + STABLE para que pueda leer profiles/permisos sin
-- recursión de RLS y sea eficiente dentro de una misma consulta.
create or replace function has_permiso(p_modulo text, p_accion text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select case p_accion
        when 'ver'      then p.ver
        when 'crear'    then p.crear
        when 'editar'   then p.editar
        when 'eliminar' then p.eliminar
        when 'exportar' then p.exportar
        else false
     end
     from profiles pr
     join permisos p on p.rol_id = pr.rol_id and p.modulo = p_modulo
     where pr.id = auth.uid() and pr.estado = 'ACTIVO'),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. FUNCIONES DE APOYO: updated_at / updated_by automáticos + auditoría
-- ─────────────────────────────────────────────────────────────────────────

create or replace function fn_set_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create table if not exists auditoria (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  usuario_id uuid references auth.users(id),
  accion text not null,                 -- INSERT | UPDATE | DELETE
  entidad text not null,                -- nombre de la tabla
  entidad_id text,
  valores_antes jsonb,
  valores_despues jsonb
);

create or replace function fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auditoria(usuario_id, accion, entidad, entidad_id, valores_antes, valores_despues)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. TABLAS DE NEGOCIO
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  doc text not null unique,
  tipo_doc text not null default 'CC',
  cargo text not null,
  nacimiento date,
  tel text,
  email text,
  dir text,
  ingreso date not null,
  contrato text,
  salario numeric(14,2) not null default 0,
  eps text,
  afp text,
  arl text,
  banco text,
  cuenta text,
  contacto_emg text,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','INACTIVO')),
  interno boolean not null default false,
  foto_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists propiedades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  tipo text,
  ubicacion text,
  lat double precision,
  lng double precision,
  ips text[] not null default '{}',
  capacidad int,
  habitaciones int,
  banos int,
  estado text not null default 'DISPONIBLE',
  mayordomo_id uuid references empleados(id),
  tarifa numeric(14,2),
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades(id),
  huesped text not null,
  desde date not null,
  hasta date not null,
  huespedes int,
  canal text,
  valor numeric(14,2),
  estado text not null default 'CONFIRMADA',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists turnos_base (
  id text primary key,                  -- 'INT','MAN','DIA','TAR','NOC','DES','COM' (igual que el prototipo)
  label text not null,
  ini time,
  fin time,
  desc_min int not null default 0,
  color text,
  abrev text,
  interno boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists horarios (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  fecha date not null,
  turno_id text not null references turnos_base(id),
  unique (empleado_id, fecha),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists asistencia (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  propiedad_id uuid references propiedades(id),
  fecha date not null,
  tipo text not null,                   -- EFECTIVO | DISPONIBLE | DESCANSO | SUENO | ALIMENTACION | FUERA
  entrada time not null,
  salida time not null,
  metodo text not null default 'MANUAL',
  obs text,
  lat double precision,
  lng double precision,
  ip inet,
  validacion text,
  foto_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists novedades (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  tipo text not null,
  desde date not null,
  hasta date not null,
  dias numeric(6,1) not null default 0,
  motivo text not null,
  soporte text,
  estado text not null default 'PENDIENTE',
  aprobado_por uuid references auth.users(id),
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists estadias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  propiedad_id uuid not null references propiedades(id),
  reserva_id uuid references reservas(id),
  desde date not null,
  hasta date not null,
  estado text not null default 'PROGRAMADA',
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists festivos (
  fecha date primary key,
  descripcion text
);

create table if not exists configuracion (
  id smallint primary key default 1 check (id = 1),
  horas_semanales numeric not null default 42,
  horas_diarias numeric not null default 8,
  extras_max_dia numeric not null default 2,
  extras_max_semana numeric not null default 12,
  nocturno_inicio numeric not null default 19,
  nocturno_fin numeric not null default 6,
  rec_extra_diurna numeric not null default 25,
  rec_extra_nocturna numeric not null default 75,
  rec_nocturno numeric not null default 35,
  rec_dominical numeric not null default 90,
  max_jornada_diaria numeric not null default 10,
  pct_disponibilidad numeric not null default 30,
  descanso_min_diario numeric not null default 14,
  descanso_nocturno_min numeric not null default 8,
  dias_max_consecutivos numeric not null default 14,
  compensatorio_por_dia numeric not null default 0.5,
  comp_festivo numeric not null default 1,
  umbral_habitual numeric not null default 3,
  tolerancia_min numeric not null default 15,
  radio_geocerca numeric not null default 150,
  exigir_gps boolean not null default true,
  exigir_codigo boolean not null default true,
  exigir_foto boolean not null default false,
  divisor_hora numeric not null default 240,
  salario_minimo numeric not null default 1750905,
  aux_transporte numeric not null default 249095,
  tope_aux_transporte numeric not null default 2,
  moneda text not null default 'COP',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into configuracion (id) values (1) on conflict (id) do nothing;

-- Vista sin campos sensibles (salario, eps, afp, arl, banco, cuenta, contacto_emg)
-- para roles que solo necesitan ver nombre/cargo (ej. supervisor programando turnos).
create or replace view empleados_publico
with (security_invoker = true) as
select id, nombre, doc, tipo_doc, cargo, nacimiento, tel, email, dir, ingreso,
       contrato, estado, interno, foto_url, created_at, updated_at
from empleados;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS: updated_at/updated_by + auditoría en cada tabla de negocio
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['empleados','propiedades','reservas','turnos_base',
                            'horarios','asistencia','novedades','estadias']
  loop
    execute format('drop trigger if exists trg_updated on %I', t);
    execute format('create trigger trg_updated before update on %I
                     for each row execute function fn_set_updated()', t);
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit after insert or update or delete on %I
                     for each row execute function fn_audit()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────

alter table roles enable row level security;
alter table permisos enable row level security;
alter table profiles enable row level security;
alter table empleados enable row level security;
alter table propiedades enable row level security;
alter table reservas enable row level security;
alter table turnos_base enable row level security;
alter table horarios enable row level security;
alter table asistencia enable row level security;
alter table novedades enable row level security;
alter table estadias enable row level security;
alter table festivos enable row level security;
alter table configuracion enable row level security;
alter table auditoria enable row level security;

-- roles / permisos: cualquier usuario autenticado puede leer (necesario para
-- que el frontend arme la matriz de permisos); solo 'usuarios' puede escribir.
drop policy if exists roles_select on roles;
create policy roles_select on roles for select to authenticated using (true);
drop policy if exists roles_write on roles;
create policy roles_write on roles for all to authenticated
  using (has_permiso('usuarios','editar')) with check (has_permiso('usuarios','editar'));

drop policy if exists permisos_select on permisos;
create policy permisos_select on permisos for select to authenticated using (true);
drop policy if exists permisos_write on permisos;
create policy permisos_write on permisos for all to authenticated
  using (has_permiso('usuarios','editar')) with check (has_permiso('usuarios','editar'));

-- profiles: cada quien ve su propio perfil; 'usuarios' ve y administra todos.
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select to authenticated
  using (id = auth.uid() or has_permiso('usuarios','ver'));
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all to authenticated
  using (has_permiso('usuarios','editar')) with check (has_permiso('usuarios','editar'));

-- Tablas de negocio: patrón idéntico ver/crear/editar/eliminar por módulo.
drop policy if exists empleados_select on empleados;
create policy empleados_select on empleados for select to authenticated using (has_permiso('empleados','ver'));
drop policy if exists empleados_insert on empleados;
create policy empleados_insert on empleados for insert to authenticated with check (has_permiso('empleados','crear'));
drop policy if exists empleados_update on empleados;
create policy empleados_update on empleados for update to authenticated using (has_permiso('empleados','editar'));
drop policy if exists empleados_delete on empleados;
create policy empleados_delete on empleados for delete to authenticated using (has_permiso('empleados','eliminar'));

drop policy if exists propiedades_select on propiedades;
create policy propiedades_select on propiedades for select to authenticated using (has_permiso('propiedades','ver'));
drop policy if exists propiedades_insert on propiedades;
create policy propiedades_insert on propiedades for insert to authenticated with check (has_permiso('propiedades','crear'));
drop policy if exists propiedades_update on propiedades;
create policy propiedades_update on propiedades for update to authenticated using (has_permiso('propiedades','editar'));
drop policy if exists propiedades_delete on propiedades;
create policy propiedades_delete on propiedades for delete to authenticated using (has_permiso('propiedades','eliminar'));

drop policy if exists reservas_select on reservas;
create policy reservas_select on reservas for select to authenticated using (has_permiso('propiedades','ver'));
drop policy if exists reservas_insert on reservas;
create policy reservas_insert on reservas for insert to authenticated with check (has_permiso('propiedades','crear'));
drop policy if exists reservas_update on reservas;
create policy reservas_update on reservas for update to authenticated using (has_permiso('propiedades','editar'));
drop policy if exists reservas_delete on reservas;
create policy reservas_delete on reservas for delete to authenticated using (has_permiso('propiedades','eliminar'));

drop policy if exists turnos_select on turnos_base;
create policy turnos_select on turnos_base for select to authenticated using (has_permiso('horarios','ver'));
drop policy if exists turnos_write on turnos_base;
create policy turnos_write on turnos_base for all to authenticated
  using (has_permiso('horarios','editar')) with check (has_permiso('horarios','editar'));

drop policy if exists horarios_select on horarios;
create policy horarios_select on horarios for select to authenticated using (has_permiso('horarios','ver'));
drop policy if exists horarios_insert on horarios;
create policy horarios_insert on horarios for insert to authenticated with check (has_permiso('horarios','crear'));
drop policy if exists horarios_update on horarios;
create policy horarios_update on horarios for update to authenticated using (has_permiso('horarios','editar'));
drop policy if exists horarios_delete on horarios;
create policy horarios_delete on horarios for delete to authenticated using (has_permiso('horarios','eliminar'));

drop policy if exists asistencia_select on asistencia;
create policy asistencia_select on asistencia for select to authenticated using (has_permiso('asistencia','ver'));
drop policy if exists asistencia_insert on asistencia;
create policy asistencia_insert on asistencia for insert to authenticated with check (has_permiso('asistencia','crear'));
drop policy if exists asistencia_update on asistencia;
create policy asistencia_update on asistencia for update to authenticated using (has_permiso('asistencia','editar'));
drop policy if exists asistencia_delete on asistencia;
create policy asistencia_delete on asistencia for delete to authenticated using (has_permiso('asistencia','eliminar'));

drop policy if exists novedades_select on novedades;
create policy novedades_select on novedades for select to authenticated using (has_permiso('novedades','ver'));
drop policy if exists novedades_insert on novedades;
create policy novedades_insert on novedades for insert to authenticated with check (has_permiso('novedades','crear'));
drop policy if exists novedades_update on novedades;
create policy novedades_update on novedades for update to authenticated using (has_permiso('novedades','editar'));
drop policy if exists novedades_delete on novedades;
create policy novedades_delete on novedades for delete to authenticated using (has_permiso('novedades','eliminar'));

drop policy if exists estadias_select on estadias;
create policy estadias_select on estadias for select to authenticated using (has_permiso('asistencia','ver'));
drop policy if exists estadias_insert on estadias;
create policy estadias_insert on estadias for insert to authenticated with check (has_permiso('asistencia','crear'));
drop policy if exists estadias_update on estadias;
create policy estadias_update on estadias for update to authenticated using (has_permiso('asistencia','editar'));
drop policy if exists estadias_delete on estadias;
create policy estadias_delete on estadias for delete to authenticated using (has_permiso('asistencia','eliminar'));

drop policy if exists festivos_select on festivos;
create policy festivos_select on festivos for select to authenticated using (true);
drop policy if exists festivos_write on festivos;
create policy festivos_write on festivos for all to authenticated
  using (has_permiso('configuracion','editar')) with check (has_permiso('configuracion','editar'));

drop policy if exists config_select on configuracion;
create policy config_select on configuracion for select to authenticated using (true);
drop policy if exists config_write on configuracion;
create policy config_write on configuracion for update to authenticated
  using (has_permiso('configuracion','editar')) with check (has_permiso('configuracion','editar'));

-- auditoria: solo lectura para quien tenga permiso 'auditoria'.'ver'; nadie
-- inserta directo (las filas las crea fn_audit(), que corre como SECURITY DEFINER).
drop policy if exists auditoria_select on auditoria;
create policy auditoria_select on auditoria for select to authenticated using (has_permiso('auditoria','ver'));

-- ─────────────────────────────────────────────────────────────────────────
-- 6. DATOS SEMILLA: roles, matriz de permisos por defecto y plantillas de turno
-- ─────────────────────────────────────────────────────────────────────────

insert into roles (codigo, nombre, descripcion) values
  ('administrador','Administrador','Acceso total al sistema'),
  ('gestion_humana','Gestión Humana','Empleados, novedades, nómina y usuarios'),
  ('supervisor','Supervisor','Turnos, asistencia y novedades operativas'),
  ('consulta','Consulta','Solo lectura, sin datos sensibles ni exportación')
on conflict (codigo) do nothing;

-- Matriz de permisos por defecto (ajustable después desde la tabla `permisos`)
insert into permisos (rol_id, modulo, ver, crear, editar, eliminar, exportar)
select r.id, m.modulo, true, true, true, true, true
from roles r, (values
  ('empleados'),('empleados_publico'),('propiedades'),('horarios'),('asistencia'),
  ('novedades'),('liquidacion'),('reportes'),('configuracion'),('usuarios'),('auditoria')
) as m(modulo)
where r.codigo = 'administrador'
on conflict (rol_id, modulo) do nothing;

insert into permisos (rol_id, modulo, ver, crear, editar, eliminar, exportar)
select r.id, m.modulo, true, true, true, false, true
from roles r, (values
  ('empleados'),('empleados_publico'),('novedades'),('liquidacion'),('reportes'),('usuarios')
) as m(modulo)
where r.codigo = 'gestion_humana'
on conflict (rol_id, modulo) do nothing;

insert into permisos (rol_id, modulo, ver, crear, editar, eliminar, exportar)
select r.id, m.modulo, true, true, true, false, true
from roles r, (values
  ('empleados_publico'),('propiedades'),('horarios'),('asistencia'),('novedades'),('reportes')
) as m(modulo)
where r.codigo = 'supervisor'
on conflict (rol_id, modulo) do nothing;

insert into permisos (rol_id, modulo, ver, crear, editar, eliminar, exportar)
select r.id, m.modulo, true, false, false, false, false
from roles r, (values
  ('empleados_publico'),('propiedades'),('horarios'),('asistencia'),('novedades'),('reportes')
) as m(modulo)
where r.codigo = 'consulta'
on conflict (rol_id, modulo) do nothing;

insert into turnos_base (id, label, ini, fin, desc_min, color, abrev, interno) values
  ('INT','Interno en propiedad','06:00','06:00',0,'brand','INT',true),
  ('MAN','Mañana','07:00','16:00',60,'amber','MAN',false),
  ('DIA','Diurno','08:00','17:00',60,'sky','DIA',false),
  ('TAR','Tarde','14:00','22:00',60,'orange','TAR',false),
  ('NOC','Nocturno','22:00','06:00',60,'violet','NOC',false),
  ('DES','Descanso',null,null,0,'slate','DES',false),
  ('COM','Compensatorio',null,null,0,'teal','COM',false)
on conflict (id) do nothing;

-- Festivos Colombia 2026-2027 (Ley 51/1983 — Ley Emiliani)
insert into festivos (fecha) values
  ('2026-01-01'),('2026-01-12'),('2026-03-23'),('2026-04-02'),('2026-04-03'),
  ('2026-05-01'),('2026-05-18'),('2026-06-08'),('2026-06-15'),('2026-06-29'),
  ('2026-07-20'),('2026-08-07'),('2026-08-17'),('2026-10-12'),('2026-11-02'),
  ('2026-11-16'),('2026-12-08'),('2026-12-25'),
  ('2027-01-01'),('2027-01-11'),('2027-03-22'),('2027-03-25'),('2027-03-26'),
  ('2027-05-01'),('2027-05-10'),('2027-05-31'),('2027-06-07'),('2027-07-05'),
  ('2027-07-20'),('2027-08-07'),('2027-08-16'),('2027-10-18'),('2027-11-01'),
  ('2027-11-15'),('2027-12-08'),('2027-12-25')
on conflict (fecha) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. IMPORTANTE — paso manual pendiente
-- ─────────────────────────────────────────────────────────────────────────
-- Este script NO crea ningún usuario. Debes:
--   1. Crear tu primer usuario en Authentication → Users → "Add user" (con tu
--      correo pycconsultoriaintegral@gmail.com).
--   2. Copiar el UUID de ese usuario.
--   3. Ejecutar (reemplazando el UUID):
--        insert into profiles (id, nombre, rol_id)
--        select 'PEGA-AQUI-EL-UUID'::uuid, 'PYC Consultoria Integral SAS', id
--        from roles where codigo = 'administrador';
-- Sin esta fila en `profiles`, has_permiso() siempre devuelve false y ese
-- usuario no vería ningún dato aunque inicie sesión correctamente.
