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

import { iconoProducto, imagenPorDefectoProducto } from '../src/domain/iconos.js';

test('iconoProducto prioriza icono propio, luego nombre y luego categoría', () => {
  assert.equal(iconoProducto({ nombre: 'Leche entera 1 L', icono: '🐄' }, '🥛'), '🐄');
  assert.equal(iconoProducto({ nombre: 'Tomate chonto' }, '🍎'), '🍅');
  assert.equal(iconoProducto({ nombre: 'Aguacate Hass' }, '🍎'), '🥑');
  assert.equal(iconoProducto({ nombre: 'Queso campesino 500 g' }, '🥛'), '🧀');
  assert.equal(iconoProducto({ nombre: 'Croissant x6' }, '🍞'), '🥐');
  assert.equal(iconoProducto({ nombre: 'Jabón en barra' }, '🧼'), '🧼');
  assert.equal(iconoProducto({ nombre: 'Producto desconocido' }, '🌾'), '🌾');
  assert.equal(iconoProducto({ nombre: 'Producto desconocido' }), '🛒');
});

test('iconoProducto no confunde palabras (fresa≠res, chocolate≠cola, crema dental≠crema)', () => {
  const casos = {
    'Yogur de fresa 1 L': '🍓', 'Lenteja 500 g': '🥘', 'Azúcar 1 kg': '🥄', 'Desodorante 150 ml': '💨',
    'vinagre 1L': '🥗', 'Crema dental 100 ml': '🪥', 'Chocolate de mesa': '🍫', 'Papaya': '🥭',
    'Pepsi 5L': '🥤', 'Atún en lata 170 g': '🐟', 'Arroz 500 g': '🍚', 'Limón Tahití': '🍋‍🟩',
    'Leche de almendras 1 L': '🌰', 'Pan tajado de mantequilla 600kg': '🍞', 'Cerveza lager six pack': '🍺',
    'Té frío limón 1.5 L': '🧋', 'Agua 6 L': '🚰', 'Agua 600 ml': '💧', 'Panela x2': '🍯', 'Lavaloza líquido 500 ml': '🫧',
  };
  for (const [nombre, emoji] of Object.entries(casos)) {
    assert.equal(iconoProducto({ nombre }, '🛒'), emoji, nombre);
  }
});

