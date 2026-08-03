/* ══════════════════════════════════════════════════════════════════════════
   PERSISTENCIA + DATOS SEMILLA  ·  portado literalmente del prototipo original.

   NOTA DE MIGRACIÓN: esta capa sigue usando localStorage como en el prototipo
   original — es intencional para la Fase 0 (permite ver la app funcionando
   con datos de ejemplo antes de conectar Supabase). Se reemplaza en la Fase 4
   del plan de migración por consultas reales a la base de datos centralizada,
   sin que los componentes que la consumen deban cambiar su forma de uso
   (siguen recibiendo `db` y llamando `set(fn)`).
   ══════════════════════════════════════════════════════════════════════════ */
import { CONFIG_DEFAULT, FESTIVOS_2026, FESTIVOS_2027, TURNOS_BASE } from './constants.js';
import { uid, hm2min, min2hm, addDias } from './utils.js';

export const KEY = 'opera_gpo_v3';

export function seedData(){
  const cfg = { ...CONFIG_DEFAULT };

  const empleados = [
    { id:'e1', nombre:'Carlos Andrés Meza Pérez', doc:'1.045.882.331', tipoDoc:'CC', cargo:'Mayordomo',
      nacimiento:'1985-03-14', tel:'300 412 8890', email:'cmeza@grupoamericas.co',
      dir:'Cra 47 #74-12, Barranquilla', ingreso:'2023-02-01', contrato:'Término indefinido',
      salario:2400000, eps:'Sura', afp:'Porvenir', arl:'Sura ARL', banco:'Bancolombia', cuenta:'4520 8891 22',
      contactoEmg:'Luz Meza — 301 220 9911', estado:'ACTIVO', interno:true, foto:null },
    { id:'e2', nombre:'Jorge Luis Ospina Rivas', doc:'8.732.114', tipoDoc:'CC', cargo:'Mayordomo',
      nacimiento:'1979-11-02', tel:'315 776 2210', email:'jospina@grupoamericas.co',
      dir:'Calle 30 #12-45, Cartagena', ingreso:'2022-08-15', contrato:'Término indefinido',
      salario:2400000, eps:'Nueva EPS', afp:'Protección', arl:'Positiva', banco:'Davivienda', cuenta:'0091 3321 78',
      contactoEmg:'Marta Rivas — 312 445 0032', estado:'ACTIVO', interno:true, foto:null },
    { id:'e3', nombre:'Sandra Milena Rojas Cuesta', doc:'1.128.443.902', tipoDoc:'CC', cargo:'Mucama',
      nacimiento:'1992-06-21', tel:'320 118 4432', email:'srojas@grupoamericas.co',
      dir:'Barrio Olaya, Cartagena', ingreso:'2023-05-10', contrato:'Término fijo 1 año',
      salario:1750905, eps:'Sanitas', afp:'Colfondos', arl:'Colmena', banco:'Nequi', cuenta:'320 118 4432',
      contactoEmg:'Pedro Rojas — 300 991 2211', estado:'ACTIVO', interno:false, foto:null },
    { id:'e4', nombre:'Yulieth Paola Fontalvo Díaz', doc:'1.143.220.887', tipoDoc:'CC', cargo:'Mucama',
      nacimiento:'1995-09-30', tel:'301 553 7712', email:'yfontalvo@grupoamericas.co',
      dir:'Manga, Cartagena', ingreso:'2024-01-20', contrato:'Término fijo 1 año',
      salario:1750905, eps:'Compensar', afp:'Porvenir', arl:'Sura ARL', banco:'Bancolombia', cuenta:'7712 4490 01',
      contactoEmg:'Ana Díaz — 315 002 8871', estado:'ACTIVO', interno:false, foto:null },
    { id:'e5', nombre:'Wilmer Alberto Castro Núñez', doc:'73.221.554', tipoDoc:'CC', cargo:'Conductor',
      nacimiento:'1988-01-08', tel:'310 220 9987', email:'wcastro@grupoamericas.co',
      dir:'Bocagrande, Cartagena', ingreso:'2023-09-01', contrato:'Término indefinido',
      salario:1900000, eps:'Salud Total', afp:'Protección', arl:'Positiva', banco:'BBVA', cuenta:'3320 1187 55',
      contactoEmg:'Rosa Núñez — 300 771 2210', estado:'ACTIVO', interno:false, foto:null },
    { id:'e6', nombre:'Héctor Manuel Padilla Gómez', doc:'9.087.442', tipoDoc:'CC', cargo:'Mantenimiento',
      nacimiento:'1983-04-17', tel:'316 889 0021', email:'hpadilla@grupoamericas.co',
      dir:'El Pozón, Cartagena', ingreso:'2022-11-05', contrato:'Término indefinido',
      salario:2000000, eps:'Coosalud', afp:'Colpensiones', arl:'Bolívar', banco:'Bancolombia', cuenta:'8890 3321 44',
      contactoEmg:'Nury Gómez — 301 118 7765', estado:'ACTIVO', interno:false, foto:null },
    { id:'e7', nombre:'Diana Carolina Vergara Solís', doc:'1.047.556.220', tipoDoc:'CC', cargo:'Supervisor',
      nacimiento:'1990-12-03', tel:'318 442 1109', email:'dvergara@grupoamericas.co',
      dir:'Crespo, Cartagena', ingreso:'2022-03-01', contrato:'Término indefinido',
      salario:3200000, eps:'Sura', afp:'Porvenir', arl:'Sura ARL', banco:'Davivienda', cuenta:'1109 5520 33',
      contactoEmg:'Iván Solís — 312 990 4421', estado:'ACTIVO', interno:false, foto:null },
    { id:'e8', nombre:'Nelson Enrique Barrios Pautt', doc:'1.102.334.771', tipoDoc:'CC', cargo:'Mayordomo',
      nacimiento:'1987-07-25', tel:'313 220 5567', email:'nbarrios@grupoamericas.co',
      dir:'Turbaco, Bolívar', ingreso:'2024-06-01', contrato:'Término fijo 1 año',
      salario:2400000, eps:'Famisanar', afp:'Colfondos', arl:'Axa Colpatria', banco:'Nequi', cuenta:'313 220 5567',
      contactoEmg:'Cielo Pautt — 300 445 1120', estado:'ACTIVO', interno:true, foto:null },
    { id:'e9', nombre:'Katherine Julieth Movilla Ariza', doc:'1.052.887.330', tipoDoc:'CC', cargo:'Mucama',
      nacimiento:'1998-02-12', tel:'304 771 2298', email:'kmovilla@grupoamericas.co',
      dir:'Bosque, Cartagena', ingreso:'2025-03-15', contrato:'Término fijo 6 meses',
      salario:1750905, eps:'Mutual Ser', afp:'Porvenir', arl:'Colmena', banco:'Bancolombia', cuenta:'2298 7710 44',
      contactoEmg:'Elena Ariza — 315 220 8890', estado:'ACTIVO', interno:false, foto:null }
  ];

  const propiedades = [
    { id:'p1', nombre:'Villa Marbella', codigo:'VMB-01', tipo:'Casa', ubicacion:'Anillo Vial, Cartagena',
      lat:10.4712, lng:-75.4890, ips:['181.49.22.140'],
      capacidad:12, habitaciones:5, banos:6, estado:'OCUPADA', mayordomo:'e1',
      tarifa:1800000, notas:'Piscina, acceso a playa privada.' },
    { id:'p2', nombre:'Apto Bocagrande 1204', codigo:'BOC-12', tipo:'Apartamento', ubicacion:'Cra 1 #12-45, Bocagrande',
      lat:10.3997, lng:-75.5553, ips:['190.85.14.77'],
      capacidad:6, habitaciones:3, banos:2, estado:'OCUPADA', mayordomo:'e2',
      tarifa:850000, notas:'Vista al mar, piso 12.' },
    { id:'p3', nombre:'Casa Getsemaní', codigo:'GET-03', tipo:'Casa', ubicacion:'Calle del Pozo, Getsemaní',
      lat:10.4203, lng:-75.5449, ips:[],
      capacidad:8, habitaciones:4, banos:4, estado:'LIMPIEZA', mayordomo:'e8',
      tarifa:1200000, notas:'Casa colonial restaurada.' },
    { id:'p4', nombre:'Penthouse Castillogrande', codigo:'CAS-04', tipo:'Apartamento', ubicacion:'Av. Piñango, Castillogrande',
      lat:10.3931, lng:-75.5601, ips:[],
      capacidad:10, habitaciones:4, banos:5, estado:'DISPONIBLE', mayordomo:'e1',
      tarifa:2400000, notas:'Terraza con jacuzzi.' },
    { id:'p5', nombre:'Villa Manzanillo', codigo:'MZN-05', tipo:'Casa', ubicacion:'Manzanillo del Mar',
      lat:10.5321, lng:-75.4612, ips:[],
      capacidad:16, habitaciones:7, banos:7, estado:'MANTENIM', mayordomo:'e8',
      tarifa:2900000, notas:'Cancha, muelle privado. Reparación de bomba.' },
    { id:'p6', nombre:'Apto Manga 502', codigo:'MNG-06', tipo:'Apartamento', ubicacion:'Manga, Cartagena',
      lat:10.4098, lng:-75.5340, ips:[],
      capacidad:4, habitaciones:2, banos:2, estado:'DISPONIBLE', mayordomo:'e2',
      tarifa:520000, notas:'Ideal parejas.' }
  ];

  const reservas = [
    { id:'r1', propiedad:'p1', huesped:'Familia Restrepo', desde:'2026-07-18', hasta:'2026-07-28',
      huespedes:9, canal:'Airbnb', valor:18000000, estado:'EN_CURSO' },
    { id:'r2', propiedad:'p2', huesped:'M. Thompson', desde:'2026-07-21', hasta:'2026-07-26',
      huespedes:4, canal:'Booking', valor:4250000, estado:'EN_CURSO' },
    { id:'r3', propiedad:'p3', huesped:'Grupo Lozano', desde:'2026-07-12', hasta:'2026-07-22',
      huespedes:7, canal:'Airbnb', valor:12000000, estado:'FINALIZADA' },
    { id:'r4', propiedad:'p4', huesped:'Corp. Andina', desde:'2026-07-29', hasta:'2026-08-05',
      huespedes:8, canal:'Directo', valor:16800000, estado:'CONFIRMADA' },
    { id:'r5', propiedad:'p6', huesped:'J. y L. Cárdenas', desde:'2026-08-01', hasta:'2026-08-06',
      huespedes:2, canal:'Airbnb', valor:2600000, estado:'CONFIRMADA' },
    { id:'r6', propiedad:'p1', huesped:'Familia Okonkwo', desde:'2026-08-10', hasta:'2026-08-20',
      huespedes:11, canal:'Airbnb', valor:18000000, estado:'CONFIRMADA' }
  ];

  // ── Turnos y asistencia ──
  // Los patrones se definen como duraciones consecutivas, de modo que los bloques
  // nunca se solapan y el día del trabajador interno suma exactamente 24 h.
  const turnos = [];
  const asistencia = [];

  const E='EFECTIVO', D='DISPONIBLE', A='ALIMENTACION', S='SUENO';

  const patronInterno = { inicio:'06:00', bloques:[
    {t:E,d:180},{t:D,d:150},{t:E,d:150},{t:A,d:60},
    {t:D,d:180},{t:E,d:210},{t:D,d:30},{t:S,d:480} ] };            // = 1440 min
  const patronMucama = { inicio:'07:00', bloques:[
    {t:E,d:300},{t:A,d:60},{t:E,d:180} ] };
  const patronDia = { inicio:'08:00', bloques:[
    {t:E,d:240},{t:A,d:60},{t:E,d:240} ] };

  // Aplica una variación realista SIN alterar la duración total del día:
  // transfiere minutos de un bloque de disponibilidad al bloque efectivo anterior.
  function variar(bloques, interno){
    const b = bloques.map(x=>({...x}));
    if(interno){
      const cand = [];
      for(let i=0;i<b.length-1;i++)
        if(b[i].t===E && b[i+1].t===D && b[i+1].d>=90) cand.push(i);
      if(cand.length && Math.random()<0.45){
        const i = cand[Math.floor(Math.random()*cand.length)];
        const mv = Math.random()<0.5 ? 30 : 60;
        b[i].d += mv; b[i+1].d -= mv;
      }
    } else if(Math.random()<0.3){
      b[b.length-1].d += Math.random()<0.5 ? 30 : 60;   // último bloque: no solapa
    }
    return b;
  }

  const asignacion = {
    e1:{ prop:'p1', patron:patronInterno, interno:true },
    e2:{ prop:'p2', patron:patronInterno, interno:true },
    e8:{ prop:'p3', patron:patronInterno, interno:true },
    e3:{ prop:'p1', patron:patronMucama },
    e4:{ prop:'p2', patron:patronMucama },
    e9:{ prop:'p3', patron:patronMucama },
    e5:{ prop:null, patron:patronDia },
    e6:{ prop:null, patron:patronDia },
    e7:{ prop:null, patron:patronDia }
  };

  const HOY = '2026-07-24';
  for(let i = 29; i >= 0; i--){
    const f = addDias(HOY, -i);
    const dow = new Date(f+'T12:00:00').getDay();
    Object.entries(asignacion).forEach(([eid, a]) => {
      if(!a.interno && dow === 0) return;              // externos descansan domingo
      if(a.interno && (i % 12 === 3 || i % 12 === 4)) return;  // internos: descanso cada 12 días

      turnos.push({ id:uid(), empleado:eid, propiedad:a.prop, fecha:f,
        tipo: a.interno ? 'INTERNO' : 'DIURNO', estado:'CUMPLIDO' });

      let cur = hm2min(a.patron.inicio);
      variar(a.patron.bloques, a.interno).forEach(b => {
        const met = Math.random()<0.6?'QR':(Math.random()<0.5?'PIN':'MANUAL');
        const prp = propiedades.find(p=>p.id===a.prop);
        // Ubicación simulada dentro del radio de la propiedad (±60 m aprox.)
        const jit = () => (Math.random()-0.5)*0.0011;
        asistencia.push({ id:uid(), empleado:eid, propiedad:a.prop, fecha:f,
          tipo:b.t, entrada:min2hm(cur), salida:min2hm(cur+b.d),
          metodo: met, obs:'',
          lat: prp ? +(prp.lat+jit()).toFixed(6) : null,
          lng: prp ? +(prp.lng+jit()).toFixed(6) : null,
          ip:  prp && prp.ips.length ? prp.ips[0] : null,
          validacion: met==='MANUAL' ? 'MANUAL' : 'OK', foto:null });
        cur += b.d;
      });
    });
  }

  // ── Programación de horarios hecha por los supervisores ──
  const turnosT = TURNOS_BASE.map(t=>({...t}));
  const horarios = [];
  const turnoPara = e => e.interno ? 'INT'
    : e.cargo==='Mucama' ? 'MAN'
    : e.cargo==='Supervisor' ? 'DIA'
    : 'DIA';
  const festTodos = [...FESTIVOS_2026, ...FESTIVOS_2027];
  for(let i=29;i>=0;i--){
    const f = addDias(HOY,-i);
    const dow = new Date(f+'T12:00:00').getDay();
    const fest = dow===0 || festTodos.includes(f);
    Object.entries(asignacion).forEach(([eid,a])=>{
      const e = empleados.find(x=>x.id===eid);
      if(!e) return;
      let tur;
      if(a.interno){
        tur = (i%12===3||i%12===4) ? 'DES' : 'INT';       // descansa entre reservas
      }else if(fest){
        tur = Math.random()<0.35 ? turnoPara(e) : 'DES';   // rotación en festivos
      }else{
        tur = turnoPara(e);
      }
      horarios.push({ id:uid(), emp:eid, fecha:f, tur });
    });
  }

  const novedades = [
    { id:'n1', empleado:'e4', tipo:'INCAPACIDAD', desde:'2026-07-08', hasta:'2026-07-10',
      dias:3, motivo:'Incapacidad EPS — cuadro gripal', soporte:'INC-88213', estado:'APROBADA' },
    { id:'n2', empleado:'e5', tipo:'VACACIONES', desde:'2026-08-03', hasta:'2026-08-21',
      dias:15, motivo:'Vacaciones período 2025-2026', soporte:'', estado:'APROBADA' },
    { id:'n3', empleado:'e9', tipo:'PERMISO', desde:'2026-07-15', hasta:'2026-07-15',
      dias:1, motivo:'Cita médica familiar', soporte:'', estado:'APROBADA' },
    { id:'n4', empleado:'e6', tipo:'LLAMADO', desde:'2026-07-11', hasta:'2026-07-11',
      dias:0, motivo:'Retraso reiterado en ingreso a propiedad', soporte:'ACT-0031', estado:'REGISTRADA' },
    { id:'n5', empleado:'e1', tipo:'COMPENSATORIO', desde:'2026-07-27', hasta:'2026-07-29',
      dias:3, motivo:'Compensatorio por reserva Villa Marbella (10 días internos)', soporte:'', estado:'PENDIENTE' },
    { id:'n6', empleado:'e3', tipo:'PERMISO', desde:'2026-07-25', hasta:'2026-07-25',
      dias:1, motivo:'Diligencia bancaria', soporte:'', estado:'PENDIENTE' },
    { id:'n7', empleado:'e2', tipo:'AUSENCIA', desde:'2026-07-05', hasta:'2026-07-05',
      dias:1, motivo:'No se presentó ni reportó novedad', soporte:'', estado:'REGISTRADA' }
  ];

  // ── Estadías: períodos en que un mayordomo permanece alojado en la propiedad ──
  const estadias = [
    { id:'est1', empleado:'e1', propiedad:'p1', reserva:'r1', desde:'2026-07-18', hasta:'2026-07-28',
      estado:'ACTIVA', obs:'Reserva Familia Restrepo · 9 huéspedes' },
    { id:'est2', empleado:'e2', propiedad:'p2', reserva:'r2', desde:'2026-07-21', hasta:'2026-07-26',
      estado:'ACTIVA', obs:'Reserva M. Thompson' },
    { id:'est3', empleado:'e8', propiedad:'p3', reserva:'r3', desde:'2026-07-12', hasta:'2026-07-22',
      estado:'FINALIZADA', obs:'Reserva Grupo Lozano · compensatorio pendiente' },
    { id:'est4', empleado:'e1', propiedad:'p4', reserva:'r4', desde:'2026-07-29', hasta:'2026-08-05',
      estado:'PROGRAMADA', obs:'Reserva Corp. Andina' }
  ];

  const usuarios = [
    { id:'u1', nombre:'PYC Consultoria Integral SAS', email:'pycconsultoriaintegral@gmail.com', rol:'ADMINISTRADOR', estado:'ACTIVO' },
    { id:'u2', nombre:'Diana Vergara', email:'dvergara@grupoamericas.co', rol:'SUPERVISOR', estado:'ACTIVO' },
    { id:'u3', nombre:'Contabilidad', email:'nomina@grupoamericas.co', rol:'NOMINA', estado:'ACTIVO' }
  ];

  const auditoria = [
    { id:'a1', fecha:'2026-07-24 08:12', usuario:'PYC Consultoria Integral SAS', accion:'INICIO_SESION', entidad:'Sistema', detalle:'Acceso al sistema' },
    { id:'a2', fecha:'2026-07-23 17:40', usuario:'Diana Vergara', accion:'APROBAR', entidad:'Novedad n3', detalle:'Permiso aprobado — K. Movilla' },
    { id:'a3', fecha:'2026-07-23 09:05', usuario:'PYC Consultoria Integral SAS', accion:'CREAR', entidad:'Reserva r6', detalle:'Villa Marbella 10-20 ago' }
  ];

  return { cfg, empleados, propiedades, reservas, turnos, turnosT, horarios,
           asistencia, novedades, estadias, usuarios, auditoria,
           festivos:[...FESTIVOS_2026, ...FESTIVOS_2027] };
}

export function loadDB(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const d = JSON.parse(raw); if(d && d.empleados && d.horarios) return d; }
  }catch(e){}
  const d = seedData();
  try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){}
  return d;
}
export function saveDB(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){} }
