import { useState, useMemo } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Select, Area, Empty, IN, Icon, exportCSV } from '../components/ui.jsx';
import { CARGOS, CONFIG_DEFAULT, EPS_LIST, AFP_LIST, ARL_LIST } from '../lib/constants.js';
import { uid, fmtCOP, fmtFecha, edad, diffDias, hoy } from '../lib/utils.js';

export default function Empleados({db, set, toast}){
  const [q,setQ] = useState(''); const [fc,setFc] = useState('');
  const [sel,setSel] = useState(null); const [edit,setEdit] = useState(null);

  const lista = useMemo(() => db.empleados.filter(e =>
    (!q || e.nombre.toLowerCase().includes(q.toLowerCase()) || e.doc.includes(q)) &&
    (!fc || e.cargo===fc)), [db.empleados,q,fc]);

  const vacio = { id:'', nombre:'', doc:'', tipoDoc:'CC', cargo:'Mucama', nacimiento:'', tel:'', email:'',
    dir:'', ingreso:hoy(), contrato:'Término indefinido', salario:CONFIG_DEFAULT.salarioMinimo,
    eps:'Sura', afp:'Porvenir', arl:'Sura ARL', banco:'', cuenta:'', contactoEmg:'', estado:'ACTIVO', interno:false };

  const guardar = () => {
    if(!edit.nombre.trim() || !edit.doc.trim()) return toast('Nombre y documento son obligatorios','rose');
    const nuevo = !edit.id;
    const e = nuevo ? {...edit, id:uid()} : edit;
    set(d => ({...d, empleados: nuevo ? [...d.empleados, e] : d.empleados.map(x=>x.id===e.id?e:x)}));
    setEdit(null); toast(nuevo?'Empleado creado':'Cambios guardados');
  };
  const inactivar = e => {   // borrado lógico
    set(d => ({...d, empleados: d.empleados.map(x=>x.id===e.id?{...x,estado:x.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}:x)}));
    setSel(null); toast(e.estado==='ACTIVO'?'Empleado inactivado':'Empleado reactivado');
  };

  return <Page title="Empleados" sub={`${db.empleados.filter(e=>e.estado==='ACTIVO').length} activos de ${db.empleados.length} registrados`}
    actions={<><Btn v="outline" icon="download" onClick={()=>exportCSV('empleados', db.empleados.map(e=>({
        nombre:e.nombre,documento:e.doc,cargo:e.cargo,ingreso:e.ingreso,contrato:e.contrato,
        salario:e.salario,eps:e.eps,afp:e.afp,arl:e.arl,telefono:e.tel,estado:e.estado})))}>Exportar</Btn>
      <Btn icon="plus" onClick={()=>setEdit(vacio)}>Nuevo empleado</Btn></>}>

    <Card pad={false}>
      <div className="p-4 flex flex-col sm:flex-row gap-2.5 border-b border-ink-200 dark:border-ink-800">
        <div className="relative flex-1">
          <Icon n="search" c="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"/>
          <input className={IN+' pl-9'} placeholder="Buscar por nombre o documento…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <select className={IN+' sm:w-52'} value={fc} onChange={e=>setFc(e.target.value)}>
          <option value="">Todos los cargos</option>{CARGOS.map(c=><option key={c}>{c}</option>)}</select>
      </div>

      {lista.length===0 ? <Empty icon="users" title="Sin resultados" sub="Ajusta los filtros o crea un nuevo empleado."/>
      : <Table head={['Empleado','Cargo','Contrato','Salario','Seguridad social','Estado','']}>
        {lista.map(e => (
          <tr key={e.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40 transition-colors">
            <Td>
              <div className="flex items-center gap-3">
                <Avatar nombre={e.nombre}/>
                <div className="min-w-0"><p className="font-bold text-ink-900 dark:text-white truncate">{e.nombre}</p>
                  <p className="text-[11px] text-ink-500">{e.tipoDoc} {e.doc} · {edad(e.nacimiento)} años</p></div>
              </div></Td>
            <Td><div className="flex items-center gap-1.5">
              <Badge tone={e.cargo==='Mayordomo'?'brand':e.cargo==='Supervisor'?'violet':'sky'}>{e.cargo}</Badge>
              {e.interno && <Badge tone="amber">Interno</Badge>}</div></Td>
            <Td><p className="text-xs">{e.contrato}</p><p className="text-[11px] text-ink-400">Desde {fmtFecha(e.ingreso)}</p></Td>
            <Td className="font-bold num">{fmtCOP(e.salario)}</Td>
            <Td><p className="text-[11px] leading-relaxed">{e.eps}<br/><span className="text-ink-400">{e.afp} · {e.arl}</span></p></Td>
            <Td><Badge tone={e.estado==='ACTIVO'?'emerald':'slate'} dot>{e.estado==='ACTIVO'?'Activo':'Inactivo'}</Badge></Td>
            <Td className="text-right whitespace-nowrap">
              <button onClick={()=>setSel(e)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="doc" c="w-4 h-4"/></button>
              <button onClick={()=>setEdit(e)} className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="edit" c="w-4 h-4"/></button>
            </Td>
          </tr>))}
      </Table>}
    </Card>

    {/* ── Hoja de vida ── */}
    <Modal open={!!sel} onClose={()=>setSel(null)} title="Hoja de vida" sub={sel?.nombre} w="max-w-3xl"
      footer={sel && <><Btn v={sel.estado==='ACTIVO'?'danger':'outline'} onClick={()=>inactivar(sel)}>
          {sel.estado==='ACTIVO'?'Inactivar (borrado lógico)':'Reactivar'}</Btn>
        <Btn v="outline" onClick={()=>{setEdit(sel);setSel(null);}} icon="edit">Editar</Btn></>}>
      {sel && <div className="space-y-5">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-ink-50 dark:bg-ink-950/50">
          <Avatar nombre={sel.nombre} size="w-16 h-16 text-lg"/>
          <div className="min-w-0">
            <h4 className="text-lg font-extrabold text-ink-900 dark:text-white">{sel.nombre}</h4>
            <p className="text-sm text-ink-500">{sel.cargo} · {sel.tipoDoc} {sel.doc}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge tone={sel.estado==='ACTIVO'?'emerald':'slate'} dot>{sel.estado}</Badge>
              {sel.interno && <Badge tone="amber">Trabajador interno</Badge>}
              <Badge tone="slate">{diffDias(sel.ingreso,hoy())>365?`${Math.floor(diffDias(sel.ingreso,hoy())/365)} año(s)`:`${diffDias(sel.ingreso,hoy())} días`} de antigüedad</Badge>
            </div>
          </div>
        </div>
        {[['Datos personales',[['Fecha de nacimiento',fmtFecha(sel.nacimiento)],['Edad',edad(sel.nacimiento)+' años'],
            ['Teléfono',sel.tel],['Correo',sel.email],['Dirección',sel.dir],['Contacto de emergencia',sel.contactoEmg]]],
          ['Vínculo laboral',[['Cargo',sel.cargo],['Tipo de contrato',sel.contrato],['Fecha de ingreso',fmtFecha(sel.ingreso)],
            ['Salario básico',fmtCOP(sel.salario)],['Valor hora',fmtCOP(sel.salario/db.cfg.divisorHora)],
            ['Modalidad',sel.interno?'Interno (alojado en propiedad)':'Externo']]],
          ['Seguridad social',[['EPS',sel.eps],['Fondo de pensiones',sel.afp],['ARL',sel.arl],
            ['Banco',sel.banco||'—'],['Cuenta',sel.cuenta||'—']]]
        ].map(([titulo,filas]) => (
          <div key={titulo}>
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2.5">{titulo}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {filas.map(([k,v]) => <div key={k} className="flex justify-between py-2 border-b border-ink-100 dark:border-ink-800 text-sm">
                <span className="text-ink-500 dark:text-ink-400">{k}</span>
                <span className="font-semibold text-ink-900 dark:text-white text-right ml-3">{v||'—'}</span></div>)}
            </div>
          </div>))}
      </div>}
    </Modal>

    {/* ── Formulario ── */}
    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar empleado':'Nuevo empleado'} w="max-w-3xl"
      footer={<><Btn v="outline" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn onClick={guardar} icon="check">Guardar</Btn></>}>
      {edit && (()=>{ const u=(k,v)=>setEdit({...edit,[k]:v}); return <div className="space-y-5">
        <div><h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-3">Identificación</h5>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label="Nombre completo" req><Input value={edit.nombre} onChange={e=>u('nombre',e.target.value)}/></Field></div>
            <Field label="Tipo doc."><Select value={edit.tipoDoc} onChange={e=>u('tipoDoc',e.target.value)} options={['CC','CE','PEP','PPT','TI']}/></Field>
            <Field label="Documento" req><Input value={edit.doc} onChange={e=>u('doc',e.target.value)}/></Field>
            <Field label="Fecha de nacimiento"><Input type="date" value={edit.nacimiento} onChange={e=>u('nacimiento',e.target.value)}/></Field>
            <Field label="Teléfono"><Input value={edit.tel} onChange={e=>u('tel',e.target.value)}/></Field>
            <div className="sm:col-span-2"><Field label="Correo electrónico"><Input type="email" value={edit.email} onChange={e=>u('email',e.target.value)}/></Field></div>
            <div className="sm:col-span-2"><Field label="Dirección"><Input value={edit.dir} onChange={e=>u('dir',e.target.value)}/></Field></div>
            <div className="sm:col-span-2"><Field label="Contacto de emergencia"><Input value={edit.contactoEmg} onChange={e=>u('contactoEmg',e.target.value)} placeholder="Nombre — teléfono"/></Field></div>
          </div></div>
        <div><h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-3">Vínculo laboral</h5>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Cargo"><Select value={edit.cargo} onChange={e=>u('cargo',e.target.value)} options={CARGOS}/></Field>
            <Field label="Tipo de contrato"><Select value={edit.contrato} onChange={e=>u('contrato',e.target.value)}
              options={['Término indefinido','Término fijo 1 año','Término fijo 6 meses','Obra o labor','Aprendizaje']}/></Field>
            <Field label="Fecha de ingreso"><Input type="date" value={edit.ingreso} onChange={e=>u('ingreso',e.target.value)}/></Field>
            <Field label="Salario básico mensual" hint={`Valor hora: ${fmtCOP(edit.salario/db.cfg.divisorHora)}`}>
              <Input type="number" value={edit.salario} onChange={e=>u('salario',+e.target.value)}/></Field>
            <Field label="Estado"><Select value={edit.estado} onChange={e=>u('estado',e.target.value)} options={['ACTIVO','INACTIVO']}/></Field>
            <Field label="Modalidad" hint="Los internos permanecen alojados en la propiedad">
              <Select value={edit.interno?'si':'no'} onChange={e=>u('interno',e.target.value==='si')}
                options={[{v:'no',l:'Externo'},{v:'si',l:'Interno (alojado)'}]}/></Field>
          </div></div>
        <div><h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-600 mb-3">Seguridad social y pagos</h5>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="EPS"><Select value={edit.eps} onChange={e=>u('eps',e.target.value)} options={EPS_LIST}/></Field>
            <Field label="Fondo de pensiones"><Select value={edit.afp} onChange={e=>u('afp',e.target.value)} options={AFP_LIST}/></Field>
            <Field label="ARL"><Select value={edit.arl} onChange={e=>u('arl',e.target.value)} options={ARL_LIST}/></Field>
            <Field label="Banco"><Input value={edit.banco} onChange={e=>u('banco',e.target.value)}/></Field>
            <div className="sm:col-span-2"><Field label="Número de cuenta"><Input value={edit.cuenta} onChange={e=>u('cuenta',e.target.value)}/></Field></div>
          </div></div>
      </div>;})()}
    </Modal>
  </Page>;
}
