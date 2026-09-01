import { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon, Avatar, useToast } from './components/ui.jsx';
import { useRemoteDB } from './data/useRemoteDB.js';
import { calcularCompensatorios } from './lib/payroll.js';
import { fmtFechaLarga, hoy } from './lib/utils.js';
import { useAuth } from './auth/AuthProvider.jsx';
import { usePermisos } from './auth/usePermisos.js';
import Login from './auth/Login.jsx';
import ResetPassword from './auth/ResetPassword.jsx';

import Dashboard from './features/Dashboard.jsx';
import Empleados from './features/Empleados.jsx';
import Propiedades from './features/Propiedades.jsx';
import Horarios from './features/Horarios.jsx';
import Asistencia from './features/Asistencia.jsx';
import Marcacion from './features/Marcacion.jsx';
import EnReserva from './features/EnReserva.jsx';
import Novedades from './features/Novedades.jsx';
import Liquidacion from './features/Liquidacion.jsx';
import Reportes from './features/Reportes.jsx';
import Configuracion from './features/Configuracion.jsx';

// Módulo de permisos requerido para ver cada opción del menú. `null` = visible
// para cualquiera que haya iniciado sesión (no hay dato sensible detrás).
const NAV = [
  { id:'dashboard',   label:'Panel de control', icon:'dashboard', modulo:null },
  { id:'empleados',   label:'Empleados',        icon:'users',     modulo:['empleados','empleados_publico'] },
  { id:'propiedades', label:'Propiedades',      icon:'home',      modulo:'propiedades' },
  { id:'horarios',    label:'Horarios',         icon:'calendar',  modulo:'horarios' },
  { id:'asistencia',  label:'Asistencia',       icon:'clock',     modulo:'asistencia' },
  { id:'marcacion',   label:'Marcación',        icon:'qr',        modulo:'asistencia' },
  { id:'enreserva',   label:'En reserva',       icon:'bed',       modulo:'asistencia' },
  { id:'novedades',   label:'Novedades',        icon:'doc',       modulo:'novedades' },
  { id:'liquidacion', label:'Liquidación',      icon:'money',     modulo:'liquidacion' },
  { id:'reportes',    label:'Reportes',         icon:'chart',     modulo:'reportes' },
  { id:'config',      label:'Configuración',    icon:'settings',  modulo:['configuracion','usuarios'] }
];

/** Puerta de autenticación: decide qué pantalla mostrar antes de entrar a la app. */
export default function App(){
  const { session, loading: authLoading, recovery, signOut } = useAuth();
  const { perfil, rol, has, loading: permLoading } = usePermisos();

  if (authLoading) return <Pantalla msg="Cargando…"/>;
  if (recovery) return <ResetPassword/>;
  if (!session) return <Login/>;
  if (permLoading) return <Pantalla msg="Cargando tu perfil…"/>;
  if (!perfil) return (
    <Pantalla msg="Tu cuenta inició sesión correctamente, pero no tiene un perfil asignado en el sistema.
      Pide a un administrador que te dé de alta en Configuración → Usuarios y roles.">
      <button onClick={signOut} className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700">Cerrar sesión</button>
    </Pantalla>
  );

  return <AppShell perfil={perfil} rol={rol} has={has} onLogout={signOut} userId={session.user.id}/>;
}

function Pantalla({ msg, children }){
  return <div className="min-h-screen grid place-items-center bg-ink-50 dark:bg-ink-950 px-6 text-center">
    <div className="max-w-sm">
      <p className="text-sm text-ink-500 dark:text-ink-400 whitespace-pre-line">{msg}</p>
      {children}
    </div>
  </div>;
}

