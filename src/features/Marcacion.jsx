import { useState, useEffect, useRef, useMemo } from 'react';
import { Page, Card, Tabs, Field, Select, Input, Btn, Modal, Table, Td, Badge, Avatar, Empty, Icon, TONE, Bar, exportCSV } from '../components/ui.jsx';
import { TIPOS_TIEMPO, METODOS, VALIDACION } from '../lib/constants.js';
import { uid, pad, fmtFecha, hoy } from '../lib/utils.js';
import { validarMarcacion, distanciaMt } from '../lib/geo.js';

export default function Marcacion({db, set, toast, perfil}){
  const propio = perfil?.empleado_id || perfil?.empleadoId || '';
  const [tab,setTab] = useState('kiosco');
  const [emp,setEmp] = useState(propio);
  const [prop,setProp] = useState('');
  const [tipo,setTipo] = useState('EFECTIVO');
  const [codigo,setCodigo] = useState('');
  const [geo,setGeo] = useState(null);        // {lat,lng,precision} | {error}
  const [cargandoGeo,setCargandoGeo] = useState(false);
  const [ip,setIp] = useState(null);
  const [foto,setFoto] = useState(null);
  const [camara,setCamara] = useState(false);
  const [qrProp,setQrProp] = useState(null);
  const videoRef = useRef(null), canvasRef = useRef(null), qrRef = useRef(null);

  const activos = db.empleados.filter(e=>e.estado==='ACTIVO');
  const propiedad = db.propiedades.find(p=>p.id===prop);
  const empleado  = db.empleados.find(e=>e.id===emp);

  // ── Ubicación del dispositivo ──
  const pedirGeo = () => {
    if(!navigator.geolocation){ setGeo({error:'Este navegador no soporta geolocalización.'}); return; }
    setCargandoGeo(true);
    navigator.geolocation.getCurrentPosition(
      p => { setCargandoGeo(false);
             setGeo({ lat:+p.coords.latitude.toFixed(6), lng:+p.coords.longitude.toFixed(6),
                      precision:Math.round(p.coords.accuracy) }); },
      e => { setCargandoGeo(false);
             setGeo({ error: e.code===1 ? 'Permiso de ubicación denegado por el usuario.'
                          : e.code===2 ? 'Ubicación no disponible en este momento.'
                          : 'Tiempo de espera agotado al obtener la ubicación.' }); },
      { enableHighAccuracy:true, timeout:12000, maximumAge:0 });
  };

  // ── IP pública (solo corroborante; en producción se captura en el servidor) ──
  useEffect(() => { let vivo = true;
    fetch('https://api.ipify.org?format=json').then(r=>r.json())
      .then(d => vivo && setIp(d.ip)).catch(()=>{});
    return () => { vivo = false; };
  }, []);

  // Cuenta autoservicio (vinculada a un empleado): preselecciona su propiedad
  // asignada como mayordomo, si tiene una.
  useEffect(() => {
    if(!propio || prop) return;
    const p = db.propiedades.find(x => x.mayordomo === propio);
    if(p) setProp(p.id);
  }, [propio, db.propiedades]);

  // ── Al escanear el QR fijo de una propiedad, la URL trae ?marcar=CODIGO ──
  // Precarga esa propiedad y el código, y pide la ubicación de una vez.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cod = params.get('marcar');
    if(!cod) return;
    const p = db.propiedades.find(x => x.codigo === cod.toUpperCase());
    if(p){ setProp(p.id); setCodigo(p.codigo); setTab('kiosco'); pedirGeo(); }
    else toast(`No existe ninguna propiedad con el código "${cod}"`, 'rose');
    window.history.replaceState({}, '', window.location.pathname);
  }, [db.propiedades]);

  // ── Cámara ──
  const abrirCamara = async () => {
    try{
      const st = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
      setCamara(true);
      setTimeout(()=>{ if(videoRef.current){ videoRef.current.srcObject = st; videoRef.current.play(); } },80);
    }catch(e){ toast('No se pudo acceder a la cámara','rose'); }
  };
  const capturar = () => {
    const v = videoRef.current, c = canvasRef.current;
    if(!v || !c) return;
    c.width = 320; c.height = 240;
    c.getContext('2d').drawImage(v, 0, 0, 320, 240);
    setFoto(c.toDataURL('image/jpeg', 0.6));
    (v.srcObject?.getTracks()||[]).forEach(t=>t.stop());
    setCamara(false);
  };

  // ── Generación del QR imprimible ──
  useEffect(() => {
    if(!qrProp || !qrRef.current || !window.QRCode) return;
    qrRef.current.innerHTML = '';
    new window.QRCode(qrRef.current, {
      text: `${window.location.origin}/?marcar=${encodeURIComponent(qrProp.codigo)}`, width:190, height:190,
      correctLevel: window.QRCode.CorrectLevel.H });
  }, [qrProp]);

  // ── Validación en vivo ──
  const validacion = useMemo(() => {
    if(!propiedad) return null;
    return validarMarcacion(
      { lat:geo?.lat, lng:geo?.lng, codigo, ip, foto }, propiedad, db.cfg);
  }, [propiedad, geo, codigo, ip, foto, db.cfg]);

  // Si ya existe una marcación de hoy para este empleado/propiedad/tipo sin
  // cerrar (entrada === salida, la marca de "recién abierta"), el siguiente
  // escaneo se toma como su SALIDA en vez de crear un registro nuevo.
  const abierta = useMemo(() => {
    if(!emp || !prop) return null;
    const hoyStr = hoy();
    return db.asistencia.find(r => r.empleado===emp && r.propiedad===prop && r.tipo===tipo
      && r.fecha===hoyStr && r.entrada===r.salida) || null;
  }, [db.asistencia, emp, prop, tipo]);

  const registrar = () => {
    if(!emp)  return toast('Selecciona el empleado','rose');
    if(!prop) return toast('Selecciona la propiedad','rose');
    if(validacion?.bloqueante) return toast('Marcación bloqueada: ' + validacion.avisos[0],'rose');
    const ahora = new Date();
    const hm = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
    const metodo = geo?.lat ? 'GPS' : (codigo ? 'QR' : 'MANUAL');
    set(d => ({ ...d,
      asistencia: abierta
        ? d.asistencia.map(r => r.id===abierta.id ? { ...r, salida:hm, metodo, foto: foto||r.foto } : r)
        : [...d.asistencia, { id:uid(), empleado:emp, propiedad:prop, fecha:hoy(),
            tipo, entrada:hm, salida:hm, metodo,
            obs:'Marcación desde kiosco', lat:geo?.lat??null, lng:geo?.lng??null, ip,
            validacion: validacion?.estado || 'MANUAL', foto }],
      auditoria: [{ id:uid(), fecha:new Date().toISOString().slice(0,16).replace('T',' '),
        usuario: empleado?.nombre || '—', accion: abierta?'MARCAR_SALIDA':'MARCAR_ENTRADA',
        entidad:`Asistencia ${propiedad?.nombre}`,
        detalle:`${TIPOS_TIEMPO[tipo].label} · ${abierta?'Salida':'Entrada'} ${hm} · ${VALIDACION[validacion?.estado||'MANUAL'].label}` }, ...d.auditoria]
    }));
    toast((abierta?'Salida registrada · ':'Entrada registrada · ') + hm);
    setFoto(null); setCodigo('');
  };

  // ── Marcaciones con inconsistencia ──
  const inconsistentes = db.asistencia
    .filter(r => r.validacion && !['OK','MANUAL'].includes(r.validacion))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));

  return <Page title="Marcación" sub="Registro de asistencia con validación de ubicación"
    actions={<Btn v="outline" icon="download" onClick={()=>exportCSV('marcaciones_validadas',
      db.asistencia.filter(r=>r.validacion).map(r=>({
        fecha:r.fecha, empleado:db.empleados.find(e=>e.id===r.empleado)?.nombre,
        propiedad:db.propiedades.find(p=>p.id===r.propiedad)?.nombre||'',
        hora:r.entrada, metodo:r.metodo, validacion:VALIDACION[r.validacion]?.label,
        latitud:r.lat??'', longitud:r.lng??'', ip:r.ip??'' })))}>Exportar</Btn>}>

    <div className="mb-5"><Tabs active={tab} onChange={setTab} tabs={[
      {id:'kiosco',label:'Kiosco de marcación'},
      {id:'inconsistencias',label:'Inconsistencias',count:inconsistentes.length},
      {id:'qr',label:'Códigos QR de propiedades'},
      {id:'ayuda',label:'Cómo funciona'}]}/></div>

    {/* ═══ KIOSCO ═══ */}
    {tab==='kiosco' && <div className="grid lg:grid-cols-5 gap-4">
      <Card className="lg:col-span-3">
        <h3 className="font-bold text-ink-900 dark:text-white mb-1">Nueva marcación</h3>
        <p className="text-xs text-ink-500 mb-5">El trabajador se identifica y el sistema valida que esté en la propiedad</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field label="Empleado" req
              hint={propio ? 'Tu cuenta está vinculada a este empleado — no puedes marcar por otra persona' : undefined}>
            {propio ? <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-sm font-semibold">
                <Avatar nombre={empleado?.nombre} size="w-6 h-6"/>{empleado?.nombre || 'Empleado no encontrado'}</div>
            : <Select value={emp} onChange={e=>{ const v=e.target.value; setEmp(v);
                const p = db.propiedades.find(x=>x.mayordomo===v); if(p) setProp(p.id); }}
                options={[{v:'',l:'Selecciona…'},...activos.map(e=>({v:e.id,l:`${e.nombre} — ${e.cargo}`}))]}/>}
          </Field></div>
          <div className="sm:col-span-2"><Field label="Propiedad" req>
            <Select value={prop} onChange={e=>setProp(e.target.value)}
              options={[{v:'',l:'Selecciona…'},...db.propiedades.map(p=>({v:p.id,l:`${p.nombre} (${p.codigo})`}))]}/></Field></div>
          <div className="sm:col-span-2"><Field label="Tipo de tiempo" hint={TIPOS_TIEMPO[tipo]?.desc}>
            <Select value={tipo} onChange={e=>setTipo(e.target.value)}
              options={Object.values(TIPOS_TIEMPO).map(x=>({v:x.id,l:x.label}))}/></Field></div>
          <div className="sm:col-span-2"><Field label="Código de la propiedad"
            hint="Se autocompleta al escanear el QR fijo de la propiedad, o se digita">
            <Input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())}
              placeholder={propiedad ? propiedad.codigo.replace(/./g,'•') : 'Ej.: VMB-01'} className="uppercase"/></Field></div>
        </div>

        {/* Controles de validación */}
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <button onClick={pedirGeo} disabled={cargandoGeo}
            className={`p-3.5 rounded-xl ring-1 ring-inset text-left transition-colors ${
              geo?.lat ? TONE.emerald : geo?.error ? TONE.rose : 'ring-ink-200 dark:ring-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon n="location" c="w-4 h-4"/>
              <span className="text-xs font-bold">{cargandoGeo?'Obteniendo ubicación…':'Ubicación GPS'}</span></div>
            <p className="text-[11px] opacity-80">
              {geo?.lat ? `${geo.lat}, ${geo.lng} · ±${geo.precision} m`
                : geo?.error ? geo.error : 'Toca para obtener la ubicación del dispositivo'}</p>
          </button>

          <button onClick={foto ? ()=>setFoto(null) : abrirCamara}
            className={`p-3.5 rounded-xl ring-1 ring-inset text-left transition-colors ${
              foto ? TONE.sky : 'ring-ink-200 dark:ring-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
            <div className="flex items-center gap-2 mb-1"><Icon n="doc" c="w-4 h-4"/>
              <span className="text-xs font-bold">Fotografía {db.cfg.exigirFoto?'(requerida)':'(opcional)'}</span></div>
            <p className="text-[11px] opacity-80">{foto?'Capturada — toca para descartar':'Toca para tomar una foto de respaldo'}</p>
          </button>
        </div>

        {camara && <div className="mt-4 p-3 rounded-xl bg-ink-900">
          <video ref={videoRef} className="w-full max-w-xs mx-auto rounded-lg" muted playsInline/>
          <canvas ref={canvasRef} className="hidden"/>
          <div className="flex gap-2 justify-center mt-3">
            <Btn s="sm" onClick={capturar} icon="check">Capturar</Btn>
            <Btn s="sm" v="outline" onClick={()=>{ const v=videoRef.current;
              (v?.srcObject?.getTracks()||[]).forEach(t=>t.stop()); setCamara(false); }}>Cancelar</Btn>
          </div></div>}

        {foto && <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-950/50">
          <img src={foto} alt="Captura" className="w-20 h-15 rounded-lg object-cover"/>
          <p className="text-xs text-ink-500">Fotografía adjunta a la marcación</p></div>}

        {emp && prop && <p className="mt-4 text-center text-xs font-semibold text-ink-500">
          {abierta
            ? <>Ya hay una entrada abierta hoy a las <b className="text-ink-800 dark:text-ink-100">{abierta.entrada}</b> — este botón registra la <b>salida</b>.</>
            : <>Este botón registra la <b>entrada</b>. Vuelve a escanear el QR al terminar el turno para registrar la salida.</>}
        </p>}
        <div className="mt-2"><Btn s="lg" className="w-full" icon="check" onClick={registrar}
          disabled={!emp||!prop||validacion?.bloqueante}>{abierta?'Registrar salida':'Registrar entrada'}</Btn></div>
      </Card>

      {/* Panel de validación */}
      <Card className="lg:col-span-2">
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Validación</h3>
        {!propiedad ? <Empty icon="location" title="Selecciona una propiedad" sub="Aquí verás el resultado de la validación en tiempo real."/>
        : <>
          <div className={`p-4 rounded-xl ring-1 ring-inset mb-4 ${TONE[VALIDACION[validacion.estado].color]}`}>
            <div className="flex items-center gap-2">
              <Icon n={validacion.estado==='OK'?'check':'alert'} c="w-5 h-5"/>
              <span className="font-extrabold">{VALIDACION[validacion.estado].label}</span></div>
            {validacion.bloqueante && <p className="text-[11px] mt-1.5 font-semibold">La marcación no se puede registrar.</p>}
          </div>

          <div className="space-y-2.5 text-sm">
            {[['Propiedad', propiedad.nombre],
              ['Código esperado', propiedad.codigo],
              ['Distancia', validacion.distancia!=null ? `${validacion.distancia} m` : 'sin GPS'],
              ['Radio permitido', `${db.cfg.radioGeocerca} m`],
              ['IP detectada', ip || 'no disponible'],
              ['IP registrada', propiedad.ips?.length ? propiedad.ips.join(', ') : 'ninguna']
            ].map(([k,v]) => <div key={k} className="flex justify-between gap-3 py-1.5 border-b border-ink-100 dark:border-ink-800">
              <span className="text-ink-500 text-xs">{k}</span>
              <span className="font-semibold text-ink-900 dark:text-white text-xs text-right">{v}</span></div>)}
          </div>

          {validacion.distancia!=null && <div className="mt-4">
            <div className="flex justify-between text-[10px] font-bold text-ink-400 mb-1.5">
              <span>PROXIMIDAD A LA PROPIEDAD</span>
              <span className="num">{validacion.distancia} / {db.cfg.radioGeocerca} m</span></div>
            <Bar pct={100 - Math.min(100,(validacion.distancia/db.cfg.radioGeocerca)*100)}
              tone={validacion.distancia<=db.cfg.radioGeocerca?'emerald':'rose'}/></div>}

          {validacion.avisos.length>0 && <div className="mt-4 space-y-2">
            {validacion.avisos.map((a,i)=>(
              <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <Icon n="alert" c="w-3.5 h-3.5 shrink-0 mt-px"/>{a}</p>))}</div>}
        </>}
      </Card>
    </div>}

    {/* ═══ INCONSISTENCIAS ═══ */}
    {tab==='inconsistencias' && <Card pad={false}>
      {inconsistentes.length===0
        ? <Empty icon="check" title="Sin inconsistencias" sub="Todas las marcaciones registradas superaron la validación de ubicación."/>
        : <Table head={['Fecha','Empleado','Propiedad','Hora','Método','Resultado','Ubicación','IP']}>
          {inconsistentes.map(r => {
            const e = db.empleados.find(x=>x.id===r.empleado);
            const p = db.propiedades.find(x=>x.id===r.propiedad);
            const d = p && r.lat ? distanciaMt(r.lat,r.lng,p.lat,p.lng) : null;
            return <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
              <Td className="text-xs whitespace-nowrap">{fmtFecha(r.fecha)}</Td>
              <Td><div className="flex items-center gap-2"><Avatar nombre={e?.nombre} size="w-7 h-7"/>
                <span className="font-semibold text-xs">{e?.nombre.split(' ').slice(0,2).join(' ')}</span></div></Td>
              <Td className="text-xs">{p?.nombre||'—'}</Td>
              <Td className="num text-xs">{r.entrada}</Td>
              <Td><Badge tone={METODOS[r.metodo]?.color||'slate'}>{r.metodo}</Badge></Td>
              <Td><Badge tone={VALIDACION[r.validacion]?.color} dot>{VALIDACION[r.validacion]?.label}</Badge></Td>
              <Td className="text-xs">{d!=null?`a ${d} m`:'—'}</Td>
              <Td className="text-[11px] text-ink-400">{r.ip||'—'}</Td>
            </tr>;})}
        </Table>}
      <div className="p-4 border-t border-ink-200 dark:border-ink-800 text-[11px] text-ink-500 dark:text-ink-400">
        Una IP distinta a la registrada <b>no prueba</b> que el trabajador no estuviera en la propiedad: puede deberse a IP
        dinámica del operador, uso de datos móviles o CGNAT. Trátala como señal para verificar, nunca como falta.
      </div>
    </Card>}

    {/* ═══ QR ═══ */}
    {tab==='qr' && <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2" pad={false}>
        <div className="p-5 border-b border-ink-200 dark:border-ink-800">
          <h3 className="font-bold text-ink-900 dark:text-white">Códigos y geocerca por propiedad</h3>
          <p className="text-xs text-ink-500">Imprime el QR y fíjalo en un lugar visible dentro de cada propiedad</p></div>
        <Table head={['Propiedad','Código','Coordenadas','IPs registradas','']}>
          {db.propiedades.map(p => (
            <tr key={p.id} className="hover:bg-ink-50 dark:hover:bg-ink-950/40">
              <Td className="font-bold">{p.nombre}<p className="text-[11px] text-ink-400 font-normal">{p.ubicacion}</p></Td>
              <Td><Badge tone="brand">{p.codigo}</Badge></Td>
              <Td className="text-[11px] num">{p.lat!=null?`${p.lat}, ${p.lng}`:'sin definir'}</Td>
              <Td className="text-[11px]">{p.ips?.length?p.ips.join(', '):<span className="text-ink-400">ninguna</span>}</Td>
              <Td className="text-right"><Btn v="soft" s="sm" icon="qr" onClick={()=>setQrProp(p)}>Ver QR</Btn></Td>
            </tr>))}
        </Table>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-3">Por qué el QR no basta solo</h3>
        <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed mb-3">
          Un QR fijo puede fotografiarse y compartirse por WhatsApp. Por eso el código
          <b> se combina siempre con la geocerca</b>: para falsear una marcación habría que
          tener la foto del código <i>y</i> además falsificar el GPS del teléfono.</p>
        <div className="space-y-2">
          {[['Geocerca GPS','Control primario · precisión 10–50 m','emerald'],
            ['Código del QR','Prueba de presencia física en el sitio','brand'],
            ['Fotografía','Evidencia visual y soporte documental','sky'],
            ['IP pública','Solo corrobora · nunca bloquea','amber']].map(([t,d,c])=>
            <div key={t} className={`p-2.5 rounded-lg ring-1 ring-inset ${TONE[c]}`}>
              <p className="text-xs font-bold">{t}</p><p className="text-[11px] opacity-85">{d}</p></div>)}
        </div>
      </Card>
    </div>}

    {/* ═══ AYUDA ═══ */}
    {tab==='ayuda' && <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Flujo de una marcación</h3>
        <ol className="space-y-3">
          {['El trabajador llega a la propiedad y abre la aplicación en su teléfono.',
            'Escanea el QR fijo pegado en la propiedad; el código se autocompleta.',
            'La app solicita la ubicación y calcula la distancia real a la propiedad.',
            'Si está dentro del radio permitido, la marcación se valida y se registra.',
            'Si está fuera del radio, se bloquea y queda el intento registrado.',
            'La IP se guarda como dato de respaldo, sin bloquear la marcación.'
          ].map((t,i)=>(
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] font-extrabold grid place-items-center shrink-0">{i+1}</span>
              <p className="text-sm text-ink-700 dark:text-ink-200">{t}</p></li>))}
        </ol>
      </Card>
      <Card>
        <h3 className="font-bold text-ink-900 dark:text-white mb-4">Limitaciones que debes conocer</h3>
        <div className="space-y-3">
          {[['La IP no sirve como control de acceso',
             'Las conexiones residenciales colombianas usan IP dinámica y CGNAT: varias propiedades y hogares pueden compartir la misma IP pública, y esta cambia sola. Además, si el trabajador usa datos móviles la IP será la del operador.','rose'],
            ['El navegador no puede leer la IP privada',
             'Desde Chrome 80 las direcciones internas (192.168.x.x) vienen ofuscadas. Solo es posible capturar la IP pública de salida.','amber'],
            ['La IP debe capturarse en el servidor',
             'En este prototipo la consulta el navegador, que es falsificable. En producción el backend debe leerla de la petición HTTP.','amber'],
            ['El GPS exige HTTPS y permiso',
             'La geolocalización solo funciona sobre HTTPS y requiere que el trabajador acepte el permiso. Si lo niega, la marcación queda marcada para revisión.','sky'],
            ['El GPS puede falsificarse',
             'Existen apps de ubicación simulada. Combinar GPS + QR + foto eleva mucho el esfuerzo necesario para engañar al sistema.','sky']
          ].map(([t,d,c])=>(
            <div key={t} className={`p-3.5 rounded-xl ring-1 ring-inset ${TONE[c]}`}>
              <p className="text-xs font-bold flex items-start gap-1.5"><Icon n="alert" c="w-4 h-4 shrink-0 mt-px"/>{t}</p>
              <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">{d}</p></div>))}
        </div>
      </Card>
    </div>}

    {/* Modal QR imprimible */}
    <Modal open={!!qrProp} onClose={()=>setQrProp(null)} w="max-w-sm"
      title="Código QR de la propiedad" sub={qrProp?.nombre}
      footer={<Btn v="outline" onClick={()=>window.print()} icon="doc">Imprimir</Btn>}>
      {qrProp && <div className="text-center">
        <div ref={qrRef} className="inline-block p-4 bg-white rounded-xl ring-1 ring-ink-200"/>
        <p className="mt-4 text-2xl font-extrabold tracking-widest text-ink-900 dark:text-white">{qrProp.codigo}</p>
        <p className="text-xs text-ink-500 mt-1">{qrProp.nombre}</p>
        <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
          Imprime esta hoja y fíjala en un lugar visible dentro de la propiedad.
          El trabajador la escanea al llegar y al salir.</p>
      </div>}
    </Modal>
  </Page>;
}
