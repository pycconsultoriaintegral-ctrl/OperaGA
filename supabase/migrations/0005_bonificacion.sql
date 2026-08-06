-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Bonificación fija (para empleados administrativos)
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

alter table empleados add column if not exists bonificacion numeric(14,2) not null default 0;