function AppShell({ perfil, rol, has, onLogout, userId }){
  // Si el enlace trae ?marcar=CODIGO (viene de escanear el QR fijo de una
  // propiedad), abre directo en Marcación en vez del Panel de control.
  const [vista,setVista] = useState(() =>
    new URLSearchParams(window.location.search).get('marcar') ? 'marcacion' : 'dashboard');
  const [dark,setDark]   = useState(()=>{ try{return localStorage.getItem('opera_dark')==='1';}catch(e){return false;} });
  const [menu,setMenu]   = useState(false);
  const [toast,toastNode] = useToast();
  const { db, set, loading: dbLoading, refrescar } = useRemoteDB(toast, userId);

  useEffect(()=>{ document.documentElement.classList.toggle('dark',dark);
    try{localStorage.setItem('opera_dark',dark?'1':'0');}catch(e){} },[dark]);

  const go  = useCallback(v => { setVista(v); setMenu(false); window.scrollTo(0,0); }, []);

  // Solo se muestran en el menú las opciones a las que el rol tiene acceso.
  // Esto es cosmético: la protección real está en las políticas RLS de Supabase.
  // Excepción: alguien con un empleado vinculado siempre ve Horarios/
  // Asistencia/Marcación, aunque su rol no tenga el permiso amplio — su
  // acceso ahí viene de las políticas "propio" (solo sus propias filas).
  const tienePropio = !!perfil?.empleado_id;
  const navVisible = useMemo(() => NAV.filter(n => {
    if (!n.modulo) return true;
    const modulos = Array.isArray(n.modulo) ? n.modulo : [n.modulo];
    if (tienePropio && modulos.some(m => ['horarios','asistencia'].includes(m))) return true;
    return modulos.some(m => has(m,'ver'));
  }), [has, tienePropio]);

  useEffect(() => { if (navVisible.length && !navVisible.some(n=>n.id===vista)) go(navVisible[0].id); }, [navVisible]);

  // Contadores para los badges del menú
  const badges = useMemo(()=>{
    if (!db) return {};
    return {
      novedades: db.novedades.filter(n=>n.estado==='PENDIENTE').length,
      marcacion: db.asistencia.filter(r=>r.validacion && !['OK','MANUAL'].includes(r.validacion)).length,
      enreserva: db.estadias.filter(e=>e.estado==='ACTIVA').length,
      horarios: calcularCompensatorios(db.empleados.filter(e=>e.estado==='ACTIVO'),
        db.horarios||[], db.asistencia, db.novedades, db.festivos, db.cfg)
        .reduce((s,c)=>s+Math.max(0,c.saldo),0)
    };
  },[db]);

  if (dbLoading || !db) return <Pantalla msg="Cargando datos de la operación…"/>;

  const P = { db, set, toast, go, refrescar, perfil, has };
  const VISTAS = {
    dashboard:   <Dashboard {...P}/>,
    empleados:   <Empleados {...P}/>,
    propiedades: <Propiedades {...P}/>,
    horarios:    <Horarios {...P}/>,
    asistencia:  <Asistencia {...P}/>,
    marcacion:   <Marcacion {...P}/>,
    enreserva:   <EnReserva {...P}/>,
    novedades:   <Novedades {...P}/>,
    liquidacion: <Liquidacion {...P}/>,
    reportes:    <Reportes {...P}/>,
    config:      <Configuracion {...P}/>
  };

  const Sidebar = () => (
    <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-ink-900 dark:bg-ink-950
      flex flex-col transition-transform duration-200 lg:translate-x-0 ${menu?'translate-x-0':'-translate-x-full'}`}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[.07]">
        <div className="w-9 h-9 rounded-xl bg-brand-500 grid place-items-center shadow-lg shadow-brand-500/25 shrink-0">
          <Icon n="shield" c="w-5 h-5 text-white"/></div>
        <div className="min-w-0">
          <p className="font-extrabold text-white tracking-tight leading-none">OPERA</p>
          <p className="text-[10px] text-white/40 mt-0.5 truncate">Gestión de personal</p></div>
        <button onClick={()=>setMenu(false)} className="lg:hidden ml-auto p-1 text-white/50 hover:text-white"><Icon n="x" c="w-5 h-5"/></button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navVisible.map(n => {
          const act = vista===n.id; const b = badges[n.id];
          return <button key={n.id} onClick={()=>go(n.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              act ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'text-white/55 hover:text-white hover:bg-white/[.06]'}`}>
            <Icon n={n.icon} c="w-[18px] h-[18px] shrink-0"/>
            <span className="truncate">{n.label}</span>
            {b>0 && <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-extrabold num ${
              act?'bg-white/20 text-white':'bg-brand-500/20 text-brand-300'}`}>{b}</span>}
          </button>;})}
      </nav>

      {/* Pie */}
      <div className="p-3 border-t border-white/[.07] space-y-2">
        <div className="px-3 py-2.5 rounded-xl bg-white/[.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">Normativa aplicada</p>
          <p className="text-[11px] text-white/70 mt-1 leading-relaxed">
            Ley 2101/2021 · Ley 2466/2025<br/>
            <span className="text-white/40">{db.cfg.horasSemanales} h/sem · nocturno {db.cfg.nocturnoInicio}:00</span></p>
        </div>
        <div className="flex items-center gap-2 px-2">
          <Avatar nombre={perfil.nombre} size="w-8 h-8"/>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white truncate">{perfil.nombre}</p>
            <p className="text-[10px] text-white/40 truncate">{rol?.nombre || '—'}</p></div>
          <button onClick={()=>setDark(!dark)} title="Cambiar tema"
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[.08]">
            <Icon n={dark?'sun':'moon'} c="w-4 h-4"/></button>
          <button onClick={onLogout} title="Cerrar sesión"
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[.08]">
            <Icon n="logout" c="w-4 h-4"/></button>
        </div>
      </div>
    </aside>
  );

  return <div className="min-h-screen flex">
    {menu && <div className="fixed inset-0 z-30 bg-ink-950/60 lg:hidden" onClick={()=>setMenu(false)}/>}
    <Sidebar/>
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-20 bg-white/85 dark:bg-ink-900/85 backdrop-blur-md border-b border-ink-200 dark:border-ink-800">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={()=>setMenu(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
            <Icon n="menu" c="w-5 h-5"/></button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{NAV.find(n=>n.id===vista)?.label}</p>
            <p className="text-[11px] text-ink-400 truncate hidden sm:block">Grupo Américas · Alquiler vacacional</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-100 dark:bg-ink-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-[11px] font-bold text-ink-600 dark:text-ink-300">{fmtFechaLarga(hoy())}</span></div>
            {badges.novedades>0 && <button onClick={()=>go('novedades')} title="Novedades pendientes"
              className="relative p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
              <Icon n="bell" c="w-5 h-5"/>
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold grid place-items-center">{badges.novedades}</span>
            </button>}
            <button onClick={()=>setDark(!dark)} className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
              <Icon n={dark?'sun':'moon'} c="w-5 h-5"/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full">{VISTAS[vista]}</main>

      <footer className="px-6 py-4 border-t border-ink-200 dark:border-ink-800 text-[11px] text-ink-400 flex flex-wrap justify-between gap-2">
        <span>OPERA v1.0 · Sesión: {perfil.nombre} ({rol?.nombre || 'sin rol'})</span>
        <span>Parámetros conforme a Ley 2101/2021 y Ley 2466/2025 — validar con abogado laboralista antes de uso en producción</span>
      </footer>
    </div>
    {toastNode}
  </div>;
}
