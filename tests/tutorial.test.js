import assert from 'node:assert/strict';
import test from 'node:test';
import { PASOS, pasosPara, textoParaVoz } from '../src/ui/tutorial.js';

// Pantallas a las que entra cada rol (mismo reparto que RUTAS en src/app.js).
const ACCESO = {
  admin: ['inicio', 'caja', 'recepcion', 'productos', 'proveedores', 'alertas', 'historial', 'usuarios'],
  bodega: ['inicio', 'recepcion', 'productos', 'proveedores', 'alertas', 'historial'],
  cajero: ['inicio', 'caja', 'productos', 'alertas'],
};

test('cada rol solo ve pasos de pantallas a las que tiene acceso', () => {
  for (const [rol, rutas] of Object.entries(ACCESO)) {
    for (const paso of pasosPara(rol)) {
      if (paso.ruta) assert.ok(rutas.includes(paso.ruta), `${rol} no debería ver el paso ${paso.id} (${paso.ruta})`);
    }
  }
});

test('el administrador recorre todas las pantallas del sistema', () => {
  const vistas = new Set(pasosPara('admin').map(p => p.ruta).filter(Boolean));
  for (const ruta of ACCESO.admin) assert.ok(vistas.has(ruta), `falta un paso de ${ruta} para el admin`);
});

test('cajero y bodega reciben su propio recorrido', () => {
  const cajero = pasosPara('cajero').map(p => p.id);
  const bodega = pasosPara('bodega').map(p => p.id);
  assert.ok(cajero.includes('caja-cobrar') && !cajero.includes('recepcion') && !cajero.includes('usuarios'));
  assert.ok(bodega.includes('recepcion') && !bodega.includes('caja-cobrar') && !bodega.includes('usuarios'));
  assert.ok(pasosPara('admin').length > bodega.length && pasosPara('admin').length > cajero.length);
});

test('todo paso tiene texto para cada rol que lo ve, y empieza y termina igual', () => {
  for (const paso of PASOS) {
    for (const rol of paso.roles) {
      const texto = typeof paso.texto === 'string' ? paso.texto : paso.texto[rol];
      assert.ok(texto && texto.length > 20, `el paso ${paso.id} no tiene texto para ${rol}`);
    }
  }
  for (const rol of Object.keys(ACCESO)) {
    const pasos = pasosPara(rol);
    assert.equal(pasos[0].id, 'bienvenida');
    assert.equal(pasos.at(-1).id, 'final');
  }
});

test('la voz no lee emojis', () => {
  assert.equal(textoParaVoz({ titulo: '¡Hola! Soy Tomi 🍅', texto: 'Listo ✨' }), '¡Hola! Soy Tomi. Listo');
});
