/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTES NORMATIVAS  ·  Colombia — Ley 2101/2021 · Ley 2466/2025
   Portado literalmente desde el prototipo original (sin cambios de lógica).
   ══════════════════════════════════════════════════════════════════════════ */

export const CONFIG_DEFAULT = {
  // Jornada (Ley 2101 de 2021 — 42h desde jul 15/2026)
  horasSemanales: 42,
  horasDiarias: 8,
  extrasMaxDia: 2,
  extrasMaxSemana: 12,
  // Franja nocturna (Ley 2466/2025 — desde dic 25/2025 inicia 7:00 pm)
  nocturnoInicio: 19,
  nocturnoFin: 6,
  // Recargos % (vigentes jul 2026)
  recExtraDiurna: 25,
  recExtraNocturna: 75,
  recNocturno: 35,
  recDominical: 90,
  // Tope absoluto de jornada diaria (8 ordinarias + 2 extras)
  maxJornadaDiaria: 10,
  // Mayordomos internos / modalidad "En reserva"
  pctDisponibilidad: 30,      // % del valor hora reconocido por disponibilidad
  descansoMinDiario: 14,      // 24 h − 10 h de tope legal de jornada (puede ser discontinuo)
  descansoNocturnoMin: 8,     // bloque continuo recomendado
  diasMaxConsecutivos: 14,
  compensatorioPorDia: 0.5,   // días de descanso ganados por día interno
  // Horarios y compensatorios — CST arts. 179 a 181
  compFestivo: 1,              // días de descanso por cada festivo/dominical laborado
  umbralHabitual: 3,           // 3 o más domingos al mes = trabajo habitual
  toleranciaMin: 15,           // minutos antes de marcar tardanza
  // Marcación
  radioGeocerca: 150,         // metros de tolerancia alrededor de la propiedad
  exigirGPS: true,
  exigirCodigo: true,
  exigirFoto: false,
  // Nómina (Decretos 1469 y 1470 de 2025 — vigentes desde ene. 1/2026)
  divisorHora: 240,
  salarioMinimo: 1750905,
  auxTransporte: 249095,
  topeAuxTransporte: 2,       // x SMMLV
  moneda: 'COP'
};

export const FESTIVOS_2026 = ['2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
  '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29','2026-07-20','2026-08-07',
  '2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08','2026-12-25'];

export const FESTIVOS_2027 = ['2027-01-01','2027-01-11','2027-03-22','2027-03-25','2027-03-26',
  '2027-05-01','2027-05-10','2027-05-31','2027-06-07','2027-07-05','2027-07-20','2027-08-07',
  '2027-08-16','2027-10-18','2027-11-01','2027-11-15','2027-12-08','2027-12-25'];

export const TIPOS_TIEMPO = {
  EFECTIVO:      { id:'EFECTIVO',      label:'Trabajo efectivo',  color:'emerald', desc:'Prestación activa de servicios' },
  DISPONIBLE:    { id:'DISPONIBLE',    label:'Disponibilidad',    color:'amber',   desc:'En propiedad, sin servicio activo' },
  DESCANSO:      { id:'DESCANSO',      label:'Descanso',          color:'sky',     desc:'Descanso efectivo en propiedad' },
  SUENO:         { id:'SUENO',         label:'Sueño',             color:'indigo',  desc:'Descanso nocturno garantizado' },
  ALIMENTACION:  { id:'ALIMENTACION',  label:'Alimentación',      color:'orange',  desc:'Tiempo de comidas' },
  FUERA:         { id:'FUERA',         label:'Fuera de propiedad', color:'slate',  desc:'Salida autorizada' }
};

export const TIPOS_NOVEDAD = {
  PERMISO:       { id:'PERMISO',      label:'Permiso',              color:'sky',     remunerado:false },
  VACACIONES:    { id:'VACACIONES',   label:'Vacaciones',           color:'emerald', remunerado:true  },
  LICENCIA:      { id:'LICENCIA',     label:'Licencia',             color:'violet',  remunerado:true  },
  INCAPACIDAD:   { id:'INCAPACIDAD',  label:'Incapacidad',          color:'amber',   remunerado:true  },
  AUSENCIA:      { id:'AUSENCIA',     label:'Ausencia injustificada',color:'rose',   remunerado:false },
  LLAMADO:       { id:'LLAMADO',      label:'Llamado de atención',  color:'orange',  remunerado:false },
  COMPENSATORIO: { id:'COMPENSATORIO',label:'Descanso compensatorio',color:'teal',   remunerado:true  }
};

export const ESTADOS_PROP = {
  DISPONIBLE: { label:'Disponible', color:'emerald' },
  OCUPADA:    { label:'Ocupada',    color:'brand'   },
  LIMPIEZA:   { label:'En limpieza',color:'amber'   },
  MANTENIM:   { label:'Mantenimiento', color:'orange' },
  INACTIVA:   { label:'Inactiva',   color:'slate'   }
};

