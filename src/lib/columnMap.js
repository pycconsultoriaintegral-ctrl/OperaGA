/* ══════════════════════════════════════════════════════════════════════════
   MAPEO DE COLUMNAS  ·  forma "app" (camelCase, igual al prototipo original)
   ↔ forma "fila de Supabase" (snake_case, según supabase/migrations/0001_init.sql)

   Cada entrada de TABLAS describe una tabla sincronizable: cómo convertir una
   fila de Postgres al objeto que ya consumen los 11 módulos (fromRow) y cómo
   convertir ese objeto de vuelta a columnas para insert/update (toRow).
   ══════════════════════════════════════════════════════════════════════════ */

const num = v => (v == null ? v : Number(v));
const hhmm = v => (v == null ? v : String(v).slice(0, 5));

export const TABLAS = {
  empleados: {
    table: 'empleados',
    fromRow: r => ({
      id: r.id, nombre: r.nombre, doc: r.doc, tipoDoc: r.tipo_doc, cargo: r.cargo,
      nacimiento: r.nacimiento, tel: r.tel, email: r.email, dir: r.dir, ingreso: r.ingreso,
      contrato: r.contrato, salario: num(r.salario), bonificacion: num(r.bonificacion) || 0,
      eps: r.eps, afp: r.afp, arl: r.arl,
      banco: r.banco, cuenta: r.cuenta, contactoEmg: r.contacto_emg, estado: r.estado,
      interno: !!r.interno, foto: r.foto_url
    }),
    toRow: o => ({
      nombre: o.nombre, doc: o.doc, tipo_doc: o.tipoDoc, cargo: o.cargo,
      nacimiento: o.nacimiento || null, tel: o.tel, email: o.email, dir: o.dir,
      ingreso: o.ingreso, contrato: o.contrato, salario: o.salario, bonificacion: o.bonificacion||0,
      eps: o.eps, afp: o.afp,
      arl: o.arl, banco: o.banco, cuenta: o.cuenta, contacto_emg: o.contactoEmg,
      estado: o.estado, interno: !!o.interno, foto_url: o.foto || null
    })
  },

  propiedades: {
    table: 'propiedades',
    fromRow: r => ({
      id: r.id, nombre: r.nombre, codigo: r.codigo, tipo: r.tipo, ubicacion: r.ubicacion,
      lat: num(r.lat), lng: num(r.lng), ips: r.ips || [], capacidad: num(r.capacidad),
      habitaciones: num(r.habitaciones), banos: num(r.banos), estado: r.estado,
      mayordomo: r.mayordomo_id, tarifa: num(r.tarifa), notas: r.notas
    }),
    toRow: o => ({
      nombre: o.nombre, codigo: o.codigo, tipo: o.tipo, ubicacion: o.ubicacion,
      lat: o.lat ?? null, lng: o.lng ?? null, ips: o.ips || [], capacidad: o.capacidad,
      habitaciones: o.habitaciones, banos: o.banos, estado: o.estado,
      mayordomo_id: o.mayordomo || null, tarifa: o.tarifa, notas: o.notas
    })
  },

  reservas: {
    table: 'reservas',
    fromRow: r => ({
      id: r.id, propiedad: r.propiedad_id, huesped: r.huesped, desde: r.desde, hasta: r.hasta,
      huespedes: num(r.huespedes), canal: r.canal, valor: num(r.valor), estado: r.estado
    }),
    toRow: o => ({
      propiedad_id: o.propiedad, huesped: o.huesped, desde: o.desde, hasta: o.hasta,
      huespedes: o.huespedes, canal: o.canal, valor: o.valor, estado: o.estado
    })
  },

  turnosT: {
    table: 'turnos_base',
    fromRow: r => ({
      id: r.id, label: r.label, ini: hhmm(r.ini) || '', fin: hhmm(r.fin) || '',
      desc: num(r.desc_min) || 0, color: r.color, abrev: r.abrev, interno: !!r.interno
    }),
    toRow: o => ({
      label: o.label, ini: o.ini || null, fin: o.fin || null, desc_min: o.desc || 0,
      color: o.color, abrev: o.abrev, interno: !!o.interno
    })
  },

  horarios: {
    table: 'horarios',
    fromRow: r => ({ id: r.id, emp: r.empleado_id, fecha: r.fecha, tur: r.turno_id }),
    toRow: o => ({ empleado_id: o.emp, fecha: o.fecha, turno_id: o.tur }),
    // Dos sesiones editando el mismo empleado+fecha al mismo tiempo pueden
    // producir dos inserts "nuevos" (id distinto) para la misma llave natural
    // — onConflict hace que el segundo se resuelva como UPDATE en vez de
    // reventar el unique (empleado_id, fecha). Ver syncTabla en useRemoteDB.js.
    onConflict: 'empleado_id,fecha'
  },

  asistencia: {
    table: 'asistencia',
    fromRow: r => ({
      id: r.id, empleado: r.empleado_id, propiedad: r.propiedad_id, fecha: r.fecha,
      tipo: r.tipo, entrada: hhmm(r.entrada), salida: hhmm(r.salida), metodo: r.metodo,
      obs: r.obs || '', lat: num(r.lat), lng: num(r.lng), ip: r.ip, validacion: r.validacion,
      foto: r.foto_url
    }),
    toRow: o => ({
      empleado_id: o.empleado, propiedad_id: o.propiedad || null, fecha: o.fecha, tipo: o.tipo,
      entrada: o.entrada, salida: o.salida, metodo: o.metodo, obs: o.obs || null,
      lat: o.lat ?? null, lng: o.lng ?? null, ip: o.ip || null, validacion: o.validacion || null,
      foto_url: o.foto || null
    })
  },

  novedades: {
    table: 'novedades',
    fromRow: r => ({
      id: r.id, empleado: r.empleado_id, tipo: r.tipo, desde: r.desde, hasta: r.hasta,
      dias: num(r.dias), motivo: r.motivo, soporte: r.soporte || '', estado: r.estado
    }),
    toRow: o => ({
      empleado_id: o.empleado, tipo: o.tipo, desde: o.desde, hasta: o.hasta, dias: o.dias,
      motivo: o.motivo, soporte: o.soporte || null, estado: o.estado
    })
  },

  estadias: {
    table: 'estadias',
    fromRow: r => ({
      id: r.id, empleado: r.empleado_id, propiedad: r.propiedad_id, reserva: r.reserva_id || '',
      desde: r.desde, hasta: r.hasta, estado: r.estado, obs: r.obs || ''
    }),
    toRow: o => ({
      empleado_id: o.empleado, propiedad_id: o.propiedad, reserva_id: o.reserva || null,
      desde: o.desde, hasta: o.hasta, estado: o.estado, obs: o.obs || null
    })
  }
};

