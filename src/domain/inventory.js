// Reglas de negocio puras: no saben si los datos vienen de localStorage o de Firestore.
// Cada operación devuelve "cambios" de stock que la capa de datos aplica en bloque.

import {
  OPCIONES_IVA,
  TARIFAS_IVA,
  calcularLineaIVA,
  calcularResumenIVA,
  esTarifaIvaValida,
  ivaPorDefectoCategoria,
  normalizarTarifaIva,
  obtenerIvaProducto,
} from './iva.js';

export {
  OPCIONES_IVA,
  TARIFAS_IVA,
  calcularLineaIVA,
  calcularResumenIVA,
  esTarifaIvaValida,
  ivaPorDefectoCategoria,
  normalizarTarifaIva,
  obtenerIvaProducto,
};

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
export function planFactura({
  productos,
  items,
  usuario,
  consecutivo,
  ahora,
  metodoPago = 'efectivo',
  pagaCon = null,
  cliente = null,
}) {
  if (!items.length) throw new Error('Agrega al menos un producto a la venta.');
  items.forEach((it, n) => {
    const p = productos[n];
    if (!p || p.activo === false) throw new Error('Uno de los productos ya no está disponible.');
    validarCantidad(it.cantidad, p);
    if (p.stock < it.cantidad) {
      throw new Error(`Sin stock suficiente de ${p.nombre}: quedan ${fmtCant(p.stock, p.unidad)}.`);
    }
  });
  const lineas = items.map((it, n) => {
    const p = productos[n];
    const tarifaIva = obtenerIvaProducto(p);
    const desglose = calcularLineaIVA(it.cantidad, p.precioVenta, tarifaIva);
    return {
      productoId: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      categoriaId: p.categoriaId,
      cantidad: it.cantidad,
      precio: p.precioVenta,
      iva: tarifaIva,
      subtotalSinIva: desglose.subtotalSinIva,
      valorIva: desglose.valorIva,
    };
  });
  const resumenIva = calcularResumenIVA(lineas, productos);
  const total = resumenIva.total;

  const metodo = metodoPago || 'efectivo';
  const recibido = metodo === 'efectivo' && pagaCon != null && pagaCon !== '' ? Number(pagaCon) : total;
  if (metodo === 'efectivo' && recibido < total) {
    throw new Error(`El dinero recibido ($${recibido.toLocaleString('es-CO')}) no puede ser menor al total ($${total.toLocaleString('es-CO')}).`);
  }
  const cambio = metodo === 'efectivo' ? Math.max(0, recibido - total) : 0;

  const datosCliente = {
    nombre: cliente?.nombre?.trim() || 'Consumidor Final',
    documento: cliente?.documento?.trim() || '222222222222',
    telefono: cliente?.telefono?.trim() || '',
  };

  const factura = {
    numero: numeroFactura(consecutivo),
    cajeroId: usuario.id,
    cajeroNombre: usuario.nombre,
    fecha: ahora,
    items: lineas,
    subtotalSinIva: resumenIva.subtotalSinIva,
    iva5: resumenIva.iva5,
    iva19: resumenIva.iva19,
    totalIva: resumenIva.totalIva,
    total,
    metodoPago: metodo,
    pagaCon: recibido,
    cambio,
    cliente: datosCliente,
    estado: 'pagada',
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

// Genera un archivo CSV con codificación UTF-8 BOM y punto y coma (;) para apertura en columnas en Excel
export function generarCSV(encabezados, filas, separador = ';') {
  const escapar = v => {
    const s = String(v ?? '');
    return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    encabezados.map(escapar).join(separador),
    ...filas.map(f => f.map(escapar).join(separador)),
  ];
  return '\uFEFF' + lineas.join('\r\n');
}

// Empaquetador ZIP sin compresión (STORE) para construir archivos nativos .xlsx de Excel
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function crearZip(archivos) {
  const enc = new TextEncoder();
  const locales = [];
  const centrales = [];
  let offset = 0;

  for (const { nombre, contenido } of archivos) {
    const nameBytes = enc.encode(nombre);
    const dataBytes = typeof contenido === 'string' ? enc.encode(contenido) : contenido;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true);      // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x2100, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    locales.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x2100, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrales.push(central);

    offset += local.length;
  }

  const cdSize = centrales.reduce((t, b) => t + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, archivos.length, true);
  ev.setUint16(10, archivos.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = new Uint8Array(offset + cdSize + 22);
  let pos = 0;
  for (const b of locales) { total.set(b, pos); pos += b.length; }
  for (const b of centrales) { total.set(b, pos); pos += b.length; }
  total.set(eocd, pos);
  return total;
}

const escXml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));

