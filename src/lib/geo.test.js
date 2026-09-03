import { describe, it, expect } from 'vitest';
import { CONFIG_DEFAULT } from './constants.js';
import { distanciaMt, validarMarcacion } from './geo.js';

const cfg = CONFIG_DEFAULT;

describe('distanciaMt', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaMt(10.4712, -75.4890, 10.4712, -75.4890)).toBe(0);
  });

  it('aproxima ~111.3 km por grado de longitud en el ecuador', () => {
    const d = distanciaMt(0, 0, 0, 1);
    expect(Math.abs(d - 111320)).toBeLessThan(200);
  });

  it('devuelve null si falta alguna coordenada', () => {
    expect(distanciaMt(null, -75.4890, 10.4712, -75.4890)).toBeNull();
  });
});

describe('validarMarcacion', () => {
  const propiedad = { nombre:'Villa Marbella', codigo:'VMB-01', lat:10.4712, lng:-75.4890, ips:['181.49.22.140'] };

  it('valida OK cuando el código y la ubicación coinciden', () => {
    const r = validarMarcacion({ lat:10.4712, lng:-75.4890, codigo:'VMB-01', ip:null, foto:null }, propiedad, cfg);
    expect(r.estado).toBe('OK');
    expect(r.bloqueante).toBe(false);
    expect(r.distancia).toBe(0);
  });

  it('bloquea con código incorrecto', () => {
    const r = validarMarcacion({ lat:10.4712, lng:-75.4890, codigo:'WRONG', ip:null, foto:null }, propiedad, cfg);
    expect(r.estado).toBe('CODIGO_MAL');
    expect(r.bloqueante).toBe(true);
  });

  it('bloquea cuando la ubicación está fuera del radio de geocerca', () => {
    const r = validarMarcacion({ lat:10.60, lng:-75.60, codigo:'VMB-01', ip:null, foto:null }, propiedad, cfg);
    expect(r.estado).toBe('FUERA_ZONA');
    expect(r.bloqueante).toBe(true);
    expect(r.distancia).toBeGreaterThan(cfg.radioGeocerca);
  });

  it('nunca bloquea por una IP distinta a la registrada, solo advierte', () => {
    const r = validarMarcacion({ lat:10.4712, lng:-75.4890, codigo:'VMB-01', ip:'9.9.9.9', foto:null }, propiedad, cfg);
    expect(r.estado).toBe('IP_DISTINTA');
    expect(r.bloqueante).toBe(false);
  });

  it('devuelve MANUAL cuando no hay propiedad asociada', () => {
    const r = validarMarcacion({ lat:null, lng:null, codigo:'', ip:null, foto:null }, null, cfg);
    expect(r.estado).toBe('MANUAL');
  });

  it('NO bloquea si la distancia entra en el radio al descontar el margen de error del GPS', () => {
    // ~122 m del punto exacto, pero el GPS reporta ±100 m: 122 - 100 <= 150
    const r = validarMarcacion(
      { lat:10.47230, lng:-75.4890, precision:100, codigo:'VMB-01', ip:null, foto:null }, propiedad, cfg);
    expect(r.bloqueante).toBe(false);
    expect(r.estado).toBe('OK');
  });

  it('marca GPS_IMPRECISO (sin bloquear) cuando el margen de error supera el radio', () => {
    const r = validarMarcacion(
      { lat:10.60, lng:-75.60, precision:20000, codigo:'VMB-01', ip:null, foto:null }, propiedad, cfg);
    expect(r.estado).toBe('GPS_IMPRECISO');
    expect(r.bloqueante).toBe(false);
    expect(r.distancia).toBeGreaterThan(cfg.radioGeocerca);
  });

  it('sigue bloqueando cuando hay una lectura precisa que cae fuera del radio', () => {
    // ~300 m de distancia con ±30 m de precisión: 300 - 30 > 150
    const r = validarMarcacion(
      { lat:10.47390, lng:-75.4890, precision:30, codigo:'VMB-01', ip:null, foto:null }, propiedad, cfg);
    expect(r.estado).toBe('FUERA_ZONA');
    expect(r.bloqueante).toBe(true);
  });
});
