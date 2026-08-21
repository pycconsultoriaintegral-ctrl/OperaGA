/* ══════════════════════════════════════════════════════════════════════════
   BIBLIOTECA DE COMPONENTES  ·  portado literalmente desde el prototipo original
   ══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { iniciales, hoy } from '../lib/utils.js';

export const ICONS = {
  dashboard:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  users:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  home:'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  calendar:'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-1V1h-2zm3 18H5V8h14v11z',
  clock:'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  alert:'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  money:'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  chart:'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z',
  settings:'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
  doc:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  plus:'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  search:'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  x:'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  trash:'M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  eye:'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  'eye-off':'M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01zM12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7z',
  check:'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  moon:'M12.34 2.02A10 10 0 1021.98 12c-.62 4.5-4.5 7.98-9.14 7.98A9.15 9.15 0 013.7 10.8c0-4.63 3.48-8.51 7.98-9.13.22-.03.44-.05.66-.05z',
  sun:'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5a6 6 0 100 12 6 6 0 000-12zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z',
  download:'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  filter:'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z',
  bell:'M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  logout:'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4a2 2 0 00-2 2v14a2 2 0 002 2h8v-2H4V5z',
  key:'M12.65 10A6 6 0 100 6a6 6 0 0011.65 4H17v4h4v-4h2v-4H12.65zM7 14a2 2 0 110-4 2 2 0 010 4z',
  qr:'M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zm0 10h2v2h-2v-2zm-6-6h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm0-4h2v2h-2v-2zm2 2h2v2h-2v-2z',
  menu:'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  arrowUp:'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  arrowDown:'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  chevL:'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevR:'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  shield:'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  location:'M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z',
  bed:'M7 13a3 3 0 100-6 3 3 0 000 6zm12-2h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 00-4-4z',
  bolt:'M7 2v11h3v9l7-12h-4l4-8z',
  copy:'M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z'
};

export const Icon = ({n, c='w-5 h-5', ...p}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={c} {...p}><path d={ICONS[n]||''}/></svg>
);

// ── Paletas de color reutilizables ──
export const TONE = {
  brand:  'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25',
  emerald:'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  amber:  'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
  rose:   'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25',
  sky:    'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/25',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25',
  teal:   'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/25',
  slate:  'bg-ink-100 text-ink-600 ring-ink-500/20 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-600/30'
};
export const DOT = { brand:'bg-brand-500',emerald:'bg-emerald-500',amber:'bg-amber-500',rose:'bg-rose-500',
  sky:'bg-sky-500',violet:'bg-violet-500',indigo:'bg-indigo-500',orange:'bg-orange-500',teal:'bg-teal-500',slate:'bg-ink-400' };

export const Badge = ({tone='slate', children, dot, className=''}) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${TONE[tone]||TONE.slate} ${className}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT[tone]||DOT.slate}`}/>}
    {children}
  </span>
);

export const Card = ({children, className='', pad=true}) => (
  <div className={`bg-white dark:bg-ink-900 rounded-xl shadow-card ring-1 ring-ink-200/70 dark:ring-ink-800 ${pad?'p-5':''} ${className}`}>{children}</div>
);

export const Btn = ({v='primary', s='md', children, className='', icon, ...p}) => {
  const V = {
    primary:'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300',
    ghost:'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
    outline:'ring-1 ring-inset ring-ink-300 dark:ring-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 bg-white dark:bg-ink-900',
    danger:'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    soft:'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25'
  };
  const S = { sm:'px-2.5 py-1.5 text-xs gap-1.5', md:'px-3.5 py-2 text-sm gap-2', lg:'px-5 py-2.5 text-sm gap-2' };
  return <button className={`inline-flex items-center justify-center font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${V[v]} ${S[s]} ${className}`} {...p}>
    {icon && <Icon n={icon} c={s==='sm'?'w-3.5 h-3.5':'w-4 h-4'}/>}{children}</button>;
};

export const IN = 'w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-950 ring-1 ring-inset ring-ink-300 dark:ring-ink-700 text-ink-900 dark:text-ink-100 focus:ring-2 focus:ring-brand-500 placeholder:text-ink-400 transition-shadow';

export const Field = ({label, children, hint, req}) => (
  <label className="block">
    <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1.5">
      {label}{req && <span className="text-rose-500 ml-0.5">*</span>}</span>
    {children}
    {hint && <span className="block mt-1 text-[11px] text-ink-400">{hint}</span>}
  </label>
);
export const Input  = p => <input  className={IN} {...p}/>;
export const Select = ({options=[], ...p}) => <select className={IN} {...p}>
  {options.map(o => typeof o==='string'
    ? <option key={o} value={o}>{o}</option>
    : <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
export const Area   = p => <textarea className={IN} rows="3" {...p}/>;

// Input de texto con sugerencias (datalist nativo): permite escoger de la
// lista o escribir un valor que no esté en ella (ej. EPS/AFP/ARL — las listas
// oficiales cambian de un municipio a otro y nunca están 100% completas).
let comboSeq = 0;
export const Combo = ({options=[], id, ...p}) => {
  const listId = useMemo(() => id || `combo-${++comboSeq}`, [id]);
  return <>
    <input className={IN} list={listId} autoComplete="off" {...p}/>
    <datalist id={listId}>{options.map(o => <option key={o} value={o}/>)}</datalist>
  </>;
};

export const Modal = ({open, onClose, title, sub, children, w='max-w-2xl', footer}) => {
  useEffect(()=>{ const h=e=>e.key==='Escape'&&onClose(); if(open){document.addEventListener('keydown',h);
    document.body.style.overflow='hidden';} return()=>{document.removeEventListener('keydown',h);document.body.style.overflow='';}; },[open,onClose]);
  if(!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
    <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose}/>
    <div className={`relative w-full ${w} bg-white dark:bg-ink-900 rounded-2xl shadow-pop pop-in my-auto`}>
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-ink-200 dark:border-ink-800">
        <div><h3 className="text-base font-bold text-ink-900 dark:text-white">{title}</h3>
          {sub && <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{sub}</p>}</div>
        <button onClick={onClose} className="p-1.5 -m-1 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><Icon n="x" c="w-5 h-5"/></button>
      </div>
      <div className="px-6 py-5 max-h-[68vh] overflow-y-auto">{children}</div>
      {footer && <div className="px-6 py-3.5 border-t border-ink-200 dark:border-ink-800 bg-ink-50/70 dark:bg-ink-950/40 rounded-b-2xl flex justify-end gap-2">{footer}</div>}
    </div>
  </div>;
};

export const Avatar = ({nombre, foto, size='w-9 h-9', tone}) => {
  const tones = ['brand','emerald','violet','amber','sky','rose','teal','indigo'];
  const t = tone || tones[(nombre||'').length % tones.length];
  if(foto) return <img src={foto} alt={nombre||''} className={`${size} rounded-full object-cover ring-1 ring-inset ring-ink-200/70 dark:ring-ink-800 shrink-0`}/>;
  return <div className={`${size} rounded-full grid place-items-center font-bold text-[11px] ring-1 ring-inset shrink-0 ${TONE[t]}`}>{iniciales(nombre)}</div>;
};

export const Stat = ({label, value, sub, icon, tone='brand', trend}) => (
  <Card className="relative overflow-hidden">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-extrabold text-ink-900 dark:text-white mt-1.5 num tracking-tight">{value}</p>
        {sub && <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl grid place-items-center ring-1 ring-inset shrink-0 ${TONE[tone]}`}><Icon n={icon} c="w-5 h-5"/></div>
    </div>
    {trend!=null && <div className={`mt-3 inline-flex items-center gap-1 text-xs font-bold ${trend>=0?'text-emerald-600':'text-rose-600'}`}>
      <Icon n={trend>=0?'arrowUp':'arrowDown'} c="w-3.5 h-3.5"/>{Math.abs(trend)}% vs. mes anterior</div>}
  </Card>
);

export const Empty = ({icon='doc', title, sub, action}) => (
  <div className="text-center py-14 px-6">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-ink-100 dark:bg-ink-800 grid place-items-center text-ink-400"><Icon n={icon} c="w-7 h-7"/></div>
    <h4 className="mt-4 font-bold text-ink-800 dark:text-ink-100">{title}</h4>
    {sub && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400 max-w-sm mx-auto">{sub}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Th = ({children, className='', ...p}) => <th className={`px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 ${className}`} {...p}>{children}</th>;
export const Td = ({children, className='', ...p}) => <td className={`px-4 py-3 text-sm text-ink-700 dark:text-ink-200 ${className}`} {...p}>{children}</td>;

export const Table = ({head, children, className=''}) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full min-w-[640px]">
      <thead className="bg-ink-50 dark:bg-ink-950/60 border-b border-ink-200 dark:border-ink-800">
        <tr>{head.map((h,i)=><Th key={i} className={h.a?`text-${h.a}`:''}>{h.l||h}</Th>)}</tr></thead>
      <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{children}</tbody>
    </table>
  </div>
);

export const Tabs = ({tabs, active, onChange}) => (
  <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-900 rounded-xl overflow-x-auto">
    {tabs.map(t => (
      <button key={t.id} onClick={()=>onChange(t.id)}
        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${
          active===t.id ? 'bg-white dark:bg-ink-800 text-brand-700 dark:text-brand-300 shadow-sm'
                        : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'}`}>
        {t.label}{t.count!=null && <span className="ml-1.5 opacity-60">{t.count}</span>}
      </button>))}
  </div>
);

export const Bar = ({pct, tone='brand', h='h-2'}) => (
  <div className={`w-full ${h} bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden`}>
    <div className={`${h} ${DOT[tone]} rounded-full transition-all duration-500`} style={{width:`${Math.min(100,Math.max(0,pct))}%`}}/>
  </div>
);

export const Page = ({title, sub, actions, children}) => (
  <div className="fade-in">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

export function useToast(){
  const [t,setT] = useState(null);
  const show = useCallback((msg,tone='emerald')=>{ setT({msg,tone}); setTimeout(()=>setT(null),2800); },[]);
  const node = t && <div className="fixed bottom-5 right-5 z-[60] pop-in">
    <div className={`px-4 py-2.5 rounded-xl shadow-pop ring-1 ring-inset text-sm font-semibold flex items-center gap-2 ${TONE[t.tone]}`}>
      <Icon n={t.tone==='rose'?'alert':'check'} c="w-4 h-4"/>{t.msg}</div></div>;
  return [show, node];
}

export function exportCSV(nombre, filas){
  if(!filas.length) return;
  const cols = Object.keys(filas[0]);
  const esc = v => { const s = v==null?'':String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = '﻿' + [cols.join(';'), ...filas.map(f=>cols.map(c=>esc(f[c])).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `${nombre}_${hoy()}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
