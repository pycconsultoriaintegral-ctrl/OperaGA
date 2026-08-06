import { useState, useMemo } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Select, Area, Tabs, Empty, Bar, Icon, TONE, exportCSV } from '../components/ui.jsx';
import { TIPOS_TIEMPO } from '../lib/constants.js';
import { uid, hm2min, fmtNum, addDias, esDomingo, fmtFechaLarga, fmtFecha, nombreDia, hoy } from '../lib/utils.js';
import { liquidar } from '../lib/payroll.js';

export default function Asistencia({db, set, toast}){
  const [fecha,setFecha] = useState(hoy());
  const [emp,setEmp] = useState('');
  const [edit,setEdit] = useState(null);
  const [tab,setTab] = useState('dia');

  const activos = db.empleados.filter(e=>e.estado==='ACTIVO');
  const delDia = db.asistencia.filter(r => r.fecha===fecha && (!emp||r.empleado===emp))
    .sort((a,b)=>hm2min(a.entrada)-hm2min(b.entrada));

  const vacio = { id:'', empleado:activos[0]?.id||'', propiedad:'', fecha, tipo:'EFECTIVO',
                  entrada:'08:00', salida:'12:00', metodo:'MANUAL', obs:'' };

  const guardar = () => {
    const n=!edit.id, r=n?{...edit,id:uid()}:edit;
    set(d=>({...d, asistencia: n?[...d.asistencia,r]:d.asistencia.map(x=>x.id===r.id?r:x)}));
    setEdit(null); toast(n?'Marcación registrada':'Marcación actualizada');
  };
  const borrar = id => { set(d=>({...d, asistencia:d.asistencia.filter(x=>x.id!==id)})); toast('Marcación eliminada','rose'); };

  const resumen = useMemo(() => activos.map(e => {
    const regs = db.asistencia.filter(r=>r.empleado===e.id && r.fecha===fecha);
    if(!regs.length) return null;
    const r = liquidar(regs, db.cfg, db.festivos);
    const ext = r.horas.extraDiurna+r.horas.extraNocturna+r.horas.extraDomDiurna+r.horas.extraDomNocturna;
    const noct = r.horas.ordNocturna+r.horas.extraNocturna+r.horas.domNocturna+r.horas.extraDomNocturna;
    return { emp:e, efectivo:r.totalEfectivo, ext, noct, disp:r.disponibilidadHrs,
             desc:r.descansoHrs, alertas:r.alertas, entrada:regs[0]?.entrada };
  }).filter(Boolean), [db,fecha]);

  const totDia = resumen.reduce((a,r)=>({ef:a.ef+r.efectivo, ex:a.ex+r.ext, di:a.di+r.disp}),{ef:0,ex:0,di:0});

  const serie7 = useMemo(()=>Array.from({length:7},(_,i)=>{
    const f = addDias(fecha, i-6);
    const r = liquidar(db.asistencia.filter(x=>x.fecha===f), db.cfg, db.festivos);
    return { f, ef:r.totalEfectivo, di:r.disponibilidadHrs };
  }),[db,fecha]);
  const max7 = Math.max(...serie7.map(s=>s.ef+s.di),1);

  const durMin = r => { if(r.entrada===r.salida) return 0;  // marcación abierta, sin salida todavía
    let d = hm2min(r.salida)-hm2min(r.entrada); return d<=0 ? d+1440 : d; };

  return <Page title="Asistencia" sub="Registro y control de marcaciones con tipología de tiempos"
    actions={<><Btn v="outline" icon="download" onClick={()=>exportCSV('asistencia', db.asistencia.map(r=>({
        fecha:r.fecha, empleado:db.empleados.find(e=>e.id===r.empleado)?.nombre,
        propiedad:db.propiedades.find(p=>p.id===r.propiedad)?.nombre||'',
        tipo:TIPOS_TIEMPO[r.tipo]?.label, entrada:r.entrada, salida:r.salida,
        horas:fmtNum(durMin(r)/60), metodo:r.metodo, observaciones:r.obs})))}>Exportar</Btn>
      <Btn icon="plus" onClick={()=>setEdit(vacio)}>Nueva marcación</Btn></>}>

    <Card className="mb-4">
      <div className="grid sm:grid-cols-4 gap-4 items-end">
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Field>
        <Field label="Empleado"><Select value={emp} onChange={e=>setEmp(e.target.value)}
          options={[{v:'',l:'Todos'},...activos.map(e=>({v:e.id,l:e.nombre}))]}/></Field>
        <div className="sm:col-span-2 flex gap-2 flex-wrap">
          <Btn v="outline" s="sm" onClick={()=>setFecha(addDias(fecha,-1))} icon="chevL">Anterior</Btn>
          <Btn v="outline" s="sm" onClick={()=>setFecha(hoy())}>Hoy</Btn>
          <Btn v="outline" s="sm" onClick={()=>setFecha(addDias(fecha,1))}>Siguiente</Btn>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className={`text-xs font-bold ${esDomingo(fecha)||db.festivos.includes(fecha)?'text-rose-600':'text-ink-600 dark:text-ink-300'}`}>
          {fmtFechaLarga(fecha)}{db.festivos.includes(fecha) ? ' · FESTIVO' : ''}{esDomingo(fecha) ? ' · DOMINGO' : ''}</span>
        <div className="flex gap-4 text-xs ml-auto">
          <span className="text-ink-500">Efectivo <b className="text-ink-900 dark:text-white num">{fmtNum(totDia.ef)} h</b></span>
          <span className="text-ink-500">Extras <b className="text-amber-600 num">{fmtNum(totDia.ex)} h</b></span>
          <span className="text-ink-500">Disponibilidad <b className="text-ink-900 dark:text-white num">{fmtNum(totDia.di)} h</b></span>
        </div>
      </div>
    </Card>

    <div className="mb-5"><Tabs active={tab} onChange={setTab} tabs={[
      {id:'dia',label:'Resumen del día',count:resumen.length},
      {id:'marcaciones',label:'Marcaciones',count:delDia.length},
      {id:'tendencia',label:'Tendencia 7 días'}]}/></div>

    {tab==='dia' && (resumen.length===0
      ? <Card><Empty icon="clock" title="Sin marcaciones este día" sub="No hay registros de asistencia para la fecha seleccionada."
          action={<Btn icon="plus" onClick={()=>setEdit(vacio)}>Registrar marcación</Btn>}/></Card>
      : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {resumen.map(r => (
          <Card key={r.emp.id} className={r.alertas.length?'ring-2 ring-rose-500/30':''}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar nombre={r.emp.nombre} size="w-10 h-10"/>
              <div className="min-w-0 flex-1"><p className="font-bold text-ink-900 dark:text-white truncate">{r.emp.nombre.split(' ').slice(0,2).join(' ')}</p>
                <p className="text-[11px] text-ink-500">{r.emp.cargo} · ingreso {r.entrada}</p></div>
              {r.alertas.length>0 && <Badge tone="rose">{r.alertas.length}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[['Efectivo',r.efectivo,'emerald'],['Extras',r.ext,r.ext>db.cfg.extrasMaxDia?'rose':'amber'],
                ['Nocturnas',r.noct,'indigo'],['Disponible',r.disp,'amber']].map(([k,v,t])=>
                <div key={k} className={`p-2.5 rounded-lg ring-1 ring-inset ${TONE[t]||TONE.slate}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{k}</p>
                  <p className="text-lg font-extrabold num">{fmtNum(v)} <span className="text-xs font-bold opacity-60">h</span></p></div>)}
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold text-ink-400 mb-1">
                <span>JORNADA vs. LÍMITE {db.cfg.horasDiarias} H</span><span className="num">{fmtNum(r.efectivo)}/{db.cfg.horasDiarias} h</span></div>
              <Bar pct={(r.efectivo/db.cfg.horasDiarias)*100} tone={r.efectivo>db.cfg.horasDiarias?'rose':'emerald'}/>
            </div>
            {r.alertas.length>0 && <div className="mt-3 space-y-1">
              {r.alertas.map((a,i)=><p key={i} className="text-[11px] text-rose-600 dark:text-rose-400 flex gap-1.5">
                <Icon n="alert" c="w-3.5 h-3.5 shrink-0 mt-px"/>{a.msg}</p>)}</div>}
          </Card>))}
      </div>)}

    {tab==='marcaciones' && <Card pad={false}>
      {delDia.length===0 ? <Empty icon="clock" title="Sin marcaciones" sub="Registra la primera marcación del día."/>
      : <Table head={['Empleado','Tipo de tiempo','Entrada','Salida','Duración','Propiedad','Método','']}>
        {delDia.map(r => {
          const e = db.empleados.find(x=>x.id===r.empleado); const t = TIPOS_TIEMPO[r.tipo];
          const p = db.propiedades.find(x=>x.id===r.propiedad);
          return <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={e?.nombre} size="w-7 h-7"/>
              <span className="font-semibold">{e?.nombre.split(' ').slice(0,2).join(' ')}</span></div></Td>
            <Td><Badge tone={t?.color} dot>{t?.label}</Badge></Td>
            <Td className="num font-bold">{r.entrada}</Td>
            <Td className="num font-bold">{r.entrada===r.salida ? '—' : r.salida}</Td>
            <Td className="num">{r.entrada===r.salida
              ? <Badge tone="amber" dot>Abierta</Badge>
              : `${fmtNum(durMin(r)/60)} h`}</Td>
            <Td className="text-xs">{p?.nombre||'—'}</Td>
            <Td><Badge tone="slate">{r.metodo}</Badge></Td>
            <Td className="text-right whitespace-nowrap">
              <button onClick={()=>setEdit(r)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="edit" c="w-4 h-4"/></button>
              <button onClick={()=>borrar(r.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon n="trash" c="w-4 h-4"/></button>
            </Td></tr>;})}
      </Table>}</Card>}

    {tab==='tendencia' && <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-ink-900 dark:text-white">Horas registradas · últimos 7 días</h3>
        <div className="flex gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"/>Efectivo</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400"/>Disponibilidad</span></div>
      </div>
      <div className="flex items-end gap-3 h-52">
        {serie7.map(s => <div key={s.f} className="flex-1 flex flex-col items-center gap-2 group">
          <div className="w-full flex flex-col justify-end h-44 relative">
            <div className="absolute -top-6 left-0 right-0 text-center text-[10px] font-extrabold text-ink-500 opacity-0 group-hover:opacity-100 num">{fmtNum(s.ef+s.di)} h</div>
            <div className="w-full bg-amber-400 rounded-t" style={{height:`${(s.di/max7)*100}%`}}/>
            <div className="w-full bg-emerald-500" style={{height:`${(s.ef/max7)*100}%`}}/>
          </div>
          <div className="text-center"><p className="text-[10px] font-bold text-ink-500">{nombreDia(s.f)}</p>
            <p className="text-[10px] text-ink-400">{s.f.slice(8)}</p></div>
        </div>)}
      </div>
    </Card>}

    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar marcación':'Nueva marcación'}
      sub={edit ? `${fmtNum(durMin(edit)/60)} horas` : ''}
      footer={<><Btn v="outline" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn onClick={guardar} icon="check">Guardar</Btn></>}>
      {edit && (()=>{const u=(k,v)=>setEdit({...edit,[k]:v}); const t=TIPOS_TIEMPO[edit.tipo];
        return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Empleado" req><Select value={edit.empleado} onChange={e=>u('empleado',e.target.value)}
          options={activos.map(e=>({v:e.id,l:`${e.nombre} — ${e.cargo}`}))}/></Field></div>
        <Field label="Fecha"><Input type="date" value={edit.fecha} onChange={e=>u('fecha',e.target.value)}/></Field>
        <Field label="Método de marcación"><Select value={edit.metodo} onChange={e=>u('metodo',e.target.value)}
          options={[{v:'MANUAL',l:'Manual'},{v:'QR',l:'Código QR'},{v:'PIN',l:'PIN'},{v:'GPS',l:'GPS (futuro)'},{v:'FOTO',l:'Fotografía'}]}/></Field>
        <div className="sm:col-span-2"><Field label="Tipo de tiempo" hint={t?.desc}>
          <Select value={edit.tipo} onChange={e=>u('tipo',e.target.value)}
            options={Object.values(TIPOS_TIEMPO).map(x=>({v:x.id,l:x.label}))}/></Field></div>
        <Field label="Hora de entrada"><Input type="time" value={edit.entrada} onChange={e=>u('entrada',e.target.value)}/></Field>
        <Field label="Hora de salida" hint="Si es menor que la entrada, se asume cruce de medianoche">
          <Input type="time" value={edit.salida} onChange={e=>u('salida',e.target.value)}/></Field>
        <div className="sm:col-span-2"><Field label="Propiedad"><Select value={edit.propiedad||''} onChange={e=>u('propiedad',e.target.value)}
          options={[{v:'',l:'Sin propiedad'},...db.propiedades.map(p=>({v:p.id,l:p.nombre}))]}/></Field></div>
        <div className="sm:col-span-2"><Field label="Observaciones"><Area value={edit.obs} onChange={e=>u('obs',e.target.value)}/></Field></div>
        {edit.tipo!=='EFECTIVO' && <div className="sm:col-span-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-500/10 ring-1 ring-inset ring-sky-500/20 text-xs text-sky-800 dark:text-sky-200">
          <b>Nota legal:</b> este tiempo NO se computa como trabajo efectivo.
          {edit.tipo==='DISPONIBLE' ? ` Se remunera al ${db.cfg.pctDisponibilidad}% del valor hora según parámetro configurado.` : ''}</div>}
      </div>;})()}
    </Modal>
  </Page>;
}
