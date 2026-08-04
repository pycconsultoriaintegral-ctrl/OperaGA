# Backups y recuperación — OPERA

## Dónde se guardan los backups

1. **Supabase (automático, plan Free)** — copias diarias, retención de 7 días.
   Panel: Project → Database → Backups. No requiere configuración.
2. **GitHub Actions (`.github/workflows/backup.yml`)** — dump completo cada
   noche (03:00 hora Colombia), guardado como artefacto del repo por 30 días.
   Es independiente de Supabase: si algo le pasara a la cuenta de Supabase
   (no al proyecto, a la cuenta), esta copia sigue existiendo.

## Frecuencia y retención

| Capa | Frecuencia | Retención | Recupera a un minuto exacto (PITR) |
|---|---|---|---|
| Supabase Free | Diaria | 7 días | No |
| GitHub Actions | Diaria | 30 días | No (solo el snapshot de esa noche) |
| Supabase Pro (futuro) | Continua | 7-28 días configurable | Sí |

Si más adelante se sube a plan Pro (~$25/mes/proyecto), se gana recuperación
a cualquier minuto de los últimos días, no solo al snapshot de la noche
anterior — recomendado antes de operar con nómina real en producción.

## Qué pasa si alguien borra información por error

- **Antes que nada:** casi todos los borrados en la app son lógicos —
  "Inactivar" un empleado no lo elimina, solo cambia su estado a INACTIVO.
  Esos casos se revierten en segundos desde el módulo Empleados, sin tocar
  backups.
- Si fue un `DELETE` real (ej. borrar una marcación desde Asistencia): la
  tabla `auditoria` (Fase 2) guarda el valor completo de la fila borrada en
  `valores_antes` — a veces alcanza con reinsertar ese JSON manualmente
  desde el SQL Editor, sin necesidad de restaurar todo el backup.
- Si el daño es mayor (borrado masivo, tabla completa, etc.): restaurar
  desde backup (ver procedimiento abajo).

## Procedimiento de restauración

### Opción A — Restaurar desde Supabase (recomendado, más simple)
1. Project → Database → Backups → elegir la fecha → **Restore**.
2. Supabase restaura sobre el mismo proyecto. **Esto reemplaza los datos
   actuales por los del backup** — avisar a todos los usuarios antes de
   hacerlo, porque perderán cualquier cambio hecho después de esa fecha.

### Opción B — Restaurar desde el dump de GitHub Actions (respaldo secundario)
1. En GitHub: pestaña **Actions** → el workflow "Backup nocturno..." →
   elegir la corrida → descargar el artefacto (`backup-opera-*.zip`).
2. Descomprimir, obtener el archivo `backup_opera_YYYY-MM-DD.sql`.
3. Restaurar contra el proyecto (necesitas `psql` instalado):
   ```bash
   psql "$DATABASE_URL" -f backup_opera_YYYY-MM-DD.sql
   ```
   `DATABASE_URL` es la cadena de conexión de Project Settings → Database →
   Connection string (la misma que se usa en el secreto `SUPABASE_DB_URL`).
4. **Recomendado antes de restaurar sobre una base con datos reales:**
   restaurar primero contra un proyecto Supabase nuevo/vacío para revisar
   que todo quedó bien, y solo después decidir si se aplica al real.

## Configuración pendiente (una sola vez, la haces tú)

Para que el GitHub Action funcione, agrega el secreto en el repo:

1. En Supabase: Project Settings → Database → **Connection string** (elige
   la variante "URI", modo *Session* o *Transaction pooler* — cualquiera
   sirve para `pg_dump`). Cópiala completa (incluye la contraseña de la
   base que definiste al crear el proyecto).
2. En GitHub: `github.com/pycconsultoriaintegral-ctrl/OperaGA` → **Settings →
   Secrets and variables → Actions → New repository secret**.
   - Name: `SUPABASE_DB_URL`
   - Value: pega la cadena de conexión completa.
3. Repite esto cuando tengas `opera-prod` en producción (con su propia
   cadena de conexión) — o crea un segundo workflow apuntando a prod.

No hace falta que me compartas esa cadena de conexión — la pegas
directamente en el campo de GitHub, nunca en este chat.
