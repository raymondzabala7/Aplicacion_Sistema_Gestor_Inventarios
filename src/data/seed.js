// Datos de ejemplo para el modo demo (y para poblar Firestore la primera vez).
const DIA_SEED = 24 * 60 * 60 * 1000;

const CATEGORIAS = [
  { id: 'lacteos', nombre: 'Lácteos', icono: '🥛', orden: 1 },
  { id: 'frutas', nombre: 'Frutas y verduras', icono: '🍎', orden: 2 },
  { id: 'panaderia', nombre: 'Panadería', icono: '🍞', orden: 3 },
  { id: 'granos', nombre: 'Granos y despensa', icono: '🌾', orden: 4 },
  { id: 'bebidas', nombre: 'Bebidas', icono: '🧃', orden: 5 },
  { id: 'aseo', nombre: 'Aseo', icono: '🧼', orden: 6 },
];

const PROVEEDORES = [
  { id: 'prov-lacteos', nombre: 'Lácteos del Valle', nit: '900123456-7', telefono: '602 555 0101', contacto: 'Marta Ruiz', categorias: ['lacteos'] },
  { id: 'prov-campo', nombre: 'Finca El Rocío', nit: '901765432-1', telefono: '310 555 0142', contacto: 'Jorge Peña', categorias: ['frutas'] },
  { id: 'prov-dist', nombre: 'Distribuidora Andina', nit: '800987654-3', telefono: '601 555 0199', contacto: 'Lucía Gómez', categorias: ['granos', 'bebidas', 'panaderia'] },
  { id: 'prov-limpio', nombre: 'Limpio Hogar S.A.S.', nit: '900555111-2', telefono: '604 555 0177', contacto: 'Andrés Vélez', categorias: ['aseo'] },
];

// [id, nombre, categoría, unidad, precio venta, costo, stock, mínimo, código]
const PRODUCTOS = [
  ['leche-1l', 'Leche entera 1 L', 'lacteos', 'und', 4900, 3600, 48, 20, '7702001012345'],
  ['yogur-fresa', 'Yogur de fresa 1 L', 'lacteos', 'und', 8900, 6200, 14, 10, '7702001014561'],
  ['queso-campesino', 'Queso campesino 500 g', 'lacteos', 'und', 12500, 9400, 9, 8, '7702001019870'],
  ['mantequilla', 'Mantequilla 250 g', 'lacteos', 'und', 7800, 5600, 22, 10, '7702001011122'],
  ['tomate', 'Tomate chonto', 'frutas', 'kg', 3500, 2200, 6, 10, '2000000000011'],
  ['banano', 'Banano', 'frutas', 'kg', 2800, 1600, 35, 12, '2000000000028'],
  ['papa', 'Papa pastusa', 'frutas', 'kg', 2600, 1500, 80, 25, '2000000000035'],
  ['aguacate', 'Aguacate Hass', 'frutas', 'und', 3200, 2100, 18, 15, '2000000000042'],
  ['pan-tajado', 'Pan tajado 600 g', 'panaderia', 'und', 6900, 4800, 25, 10, '7702003330011'],
  ['arepas', 'Arepas de maíz x10', 'panaderia', 'und', 5200, 3500, 30, 12, '7702003330028'],
  ['arroz', 'Arroz 500 g', 'granos', 'und', 2900, 2000, 0, 30, '7702004440013'],
  ['frijol', 'Fríjol cargamanto 500 g', 'granos', 'und', 6400, 4700, 40, 15, '7702004440020'],
  ['aceite', 'Aceite vegetal 1 L', 'granos', 'und', 11900, 9200, 27, 12, '7702004440037'],
  ['cafe', 'Café molido 250 g', 'granos', 'und', 9800, 7300, 33, 12, '7702004440044'],
  ['agua', 'Agua 600 ml', 'bebidas', 'und', 1800, 900, 96, 40, '7702005550016'],
  ['gaseosa', 'Gaseosa cola 1.5 L', 'bebidas', 'und', 5600, 3900, 42, 20, '7702005550023'],
  ['jugo-naranja', 'Jugo de naranja 1 L', 'bebidas', 'und', 6200, 4300, 11, 12, '7702005550030'],
  ['jabon', 'Jabón en barra', 'aseo', 'und', 3400, 2300, 120, 30, '7702006660019'],
  ['detergente', 'Detergente 1 kg', 'aseo', 'und', 13900, 10100, 24, 10, '7702006660026'],
  ['papel', 'Papel higiénico x4', 'aseo', 'und', 7600, 5400, 50, 20, '7702006660033'],
];