// Tablas que se sincronizan con set(db=>...) usando diff por `id`.
export const TABLAS_SYNCABLES = Object.keys(TABLAS);

export function cfgFromRow(r){
  if (!r) return null;
  return {
    horasSemanales: num(r.horas_semanales), horasDiarias: num(r.horas_diarias),
    extrasMaxDia: num(r.extras_max_dia), extrasMaxSemana: num(r.extras_max_semana),
    nocturnoInicio: num(r.nocturno_inicio), nocturnoFin: num(r.nocturno_fin),
    recExtraDiurna: num(r.rec_extra_diurna), recExtraNocturna: num(r.rec_extra_nocturna),
    recNocturno: num(r.rec_nocturno), recDominical: num(r.rec_dominical),
    maxJornadaDiaria: num(r.max_jornada_diaria), pctDisponibilidad: num(r.pct_disponibilidad),
    descansoMinDiario: num(r.descanso_min_diario), descansoNocturnoMin: num(r.descanso_nocturno_min),
    diasMaxConsecutivos: num(r.dias_max_consecutivos), compensatorioPorDia: num(r.compensatorio_por_dia),
    compFestivo: num(r.comp_festivo), umbralHabitual: num(r.umbral_habitual),
    toleranciaMin: num(r.tolerancia_min), radioGeocerca: num(r.radio_geocerca),
    exigirGPS: !!r.exigir_gps, exigirCodigo: !!r.exigir_codigo, exigirFoto: !!r.exigir_foto,
    divisorHora: num(r.divisor_hora), salarioMinimo: num(r.salario_minimo),
    auxTransporte: num(r.aux_transporte), topeAuxTransporte: num(r.tope_aux_transporte),
    moneda: r.moneda
  };
}

export function cfgToRow(cfg){
  return {
    horas_semanales: cfg.horasSemanales, horas_diarias: cfg.horasDiarias,
    extras_max_dia: cfg.extrasMaxDia, extras_max_semana: cfg.extrasMaxSemana,
    nocturno_inicio: cfg.nocturnoInicio, nocturno_fin: cfg.nocturnoFin,
    rec_extra_diurna: cfg.recExtraDiurna, rec_extra_nocturna: cfg.recExtraNocturna,
    rec_nocturno: cfg.recNocturno, rec_dominical: cfg.recDominical,
    max_jornada_diaria: cfg.maxJornadaDiaria, pct_disponibilidad: cfg.pctDisponibilidad,
    descanso_min_diario: cfg.descansoMinDiario, descanso_nocturno_min: cfg.descansoNocturnoMin,
    dias_max_consecutivos: cfg.diasMaxConsecutivos, compensatorio_por_dia: cfg.compensatorioPorDia,
    comp_festivo: cfg.compFestivo, umbral_habitual: cfg.umbralHabitual,
    tolerancia_min: cfg.toleranciaMin, radio_geocerca: cfg.radioGeocerca,
    exigir_gps: !!cfg.exigirGPS, exigir_codigo: !!cfg.exigirCodigo, exigir_foto: !!cfg.exigirFoto,
    divisor_hora: cfg.divisorHora, salario_minimo: cfg.salarioMinimo,
    aux_transporte: cfg.auxTransporte, tope_aux_transporte: cfg.topeAuxTransporte,
    moneda: cfg.moneda
  };
}
