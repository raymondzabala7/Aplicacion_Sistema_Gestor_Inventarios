import { seed } from './seed.js';
import { evaluarAlerta, movimientoDe, numeroFactura, planAjuste, planAnulacion, planEntrega, planFactura } from '../domain/inventory.js';

// Adaptador de demostración: sus datos solo existen en este navegador.


const KEY = 'frescostock:demo:v1';
const SESSION_KEY = 'frescostock:demo:sesion';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const NOMBRE = { productos: 'producto', proveedores: 'proveedor', usuarios: 'usuario', categorias: 'categoría' };

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function createLocalStore() {
  let state = load() || seed();
  const subs = new Set();

  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento: la demo sigue en memoria */ }
    subs.forEach(f => f(state));
  }
  function log(usuario, accion, coleccion, docId) {
    state.historial.unshift({ id: uid(), usuarioId: usuario?.id, usuarioNombre: usuario?.nombre ?? 'Sistema', accion, coleccion, docId, fecha: Date.now() });
    if (state.historial.length > 400) state.historial.length = 400;
  }
  function find(col, id) {
    const d = state[col].find(x => x.id === id);
    if (!d) throw new Error('No se encontró el registro. Puede que otra persona lo haya borrado.');
    return d;
  }
  function aplicar(cambios, tipo, origen, usuario, motivo) {
    const ahora = Date.now();
    for (const c of cambios) {
      const p = find('productos', c.producto.id);
      p.stock = c.despues;
      state.movimientos.unshift({ id: uid(), ...movimientoDe(c, tipo, origen, usuario, ahora, motivo) });
      revisarAlerta(p);
    }
  }
  function revisarAlerta(p) {
    const actual = state.alertas.find(a => a.id === p.id);
    const nueva = evaluarAlerta(p, p.stock, actual, Date.now());
    if (!nueva) return;
    if (actual) Object.assign(actual, nueva);
    else state.alertas.unshift({ id: p.id, ...nueva });
  }

  return {
    mode: 'local',
    get state() { return state; },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },

    async restoreSession() {
      try {
        const id = localStorage.getItem(SESSION_KEY);
        const u = id && state.usuarios.find(x => x.id === id && x.activo);
        return u || null;
      } catch { return null; }
    },
    async login(email) {
      const u = state.usuarios.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!u) throw new Error('No hay ningún empleado con ese correo.');
      if (!u.activo) throw new Error('Este usuario está inactivo. Pide al administrador que lo active.');
      try { localStorage.setItem(SESSION_KEY, u.id); } catch {}
      log(u, 'Inició sesión', 'usuarios', u.id);
      commit();
      return u;
    },
    async logout() { try { localStorage.removeItem(SESSION_KEY); } catch {} },

    async add(col, data, usuario) {
      const doc = { id: uid(), ...data, creado: Date.now() };
      if (col === 'productos') {
        const inicial = Number(doc.stock) || 0;
        doc.stock = 0; doc.activo = true;
        state.productos.push(doc);
        if (inicial > 0) aplicar([planAjuste({ producto: doc, cantidad: inicial, motivo: 'Stock inicial' })], 'entrada', 'productos/' + doc.id, usuario, 'Stock inicial');
        else revisarAlerta(doc);
      } else {
        if (col === 'usuarios' && state.usuarios.some(u => u.email.toLowerCase() === doc.email.toLowerCase())) {
          throw new Error('Ya existe un empleado con ese correo.');
        }
        state[col].push(doc);
      }
      log(usuario, `Creó ${NOMBRE[col]} "${doc.nombre}"`, col, doc.id);
      commit();
      return doc;
    },
    async update(col, id, patch, usuario) {
      const d = find(col, id);
      const { stock, ...resto } = patch; // el stock solo cambia con movimientos
      Object.assign(d, resto);
      if (col === 'productos') revisarAlerta(d);
      log(usuario, `Editó ${NOMBRE[col]} "${d.nombre}"`, col, id);
      commit();
    },
    async remove(col, id, usuario) {
      const d = find(col, id);
      if (col === 'productos') {
        d.activo = false;
        const a = state.alertas.find(x => x.id === id);
        if (a) a.atendida = true;
      } else if (col === 'categorias') {
        if (state.productos.some(p => p.activo && p.categoriaId === id)) throw new Error('La categoría todavía tiene productos. Muévelos o elimínalos primero.');
        state.categorias = state.categorias.filter(x => x.id !== id);
      } else {
        state[col] = state[col].filter(x => x.id !== id);
      }
      log(usuario, `Eliminó ${NOMBRE[col]} "${d.nombre}"`, col, id);
      commit();
    },

    async crearFactura(items, usuario) {
      const productos = items.map(i => state.productos.find(p => p.id === i.productoId));
      const { factura, cambios } = planFactura({ productos, items, usuario, consecutivo: state.config.consecutivo + 1, ahora: Date.now() });
      state.config.consecutivo += 1;
      const doc = { id: uid(), ...factura };
      state.facturas.unshift(doc);
      aplicar(cambios, 'salida', 'facturas/' + doc.numero, usuario);
      log(usuario, `Facturó ${doc.numero}`, 'facturas', doc.id);
      commit();
      return doc;
    },
    async anularFactura(id, usuario) {
      const f = find('facturas', id);
      const productos = f.items.map(l => state.productos.find(p => p.id === l.productoId));
      const cambios = planAnulacion({ factura: f, productos });
      f.estado = 'anulada';
      f.anuladaPor = usuario.nombre;
      aplicar(cambios, 'entrada', 'anulación ' + f.numero, usuario);
      log(usuario, `Anuló la factura ${f.numero}`, 'facturas', id);
      commit();
    },
    async registrarEntrega({ proveedorId, items }, usuario) {
      const proveedor = state.proveedores.find(p => p.id === proveedorId);
      const productos = items.map(i => state.productos.find(p => p.id === i.productoId && p.activo));
      const { entrega, cambios } = planEntrega({ proveedor, productos, items, usuario, ahora: Date.now() });
      const doc = { id: uid(), ...entrega };
      state.entregas.unshift(doc);
      aplicar(cambios, 'entrada', 'entregas/' + doc.id, usuario);
      entrega.items.forEach(l => { find('productos', l.productoId).costo = l.costoUnit; });
      log(usuario, `Registró entrega de ${doc.proveedorNombre} (${doc.totalUnidades} unidades)`, 'entregas', doc.id);
      commit();
      return doc;
    },
    async ajustarStock(productoId, cantidad, motivo, usuario) {
      const p = find('productos', productoId);
      aplicar([planAjuste({ producto: p, cantidad, motivo })], 'ajuste', 'ajuste manual', usuario, motivo);
      log(usuario, `Ajustó stock de "${p.nombre}" (${cantidad > 0 ? '+' : ''}${cantidad}): ${motivo}`, 'productos', p.id);
      commit();
    },
    async atenderAlerta(id, usuario) {
      const a = find('alertas', id);
      a.atendida = true; a.fechaAtendida = Date.now(); a.atendidaPor = usuario.nombre;
      log(usuario, `Atendió alerta de "${a.productoNombre}"`, 'alertas', id);
      commit();
    },
    async reset() {
      state = seed();
      commit();
    },
    numeroSiguiente() { return numeroFactura(state.config.consecutivo + 1); },
  };
}
