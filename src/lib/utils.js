/* ══════════════════════════════════════════════════════════════════════════
   UTILIDADES  ·  portado literalmente desde el prototipo original
   ══════════════════════════════════════════════════════════════════════════ */

export const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
export const pad = n => String(n).padStart(2,'0');
export const hoy = () => new Date().toISOString().slice(0,10);

export const fmtCOP = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Math.round(v||0));
export const fmtNum = (v,d=1) => (v||0).toLocaleString('es-CO',{minimumFractionDigits:d,maximumFractionDigits:d});
export const fmtFecha = f => { if(!f) return '—'; const [y,m,d]=f.split('-'); return `${d}/${m}/${y}`; };
export const fmtFechaLarga = f => { if(!f) return '—'; const dt=new Date(f+'T12:00:00');
  return dt.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); };

export const diffDias = (a,b) => Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00'))/86400000);
export const addDias = (f,n) => { const d=new Date(f+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
export const nombreDia = f => ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(f+'T12:00:00').getDay()];
export const esDomingo = f => new Date(f+'T12:00:00').getDay() === 0;

export const iniciales = n => (n||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
export const edad = f => { if(!f) return '—'; const d=new Date(f); const t=new Date();
  let a=t.getFullYear()-d.getFullYear(); const m=t.getMonth()-d.getMonth();
  if(m<0||(m===0&&t.getDate()<d.getDate())) a--; return a; };

// hora "HH:MM" -> minutos desde medianoche
export const hm2min = h => { if(!h) return 0; const [a,b]=h.split(':').map(Number); return a*60+(b||0); };
export const min2hm = m => `${pad(Math.floor((m%1440)/60))}:${pad(m%60)}`;
export const min2hrs = m => m/60;

/** Horas efectivas de un turno, ya descontado el tiempo de descanso */
export function horasTurno(t){
  if(!t || !t.ini || !t.fin) return 0;
  if(t.interno) return 8;              // el interno programa 8 h efectivas; el resto se clasifica en marcación
  let d = hm2min(t.fin) - hm2min(t.ini);
  if(d <= 0) d += 1440;
  return Math.max(0, (d - (t.desc||0)) / 60);
}
