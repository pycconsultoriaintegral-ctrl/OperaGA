import { useState, useMemo } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Stat, Bar, Icon, Field, Input, exportCSV } from '../components/ui.jsx';
import { CARGOS } from '../lib/constants.js';
import { addDias, diffDias, fmtCOP, fmtNum, fmtFecha, hoy } from '../lib/utils.js';
import { liquidar, valorizar } from '../lib/payroll.js';

export default function Reportes({db, toast}){
  const [rep,setRep] = useState('horas');
  const [desde,setDesde] = useState('2026-07-01');
  const [hasta,setHasta] = useState('2026-07-24');

  const data = useMemo(() => {
    const regs = db.asistencia.filter(r=>r.fecha>=desde && r.fecha<=hasta);
    const activos = db.empleados.filter(e=>e.estado==='ACTIVO');

    const porEmpleado = activos.map(e => {
      const rr = regs.filter(r=>r.empleado===e.id);
      const res = liquidar(rr, db.cfg, db.festivos);
      const val = valorizar(res, e.salario, db.cfg);
      const ext = res.horas.extraDiurna+res.horas.extraNocturna+res.horas.extraDomDiurna+res.horas.extraDomNocturna;
      const noct = res.horas.ordNocturna+res.horas.extraNocturna+res.horas.domNocturna+res.horas.extraDomNocturna;
      const dom = res.horas.domDiurna+res.horas.domNocturna+res.horas.extraDomDiurna+res.horas.extraDomNocturna;
      const nov = db.novedades.filter(n=>n.empleado===e.id && n.desde<=hasta && n.hasta>=desde);
      return { e, res, val, ext, noct, dom, dias:Object.keys(res.detalle).length,
        ausencias: nov.filter(n=>n.tipo==='AUSENCIA').reduce((s,n)=>s+n.dias,0),
        incapacidad: nov.filter(n=>n.tipo==='INCAPACIDAD').reduce((s,n)=>s+n.dias,0),
        novedades: nov.length };
    });

    const porPropiedad = db.propiedades.map(p => {
      const rr = regs.filter(r=>r.propiedad===p.id);
      let costo=0, horas=0;
      activos.forEach(e => { const er = rr.filter(x=>x.empleado===e.id); if(!er.length) return;
        const res = liquidar(er, db.cfg, db.festivos); horas += res.totalEfectivo;
        costo += valorizar(res, e.salario, db.cfg).total; });
      const ing = db.reservas.filter(r=>r.propiedad===p.id && r.desde<=hasta && r.hasta>=desde)
        .reduce((s,r)=>s+r.valor,0);
      const noches = db.reservas.filter(r=>r.propiedad===p.id && r.desde<=hasta && r.hasta>=desde)
        .reduce((s,r)=>s+diffDias(r.desde>desde?r.desde:desde, r.hasta<hasta?r.hasta:hasta),0);
      const total = diffDias(desde,hasta)+1;
      return { p, horas, costo, ingreso:ing, noches, ocupacion:(noches/total)*100,
        margen: ing>0 ? ((ing-costo)/ing)*100 : 0 };
    });

    return { porEmpleado, porPropiedad };
  }, [db,desde,hasta]);

  const REPS = [
    {id:'horas',    label:'Horas y recargos', icon:'clock'},
    {id:'costo',    label:'Costo por empleado', icon:'money'},
    {id:'propiedad',label:'Costo por propiedad', icon:'home'},
    {id:'novedades',label:'Ausentismo', icon:'alert'},
    {id:'rotacion', label:'Rotación', icon:'users'}
  ];

  const exportar = () => {
    const map = {
      horas: data.porEmpleado.map(d=>({empleado:d.e.nombre,cargo:d.e.cargo,dias:d.dias,
        h_efectivas:fmtNum(d.res.totalEfectivo),h_extras:fmtNum(d.ext),h_nocturnas:fmtNum(d.noct),
        h_dominicales:fmtNum(d.dom),h_disponibilidad:fmtNum(d.res.disponibilidadHrs)})),
      costo: data.porEmpleado.map(d=>({empleado:d.e.nombre,cargo:d.e.cargo,salario_base:d.e.salario,
        valor_horas:Math.round(d.val.subtotal),valor_disponibilidad:Math.round(d.val.disponibilidad.total),
        total:Math.round(d.val.total),costo_hora_efectiva:Math.round(d.val.total/(d.res.totalEfectivo||1))})),
      propiedad: data.porPropiedad.map(d=>({propiedad:d.p.nombre,horas:fmtNum(d.horas),
        costo_laboral:Math.round(d.costo),ingreso:d.ingreso,noches_ocupadas:d.noches,
        ocupacion_pct:fmtNum(d.ocupacion),margen_pct:fmtNum(d.margen)})),
      novedades: data.porEmpleado.map(d=>({empleado:d.e.nombre,dias_trabajados:d.dias,
        ausencias:d.ausencias,incapacidades:d.incapacidad,total_novedades:d.novedades})),
      rotacion: db.empleados.map(e=>({empleado:e.nombre,cargo:e.cargo,ingreso:e.ingreso,
        antiguedad_dias:diffDias(e.ingreso,hoy()),contrato:e.contrato,estado:e.estado}))
    };
    exportCSV(`reporte_${rep}`, map[rep]); toast('Reporte exportado');
  };

  const maxCosto = Math.max(...data.porEmpleado.map(d=>d.val.total),1);

  return <Page title="Reportes" sub={`Análisis del período ${fmtFecha(desde)} → ${fmtFecha(hasta)}`}
    actions={<Btn v="outline" icon="download" onClick={exportar}>Exportar a Excel (CSV)</Btn>}>

    <Card className="mb-4">
      <div className="grid sm:grid-cols-4 gap-4 items-end">
        <Field label="Desde"><Input type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></Field>
        <div className="sm:col-span-2 flex gap-2 flex-wrap">
          <Btn v="outline" s="sm" onClick={()=>{setDesde(addDias('2026-07-24',-6));setHasta('2026-07-24');}}>7 días</Btn>
          <Btn v="outline" s="sm" onClick={()=>{setDesde(addDias('2026-07-24',-29));setHasta('2026-07-24');}}>30 días</Btn>
          <Btn v="outline" s="sm" onClick={()=>{setDesde('2026-07-01');setHasta('2026-07-31');}}>Julio 2026</Btn>
        </div>
      </div>
    </Card>

    <div className="flex flex-wrap gap-2 mb-5">
      {REPS.map(r => <button key={r.id} onClick={()=>setRep(r.id)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ring-1 ring-inset ${
          rep===r.id ? 'bg-brand-600 text-white ring-brand-600'
                     : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 ring-ink-200 dark:ring-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
        <Icon n={r.icon} c="w-4 h-4"/>{r.label}</button>)}
    </div>

    {rep==='horas' && <Card pad={false}>
      <Table head={['Empleado','Días','Efectivas','Extras','Nocturnas','Dominicales','Disponib.','Distribución']}>
        {data.porEmpleado.map(d => { const mx = Math.max(d.res.totalEfectivo,1);
          return <tr key={d.e.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
          <Td><div className="flex items-center gap-2.5"><Avatar nombre={d.e.nombre} size="w-8 h-8"/>
            <div><p className="font-bold">{d.e.nombre.split(' ').slice(0,2).join(' ')}</p>
              <p className="text-[11px] text-ink-400">{d.e.cargo}</p></div></div></Td>
          <Td className="num">{d.dias}</Td>
          <Td className="num font-bold">{fmtNum(d.res.totalEfectivo)}</Td>
          <Td className="num"><span className={d.ext>0?'text-amber-600 font-bold':''}>{fmtNum(d.ext)}</span></Td>
          <Td className="num"><span className={d.noct>0?'text-indigo-600 font-bold':''}>{fmtNum(d.noct)}</span></Td>
          <Td className="num"><span className={d.dom>0?'text-rose-600 font-bold':''}>{fmtNum(d.dom)}</span></Td>
          <Td className="num text-amber-600">{fmtNum(d.res.disponibilidadHrs)}</Td>
          <Td className="w-40"><div className="flex h-2 rounded-full overflow-hidden bg-ink-100 dark:bg-ink-800">
            <div className="bg-emerald-500" style={{width:`${((d.res.totalEfectivo-d.ext)/mx)*100}%`}}/>
            <div className="bg-amber-500" style={{width:`${(d.ext/mx)*100}%`}}/></div></Td>
        </tr>;})}
      </Table></Card>}

    {rep==='costo' && <Card pad={false}>
      <Table head={['Empleado','Salario base','Valor horas','Disponibilidad','Total período','Costo/hora efectiva','']}>
        {data.porEmpleado.sort((a,b)=>b.val.total-a.val.total).map(d => (
          <tr key={d.e.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={d.e.nombre} size="w-8 h-8"/>
              <div><p className="font-bold">{d.e.nombre.split(' ').slice(0,2).join(' ')}</p>
                <p className="text-[11px] text-ink-400">{d.e.cargo}</p></div></div></Td>
            <Td className="num text-xs">{fmtCOP(d.e.salario)}</Td>
            <Td className="num text-xs">{fmtCOP(d.val.subtotal)}</Td>
            <Td className="num text-xs text-amber-600">{fmtCOP(d.val.disponibilidad.total)}</Td>
            <Td className="num font-extrabold">{fmtCOP(d.val.total)}</Td>
            <Td className="num text-xs">{fmtCOP(d.val.total/(d.res.totalEfectivo||1))}</Td>
            <Td className="w-32"><Bar pct={(d.val.total/maxCosto)*100} tone="violet"/></Td>
          </tr>))}
      </Table></Card>}

    {rep==='propiedad' && <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.porPropiedad.map(d => (
        <Card key={d.p.id}>
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="min-w-0"><h3 className="font-extrabold text-ink-900 dark:text-white truncate">{d.p.nombre}</h3>
              <p className="text-[11px] text-ink-400 truncate">{d.p.ubicacion}</p></div>
            <Badge tone={d.margen>60?'emerald':d.margen>30?'amber':'rose'}>{fmtNum(d.margen,0)}% margen</Badge>
          </div>
          <div className="space-y-2.5 text-sm">
            {[['Ingreso por reservas',fmtCOP(d.ingreso),'text-emerald-600'],
              ['Costo laboral',`−${fmtCOP(d.costo)}`,'text-rose-600'],
              ['Horas operativas',`${fmtNum(d.horas,0)} h`,''],
              ['Noches ocupadas',`${d.noches} noches`,'']].map(([k,v,c])=>
              <div key={k} className="flex justify-between"><span className="text-ink-500">{k}</span>
                <span className={`font-bold num ${c||'text-ink-900 dark:text-white'}`}>{v}</span></div>)}
          </div>
          <div className="mt-4 pt-3 border-t border-ink-100 dark:border-ink-800">
            <div className="flex justify-between text-[10px] font-bold text-ink-400 mb-1.5">
              <span>OCUPACIÓN</span><span className="num">{fmtNum(d.ocupacion,0)}%</span></div>
            <Bar pct={d.ocupacion} tone={d.ocupacion>70?'emerald':d.ocupacion>40?'amber':'rose'}/>
          </div>
          <div className="mt-3 p-2.5 rounded-lg bg-ink-50 dark:bg-ink-950/50 flex justify-between">
            <span className="text-xs font-bold text-ink-500">RESULTADO</span>
            <span className={`text-sm font-extrabold num ${d.ingreso-d.costo>=0?'text-emerald-600':'text-rose-600'}`}>{fmtCOP(d.ingreso-d.costo)}</span></div>
        </Card>))}
    </div>}

    {rep==='novedades' && <Card pad={false}>
      <Table head={['Empleado','Días trabajados','Ausencias','Incapacidades','Total novedades','Índice ausentismo','']}>
        {data.porEmpleado.map(d => { const idx = d.dias>0 ? ((d.ausencias+d.incapacidad)/(d.dias+d.ausencias+d.incapacidad))*100 : 0;
          return <tr key={d.e.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={d.e.nombre} size="w-8 h-8"/>
              <span className="font-bold">{d.e.nombre.split(' ').slice(0,2).join(' ')}</span></div></Td>
            <Td className="num font-bold">{d.dias}</Td>
            <Td className="num"><span className={d.ausencias>0?'text-rose-600 font-bold':''}>{d.ausencias}</span></Td>
            <Td className="num"><span className={d.incapacidad>0?'text-amber-600 font-bold':''}>{d.incapacidad}</span></Td>
            <Td className="num">{d.novedades}</Td>
            <Td><Badge tone={idx>10?'rose':idx>5?'amber':'emerald'}>{fmtNum(idx,1)}%</Badge></Td>
            <Td className="w-32"><Bar pct={idx*5} tone={idx>10?'rose':idx>5?'amber':'emerald'}/></Td>
          </tr>;})}
      </Table></Card>}

    {rep==='rotacion' && (()=>{
      const porCargo = CARGOS.map(c => {
        const es = db.empleados.filter(e=>e.cargo===c);
        const act = es.filter(e=>e.estado==='ACTIVO');
        const antig = act.length ? act.reduce((s,e)=>s+diffDias(e.ingreso,hoy()),0)/act.length : 0;
        return { c, total:es.length, activos:act.length, inactivos:es.length-act.length,
          antiguedad:antig, rotacion: es.length ? ((es.length-act.length)/es.length)*100 : 0 };
      }).filter(x=>x.total>0);
      return <><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Stat label="Total empleados" value={db.empleados.length} icon="users" tone="brand"/>
        <Stat label="Activos" value={db.empleados.filter(e=>e.estado==='ACTIVO').length} icon="check" tone="emerald"/>
        <Stat label="Antigüedad media" value={`${fmtNum(db.empleados.reduce((s,e)=>s+diffDias(e.ingreso,hoy()),0)/db.empleados.length/365,1)} años`} icon="clock" tone="violet"/>
        <Stat label="Índice de rotación" value={`${fmtNum((db.empleados.filter(e=>e.estado!=='ACTIVO').length/db.empleados.length)*100,1)}%`} icon="chart" tone="amber"/>
      </div>
      <Card pad={false}><Table head={['Cargo','Total','Activos','Inactivos','Antigüedad media','Rotación','']}>
        {porCargo.map(x => <tr key={x.c} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
          <Td><Badge tone={x.c==='Mayordomo'?'brand':x.c==='Supervisor'?'violet':'sky'}>{x.c}</Badge></Td>
          <Td className="num font-bold">{x.total}</Td>
          <Td className="num text-emerald-600 font-bold">{x.activos}</Td>
          <Td className="num text-ink-400">{x.inactivos}</Td>
          <Td className="num">{fmtNum(x.antiguedad/365,1)} años</Td>
          <Td><Badge tone={x.rotacion>20?'rose':x.rotacion>10?'amber':'emerald'}>{fmtNum(x.rotacion,1)}%</Badge></Td>
          <Td className="w-32"><Bar pct={100-x.rotacion} tone="emerald"/></Td>
        </tr>)}
      </Table></Card></>; })()}
  </Page>;
}
