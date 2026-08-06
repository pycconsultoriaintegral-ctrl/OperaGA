import { useState, useMemo } from 'react';
import { Page, Card, Tabs, Field, Select, Input, Modal, Table, Td, Badge, Avatar, Btn, Icon, IN, TONE } from '../components/ui.jsx';
import { CONFIG_DEFAULT, BUCKETS } from '../lib/constants.js';
import { factorBucket } from '../lib/payroll.js';
import { fmtCOP, fmtFecha, nombreDia, pad } from '../lib/utils.js';
import { supabase } from '../lib/supabaseClient.js';

const ROL_TONE = { ADMINISTRADOR:'brand', GESTION_HUMANA:'emerald', SUPERVISOR:'violet', CONSULTA:'sky' };

// Módulos administrables desde la matriz de permisos, en el mismo orden del menú.
const MODULOS_PERMISOS = [
  { modulo:'empleados',         label:'Empleados (completo, con salario/documento)' },
  { modulo:'empleados_publico', label:'Empleados (solo nombre/cargo, sin datos financieros)' },
  { modulo:'propiedades',       label:'Propiedades y reservas' },
  { modulo:'horarios',          label:'Horarios' },
  { modulo:'asistencia',        label:'Asistencia y Marcación' },
  { modulo:'novedades',         label:'Novedades' },
  { modulo:'liquidacion',       label:'Liquidación' },
  { modulo:'reportes',          label:'Reportes' },
  { modulo:'configuracion',     label:'Configuración' },
  { modulo:'usuarios',          label:'Usuarios y roles' },
  { modulo:'auditoria',         label:'Auditoría' },
];
const ACCIONES_PERMISOS = [
  { accion:'ver',      label:'Ver' },
  { accion:'crear',    label:'Crear' },
  { accion:'editar',   label:'Editar' },
  { accion:'eliminar', label:'Eliminar' },
  { accion:'exportar', label:'Exportar' },
];

