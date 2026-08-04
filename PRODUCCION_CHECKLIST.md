# PRODUCCIÓN_CHECKLIST — OPERA · Gestión de Personal Operativo

Auditoría técnica al cierre del proyecto de migración de un prototipo HTML de un
solo archivo (`OPERA - Gestion de Personal.html`, con datos solo en el navegador)
a una aplicación web real, multiusuario, con base de datos centralizada,
autenticación, roles/permisos, auditoría, backups y despliegue en producción.

**Estado general: en producción, con datos reales, con pendientes documentados
abajo que deben resolverse antes de considerarlo completamente cerrado.**

---

## 1. Arquitectura

- **Frontend**: React 18 + Vite + Tailwind CSS (build real, sin CDN). Código en
  `src/`, mismo diseño visual y misma lógica de negocio que el prototipo
  original — solo cambió la fuente de datos.
- **Backend**: Supabase (Postgres administrado + Auth + Row Level Security +
  Realtime). Sin servidor propio que mantener.
- **Sincronización**: `src/data/useRemoteDB.js` reemplaza el `localStorage`
  original — carga desde Supabase, sincroniza cambios por diferencia (solo
  lo que cambió) y se suscribe a Realtime para reflejar en vivo lo que
  hacen otros usuarios.
- **Hosting**: Vercel, desplegado desde GitHub (`main` → producción
  automática en cada push).
- **Repositorio**: `github.com/pycconsultoriaintegral-ctrl/OperaGA` (privado).

## 2. Servicios utilizados

| Servicio | Para qué | Plan actual |
|---|---|---|
| Supabase (`opera-dev`) | Base de datos, autenticación, RLS, Realtime — **operando como producción por decisión explícita del usuario** | Free |
| Supabase (`opera-prod`) | Creado pero sin usar — sin esquema ni datos | Free |
| Vercel | Hosting del frontend | Free |
| GitHub | Repositorio + Actions (backup nocturno) | Free |

⚠️ **Nota de nomenclatura**: el proyecto llamado `opera-dev` es, en la
práctica, la base de producción real. `opera-prod` quedó sin usar. Si más
adelante se quiere separar dev/dev real de producción de verdad, hay que
migrar esquema + datos a `opera-prod` y repetir la Fase 7 apuntando allá.

## 3. Base de datos

Esquema en `supabase/migrations/0001_init.sql` y `0002_realtime.sql`. Tablas:
`roles`, `permisos`, `profiles`, `empleados`, `propiedades`, `reservas`,
`turnos_base`, `horarios`, `asistencia`, `novedades`, `estadias`,
`configuracion`, `festivos`, `auditoria`.

- Todas las tablas de negocio tienen `created_at/by`, `updated_at/by` y
  borrado lógico (`estado`/`activo`) en vez de `DELETE` físico donde el
  prototipo original ya lo hacía así (empleados).
- `empleados_publico`: vista sin salario/EPS/AFP/ARL/banco/cuenta, para
  roles que no necesitan ver información financiera.
- Datos reales cargados: 13 empleados, 6 propiedades, 3,589 turnos
  programados, 22 novedades, 295 estadías (ver
  `supabase/MIGRACION_2026-08-04.md` para el detalle completo y las
  decisiones tomadas durante la migración).

## 4. Autenticación

Supabase Auth (email + contraseña). Implementado en `src/auth/`:
login, logout, recuperación de contraseña (con correo real), sesión
persistente. **Probado en producción por el usuario** con el usuario
administrador.

## 5. Usuarios y permisos

- Roles creados: `administrador`, `gestion_humana`, `supervisor`, `consulta`,
  cada uno con una matriz de permisos (ver/crear/editar/eliminar/exportar)
  por módulo en la tabla `permisos`.
- La autorización real ocurre en **Row Level Security de Postgres**, no solo
  en el frontend — un usuario sin permiso no puede leer/escribir esas filas
  aunque manipule la app o llame a la API directamente.
- El menú lateral se filtra según el rol (cosmético, refuerza la RLS).

⚠️ **Pendiente real**: no existe una pantalla en la app para crear usuarios,
cambiar su rol o desactivarlos — hoy se hace manualmente: crear el usuario
en Supabase Authentication → Users, y luego un `INSERT` en `profiles` por
SQL Editor (procedimiento documentado en los mensajes de la Fase 3). Esto
funciona pero no es una experiencia de administración real. Ver
recomendaciones.

## 6. Seguridad

- HTTPS automático (Vercel + Supabase).
- La única clave en el frontend es la `anon key` de Supabase, diseñada para
  ser pública — la protección real la da RLS.
- La `service_role key` (que sí bypasa toda seguridad) y la contraseña de la
  base de datos **nunca deben usarse en el frontend**. Se usaron dos veces
  durante este proyecto para scripts de migración locales, tal como estaba
  planeado.
- Variables de entorno separadas (`.env.local`, nunca comiteadas —
  `.gitignore` las excluye).

🚨 **Acción pendiente del usuario**: la `service_role key` de `opera-dev`
quedó pegada en este chat en dos ocasiones durante el proceso. Se recomendó
rotarla (Supabase → Project Settings → API → `service_role` → regenerar) y
no quedó confirmado si se hizo. **Hazlo antes de dar por cerrado el
proyecto.**

## 7. Auditoría

