# Reporte de migración de datos reales — 2026-08-04

Migración de "ROTACIÓN Y DESCANSOS (1).xlsx" (12 meses, ago/2025–jul/2026) y el
reporte de empleados de Siigo hacia el proyecto Supabase `opera-dev`, usando
`scripts/migrar_datos_reales.py`.

## Antes de migrar
- Se hizo respaldo lógico: Supabase conserva PITR/backups automáticos del
  proyecto independientemente de esta migración (ver Fase 6 del plan).
- Se limpiaron los datos de ejemplo ficticios de la Fase 4 (`empleados`,
  `propiedades`, `reservas`, `horarios`, `asistencia`, `novedades`,
  `estadias`) antes de insertar los reales, con confirmación explícita del
  usuario. No se tocaron `roles`, `permisos`, `turnos_base`, `festivos`,
  `configuracion` ni `profiles`.

## Resultado
| Tabla | Filas | Notas |
|---|---|---|
| empleados | 13 | 11 activos + 2 inactivos (Alex Casseres, Heberth Avilez) con historial |
| propiedades | 6 | Casa Sol, Casa Luna, Casa Oasis, Casa Lotus, Casa Melía, Casa Milagros |
| horarios | 3,589 | Normal/Rotación/Salida → turno Diurno · Descanso → turno Descanso · Reserva → turno Interno |
| novedades | 22 | Vacaciones/Incapacidad/Permiso, agrupadas en rangos continuos (no un registro por día) |
| estadias | 295 | Rangos continuos de días "en reserva" por empleado y propiedad |

## Decisiones tomadas con el usuario durante la migración
- **Ana** (Casa Luna) y **Hueso** (Mantenimiento): no se pudo verificar su
  identidad contra el reporte de Siigo — quedaron **fuera** de esta
  migración. Sus turnos en el archivo de origen no se importaron. Deben
  crearse manualmente cuando se tenga su documento real.
- **Douglas Mendoza, Camila Saumeth, Juan Carlos Rodríguez**: activos en
  Siigo pero no aparecían en la hoja de julio 2026 revisada inicialmente —
  quedaron pendientes, no se crearon en esta migración.
- **Alex Casseres y Heberth Avilez**: contratos ya terminados en Siigo, pero
  con historial real de turnos → se crearon como `estado = INACTIVO` para
  conservar la trazabilidad de sus horas trabajadas.
- **EPS / AFP / ARL**: no vienen en ninguna de las dos fuentes → quedaron en
  blanco para los 13 empleados. **Pendiente**: completarlos manualmente
  desde el módulo Empleados antes de liquidar nómina real, porque
  `aportes()` en `src/lib/payroll.js` no depende de estos campos para
  calcular, pero sí son obligatorios para la afiliación real del trabajador.
- **Rotación / Salida** (estados del archivo original): confirmado con el
  usuario que representan jornada normal (ej. 8:00–17:00); el nombre solo
  indica que ese día entra o sale un huésped de la reserva. Se mapearon al
  mismo turno "Diurno" que "Normal".

## Cómo se reconstruyeron las fechas
Los encabezados de semana del Excel traían inconsistencias (algunos con
errores tipográficos de mes en semanas que cruzan de un mes a otro). Se
resolvió confiando solo en la fecha de inicio del primer bloque de cada
hoja (con el nombre del mes correcto) y calculando el resto por aritmética
de calendario (+7 días por bloque semanal). Se validó automáticamente contra
el nombre del día de la semana de cada columna — **0 inconsistencias** en
las 12 hojas antes de escribir cualquier dato.

## Pendientes conocidos
- Completar EPS/AFP/ARL de los 13 empleados.
- Decidir qué hacer con Ana, Hueso, Douglas, Camila y Juan Carlos.
- Las propiedades se crearon con datos mínimos (nombre y código) — falta
  ubicación, capacidad, habitaciones, baños y tarifa; se pueden completar
  desde el módulo Propiedades.
- Este script no es completamente idempotente para `novedades` y `estadias`
  (usa un UUID nuevo en cada corrida) — no se debe volver a correr con
  `--write` sin borrar antes esas tablas, o se duplicarán las filas.
