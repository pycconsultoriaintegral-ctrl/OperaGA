-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · El Supervisor puede quitar turnos, no solo ponerlos
-- Ejecutar en el SQL Editor de Supabase (es idempotente: se puede correr
-- varias veces sin problema).
-- ══════════════════════════════════════════════════════════════════════════
--
-- El seed de 0001_init.sql le dio al rol 'supervisor' ver/crear/editar/exportar
-- sobre 'horarios', pero NO 'eliminar'. En el programador de turnos, volver a
-- hacer clic sobre una celda con el mismo turno significa QUITARLO, y eso es un
-- DELETE. Sin el permiso, la política RLS dejaba ese DELETE en 0 filas — y un
-- DELETE que no borra nada no devuelve error, así que la app lo daba por hecho,
-- la celda desaparecía de la pantalla y al recargar el turno volvía a aparecer.
--
-- El Supervisor es el responsable de la programación de cada persona, así que
-- debe poder tanto poner como quitar turnos.

update permisos p
   set eliminar = true
  from roles r
 where p.rol_id = r.id
   and r.codigo = 'supervisor'
   and p.modulo = 'horarios'
   and p.eliminar is distinct from true;

-- Si por alguna razón no existiera la fila de permisos, crearla completa.
insert into permisos (rol_id, modulo, ver, crear, editar, eliminar, exportar)
select r.id, 'horarios', true, true, true, true, true
  from roles r
 where r.codigo = 'supervisor'
on conflict (rol_id, modulo) do update set eliminar = true;

-- Comprobación: debe devolver una fila con eliminar = true
--   select r.codigo, p.modulo, p.ver, p.crear, p.editar, p.eliminar
--     from permisos p join roles r on r.id = p.rol_id
--    where r.codigo = 'supervisor' and p.modulo = 'horarios';
