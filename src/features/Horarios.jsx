import { useState, useMemo } from 'react';
import { Page, Card, Table, Td, Badge, Avatar, Btn, Modal, Field, Input, Select, Tabs, Stat, Icon, Bar, Empty, TONE, exportCSV } from '../components/ui.jsx';
import { compararProgramado, calcularCompensatorios, horasTurno } from '../lib/payroll.js';
import { ESTADO_CUMPL } from '../lib/constants.js';
import { uid, addDias, fmtNum, fmtFecha, nombreDia, esDomingo, hoy } from '../lib/utils.js';

// Lunes de la semana que contiene `hoy()`, para abrir el programador ahí por defecto.
function lunesActual(){
  const dow = new Date(hoy()+'T12:00:00').getDay(); // 0=domingo
  return addDias(hoy(), dow===0 ? -6 : 1-dow);
}

export default function Horarios({db, set, toast, perfil, has}){
  const [tab,setTab]=useState('programar');
  const [ini,setIni]=useState(lunesActual);
  const [pincel,setPincel]=useState('DIA');
  const [editT,setEditT]=useState(null);
  const [fcargo,setFcargo]=useState('');
  const cfg=db.cfg;
  const turnos=db.turnosT||[];
  const turIdx=useMemo(()=>{const m={};turnos.forEach(t=>m[t.id]=t);return m;},[turnos]);
  const empIdx=useMemo(()=>{const m={};db.empleados.forEach(e=>m[e.id]=e);return m;},[db.empleados]);

  const dias=useMemo(()=>Array.from({length:7},(_,i)=>addDias(ini,i)),[ini]);
  const activos=useMemo(()=>db.empleados.filter(e=>e.estado==='ACTIVO'
    &&(!fcargo||e.cargo===fcargo)),[db.empleados,fcargo]);

  const horIdx=useMemo(()=>{const m={};(db.horarios||[]).forEach(h=>m[h.emp+'|'+h.fecha]=h);return m;},[db.horarios]);
  const progDe=(eid,f)=>horIdx[eid+'|'+f];

  const asignar=(eid,f)=>{
    const ex=progDe(eid,f);
    set(d=>{
      const hs=(d.horarios||[]).filter(h=>!(h.emp===eid&&h.fecha===f));
      if(ex&&ex.tur===pincel) return {...d,horarios:hs};
      return {...d,horarios:[...hs,{id:uid(),emp:eid,fecha:f,tur:pincel}]};
    });
  };
  const aplicarFila=eid=>{
    set(d=>{
      const hs=(d.horarios||[]).filter(h=>!(h.emp===eid&&dias.includes(h.fecha)));
      return {...d,horarios:[...hs,...dias.map(f=>({id:uid(),emp:eid,fecha:f,tur:pincel}))]};
    });
    toast('Semana aplicada');
  };
  const copiarSemana=()=>{
    const dest=Array.from({length:7},(_,i)=>addDias(ini,7+i));
    set(d=>{
      const hs=(d.horarios||[]).filter(h=>!dest.includes(h.fecha));
      const nuevos=[];
      dias.forEach((f,i)=>(d.horarios||[]).filter(h=>h.fecha===f)
        .forEach(h=>nuevos.push({id:uid(),emp:h.emp,fecha:dest[i],tur:h.tur})));
      return {...d,horarios:[...hs,...nuevos]};
    });
    toast('Semana copiada a la siguiente');
  };

  const cmp=useMemo(()=>{
    const ids=new Set(activos.map(e=>e.id));
    return compararProgramado((db.horarios||[]).filter(h=>ids.has(h.emp)),
      db.asistencia.filter(r=>ids.has(r.empleado)), turnos, cfg, empIdx);
  },[db,activos,turnos]);

  const cmpSem=useMemo(()=>{
    const ids=new Set(activos.map(e=>e.id));
    return compararProgramado((db.horarios||[]).filter(h=>ids.has(h.emp)&&dias.includes(h.fecha)),
      db.asistencia.filter(r=>ids.has(r.empleado)&&dias.includes(r.fecha)), turnos, cfg, empIdx);
  },[db,activos,turnos,dias]);

  const comps=useMemo(()=>calcularCompensatorios(activos,db.horarios||[],db.asistencia,
    db.novedades,db.festivos,cfg),[db,activos]);

  const otorgar=(c)=>{
    set(d=>({...d,novedades:[{id:uid(),empleado:c.emp.id,tipo:'COMPENSATORIO',
      desde:addDias(hoy(),3),hasta:addDias(hoy(),2+Math.max(1,Math.round(c.saldo))),
      dias:Math.max(1,Math.round(c.saldo)),
      motivo:`Compensatorio por ${c.dias.length} dominical(es)/festivo(s) laborado(s)`,
      soporte:'',estado:'PENDIENTE'},...d.novedades]}));
    toast(`${Math.round(c.saldo)} día(s) de compensatorio generados`);
  };

  const guardarTurno=()=>{
    if(!editT.label.trim()) return toast('El nombre es obligatorio','rose');
    const n=!turnos.some(t=>t.id===editT.id);
    set(d=>({...d,turnosT:n?[...d.turnosT,editT]:d.turnosT.map(t=>t.id===editT.id?editT:t)}));
    setEditT(null); toast(n?'Turno creado':'Turno actualizado');
  };

  const cargos=[...new Set(db.empleados.map(e=>e.cargo))];
  const totalComp=comps.reduce((s,c)=>s+Math.max(0,c.saldo),0);

  // Cuenta autoservicio (vinculada a un empleado) sin permiso de editar
  // horarios: en vez del programador completo (que asume que puede ver y
  // editar el horario de todos), ve una vista simple de solo lectura de
  // su propio horario — las políticas RLS de "propio" ya limitan
  // db.horarios/db.asistencia a únicamente sus filas.
  const propioId = perfil?.empleado_id;
  if(propioId && !has?.('horarios','editar')){
    const miEmp = db.empleados.find(e=>e.id===propioId);
    const miasDias = Array.from({length:14},(_,i)=>addDias(hoy(),i));
    const misComp = calcularCompensatorios(miEmp?[miEmp]:[], db.horarios||[], db.asistencia, db.novedades, db.festivos, cfg);
    const miSaldo = misComp[0]?.saldo || 0;
    return <Page title="Mi horario" sub={miEmp?.nombre || ''}>
      {!miEmp ? <Card><Empty icon="calendar" title="No se encontró tu ficha de empleado"
          sub="Pide a un administrador que revise la vinculación de tu cuenta."/></Card> : <>
        {miSaldo>0 && <Card className="mb-4 !p-4 bg-amber-50 dark:bg-amber-500/10 ring-amber-500/20">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Tienes {fmtNum(miSaldo,1)} día(s) de descanso compensatorio pendientes.</p>
        </Card>}
        <Card pad={false}>
          <Table head={['Día','Fecha','Turno','Horario']}>
            {miasDias.map(f=>{
              const h=horIdx[propioId+'|'+f]; const t=h?turIdx[h.tur]:null;
              return <tr key={f}>
                <Td className="font-semibold">{nombreDia(f)}</Td>
                <Td className="num">{fmtFecha(f)}</Td>
                <Td>{t?<Badge tone={t.color} dot>{t.label}</Badge>:<span className="text-ink-400 text-xs">Sin programar</span>}</Td>
                <Td className="num text-xs">{t&&t.ini&&!t.interno?`${t.ini} – ${t.fin}`:t?.interno?'Todo el día (interno)':'—'}</Td>
              </tr>;})}
          </Table>
        </Card>
      </>}
    </Page>;
  }

  return <Page title="Horarios" sub="Programación de turnos, horas a laborar y descansos compensatorios"
    actions={<><Btn v="outline" icon="copy" onClick={copiarSemana}>Copiar semana</Btn>
      <Btn v="outline" icon="download" onClick={()=>{exportCSV('horarios_programados',
        (db.horarios||[]).map(h=>{const t=turIdx[h.tur],e=empIdx[h.emp];
          return {empleado:e?.nombre,cargo:e?.cargo,fecha:h.fecha,dia:nombreDia(h.fecha),
            turno:t?.label,entrada:t?.ini||'',salida:t?.fin||'',
            horas_programadas:horasTurno(t).toFixed(2),
            es_festivo:(esDomingo(h.fecha)||db.festivos.includes(h.fecha))?'SI':'NO'};}));
        toast('Programación exportada');}}>Exportar</Btn></>}>

    <div className="mb-5"><Tabs active={tab} onChange={setTab} tabs={[
      {id:'programar',label:'Programar'},
      {id:'cumplimiento',label:'Cruce con asistencia',count:cmp.ausencias+cmp.tardanzas},
      {id:'compensatorios',label:'Compensatorios',count:comps.filter(c=>c.saldo>0).length},
      {id:'plantillas',label:'Plantillas',count:turnos.length}]}/></div>

    {/* ═══ PROGRAMAR ═══ */}
    {tab==='programar' && <>
      <Card className="mb-4">
        <div className="grid lg:grid-cols-4 gap-4 items-end">
          <Field label="Semana desde"><Input type="date" value={ini} onChange={e=>setIni(e.target.value)}/></Field>
          <Field label="Cargo"><Select value={fcargo} onChange={e=>setFcargo(e.target.value)}
            options={[{v:'',l:'Todos'},...cargos.map(c=>({v:c,l:c}))]}/></Field>
          <div className="lg:col-span-2 flex gap-2 flex-wrap">
            <Btn v="outline" s="sm" icon="chevL" onClick={()=>setIni(addDias(ini,-7))}>Anterior</Btn>
            <Btn v="outline" s="sm" onClick={()=>setIni(lunesActual())}>Semana actual</Btn>
            <Btn v="outline" s="sm" onClick={()=>setIni(addDias(ini,7))}>Siguiente</Btn>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">
            Turno a aplicar — haz clic en la celda para asignarlo, otra vez para quitarlo</p>
          <div className="flex flex-wrap gap-2">
            {turnos.map(t=>(
              <button key={t.id} onClick={()=>setPincel(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-inset transition-all ${
                  pincel===t.id?`${TONE[t.color]} ring-2 scale-105`:`${TONE[t.color]} opacity-60 hover:opacity-100`}`}>
                {t.label}{t.ini&&!t.interno&&<span className="ml-1.5 opacity-70 font-normal">{t.ini}–{t.fin}</span>}
              </button>))}
          </div>
        </div>
      </Card>

      <Card pad={false}>
        <div className="overflow-x-auto p-4">
          <div className="min-w-[860px]">
            <div className="flex gap-1 mb-2 pl-[220px]">
              {dias.map(f=>{const fest=db.festivos.includes(f)||esDomingo(f);
                return <div key={f} className={`flex-1 text-center rounded-lg py-1.5 ${fest?'bg-rose-50 dark:bg-rose-500/10':''}`}>
                  <div className={`text-[10px] font-bold uppercase ${fest?'text-rose-600':'text-ink-400'}`}>{nombreDia(f)}</div>
                  <div className={`text-sm font-extrabold ${fest?'text-rose-700 dark:text-rose-300':'text-ink-800 dark:text-ink-100'}`}>{f.slice(8)}</div>
                  {fest&&<div className="text-[8px] font-bold text-rose-500 uppercase">festivo</div>}
                </div>;})}
              <div className="w-20 text-center text-[10px] font-bold uppercase text-ink-400 pt-2">Horas</div>
            </div>

            {activos.map(e=>{
              let hSem=0, festTrab=0;
              return <div key={e.id} className="flex gap-1 items-center mb-1.5">
                <div className="w-[220px] shrink-0 pr-3 flex items-center gap-2">
                  <Avatar nombre={e.nombre} size="w-7 h-7"/>
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold truncate">{e.nombre.split(' ').slice(0,2).join(' ')}</p>
                    <p className="text-[10px] text-ink-400 truncate">{e.cargo}{e.interno?' · interno':''}</p></div>
                  <button onClick={()=>aplicarFila(e.id)} title="Aplicar a toda la semana"
                    className="p-1 rounded text-ink-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 shrink-0">
                    <Icon n="check" c="w-3.5 h-3.5"/></button>
                </div>
                {dias.map(f=>{
                  const h=progDe(e.id,f); const t=h?turIdx[h.tur]:null;
                  const fest=db.festivos.includes(f)||esDomingo(f);
                  const libre=t&&(t.id==='DES'||t.id==='COM');
                  if(t&&!libre){ hSem+=horasTurno(t); if(fest) festTrab++; }
                  return <button key={f} onClick={()=>asignar(e.id,f)}
                    title={t?`${t.label}${t.ini&&!t.interno?` ${t.ini}–${t.fin}`:''}${fest&&!libre?' · genera compensatorio':''}`:'Sin programar'}
                    className={`flex-1 h-9 rounded-lg text-[10px] font-extrabold transition-colors ring-1 ring-inset relative ${
                      t?TONE[t.color]:'bg-ink-50 dark:bg-ink-900 ring-ink-200 dark:ring-ink-800 text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
                    {t?t.abrev:'+'}
                    {fest&&t&&!libre&&<span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500"/>}
                  </button>;})}
                <div className={`w-20 text-center text-xs font-extrabold num rounded-lg py-1.5 ${
                  hSem>cfg.horasSemanales?'bg-rose-50 text-rose-600 dark:bg-rose-500/10'
                  :hSem>0?'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10':'text-ink-300'}`}>
                  {hSem>0?fmtNum(hSem,1):'—'}
                  {festTrab>0&&<div className="text-[9px] font-bold text-rose-500">+{festTrab} comp</div>}</div>
              </div>;})}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-ink-200 dark:border-ink-800 bg-amber-50/60 dark:bg-amber-500/5">
          <p className="text-[11px] text-amber-900 dark:text-amber-300">
            El punto rojo marca los turnos en domingo o festivo: <b>cada uno genera {cfg.compFestivo} día
            de descanso compensatorio</b>. La columna de horas se pone roja si la semana supera
            las {cfg.horasSemanales} horas legales.</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <Stat label="Turnos programados" value={cmpSem.turnosProg} icon="calendar" tone="brand" sub="Esta semana"/>
        <Stat label="Horas a laborar" value={fmtNum(cmpSem.programadas,0)} icon="clock" tone="sky"
          sub={`Promedio ${fmtNum(activos.length?cmpSem.programadas/activos.length:0,1)} h por persona`}/>
        <Stat label="Horas ya marcadas" value={fmtNum(cmpSem.laboradas,0)} icon="check" tone="emerald"
          sub={`${fmtNum(cmpSem.laboradas-cmpSem.programadas,1)} h de diferencia`}/>
        <Stat label="Compensatorios por otorgar" value={fmtNum(totalComp,0)} icon="bed"
          tone={totalComp>0?'amber':'emerald'} sub="Acumulados en el período"/>
      </div>
    </>}

    {/* ═══ CRUCE CON ASISTENCIA ═══ */}
    {tab==='cumplimiento' && <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Stat label="Cumplimiento" value={`${fmtNum(cmp.cumplimiento,0)}%`} icon="chart"
          tone={cmp.cumplimiento>=90?'emerald':cmp.cumplimiento>=75?'amber':'rose'}/>
        <Stat label="Ausencias" value={cmp.ausencias} icon="alert" tone={cmp.ausencias?'rose':'emerald'} sub="Programado sin marcar"/>
        <Stat label="Tardanzas" value={cmp.tardanzas} icon="clock" tone={cmp.tardanzas?'amber':'emerald'}/>
        <Stat label="Horas programadas" value={fmtNum(cmp.programadas,0)} icon="calendar" tone="sky"/>
        <Stat label="Horas laboradas" value={fmtNum(cmp.laboradas,0)} icon="check" tone="brand"/>
      </div>

      <Card pad={false}>
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold text-ink-900 dark:text-white">Programado contra marcado</h3>
            <p className="text-xs text-ink-500">Solo se listan los días con alguna diferencia · tolerancia de {cfg.toleranciaMin} min</p></div>
          <Btn v="soft" s="sm" icon="download" onClick={()=>{
            const f=cmp.filas.filter(x=>['AUSENTE','TARDANZA','TEMPRANO','AMBOS'].includes(x.estado));
            if(!f.length) return toast('Sin novedades en el período','rose');
            exportCSV('novedades_horario',f.map(x=>({empleado:x.nombre,documento:x.doc,cargo:x.cargo,
              fecha:x.fecha,turno:x.turno?.label||'',programado:x.turno?.ini?`${x.turno.ini}-${x.turno.fin}`:'',
              real:x.entrada?`${x.entrada}-${x.salida}`:'',novedad:ESTADO_CUMPL[x.estado].label,
              minutos_tarde:x.minTarde,horas_programadas:x.hProg.toFixed(2),horas_laboradas:x.hReal.toFixed(2),
              diferencia:x.dif.toFixed(2)})));
            toast(`${f.length} novedades exportadas`);}}>Descargar novedades</Btn>
        </div>
        {(()=>{ const nov=cmp.filas.filter(f=>f.estado!=='OK'&&f.estado!=='DESCANSO');
          if(!nov.length) return <Empty icon="check" title="Todo en orden"
            sub="Los turnos programados se cumplieron dentro de la tolerancia."/>;
          return <><Table head={['Empleado','Fecha','Turno','Programado','Real','Novedad','H. prog.','H. real','Dif.']}>
            {nov.slice(0,120).map((f,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
                <Td><div className="flex items-center gap-2.5"><Avatar nombre={f.nombre} size="w-7 h-7"/>
                  <div className="min-w-0"><p className="font-semibold text-xs truncate">{f.nombre.split(' ').slice(0,2).join(' ')}</p>
                    <p className="text-[10px] text-ink-400">{f.cargo}</p></div></div></Td>
                <Td className="text-xs whitespace-nowrap">{nombreDia(f.fecha)} {fmtFecha(f.fecha)}</Td>
                <Td className="text-xs">{f.turno?f.turno.label:'—'}</Td>
                <Td className="text-xs num">{f.turno&&f.turno.ini&&!f.turno.interno?`${f.turno.ini}–${f.turno.fin}`:'—'}</Td>
                <Td className="text-xs num">{f.entrada?`${f.entrada}–${f.salida}`:<span className="text-rose-500 font-bold">no marcó</span>}</Td>
                <Td><Badge tone={ESTADO_CUMPL[f.estado].color} dot>{ESTADO_CUMPL[f.estado].label}</Badge>
                  {f.minTarde>0&&<span className="block text-[10px] text-amber-600 mt-0.5">+{f.minTarde} min</span>}</Td>
                <Td className="num text-xs">{f.hProg?fmtNum(f.hProg,1):'—'}</Td>
                <Td className="num text-xs">{f.hReal?fmtNum(f.hReal,1):'—'}</Td>
                <Td className={`num text-xs font-bold ${f.dif<0?'text-rose-600':f.dif>0?'text-emerald-600':''}`}>
                  {f.dif?fmtNum(f.dif,1):'—'}</Td>
              </tr>))}
          </Table>
          {nov.length>120&&<div className="p-3 text-center text-xs text-ink-500 border-t border-ink-200 dark:border-ink-800">
            Mostrando 120 de {nov.length}</div>}</>;})()}
      </Card>
    </>}

    {/* ═══ COMPENSATORIOS ═══ */}
    {tab==='compensatorios' && <>
      <Card className="mb-4 !p-4 bg-brand-50 dark:bg-brand-500/10 ring-brand-500/20">
        <div className="flex gap-3">
          <Icon n="shield" c="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5"/>
          <div className="text-xs text-brand-900 dark:text-brand-200 leading-relaxed">
            <b>Cómo lo calcula el sistema.</b> El artículo 181 del CST establece que quien labora
            <b> habitualmente</b> en día de descanso obligatorio tiene derecho al compensatorio
            <b> y además</b> al recargo. Se considera habitual desde {cfg.umbralHabitual} domingos en el mes.
            Por debajo de eso el trabajo es ocasional y, según el artículo 180, es el trabajador quien
            elige entre el compensatorio o el recargo en dinero.
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Personas con festivos" value={comps.length} icon="users" tone="brand"/>
        <Stat label="Días ganados" value={fmtNum(comps.reduce((s,c)=>s+c.ganados,0),0)} icon="calendar" tone="amber"/>
        <Stat label="Días ya otorgados" value={fmtNum(comps.reduce((s,c)=>s+c.tomados+c.programados,0),0)} icon="check" tone="emerald"/>
        <Stat label="Saldo pendiente" value={fmtNum(totalComp,0)} icon="alert" tone={totalComp?'rose':'emerald'}/>
      </div>

      <Card pad={false}>
        {comps.length===0 ? <Empty icon="calendar" title="Sin festivos laborados"
          sub="Nadie ha trabajado en domingo o festivo en el período."/>
        : <Table head={['Empleado','Festivos laborados','Clasificación','Ganados','Otorgados','Saldo','']}>
          {comps.sort((a,b)=>b.saldo-a.saldo).map(c=>(
            <tr key={c.emp.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
              <Td><div className="flex items-center gap-2.5"><Avatar nombre={c.emp.nombre} size="w-8 h-8"/>
                <div className="min-w-0"><p className="font-bold text-xs truncate">{c.emp.nombre}</p>
                  <p className="text-[10px] text-ink-400">{c.emp.cargo}</p></div></div></Td>
              <Td><span className="font-bold num">{c.dias.length}</span>
                <p className="text-[10px] text-ink-400">{c.dias.slice(0,3).map(d=>fmtFecha(d)).join(', ')}
                  {c.dias.length>3?` +${c.dias.length-3}`:''}</p></Td>
              <Td>{c.habitual
                ? <Badge tone="rose" dot>Habitual</Badge>
                : <Badge tone="amber" dot>Ocasional</Badge>}
                <p className="text-[10px] text-ink-400 mt-0.5">{c.habitual?'Art. 181: ambos':'Art. 180: elige'}</p></Td>
              <Td className="num font-bold text-emerald-700 dark:text-emerald-400">{c.ganados}</Td>
              <Td className="num">{c.tomados+c.programados}</Td>
              <Td className="num font-extrabold">{c.saldo>0
                ? <span className="text-rose-600">{c.saldo}</span>
                : <span className="text-emerald-600">al día</span>}</Td>
              <Td className="text-right">{c.saldo>0&&
                <Btn v="soft" s="sm" icon="plus" onClick={()=>otorgar(c)}>Otorgar</Btn>}</Td>
            </tr>))}
        </Table>}
      </Card>

      <Card className="mt-4">
        <h3 className="font-bold text-ink-900 dark:text-white mb-3">Detalle mes a mes</h3>
        <div className="space-y-2.5">
          {comps.slice(0,10).map(c=>(
            <div key={c.emp.id} className="p-3 rounded-xl bg-ink-50 dark:bg-ink-950/50">
              <p className="text-xs font-bold text-ink-900 dark:text-white mb-1.5">{c.emp.nombre}</p>
              {c.detalle.map(d=>(
                <div key={d.mes} className="flex items-center justify-between text-[11px] py-1">
                  <span className="text-ink-600 dark:text-ink-300">{d.mes} · {d.n} día(s)</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={d.habitual?'rose':'amber'}>{d.habitual?'Habitual':'Ocasional'}</Badge>
                    <span className="font-bold num">{d.ganados} comp.</span></span>
                </div>))}
            </div>))}
        </div>
      </Card>
    </>}

    {/* ═══ PLANTILLAS ═══ */}
    {tab==='plantillas' && <Card pad={false}>
      <div className="p-5 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
        <div><h3 className="font-bold text-ink-900 dark:text-white">Plantillas de turno</h3>
          <p className="text-xs text-ink-500">Las horas efectivas ya descuentan el tiempo de comida</p></div>
        <Btn s="sm" icon="plus" onClick={()=>setEditT({id:'T'+Date.now().toString(36).slice(-4).toUpperCase(),
          label:'',ini:'08:00',fin:'17:00',desc:60,color:'brand',abrev:'NUE'})}>Nuevo turno</Btn>
      </div>
      <Table head={['Turno','Abrev.','Entrada','Salida','Descanso','Horas efectivas','Programados','']}>
        {turnos.map(t=>{
          const n=(db.horarios||[]).filter(h=>h.tur===t.id).length;
          return <tr key={t.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><Badge tone={t.color} dot>{t.label}</Badge>
              {t.interno&&<span className="block text-[10px] text-ink-400 mt-0.5">Permanece en la propiedad</span>}</Td>
            <Td className="text-xs font-mono font-bold">{t.abrev}</Td>
            <Td className="num text-xs">{t.ini||'—'}</Td>
            <Td className="num text-xs">{t.fin||'—'}</Td>
            <Td className="num text-xs">{t.desc?`${t.desc} min`:'—'}</Td>
            <Td className="num font-bold text-xs">{t.ini?fmtNum(horasTurno(t),2)+' h':'—'}</Td>
            <Td className="num text-xs text-ink-500">{n}</Td>
            <Td className="text-right"><button onClick={()=>setEditT({...t})}
              className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"><Icon n="edit" c="w-4 h-4"/></button></Td>
          </tr>;})}
      </Table>
    </Card>}

    <Modal open={!!editT} onClose={()=>setEditT(null)}
      title={editT&&turnos.some(t=>t.id===editT.id)?'Editar turno':'Nuevo turno'}
      sub={editT&&editT.ini?`${fmtNum(horasTurno(editT),2)} horas efectivas`:''}
      footer={<><Btn v="outline" onClick={()=>setEditT(null)}>Cancelar</Btn><Btn onClick={guardarTurno} icon="check">Guardar</Btn></>}>
      {editT&&(()=>{const u=(k,v)=>setEditT({...editT,[k]:v}); return <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Nombre del turno" req>
          <Input value={editT.label} onChange={e=>u('label',e.target.value)}/></Field></div>
        <Field label="Abreviatura" hint="Máximo 4 letras"><Input value={editT.abrev} maxLength={4}
          onChange={e=>u('abrev',e.target.value.toUpperCase())}/></Field>
        <Field label="Color"><Select value={editT.color} onChange={e=>u('color',e.target.value)}
          options={['brand','emerald','amber','rose','sky','violet','indigo','orange','teal','slate']}/></Field>
        <Field label="Hora de entrada"><Input type="time" value={editT.ini} onChange={e=>u('ini',e.target.value)}/></Field>
        <Field label="Hora de salida"><Input type="time" value={editT.fin} onChange={e=>u('fin',e.target.value)}/></Field>
        <div className="sm:col-span-2"><Field label="Descanso no computable (minutos)"
          hint="Tiempo de comida que no cuenta como jornada">
          <Input type="number" value={editT.desc} onChange={e=>u('desc',+e.target.value)}/></Field></div>
      </div>;})()}
    </Modal>
  </Page>;
}
