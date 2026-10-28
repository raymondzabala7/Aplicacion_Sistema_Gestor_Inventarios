// Reglas de negocio puras: no saben si los datos vienen de localStorage o de Firestore.
// Cada operación devuelve "cambios" de stock que la capa de datos aplica en bloque.

export const r3 = x => Math.round(x * 1000) / 1000;

export function fmtCant(cantidad, unidad) {
  const n = Number(cantidad).toLocaleString('es-CO', { maximumFractionDigits: 3 });
  return `${n} ${unidad}`;
}

export function validarCantidad(cantidad, producto) {
  if (!(cantidad > 0)) throw new Error(`La cantidad de ${producto.nombre} debe ser mayor que cero.`);
  if (producto.unidad === 'und' && !Number.isInteger(cantidad)) {
    throw new Error(`${producto.nombre} se vende por unidades enteras.`);
  }
}

export function numeroFactura(consecutivo) {
  return 'FV-' + String(consecutivo).padStart(6, '0');
}

// Venta: valida stock y arma la factura. `productos` va alineado con `items`.
export function planFactura({ productos, items, usuario, consecutivo, ahora }) {
  if (!items.length) throw new Error('Agrega al menos un producto a la venta.');
  items.forEach((it, n) => {
    const p = productos[n];
    if (!p || p.activo === false) throw new Error('Uno de los productos ya no está disponible.');
    validarCantidad(it.cantidad, p);
    if (p.stock < it.cantidad) {
      throw new Error(`Sin stock suficiente de ${p.nombre}: quedan ${fmtCant(p.stock, p.unidad)}.`);
    }
  });
  const lineas = items.map((it, n) => ({
    productoId: productos[n].id, nombre: productos[n].nombre, unidad: productos[n].unidad,
    categoriaId: productos[n].categoriaId, cantidad: it.cantidad, precio: productos[n].precioVenta,
  }));
  const factura = {
    numero: numeroFactura(consecutivo), cajeroId: usuario.id, cajeroNombre: usuario.nombre, fecha: ahora,
    items: lineas, total: lineas.reduce((t, l) => t + Math.round(l.cantidad * l.precio), 0), estado: 'pagada',
  };
  const cambios = items.map((it, n) => ({ producto: productos[n], antes: productos[n].stock, despues: r3(productos[n].stock - it.cantidad), cantidad: -it.cantidad }));
  return { factura, cambios };
}

// Entrega de proveedor: suma stock.
export function planEntrega({ proveedor, productos, items, usuario, ahora }) {
  if (!proveedor) throw new Error('Elige el proveedor que hizo la entrega.');
  if (!items.length) throw new Error('Agrega al menos un producto recibido.');
  const vistos = new Set();
  items.forEach((it, n) => {
    const p = productos[n];
    if (!p) throw new Error('Elige un producto en cada fila.');
    if (vistos.has(p.id)) throw new Error(`${p.nombre} está repetido. Junta las cantidades en una sola fila.`);
    vistos.add(p.id);
    validarCantidad(it.cantidad, p);
    if (!(it.costoUnit >= 0)) throw new Error(`Revisa el costo de ${p.nombre}.`);
  });
  const lineas = items.map((it, n) => ({
    productoId: productos[n].id, nombre: productos[n].nombre, unidad: productos[n].unidad,
    cantidad: it.cantidad, costoUnit: it.costoUnit, lote: it.lote || '', vence: it.vence || '',
  }));
  const entrega = {
    proveedorId: proveedor.id, proveedorNombre: proveedor.nombre, fecha: ahora, recibidoPor: usuario.nombre,
    items: lineas,
    totalUnidades: r3(lineas.reduce((t, l) => t + l.cantidad, 0)),
    totalCosto: Math.round(lineas.reduce((t, l) => t + l.cantidad * l.costoUnit, 0)),
  };
  const cambios = items.map((it, n) => ({ producto: productos[n], antes: productos[n].stock, despues: r3(productos[n].stock + it.cantidad), cantidad: it.cantidad }));
  return { entrega, cambios };
}

// Anular factura: devuelve el stock.
export function planAnulacion({ factura, productos }) {
  if (factura.estado === 'anulada') throw new Error(`La factura ${factura.numero} ya estaba anulada.`);
  return factura.items.map((l, n) => {
    const p = productos[n];
    if (!p) throw new Error(`El producto ${l.nombre} ya no existe; no se puede devolver su stock.`);
    return { producto: p, antes: p.stock, despues: r3(p.stock + l.cantidad), cantidad: l.cantidad };
  });
}

// Ajuste manual (merma, daño, conteo físico).
export function planAjuste({ producto, cantidad, motivo }) {
  if (!cantidad) throw new Error('Escribe cuánto sumar o restar.');
  if (!motivo || !motivo.trim()) throw new Error('El motivo del ajuste es obligatorio.');
  const despues = r3(producto.stock + cantidad);
  if (despues < 0) throw new Error(`No se pueden restar ${fmtCant(-cantidad, producto.unidad)}: solo hay ${fmtCant(producto.stock, producto.unidad)}.`);
  return { producto, antes: producto.stock, despues, cantidad };
}

export function movimientoDe(cambio, tipo, origen, usuario, ahora, motivo) {
  return {
    tipo, productoId: cambio.producto.id, productoNombre: cambio.producto.nombre, unidad: cambio.producto.unidad,
    cantidad: cambio.cantidad, stockAntes: cambio.antes, stockDespues: cambio.despues, origen,
    usuarioNombre: usuario.nombre, fecha: ahora, ...(motivo ? { motivo } : {}),
  };
}

// Una alerta activa por producto (id de la alerta = id del producto).
export function evaluarAlerta(producto, stock, actual, ahora) {
  const bajo = stock <= producto.stockMinimo;
  if (bajo) {
    const tipo = stock <= 0 ? 'agotado' : 'stock_bajo';
    if (!actual || actual.atendida) {
      return { productoId: producto.id, productoNombre: producto.nombre, tipo, stock, stockMinimo: producto.stockMinimo, fecha: ahora, atendida: false };
    }
    return { ...actual, tipo, stock, stockMinimo: producto.stockMinimo };
  }
  if (actual && !actual.atendida) {
    return { ...actual, stock, atendida: true, resuelta: 'auto', fechaAtendida: ahora };
  }
  return null;
}
