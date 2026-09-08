/* ══════════════════════════════════════════════════════════════════════════
   GEOCERCA Y VALIDACIÓN DE MARCACIONES  ·  portado literalmente
   ══════════════════════════════════════════════════════════════════════════ */

/** Distancia en metros entre dos coordenadas (fórmula de Haversine) */
export function distanciaMt(lat1, lon1, lat2, lon2){
  if([lat1,lon1,lat2,lon2].some(v => v==null || isNaN(v))) return null;
  const R = 6371000, rad = x => x*Math.PI/180;
  const dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return Math.round(2*R*Math.asin(Math.sqrt(a)));
}

/**
 * Valida una marcación contra la propiedad.
 * La IP es un dato CORROBORANTE, nunca bloqueante: en producción debe capturarse
 * en el servidor, porque la IP reportada por el cliente es falsificable.
 */
export function validarMarcacion({lat, lng, precision, codigo, ip, foto}, propiedad, cfg){
  const r = { estado:'OK', distancia:null, avisos:[], bloqueante:false };
  if(!propiedad){ r.estado='MANUAL'; return r; }

  // 1. Código de propiedad (proviene del QR fijo o se digita)
  //
  // Se distingue entre NO dar código y dar uno EQUIVOCADO, que son cosas muy
  // distintas. Antes las dos bloqueaban por igual, y como quien abre la app
  // directo (sin escanear el QR) no lleva código, el trabajador se quedaba sin
  // poder marcar aunque el GPS lo situara dentro de la propiedad y la IP
  // coincidiera con la registrada. Perder el registro de una jornada real es
  // peor que registrarla señalada para revisión.
  //   · código equivocado  → bloquea (o está en otra propiedad, o lo digitó mal)
  //   · sin código         → no bloquea; se evalúa la geocerca y queda marcada
  let faltaCodigo = false;
  if(cfg.exigirCodigo && propiedad.codigo){
    if(codigo){
      if(codigo.trim().toUpperCase() !== propiedad.codigo){
        r.estado='CODIGO_MAL'; r.bloqueante=true;
        r.avisos.push(`El código "${codigo}" no corresponde a ${propiedad.nombre}.`); return r; }
    } else faltaCodigo = true;   // se resuelve abajo, ya con la geocerca evaluada
  }

  // 2. Geocerca (control primario)
  if(lat!=null && lng!=null && propiedad.lat!=null){
    r.distancia = distanciaMt(lat, lng, propiedad.lat, propiedad.lng);
    // El navegador reporta el margen de error de la lectura en `precision`
    // (metros). En un celular bajo techo o de gama baja ese margen llega a
    // cientos o miles de metros y la posición "exacta" no sirve para un radio
    // de ~150 m: antes esto bloqueaba a trabajadores que SÍ estaban en el sitio
    // y no podían marcar desde su teléfono. Ahora:
    //   · si la distancia, descontado el margen de error, cabe en el radio → OK
    //   · si el margen de error supera al propio radio, la lectura no permite
    //     decidir → se registra para revisión, nunca se bloquea
    //   · solo se bloquea cuando hay una lectura razonablemente precisa que
    //     de verdad cae fuera del radio
    const margen = Number.isFinite(precision) ? Math.max(0, precision) : 0;
    if(margen > cfg.radioGeocerca){
      // La lectura es demasiado imprecisa para juzgar la geocerca. Si aun así
      // la distancia estimada cae dentro del radio se deja pasar como OK; si
      // cae fuera, no se bloquea: se registra y queda para revisión.
      if(r.distancia > cfg.radioGeocerca){
        r.estado = 'GPS_IMPRECISO';
        r.avisos.push(`Ubicación con precisión de ±${margen} m: no permite confirmar la geocerca `
          + `(distancia estimada ${r.distancia} m de ${propiedad.nombre}). Se registra y queda marcada para revisión.`);
      }
    } else if(r.distancia - margen > cfg.radioGeocerca){
      // Lectura razonablemente precisa que de verdad cae fuera del radio.
      r.estado = 'FUERA_ZONA'; r.bloqueante = true;
      r.avisos.push(`Marcación a ${r.distancia} m de ${propiedad.nombre} `
        + `(±${margen} m de precisión · radio permitido: ${cfg.radioGeocerca} m).`);
    }
  } else if(cfg.exigirGPS){
    r.estado='SIN_GPS';
    r.avisos.push('No se obtuvo la ubicación del dispositivo. Se registra, pero queda marcada para revisión.');
  }

  // 2-bis. Falta de código: nunca bloquea, pero deja la marcación señalada.
  // Si la geocerca ya confirmó que está en el sitio, el QR era el segundo
  // factor y su ausencia es una observación, no un motivo para no registrar.
  if(faltaCodigo){
    if(r.estado === 'OK') r.estado = 'SIN_CODIGO';
    r.avisos.push('No se escaneó el QR de la propiedad ni se digitó su código. '
      + 'Se registra y queda marcada para revisión.');
  }

  // 3. IP: SOLO informativa. No bloquea y tampoco cambia el estado.
  //
  // Antes ponía estado='IP_DISTINTA', y como el listado de inconsistencias
  // muestra todo lo que no sea OK/MANUAL, cada marcación hecha desde el celular
  // con datos móviles entraba ahí: la IP que ve el navegador es la del operador
  // (CGNAT), nunca la del internet de la propiedad, así que NUNCA coincidía.
  // El resultado era un listado de inconsistencias lleno de marcaciones
  // perfectamente válidas. La IP queda como nota de contexto y nada más.
  if(ip && propiedad.ips && propiedad.ips.length && !propiedad.ips.includes(ip)){
    r.ipDistinta = true;
    r.avisos.push(`La IP ${ip} no está entre las registradas para la propiedad. `
      + 'Es normal si marca con datos móviles (CGNAT del operador) o si el internet '
      + 'de la propiedad tiene IP dinámica. Es solo un dato de contexto: no invalida la marcación.');
  }

  // 4. Foto
  if(cfg.exigirFoto && !foto) r.avisos.push('No se capturó fotografía de respaldo.');

  return r;
}
