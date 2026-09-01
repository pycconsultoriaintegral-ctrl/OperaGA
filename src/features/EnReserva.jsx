import { useState, useMemo } from 'react';
import { Page, Card, Tabs, Stat, Badge, Avatar, Btn, Modal, Field, Input, Select, Area, Empty, Icon, Bar, TONE, exportCSV } from '../components/ui.jsx';
import { ESTADO_ESTADIA } from '../lib/constants.js';
import { uid, hoy, addDias, diffDias, fmtNum, fmtFecha, nombreDia } from '../lib/utils.js';
import { evaluarEstadia } from '../lib/payroll.js';

export default function EnReserva({db, set, toast, has}){
  const [sel,setSel] = useState(null);
  const [edit,setEdit] = useState(null);
  const [tab,setTab] = useState('activas');

  // Ver 'Alcance de acceso' en Empleados.jsx: Supervisor solo tiene permiso
  // sobre 'empleados_publico', así que aquí también hay que usar esa vista
  // en vez de la tabla completa — si no, el selector de "Mayordomo" al crear
  // una estadía queda sin opciones ("No hay opciones") porque db.empleados
  // le llega vacío por RLS.
  const empleados = has?.('empleados','ver') ? db.empleados : (db.empleadosPublico||[]);

  const evalua = useMemo(() => {
    const m = {};
    db.estadias.forEach(e => { m[e.id] = evaluarEstadia(e, db.asistencia, db.cfg, db.festivos); });
    return m;
  }, [db]);

  const porEstado = est => db.estadias.filter(e => e.estado===est);
  const lista = tab==='activas' ? porEstado('ACTIVA')
              : tab==='programadas' ? porEstado('PROGRAMADA') : porEstado('FINALIZADA');

  const propsActivas = db.propiedades.filter(p=>p.estado!=='INACTIVA');
  // Al editar una estadía vieja hay que poder seguir viendo su propiedad aunque
  // ya esté oculta — solo las nuevas asignaciones se limitan a las activas.
  const propsParaSeleccionar = idActual => (idActual && !propsActivas.some(p=>p.id===idActual))
    ? db.propiedades : propsActivas;

  const vacio = { id:'', empleado:empleados.find(e=>e.interno)?.id||'', propiedad:propsActivas[0]?.id||'',
                  reserva:'', desde:hoy(), hasta:addDias(hoy(),5), estado:'PROGRAMADA', obs:'' };

  const guardar = () => {
    const n=!edit.id, e=n?{...edit,id:uid()}:edit;
    set(d=>({...d, estadias: n?[...d.estadias,e]:d.estadias.map(x=>x.id===e.id?e:x)}));
    setEdit(null); toast(n?'Estadía creada':'Estadía actualizada');
  };

  const generarCompensatorio = est => {
    const ev = evalua[est.id];
    const emp = empleados.find(e=>e.id===est.empleado);
    set(d=>({...d, novedades:[{ id:uid(), empleado:est.empleado, tipo:'COMPENSATORIO',
      desde: addDias(est.hasta,1), hasta: addDias(est.hasta, Math.max(1,Math.round(ev.compensatorio))),
      dias: Math.max(1,Math.round(ev.compensatorio)),
      motivo:`Compensatorio por estadía de ${ev.total} días en ${db.propiedades.find(p=>p.id===est.propiedad)?.nombre}`,
      soporte:est.id, estado:'PENDIENTE' }, ...d.novedades]}));
    toast(`Compensatorio de ${Math.round(ev.compensatorio)} días generado para ${emp?.nombre.split(' ')[0]}`);
  };

  // Totales de cabecera
  const activas = porEstado('ACTIVA');
  const totCriticos = activas.reduce((s,e)=>s+evalua[e.id].criticos,0);
  const totDisp = activas.reduce((s,e)=>s+evalua[e.id].totalDisp,0);
  const totComp = db.estadias.filter(e=>e.estado==='FINALIZADA').reduce((s,e)=>s+evalua[e.id].compensatorio,0);

  return <Page title="En reserva" sub="Control de mayordomos alojados en la propiedad durante una reserva"
    actions={<><Btn v="outline" icon="download" onClick={()=>{
        const filas = [];
        db.estadias.forEach(e => { const ev = evalua[e.id];
          ev.dias.forEach(d => filas.push({
            estadia:e.id, empleado:empleados.find(x=>x.id===e.empleado)?.nombre,
            propiedad:db.propiedades.find(p=>p.id===e.propiedad)?.nombre, fecha:d.fecha,
            trabajo_efectivo:fmtNum(d.efectivo), descanso:fmtNum(d.descansoComputable),
            disponibilidad:fmtNum(d.disp), sin_clasificar:fmtNum(d.sinClasificar),
            bloque_continuo_mayor:fmtNum(d.bloqueMax), cumple:d.cumple?'SI':'NO' })); });
        exportCSV('control_estadias', filas); toast('Reporte exportado'); }}>Exportar control</Btn>
      <Btn icon="plus" onClick={()=>setEdit(vacio)}>Nueva estadía</Btn></>}>

    {/* Aviso legal de encabezado */}
    <Card className="mb-4 !p-4 bg-brand-50 dark:bg-brand-500/10 ring-brand-500/20">
      <div className="flex gap-3">
        <Icon n="shield" c="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5"/>
        <div className="text-xs text-brand-900 dark:text-brand-200 leading-relaxed">
          <b>Régimen aplicable:</b> el mayordomo de una propiedad con servicio de hospedaje <b>no</b> es
          trabajador doméstico — se rige por el régimen general del CST. Jornada ordinaria de 8 h/día
          y tope absoluto de {db.cfg.maxJornadaDiaria} h/día incluidas las extras. En consecuencia, cada día
          debe contener al menos <b>{db.cfg.descansoMinDiario} horas sin trabajo efectivo</b>, que pueden ser discontinuas.
        </div>
      </div>
    </Card>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <Stat label="Estadías activas" value={activas.length} icon="bed" tone="brand"
        sub={`${activas.reduce((s,e)=>s+evalua[e.id].total,0)} días en curso`}/>
      <Stat label="Incumplimientos" value={totCriticos} icon="alert" tone={totCriticos>0?'rose':'emerald'}
        sub={totCriticos>0?'Requieren corrección':'Todo conforme'}/>
      <Stat label="Horas en disponibilidad" value={fmtNum(totDisp,0)} icon="clock" tone="amber"
        sub={`Al ${db.cfg.pctDisponibilidad}% del valor hora`}/>
      <Stat label="Compensatorios por otorgar" value={fmtNum(totComp,1)} icon="calendar" tone="violet"
        sub="De estadías finalizadas"/>
    </div>

    <div className="mb-5"><Tabs active={tab} onChange={setTab} tabs={[
      {id:'activas',label:'Activas',count:porEstado('ACTIVA').length},
      {id:'programadas',label:'Programadas',count:porEstado('PROGRAMADA').length},
      {id:'finalizadas',label:'Finalizadas',count:porEstado('FINALIZADA').length}]}/></div>

    {lista.length===0 ? <Card><Empty icon="bed" title="Sin estadías" sub="No hay estadías en este estado."
        action={<Btn icon="plus" onClick={()=>setEdit(vacio)}>Crear estadía</Btn>}/></Card>
    : <div className="grid lg:grid-cols-2 gap-4">
      {lista.map(est => {
        const ev = evalua[est.id];
        const emp = empleados.find(e=>e.id===est.empleado);
        const prop = db.propiedades.find(p=>p.id===est.propiedad);
        const pct = (ev.diasConformes/ev.total)*100;
        return <Card key={est.id} className={ev.criticos>0?'ring-2 ring-rose-500/30':''}>
          <div className="flex items-start gap-3 mb-4">
            <Avatar nombre={emp?.nombre} size="w-11 h-11"/>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink-900 dark:text-white truncate">{emp?.nombre}</p>
              <p className="text-xs text-ink-500 truncate">{prop?.nombre} · {ev.total} días</p>
              <p className="text-[11px] text-ink-400">{fmtFecha(est.desde)} → {fmtFecha(est.hasta)}</p>
            </div>
            <div className="text-right shrink-0">
              <Badge tone={ESTADO_ESTADIA[est.estado].color} dot>{ESTADO_ESTADIA[est.estado].label}</Badge>
              {ev.criticos>0 && <div className="mt-1.5"><Badge tone="rose">{ev.criticos} alertas</Badge></div>}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[['Efectivo',ev.totalEfectivo,'emerald'],['Descanso',ev.totalDescanso,'sky'],
              ['Disponib.',ev.totalDisp,'amber'],['Sin clasif.',ev.totalSinClasif, ev.totalSinClasif>2?'rose':'slate']].map(([k,v,t])=>
              <div key={k} className={`p-2 rounded-lg ring-1 ring-inset text-center ${TONE[t]}`}>
                <p className="text-[9px] font-bold uppercase tracking-wide opacity-70">{k}</p>
                <p className="text-base font-extrabold num">{fmtNum(v,0)}<span className="text-[10px] opacity-60">h</span></p></div>)}
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[10px] font-bold text-ink-400 mb-1.5">
              <span>DÍAS CONFORMES</span><span className="num">{ev.diasConformes}/{ev.total}</span></div>
            <Bar pct={pct} tone={pct===100?'emerald':pct>=70?'amber':'rose'}/>
          </div>

          {/* Tira de días */}
          <div className="flex gap-1 mb-4">
            {ev.dias.map(d => <div key={d.fecha} title={`${fmtFecha(d.fecha)} · ${fmtNum(d.efectivo)} h efectivas · ${fmtNum(d.descansoComputable)} h descanso`}
              className={`flex-1 h-8 rounded grid place-items-center text-[9px] font-extrabold text-white ${
                d.cumple ? 'bg-emerald-500' : 'bg-rose-500'}`}>{d.fecha.slice(8)}</div>)}
          </div>

          {ev.excedeConsecutivos && <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-[11px] text-rose-800 dark:text-rose-300">
            <b>Atención:</b> {ev.total} días consecutivos superan el tope configurado de {db.cfg.diasMaxConsecutivos} días.</div>}

          <div className="flex gap-2">
            <Btn v="outline" s="sm" className="flex-1" onClick={()=>setSel(est)} icon="doc">Ver detalle diario</Btn>
            {est.estado==='FINALIZADA'
              ? <Btn v="soft" s="sm" className="flex-1" icon="calendar" onClick={()=>generarCompensatorio(est)}>
                  Generar {fmtNum(ev.compensatorio,1)} d compensatorio</Btn>
              : <Btn v="ghost" s="sm" icon="edit" onClick={()=>setEdit(est)}>Editar</Btn>}
          </div>
        </Card>;
      })}
    </div>}

    {/* ═══ Detalle diario ═══ */}
    <Modal open={!!sel} onClose={()=>setSel(null)} w="max-w-4xl"
      title="Control diario de la estadía"
      sub={sel && `${empleados.find(e=>e.id===sel.empleado)?.nombre} · ${db.propiedades.find(p=>p.id===sel.propiedad)?.nombre}`}>
      {sel && (()=>{ const ev = evalua[sel.id]; return <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Días de estadía',ev.total],['Días conformes',`${ev.diasConformes}/${ev.total}`],
            ['Incumplimientos',ev.criticos],['Compensatorio',`${fmtNum(ev.compensatorio,1)} d`]].map(([k,v])=>
            <div key={k} className="p-3 rounded-xl bg-ink-50 dark:bg-ink-950/50">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{k}</p>
              <p className="text-lg font-extrabold text-ink-900 dark:text-white num mt-0.5">{v}</p></div>)}
        </div>

        <div className="rounded-xl ring-1 ring-inset ring-ink-200 dark:ring-ink-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-ink-50 dark:bg-ink-950/60"><tr>
              {['Fecha','Efectivo','Descanso','Disponib.','Sin clasif.','Bloque mayor','Estado'].map(h=>
                <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-ink-500 text-[10px]">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {ev.dias.map(d => (
                <tr key={d.fecha} className={d.cumple?'':'bg-rose-50/60 dark:bg-rose-500/5'}>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{nombreDia(d.fecha)} {fmtFecha(d.fecha)}</td>
                  <td className={`px-3 py-2 num font-bold ${d.efectivo>db.cfg.maxJornadaDiaria?'text-rose-600':''}`}>{fmtNum(d.efectivo)} h</td>
                  <td className={`px-3 py-2 num font-bold ${d.descansoComputable<db.cfg.descansoMinDiario?'text-rose-600':'text-emerald-600'}`}>{fmtNum(d.descansoComputable)} h</td>
                  <td className="px-3 py-2 num text-amber-600">{fmtNum(d.disp)} h</td>
                  <td className={`px-3 py-2 num ${d.sinClasificar>0.5?'text-rose-600 font-bold':'text-ink-400'}`}>{fmtNum(d.sinClasificar)} h</td>
                  <td className="px-3 py-2 num">{fmtNum(d.bloqueMax)} h</td>
                  <td className="px-3 py-2"><Badge tone={d.cumple?'emerald':'rose'} dot>{d.cumple?'Conforme':'Revisar'}</Badge></td>
                </tr>))}
            </tbody>
          </table>
        </div>

        {/* Alertas agrupadas */}
        {(()=>{ const todas = [];
          ev.dias.forEach(d => d.alertas.forEach(a => todas.push({...a, fecha:d.fecha})));
          const crit = todas.filter(a=>a.nivel==='critico');
          const med  = todas.filter(a=>a.nivel==='medio');
          const inf  = todas.filter(a=>a.nivel==='info');
          return <div className="space-y-3">
            {[['Incumplimientos legales',crit,'rose'],['Recomendaciones',med,'amber'],['Observaciones',inf,'sky']]
              .filter(([,arr])=>arr.length>0).map(([t,arr,c])=>(
              <div key={t} className={`p-3.5 rounded-xl ring-1 ring-inset ${TONE[c]}`}>
                <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <Icon n="alert" c="w-4 h-4"/>{t} ({arr.length})</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {arr.slice(0,20).map((a,i)=><li key={i} className="text-[11px] opacity-90">
                    <b>{fmtFecha(a.fecha)}:</b> {a.msg}</li>)}</ul>
              </div>))}
          </div>;
        })()}

        <div className="p-3.5 rounded-xl bg-ink-50 dark:bg-ink-950/50 text-[11px] text-ink-600 dark:text-ink-300 leading-relaxed">
          <b>Cómo se calcula.</b> Cada día de la estadía son 24 horas. El sistema suma el tiempo declarado
          como trabajo efectivo, descanso, alimentación, sueño, disponibilidad y salidas de la propiedad.
          El descanso computable es la suma de descanso, sueño, alimentación y tiempo fuera — y puede ser
          discontinuo. Lo que no quede registrado aparece como <b>tiempo sin clasificar</b>: es el dato más
          riesgoso, porque ante una reclamación laboral el tiempo no documentado tiende a presumirse trabajado.
        </div>
      </div>; })()}
    </Modal>

    {/* ═══ Formulario ═══ */}
    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar estadía':'Nueva estadía'}
      sub={edit && `${Math.max(1,diffDias(edit.desde,edit.hasta)+1)} días`}
      footer={<><Btn v="outline" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn onClick={guardar} icon="check">Guardar</Btn></>}>
      {edit && (()=>{ const u=(k,v)=>setEdit({...edit,[k]:v});
        const dias = Math.max(1,diffDias(edit.desde,edit.hasta)+1);
        return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Mayordomo" req>
          <Select value={edit.empleado} onChange={e=>u('empleado',e.target.value)}
            options={empleados.filter(e=>e.estado==='ACTIVO').map(e=>({v:e.id,l:`${e.nombre} — ${e.cargo}${e.interno?' (interno)':''}`}))}/></Field></div>
        <div className="sm:col-span-2"><Field label="Propiedad" req>
          <Select value={edit.propiedad} onChange={e=>u('propiedad',e.target.value)}
            options={propsParaSeleccionar(edit.propiedad).map(p=>({v:p.id,l:p.nombre}))}/></Field></div>
        <div className="sm:col-span-2"><Field label="Reserva asociada">
          <Select value={edit.reserva} onChange={e=>u('reserva',e.target.value)}
            options={[{v:'',l:'Sin reserva asociada'},...db.reservas.map(r=>({v:r.id,
              l:`${r.huesped} · ${fmtFecha(r.desde)} → ${fmtFecha(r.hasta)}`}))]}/></Field></div>
        <Field label="Ingreso a la propiedad"><Input type="date" value={edit.desde} onChange={e=>u('desde',e.target.value)}/></Field>
        <Field label="Salida de la propiedad"><Input type="date" value={edit.hasta} onChange={e=>u('hasta',e.target.value)}/></Field>
        <div className="sm:col-span-2"><Field label="Estado">
          <Select value={edit.estado} onChange={e=>u('estado',e.target.value)}
            options={Object.entries(ESTADO_ESTADIA).map(([v,o])=>({v,l:o.label}))}/></Field></div>
        <div className="sm:col-span-2"><Field label="Observaciones"><Area value={edit.obs} onChange={e=>u('obs',e.target.value)}/></Field></div>
        <div className="sm:col-span-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <b>Efecto de esta estadía:</b> {dias} días × 24 h = {dias*24} h en la propiedad.
          El sistema exigirá al menos <b>{db.cfg.descansoMinDiario} h diarias de descanso</b> ({dias*db.cfg.descansoMinDiario} h en total)
          y generará <b>{fmtNum(dias*db.cfg.compensatorioPorDia,1)} días</b> de descanso compensatorio al finalizar.
          {dias > db.cfg.diasMaxConsecutivos && <span className="block mt-1.5 font-bold">
            Supera el tope de {db.cfg.diasMaxConsecutivos} días consecutivos configurado.</span>}
        </div>
      </div>; })()}
    </Modal>
  </Page>;
}
