import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  runTransaction, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { initializeFirebase } from '../firebase/client.js';
import { evaluarAlerta, movimientoDe, numeroFactura, planAjuste, planAnulacion, planEntrega, planFactura } from '../domain/inventory.js';

// Adaptador de Cloud Firestore: misma interfaz que local-store.js.

const NOMBRE = { productos: 'producto', proveedores: 'proveedor', usuarios: 'usuario', categorias: 'categoría' };

// Colecciones que la app escucha en tiempo real: [campo de orden, máximo de documentos]
const COLECCIONES = {
  categorias: null, proveedores: null, productos: null, usuarios: null, alertas: null,
  entregas: ['fecha', 200], facturas: ['fecha', 300], movimientos: ['fecha', 300], historial: ['fecha', 200],
};

export function createFirestoreStore() {
  const { auth, db } = initializeFirebase();
  const cfgRef = doc(db, 'config', 'consecutivos');

  const state = { config: { consecutivo: 0 } };
  Object.keys(COLECCIONES).forEach(c => { state[c] = []; });
  const subs = new Set();
  let unsubs = [];
  const emit = () => subs.forEach(f => f(state));

  function escuchar() {
    unsubs.forEach(u => u());
    unsubs = Object.entries(COLECCIONES).map(([col, ord]) => {
      const q = ord ? query(collection(db, col), orderBy(ord[0], 'desc'), limit(ord[1])) : collection(db, col);
      return onSnapshot(q, snap => { state[col] = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit(); },
        err => console.error(`No se pudo leer ${col}:`, err));
    });
    unsubs.push(onSnapshot(cfgRef, s => { state.config = { consecutivo: s.data()?.factura ?? 0 }; emit(); }));
  }

  // El perfil del empleado vive en usuarios/{correo} para que las reglas puedan leer su rol.
  async function perfil(user) {
    const s = await getDoc(doc(db, 'usuarios', user.email.toLowerCase()));
    if (!s.exists()) { await signOut(auth); throw new Error('Tu cuenta no tiene perfil de empleado. Pide al administrador que te registre.'); }
    const u = { id: s.id, ...s.data() };
    if (!u.activo) { await signOut(auth); throw new Error('Este usuario está inactivo. Pide al administrador que lo active.'); }
    return u;
  }
  const historial = (usuario, accion, coleccion, docId) => ({ usuarioId: usuario?.id ?? null, usuarioNombre: usuario?.nombre ?? 'Sistema', accion, coleccion, docId, fecha: Date.now() });
  const log = (...a) => addDoc(collection(db, 'historial'), historial(...a));

  // Lee productos, sus alertas y otros documentos, y aplica los cambios de stock en una sola transacción.
  function operacion(productoIds, construir, otrosRefs = []) {
    return runTransaction(db, async tx => {
      const pRefs = productoIds.map(id => doc(db, 'productos', id));
      const aRefs = productoIds.map(id => doc(db, 'alertas', id));
      const pSnaps = await Promise.all(pRefs.map(r => tx.get(r)));
      const aSnaps = await Promise.all(aRefs.map(r => tx.get(r)));
      const cfg = await tx.get(cfgRef);
      const otros = await Promise.all(otrosRefs.map(r => tx.get(r)));
      const productos = pSnaps.map(s => (s.exists() ? { id: s.id, ...s.data() } : undefined));
      const op = construir({ productos, consecutivo: cfg.data()?.factura ?? 0, otros });
      const ahora = Date.now();
      op.cambios.forEach(c => {
        const n = productoIds.indexOf(c.producto.id);
        tx.update(pRefs[n], { stock: c.despues, ...(c.campos || {}) });
        tx.set(doc(collection(db, 'movimientos')), movimientoDe(c, op.tipo, op.origen, op.usuario, ahora, op.motivo));
        const actual = aSnaps[n].exists() ? aSnaps[n].data() : null;
        const alerta = evaluarAlerta(c.producto, c.despues, actual, ahora);
        if (alerta) tx.set(aRefs[n], alerta);
      });
      op.extra?.(tx);
      tx.set(doc(collection(db, 'historial')), op.historial);
      return op.resultado;
    });
  }

  return {
    mode: 'firebase',
    get state() { return state; },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },

    restoreSession() {
      return new Promise(resolve => {
        const off = onAuthStateChanged(auth, async user => {
          off();
          if (!user) return resolve(null);
          try { const u = await perfil(user); escuchar(); resolve(u); } catch { resolve(null); }
        });
      });
    },
    async login(email, password) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const u = await perfil(cred.user);
        escuchar();
        log(u, 'Inició sesión', 'usuarios', u.id);
        return u;
      } catch (e) {
        if (String(e.code).startsWith('auth/')) throw new Error('Correo o contraseña incorrectos.');
        throw e;
      }
    },
    async logout() { unsubs.forEach(u => u()); unsubs = []; await signOut(auth); },

    async add(col, data, usuario) {
      if (col === 'usuarios') {
        const id = data.email.trim().toLowerCase();
        const ref = doc(db, 'usuarios', id);
        if ((await getDoc(ref)).exists()) throw new Error('Ya existe un empleado con ese correo.');
        await setDoc(ref, { ...data, email: id, creado: Date.now() });
        await log(usuario, `Creó usuario "${data.nombre}"`, col, id);
        return { id, ...data };
      }
      const ref = doc(collection(db, col));
      if (col === 'productos') {
        const inicial = Number(data.stock) || 0;
        const producto = { id: ref.id, ...data, stock: 0, activo: true };
        const batch = writeBatch(db);
        batch.set(ref, { ...data, stock: inicial, activo: true, creado: Date.now() });
        if (inicial > 0) {
          const c = planAjuste({ producto, cantidad: inicial, motivo: 'Stock inicial' });
          batch.set(doc(collection(db, 'movimientos')), movimientoDe(c, 'entrada', 'productos/' + ref.id, usuario, Date.now(), 'Stock inicial'));
        }
        const alerta = evaluarAlerta(producto, inicial, null, Date.now());
        if (alerta) batch.set(doc(db, 'alertas', ref.id), alerta);
        batch.set(doc(collection(db, 'historial')), historial(usuario, `Creó producto "${data.nombre}"`, col, ref.id));
        await batch.commit();
        return { id: ref.id, ...data };
      }
      await setDoc(ref, { ...data, creado: Date.now() });
      await log(usuario, `Creó ${NOMBRE[col]} "${data.nombre}"`, col, ref.id);
      return { id: ref.id, ...data };
    },
    async update(col, id, patch, usuario) {
      const { stock, ...resto } = patch; // el stock solo cambia con movimientos
      if (col === 'productos') {
        await runTransaction(db, async tx => {
          const pRef = doc(db, 'productos', id);
          const aRef = doc(db, 'alertas', id);
          const p = await tx.get(pRef);
          const a = await tx.get(aRef);
          const nuevo = { id, ...p.data(), ...resto };
          tx.update(pRef, resto);
          const alerta = evaluarAlerta(nuevo, nuevo.stock, a.exists() ? a.data() : null, Date.now());
          if (alerta) tx.set(aRef, alerta);
          tx.set(doc(collection(db, 'historial')), historial(usuario, `Editó producto "${nuevo.nombre}"`, col, id));
        });
        return;
      }
      await updateDoc(doc(db, col, id), resto);
      await log(usuario, `Editó ${NOMBRE[col]} "${resto.nombre ?? id}"`, col, id);
    },
    async remove(col, id, usuario) {
      const nombre = state[col].find(x => x.id === id)?.nombre ?? id;
      if (col === 'productos') {
        const batch = writeBatch(db);
        batch.update(doc(db, 'productos', id), { activo: false });
        if (state.alertas.some(a => a.id === id)) batch.update(doc(db, 'alertas', id), { atendida: true });
        await batch.commit();
      } else if (col === 'categorias') {
        const q = query(collection(db, 'productos'), where('categoriaId', '==', id), where('activo', '==', true), limit(1));
        if (!(await getDocs(q)).empty) throw new Error('La categoría todavía tiene productos. Muévelos o elimínalos primero.');
        await deleteDoc(doc(db, col, id));
      } else {
        await deleteDoc(doc(db, col, id));
      }
      await log(usuario, `Eliminó ${NOMBRE[col]} "${nombre}"`, col, id);
    },

    crearFactura(items, usuario) {
      const ref = doc(collection(db, 'facturas'));
      return operacion(items.map(i => i.productoId), ({ productos, consecutivo }) => {
        const { factura, cambios } = planFactura({ productos, items, usuario, consecutivo: consecutivo + 1, ahora: Date.now() });
        return {
          cambios, tipo: 'salida', origen: 'facturas/' + factura.numero, usuario,
          extra: tx => { tx.set(ref, factura); tx.set(cfgRef, { factura: consecutivo + 1 }, { merge: true }); },
          historial: historial(usuario, `Facturó ${factura.numero}`, 'facturas', ref.id),
          resultado: { id: ref.id, ...factura },
        };
      });
    },
    async anularFactura(id, usuario) {
      const fRef = doc(db, 'facturas', id);
      const f = (await getDoc(fRef)).data();
      return operacion(f.items.map(l => l.productoId), ({ productos, otros }) => {
        const factura = otros[0].data();
        const cambios = planAnulacion({ factura, productos });
        return {
          cambios, tipo: 'entrada', origen: 'anulación ' + factura.numero, usuario,
          extra: tx => tx.update(fRef, { estado: 'anulada', anuladaPor: usuario.nombre }),
          historial: historial(usuario, `Anuló la factura ${factura.numero}`, 'facturas', id),
        };
      }, [fRef]);
    },
    registrarEntrega({ proveedorId, items }, usuario) {
      const proveedor = state.proveedores.find(p => p.id === proveedorId);
      const ref = doc(collection(db, 'entregas'));
      return operacion(items.map(i => i.productoId), ({ productos }) => {
        const { entrega, cambios } = planEntrega({ proveedor, productos, items, usuario, ahora: Date.now() });
        cambios.forEach((c, n) => { c.campos = { costo: items[n].costoUnit }; });
        return {
          cambios, tipo: 'entrada', origen: 'entregas/' + ref.id, usuario,
          extra: tx => tx.set(ref, entrega),
          historial: historial(usuario, `Registró entrega de ${entrega.proveedorNombre} (${entrega.totalUnidades} unidades)`, 'entregas', ref.id),
          resultado: { id: ref.id, ...entrega },
        };
      });
    },
    ajustarStock(productoId, cantidad, motivo, usuario) {
      return operacion([productoId], ({ productos }) => ({
        cambios: [planAjuste({ producto: productos[0], cantidad, motivo })], tipo: 'ajuste', origen: 'ajuste manual', usuario, motivo,
        historial: historial(usuario, `Ajustó stock de "${productos[0].nombre}" (${cantidad > 0 ? '+' : ''}${cantidad}): ${motivo}`, 'productos', productoId),
      }));
    },
    async atenderAlerta(id, usuario) {
      await updateDoc(doc(db, 'alertas', id), { atendida: true, fechaAtendida: Date.now(), atendidaPor: usuario.nombre });
      await log(usuario, `Atendió alerta de "${state.alertas.find(a => a.id === id)?.productoNombre ?? id}"`, 'alertas', id);
    },
    numeroSiguiente() { return numeroFactura(state.config.consecutivo + 1); },
  };
}
