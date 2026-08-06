import { useState, useMemo } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Stat, Icon, Tabs, exportCSV } from '../components/ui.jsx';
import { liquidar, valorizar, prestaciones, aportes } from '../lib/payroll.js';
import { fmtCOP, fmtNum, fmtFecha, hoy, pad } from '../lib/utils.js';

// Límites del mes en curso, para los atajos de período y los valores por defecto.
function mesActual(){
  const [anio,mes] = hoy().split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const f = d => `${anio}-${pad(mes)}-${pad(d)}`;
  return { primero:f(1), quince:f(15), dieciseis:f(16), ultimo:f(ultimoDia) };
}

export default function Liquidacion({db, toast}){
  const m = mesActual();
  const [desde,setDesde] = useState(m.primero);
  const [hasta,setHasta] = useState(hoy());
  const [sel,setSel] = useState(null);
  const [modo,setModo] = useState('completa'); // 'completa' | 'basica' (sin horas extras ni recargos)

  const calc = useMemo(() => db.empleados.filter(e=>e.estado==='ACTIVO').map(e => {
    const regs = db.asistencia.filter(r=>r.empleado===e.id && r.fecha>=desde && r.fecha<=hasta);
    const res = liquidar(regs, db.cfg, db.festivos);
    const val = valorizar(res, e.salario, db.cfg);
    const dias = Object.keys(res.detalle).length;
    const prest = prestaciones(val.total, dias, db.cfg);
    const ap = aportes(val.total);
    const auxT = e.salario <= db.cfg.salarioMinimo*db.cfg.topeAuxTransporte
      ? db.cfg.auxTransporte * dias/30 : 0;
    const devengado = val.total + auxT;
    const deducciones = ap.empleado.salud + ap.empleado.pension;

    // Nómina básica: todas las horas efectivas al valor hora simple, sin
    // aplicar los factores de recargo (extra/nocturno/dominical). La
    // disponibilidad se mantiene igual — no es un recargo, es otra tarifa.
    const valorHorasBasico = res.totalEfectivo * val.valorHoraBase;
    const devengadoBasico = valorHorasBasico + val.disponibilidad.total + auxT;
    const apBasico = aportes(devengadoBasico);
    const prestBasico = prestaciones(devengadoBasico, dias, db.cfg);
    const deduccionesBasico = apBasico.empleado.salud + apBasico.empleado.pension;
    const netoBasico = devengadoBasico - deduccionesBasico;
    const costoEmpresaBasico = devengadoBasico
      + Object.values(apBasico.empleador).reduce((a,b)=>a+b,0)
      + Object.values(prestBasico).reduce((a,b)=>a+b,0);

    return { emp:e, res, val, dias, prest, ap, auxT, devengado, deducciones, neto: devengado-deducciones,
      costoEmpresa: devengado + Object.values(ap.empleador).reduce((a,b)=>a+b,0) + Object.values(prest).reduce((a,b)=>a+b,0),
      valorHorasBasico, devengadoBasico, deduccionesBasico, netoBasico, costoEmpresaBasico };
  }), [db,desde,hasta]);

  const tot = calc.reduce((a,c)=>({
    horas:a.horas+c.res.totalEfectivo, disp:a.disp+c.res.disponibilidadHrs,
    devengado:a.devengado+(modo==='basica'?c.devengadoBasico:c.devengado),
    neto:a.neto+(modo==='basica'?c.netoBasico:c.neto),
    costoEmpresa:a.costoEmpresa+(modo==='basica'?c.costoEmpresaBasico:c.costoEmpresa)
  }),{horas:0,disp:0,devengado:0,neto:0,costoEmpresa:0});

  const exportar = () => {
    if(modo==='basica'){
      exportCSV('liquidacion_basica_sin_recargos', calc.map(c=>({
        empleado:c.emp.nombre, cargo:c.emp.cargo, dias:c.dias,
        horas_totales:fmtNum(c.res.totalEfectivo+c.res.disponibilidadHrs),
        salario_base:c.emp.salario, valor_hora:Math.round(c.val.valorHoraBase),
        valor_horas_sin_recargos:Math.round(c.valorHorasBasico), aux_transporte:Math.round(c.auxT),
        devengado:Math.round(c.devengadoBasico), deducciones:Math.round(c.deduccionesBasico),
        neto:Math.round(c.netoBasico)})));
      toast('Nómina básica exportada');
    } else {
      exportCSV('liquidacion', calc.map(c=>({
        empleado:c.emp.nombre, cargo:c.emp.cargo, dias:c.dias,
        horas_efectivas:fmtNum(c.res.totalEfectivo), horas_disponibilidad:fmtNum(c.res.disponibilidadHrs),
        salario_base:c.emp.salario, valor_horas:Math.round(c.val.subtotal),
        valor_disponibilidad:Math.round(c.val.disponibilidad.total), aux_transporte:Math.round(c.auxT),
        devengado:Math.round(c.devengado), deducciones:Math.round(c.deducciones), neto:Math.round(c.neto),
        costo_total_empresa:Math.round(c.costoEmpresa)})));
      toast('Liquidación exportada');
    }
  };

  return <Page title="Liquidación" sub={`Período ${fmtFecha(desde)} → ${fmtFecha(hasta)} · normativa vigente jul. 2026`}
    actions={<Btn v="outline" icon="download" onClick={exportar}>
      {modo==='basica' ? 'Exportar nómina básica' : 'Exportar nómina'}</Btn>}>

    <Card className="mb-4">
      <div className="grid sm:grid-cols-4 gap-4 items-end">
        <Field label="Desde"><Input type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></Field>
        <div className="sm:col-span-2 flex gap-2 flex-wrap">
          <Btn v="outline" s="sm" onClick={()=>{setDesde(m.primero);setHasta(m.quince);}}>1.ª quincena</Btn>
          <Btn v="outline" s="sm" onClick={()=>{setDesde(m.dieciseis);setHasta(m.ultimo);}}>2.ª quincena</Btn>
          <Btn v="outline" s="sm" onClick={()=>{setDesde(m.primero);setHasta(m.ultimo);}}>Mes completo</Btn>
        </div>
      </div>
    </Card>

    <div className="mb-4"><Tabs active={modo} onChange={setModo} tabs={[
      {id:'completa',label:'Liquidación completa (con recargos)'},
      {id:'basica',label:'Nómina básica (sin extras ni recargos)'}]}/></div>

    {modo==='basica' && <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
      <b>Solo para consulta/cruce con otro sistema.</b> Esta vista paga todas las horas trabajadas al valor
      hora simple, sin los recargos por horas extra, nocturnas o dominicales/festivas que exige la ley — el
      pago real al empleado debe hacerse con la <b>liquidación completa</b>, no con esta.</div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <Stat label="Horas efectivas" value={fmtNum(tot.horas,0)} icon="clock" tone="emerald" sub={`+ ${fmtNum(tot.disp,0)} h disponibilidad`}/>
      <Stat label="Total devengado" value={fmtCOP(tot.devengado)} icon="money" tone="brand" sub={`${calc.length} empleados`}/>
      <Stat label="Neto a pagar" value={fmtCOP(tot.neto)} icon="check" tone="violet" sub="Después de deducciones"/>
      <Stat label="Costo total empresa" value={fmtCOP(tot.costoEmpresa)} icon="chart" tone="amber" sub="Incl. aportes y prestaciones"/>
    </div>

    {modo==='completa' ? <Card pad={false}>
      <Table head={['Empleado','Días','H. efectivas','H. disponib.','Valor horas','Disponib.','Aux. transp.','Devengado','Deducc.','Neto','']}>
        {calc.map(c => (
          <tr key={c.emp.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={c.emp.nombre} size="w-8 h-8"/>
              <div className="min-w-0"><p className="font-bold truncate">{c.emp.nombre.split(' ').slice(0,2).join(' ')}</p>
                <p className="text-[11px] text-ink-400">{c.emp.cargo}</p></div></div></Td>
            <Td className="num">{c.dias}</Td>
            <Td className="num font-semibold">{fmtNum(c.res.totalEfectivo)}</Td>
            <Td className="num text-amber-600 font-semibold">{fmtNum(c.res.disponibilidadHrs)}</Td>
            <Td className="num text-xs">{fmtCOP(c.val.subtotal)}</Td>
            <Td className="num text-xs">{fmtCOP(c.val.disponibilidad.total)}</Td>
            <Td className="num text-xs">{c.auxT>0?fmtCOP(c.auxT):'—'}</Td>
            <Td className="num font-bold">{fmtCOP(c.devengado)}</Td>
            <Td className="num text-xs text-rose-600">−{fmtCOP(c.deducciones)}</Td>
            <Td className="num font-extrabold text-emerald-700 dark:text-emerald-400">{fmtCOP(c.neto)}</Td>
            <Td className="text-right"><Btn v="soft" s="sm" onClick={()=>setSel(c)}>Detalle</Btn></Td>
          </tr>))}
        <tr className="bg-ink-50 dark:bg-ink-950/60 font-extrabold">
          <Td className="font-extrabold">TOTAL</Td><Td/>
          <Td className="num">{fmtNum(tot.horas)}</Td><Td className="num">{fmtNum(tot.disp)}</Td>
          <Td/><Td/><Td/>
          <Td className="num">{fmtCOP(tot.devengado)}</Td><Td/>
          <Td className="num text-emerald-700 dark:text-emerald-400">{fmtCOP(tot.neto)}</Td><Td/>
        </tr>
      </Table>
    </Card> : <Card pad={false}>
      <Table head={['Empleado','Días','Horas totales','Valor hora','Valor horas','Aux. transp.','Devengado','Deducc.','Neto']}>
        {calc.map(c => (
          <tr key={c.emp.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={c.emp.nombre} size="w-8 h-8"/>
              <div className="min-w-0"><p className="font-bold truncate">{c.emp.nombre.split(' ').slice(0,2).join(' ')}</p>
                <p className="text-[11px] text-ink-400">{c.emp.cargo}</p></div></div></Td>
            <Td className="num">{c.dias}</Td>
            <Td className="num font-semibold">{fmtNum(c.res.totalEfectivo+c.res.disponibilidadHrs)}</Td>
            <Td className="num text-xs">{fmtCOP(c.val.valorHoraBase)}</Td>
            <Td className="num text-xs">{fmtCOP(c.valorHorasBasico)}</Td>
            <Td className="num text-xs">{c.auxT>0?fmtCOP(c.auxT):'—'}</Td>
            <Td className="num font-bold">{fmtCOP(c.devengadoBasico)}</Td>
            <Td className="num text-xs text-rose-600">−{fmtCOP(c.deduccionesBasico)}</Td>
            <Td className="num font-extrabold text-emerald-700 dark:text-emerald-400">{fmtCOP(c.netoBasico)}</Td>
          </tr>))}
        <tr className="bg-ink-50 dark:bg-ink-950/60 font-extrabold">
          <Td className="font-extrabold">TOTAL</Td><Td/>
          <Td className="num">{fmtNum(tot.horas+tot.disp)}</Td>
          <Td/><Td/><Td/>
          <Td className="num">{fmtCOP(tot.devengado)}</Td><Td/>
          <Td className="num text-emerald-700 dark:text-emerald-400">{fmtCOP(tot.neto)}</Td>
        </tr>
      </Table>
    </Card>}

    {/* Detalle de liquidación */}
    <Modal open={!!sel} onClose={()=>setSel(null)} w="max-w-3xl"
      title="Desprendible de liquidación" sub={sel && `${sel.emp.nombre} · ${fmtFecha(desde)} → ${fmtFecha(hasta)}`}>
      {sel && <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[['Salario básico',fmtCOP(sel.emp.salario)],['Valor hora ordinaria',fmtCOP(sel.val.valorHoraBase)],
            ['Días liquidados',sel.dias]].map(([k,v])=>
            <div key={k} className="p-3 rounded-xl bg-ink-50 dark:bg-ink-950/50">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{k}</p>
              <p className="text-sm font-extrabold text-ink-900 dark:text-white mt-1 num">{v}</p></div>)}
        </div>

        <div>
          <h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-2">Desglose de horas y recargos</h5>
          <div className="rounded-xl ring-1 ring-inset ring-ink-200 dark:ring-ink-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-ink-50 dark:bg-ink-950/60"><tr>
                {['Concepto','Recargo','Horas','Valor hora','Total'].map(h=>
                  <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-ink-500 text-[10px]">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {sel.val.lineas.map(l => <tr key={l.k}>
                  <td className="px-3 py-2 font-semibold text-ink-800 dark:text-ink-100">{l.label}</td>
                  <td className="px-3 py-2"><Badge tone={l.recargoPct===0?'slate':l.recargoPct>=90?'rose':'amber'}>+{l.recargoPct}%</Badge></td>
                  <td className="px-3 py-2 num font-semibold">{fmtNum(l.horas)}</td>
                  <td className="px-3 py-2 num text-ink-500">{fmtCOP(l.valorHora)}</td>
                  <td className="px-3 py-2 num font-bold text-ink-900 dark:text-white">{fmtCOP(l.total)}</td></tr>)}
                {sel.val.disponibilidad.horas>0 && <tr className="bg-amber-50/50 dark:bg-amber-500/5">
                  <td className="px-3 py-2 font-semibold text-ink-800 dark:text-ink-100">Tiempo de disponibilidad</td>
                  <td className="px-3 py-2"><Badge tone="amber">{db.cfg.pctDisponibilidad}% v/h</Badge></td>
                  <td className="px-3 py-2 num font-semibold">{fmtNum(sel.val.disponibilidad.horas)}</td>
                  <td className="px-3 py-2 num text-ink-500">{fmtCOP(sel.val.disponibilidad.valorHora)}</td>
                  <td className="px-3 py-2 num font-bold text-ink-900 dark:text-white">{fmtCOP(sel.val.disponibilidad.total)}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div><h5 className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 mb-2">Devengado</h5>
            <div className="space-y-1 text-sm">
              {[['Horas y recargos',sel.val.subtotal],['Disponibilidad',sel.val.disponibilidad.total],
                ['Auxilio de transporte',sel.auxT]].filter(([,v])=>v>0).map(([k,v])=>
                <div key={k} className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-500">{k}</span><span className="font-semibold num">{fmtCOP(v)}</span></div>)}
              <div className="flex justify-between py-2 font-extrabold text-emerald-700 dark:text-emerald-400">
                <span>Total devengado</span><span className="num">{fmtCOP(sel.devengado)}</span></div>
            </div></div>
          <div><h5 className="text-[11px] font-bold uppercase tracking-wide text-rose-600 mb-2">Deducciones</h5>
            <div className="space-y-1 text-sm">
              {[['Salud (4%)',sel.ap.empleado.salud],['Pensión (4%)',sel.ap.empleado.pension]].map(([k,v])=>
                <div key={k} className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-500">{k}</span><span className="font-semibold num">−{fmtCOP(v)}</span></div>)}
              <div className="flex justify-between py-2 font-extrabold text-rose-700 dark:text-rose-400">
                <span>Total deducciones</span><span className="num">−{fmtCOP(sel.deducciones)}</span></div>
            </div></div>
        </div>

        <div className="p-4 rounded-xl bg-brand-600 text-white flex justify-between items-center">
          <span className="font-bold">NETO A PAGAR</span>
          <span className="text-2xl font-extrabold num">{fmtCOP(sel.neto)}</span></div>

        <div>
          <h5 className="text-[11px] font-bold uppercase tracking-wide text-violet-600 mb-2">Provisiones y aportes del empleador</h5>
          <div className="grid sm:grid-cols-2 gap-x-6 text-sm">
            {[['Cesantías',sel.prest.cesantias],['Int. cesantías',sel.prest.intCesantias],
              ['Prima de servicios',sel.prest.prima],['Vacaciones',sel.prest.vacaciones],
              ['Salud (8.5%)',sel.ap.empleador.salud],['Pensión (12%)',sel.ap.empleador.pension],
              ['ARL',sel.ap.empleador.arl],['Caja / ICBF / SENA',sel.ap.empleador.caja+sel.ap.empleador.icbf+sel.ap.empleador.sena]
            ].map(([k,v])=><div key={k} className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
              <span className="text-ink-500">{k}</span><span className="font-semibold num">{fmtCOP(v)}</span></div>)}
          </div>
          <div className="flex justify-between mt-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 font-extrabold text-violet-800 dark:text-violet-300">
            <span>COSTO TOTAL EMPRESA</span><span className="num">{fmtCOP(sel.costoEmpresa)}</span></div>
        </div>

        {sel.res.alertas.length>0 && <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 ring-1 ring-inset ring-rose-500/20">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300 mb-2 flex items-center gap-1.5">
            <Icon n="alert" c="w-4 h-4"/>Alertas de cumplimiento en el período</p>
          <ul className="space-y-1">{sel.res.alertas.map((a,i)=>
            <li key={i} className="text-[11px] text-rose-700 dark:text-rose-400">• {a.fecha!=='—'?fmtFecha(a.fecha)+': ':''}{a.msg}</li>)}</ul></div>}
      </div>}
    </Modal>
  </Page>;
}