const USUARIOS = [
  { id: 'u-admin', nombre: 'Carla Paz', email: 'admin@frescostock.test', rol: 'admin', turno: 'Mañana', cedula: '1.020.333.444', activo: true },
  { id: 'u-bodega', nombre: 'Luis Mora', email: 'bodega@frescostock.test', rol: 'bodega', turno: 'Mañana', cedula: '1.030.555.666', activo: true },
  { id: 'u-caja', nombre: 'Ana Ríos', email: 'caja@frescostock.test', rol: 'cajero', turno: 'Tarde', cedula: '1.040.777.888', activo: true },
  { id: 'u-caja2', nombre: 'Pedro Gil', email: 'pedro@frescostock.test', rol: 'cajero', turno: 'Noche', cedula: '1.050.999.000', activo: false },
];

// Generador pseudoaleatorio con semilla para que la demo siempre se vea igual.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function seed() {
  const rand = rng(42);
  const ahora = Date.now();
  const productos = PRODUCTOS.map(([id, nombre, categoriaId, unidad, precioVenta, costo, stock, stockMinimo, codigoBarras]) => ({
    id, nombre, categoriaId, unidad, precioVenta, costo, stock, stockMinimo, codigoBarras, activo: true, creado: ahora - 30 * DIA_SEED,
  }));
  const state = {
    categorias: CATEGORIAS.map(c => ({ ...c })),
    proveedores: PROVEEDORES.map(p => ({ ...p, activo: true })),
    productos,
    usuarios: USUARIOS.map(u => ({ ...u })),
    entregas: [],
    facturas: [],
    movimientos: [],
    alertas: [],
    historial: [],
    config: { consecutivo: 0 },
  };

  // Entregas de los últimos 10 días
  const entregasPlan = [
    [9, 'prov-dist', [['arroz', 60], ['frijol', 30], ['aceite', 20], ['cafe', 24]]],
    [7, 'prov-limpio', [['jabon', 100], ['detergente', 20], ['papel', 40]]],
    [5, 'prov-lacteos', [['leche-1l', 60], ['yogur-fresa', 24], ['queso-campesino', 12]]],
    [3, 'prov-campo', [['tomate', 40], ['banano', 30], ['papa', 70], ['aguacate', 30]]],
    [1, 'prov-lacteos', [['leche-1l', 48], ['mantequilla', 20]]],
  ];
  for (const [dias, proveedorId, lista] of entregasPlan) {
    const fecha = ahora - dias * DIA_SEED + 8 * 3600 * 1000;
    const prov = state.proveedores.find(p => p.id === proveedorId);
    const items = lista.map(([pid, cantidad]) => {
      const p = productos.find(x => x.id === pid);
      const vence = p.categoriaId === 'lacteos' || p.categoriaId === 'frutas'
        ? new Date(fecha + (p.categoriaId === 'lacteos' ? 12 : 7) * DIA_SEED).toISOString().slice(0, 10)
        : new Date(fecha + 300 * DIA_SEED).toISOString().slice(0, 10);
      return { productoId: pid, nombre: p.nombre, unidad: p.unidad, cantidad, costoUnit: p.costo, lote: 'L-' + (2200 + Math.floor(rand() * 700)), vence };
    });
    const id = 'ent-' + dias;
    state.entregas.unshift({
      id, proveedorId, proveedorNombre: prov.nombre, fecha, recibidoPor: 'Luis Mora', items,
      totalUnidades: items.reduce((t, i) => t + i.cantidad, 0),
      totalCosto: items.reduce((t, i) => t + i.cantidad * i.costoUnit, 0),
    });
    for (const it of items) {
      state.movimientos.push({ id: 'mv-e-' + id + it.productoId, tipo: 'entrada', productoId: it.productoId, productoNombre: it.nombre, cantidad: it.cantidad, origen: 'entregas/' + id, usuarioNombre: 'Luis Mora', fecha });
    }
  }

  // Facturas de los últimos 7 días (incluye hoy)
  for (let d = 6; d >= 0; d--) {
    const n = 5 + Math.floor(rand() * 6);
    for (let k = 0; k < n; k++) {
      const fecha = ahora - d * DIA_SEED - Math.floor(rand() * 8) * 3600 * 1000 - Math.floor(rand() * 59) * 60 * 1000;
      if (fecha > ahora) continue;
      const usados = new Set();
      const lineas = [];
      const cuantos = 1 + Math.floor(rand() * 4);
      for (let j = 0; j < cuantos; j++) {
        const p = productos[Math.floor(rand() * productos.length)];
        if (usados.has(p.id) || p.id === 'arroz') continue;
        usados.add(p.id);
        const cantidad = p.unidad === 'kg' ? 0.5 + Math.floor(rand() * 4) * 0.5 : 1 + Math.floor(rand() * 3);
        lineas.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, categoriaId: p.categoriaId, cantidad, precio: p.precioVenta });
      }
      if (!lineas.length) continue;
      state.facturas.push({
        cajeroId: 'u-caja', cajeroNombre: 'Ana Ríos', fecha,
        items: lineas, total: lineas.reduce((t, l) => t + Math.round(l.cantidad * l.precio), 0), estado: 'pagada',
      });
    }
  }
  // Numerar en orden de fecha para que el consecutivo sea creciente
  state.facturas.sort((a, b) => a.fecha - b.fecha);
  for (const f of state.facturas) {
    state.config.consecutivo += 1;
    f.id = 'fac-' + state.config.consecutivo;
    f.numero = 'FV-' + String(state.config.consecutivo).padStart(6, '0');
    for (const l of f.items) {
      state.movimientos.push({ id: 'mv-s-' + f.numero + l.productoId, tipo: 'salida', productoId: l.productoId, productoNombre: l.nombre, cantidad: -l.cantidad, origen: 'facturas/' + f.numero, usuarioNombre: f.cajeroNombre, fecha: f.fecha });
    }
  }
  state.facturas.sort((a, b) => b.fecha - a.fecha);
  state.movimientos.sort((a, b) => b.fecha - a.fecha);

  // Alertas iniciales para los productos que ya están bajo el mínimo
  for (const p of productos) {
    if (p.stock <= p.stockMinimo) {
      state.alertas.push({ id: p.id, productoId: p.id, productoNombre: p.nombre, tipo: p.stock <= 0 ? 'agotado' : 'stock_bajo', stock: p.stock, stockMinimo: p.stockMinimo, fecha: ahora - 2 * 3600 * 1000, atendida: false });
    }
  }

  state.historial = [
    ...state.facturas.slice(0, 6).map(f => ({ id: 'h-' + f.id, usuarioNombre: f.cajeroNombre, accion: `Facturó ${f.numero}`, coleccion: 'facturas', docId: f.id, fecha: f.fecha })),
    ...state.entregas.map(e => ({ id: 'h-' + e.id, usuarioNombre: e.recibidoPor, accion: `Registró entrega de ${e.proveedorNombre} (${e.totalUnidades} unidades)`, coleccion: 'entregas', docId: e.id, fecha: e.fecha })),
    { id: 'h-precio', usuarioNombre: 'Carla Paz', accion: 'Editó producto "Arroz 500 g"', coleccion: 'productos', docId: 'arroz', fecha: ahora - 26 * 3600 * 1000 },
  ].sort((a, b) => b.fecha - a.fecha);

  return state;
}
