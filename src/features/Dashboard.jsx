import { useMemo } from 'react';
import { Page, Card, Stat, Badge, Icon, Bar, Btn, Avatar, exportCSV, TONE } from '../components/ui.jsx';
import { CARGOS, ESTADOS_PROP, TIPOS_NOVEDAD } from '../lib/constants.js';
import { addDias, esDomingo, fmtNum, fmtCOP, fmtFechaLarga, fmtFecha, nombreDia } from '../lib/utils.js';
import { liquidar, valorizar } from '../lib/payroll.js';

export default function Dashboard({db, go}){
  const { empleados, propiedades, reservas, asistencia, novedades, cfg, festivos } = db;
  const HOY = '2026-07-24';

  const m = useMemo(() => {
    const ini = addDias(HOY,-29);
    const regs = asistencia.filter(r => r.fecha >= ini && r.fecha <= HOY);
    const res  = liquidar(regs, cfg, festivos);

    // Personal en turno hoy
    const hoyRegs = asistencia.filter(r => r.fecha === HOY);
    const enTurno = [...new Set(hoyRegs.map(r=>r.empleado))];
    const enNovedad = novedades.filter(n => n.estado==='APROBADA' && n.desde<=HOY && n.hasta>=HOY)
      .map(n=>n.empleado);
    const descansando = empleados.filter(e => e.estado==='ACTIVO'
      && !enTurno.includes(e.id) && !enNovedad.includes(e.id)).map(e=>e.id);

    // Costo laboral del período
    let costo = 0;
    empleados.forEach(e => {
      const r = liquidar(regs.filter(x=>x.empleado===e.id), cfg, festivos);
      costo += valorizar(r, e.salario, cfg).total;
    });

    // Serie diaria de horas (14 días)
    const serie = [];
    for(let i=13;i>=0;i--){
      const f = addDias(HOY,-i);
      const rr = liquidar(asistencia.filter(x=>x.fecha===f), cfg, festivos);
      const ext = rr.horas.extraDiurna+rr.horas.extraNocturna+rr.horas.extraDomDiurna+rr.horas.extraDomNocturna;
      serie.push({ f, ord: rr.totalEfectivo-ext, ext, disp: rr.disponibilidadHrs });
    }

    // Distribución por cargo
    const porCargo = CARGOS.map(c => {
      const ids = empleados.filter(e=>e.cargo===c && e.estado==='ACTIVO').map(e=>e.id);
      const rr = liquidar(regs.filter(x=>ids.includes(x.empleado)), cfg, festivos);
      return { cargo:c, n:ids.length, horas:rr.totalEfectivo };
    });

    const ocupadas = propiedades.filter(p=>p.estado==='OCUPADA').length;
    const extras = res.horas.extraDiurna+res.horas.extraNocturna+res.horas.extraDomDiurna+res.horas.extraDomNocturna;

    return { res, enTurno, descansando, enNovedad, costo, serie, porCargo, ocupadas, extras,
      incapacidades: novedades.filter(n=>n.tipo==='INCAPACIDAD' && n.hasta>=addDias(HOY,-30)).length,
      pendientes: novedades.filter(n=>n.estado==='PENDIENTE') };
  }, [db]);

  const maxSerie = Math.max(...m.serie.map(s=>s.ord+s.ext), 1);

  return <Page title="Panel de control"
    sub={`Resumen operativo · ${fmtFechaLarga(HOY)}`}
    actions={<><Btn v="outline" icon="download" onClick={()=>exportCSV('resumen_operativo',
        m.serie.map(s=>({fecha:s.f, horas_ordinarias:fmtNum(s.ord), horas_extras:fmtNum(s.ext), disponibilidad:fmtNum(s.disp)})))}>Exportar</Btn>
      <Btn icon="clock" onClick={()=>go('asistencia')}>Registrar marcación</Btn></>}>

    {/* ── KPIs ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <Stat label="Personal en turno" value={m.enTurno.length} icon="users" tone="emerald"
        sub={`${m.descansando.length} en descanso · ${m.enNovedad.length} con novedad`}/>
      <Stat label="Propiedades ocupadas" value={`${m.ocupadas}/${propiedades.length}`} icon="home" tone="brand"
        sub={`${propiedades.filter(p=>p.estado==='DISPONIBLE').length} disponibles`}/>
      <Stat label="Horas extras (30 d)" value={fmtNum(m.extras)} icon="bolt" tone={m.extras>60?'rose':'amber'}
        sub={`Tope legal ${cfg.extrasMaxSemana} h/semana`}/>
      <Stat label="Costo laboral (30 d)" value={fmtCOP(m.costo)} icon="money" tone="violet"
        sub={`${fmtNum(m.res.totalEfectivo,0)} h efectivas liquidadas`}/>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Gráfica de horas ── */}
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <div><h3 className="font-bold text-ink-900 dark:text-white">Horas trabajadas</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">Últimos 14 días · toda la operación</p></div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500"/>Ordinarias</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"/>Extras</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-44">
          {m.serie.map((s,i) => {
            const hO = (s.ord/maxSerie)*100, hE = (s.ext/maxSerie)*100;
            const fest = festivos.includes(s.f) || esDomingo(s.f);
            return <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <div className="w-full flex flex-col justify-end h-36">
                {hE>0 && <div className="w-full bg-amber-500 rounded-t transition-all hover:opacity-80" style={{height:`${hE}%`}}/>}
                <div className={`w-full ${hE>0?'':'rounded-t'} ${fest?'bg-brand-300 dark:bg-brand-700':'bg-brand-500'} transition-all hover:opacity-80`} style={{height:`${hO}%`}}/>
              </div>
              <span className={`text-[9px] font-bold ${fest?'text-rose-500':'text-ink-400'}`}>{s.f.slice(8)}</span>
              <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10
                bg-ink-900 dark:bg-ink-800 text-white text-[10px] font-semibold px-2 py-1.5 rounded-lg shadow-lift whitespace-nowrap">
                {nombreDia(s.f)} {fmtFecha(s.f)}<br/>{fmtNum(s.ord)} h ord · {fmtNum(s.ext)} h ext
              </div>
            </div>;
          })}
        </div>
      </Card>

      {/* ── Alertas ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink-900 dark:text-white">Alertas de cumplimiento</h3>
          {m.res.alertas.length>0 && <Badge tone="rose">{m.res.alertas.length}</Badge>}
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {m.res.alertas.length===0
            ? <div className="text-center py-8"><Icon n="check" c="w-8 h-8 mx-auto text-emerald-500"/>
                <p className="mt-2 text-sm font-semibold text-ink-600 dark:text-ink-300">Sin incumplimientos</p>
                <p className="text-xs text-ink-400">Todo dentro de los topes legales</p></div>
            : m.res.alertas.slice(0,12).map((a,i) => (
              <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 ring-1 ring-inset ring-rose-500/15">
                <Icon n="alert" c="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"/>
                <div className="min-w-0"><p className="text-xs font-bold text-rose-900 dark:text-rose-200">{a.msg}</p>
                  <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-0.5">{a.fecha==='—'?'Período completo':fmtFecha(a.fecha)}</p></div>
              </div>))}
        </div>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      {/* ── Estado propiedades ── */}
      <Card className="lg:col-span-2">
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Estado de propiedades</h3>
        <div className="space-y-2.5">
          {propiedades.map(p => {
            const may = empleados.find(e=>e.id===p.mayordomo);
            const rsv = reservas.find(r=>r.propiedad===p.id && r.desde<=HOY && r.hasta>=HOY);
            const est = ESTADOS_PROP[p.estado];
            return <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-950/50 ring-1 ring-inset ring-ink-200/60 dark:ring-ink-800">
              <div className={`w-10 h-10 rounded-lg grid place-items-center ring-1 ring-inset shrink-0 ${TONE[est.color]||TONE.slate}`}><Icon n="home" c="w-5 h-5"/></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{p.nombre}</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">
                  {may ? `Mayordomo: ${may.nombre.split(' ').slice(0,2).join(' ')}` : 'Sin mayordomo'}
                  {rsv && ` · ${rsv.huesped} hasta ${fmtFecha(rsv.hasta)}`}</p>
              </div>
              <Badge tone={est.color} dot>{est.label}</Badge>
            </div>;
          })}
        </div>
      </Card>

      {/* ── Distribución por cargo + pendientes ── */}
      <div className="space-y-4">
        <Card>
          <h3 className="font-bold text-ink-900 dark:text-white mb-4">Horas por cargo</h3>
          <div className="space-y-3">
            {m.porCargo.filter(c=>c.n>0).sort((a,b)=>b.horas-a.horas).map(c => {
              const max = Math.max(...m.porCargo.map(x=>x.horas),1);
              return <div key={c.cargo}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-ink-700 dark:text-ink-200">{c.cargo} <span className="text-ink-400 font-normal">({c.n})</span></span>
                  <span className="font-bold text-ink-900 dark:text-white num">{fmtNum(c.horas,0)} h</span></div>
                <Bar pct={(c.horas/max)*100} tone={c.cargo==='Mayordomo'?'brand':'sky'}/>
              </div>;
            })}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-ink-900 dark:text-white">Novedades pendientes</h3>
            {m.pendientes.length>0 && <Badge tone="amber">{m.pendientes.length}</Badge>}</div>
          {m.pendientes.length===0
            ? <p className="text-xs text-ink-400 py-3 text-center">Nada por aprobar</p>
            : <div className="space-y-2">{m.pendientes.map(n => {
                const e = empleados.find(x=>x.id===n.empleado); const t = TIPOS_NOVEDAD[n.tipo];
                return <button key={n.id} onClick={()=>go('novedades')} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 text-left">
                  <Avatar nombre={e?.nombre} size="w-7 h-7"/>
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-ink-800 dark:text-ink-100 truncate">{e?.nombre.split(' ').slice(0,2).join(' ')}</p>
                    <p className="text-[10px] text-ink-500">{t.label} · {n.dias} d</p></div>
                  <Icon n="chevR" c="w-4 h-4 text-ink-300"/></button>;
              })}</div>}
        </Card>
      </div>
    </div>
  </Page>;
}
