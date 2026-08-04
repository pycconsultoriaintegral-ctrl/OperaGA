-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Fase 4 — Habilitar Realtime en las tablas operativas
-- Sin esto, los cambios de un usuario no se reflejan en vivo para los demás:
-- Supabase solo transmite por Realtime las tablas agregadas a esta publicación.
-- Ejecutar en el SQL Editor de opera-dev (y luego opera-prod).
-- ══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table
  empleados, propiedades, reservas, turnos_base, horarios,
  asistencia, novedades, estadias, festivos, configuracion;
