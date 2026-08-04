-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Fase 8b — Gestión de usuarios desde la app
-- Guarda el correo en profiles (antes solo vivía en auth.users, ilegible
-- con la anon key) para poder mostrarlo en la pantalla de Usuarios.
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

alter table profiles add column if not exists email text;

-- Backfill del único perfil que ya existe (el administrador creado a mano
-- en la Fase 3). Para usuarios nuevos, la Edge Function lo llena solo.
update profiles set email = 'pycconsultoriaintegral@gmail.com'
where email is null and nombre = 'PYC Consultoria Integral SAS';
