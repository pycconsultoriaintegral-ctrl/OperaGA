-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Habilita de verdad el permiso 'empleados_publico'
-- La vista `empleados_publico` (0001_init.sql) ya excluía salario, banco,
-- cuenta, EPS/AFP/ARL — pero nunca tuvo una política RLS propia, así que un
-- rol con ver=true solo en 'empleados_publico' (ej. Supervisor) terminaba sin
-- poder leer nada de la tabla `empleados` salvo su propia fila (política
-- "propio" de 0006_acceso_operativo.sql). Por eso Mauricio Fuentes (Supervisor)
-- solo se veía a sí mismo en el listado de Empleados.
--
-- La vista pasa a `security_invoker = false`: corre con privilegios elevados
-- (bypassa el RLS de la tabla base) y filtra ELLA MISMA por has_permiso(), así
-- que sigue sin exponer columnas sensibles ni siquiera si alguien intenta
-- consultar `empleados` directamente (esa tabla sigue bloqueada a su propia
-- fila para estos roles).
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

create or replace view empleados_publico
with (security_invoker = false) as
select id, nombre, doc, tipo_doc, cargo, nacimiento, tel, email, dir, ingreso,
       contrato, estado, interno, foto_url, created_at, updated_at
from empleados
where has_permiso('empleados','ver') or has_permiso('empleados_publico','ver');

grant select on empleados_publico to authenticated;
