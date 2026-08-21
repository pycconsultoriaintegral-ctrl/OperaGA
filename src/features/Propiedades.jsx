import { useState } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Select, Area, Tabs, Icon } from '../components/ui.jsx';
import { ESTADOS_PROP } from '../lib/constants.js';
import { uid, diffDias, addDias, fmtCOP, fmtFecha, fmtNum, esDomingo, nombreDia, hoy } from '../lib/utils.js';
import { supabase } from '../lib/supabaseClient.js';

export default function Propiedades({db, set, toast, refrescar}){
  const [tab,setTab] = useState('props');
  const [edit,setEdit] = useState(null); const [editR,setEditR] = useState(null);
  const [verInactivas,setVerInactivas] = useState(false);
  const HOY = hoy();

  const activas = db.propiedades.filter(p=>p.estado!=='INACTIVA');
  const inactivas = db.propiedades.filter(p=>p.estado==='INACTIVA');
  const propsListadas = verInactivas ? db.propiedades : activas;
  // Para los selects de reserva/estadía: solo propiedades activas, salvo que la
  // que ya esté elegida sea una inactiva (para no perderla al editar un registro viejo).
  const propsParaSeleccionar = (idActual) => idActual && inactivas.some(p=>p.id===idActual)
    ? db.propiedades : activas;

  const vacio  = { id:'', nombre:'', codigo:'', tipo:'Casa', ubicacion:'', capacidad:4, habitaciones:2, banos:2,
                   estado:'DISPONIBLE', mayordomo:'', tarifa:500000, notas:'', lat:'', lng:'', ipsTexto:'' };
  const vacioR = { id:'', propiedad:activas[0]?.id||'', huesped:'', desde:hoy(), hasta:addDias(hoy(),3),
                   huespedes:2, canal:'Airbnb', valor:0, estado:'CONFIRMADA' };

  const guardar = () => {
    if(!edit.nombre.trim()) return toast('El nombre es obligatorio','rose');
    if(!edit.codigo.trim()) return toast('El código de la propiedad es obligatorio (se usa en la marcación QR)','rose');
    const n=!edit.id;
    const { ipsTexto, ...resto } = edit;
    const p = { ...resto, id: n?uid():edit.id, codigo: edit.codigo.trim().toUpperCase(),
      lat: edit.lat===''?null:+edit.lat, lng: edit.lng===''?null:+edit.lng,
      ips: (ipsTexto||'').split(',').map(s=>s.trim()).filter(Boolean) };
    set(d=>({...d, propiedades: n?[...d.propiedades,p]:d.propiedades.map(x=>x.id===p.id?p:x)}));
    setEdit(null); toast(n?'Propiedad creada':'Cambios guardados'); };

  const guardarR = () => { if(!editR.huesped.trim()) return toast('El huésped es obligatorio','rose');
    const n=!editR.id, r=n?{...editR,id:uid()}:editR;
    set(d=>({...d, reservas: n?[...d.reservas,r]:d.reservas.map(x=>x.id===r.id?r:x)}));
    setEditR(null); toast(n?'Reserva creada':'Reserva actualizada'); };

  const mayordomos = db.empleados.filter(e=>e.cargo==='Mayordomo' && e.estado==='ACTIVO');

  const eliminarProp = async (p) => {
    const tieneReservas = db.reservas.some(r=>r.propiedad===p.id);
    const aviso = tieneReservas
      ? `"${p.nombre}" tiene reservas registradas. Si continúas, esas reservas y su historial de asistencia también podrían perderse. ¿Eliminar de todas formas?`
      : `¿Eliminar la propiedad "${p.nombre}"? Esta acción no se puede deshacer.`;
    if(!confirm(aviso)) return;
    try{
      const { error } = await supabase.from('propiedades').delete().eq('id', p.id);
      if(error) throw error;
      toast('Propiedad eliminada','rose'); await refrescar?.();
    }catch(e){ toast('No se pudo eliminar: tiene registros asociados (asistencia, horarios u otros). '+e.message,'rose'); }
  };

  // Ocultar conserva la propiedad y todo su historial (reservas, estadías,
  // reportes): solo la saca de las vistas operativas y de los selectores de
  // "nueva reserva/estadía". Reactivar la vuelve a mostrar donde estaba.
  const toggleOcultar = (p) => {
    const ocultando = p.estado !== 'INACTIVA';
    set(d=>({...d, propiedades: d.propiedades.map(x=>x.id===p.id
      ? {...x, estado: ocultando ? 'INACTIVA' : 'DISPONIBLE'} : x)}));
    toast(ocultando ? `"${p.nombre}" ocultada` : `"${p.nombre}" reactivada`);
  };

  return <Page title="Propiedades" sub={`${activas.length} inmuebles · ${db.reservas.filter(r=>r.estado!=='FINALIZADA').length} reservas activas`}
    actions={tab==='props'
      ? <Btn icon="plus" onClick={()=>setEdit(vacio)}>Nueva propiedad</Btn>
      : <Btn icon="plus" onClick={()=>setEditR(vacioR)}>Nueva reserva</Btn>}>

    <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
      <Tabs active={tab} onChange={setTab} tabs={[
        {id:'props',label:'Inmuebles',count:activas.length},
        {id:'reservas',label:'Reservas',count:db.reservas.length},
        {id:'calendario',label:'Calendario'}]}/>
      {tab==='props' && inactivas.length>0 &&
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-500 dark:text-ink-400 cursor-pointer select-none">
          <input type="checkbox" checked={verInactivas} onChange={e=>setVerInactivas(e.target.checked)}/>
          Mostrar ocultas ({inactivas.length})
        </label>}
    </div>

    {tab==='props' && <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {propsListadas.map(p => {
        const est = ESTADOS_PROP[p.estado]; const may = db.empleados.find(e=>e.id===p.mayordomo);
        const rsv = db.reservas.find(r=>r.propiedad===p.id && r.desde<=HOY && r.hasta>=HOY);
        const prox = db.reservas.filter(r=>r.propiedad===p.id && r.desde>HOY).sort((a,b)=>a.desde.localeCompare(b.desde))[0];
        return <Card key={p.id} className="hover:shadow-lift transition-shadow">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-extrabold text-ink-900 dark:text-white truncate">{p.nombre}</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400 flex items-center gap-1 mt-0.5 truncate">
                <Icon n="location" c="w-3.5 h-3.5 shrink-0"/>{p.ubicacion}</p></div>
            <Badge tone={est.color} dot>{est.label}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 py-3 border-y border-ink-100 dark:border-ink-800 text-center">
            {[['Capacidad',p.capacidad],['Habitaciones',p.habitaciones],['Baños',p.banos]].map(([k,v])=>
              <div key={k}><p className="text-lg font-extrabold text-ink-900 dark:text-white num">{v}</p>
                <p className="text-[10px] uppercase font-bold tracking-wide text-ink-400">{k}</p></div>)}
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-ink-500">Tarifa / noche</span>
              <span className="font-bold text-ink-900 dark:text-white num">{fmtCOP(p.tarifa)}</span></div>
            <div className="flex justify-between items-center"><span className="text-ink-500">Mayordomo</span>
              {may ? <span className="flex items-center gap-1.5 font-semibold text-ink-800 dark:text-ink-100">
                  <Avatar nombre={may.nombre} size="w-5 h-5"/>{may.nombre.split(' ').slice(0,2).join(' ')}</span>
                : <span className="text-ink-400">Sin asignar</span>}</div>
            {rsv && <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 ring-1 ring-inset ring-brand-500/15">
              <p className="font-bold text-brand-800 dark:text-brand-200">{rsv.huesped}</p>
              <p className="text-[11px] text-brand-600 dark:text-brand-400">{fmtFecha(rsv.desde)} → {fmtFecha(rsv.hasta)} · {rsv.huespedes} huéspedes</p></div>}
            {!rsv && prox && <div className="p-2.5 rounded-lg bg-ink-50 dark:bg-ink-950/50">
              <p className="text-[11px] text-ink-500">Próxima: <b className="text-ink-800 dark:text-ink-100">{prox.huesped}</b> · {fmtFecha(prox.desde)}</p></div>}
          </div>
          <div className="mt-4 flex gap-2">
            <Btn v="outline" s="sm" icon="edit" onClick={()=>setEdit({...p, lat:p.lat??'', lng:p.lng??'', ipsTexto:(p.ips||[]).join(', ')})} className="flex-1">Editar</Btn>
            {p.estado!=='INACTIVA' &&
              <Btn v="soft" s="sm" icon="calendar" onClick={()=>{setEditR({...vacioR,propiedad:p.id});}} className="flex-1">Reservar</Btn>}
            <button onClick={()=>toggleOcultar(p)} title={p.estado==='INACTIVA'?'Reactivar propiedad':'Ocultar propiedad (conserva su historial)'}
              className="p-2 rounded-lg text-ink-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 shrink-0">
              <Icon n={p.estado==='INACTIVA'?'eye':'eye-off'} c="w-4 h-4"/></button>
            <button onClick={()=>eliminarProp(p)} title="Eliminar propiedad"
              className="p-2 rounded-lg text-ink-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0">
              <Icon n="trash" c="w-4 h-4"/></button>
          </div>
        </Card>;
      })}
    </div>}

    {tab==='reservas' && <Card pad={false}>
      <Table head={['Propiedad','Huésped','Período','Noches','Canal','Valor','Estado','']}>
        {db.reservas.slice().sort((a,b)=>b.desde.localeCompare(a.desde)).map(r => {
          const p = db.propiedades.find(x=>x.id===r.propiedad);
          const noches = diffDias(r.desde,r.hasta);
          const tone = r.estado==='EN_CURSO'?'brand':r.estado==='CONFIRMADA'?'emerald':r.estado==='FINALIZADA'?'slate':'amber';
          return <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td className="font-bold">{p?.nombre||'—'}</Td>
            <Td>{r.huesped}<p className="text-[11px] text-ink-400">{r.huespedes} huéspedes</p></Td>
            <Td className="text-xs">{fmtFecha(r.desde)} → {fmtFecha(r.hasta)}</Td>
            <Td className="num font-semibold">{noches}</Td>
            <Td><Badge tone="slate">{r.canal}</Badge></Td>
            <Td className="num font-bold">{fmtCOP(r.valor)}</Td>
            <Td><Badge tone={tone} dot>{r.estado.replace('_',' ')}</Badge></Td>
            <Td className="text-right"><button onClick={()=>setEditR(r)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="edit" c="w-4 h-4"/></button></Td>
          </tr>;})}
      </Table></Card>}

    {tab==='calendario' && (()=>{
      const dias = Array.from({length:35},(_,i)=>addDias(addDias(HOY,-11),i));
      return <Card pad={false}>
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
          <h3 className="font-bold text-ink-900 dark:text-white">Ocupación · {fmtFecha(dias[0])} – {fmtFecha(dias[dias.length-1])}</h3>
          <div className="flex gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500"/>Reservada</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ink-200 dark:bg-ink-700"/>Libre</span></div>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="min-w-[900px]">
            <div className="flex gap-px mb-1.5 pl-[168px]">
              {dias.map(d => { const f=db.festivos.includes(d)||esDomingo(d);
                return <div key={d} className={`flex-1 text-center text-[9px] font-bold ${f?'text-rose-500':'text-ink-400'}`}>
                  <div>{nombreDia(d)[0]}</div><div>{d.slice(8)}</div></div>;})}
            </div>
            {db.propiedades.map(p => (
              <div key={p.id} className="flex items-center gap-px mb-1.5">
                <div className="w-[168px] shrink-0 pr-3 text-xs font-bold text-ink-800 dark:text-ink-100 truncate">{p.nombre}</div>
                {dias.map(d => {
                  const r = db.reservas.find(x=>x.propiedad===p.id && x.desde<=d && x.hasta>=d);
                  return <div key={d} title={r?`${r.huesped} · ${fmtFecha(d)}`:fmtFecha(d)}
                    className={`flex-1 h-7 rounded-sm transition-colors cursor-default ${
                      r ? (r.estado==='EN_CURSO'?'bg-brand-500':r.estado==='FINALIZADA'?'bg-ink-400':'bg-emerald-500')
                        : 'bg-ink-100 dark:bg-ink-800'}`}/>;})}
              </div>))}
          </div>
        </div>
      </Card>; })()}

    {/* Form propiedad */}
    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar propiedad':'Nueva propiedad'}
      footer={<><Btn v="outline" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn onClick={guardar} icon="check">Guardar</Btn></>}>
      {edit && (()=>{const u=(k,v)=>setEdit({...edit,[k]:v}); return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Nombre" req><Input value={edit.nombre} onChange={e=>u('nombre',e.target.value)}/></Field></div>
        <Field label="Código" req hint="El que va en el QR fijo de la propiedad, ej. VMB-01">
          <Input value={edit.codigo} onChange={e=>u('codigo',e.target.value.toUpperCase())} className="uppercase"/></Field>
        <Field label="Tipo"><Select value={edit.tipo} onChange={e=>u('tipo',e.target.value)} options={['Casa','Apartamento','Villa','Finca','Penthouse']}/></Field>
        <Field label="Estado"><Select value={edit.estado} onChange={e=>u('estado',e.target.value)}
          options={Object.entries(ESTADOS_PROP).map(([v,o])=>({v,l:o.label}))}/></Field>
        <div className="sm:col-span-2"><Field label="Ubicación"><Input value={edit.ubicacion} onChange={e=>u('ubicacion',e.target.value)}/></Field></div>
        <Field label="Capacidad"><Input type="number" value={edit.capacidad} onChange={e=>u('capacidad',+e.target.value)}/></Field>
        <Field label="Tarifa por noche"><Input type="number" value={edit.tarifa} onChange={e=>u('tarifa',+e.target.value)}/></Field>
        <Field label="Habitaciones"><Input type="number" value={edit.habitaciones} onChange={e=>u('habitaciones',+e.target.value)}/></Field>
        <Field label="Baños"><Input type="number" value={edit.banos} onChange={e=>u('banos',+e.target.value)}/></Field>
        <div className="sm:col-span-2"><Field label="Mayordomo asignado">
          <Select value={edit.mayordomo} onChange={e=>u('mayordomo',e.target.value)}
            options={[{v:'',l:'Sin asignar'},...mayordomos.map(m=>({v:m.id,l:m.nombre}))]}/></Field></div>

        <div className="sm:col-span-2 pt-2 mt-1 border-t border-ink-100 dark:border-ink-800">
          <h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-3">Marcación — geocerca e IP</h5>
        </div>
        <Field label="Latitud" hint="Clic derecho en Google Maps sobre la propiedad → copiar coordenadas">
          <Input type="number" step="0.000001" value={edit.lat} onChange={e=>u('lat',e.target.value)} placeholder="10.4712"/></Field>
        <Field label="Longitud">
          <Input type="number" step="0.000001" value={edit.lng} onChange={e=>u('lng',e.target.value)} placeholder="-75.4890"/></Field>
        <div className="sm:col-span-2"><Field label="IPs registradas" hint="IP pública del internet de la propiedad (no la del router — esa empieza por 192.168 o 10.x y nunca va a coincidir). Sepáralas por coma si hay varias. Solo corroboran, nunca bloquean una marcación">
          <Input value={edit.ipsTexto} onChange={e=>u('ipsTexto',e.target.value)} placeholder="181.49.22.140, 190.85.14.77"/></Field></div>

        <div className="sm:col-span-2"><Field label="Notas"><Area value={edit.notas} onChange={e=>u('notas',e.target.value)}/></Field></div>
      </div>;})()}
    </Modal>

    {/* Form reserva */}
    <Modal open={!!editR} onClose={()=>setEditR(null)} title={editR?.id?'Editar reserva':'Nueva reserva'}
      sub={editR && `${diffDias(editR.desde,editR.hasta)} noches`}
      footer={<><Btn v="outline" onClick={()=>setEditR(null)}>Cancelar</Btn><Btn onClick={guardarR} icon="check">Guardar</Btn></>}>
      {editR && (()=>{const u=(k,v)=>setEditR({...editR,[k]:v}); return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Propiedad"><Select value={editR.propiedad} onChange={e=>u('propiedad',e.target.value)}
          options={propsParaSeleccionar(editR.propiedad).map(p=>({v:p.id,l:p.nombre}))}/></Field></div>
        <div className="sm:col-span-2"><Field label="Huésped" req><Input value={editR.huesped} onChange={e=>u('huesped',e.target.value)}/></Field></div>
        <Field label="Check-in"><Input type="date" value={editR.desde} onChange={e=>u('desde',e.target.value)}/></Field>
        <Field label="Check-out"><Input type="date" value={editR.hasta} onChange={e=>u('hasta',e.target.value)}/></Field>
        <Field label="N.º huéspedes"><Input type="number" value={editR.huespedes} onChange={e=>u('huespedes',+e.target.value)}/></Field>
        <Field label="Canal"><Select value={editR.canal} onChange={e=>u('canal',e.target.value)} options={['Airbnb','Booking','Vrbo','Directo','Otro']}/></Field>
        <Field label="Valor total"><Input type="number" value={editR.valor} onChange={e=>u('valor',+e.target.value)}/></Field>
        <Field label="Estado"><Select value={editR.estado} onChange={e=>u('estado',e.target.value)}
          options={[{v:'CONFIRMADA',l:'Confirmada'},{v:'EN_CURSO',l:'En curso'},{v:'FINALIZADA',l:'Finalizada'},{v:'CANCELADA',l:'Cancelada'}]}/></Field>
        <div className="sm:col-span-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
          <b>Nota operativa:</b> una reserva de {diffDias(editR.desde,editR.hasta)} noches genera aprox.{' '}
          <b>{fmtNum(diffDias(editR.desde,editR.hasta)*db.cfg.compensatorioPorDia,1)} días</b> de descanso compensatorio
          para el mayordomo interno asignado.</div>
      </div>;})()}
    </Modal>
  </Page>;
}