function colLetra(idx) {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Genera un archivo nativo de Excel (.xlsx) con tabla estructurada, filtros,
 * anchos de columna automáticos, formato de moneda y colores de estado.
 */
export function generarExcelXLSX(encabezados, filas, opciones = {}) {
  const nombreHoja = (opciones.hoja || 'Inventario').slice(0, 31);
  const tiposCol = opciones.tipos || [];
  const filaTotales = opciones.totales || null;

  const shared = [];
  const sharedMap = new Map();
  const idxString = texto => {
    const k = String(texto ?? '');
    if (sharedMap.has(k)) return sharedMap.get(k);
    const idx = shared.length;
    shared.push(k);
    sharedMap.set(k, idx);
    return idx;
  };

  // Estilos (cellXfs):
  // 0: normal
  // 1: encabezado tabla (centrado/izq, fondo verde, texto blanco negrita)
  // 2: texto fila impar
  // 3: texto fila par (zebra)
  // 4: texto centrado fila impar (código de barras, unidad)
  // 5: texto centrado fila par
  // 6: moneda ($#,##0) fila impar
  // 7: moneda ($#,##0) fila par
  // 8: número stock (#,##0.###) fila impar
  // 9: número stock (#,##0.###) fila par
  // 10: Estado Disponible (verde)
  // 11: Estado Bajo (amarillo)
  // 12: Estado Agotado (rojo)
  // 13: Total texto / etiqueta
  // 14: Total número stock
  // 15: Total moneda
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>
    <numFmt numFmtId="165" formatCode="#,##0.###"/>
  </numFmts>
  <fonts count="6">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF166534"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF15803D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF15803D"/></left>
      <right style="thin"><color rgb="FF15803D"/></right>
      <top style="medium"><color rgb="FF15803D"/></top>
      <bottom style="double"><color rgb="FF15803D"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="165" fontId="2" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="2" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

  const detectarTipo = (cIdx, val) => {
    if (tiposCol[cIdx]) return tiposCol[cIdx];
    const h = (encabezados[cIdx] || '').toLowerCase();
    if (h.includes('código') || h.includes('codigo') || h.includes('unidad') || h.includes('documento')) return 'codigo';
    if (h.includes('estado')) return 'estado';
    if (h.includes('costo') || h.includes('precio') || h.includes('valor') || h.includes('total')) return 'moneda';
    if (h.includes('stock') || h.includes('cantidad')) return 'numero';
    return typeof val === 'number' ? 'numero' : 'texto';
  };

  // Calcular anchos de columna ideales
  const anchos = encabezados.map((h, cIdx) => {
    let maxLen = String(h).length + 4;
    for (const f of filas) {
      const v = f[cIdx];
      const tipo = detectarTipo(cIdx, v);
      const txt = tipo === 'moneda' && typeof v === 'number'
        ? '$' + Math.round(v).toLocaleString('es-CO')
        : String(v ?? '');
      if (txt.length + 3 > maxLen) maxLen = txt.length + 3;
    }
    return Math.min(44, Math.max(13, maxLen));
  });

  const colsXml = `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;

  const rowsXml = [];
  // Fila 1: Encabezados
  const celdasHead = encabezados.map((h, cIdx) => {
    const ref = `${colLetra(cIdx)}1`;
    const sIdx = idxString(h);
    return `<c r="${ref}" s="1" t="s"><v>${sIdx}</v></c>`;
  }).join('');
  rowsXml.push(`<row r="1" ht="26" customHeight="1">${celdasHead}</row>`);

  // Filas de datos
  filas.forEach((f, rIdx) => {
    const numFila = rIdx + 2;
    const par = rIdx % 2 === 1;
    const celdas = encabezados.map((_, cIdx) => {
      const ref = `${colLetra(cIdx)}${numFila}`;
      const val = f[cIdx];
      const tipo = detectarTipo(cIdx, val);

      if (tipo === 'moneda' && typeof val === 'number' && !Number.isNaN(val)) {
        return `<c r="${ref}" s="${par ? 7 : 6}"><v>${val}</v></c>`;
      }
      if (tipo === 'numero' && typeof val === 'number' && !Number.isNaN(val)) {
        return `<c r="${ref}" s="${par ? 9 : 8}"><v>${val}</v></c>`;
      }
      if (tipo === 'estado') {
        const sEst = String(val ?? '').toLowerCase();
        const st = sEst.includes('agotado') || sEst.includes('anulada') ? 12
          : sEst.includes('bajo') ? 11 : 10;
        return `<c r="${ref}" s="${st}" t="s"><v>${idxString(val)}</v></c>`;
      }
      if (tipo === 'codigo') {
        return `<c r="${ref}" s="${par ? 5 : 4}" t="s"><v>${idxString(val)}</v></c>`;
      }
      return `<c r="${ref}" s="${par ? 3 : 2}" t="s"><v>${idxString(val)}</v></c>`;
    }).join('');
    rowsXml.push(`<row r="${numFila}" ht="20" customHeight="1">${celdas}</row>`);
  });

  // Fila de totales si se provee
  if (filaTotales && filas.length > 0) {
    const numFila = filas.length + 2;
    const celdasTot = encabezados.map((_, cIdx) => {
      const ref = `${colLetra(cIdx)}${numFila}`;
      const val = filaTotales[cIdx] ?? '';
      const tipo = detectarTipo(cIdx, val);
      if (typeof val === 'number' && !Number.isNaN(val)) {
        const st = tipo === 'moneda' ? 15 : 14;
        return `<c r="${ref}" s="${st}"><v>${val}</v></c>`;
      }
      return `<c r="${ref}" s="13" t="s"><v>${idxString(val)}</v></c>`;
    }).join('');
    rowsXml.push(`<row r="${numFila}" ht="24" customHeight="1">${celdasTot}</row>`);
  }

  const ultimaCol = colLetra(Math.max(0, encabezados.length - 1));
  const ultimaFilaTabla = Math.max(2, filas.length + 1);
  const rangoTabla = `A1:${ultimaCol}${ultimaFilaTabla}`;
  const usarTablaNativa = filas.length > 0;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  ${colsXml}
  <sheetData>${rowsXml.join('')}</sheetData>
  ${usarTablaNativa ? `<tableParts count="1"><tablePart r:id="rId1"/></tableParts>` : `<autoFilter ref="A1:${ultimaCol}1"/>`}
</worksheet>`;

  const tableXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="TablaFrescoStock" displayName="TablaFrescoStock" ref="${rangoTabla}" totalsRowShown="0">
  <autoFilter ref="${rangoTabla}"/>
  <tableColumns count="${encabezados.length}">
    ${encabezados.map((h, i) => `<tableColumn id="${i + 1}" name="${escXml(h)}"/>`).join('')}
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">
  ${shared.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}
</sst>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${usarTablaNativa ? '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>' : ''}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escXml(nombreHoja)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const sheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
</Relationships>`;

  const entradas = [
    { nombre: '[Content_Types].xml', contenido: contentTypesXml },
    { nombre: '_rels/.rels', contenido: rootRelsXml },
    { nombre: 'xl/workbook.xml', contenido: workbookXml },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: workbookRelsXml },
    { nombre: 'xl/styles.xml', contenido: stylesXml },
    { nombre: 'xl/sharedStrings.xml', contenido: sharedStringsXml },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: sheetXml },
  ];
  if (usarTablaNativa) {
    entradas.push(
      { nombre: 'xl/worksheets/_rels/sheet1.xml.rels', contenido: sheetRelsXml },
      { nombre: 'xl/tables/table1.xml', contenido: tableXml },
    );
  }
  return crearZip(entradas);
}

export function descargarCSV(nombreArchivo, encabezados, filas, opciones = {}) {
  const bytes = generarExcelXLSX(encabezados, filas, opciones);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const base = nombreArchivo.replace(/\.(csv|xlsx)$/i, '');
  a.download = `${base}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