test('imagenPorDefectoProducto asigna la imagen ilustrada a los productos del catálogo', () => {
  const esperados = {
    'Yogur griego natural 500 g': './productos/yogur-griego.png',
    'Panela x2': './productos/panela.png',
    'Pasta spaghetti 500 g': './productos/pasta.png',
    'Azúcar 1 kg': './productos/azucar.png',
    'Café molido 250 g': './productos/cafe.png',
    'Lenteja 500 g': './productos/lenteja.png',
    'Detergente en polvo 1 kg': './productos/detergente.png',
    'vinagre 1L': './productos/vinagre.png',
    'Cloro 1 L': './productos/cloro.png',
    'Desodorante 150 ml': './productos/desodorante.png',
    'Aguacate Hass': './productos/aguacate.png',
    'Plátano verde': './productos/platano-verde.png',
    'Banano': './productos/banano.png',
    'Huevos AA x30': './productos/huevos.png',
    'Queso campesino 500 g': './productos/queso-campesino.png',
    'Queso mozzarella 400 g': './productos/queso-mozzarella.png',
    'Arroz 5 kg': './productos/arroz-5kg.png',
    'Arroz 500 g': './productos/arroz-500g.png',
    'Agua 6 L': './productos/agua-6l.png',
    'Agua 600 ml': './productos/agua-600ml.png',
    'Pan tajado 600 g': './productos/pan-tajado.png',
    'Pan integral 500 g': './productos/pan-integral.png',
  };
  for (const [nombre, ruta] of Object.entries(esperados)) {
    assert.equal(imagenPorDefectoProducto({ nombre }), ruta, nombre);
  }
  assert.equal(imagenPorDefectoProducto({ nombre: 'Jabón en barra' }), null);
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

import {
  calcularLineaIVA,
  calcularResumenIVA,
  ivaPorDefectoCategoria,
  obtenerIvaProducto,
} from '../src/domain/iva.js';

test('obtenerIvaProducto asigna tarifas 0%, 5% y 19% según normativa colombiana', () => {
  // 0%: Frutas y verduras, huevos, leches simples, arroz, panela, sal, frijol, lenteja, arepas, pan tradicional, agua pura
  const exentos0 = [
    { nombre: 'Aguacate Hass', categoriaId: 'frutas' },
    { nombre: 'Banano', categoriaId: 'frutas' },
    { nombre: 'Tomate chonto', categoriaId: 'frutas' },
    { nombre: 'Naranja tangelo', categoriaId: 'frutas' },
    { nombre: 'Huevos AA x30', categoriaId: 'lacteos' },
    { nombre: 'Leche entera 1 L', categoriaId: 'lacteos' },
    { nombre: 'Leche deslactosada 1 L', categoriaId: 'lacteos' },
    { nombre: 'Arroz 500 g', categoriaId: 'granos' },
    { nombre: 'Arroz 5 kg', categoriaId: 'granos' },
    { nombre: 'Panela x2', categoriaId: 'granos' },
    { nombre: 'Sal 1 kg', categoriaId: 'granos' },
    { nombre: 'Frijol cargamanto 500 g', categoriaId: 'granos' },
    { nombre: 'Lenteja 500 g', categoriaId: 'granos' },
    { nombre: 'Arepas de maíz x10', categoriaId: 'panaderia' },
    { nombre: 'Pan tajado 600 g', categoriaId: 'panaderia' },
    { nombre: 'Pan integral 500 g', categoriaId: 'panaderia' },
    { nombre: 'Agua 600 ml', categoriaId: 'bebidas' },
    { nombre: 'Agua 6 L', categoriaId: 'bebidas' },
  ];
  for (const p of exentos0) {
    assert.equal(obtenerIvaProducto(p), 0, `Esperaba 0% para ${p.nombre}`);
  }

  // 5%: Azúcar, café molido, pasta spaghetti, harina de trigo
  const reducido5 = [
    { nombre: 'Azúcar 1 kg', categoriaId: 'granos' },
    { nombre: 'Café molido 250 g', categoriaId: 'granos' },
    { nombre: 'Pasta spaghetti 500 g', categoriaId: 'granos' },
    { nombre: 'Harina de trigo 1 kg', categoriaId: 'granos' },
  ];
  for (const p of reducido5) {
    assert.equal(obtenerIvaProducto(p), 5, `Esperaba 5% para ${p.nombre}`);
  }

  // 19%: Todo Aseo, bebidas procesadas/gaseosas, ultraprocesados, atún en lata, yogures procesados
  const general19 = [
    { nombre: 'Detergente en polvo 1 kg', categoriaId: 'aseo' },
    { nombre: 'Cloro 1 L', categoriaId: 'aseo' },
    { nombre: 'Desodorante 150 ml', categoriaId: 'aseo' },
    { nombre: 'Champú 400 ml', categoriaId: 'aseo' },
    { nombre: 'Jabón en barra', categoriaId: 'aseo' },
    { nombre: 'Lavaloza líquido 500 ml', categoriaId: 'aseo' },
    { nombre: 'Suavizante 1 L', categoriaId: 'aseo' },
    { nombre: 'vinagre 1L', categoriaId: 'granos' },
    { nombre: 'Gaseosa cola 1.5 L', categoriaId: 'bebidas' },
    { nombre: 'Gaseosa naranja 1.5 L', categoriaId: 'bebidas' },
    { nombre: 'Bebida energizante 473 ml', categoriaId: 'bebidas' },
    { nombre: 'Té frío limón 1.5 L', categoriaId: 'bebidas' },
    { nombre: 'Cerveza lager six pack', categoriaId: 'bebidas' },
    { nombre: 'Leche de almendras 1 L', categoriaId: 'bebidas' },
    { nombre: 'Galletas de soda x6', categoriaId: 'panaderia' },
    { nombre: 'Ponqué tajado', categoriaId: 'panaderia' },
    { nombre: 'Croissant x6', categoriaId: 'panaderia' },
    { nombre: 'Atún en lata 170 g', categoriaId: 'granos' },
    { nombre: 'Yogur de fresa 1 L', categoriaId: 'lacteos' },
    { nombre: 'Yogur griego natural 500 g', categoriaId: 'lacteos' },
  ];
  for (const p of general19) {
    assert.equal(obtenerIvaProducto(p), 19, `Esperaba 19% para ${p.nombre}`);
  }
});

test('ivaPorDefectoCategoria preselecciona 0% en Frutas y verduras y 19% en Aseo', () => {
  assert.equal(ivaPorDefectoCategoria('frutas', 'Frutas y verduras'), 0);
  assert.equal(ivaPorDefectoCategoria('aseo', 'Aseo'), 19);
});

test('calcularResumenIVA y planFactura desglosan base gravable, IVA 5%, IVA 19% y total final', () => {
  const prod0 = { id: 'arroz', nombre: 'Arroz 500 g', unidad: 'und', categoriaId: 'granos', precioVenta: 3000, stock: 20, stockMinimo: 5, iva: 0, activo: true };
  const prod5 = { id: 'cafe', nombre: 'Café molido 250 g', unidad: 'und', categoriaId: 'granos', precioVenta: 10500, stock: 20, stockMinimo: 5, iva: 5, activo: true };
  const prod19 = { id: 'det', nombre: 'Detergente 1 kg', unidad: 'und', categoriaId: 'aseo', precioVenta: 11900, stock: 20, stockMinimo: 5, iva: 19, activo: true };

  const { factura } = planFactura({
    productos: [prod0, prod5, prod19],
    items: [
      { productoId: 'arroz', cantidad: 1 }, // 3000 -> base 3000, IVA 0
      { productoId: 'cafe', cantidad: 1 },  // 10500 -> base 10000, IVA 5% = 500
      { productoId: 'det', cantidad: 1 },   // 11900 -> base 10000, IVA 19% = 1900
    ],
    usuario: { id: 'caja', nombre: 'Ana Ríos' },
    consecutivo: 10,
    ahora: 5000,
  });

  assert.equal(factura.subtotalSinIva, 23000);
  assert.equal(factura.iva5, 500);
  assert.equal(factura.iva19, 1900);
  assert.equal(factura.totalIva, 2400);
  assert.equal(factura.total, 25400);
  assert.equal(factura.subtotalSinIva + factura.iva5 + factura.iva19, factura.total);
});
