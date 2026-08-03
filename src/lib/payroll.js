/* ══════════════════════════════════════════════════════════════════════════
   MOTOR DE LIQUIDACIÓN  ·  Normativa colombiana vigente
   Portado literalmente desde el prototipo original — CERO cambios de lógica.
   Clasifica minuto a minuto cada registro de asistencia en las categorías
   legales y aplica los recargos acumulables según CST + Ley 2101 + Ley 2466.
   ══════════════════════════════════════════════════════════════════════════ */

import { BUCKETS } from './constants.js';
import { fmtNum, hm2min, diffDias, addDias, esDomingo, horasTurno } from './utils.js';

export { horasTurno };

// Factor multiplicador de cada bucket (1 + suma de recargos)
export function factorBucket(bucket, cfg){
  const r = bucket.rec;
  if(!r) return 1;
  const arr = Array.isArray(r) ? r : [r];
  return 1 + arr.reduce((s,k) => s + (cfg[k]||0)/100, 0);
}

export function esFestivo(fecha, festivos){ return festivos.includes(fecha); }

// ¿el minuto m (0-1439) de la fecha cae en franja nocturna?
export function esMinNocturno(m, cfg){
  const ini = cfg.nocturnoInicio * 60;   // 19:00 -> 1140
  const fin = cfg.nocturnoFin * 60;      // 06:00 -> 360
  return m >= ini || m < fin;
}

/**
 * Liquida un conjunto de registros de asistencia.
 * @returns { buckets, disponibilidadHrs, descansoHrs, detalle[], alertas[] }
 */
export function liquidar(registros, cfg, festivos){
  const acc = {}; BUCKETS.forEach(b => acc[b.k] = 0);
  let dispMin = 0, descMin = 0, fueraMin = 0;
  const detalle = {};   // por fecha
  const alertas = [];

  // Agrupar por fecha
  const porFecha = {};
  registros.forEach(r => { (porFecha[r.fecha] = porFecha[r.fecha] || []).push(r); });

  Object.keys(porFecha).sort().forEach(fecha => {
    const regs = porFecha[fecha].slice().sort((a,b)=>hm2min(a.entrada)-hm2min(b.entrada));
    const dom = esDomingo(fecha) || esFestivo(fecha, festivos);
    let acumOrdinario = 0;                       // minutos ordinarios ya usados hoy
    const limiteOrd = cfg.horasDiarias * 60;
    const dDet = { fecha, dom, efectivo:0, disponible:0, descanso:0, fuera:0, extra:0, nocturno:0 };

    regs.forEach(r => {
      let ini = hm2min(r.entrada), fin = hm2min(r.salida);
      if(fin <= ini) fin += 1440;                // turno que cruza medianoche
      const dur = fin - ini;
      if(dur <= 0) return;

      // Tiempos no computables como trabajo efectivo
      if(r.tipo === 'DISPONIBLE'){ dispMin += dur; dDet.disponible += dur; return; }
      if(r.tipo === 'DESCANSO' || r.tipo === 'SUENO' || r.tipo === 'ALIMENTACION'){
        descMin += dur; dDet.descanso += dur; return; }
      if(r.tipo === 'FUERA'){ fueraMin += dur; dDet.fuera += dur; return; }

      // EFECTIVO → clasificar minuto a minuto
      for(let m = ini; m < fin; m++){
        const mm  = m % 1440;
        const noct = esMinNocturno(mm, cfg);
        const esExtra = acumOrdinario >= limiteOrd;
        if(!esExtra) acumOrdinario++;

        let k;
        if(dom) k = esExtra ? (noct ? 'extraDomNocturna' : 'extraDomDiurna')
                            : (noct ? 'domNocturna'      : 'domDiurna');
        else    k = esExtra ? (noct ? 'extraNocturna'    : 'extraDiurna')
                            : (noct ? 'ordNocturna'      : 'ordDiurna');
        acc[k]++;
        dDet.efectivo++;
        if(esExtra) dDet.extra++;
        if(noct)    dDet.nocturno++;
      }
    });

    // ── Alertas de cumplimiento ──
    const extraHrs = dDet.extra/60;
    if(extraHrs > cfg.extrasMaxDia)
      alertas.push({ tipo:'EXTRA_DIA', fecha, msg:`${fmtNum(extraHrs)} h extras (máx. legal ${cfg.extrasMaxDia} h/día)` });
    if(dDet.efectivo/60 > 10)
      alertas.push({ tipo:'JORNADA', fecha, msg:`Jornada de ${fmtNum(dDet.efectivo/60)} h (máx. legal 10 h/día)` });
    if(dDet.disponible > 0 && dDet.descanso/60 < cfg.descansoNocturnoMin)
      alertas.push({ tipo:'DESCANSO', fecha, msg:`Solo ${fmtNum(dDet.descanso/60)} h de descanso (mín. ${cfg.descansoNocturnoMin} h)` });

    detalle[fecha] = dDet;
  });

  // Alerta semanal de extras
  const totExtraHrs = (acc.extraDiurna+acc.extraNocturna+acc.extraDomDiurna+acc.extraDomNocturna)/60;
  const semanas = Math.max(1, Object.keys(detalle).length/7);
  if(totExtraHrs/semanas > cfg.extrasMaxSemana)
    alertas.push({ tipo:'EXTRA_SEM', fecha:'—', msg:`Promedio ${fmtNum(totExtraHrs/semanas)} h extras/semana (máx. ${cfg.extrasMaxSemana} h)` });

  const horas = {}; BUCKETS.forEach(b => horas[b.k] = acc[b.k]/60);
  return {
    horas,
    disponibilidadHrs: dispMin/60,
    descansoHrs: descMin/60,
    fueraHrs: fueraMin/60,
    totalEfectivo: Object.values(horas).reduce((a,b)=>a+b,0),
    detalle, alertas
  };
}