export default function Configuracion({db, set, toast, refrescar}){
  const [tab,setTab] = useState('jornada');
  const [cfg,setCfg] = useState(db.cfg);
  const [nuevoFest,setNuevoFest] = useState('');
  const u = (k,v) => setCfg({...cfg,[k]:v});

  const aplicar = () => { set(d=>({...d,cfg})); toast('Parámetros actualizados'); };
  const restaurar = () => { setCfg(CONFIG_DEFAULT); set(d=>({...d,cfg:CONFIG_DEFAULT})); toast('Valores por defecto restaurados'); };

  // ── Usuarios ──
  const [editUser,setEditUser] = useState(null);
  const [guardandoUser,setGuardandoUser] = useState(false);
  const vacioUser = { email:'', password:'', nombre:'', rol_codigo: db.roles?.[0]?.codigo || '', empleado_id:'' };

  const llamarAdmin = async (payload) => {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: payload });
    if (error) throw new Error(error.message || 'No se pudo completar la operación');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const crearUsuario = async () => {
    if(!editUser.email.trim() || !editUser.nombre.trim() || !editUser.rol_codigo)
      return toast('Correo, nombre y rol son obligatorios','rose');
    if(editUser.password.length < 8) return toast('La contraseña debe tener al menos 8 caracteres','rose');
    setGuardandoUser(true);
    try{
      await llamarAdmin({ action:'crear', ...editUser });
      toast('Usuario creado'); setEditUser(null); await refrescar?.();
    }catch(e){ toast(e.message,'rose'); }
    setGuardandoUser(false);
  };

  const cambiarRolUsuario = async (u2, rol_codigo) => {
    try{ await llamarAdmin({ action:'cambiar_rol', user_id:u2.id, rol_codigo }); toast('Rol actualizado'); await refrescar?.(); }
    catch(e){ toast(e.message,'rose'); }
  };

  const cambiarEstadoUsuario = async (u2) => {
    const estado = u2.estado==='ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    try{ await llamarAdmin({ action:'cambiar_estado', user_id:u2.id, estado });
      toast(estado==='ACTIVO'?'Usuario reactivado':'Usuario desactivado'); await refrescar?.(); }
    catch(e){ toast(e.message,'rose'); }
  };

  const vincularEmpleado = async (u2, empleado_id) => {
    try{ await llamarAdmin({ action:'vincular_empleado', user_id:u2.id, empleado_id });
      toast(empleado_id?'Empleado vinculado':'Vínculo eliminado'); await refrescar?.(); }
    catch(e){ toast(e.message,'rose'); }
  };

  // ── Permisos por rol ──
  // roles/permisos ya tienen políticas RLS que permiten escribir a cualquiera
  // con permiso 'usuarios'.'editar' — se escribe directo, sin Edge Function.
  const [rolSel,setRolSel] = useState(() => db.roles?.[0]?.id ?? null);
  const [guardandoPermiso,setGuardandoPermiso] = useState('');
  const [nuevoRol,setNuevoRol] = useState(null);

  const permisoDe = (rolId, modulo) =>
    db.permisos?.find(p => p.rolId===rolId && p.modulo===modulo)
    || { rolId, modulo, ver:false, crear:false, editar:false, eliminar:false, exportar:false };

  const togglePermiso = async (rolId, modulo, accion, valorActual) => {
    const key = `${rolId}:${modulo}:${accion}`;
    setGuardandoPermiso(key);
    const existente = db.permisos?.find(p => p.rolId===rolId && p.modulo===modulo);
    try{
      if(existente){
        const { error } = await supabase.from('permisos').update({ [accion]: !valorActual }).eq('id', existente.id);
        if(error) throw error;
      } else {
        const fila = { rol_id:rolId, modulo, ver:false, crear:false, editar:false, eliminar:false, exportar:false, [accion]:true };
        const { error } = await supabase.from('permisos').insert(fila);
        if(error) throw error;
      }
      await refrescar?.();
    }catch(e){ toast('No se pudo guardar: '+e.message,'rose'); }
    setGuardandoPermiso('');
  };

  const crearRol = async () => {
    if(!nuevoRol?.codigo.trim() || !nuevoRol?.nombre.trim()) return toast('Código y nombre son obligatorios','rose');
    try{
      const { error } = await supabase.from('roles').insert({
        codigo: nuevoRol.codigo.trim().toLowerCase().replace(/\s+/g,'_'), nombre: nuevoRol.nombre.trim() });
      if(error) throw error;
      toast('Rol creado'); setNuevoRol(null); await refrescar?.();
    }catch(e){ toast('No se pudo crear el rol: '+e.message,'rose'); }
  };

  const borrarRol = async (rol) => {
    if(!confirm(`¿Eliminar el rol "${rol.nombre}"? Solo se puede si ningún usuario lo tiene asignado.`)) return;
    try{
      const { error } = await supabase.from('roles').delete().eq('id', rol.id);
      if(error) throw error;
      toast('Rol eliminado','rose'); if(rolSel===rol.id) setRolSel(db.roles.find(r=>r.id!==rol.id)?.id ?? null);
      await refrescar?.();
    }catch(e){ toast('No se pudo eliminar: tiene usuarios asignados u otra dependencia. '+e.message,'rose'); }
  };

  const P = ({label, k, hint, tipo='number', suf}) => (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input type={tipo} className={IN} value={cfg[k]} onChange={e=>u(k, tipo==='number'?+e.target.value:e.target.value)}/>
        {suf && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400 pointer-events-none">{suf}</span>}
      </div></Field>);

  // Vista previa del efecto de los recargos
  const preview = useMemo(()=>{
    const vh = 2400000/cfg.divisorHora;
    return BUCKETS.map(b=>({ label:b.label, pct:Math.round((factorBucket(b,cfg)-1)*100), val: vh*factorBucket(b,cfg) }));
  },[cfg]);

  return <Page title="Configuración" sub="Parámetros del sistema · toda regla de negocio es modificable"
    actions={<><Btn v="outline" onClick={restaurar}>Restaurar por defecto</Btn>
      <Btn icon="check" onClick={aplicar}>Aplicar cambios</Btn></>}>

    <div className="mb-5"><Tabs active={tab} onChange={setTab} tabs={[
      {id:'jornada',label:'Jornada y topes'},{id:'recargos',label:'Recargos'},
      {id:'internos',label:'Trabajadores internos'},{id:'marcacion',label:'Marcación'},{id:'nomina',label:'Nómina'},
      {id:'festivos',label:'Festivos',count:db.festivos.length},
      {id:'usuarios',label:'Usuarios y roles'},{id:'permisos',label:'Permisos'},{id:'auditoria',label:'Auditoría'}]}/></div>

    {tab==='jornada' && <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Jornada laboral</h3>
        <p className="text-xs text-ink-500 mb-5">Ley 2101 de 2021 · 42 h semanales desde jul. 15 de 2026</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <P label="Horas semanales ordinarias" k="horasSemanales" suf="h" hint="Máximo legal vigente: 42 h"/>
          <P label="Horas diarias ordinarias" k="horasDiarias" suf="h" hint="A partir de aquí se computan extras"/>
          <P label="Horas extras máximas por día" k="extrasMaxDia" suf="h" hint="Tope legal: 2 h/día"/>
          <P label="Horas extras máximas por semana" k="extrasMaxSemana" suf="h" hint="Tope legal: 12 h/semana"/>
          <P label="Inicio jornada nocturna" k="nocturnoInicio" suf="h" hint="Ley 2466/2025: 19 h (7:00 pm)"/>
          <P label="Fin jornada nocturna" k="nocturnoFin" suf="h" hint="6 h (6:00 am)"/>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Franja horaria resultante</h3>
        <div className="space-y-2">
          {Array.from({length:24},(_,h)=>{
            const noct = h>=cfg.nocturnoInicio || h<cfg.nocturnoFin;
            return <div key={h} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-ink-400 w-10 num">{pad(h)}:00</span>
              <div className={`flex-1 h-4 rounded ${noct?'bg-indigo-500':'bg-amber-300'}`}/>
              <span className="text-[10px] font-semibold text-ink-500 w-16">{noct?'Nocturna':'Diurna'}</span>
            </div>;})}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-[11px] text-indigo-800 dark:text-indigo-200">
          <b>{24-cfg.nocturnoInicio+cfg.nocturnoFin} horas nocturnas</b> por día generan recargo del {cfg.recNocturno}%.</div>
      </Card>
    </div>}

    {tab==='recargos' && <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Porcentajes de recargo</h3>
        <p className="text-xs text-ink-500 mb-5">Calculados sobre el valor de la hora ordinaria diurna</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <P label="Hora extra diurna" k="recExtraDiurna" suf="%" hint="Legal: 25%"/>
          <P label="Hora extra nocturna" k="recExtraNocturna" suf="%" hint="Legal: 75%"/>
          <P label="Recargo nocturno" k="recNocturno" suf="%" hint="Legal: 35%"/>
          <P label="Dominical y festivo" k="recDominical" suf="%" hint="90% desde jul/2026 · 100% desde jul/2027"/>
        </div>
        <div className="mt-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-500/20">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">Progresión legal del recargo dominical</p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            80% (jul 2025) → <b>90% (jul 2026 · vigente)</b> → 100% (jul 2027).
            Actualiza este parámetro cuando cambie la vigencia.</p>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Vista previa</h3>
        <p className="text-xs text-ink-500 mb-4">Valor de hora sobre salario de {fmtCOP(2400000)}</p>
        <div className="space-y-1.5">
          {preview.map(p => <div key={p.label} className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800">
            <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">{p.label}</span>
            <div className="flex items-center gap-2.5">
              <Badge tone={p.pct===0?'slate':p.pct>=90?'rose':'amber'}>+{p.pct}%</Badge>
              <span className="text-xs font-extrabold text-ink-900 dark:text-white num w-24 text-right">{fmtCOP(p.val)}</span></div>
          </div>)}
        </div>
      </Card>
    </div>}

    {tab==='internos' && <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Trabajadores internos (mayordomos)</h3>
        <p className="text-xs text-ink-500 mb-5">Parámetros para personal alojado en la propiedad</p>
        <div className="grid gap-4">
          <P label="Tope absoluto de jornada diaria" k="maxJornadaDiaria" suf="h"
             hint="8 h ordinarias + 2 h extras = 10 h. Régimen general del CST."/>
          <P label="Horas mínimas de descanso diario" k="descansoMinDiario" suf="h"
             hint="24 h − tope de jornada. Pueden ser discontinuas."/>
          <P label="% del valor hora reconocido por disponibilidad" k="pctDisponibilidad" suf="%"
             hint="No hay norma expresa. Debe pactarse en el contrato."/>
          <P label="Bloque continuo recomendado de descanso nocturno" k="descansoNocturnoMin" suf="h"
             hint="No interrumpible salvo emergencia"/>
          <P label="Días máximos consecutivos en propiedad" k="diasMaxConsecutivos" suf="días"
             hint="Genera alerta al superarse"/>
          <P label="Días de compensatorio ganados por día interno" k="compensatorioPorDia" suf="días"
             hint="Se acumula al finalizar la reserva"/>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Marco legal verificado</h3>
        <div className="space-y-3">
          {[['Tus mayordomos NO son trabajadores domésticos',
             'El trabajo doméstico se define por prestarse en un hogar. Quienes laboran en casas con servicio de hospedaje quedan expresamente excluidos del sector doméstico. Tus propiedades son alojamiento comercial, así que aplica el régimen general del CST, no el doméstico.','emerald'],
            ['De ahí salen las 14 horas de descanso',
             'Bajo el régimen general la jornada ordinaria es de 8 h/día y el tope absoluto es de 10 h (8 + 2 extras). Por diferencia, cada día de 24 h debe contener al menos 14 h sin trabajo efectivo. Pueden ser discontinuas: no tienen que ser un bloque seguido.','emerald'],
            ['El régimen especial de 10 horas fue derogado',
             'El literal b) del artículo 162 del CST — que excluía a los internos de la jornada máxima — fue derogado por el artículo 70 de la Ley 2466 de 2025. La Sentencia C-372 de 1998, que fijaba las 10 h para domésticos internos, quedó sin objeto.','amber'],
            ['El tiempo de disponibilidad sigue siendo la zona gris',
             'La Corte Suprema reconoce la disponibilidad como trabajo efectivo cuando el trabajador está restringido en la disposición de su tiempo. El Convenio 189 de la OIT, ratificado por Ley 1595 de 2012, va en la misma dirección. Documenta cada bloque con rigor.','rose'],
            ['El tiempo sin clasificar es el mayor riesgo',
             'Ante una reclamación laboral, las horas no documentadas dentro de la estadía tienden a presumirse trabajadas. Por eso el módulo En reserva exige que las 24 h de cada día estén clasificadas.','rose'],
            ['Validación legal pendiente',
             'Esta interpretación se apoya en fuentes secundarias y debe ser confirmada por un abogado laboralista antes de aplicarse a la operación real.','sky']
          ].map(([t,d,c]) => (
            <div key={t} className={`p-3.5 rounded-xl ring-1 ring-inset ${TONE[c]}`}>
              <p className="text-xs font-bold flex items-start gap-1.5"><Icon n="alert" c="w-4 h-4 shrink-0 mt-px"/>{t}</p>
              <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">{d}</p></div>))}
        </div>
      </Card>
    </div>}

    {tab==='marcacion' && <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Parámetros de marcación</h3>
        <p className="text-xs text-ink-500 mb-5">Controles exigidos al registrar asistencia</p>
        <div className="grid gap-4">
          <P label="Radio de geocerca" k="radioGeocerca" suf="m"
             hint="Tolerancia alrededor de la propiedad. El GPS tiene precisión de 10 a 50 m."/>
          <Field label="Exigir ubicación GPS" hint="Si el trabajador niega el permiso, la marcación queda para revisión">
            <Select value={cfg.exigirGPS?'si':'no'} onChange={e=>u('exigirGPS',e.target.value==='si')}
              options={[{v:'si',l:'Sí — obligatorio'},{v:'no',l:'No — opcional'}]}/></Field>
          <Field label="Exigir código de la propiedad" hint="El código proviene del QR fijo instalado en cada propiedad">
            <Select value={cfg.exigirCodigo?'si':'no'} onChange={e=>u('exigirCodigo',e.target.value==='si')}
              options={[{v:'si',l:'Sí — obligatorio'},{v:'no',l:'No — opcional'}]}/></Field>
          <Field label="Exigir fotografía" hint="Evidencia visual adicional en cada marcación">
            <Select value={cfg.exigirFoto?'si':'no'} onChange={e=>u('exigirFoto',e.target.value==='si')}
              options={[{v:'no',l:'No — opcional'},{v:'si',l:'Sí — obligatorio'}]}/></Field>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Jerarquía de los controles</h3>
        <div className="space-y-3">
          {[['1 · Geocerca GPS','Control primario. Compara la ubicación del dispositivo con las coordenadas de la propiedad. Bloquea la marcación si está fuera del radio.','emerald'],
            ['2 · Código del QR fijo','Prueba de presencia física. Combinado con el GPS, falsificar una marcación exige tener la foto del código y además simular la ubicación.','brand'],
            ['3 · Fotografía','Evidencia visual con marca de tiempo. Sirve además como soporte documental del legajo.','sky'],
            ['4 · IP pública','Únicamente corrobora. No bloquea nunca: la IP residencial es dinámica, el CGNAT la comparte entre varios clientes y los datos móviles la cambian por completo.','amber']
          ].map(([t,d,c])=>(
            <div key={t} className={`p-3.5 rounded-xl ring-1 ring-inset ${TONE[c]}`}>
              <p className="text-xs font-bold">{t}</p>
              <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">{d}</p></div>))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed">
          <b>Pendiente para producción:</b> la IP debe capturarse en el servidor a partir de la petición HTTP.
          La que reporta el navegador es falsificable y solo sirve como referencia en este prototipo.</div>
      </Card>
    </div>}

    {tab==='nomina' && <Card className="max-w-2xl">
      <h3 className="font-bold text-ink-900 dark:text-white mb-1">Parámetros de nómina</h3>
      <p className="text-xs text-ink-500 mb-5">Valores base para el cálculo de la liquidación</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <P label="Salario mínimo mensual" k="salarioMinimo" hint={fmtCOP(cfg.salarioMinimo)}/>
        <P label="Auxilio de transporte" k="auxTransporte" hint={fmtCOP(cfg.auxTransporte)}/>
        <P label="Tope auxilio (x SMMLV)" k="topeAuxTransporte" suf="x" hint={`Hasta ${fmtCOP(cfg.salarioMinimo*cfg.topeAuxTransporte)}`}/>
        <P label="Divisor para valor hora" k="divisorHora" suf="h" hint="240 = 30 días × 8 horas"/>
      </div>
      <div className="mt-5 p-3.5 rounded-xl bg-ink-50 dark:bg-ink-950/50">
        <p className="text-xs font-bold text-ink-700 dark:text-ink-200 mb-2">Ejemplo de cálculo</p>
        <div className="space-y-1 text-xs">
          {[['Salario base',fmtCOP(2400000)],['Valor hora ordinaria',fmtCOP(2400000/cfg.divisorHora)],
            ['Hora extra diurna',fmtCOP((2400000/cfg.divisorHora)*(1+cfg.recExtraDiurna/100))],
            ['Hora dominical nocturna',fmtCOP((2400000/cfg.divisorHora)*(1+cfg.recDominical/100+cfg.recNocturno/100))]].map(([k,v])=>
            <div key={k} className="flex justify-between"><span className="text-ink-500">{k}</span>
              <span className="font-bold text-ink-900 dark:text-white num">{v}</span></div>)}
        </div>
      </div>
    </Card>}

    {tab==='festivos' && <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-bold text-ink-900 dark:text-white">Calendario de festivos</h3>
            <p className="text-xs text-ink-500">Ley 51 de 1983 (Ley Emiliani) · {db.festivos.length} días registrados</p></div>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="date" className={IN} value={nuevoFest} onChange={e=>setNuevoFest(e.target.value)}/>
          <Btn icon="plus" onClick={()=>{ if(!nuevoFest) return;
            if(db.festivos.includes(nuevoFest)) return toast('Ya existe','rose');
            set(d=>({...d,festivos:[...d.festivos,nuevoFest].sort()})); setNuevoFest(''); toast('Festivo agregado'); }}>Agregar</Btn>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
          {db.festivos.map(f => (
            <div key={f} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-ink-50 dark:bg-ink-950/50 ring-1 ring-inset ring-ink-200/60 dark:ring-ink-800">
              <div className="min-w-0"><p className="text-xs font-bold text-ink-900 dark:text-white">{fmtFecha(f)}</p>
                <p className="text-[10px] text-ink-400">{nombreDia(f)}</p></div>
              <button onClick={()=>{set(d=>({...d,festivos:d.festivos.filter(x=>x!==f)})); toast('Festivo eliminado','rose');}}
                className="p-1 rounded text-ink-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Icon n="x" c="w-3.5 h-3.5"/></button>
            </div>))}
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Impacto en liquidación</h3>
        <div className="space-y-3 text-sm">
          {[['Festivos 2026',db.festivos.filter(f=>f.startsWith('2026')).length],
            ['Festivos 2027',db.festivos.filter(f=>f.startsWith('2027')).length],
            ['Domingos al año',52]].map(([k,v])=>
            <div key={k} className="flex justify-between py-2 border-b border-ink-100 dark:border-ink-800">
              <span className="text-ink-500">{k}</span><span className="font-extrabold text-ink-900 dark:text-white num">{v}</span></div>)}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-[11px] text-rose-800 dark:text-rose-200">
          Cada día marcado como festivo aplica automáticamente el recargo del <b>{cfg.recDominical}%</b> a todas las horas trabajadas.</div>
      </Card>
    </div>}

    {tab==='usuarios' && <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2" pad={false}>
        <div className="p-5 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
          <div><h3 className="font-bold text-ink-900 dark:text-white">Usuarios del sistema</h3>
            <p className="text-xs text-ink-500">Control de acceso por rol</p></div>
          <Btn s="sm" icon="plus" onClick={()=>setEditUser(vacioUser)}>Nuevo usuario</Btn>
        </div>
        <Table head={['Usuario','Correo','Rol','Empleado vinculado','Estado','']}>
          {(db.usuarios||[]).map(u2 => <tr key={u2.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={u2.nombre} size="w-8 h-8"/>
              <span className="font-bold">{u2.nombre}</span></div></Td>
            <Td className="text-xs">{u2.email || '—'}</Td>
            <Td className="w-40">
              <Select value={u2.rolCodigo} onChange={e=>cambiarRolUsuario(u2, e.target.value)}
                options={(db.roles||[]).map(r=>({v:r.codigo, l:r.nombre}))}/>
            </Td>
            <Td className="w-48">
              <Select value={u2.empleadoId||''} onChange={e=>vincularEmpleado(u2, e.target.value)}
                options={[{v:'',l:'Sin vincular'},...db.empleados.map(e=>({v:e.id,l:e.nombre}))]}/>
            </Td>
            <Td><Badge tone={u2.estado==='ACTIVO'?'emerald':'slate'} dot>{u2.estado}</Badge></Td>
            <Td className="text-right">
              <Btn v={u2.estado==='ACTIVO'?'outline':'soft'} s="sm" onClick={()=>cambiarEstadoUsuario(u2)}>
                {u2.estado==='ACTIVO'?'Desactivar':'Reactivar'}</Btn>
            </Td>
          </tr>)}
        </Table>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink-900 dark:text-white">Roles disponibles</h3>
          <Btn s="sm" v="soft" icon="plus" onClick={()=>setNuevoRol({codigo:'',nombre:''})}>Nuevo rol</Btn>
        </div>
        <div className="space-y-3">
          {(db.roles||[]).map(r =>
            <div key={r.id} className="p-3 rounded-xl ring-1 ring-inset ring-ink-200 dark:ring-ink-800 flex items-start justify-between gap-2">
              <div>
                <Badge tone={ROL_TONE[r.codigo.toUpperCase()]||'slate'}>{r.nombre}</Badge>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-2">
                  Sus permisos se configuran en la pestaña <b>Permisos</b>.</p>
              </div>
              <button onClick={()=>borrarRol(r)} title="Eliminar rol"
                className="p-1.5 rounded-lg text-ink-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0">
                <Icon n="trash" c="w-4 h-4"/></button>
            </div>)}
        </div>
      </Card>
    </div>}

    {tab==='permisos' && <div className="grid lg:grid-cols-4 gap-4">
      <Card className="lg:col-span-1">
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Rol a editar</h3>
        <div className="space-y-1.5">
          {(db.roles||[]).map(r => (
            <button key={r.id} onClick={()=>setRolSel(r.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                rolSel===r.id ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {r.nombre}
            </button>))}
        </div>
        <Btn s="sm" v="outline" icon="plus" className="w-full mt-3" onClick={()=>setNuevoRol({codigo:'',nombre:''})}>Nuevo rol</Btn>
      </Card>
      <Card className="lg:col-span-3" pad={false}>
        <div className="p-5 border-b border-ink-200 dark:border-ink-800">
          <h3 className="font-bold text-ink-900 dark:text-white">
            Permisos de {db.roles?.find(r=>r.id===rolSel)?.nombre || '—'}</h3>
          <p className="text-xs text-ink-500">Se guarda apenas marcas o desmarcas una casilla — no hace falta un botón "Guardar".</p>
        </div>
        {!rolSel ? <div className="p-8 text-center text-sm text-ink-500">Crea o selecciona un rol.</div>
        : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-950/60 border-b border-ink-200 dark:border-ink-800">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500">Módulo</th>
                {ACCIONES_PERMISOS.map(a=><th key={a.accion} className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-ink-500">{a.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {MODULOS_PERMISOS.map(m => { const p = permisoDe(rolSel, m.modulo); return (
                <tr key={m.modulo}>
                  <Td className="font-semibold text-xs">{m.label}</Td>
                  {ACCIONES_PERMISOS.map(a => { const key=`${rolSel}:${m.modulo}:${a.accion}`; return (
                    <Td key={a.accion} className="text-center">
                      <input type="checkbox" checked={p[a.accion]} disabled={guardandoPermiso===key}
                        onChange={()=>togglePermiso(rolSel, m.modulo, a.accion, p[a.accion])}
                        className="w-4 h-4 rounded accent-brand-600 cursor-pointer disabled:opacity-40"/>
                    </Td>);})}
                </tr>);})}
            </tbody>
          </table>
        </div>}
      </Card>
    </div>}

    <Modal open={!!nuevoRol} onClose={()=>setNuevoRol(null)} title="Nuevo rol"
      sub="Empieza sin permisos — actívalos desde la pestaña Permisos"
      footer={<><Btn v="outline" onClick={()=>setNuevoRol(null)}>Cancelar</Btn>
        <Btn onClick={crearRol} icon="check">Crear rol</Btn></>}>
      {nuevoRol && <div className="space-y-4">
        <Field label="Nombre visible" req hint="Ej. Contador, Recursos Humanos Junior">
          <Input value={nuevoRol.nombre} onChange={e=>setNuevoRol({...nuevoRol,nombre:e.target.value})}/></Field>
        <Field label="Código interno" req hint="Sin espacios ni tildes, ej. contador">
          <Input value={nuevoRol.codigo} onChange={e=>setNuevoRol({...nuevoRol,codigo:e.target.value})}/></Field>
      </div>}
    </Modal>

    <Modal open={!!editUser} onClose={()=>setEditUser(null)} title="Nuevo usuario"
      sub="Crea el acceso real — queda activo de inmediato"
      footer={<><Btn v="outline" onClick={()=>setEditUser(null)}>Cancelar</Btn>
        <Btn onClick={crearUsuario} icon="check" disabled={guardandoUser}>{guardandoUser?'Creando…':'Crear usuario'}</Btn></>}>
      {editUser && (()=>{ const uu=(k,v)=>setEditUser({...editUser,[k]:v}); return <div className="space-y-4">
        <Field label="Nombre completo" req><Input value={editUser.nombre} onChange={e=>uu('nombre',e.target.value)}/></Field>
        <Field label="Correo electrónico" req><Input type="email" value={editUser.email} onChange={e=>uu('email',e.target.value)}/></Field>
        <Field label="Contraseña temporal" req hint="Mínimo 8 caracteres — pídele que la cambie al primer ingreso">
          <Input type="text" value={editUser.password} onChange={e=>uu('password',e.target.value)}/></Field>
        <Field label="Rol" req><Select value={editUser.rol_codigo} onChange={e=>uu('rol_codigo',e.target.value)}
          options={(db.roles||[]).map(r=>({v:r.codigo,l:r.nombre}))}/></Field>
        <Field label="Empleado vinculado" hint="Opcional — si lo vinculas, esta cuenta ve su propio horario y marca su propia asistencia aunque el rol no tenga permiso amplio sobre esos módulos">
          <Select value={editUser.empleado_id} onChange={e=>uu('empleado_id',e.target.value)}
            options={[{v:'',l:'Sin vincular'},...db.empleados.map(e=>({v:e.id,l:`${e.nombre} — ${e.cargo}`}))]}/></Field>
      </div>;})()}
    </Modal>

    {tab==='auditoria' && <Card pad={false}>
      <div className="p-5 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
        <div><h3 className="font-bold text-ink-900 dark:text-white">Registro de auditoría</h3>
          <p className="text-xs text-ink-500">Trazabilidad de operaciones · nada se elimina físicamente</p></div>
        <Badge tone="emerald" dot>Borrado lógico activo</Badge>
      </div>
      <Table head={['Fecha y hora','Usuario','Acción','Entidad','Detalle']}>
        {db.auditoria.map(a => <tr key={a.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
          <Td className="text-xs num whitespace-nowrap">{a.fecha}</Td>
          <Td className="font-semibold text-xs">{a.usuario}</Td>
          <Td><Badge tone={a.accion==='APROBAR'?'emerald':a.accion==='RECHAZAR'?'rose':a.accion==='CREAR'?'brand':'slate'}>{a.accion}</Badge></Td>
          <Td className="text-xs">{a.entidad}</Td>
          <Td className="text-xs text-ink-500">{a.detalle}</Td>
        </tr>)}
      </Table>
    </Card>}
  </Page>;
}
