# OPERA · Gestión de Personal Operativo

Aplicación web para la gestión de personal operativo de propiedades de alquiler vacacional (Grupo Américas). Liquida nómina conforme a la Ley 2101/2021 y Ley 2466/2025 (Colombia), controla asistencia con geocerca, horarios, novedades y estadías de trabajadores internos.

## Origen de este proyecto

Este proyecto es la evolución de un prototipo funcional de un único archivo HTML (`OPERA - Gestion de Personal.html`, conservado como referencia en la carpeta original) hacia una aplicación web multiusuario real: backend centralizado, autenticación, roles/permisos y auditoría, en lugar de datos guardados solo en el navegador. El plan completo de migración está en `PRODUCCION_CHECKLIST.md` (se genera al final del proceso).

## Desarrollo local

```bash
npm install
npm run dev
```

## Pruebas

```bash
npm run test
```

Cubre el motor de liquidación de nómina (`src/lib/payroll.js`) — la lógica de mayor riesgo legal/financiero del sistema.

## Estado actual (Fase 0)

La app corre sobre datos de ejemplo persistidos en `localStorage`, igual que el prototipo original — todavía no está conectada a una base de datos centralizada. Eso se resuelve en las fases siguientes descritas en el plan de migración.