/** Valoriza el resultado de liquidar() para un empleado */
export function valorizar(res, salario, cfg){
  const vh = salario / cfg.divisorHora;
  const lineas = BUCKETS.map(b => {
    const h = res.horas[b.k] || 0;
    const f = factorBucket(b, cfg);
    return { ...b, horas:h, factor:f, valorHora:vh*f, total:h*vh*f,
             recargoPct: Math.round((f-1)*100) };
  }).filter(l => l.horas > 0.001);

  const dispValorHora = vh * (cfg.pctDisponibilidad/100);
  const dispTotal = res.disponibilidadHrs * dispValorHora;

  const subtotal = lineas.reduce((s,l)=>s+l.total,0);
  return {
    valorHoraBase: vh, lineas,
    disponibilidad: { horas:res.disponibilidadHrs, valorHora:dispValorHora, total:dispTotal },
    subtotal, total: subtotal + dispTotal
  };
}

/** Prestaciones sociales proporcionales al período */
export function prestaciones(devengado, dias, cfg){
  const base = devengado;
  return {
    cesantias:    base * dias / 360,
    intCesantias: (base * dias / 360) * 0.12 * dias / 360,
    prima:        base * dias / 360,
    vacaciones:   base * dias / 720,
  };
}

/** Aportes de seguridad social (empleado / empleador) */
export function aportes(devengado){
  return {
    empleado:  { salud: devengado*0.04, pension: devengado*0.04 },
    empleador: { salud: devengado*0.085, pension: devengado*0.12, arl: devengado*0.00522,
                 caja: devengado*0.04, icbf: devengado*0.03, sena: devengado*0.02 }
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   MODALIDAD "EN RESERVA"  ·  mayordomos alojados en la propiedad
   ══════════════════════════════════════════════════════════════════════════
   Marco legal aplicable (ver documento de Fase 1, sección 11):
   · El mayordomo de una propiedad con servicio de hospedaje NO es trabajador
     doméstico — se rige por el régimen general del CST.
   · Jornada ordinaria 8 h/día; máximo absoluto 10 h/día (8 + 2 extras).
   · En consecuencia, cada día de 24 h debe contener al menos 14 h sin trabajo
     efectivo. Esas 14 h pueden ser DISCONTINUAS.
   · El tiempo de disponibilidad restringida es zona gris: se contabiliza aparte
     y se advierte, porque un juez puede reclasificarlo como trabajo efectivo.
   ══════════════════════════════════════════════════════════════════════════ */

export function evaluarEstadia(estadia, registros, cfg, festivos){
  const dias = [];
  const total = Math.max(1, diffDias(estadia.desde, estadia.hasta) + 1);

  for(let i=0; i<total; i++){
    const f = addDias(estadia.desde, i);
    const regs = registros.filter(r => r.fecha===f && r.empleado===estadia.empleado);
    const res  = liquidar(regs, cfg, festivos);

    const efectivo = res.totalEfectivo;
    const descanso = res.descansoHrs;
    const disp     = res.disponibilidadHrs;
    const fuera    = res.fueraHrs;
    const registrado = efectivo + descanso + disp + fuera;
    // Lo no registrado dentro de las 24 h se considera tiempo sin clasificar
    const sinClasificar = Math.max(0, 24 - registrado);

    // El descanso legal computa el descanso declarado + el tiempo fuera de la propiedad
    const descansoComputable = descanso + fuera;

    // Bloque continuo de descanso más largo del día
    const bloques = regs.filter(r => ['DESCANSO','SUENO'].includes(r.tipo))
      .map(r => { let d = hm2min(r.salida)-hm2min(r.entrada); return (d<=0?d+1440:d)/60; });
    const bloqueMax = bloques.length ? Math.max(...bloques) : 0;

    const alertas = [];
    if(efectivo > cfg.maxJornadaDiaria)
      alertas.push({ nivel:'critico', msg:`${fmtNum(efectivo)} h de trabajo efectivo — supera el tope legal de ${cfg.maxJornadaDiaria} h/día.` });
    if(descansoComputable < cfg.descansoMinDiario)
      alertas.push({ nivel:'critico', msg:`Solo ${fmtNum(descansoComputable)} h de descanso — el mínimo es ${cfg.descansoMinDiario} h diarias (pueden ser discontinuas).` });
    if(bloqueMax < cfg.descansoNocturnoMin && descansoComputable >= cfg.descansoMinDiario)
      alertas.push({ nivel:'medio', msg:`El bloque continuo más largo es de ${fmtNum(bloqueMax)} h; se recomiendan ${cfg.descansoNocturnoMin} h seguidas de descanso nocturno.` });
    if(sinClasificar > 0.5)
      alertas.push({ nivel:'medio', msg:`${fmtNum(sinClasificar)} h del día sin clasificar. Ante un juez, el tiempo no documentado suele presumirse trabajado.` });
    if(disp > 0)
      alertas.push({ nivel:'info', msg:`${fmtNum(disp)} h de disponibilidad: remuneradas al ${cfg.pctDisponibilidad}% del valor hora. Debe estar pactado por escrito en el contrato.` });

    dias.push({ fecha:f, efectivo, descanso, descansoComputable, disp, fuera,
                sinClasificar, bloqueMax, alertas, res,
                cumple: !alertas.some(a=>a.nivel==='critico') });
  }

  const criticos = dias.reduce((s,d)=>s+d.alertas.filter(a=>a.nivel==='critico').length, 0);
  return {
    dias, total,
    totalEfectivo:   dias.reduce((s,d)=>s+d.efectivo,0),
    totalDisp:       dias.reduce((s,d)=>s+d.disp,0),
    totalDescanso:   dias.reduce((s,d)=>s+d.descansoComputable,0),
    totalSinClasif:  dias.reduce((s,d)=>s+d.sinClasificar,0),
    diasConformes:   dias.filter(d=>d.cumple).length,
    criticos,
    compensatorio:   total * cfg.compensatorioPorDia,
    excedeConsecutivos: total > cfg.diasMaxConsecutivos
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   HORARIOS: CRUCE CON LA ASISTENCIA Y COMPENSATORIOS
   ══════════════════════════════════════════════════════════════════════════ */

/** Compara la programación del supervisor con la marcación real */
export function compararProgramado(horarios, asistencia, turnos, cfg, empIdx){
  const tur={}; turnos.forEach(t=>tur[t.id]=t);
  // De la asistencia solo interesa el tiempo efectivo para medir cumplimiento
  const marca={};
  asistencia.filter(r=>r.tipo==='EFECTIVO').forEach(r=>{
    const k=r.empleado+'|'+r.fecha;
    if(!marca[k]) marca[k]={entrada:r.entrada, salida:r.salida, min:0};
    if(hm2min(r.entrada)<hm2min(marca[k].entrada)) marca[k].entrada=r.entrada;
    if(hm2min(r.salida)>hm2min(marca[k].salida))   marca[k].salida=r.salida;
    let d=hm2min(r.salida)-hm2min(r.entrada); if(d<=0)d+=1440;
    marca[k].min+=d;
  });
  const prog={}; horarios.forEach(h=>{ prog[h.emp+'|'+h.fecha]=h; });

  const filas=[];
  new Set([...Object.keys(prog),...Object.keys(marca)]).forEach(k=>{
    const [emp,fecha]=k.split('|');
    const h=prog[k], r=marca[k];
    const t=h?tur[h.tur]:null;
    const libre = t && (t.id==='DES'||t.id==='COM');
    const hProg = t && !libre ? horasTurno(t) : 0;
    const hReal = r ? r.min/60 : 0;

    let estado;
    if(!h)          estado='NOPROG';
    else if(libre)  estado = r ? 'NOPROG' : 'DESCANSO';
    else if(!r)     estado='AUSENTE';
    else if(t.interno) estado = 'OK';                       // el interno no marca hora fija
    else {
      const tarde    = hm2min(r.entrada) > hm2min(t.ini)+cfg.toleranciaMin;
      const temprano = hm2min(t.fin)>hm2min(t.ini) && hm2min(r.salida) < hm2min(t.fin)-cfg.toleranciaMin;
      estado = tarde&&temprano?'AMBOS':tarde?'TARDANZA':temprano?'TEMPRANO':'OK';
    }
    const minTarde=(h&&r&&t&&!libre&&!t.interno)?Math.max(0,hm2min(r.entrada)-hm2min(t.ini)):0;
    const minAntes=(h&&r&&t&&!libre&&!t.interno&&hm2min(t.fin)>hm2min(t.ini))
                   ?Math.max(0,hm2min(t.fin)-hm2min(r.salida)):0;

    filas.push({ emp, fecha, turno:t, estado, hProg, hReal, dif:hReal-hProg,
      entrada:r?r.entrada:'', salida:r?r.salida:'', minTarde, minAntes,
      nombre:empIdx[emp]?.nombre||'', doc:empIdx[emp]?.doc||'', cargo:empIdx[emp]?.cargo||'' });
  });
  filas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.nombre.localeCompare(b.nombre));

  const res={ filas,
    programadas: filas.reduce((s,f)=>s+f.hProg,0),
    laboradas:   filas.reduce((s,f)=>s+f.hReal,0),
    ausencias:   filas.filter(f=>f.estado==='AUSENTE').length,
    tardanzas:   filas.filter(f=>f.estado==='TARDANZA'||f.estado==='AMBOS').length,
    tempranas:   filas.filter(f=>f.estado==='TEMPRANO'||f.estado==='AMBOS').length,
    noProg:      filas.filter(f=>f.estado==='NOPROG').length,
    conformes:   filas.filter(f=>f.estado==='OK').length,
    turnosProg:  filas.filter(f=>f.hProg>0).length };
  res.cumplimiento = res.turnosProg ? (res.conformes/res.turnosProg)*100 : 0;
  return res;
}

/**
 * Compensatorios por dominical o festivo laborado.
 * CST art. 180: hasta 2 domingos al mes el trabajo es OCASIONAL y el trabajador
 *   elige entre el recargo o el descanso compensatorio.
 * CST art. 181: con 3 o más el trabajo es HABITUAL y tiene derecho a AMBOS.
 */
export function calcularCompensatorios(empleados, horarios, asistencia, novedades, festivos, cfg){
  const esFestivo = f => esDomingo(f) || festivos.includes(f);
  const turnoLibre = t => t==='DES' || t==='COM';

  // Días efectivamente laborados en domingo o festivo
  const laborados = {};      // emp -> Set(fecha)
  horarios.forEach(h=>{
    if(!esFestivo(h.fecha) || turnoLibre(h.tur)) return;
    (laborados[h.emp] = laborados[h.emp] || new Set()).add(h.fecha);
  });
  asistencia.filter(r=>r.tipo==='EFECTIVO').forEach(r=>{
    if(!esFestivo(r.fecha)) return;
    (laborados[r.empleado] = laborados[r.empleado] || new Set()).add(r.fecha);
  });

  return empleados.map(e=>{
    const dias = [...(laborados[e.id] || [])].sort();
    // Agrupar por mes para clasificar habitual u ocasional
    const meses = {};
    dias.forEach(f=>{ const m=f.slice(0,7); (meses[m]=meses[m]||[]).push(f); });

    const detalle = Object.entries(meses).map(([mes,fs])=>{
      const habitual = fs.length >= cfg.umbralHabitual;
      return { mes, dias:fs, n:fs.length, habitual,
               ganados: fs.length * cfg.compFestivo,
               regla: habitual
                 ? 'Habitual (art. 181): compensatorio y recargo'
                 : 'Ocasional (art. 180): el trabajador elige entre compensatorio o recargo' };
    }).sort((a,b)=>a.mes.localeCompare(b.mes));

    const ganados = detalle.reduce((s,d)=>s+d.ganados,0);
    const tomados = novedades.filter(n=>n.empleado===e.id && n.tipo==='COMPENSATORIO'
      && n.estado==='APROBADA').reduce((s,n)=>s+(n.dias||0),0);
    const programados = horarios.filter(h=>h.emp===e.id && h.tur==='COM').length;

    return { emp:e, dias, detalle, ganados, tomados, programados,
             saldo: ganados - tomados - programados,
             habitual: detalle.some(d=>d.habitual) };
  }).filter(x=>x.ganados>0 || x.tomados>0);
}