// Listas de sugerencia (no exhaustivas a propósito): qué EPS/AFP/ARL están
// habilitadas varía por municipio y cambia con el tiempo (reforma de salud
// 2026). El campo permite escribir cualquier valor que no aparezca aquí.
export const EPS_LIST = ['Nueva EPS','Sura','Sanitas','Compensar','Salud Total','Coosalud','Famisanar',
  'Mutual Ser','Aliansalud','Savia Salud','Capital Salud','Comfenalco Valle','Cajacopi Atlántico',
  'Comfachocó','Capresoca','Asmet Salud','Emssanar','EPS Fomag (Magisterio)','SOS'];
export const AFP_LIST = ['Porvenir','Protección','Colfondos','Skandia','Colpensiones'];
export const ARL_LIST = ['Sura ARL','Positiva','Colmena','Bolívar','Axa Colpatria','Mapfre','Equidad Seguros'];

export const METODOS = {
  QR:     { id:'QR',     label:'Código QR',   icon:'qr',    color:'brand'  },
  PIN:    { id:'PIN',    label:'PIN',         icon:'key',   color:'violet' },
  GPS:    { id:'GPS',    label:'GPS',         icon:'location', color:'emerald' },
  FOTO:   { id:'FOTO',   label:'Fotografía',  icon:'doc',   color:'sky'    },
  MANUAL: { id:'MANUAL', label:'Manual',      icon:'edit',  color:'slate'  }
};

// Resultado de validación de una marcación
export const VALIDACION = {
  OK:          { label:'Validada',              color:'emerald' },
  FUERA_ZONA:  { label:'Fuera de la propiedad', color:'rose'    },
  SIN_GPS:     { label:'Sin ubicación',         color:'amber'   },
  IP_DISTINTA: { label:'Red no reconocida',     color:'amber'   },
  CODIGO_MAL:  { label:'Código incorrecto',     color:'rose'    },
  MANUAL:      { label:'Registro manual',       color:'slate'   }
};

export const ESTADO_ESTADIA = {
  ACTIVA:     { label:'En reserva',  color:'brand'   },
  FINALIZADA: { label:'Finalizada',  color:'slate'   },
  PROGRAMADA: { label:'Programada',  color:'emerald' }
};

/* ── Plantillas de turno ───────────────────────────────────────────────────
   «desc» son los minutos que no se computan como jornada efectiva.
   El turno INT corresponde al mayordomo que permanece en la propiedad.     */
export const TURNOS_BASE = [
  { id:'INT', label:'Interno en propiedad', ini:'06:00', fin:'06:00', desc:0,  color:'brand',  abrev:'INT', interno:true },
  { id:'MAN', label:'Mañana',               ini:'07:00', fin:'16:00', desc:60, color:'amber',  abrev:'MAN' },
  { id:'DIA', label:'Diurno',               ini:'08:00', fin:'17:00', desc:60, color:'sky',    abrev:'DIA' },
  { id:'TAR', label:'Tarde',                ini:'14:00', fin:'22:00', desc:60, color:'orange', abrev:'TAR' },
  { id:'NOC', label:'Nocturno',             ini:'22:00', fin:'06:00', desc:60, color:'violet', abrev:'NOC' },
  { id:'DES', label:'Descanso',             ini:'',      fin:'',      desc:0,  color:'slate',  abrev:'DES' },
  { id:'COM', label:'Compensatorio',        ini:'',      fin:'',      desc:0,  color:'teal',   abrev:'COM' }
];

export const ESTADO_CUMPL = {
  OK:       { label:'Cumplió',             color:'emerald' },
  TARDANZA: { label:'Llegó tarde',         color:'amber'   },
  TEMPRANO: { label:'Salió antes',         color:'amber'   },
  AMBOS:    { label:'Tarde y salió antes', color:'orange'  },
  AUSENTE:  { label:'No marcó',            color:'rose'    },
  NOPROG:   { label:'Sin programar',       color:'violet'  },
  DESCANSO: { label:'Descanso',            color:'slate'   }
};

export const BUCKETS = [
  { k:'ordDiurna',       label:'Ordinaria diurna',            rec:0,   base:true  },
  { k:'ordNocturna',     label:'Ordinaria nocturna',          rec:'recNocturno' },
  { k:'extraDiurna',     label:'Extra diurna',                rec:'recExtraDiurna' },
  { k:'extraNocturna',   label:'Extra nocturna',              rec:'recExtraNocturna' },
  { k:'domDiurna',       label:'Dominical/festiva diurna',    rec:'recDominical' },
  { k:'domNocturna',     label:'Dominical/festiva nocturna',  rec:['recDominical','recNocturno'] },
  { k:'extraDomDiurna',  label:'Extra dominical diurna',      rec:['recDominical','recExtraDiurna'] },
  { k:'extraDomNocturna',label:'Extra dominical nocturna',    rec:['recDominical','recExtraNocturna'] }
];
