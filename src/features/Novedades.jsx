import { useState } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Select, Area, Empty, Icon, IN, DOT, exportCSV } from '../components/ui.jsx';
import { TIPOS_NOVEDAD } from '../lib/constants.js';
import { uid, hoy, diffDias, fmtFecha } from '../lib/utils.js';

export default function Novedades({db, set, toast, has}){
  const [ft,setFt] = useState(''); const [fe,setFe] = useState('');
  const [edit,setEdit] = useState(null);

  // Ver 'Alcance de acceso' en Empleados.jsx: Supervisor solo tiene permiso
  // sobre 'empleados_publico', así que aquí también hay que usar esa vista
  // en vez de la tabla completa para poder listar a todo el equipo.
  const empleados = has?.('empleados','ver') ? db.empleados : (db.empleadosPublico||[]);

  const lista = db.novedades.filter(n => (!ft||n.tipo===ft) && (!fe||n.estado===fe))
    .sort((a,b)=>b.desde.localeCompare(a.desde));

  const vacio = { id:'', empleado:empleados[0]?.id||'', tipo:'PERMISO', desde:hoy(), hasta:hoy(),
                  dias:1, motivo:'', soporte:'', estado:'PENDIENTE' };

  const guardar = () => { if(!edit.motivo.trim()) return toast('El motivo es obligatorio','rose');
    const n=!edit.id, x={...edit, dias: Math.max(0,diffDias(edit.desde,edit.hasta)+1)};
    const r = n?{...x,id:uid()}:x;
    set(d=>({...d, novedades: n?[...d.novedades,r]:d.novedades.map(y=>y.id===r.id?r:y)}));
    setEdit(null); toast(n?'Novedad registrada':'Novedad actualizada'); };

  const cambiarEstado = (n,estado) => {
    set(d=>({...d, novedades: d.novedades.map(x=>x.id===n.id?{...x,estado}:x),
      auditoria:[{id:uid(),fecha:new Date().toISOString().slice(0,16).replace('T',' '),
        usuario:'PYC Consultoria Integral SAS', accion: estado==='APROBADA'?'APROBAR':'RECHAZAR',
        entidad:`Novedad ${n.id}`, detalle:`${TIPOS_NOVEDAD[n.tipo].label} — ${empleados.find(e=>e.id===n.empleado)?.nombre}`},...d.auditoria]}));
    toast(estado==='APROBADA'?'Novedad aprobada':'Novedad rechazada', estado==='APROBADA'?'emerald':'rose');
  };

  const stats = Object.keys(TIPOS_NOVEDAD).map(k => ({ k, ...TIPOS_NOVEDAD[k],
    n: db.novedades.filter(x=>x.tipo===k).length,
    dias: db.novedades.filter(x=>x.tipo===k).reduce((s,x)=>s+x.dias,0) })).filter(s=>s.n>0);

  return <Page title="Novedades" sub="Permisos, vacaciones, licencias, incapacidades y actos administrativos"
    actions={<><Btn v="outline" icon="download" onClick={()=>exportCSV('novedades', db.novedades.map(n=>({
        empleado:empleados.find(e=>e.id===n.empleado)?.nombre, tipo:TIPOS_NOVEDAD[n.tipo].label,
        desde:n.desde, hasta:n.hasta, dias:n.dias, motivo:n.motivo, soporte:n.soporte, estado:n.estado})))}>Exportar</Btn>
      <Btn icon="plus" onClick={()=>setEdit(vacio)}>Nueva novedad</Btn></>}>

    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
      {stats.map(s => <Card key={s.k} className="!p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 truncate">{s.label}</p>
        <div className="flex items-end gap-2 mt-1.5">
          <span className="text-2xl font-extrabold text-ink-900 dark:text-white num">{s.n}</span>
          <span className="text-[11px] text-ink-400 mb-1">{s.dias} días</span></div>
        <div className={`mt-2 h-1 rounded-full ${DOT[s.color]}`}/>
      </Card>)}
    </div>

    <Card pad={false}>
      <div className="p-4 flex flex-col sm:flex-row gap-2.5 border-b border-ink-200 dark:border-ink-800">
        <select className={IN+' sm:w-56'} value={ft} onChange={e=>setFt(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.values(TIPOS_NOVEDAD).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select className={IN+' sm:w-48'} value={fe} onChange={e=>setFe(e.target.value)}>
          <option value="">Todos los estados</option>
          {['PENDIENTE','APROBADA','RECHAZADA','REGISTRADA'].map(e=><option key={e}>{e}</option>)}</select>
      </div>
      {lista.length===0 ? <Empty icon="doc" title="Sin novedades" sub="No hay registros con los filtros aplicados."/>
      : <Table head={['Empleado','Tipo','Período','Días','Motivo','Estado','']}>
        {lista.map(n => {
          const e = empleados.find(x=>x.id===n.empleado); const t = TIPOS_NOVEDAD[n.tipo];
          const tone = n.estado==='APROBADA'?'emerald':n.estado==='PENDIENTE'?'amber':n.estado==='RECHAZADA'?'rose':'slate';
          return <tr key={n.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={e?.nombre} size="w-8 h-8"/>
              <div className="min-w-0"><p className="font-bold truncate">{e?.nombre.split(' ').slice(0,2).join(' ')}</p>
                <p className="text-[11px] text-ink-400">{e?.cargo}</p></div></div></Td>
            <Td><Badge tone={t.color} dot>{t.label}</Badge>
              {t.remunerado && <span className="block text-[10px] text-emerald-600 mt-1 font-semibold">Remunerada</span>}</Td>
            <Td className="text-xs whitespace-nowrap">{fmtFecha(n.desde)}<br/><span className="text-ink-400">→ {fmtFecha(n.hasta)}</span></Td>
            <Td className="num font-bold">{n.dias}</Td>
            <Td className="max-w-[240px]"><p className="text-xs truncate" title={n.motivo}>{n.motivo}</p>
              {n.soporte && <p className="text-[10px] text-ink-400 mt-0.5">Soporte: {n.soporte}</p>}</Td>
            <Td><Badge tone={tone} dot>{n.estado}</Badge></Td>
            <Td className="text-right whitespace-nowrap">
              {n.estado==='PENDIENTE' && <>
                <button onClick={()=>cambiarEstado(n,'APROBADA')} title="Aprobar"
                  className="p-1.5 rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><Icon n="check" c="w-4 h-4"/></button>
                <button onClick={()=>cambiarEstado(n,'RECHAZADA')} title="Rechazar"
                  className="p-1.5 rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon n="x" c="w-4 h-4"/></button></>}
              <button onClick={()=>setEdit(n)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="edit" c="w-4 h-4"/></button>
            </Td></tr>;})}
      </Table>}
    </Card>

    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar novedad':'Nueva novedad'}
      sub={edit && `${Math.max(0,diffDias(edit.desde,edit.hasta)+1)} día(s)`}
      footer={<><Btn v="outline" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn onClick={guardar} icon="check">Guardar</Btn></>}>
      {edit && (()=>{const u=(k,v)=>setEdit({...edit,[k]:v}); const t=TIPOS_NOVEDAD[edit.tipo];
        return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Empleado" req><Select value={edit.empleado} onChange={e=>u('empleado',e.target.value)}
          options={empleados.map(e=>({v:e.id,l:`${e.nombre} — ${e.cargo}`}))}/></Field></div>
        <div className="sm:col-span-2"><Field label="Tipo de novedad"
          hint={t.remunerado?'Novedad remunerada — se paga al trabajador':'Novedad no remunerada — se descuenta'}>
          <Select value={edit.tipo} onChange={e=>u('tipo',e.target.value)}
            options={Object.values(TIPOS_NOVEDAD).map(x=>({v:x.id,l:x.label}))}/></Field></div>
        <Field label="Desde"><Input type="date" value={edit.desde} onChange={e=>u('desde',e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={edit.hasta} onChange={e=>u('hasta',e.target.value)}/></Field>
        <Field label="Estado"><Select value={edit.estado} onChange={e=>u('estado',e.target.value)}
          options={['PENDIENTE','APROBADA','RECHAZADA','REGISTRADA']}/></Field>
        <Field label="N.º de soporte" hint="Incapacidad, acta, radicado…"><Input value={edit.soporte} onChange={e=>u('soporte',e.target.value)}/></Field>
        <div className="sm:col-span-2"><Field label="Motivo" req><Area value={edit.motivo} onChange={e=>u('motivo',e.target.value)}/></Field></div>
        {edit.tipo==='VACACIONES' && <div className="sm:col-span-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200">
          <b>CST art. 186:</b> 15 días hábiles por año de servicio. Se cuentan en días hábiles — domingos y festivos no descuentan.</div>}
      </div>;})()}
    </Modal>
  </Page>;
}
