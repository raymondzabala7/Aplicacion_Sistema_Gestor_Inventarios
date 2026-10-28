import assert from 'node:assert/strict';
import test from 'node:test';
import { planAjuste, planFactura } from '../src/domain/inventory.js';

const product = {
  id: 'leche-1l',
  nombre: 'Leche entera 1 L',
  unidad: 'und',
  categoriaId: 'lacteos',
  precioVenta: 4900,
  stock: 5,
  stockMinimo: 2,
  activo: true,
};

test('planFactura calcula el total y el cambio de stock sin mutar el producto', () => {
  const result = planFactura({
    productos: [product],
    items: [{ productoId: product.id, cantidad: 2 }],
    usuario: { id: 'caja', nombre: 'Ana Ríos' },
    consecutivo: 1,
    ahora: 1000,
  });

  assert.equal(result.factura.total, 9800);
  assert.equal(result.factura.numero, 'FV-000001');
  assert.equal(result.cambios[0].despues, 3);
  assert.equal(product.stock, 5);
});

test('planFactura rechaza una venta que excede el stock', () => {
  assert.throws(() => planFactura({
    productos: [product],
    items: [{ productoId: product.id, cantidad: 6 }],
    usuario: { id: 'caja', nombre: 'Ana Ríos' },
    consecutivo: 1,
    ahora: 1000,
  }), /Sin stock suficiente/);
});

test('planAjuste rechaza dejar el stock en negativo', () => {
  assert.throws(() => planAjuste({
    producto: product,
    cantidad: -6,
    motivo: 'Conteo físico',
  }), /No se pueden restar/);
});