Trigger automático (`fn_audit()`) en Postgres registra cada `INSERT`,
`UPDATE` y `DELETE` de las tablas de negocio en la tabla `auditoria`
(quién, cuándo, qué cambió, valores antes/después) — no depende de que el
frontend recuerde registrar nada. Visible (solo lectura) desde
Configuración → Auditoría para quien tenga el permiso correspondiente.

## 8. Backups

- Supabase automático: copias diarias, retención de 7 días (plan Free).
- GitHub Actions (`.github/workflows/backup.yml`): dump nocturno
  independiente, guardado como artefacto por 30 días. **Probado y
  funcionando** (corrida verde con artefacto descargable).
- Procedimiento de restauración documentado en `supabase/BACKUPS.md`.
- Sin plan Pro de Supabase todavía → **no hay recuperación a un minuto
  exacto (PITR)**, solo al snapshot más reciente. Ver recomendaciones.

## 9. Variables de entorno

| Variable | Dónde vive | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` (local) y Vercel (producción) | `https://onawuutyjuevuivaxsqa.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` y Vercel | clave pública, segura de compartir |
| `SUPABASE_DB_URL` | Secreto de GitHub Actions | cadena de conexión del *pooler* (no la directa — la directa es IPv6-only y GitHub Actions no tiene salida IPv6) |

## 10. Despliegue

- Producción: **https://opera-ga.vercel.app** — desplegado y verificado
  (login, datos reales, sin errores de consola).
- Cada push a `main` en GitHub despliega automáticamente en Vercel.
- Sin dominio propio todavía (decisión explícita del usuario: seguir con el
  subdominio de Vercel por ahora).

## 11. Dominio

No configurado. Cuando se compre uno, agregarlo en Vercel → Project →
Settings → Domains, y apuntar los registros DNS que Vercel indique.

## 12. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Motor de liquidación (22 tests unitarios) | ✅ pasan |
| Build de producción | ✅ sin errores |
| Login correcto (usuario admin) | ✅ confirmado por el usuario |
| Recuperación de contraseña | ✅ confirmado, en local y en producción |
| Cierre de sesión | ✅ confirmado |
| Multiusuario en tiempo real (2 pestañas) | ✅ confirmado con datos de ejemplo |
| RLS bloqueando acceso sin permiso | ⚠️ verificado por diseño (políticas creadas y probadas en desarrollo), **no probado con un usuario real de rol distinto a administrador** |
| Crear/editar/desactivar usuario desde la app | ❌ no existe esa pantalla (ver sección 5) |
| Backup automático nocturno | ✅ corrida verde, artefacto generado |
| Restauración desde backup | ⚠️ documentada, **no ejecutada nunca en la práctica** |
| Despliegue en producción | ✅ confirmado por el usuario, sin errores de consola |

## 13. Riesgos pendientes

1. **Un solo usuario probado** (administrador). Los roles `supervisor`,
   `gestion_humana` y `consulta` tienen permisos definidos en la base pero
   nadie ha iniciado sesión con ellos para confirmar que el filtrado
   funciona como se espera en la práctica.
2. **Sin pantalla de administración de usuarios** — alta fricción operativa
   si se necesita dar de alta gente seguido.
3. **`service_role key` potencialmente expuesta** en el historial de este
   chat — pendiente confirmar rotación.
4. **Sin PITR** (plan Free) — ante un error grave, la recuperación es al
   snapshot más reciente, no a un minuto exacto.
5. **Datos incompletos de 13 empleados**: EPS/AFP/ARL en blanco — no se
   puede liquidar/afiliar formalmente hasta completarlos.
6. **Cinco personas pendientes de decisión**: Ana, Hueso, Douglas, Camila y
   Juan Carlos no se cargaron en la migración por no poder verificar su
   identidad — ver `supabase/MIGRACION_2026-08-04.md`.
7. **Sin marcaciones reales todavía** — Liquidación muestra $0 porque el
   archivo migrado era la programación planeada (`horarios`), no
   marcaciones reales (`asistencia`). Hay que empezar a registrar
   asistencia real desde ahora para que la nómina calcule.
8. **Restauración de backup nunca probada en la práctica** — solo
   documentada.
9. **Validación legal pendiente**: como ya advertía el prototipo original,
   la interpretación normativa (mayordomos internos, disponibilidad,
   compensatorios) debe confirmarla un abogado laboralista antes de usarse
   para decisiones reales de nómina.

## 14. Recomendaciones futuras

- Construir la pantalla de administración de usuarios (crear, cambiar rol,
  desactivar) — hoy es 100% manual vía SQL.
- Probar el sistema con una cuenta de cada rol antes de dar acceso real a
  supervisores/gestión humana.
- Subir `opera-dev` (o el proyecto que se use como producción real) a plan
  Pro de Supabase (~US$25/mes) antes de operar nómina real, para tener PITR.
- Hacer un simulacro real de restauración de backup al menos una vez.
- Completar EPS/AFP/ARL de los 13 empleados migrados.
- Resolver la identidad de Ana, Hueso, Douglas, Camila y Juan Carlos y
  decidir si se cargan.
- Empezar a capturar asistencia real (marcaciones) para que Liquidación deje
  de mostrar $0.
- Cuando haya presupuesto, comprar el dominio propio y conectarlo en Vercel.
- Validar con un abogado laboralista la interpretación normativa que ya
  traía el prototipo (Ley 2101/2021, Ley 2466/2025) antes de usar el
  sistema para decisiones reales de nómina.
- Code-splitting del bundle de producción (hoy ~550 KB) si el tiempo de
  carga se vuelve un problema — no es urgente todavía.
