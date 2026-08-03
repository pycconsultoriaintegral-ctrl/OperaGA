import { useState, useMemo } from 'react';
import { Page, Card, Tabs, Field, Select, Table, Td, Badge, Avatar, Btn, Icon, IN, TONE } from '../components/ui.jsx';
import { CONFIG_DEFAULT, BUCKETS } from '../lib/constants.js';
import { factorBucket } from '../lib/payroll.js';
import { fmtCOP, fmtFecha, nombreDia, pad } from '../lib/utils.js';
import { KEY } from '../lib/seed.js';

export default function Configuracion({db, set, toast}){
  const [tab,setTab] = useState('jornada');
  const [cfg,setCfg] = useState(db.cfg);
  const [nuevoFest,setNuevoFest] = useState('');
  const u = (k,v) => setCfg({...cfg,[k]:v});

  const aplicar = () => { set(d=>({...d,cfg})); toast('Parámetros actualizados'); };
  const restaurar = () => { setCfg(CONFIG_DEFAULT); set(d=>({...d,cfg:CONFIG_DEFAULT})); toast('Valores por defecto restaurados'); };
  const resetTodo = () => { if(confirm('Esto borrará todos los datos y restaurará los de ejemplo. ¿Continuar?')){
    localStorage.removeItem(KEY); location.reload(); } };

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
      {id:'usuarios',label:'Usuarios y roles'},{id:'auditoria',label:'Auditoría'}]}/></div>

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
        <div className="p-5 border-b border-ink-200 dark:border-ink-800">
          <h3 className="font-bold text-ink-900 dark:text-white">Usuarios del sistema</h3>
          <p className="text-xs text-ink-500">Control de acceso por rol</p></div>
        <Table head={['Usuario','Correo','Rol','Estado']}>
          {db.usuarios.map(u2 => <tr key={u2.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
            <Td><div className="flex items-center gap-2.5"><Avatar nombre={u2.nombre} size="w-8 h-8"/>
              <span className="font-bold">{u2.nombre}</span></div></Td>
            <Td className="text-xs">{u2.email}</Td>
            <Td><Badge tone={u2.rol==='ADMINISTRADOR'?'brand':u2.rol==='SUPERVISOR'?'violet':'sky'}>{u2.rol}</Badge></Td>
            <Td><Badge tone="emerald" dot>{u2.estado}</Badge></Td>
          </tr>)}
        </Table>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Matriz de permisos</h3>
        <div className="space-y-3">
          {[['ADMINISTRADOR','brand',['Acceso total','Configurar parámetros','Gestionar usuarios','Aprobar novedades','Liquidar nómina']],
            ['SUPERVISOR','violet',['Ver dashboard','Gestionar turnos','Registrar asistencia','Aprobar novedades','Ver reportes']],
            ['NOMINA','sky',['Ver empleados','Liquidar nómina','Ver reportes','Exportar datos']]].map(([rol,tone,perms])=>
            <div key={rol} className="p-3 rounded-xl ring-1 ring-inset ring-ink-200 dark:ring-ink-800">
              <Badge tone={tone}>{rol}</Badge>
              <ul className="mt-2.5 space-y-1">{perms.map(p=>
                <li key={p} className="text-[11px] text-ink-600 dark:text-ink-300 flex items-center gap-1.5">
                  <Icon n="check" c="w-3 h-3 text-emerald-500 shrink-0"/>{p}</li>)}</ul>
            </div>)}
        </div>
      </Card>
    </div>}

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
      <div className="p-5 border-t border-ink-200 dark:border-ink-800">
        <Btn v="danger" s="sm" icon="trash" onClick={resetTodo}>Restablecer sistema con datos de ejemplo</Btn>
        <p className="text-[11px] text-ink-400 mt-2">Elimina todos los datos guardados en este navegador y recarga los datos de demostración.</p>
      </div>
    </Card>}
  </Page>;
}
