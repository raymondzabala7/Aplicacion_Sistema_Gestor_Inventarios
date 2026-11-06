import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluarAlerta,
  generarCSV,
  generarExcelXLSX,
  planAjuste,
  planAnulacion,
  planEntrega,
  planFactura,
  validarCantidad,
} from '../src/domain/inventory.js';

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

const tomateKg = {
  id: 'tomate-chonto',
  nombre: 'Tomate Chonto',
  unidad: 'kg',
  categoriaId: 'frutas-verduras',
  precioVenta: 3500,
  stock: 10.5,
  stockMinimo: 3,
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
  assert.equal(result.factura.metodoPago, 'efectivo');
  assert.equal(result.factura.cliente.nombre, 'Consumidor Final');
  assert.equal(result.cambios[0].despues, 3);
  assert.equal(product.stock, 5);
});

test('planFactura gestiona métodos de pago, cálculo de cambio y datos de cliente', () => {
  const result = planFactura({
    productos: [product],
    items: [{ productoId: product.id, cantidad: 2 }],
    usuario: { id: 'caja', nombre: 'Ana Ríos' },
    consecutivo: 5,
    ahora: 2000,
    metodoPago: 'efectivo',
    pagaCon: 10000,
    cliente: { nombre: 'Carlos Gomez', documento: '1098765432' },
  });

  assert.equal(result.factura.total, 9800);
  assert.equal(result.factura.pagaCon, 10000);
  assert.equal(result.factura.cambio, 200);
  assert.equal(result.factura.cliente.nombre, 'Carlos Gomez');
  assert.equal(result.factura.cliente.documento, '1098765432');
});

test('planFactura rechaza pago en efectivo si el dinero recibido es menor al total', () => {
  assert.throws(() => planFactura({
    productos: [product],
    items: [{ productoId: product.id, cantidad: 2 }],
    usuario: { id: 'caja', nombre: 'Ana Ríos' },
    consecutivo: 1,
    ahora: 1000,
    metodoPago: 'efectivo',
    pagaCon: 5000,
  }), /no puede ser menor al total/);
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

test('planEntrega suma stock correctamente y calcula totales', () => {
  const proveedor = { id: 'colanta', nombre: 'Lácteos Colanta' };
  const items = [
    { productoId: product.id, cantidad: 10, costoUnit: 3500, lote: 'L-2026', vence: '2026-12-01' },
  ];
  const res = planEntrega({
    proveedor,
    productos: [product],
    items,
    usuario: { nombre: 'Pedro Bodega' },
    ahora: 1500,
  });

  assert.equal(res.entrega.totalUnidades, 10);
  assert.equal(res.entrega.totalCosto, 35000);
  assert.equal(res.cambios[0].despues, 15);
  assert.equal(res.cambios[0].cantidad, 10);
});

test('planEntrega rechaza productos duplicados en la misma recepción', () => {
  const proveedor = { id: 'colanta', nombre: 'Lácteos Colanta' };
  const items = [
    { productoId: product.id, cantidad: 5, costoUnit: 3500 },
    { productoId: product.id, cantidad: 3, costoUnit: 3500 },
  ];
  assert.throws(() => planEntrega({
    proveedor,
    productos: [product, product],
    items,
    usuario: { nombre: 'Pedro Bodega' },
    ahora: 1500,
  }), /está repetido/);
});

test('planAnulacion devuelve el stock de los productos y valida estado previo', () => {
  const factura = {
    numero: 'FV-000002',
    estado: 'pagada',
    items: [{ productoId: product.id, nombre: product.nombre, cantidad: 2 }],
  };
  const cambios = planAnulacion({ factura, productos: [product] });
  assert.equal(cambios[0].despues, 7);
  assert.equal(cambios[0].cantidad, 2);

  assert.throws(() => planAnulacion({
    factura: { ...factura, estado: 'anulada' },
    productos: [product],
  }), /ya estaba anulada/);
});

test('planAjuste rechaza dejar el stock en negativo', () => {
  assert.throws(() => planAjuste({
    producto: product,
    cantidad: -6,
    motivo: 'Conteo físico',
  }), /No se pueden restar/);
});

test('planAjuste permite sumar y restar stock con motivo', () => {
  const ajPos = planAjuste({ producto: product, cantidad: 3, motivo: 'Conteo físico' });
  assert.equal(ajPos.despues, 8);

  const ajNeg = planAjuste({ producto: product, cantidad: -2, motivo: 'Merma' });
  assert.equal(ajNeg.despues, 3);
});

test('validarCantidad respeta unidades enteras y fracciones de peso', () => {
  assert.doesNotThrow(() => validarCantidad(3, product));
  assert.throws(() => validarCantidad(2.5, product), /unidades enteras/);

  assert.doesNotThrow(() => validarCantidad(1.5, tomateKg));
  assert.throws(() => validarCantidad(0, tomateKg), /mayor que cero/);
});

test('evaluarAlerta genera alertas de stock bajo y agotado y resuelve automáticamente', () => {
  // Stock bajo
  const alertaBaja = evaluarAlerta(product, 2, null, 100);
  assert.equal(alertaBaja.tipo, 'stock_bajo');
  assert.equal(alertaBaja.atendida, false);

  // Agotado
  const alertaAgotado = evaluarAlerta(product, 0, alertaBaja, 200);
  assert.equal(alertaAgotado.tipo, 'agotado');

  // Resolución al subir stock
  const alertaResuelta = evaluarAlerta(product, 5, alertaAgotado, 300);
  assert.equal(alertaResuelta.atendida, true);
  assert.equal(alertaResuelta.resuelta, 'auto');
});

test('generarCSV genera archivo con UTF-8 BOM, separador punto y coma y escapa caracteres especiales', () => {
  const headers = ['Código', 'Nombre', 'Descripción'];
  const rows = [
    ['7701', 'Arroz "Diana"', 'Bolsa de arroz, 1 kg'],
  ];
  const csv = generarCSV(headers, rows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Código;Nombre;Descripción'));
  assert.ok(csv.includes('"Arroz ""Diana"""'));
  assert.ok(csv.includes('"Bolsa de arroz, 1 kg"'));
});

test('generarExcelXLSX construye un archivo .xlsx válido con las 10 columnas de inventario', () => {
  const encabezados = [
    'Código de Barras',
    'Producto',
    'Categoría',
    'Unidad',
    'Costo Unitario',
    'Precio Venta',
    'Stock Actual',
    'Stock Mínimo',
    'Valor Total Stock',
    'Estado',
  ];
  const filas = [
    ['7702001012345', 'Leche entera 1 L', 'Lácteos', 'und', 3500, 4900, 12, 4, 42000, 'Disponible'],
    ['7702001099999', 'Tomate Chonto', 'Frutas y verduras', 'kg', 2100, 3500, 2, 5, 4200, 'Bajo'],
  ];
  const bytes = generarExcelXLSX(encabezados, filas, {
    hoja: 'Inventario',
    totales: ['TOTAL', '2 productos', '', '', '', '', 14, '', 46200, ''],
  });

  // Verifica firma ZIP (PK\x03\x04) de archivo OpenXML (.xlsx)
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  const texto = new TextDecoder().decode(bytes);
  assert.ok(texto.includes('TablaFrescoStock'));
  assert.ok(texto.includes('Código de Barras'));
  assert.ok(texto.includes('Valor Total Stock'));
  assert.ok(texto.includes('Leche entera 1 L'));
});
