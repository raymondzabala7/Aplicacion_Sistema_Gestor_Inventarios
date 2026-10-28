import { createStore } from './data/store.js';
import { fmtCant, r3 } from './domain/inventory.js';
import { tomi } from './ui/tomi.js';

const store = createStore();

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-CO');
const moneyCorto = n => (n >= 1e6 ? `$${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M` : `$${Math.round(n / 1000)}k`);
const fechaHora = ms => new Date(ms).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const hora = ms => new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const DIA = 864e5;
const inicioDia = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
const S = () => store.state;
const activos = () => S().productos.filter(p => p.activo !== false);
const categoria = id => S().categorias.find(c => c.id === id);
const ROL = { admin: 'Administrador', bodega: 'Bodega', cajero: 'Cajero' };

const ICON = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11.5l2-8H6.2"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  store: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
  bell: '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 5 1.8 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>', adjust: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
  check: '<path d="M5 12l5 5 9-10"/>', print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>', refresh: '<path d="M20 12a8 8 0 11-3-6.3"/><path d="M20 4v5h-5"/>',
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const TODOS = ['admin', 'bodega', 'cajero'];
const RUTAS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', roles: TODOS, titulo: 'Panel general', sub: 'Ventas, entregas y stock de un vistazo' },
  { id: 'caja', label: 'Caja', icon: 'cart', roles: ['admin', 'cajero'], titulo: 'Caja', sub: 'Arma la venta, factura y el stock se descuenta solo' },
  { id: 'productos', label: 'Productos', icon: 'box', roles: TODOS, titulo: 'Productos', sub: 'Stock por categoría' },
  { id: 'recepcion', label: 'Recepción', icon: 'truck', roles: ['admin', 'bodega'], titulo: 'Recepción de proveedores', sub: 'Registra lo que llega y súmalo al stock' },
  { id: 'proveedores', label: 'Proveedores', icon: 'store', roles: ['admin', 'bodega'], titulo: 'Proveedores', sub: 'Quién nos surte y cuánto ha entregado' },
  { id: 'alertas', label: 'Alertas', icon: 'bell', roles: TODOS, titulo: 'Alertas', sub: 'Stock bajo, agotados y productos por vencer' },
  { id: 'historial', label: 'Historial', icon: 'clock', roles: ['admin', 'bodega'], titulo: 'Historial', sub: 'Quién hizo qué y cada movimiento de stock' },
  { id: 'usuarios', label: 'Usuarios', icon: 'users', roles: ['admin'], titulo: 'Usuarios', sub: 'Empleados, roles y turnos' },
];

// ---------- estado de la interfaz ----------
let sesion = null;
let ruta = 'inicio';
let instalador = null;
const filaVacia = () => ({ productoId: '', cantidad: '', costoUnit: '', lote: '', vence: '' });
const ui = {
  prodCat: 'todas', prodQ: '', cajaCat: 'todas', cajaQ: '', carrito: [],
  recep: { proveedorId: '', items: [filaVacia()] }, histTab: 'actividad', histTipo: 'todos', menu: false,
};
const puede = (...roles) => roles.includes(sesion?.rol);

// ---------- render ----------
function render() {
  let fid = null, sel = null;
  try {
    const a = document.activeElement;
    if (a && a.id && !a.closest('dialog')) { fid = a.id; sel = [a.selectionStart, a.selectionEnd]; }
  } catch { /* inputs numéricos no tienen selección */ }

  const app = $('#app');
  if (!sesion) { app.innerHTML = vistaLogin(); return; }
  const r = RUTAS.find(x => x.id === ruta && x.roles.includes(sesion.rol)) || RUTAS[0];
  ruta = r.id;
  app.innerHTML = shell(r, VISTAS[r.id]());

  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus(); try { if (sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}

function shell(r, contenido) {
  const rutas = RUTAS.filter(x => x.roles.includes(sesion.rol));
  const nAlertas = S().alertas.filter(a => !a.atendida).length;
  const link = x => `<button class="nav-link ${x.id === ruta ? 'on' : ''}" data-act="ir" data-ruta="${x.id}" ${x.id === ruta ? 'aria-current="page"' : ''}>
      ${icon(x.icon)}<span>${x.label}</span>${x.id === 'alertas' && nAlertas ? `<em class="nav-badge">${nAlertas}</em>` : ''}</button>`;
  return `
  <div class="layout">
    <aside class="side">
      <div class="brand">${tomi('feliz', 'tomi-logo')}<span>Fresco<b>Stock</b></span></div>
      <nav class="nav">${rutas.map(link).join('')}</nav>
      <div class="side-foot">
        <span class="modo ${store.mode}">${store.mode === 'firebase' ? 'Conectado a Firebase' : 'Modo demo · datos en este navegador'}</span>
      </div>
    </aside>
    <div class="content">
      <header class="top">
        <div class="top-title"><h1>${r.titulo}</h1><p>${r.sub}</p></div>
        <div class="top-actions">
          ${instalador ? `<button class="btn soft sm" data-act="instalar">${icon('download')}<span>Instalar app</span></button>` : ''}
          <button class="icon-btn bell" data-act="ir" data-ruta="alertas" aria-label="Alertas: ${nAlertas}">${icon('bell')}${nAlertas ? `<em>${nAlertas}</em>` : ''}</button>
          <div class="me">
            <button class="me-btn" data-act="menu" aria-expanded="${ui.menu}"><span class="avatar">${esc(sesion.nombre[0])}</span><span class="me-txt"><b>${esc(sesion.nombre)}</b><small>${ROL[sesion.rol]}</small></span></button>
            ${ui.menu ? `<div class="menu">
              ${store.mode === 'local' ? `<button data-act="reset">${icon('refresh')}Reiniciar datos de la demo</button>` : ''}
              <button data-act="salir">${icon('logout')}Cerrar sesión</button></div>` : ''}
          </div>
        </div>
      </header>
      <main class="view">${contenido}</main>
    </div>
    <nav class="bottom-nav">${rutas.map(link).join('')}</nav>
  </div>`;
}

// ---------- login ----------
function vistaLogin() {
  const demo = store.mode === 'local';
  const cuentas = S().usuarios.filter(u => u.activo);
  return `
  <div class="login">
    <div class="login-card">
      <div class="login-hero">${tomi('feliz', 'tomi-login')}<div class="bubble">¡Hola! Soy Tomi. Entra y revisamos juntos el inventario.</div></div>
      <h1>Fresco<b>Stock</b></h1>
      <p class="muted">Inventario del supermercado</p>
      <form id="login-form" class="stack">
        <label class="field"><span>Correo</span><input id="login-email" name="email" type="email" required autocomplete="username" placeholder="tu.correo@super.com"></label>
        ${demo ? '' : '<label class="field"><span>Contraseña</span><input id="login-pass" name="password" type="password" required autocomplete="current-password"></label>'}
        <p class="form-error" id="login-error" hidden></p>
        <button class="btn primary block" type="submit">Entrar</button>
      </form>
      ${demo ? `<div class="demo-box">
        <p><b>Modo demo.</b> Entra con un rol para probar:</p>
        <div class="demo-users">${cuentas.map(u => `<button class="btn soft sm" data-act="demo-login" data-email="${esc(u.email)}">${ROL[u.rol]} · ${esc(u.nombre.split(' ')[0])}</button>`).join('')}</div>
      </div>` : ''}
    </div>
  </div>`;
}

// ---------- vistas ----------
const VISTAS = { inicio: vistaInicio, caja: vistaCaja, productos: vistaProductos, recepcion: vistaRecepcion, proveedores: vistaProveedores, alertas: vistaAlertas, historial: vistaHistorial, usuarios: vistaUsuarios };

function pillStock(p) {
  if (p.stock <= 0) return '<span class="pill bad">Agotado</span>';
  if (p.stock <= p.stockMinimo) return '<span class="pill warn">Bajo</span>';
  return '<span class="pill ok">Disponible</span>';
}
function barraStock(p) {
  const pct = Math.min(100, (p.stock / Math.max(1, p.stockMinimo * 3)) * 100);
  const c = p.stock <= 0 ? 'bad' : p.stock <= p.stockMinimo ? 'warn' : 'ok';
  return `<div class="meter"><i class="${c}" style="width:${pct}%"></i></div>`;
}

function vistaInicio() {
  const s = S();
  const hoy0 = inicioDia();
  const pagadas = s.facturas.filter(f => f.estado === 'pagada');
  const hoy = pagadas.filter(f => f.fecha >= hoy0);
  const semana = pagadas.filter(f => f.fecha >= hoy0 - 6 * DIA);
  const ventasHoy = sum(hoy, f => f.total);
  const entregas7 = s.entregas.filter(e => e.fecha >= hoy0 - 6 * DIA);
  const bajos = activos().filter(p => p.stock <= p.stockMinimo).sort((a, b) => a.stock / a.stockMinimo - b.stock / b.stockMinimo);
  const valorInv = sum(activos(), p => p.stock * (p.costo || 0));

  const dias = Array.from({ length: 7 }, (_, k) => {
    const ini = hoy0 - (6 - k) * DIA;
    return { ini, total: sum(pagadas.filter(f => f.fecha >= ini && f.fecha < ini + DIA), f => f.total) };
  });
  const maxDia = Math.max(1, ...dias.map(d => d.total));
  const porCat = s.categorias.map(c => ({ c, total: sum(semana, f => sum(f.items.filter(l => l.categoriaId === c.id), l => l.cantidad * l.precio)) })).sort((a, b) => b.total - a.total);
  const maxCat = Math.max(1, ...porCat.map(x => x.total));
  const estado = bajos.length ? 'preocupado' : 'feliz';
  const frase = bajos.length
    ? `Hay ${bajos.length} producto${bajos.length > 1 ? 's' : ''} bajo el mínimo. ¡Toca reabastecer!`
    : '¡Todo el stock está en orden! Buen trabajo.';
  const semilla = store.mode === 'firebase' && !s.productos.length && puede('admin');

  return `
  ${semilla ? `<div class="card banner"><div><b>Tu base de datos está vacía.</b><p class="muted">Carga categorías, proveedores y productos de ejemplo para empezar.</p></div><button class="btn primary" data-act="semilla">Cargar datos de ejemplo</button></div>` : ''}
  <div class="greet card">
    ${tomi(estado, 'tomi-greet')}
    <div><h2>¡Hola, ${esc(sesion.nombre.split(' ')[0])}!</h2><p>${frase}</p></div>
    <div class="greet-actions">
      ${puede('admin', 'cajero') ? `<button class="btn primary" data-act="ir" data-ruta="caja">${icon('cart')}Nueva venta</button>` : ''}
      ${puede('admin', 'bodega') ? `<button class="btn soft" data-act="ir" data-ruta="recepcion">${icon('truck')}Recibir proveedor</button>` : ''}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><span>Ventas de hoy</span><b>${money(ventasHoy)}</b><small>${hoy.length} facturas</small></div>
    <div class="kpi"><span>Ticket promedio</span><b>${money(hoy.length ? ventasHoy / hoy.length : 0)}</b><small>por factura hoy</small></div>
    <div class="kpi"><span>Recibido en 7 días</span><b>${Math.round(sum(entregas7, e => e.totalUnidades)).toLocaleString('es-CO')} <i>und</i></b><small>${entregas7.length} entregas · ${money(sum(entregas7, e => e.totalCosto))}</small></div>
    <div class="kpi ${bajos.length ? 'alert' : ''}"><span>Bajo el mínimo</span><b>${bajos.length}</b><small>de ${activos().length} productos</small></div>
    <div class="kpi"><span>Valor del inventario</span><b>${moneyCorto(valorInv)}</b><small>a precio de costo</small></div>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h3>Ventas de los últimos 7 días</h3><span class="muted">${money(sum(semana, f => f.total))}</span></div>
      <div class="chart">${dias.map((d, i) => `<div class="col ${i === 6 ? 'hoy' : ''}">
        <span class="val">${d.total ? moneyCorto(d.total) : '–'}</span>
        <div class="bar-wrap"><div class="bar" style="height:${(d.total / maxDia) * 100}%"></div></div>
        <span class="lbl">${i === 6 ? 'Hoy' : new Date(d.ini).toLocaleDateString('es-CO', { weekday: 'short' })}</span></div>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Ventas por categoría</h3><span class="muted">7 días</span></div>
      <div class="hbars">${porCat.map(x => `<div class="hbar"><span>${x.c.icono} ${esc(x.c.nombre)}</span><div class="track"><i style="width:${(x.total / maxCat) * 100}%"></i></div><b>${moneyCorto(x.total)}</b></div>`).join('')}</div>
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h3>Stock bajo</h3><button class="link" data-act="ir" data-ruta="alertas">Ver alertas</button></div>
      ${bajos.length ? `<ul class="list">${bajos.slice(0, 6).map(p => `<li>
        <div class="li-main"><b>${esc(p.nombre)}</b><small>${fmtCant(p.stock, p.unidad)} · mínimo ${fmtCant(p.stockMinimo, p.unidad)}</small></div>
        ${pillStock(p)}
        ${puede('admin', 'bodega') ? `<button class="btn soft sm" data-act="recibir" data-id="${p.id}">Pedir</button>` : ''}</li>`).join('')}</ul>`
        : `<div class="empty">${tomi('feliz', 'tomi-empty')}<p>Ningún producto bajo el mínimo.</p></div>`}
    </section>
    <section class="card">
      <div class="card-head"><h3>Últimas facturas</h3>${puede('admin', 'cajero') ? '<button class="link" data-act="ir" data-ruta="caja">Ir a caja</button>' : ''}</div>
      <ul class="list">${s.facturas.slice(0, 6).map(f => `<li>
        <div class="li-main"><b class="mono">${f.numero}</b><small>${fechaHora(f.fecha)} · ${esc(f.cajeroNombre)}</small></div>
        ${f.estado === 'anulada' ? '<span class="pill bad">Anulada</span>' : ''}
        <b class="num">${money(f.total)}</b></li>`).join('') || '<li class="muted">Todavía no hay ventas.</li>'}</ul>
    </section>
  </div>`;
}

function chipsCategorias(actual, act, contar) {
  const s = S();
  return `<div class="chips" role="tablist">
    <button class="chip ${actual === 'todas' ? 'on' : ''}" data-act="${act}" data-cat="todas">Todas <em>${contar('todas')}</em></button>
    ${s.categorias.slice().sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)).map(c => `<button class="chip ${actual === c.id ? 'on' : ''}" data-act="${act}" data-cat="${c.id}">${c.icono} ${esc(c.nombre)} <em>${contar(c.id)}</em></button>`).join('')}
  </div>`;
}
function filtrar(lista, cat, q) {
  const t = q.trim().toLowerCase();
  return lista.filter(p => (cat === 'todas' || p.categoriaId === cat) && (!t || p.nombre.toLowerCase().includes(t) || String(p.codigoBarras).includes(t)));
}

function vistaProductos() {
  const lista = filtrar(activos(), ui.prodCat, ui.prodQ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const contar = c => activos().filter(p => c === 'todas' || p.categoriaId === c).length;
  return `
  <div class="toolbar">
    <label class="search">${icon('search')}<input id="prodQ" data-bind="prodQ" value="${esc(ui.prodQ)}" placeholder="Buscar por nombre o código de barras" aria-label="Buscar productos"></label>
    ${puede('admin') ? `<button class="btn soft" data-act="categorias">Categorías</button><button class="btn primary" data-act="prod-nuevo">${icon('plus')}Producto</button>` : ''}
  </div>
  ${chipsCategorias(ui.prodCat, 'prod-cat', contar)}
  <div class="card flush">
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th>Stock</th><th>Estado</th><th class="r">Acciones</th></tr></thead>
      <tbody>${lista.map(p => `<tr>
        <td><b>${esc(p.nombre)}</b><small class="mono block">${esc(p.codigoBarras)}</small></td>
        <td>${categoria(p.categoriaId)?.icono ?? ''} ${esc(categoria(p.categoriaId)?.nombre ?? 'Sin categoría')}</td>
        <td class="r num">${money(p.precioVenta)}<small class="block muted">/${p.unidad}</small></td>
        <td class="stock-cell"><span class="num">${fmtCant(p.stock, p.unidad)}</span>${barraStock(p)}<small class="muted">mín. ${p.stockMinimo}</small></td>
        <td>${pillStock(p)}</td>
        <td class="r actions">
          ${puede('admin', 'bodega') ? `<button class="icon-btn" data-act="prod-ajustar" data-id="${p.id}" title="Ajustar stock" aria-label="Ajustar stock de ${esc(p.nombre)}">${icon('adjust')}</button>` : ''}
          ${puede('admin') ? `<button class="icon-btn" data-act="prod-editar" data-id="${p.id}" title="Editar" aria-label="Editar ${esc(p.nombre)}">${icon('edit')}</button>
          <button class="icon-btn danger" data-act="prod-eliminar" data-id="${p.id}" title="Eliminar" aria-label="Eliminar ${esc(p.nombre)}">${icon('trash')}</button>` : ''}
        </td></tr>`).join('')}</tbody>
    </table></div>
    ${lista.length ? '' : `<div class="empty">${tomi('preocupado', 'tomi-empty')}<p>No encontré productos con ese filtro.</p></div>`}
  </div>`;
}

function vistaCaja() {
  const s = S();
  const lista = filtrar(activos(), ui.cajaCat, ui.cajaQ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const contar = c => activos().filter(p => c === 'todas' || p.categoriaId === c).length;
  const lineas = ui.carrito.map(it => ({ ...it, p: s.productos.find(p => p.id === it.productoId) })).filter(l => l.p);
  const total = sum(lineas, l => Math.round(l.cantidad * l.p.precioVenta));
  const hoy0 = inicioDia();
  const hoy = s.facturas.filter(f => f.fecha >= hoy0);
  return `
  <div class="pos">
    <div class="pos-catalog">
      <label class="search">${icon('search')}<input id="cajaQ" data-bind="cajaQ" value="${esc(ui.cajaQ)}" placeholder="Buscar o escanear código y Enter" aria-label="Buscar producto para vender"></label>
      ${chipsCategorias(ui.cajaCat, 'caja-cat', contar)}
      <div class="tiles">${lista.map(p => `<button class="tile ${p.stock <= 0 ? 'off' : ''}" data-act="agregar" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
          <span class="tile-emoji">${categoria(p.categoriaId)?.icono ?? '🛒'}</span>
          <b>${esc(p.nombre)}</b>
          <span class="tile-price">${money(p.precioVenta)}<small>/${p.unidad}</small></span>
          <small class="${p.stock <= p.stockMinimo ? 'warn-t' : 'muted'}">${p.stock <= 0 ? 'Agotado' : 'Quedan ' + fmtCant(p.stock, p.unidad)}</small>
        </button>`).join('') || `<div class="empty">${tomi('preocupado', 'tomi-empty')}<p>Sin resultados.</p></div>`}</div>
    </div>
    <aside class="ticket card">
      <div class="card-head"><h3>Venta actual</h3><span class="mono muted">${store.numeroSiguiente()}</span></div>
      ${lineas.length ? `<ul class="cart">${lineas.map(l => `<li>
          <div class="li-main"><b>${esc(l.p.nombre)}</b><small>${money(l.p.precioVenta)} / ${l.p.unidad}</small></div>
          <div class="qty"><button class="icon-btn sm" data-act="menos" data-id="${l.p.id}" aria-label="Quitar uno">${icon('minus')}</button><span class="num">${fmtCant(l.cantidad, l.p.unidad)}</span><button class="icon-btn sm" data-act="mas" data-id="${l.p.id}" aria-label="Agregar uno">${icon('plus')}</button></div>
          <b class="num">${money(l.cantidad * l.p.precioVenta)}</b>
        </li>`).join('')}</ul>`
        : `<div class="empty small">${tomi('feliz', 'tomi-empty')}<p>Toca un producto o escanea su código para empezar.</p></div>`}
      <div class="total"><span>Total <small>IVA incluido</small></span><b class="num">${money(total)}</b></div>
      <div class="row">
        <button class="btn ghost" data-act="vaciar" ${lineas.length ? '' : 'disabled'}>Vaciar</button>
        <button class="btn accent grow" data-act="cobrar" ${lineas.length ? '' : 'disabled'}>Cobrar y facturar</button>
      </div>
    </aside>
  </div>
  <section class="card">
    <div class="card-head"><h3>Facturas de hoy</h3><span class="muted">${hoy.filter(f => f.estado === 'pagada').length} pagadas · ${money(sum(hoy.filter(f => f.estado === 'pagada'), f => f.total))}</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Factura</th><th>Hora</th><th>Cajero</th><th class="r">Productos</th><th class="r">Total</th><th>Estado</th><th class="r"></th></tr></thead>
      <tbody>${hoy.map(f => `<tr>
        <td class="mono">${f.numero}</td><td>${hora(f.fecha)}</td><td>${esc(f.cajeroNombre)}</td><td class="r">${f.items.length}</td>
        <td class="r num"><b>${money(f.total)}</b></td>
        <td>${f.estado === 'anulada' ? '<span class="pill bad">Anulada</span>' : '<span class="pill ok">Pagada</span>'}</td>
        <td class="r actions"><button class="btn soft sm" data-act="factura-ver" data-id="${f.id}">Ver</button>
          ${puede('admin') && f.estado === 'pagada' ? `<button class="btn ghost sm" data-act="factura-anular" data-id="${f.id}">Anular</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aún no hay facturas hoy.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

function vistaRecepcion() {
  const s = S();
  const prov = s.proveedores.find(p => p.id === ui.recep.proveedorId);
  const opciones = activos()
    .filter(p => !prov?.categorias?.length || prov.categorias.includes(p.categoriaId))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const filas = ui.recep.items;
  const totU = sum(filas, f => Number(f.cantidad) || 0);
  const totC = sum(filas, f => (Number(f.cantidad) || 0) * (Number(f.costoUnit) || 0));
  const hace30 = inicioDia() - 29 * DIA;
  const resumen = s.proveedores.map(p => {
    const es = s.entregas.filter(e => e.proveedorId === p.id && e.fecha >= hace30);
    return { p, n: es.length, u: sum(es, e => e.totalUnidades), c: sum(es, e => e.totalCosto) };
  }).sort((a, b) => b.c - a.c);

  return `
  <div class="grid-recep">
    <section class="card">
      <div class="card-head"><h3>Nueva entrega</h3><span class="muted">${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <label class="field"><span>Proveedor</span>
        <select id="rec-prov" data-recprov>
          <option value="">Elige el proveedor…</option>
          ${s.proveedores.map(p => `<option value="${p.id}" ${p.id === ui.recep.proveedorId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}
        </select></label>
      <div class="table-wrap"><table class="table form-table">
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unit.</th><th>Lote</th><th>Vence</th><th></th></tr></thead>
        <tbody>${filas.map((f, i) => {
          const p = s.productos.find(x => x.id === f.productoId);
          return `<tr>
          <td><select id="rec-productoId-${i}" data-rec="productoId" data-i="${i}" aria-label="Producto">
            <option value="">Producto…</option>
            ${opciones.map(o => `<option value="${o.id}" ${o.id === f.productoId ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}
          </select></td>
          <td><div class="with-unit"><input id="rec-cantidad-${i}" data-rec="cantidad" data-i="${i}" type="number" min="0" step="${p?.unidad === 'kg' ? '0.1' : '1'}" value="${esc(f.cantidad)}" aria-label="Cantidad"><span>${p?.unidad ?? ''}</span></div></td>
          <td><input id="rec-costoUnit-${i}" data-rec="costoUnit" data-i="${i}" type="number" min="0" step="50" value="${esc(f.costoUnit)}" aria-label="Costo unitario"></td>
          <td><input id="rec-lote-${i}" data-rec="lote" data-i="${i}" value="${esc(f.lote)}" placeholder="L-0000" aria-label="Lote"></td>
          <td><input id="rec-vence-${i}" data-rec="vence" data-i="${i}" type="date" value="${esc(f.vence)}" aria-label="Fecha de vencimiento"></td>
          <td><button class="icon-btn danger" data-act="rec-quitar" data-i="${i}" aria-label="Quitar fila">${icon('x')}</button></td></tr>`;
        }).join('')}</tbody>
      </table></div>
      <button class="btn ghost sm" data-act="rec-fila">${icon('plus')}Agregar producto</button>
      <div class="recep-foot">
        <div><b class="num" id="rec-tot-u">${totU.toLocaleString('es-CO')}</b> unidades · <b class="num" id="rec-tot-c">${money(totC)}</b></div>
        <button class="btn primary" data-act="rec-registrar">${icon('check')}Registrar y sumar al stock</button>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Recibido por proveedor</h3><span class="muted">últimos 30 días</span></div>
      <div class="table-wrap"><table class="table compact">
        <thead><tr><th>Proveedor</th><th class="r">Entregas</th><th class="r">Unidades</th><th class="r">Costo</th></tr></thead>
        <tbody>${resumen.map(x => `<tr><td>${esc(x.p.nombre)}</td><td class="r">${x.n}</td><td class="r num">${Math.round(x.u).toLocaleString('es-CO')}</td><td class="r num">${money(x.c)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="r">${sum(resumen, x => x.n)}</td><td class="r num">${Math.round(sum(resumen, x => x.u)).toLocaleString('es-CO')}</td><td class="r num">${money(sum(resumen, x => x.c))}</td></tr></tfoot>
      </table></div>
      <div class="card-head sub"><h3>Entregas recientes</h3></div>
      <ul class="list">${s.entregas.slice(0, 6).map(e => `<li>
        <div class="li-main"><b>${esc(e.proveedorNombre)}</b><small>${fechaHora(e.fecha)} · recibió ${esc(e.recibidoPor)}</small></div>
        <span class="pill info">+${Math.round(e.totalUnidades)} und</span>
        <button class="btn soft sm" data-act="entrega-ver" data-id="${e.id}">Ver</button></li>`).join('') || '<li class="muted">Aún no hay entregas.</li>'}</ul>
    </section>
  </div>`;
}

function vistaProveedores() {
  const s = S();
  return `
  <div class="toolbar"><span class="muted">${s.proveedores.length} proveedores</span>
    ${puede('admin') ? `<button class="btn primary" data-act="prov-nuevo">${icon('plus')}Proveedor</button>` : ''}</div>
  <div class="cards">${s.proveedores.map(p => {
    const es = s.entregas.filter(e => e.proveedorId === p.id);
    return `<article class="card prov">
      <div class="prov-head"><span class="avatar lg">${esc(p.nombre[0])}</span><div><h3>${esc(p.nombre)}</h3><small class="mono muted">NIT ${esc(p.nit)}</small></div></div>
      <dl class="dl"><dt>Contacto</dt><dd>${esc(p.contacto || '—')}</dd><dt>Teléfono</dt><dd class="mono">${esc(p.telefono || '—')}</dd>
        <dt>Surte</dt><dd>${(p.categorias || []).map(c => `${categoria(c)?.icono ?? ''} ${esc(categoria(c)?.nombre ?? c)}`).join(', ') || '—'}</dd>
        <dt>Entregas</dt><dd>${es.length} · ${Math.round(sum(es, e => e.totalUnidades)).toLocaleString('es-CO')} und · ${money(sum(es, e => e.totalCosto))}</dd>
        <dt>Última</dt><dd>${es[0] ? fechaHora(es[0].fecha) : 'Sin entregas'}</dd></dl>
      ${puede('admin') ? `<div class="row end"><button class="btn ghost sm" data-act="prov-eliminar" data-id="${p.id}">${icon('trash')}Eliminar</button><button class="btn soft sm" data-act="prov-editar" data-id="${p.id}">${icon('edit')}Editar</button></div>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function vistaAlertas() {
  const s = S();
  const activas = s.alertas.filter(a => !a.atendida).sort((a, b) => (a.tipo === 'agotado' ? -1 : 0) - (b.tipo === 'agotado' ? -1 : 0) || b.fecha - a.fecha);
  const atendidas = s.alertas.filter(a => a.atendida).sort((a, b) => (b.fechaAtendida || 0) - (a.fechaAtendida || 0)).slice(0, 8);
  const hoy = new Date(inicioDia()).toISOString().slice(0, 10);
  const limite = new Date(inicioDia() + 7 * DIA).toISOString().slice(0, 10);
  const vencen = [];
  for (const e of s.entregas) for (const l of e.items) {
    const p = s.productos.find(x => x.id === l.productoId);
    if (l.vence && l.vence >= hoy && l.vence <= limite && p?.activo !== false && p?.stock > 0) vencen.push({ ...l, proveedor: e.proveedorNombre });
  }
  vencen.sort((a, b) => a.vence.localeCompare(b.vence));
  const diasPara = v => Math.round((new Date(v + 'T00:00:00') - inicioDia()) / DIA);
  return `
  <div class="greet card ${activas.length ? 'warn-bg' : ''}">
    ${tomi(activas.length ? 'preocupado' : 'celebrando', 'tomi-greet')}
    <div><h2>${activas.length ? `${activas.length} alerta${activas.length > 1 ? 's' : ''} por atender` : '¡Sin alertas pendientes!'}</h2>
    <p>${activas.length ? 'Se crean solas cuando un producto queda en su stock mínimo o se agota, y se cierran solas cuando entra mercancía.' : 'El inventario está sano. Tomi está feliz.'}</p></div>
  </div>
  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h3>Stock bajo y agotados</h3></div>
      <ul class="list">${activas.map(a => `<li class="alert-li ${a.tipo}">
        <div class="li-main"><b>${esc(a.productoNombre)}</b><small>Quedan ${a.stock} · mínimo ${a.stockMinimo ?? '—'} · ${fechaHora(a.fecha)}</small></div>
        <span class="pill ${a.tipo === 'agotado' ? 'bad' : 'warn'}">${a.tipo === 'agotado' ? 'Agotado' : 'Stock bajo'}</span>
        <div class="row">${puede('admin', 'bodega') ? `<button class="btn soft sm" data-act="recibir" data-id="${a.productoId}">Recibir</button>` : ''}
        <button class="btn ghost sm" data-act="alerta-atender" data-id="${a.id}">${icon('check')}Atendida</button></div></li>`).join('') || `<li class="muted">Nada por aquí.</li>`}</ul>
    </section>
    <section class="card">
      <div class="card-head"><h3>Por vencer en 7 días</h3><span class="muted">según lotes recibidos</span></div>
      <ul class="list">${vencen.map(v => { const d = diasPara(v.vence); return `<li>
        <div class="li-main"><b>${esc(v.nombre)}</b><small>Lote ${esc(v.lote || '—')} · ${esc(v.proveedor)} · ${fmtCant(v.cantidad, v.unidad)}</small></div>
        <span class="pill ${d <= 2 ? 'bad' : 'warn'}">${d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `En ${d} días`}</span></li>`; }).join('') || '<li class="muted">Ningún lote vence esta semana.</li>'}</ul>
      <div class="card-head sub"><h3>Atendidas recientemente</h3></div>
      <ul class="list dim">${atendidas.map(a => `<li><div class="li-main"><b>${esc(a.productoNombre)}</b><small>${a.resuelta === 'auto' ? 'Se cerró sola al entrar mercancía' : 'Atendida por ' + esc(a.atendidaPor ?? '—')} · ${a.fechaAtendida ? fechaHora(a.fechaAtendida) : ''}</small></div><span class="pill ok">Resuelta</span></li>`).join('') || '<li class="muted">Ninguna todavía.</li>'}</ul>
    </section>
  </div>`;
}

function vistaHistorial() {
  const s = S();
  const tipos = { entrada: ['Entrada', 'ok'], salida: ['Salida', 'info'], ajuste: ['Ajuste', 'warn'] };
  const movs = s.movimientos.filter(m => ui.histTipo === 'todos' || m.tipo === ui.histTipo).slice(0, 150);
  return `
  <div class="chips">
    <button class="chip ${ui.histTab === 'actividad' ? 'on' : ''}" data-act="hist-tab" data-tab="actividad">Actividad del equipo</button>
    <button class="chip ${ui.histTab === 'movimientos' ? 'on' : ''}" data-act="hist-tab" data-tab="movimientos">Movimientos de stock</button>
  </div>
  ${ui.histTab === 'actividad' ? `
  <section class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead>
    <tbody>${s.historial.slice(0, 150).map(h => `<tr><td class="nowrap">${fechaHora(h.fecha)}</td><td>${esc(h.usuarioNombre)}</td><td>${esc(h.accion)}</td></tr>`).join('')}</tbody>
  </table></div></section>` : `
  <div class="chips small">${['todos', 'entrada', 'salida', 'ajuste'].map(t => `<button class="chip ${ui.histTipo === t ? 'on' : ''}" data-act="hist-tipo" data-tipo="${t}">${t === 'todos' ? 'Todos' : tipos[t][0] + 's'}</button>`).join('')}</div>
  <section class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="r">Cantidad</th><th class="r">Stock</th><th>Origen</th><th>Usuario</th></tr></thead>
    <tbody>${movs.map(m => `<tr>
      <td class="nowrap">${fechaHora(m.fecha)}</td><td>${esc(m.productoNombre)}</td>
      <td><span class="pill ${tipos[m.tipo][1]}">${tipos[m.tipo][0]}</span></td>
      <td class="r num ${m.cantidad > 0 ? 'pos-t' : 'neg-t'}">${m.cantidad > 0 ? '+' : ''}${Number(m.cantidad).toLocaleString('es-CO')}</td>
      <td class="r num nowrap">${m.stockAntes != null ? `${m.stockAntes} → ${m.stockDespues}` : '—'}</td>
      <td class="mono small">${esc(m.origen)}${m.motivo ? `<small class="block muted">${esc(m.motivo)}</small>` : ''}</td><td>${esc(m.usuarioNombre)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin movimientos.</td></tr>'}</tbody>
  </table></div></section>`}`;
}

function vistaUsuarios() {
  const s = S();
  return `
  <div class="toolbar"><span class="muted">${s.usuarios.filter(u => u.activo).length} activos de ${s.usuarios.length}</span>
    <button class="btn primary" data-act="user-nuevo">${icon('plus')}Empleado</button></div>
  <section class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>Empleado</th><th>Correo</th><th>Rol</th><th>Turno</th><th>Estado</th><th class="r">Acciones</th></tr></thead>
    <tbody>${s.usuarios.map(u => `<tr>
      <td><div class="who"><span class="avatar">${esc(u.nombre[0])}</span><div><b>${esc(u.nombre)}</b><small class="block muted">CC ${esc(u.cedula || '—')}</small></div></div></td>
      <td class="mono small">${esc(u.email)}</td><td><span class="pill role-${u.rol}">${ROL[u.rol]}</span></td><td>${esc(u.turno || '—')}</td>
      <td>${u.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill bad">Inactivo</span>'}</td>
      <td class="r actions"><button class="icon-btn" data-act="user-editar" data-id="${u.id}" aria-label="Editar ${esc(u.nombre)}">${icon('edit')}</button>
        ${u.id !== sesion.id ? `<button class="icon-btn danger" data-act="user-eliminar" data-id="${u.id}" aria-label="Eliminar ${esc(u.nombre)}">${icon('trash')}</button>` : ''}</td></tr>`).join('')}</tbody>
  </table></div></section>
  ${store.mode === 'firebase' ? '<p class="muted note">La contraseña de cada empleado se crea en Firebase Authentication con el mismo correo.</p>' : ''}`;
}

// ---------- modal y avisos ----------
function abrirModal({ titulo, cuerpo, enviar, peligro = false, onSubmit, clase = '', extra = '' }) {
  const d = $('#modal');
  d.className = clase;
  d.innerHTML = `<form id="modal-form">
    <header class="modal-head"><h2>${esc(titulo)}</h2><button type="button" class="icon-btn" data-act="modal-cerrar" aria-label="Cerrar">${icon('x')}</button></header>
    <div class="modal-body">${cuerpo}</div>
    <p class="form-error" id="modal-error" hidden></p>
    <footer class="modal-foot">${extra}<button type="button" class="btn ghost" data-act="modal-cerrar">${onSubmit ? 'Cancelar' : 'Cerrar'}</button>
      ${onSubmit ? `<button class="btn ${peligro ? 'danger' : 'primary'}" type="submit">${esc(enviar)}</button>` : ''}</footer>
  </form>`;
  const form = $('#modal-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) return d.close();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try { await onSubmit(new FormData(form)); d.close(); } catch (err) {
      const p = $('#modal-error'); p.textContent = err.message; p.hidden = false;
    } finally { btn.disabled = false; }
  });
  d.showModal();
  d.querySelector('input:not([type=hidden]), select')?.focus();
}
function confirmar(titulo, texto, boton, accion) {
  abrirModal({ titulo, cuerpo: `<div class="confirm">${tomi('preocupado', 'tomi-confirm')}<p>${texto}</p></div>`, enviar: boton, peligro: true, onSubmit: accion });
}
function toast(msg, estado = 'feliz') {
  const t = document.createElement('div');
  t.className = 'toast ' + estado;
  t.setAttribute('role', 'status');
  t.innerHTML = tomi(estado, 'tomi-toast') + `<span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('fuera'), 3800);
  setTimeout(() => t.remove(), 4200);
}
const opt = (v, txt, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(txt)}</option>`;
const campo = (label, input, ayuda = '') => `<label class="field"><span>${label}</span>${input}${ayuda ? `<small class="muted">${ayuda}</small>` : ''}</label>`;

function formProducto(p) {
  const s = S();
  const nuevo = !p;
  p = p || { nombre: '', codigoBarras: '', categoriaId: ui.prodCat !== 'todas' ? ui.prodCat : s.categorias[0]?.id, unidad: 'und', precioVenta: '', costo: '', stockMinimo: 10, stock: 0 };
  abrirModal({
    titulo: nuevo ? 'Nuevo producto' : 'Editar producto', enviar: nuevo ? 'Crear producto' : 'Guardar cambios',
    cuerpo: `<div class="form-grid">
      ${campo('Nombre', `<input name="nombre" required value="${esc(p.nombre)}" placeholder="Leche entera 1 L">`)}
      ${campo('Código de barras', `<input name="codigoBarras" required inputmode="numeric" pattern="[0-9]{8,14}" value="${esc(p.codigoBarras)}" placeholder="7702001012345">`, 'EAN-13: 8 a 14 dígitos')}
      ${campo('Categoría', `<select name="categoriaId" required>${s.categorias.map(c => opt(c.id, `${c.icono} ${c.nombre}`, p.categoriaId)).join('')}</select>`)}
      ${campo('Unidad', `<select name="unidad">${opt('und', 'Unidad (und)', p.unidad)}${opt('kg', 'Kilogramo (kg)', p.unidad)}${opt('lt', 'Litro (lt)', p.unidad)}</select>`)}
      ${campo('Precio de venta', `<input name="precioVenta" type="number" min="0" step="50" required value="${esc(p.precioVenta)}">`)}
      ${campo('Costo', `<input name="costo" type="number" min="0" step="50" required value="${esc(p.costo)}">`)}
      ${campo('Stock mínimo', `<input name="stockMinimo" type="number" min="0" step="any" required value="${esc(p.stockMinimo)}">`, 'Al llegar aquí se crea una alerta')}
      ${nuevo ? campo('Stock inicial', `<input name="stock" type="number" min="0" step="any" value="0">`, 'Queda registrado como entrada') : campo('Stock actual', `<input value="${fmtCant(p.stock, p.unidad)}" disabled>`, 'Cambia con entregas, ventas o ajustes')}
    </div>`,
    onSubmit: async fd => {
      const data = {
        nombre: fd.get('nombre').trim(), codigoBarras: fd.get('codigoBarras').trim(), categoriaId: fd.get('categoriaId'), unidad: fd.get('unidad'),
        precioVenta: Number(fd.get('precioVenta')), costo: Number(fd.get('costo')), stockMinimo: Number(fd.get('stockMinimo')),
      };
      const dup = activos().find(x => x.codigoBarras === data.codigoBarras && x.id !== p.id);
      if (dup) throw new Error(`Ese código de barras ya es de "${dup.nombre}".`);
      if (nuevo) { await store.add('productos', { ...data, stock: Number(fd.get('stock')) || 0 }, sesion); toast(`Producto "${data.nombre}" creado.`, 'celebrando'); }
      else { await store.update('productos', p.id, data, sesion); toast('Cambios guardados.'); }
    },
  });
}

function formAjuste(p) {
  abrirModal({
    titulo: `Ajustar stock · ${p.nombre}`, enviar: 'Aplicar ajuste',
    cuerpo: `<p class="muted">Stock actual: <b>${fmtCant(p.stock, p.unidad)}</b>. Usa ajustes para mermas, daños o conteos físicos; las ventas y entregas se registran en sus pantallas.</p>
      <div class="form-grid">
      ${campo('Operación', `<select name="signo">${opt('-1', 'Restar', '-1')}${opt('1', 'Sumar', '')}</select>`)}
      ${campo('Cantidad', `<input name="cantidad" type="number" min="0" step="${p.unidad === 'und' ? '1' : '0.1'}" required>`)}
      ${campo('Motivo', `<select name="motivo">${['Merma', 'Producto dañado', 'Producto vencido', 'Conteo físico', 'Devolución de cliente'].map(m => opt(m, m, '')).join('')}</select>`)}
      ${campo('Nota (opcional)', '<input name="nota" placeholder="Ej: caja golpeada en bodega">')}
      </div>`,
    onSubmit: async fd => {
      const cantidad = r3(Number(fd.get('signo')) * Number(fd.get('cantidad')));
      const motivo = fd.get('motivo') + (fd.get('nota').trim() ? ` · ${fd.get('nota').trim()}` : '');
      await store.ajustarStock(p.id, cantidad, motivo, sesion);
      toast(`Stock de ${p.nombre} ajustado.`);
    },
  });
}

function formCategorias() {
  const s = S();
  abrirModal({
    titulo: 'Categorías', enviar: 'Agregar categoría',
    cuerpo: `<ul class="list">${s.categorias.map(c => `<li><div class="li-main"><b>${c.icono} ${esc(c.nombre)}</b><small>${activos().filter(p => p.categoriaId === c.id).length} productos</small></div>
        <button type="button" class="icon-btn danger" data-act="cat-eliminar" data-id="${c.id}" aria-label="Eliminar ${esc(c.nombre)}">${icon('trash')}</button></li>`).join('')}</ul>
      <div class="form-grid">${campo('Nueva categoría', '<input name="nombre" required placeholder="Carnes y pescados">')}${campo('Ícono', '<input name="icono" maxlength="4" placeholder="🥩" value="🛒">')}</div>`,
    onSubmit: async fd => {
      await store.add('categorias', { nombre: fd.get('nombre').trim(), icono: fd.get('icono').trim() || '🛒', orden: s.categorias.length + 1 }, sesion);
      toast('Categoría creada.', 'celebrando');
    },
  });
}

function formProveedor(p) {
  const s = S();
  const nuevo = !p;
  p = p || { nombre: '', nit: '', telefono: '', contacto: '', categorias: [] };
  abrirModal({
    titulo: nuevo ? 'Nuevo proveedor' : 'Editar proveedor', enviar: nuevo ? 'Crear proveedor' : 'Guardar cambios',
    cuerpo: `<div class="form-grid">
      ${campo('Nombre o razón social', `<input name="nombre" required value="${esc(p.nombre)}">`)}
      ${campo('NIT', `<input name="nit" required value="${esc(p.nit)}" placeholder="900123456-7">`)}
      ${campo('Contacto', `<input name="contacto" value="${esc(p.contacto)}">`)}
      ${campo('Teléfono', `<input name="telefono" type="tel" value="${esc(p.telefono)}">`)}
    </div>
    <fieldset class="checks"><legend>Categorías que surte</legend>${s.categorias.map(c => `<label><input type="checkbox" name="categorias" value="${c.id}" ${p.categorias?.includes(c.id) ? 'checked' : ''}> ${c.icono} ${esc(c.nombre)}</label>`).join('')}</fieldset>`,
    onSubmit: async fd => {
      const data = { nombre: fd.get('nombre').trim(), nit: fd.get('nit').trim(), contacto: fd.get('contacto').trim(), telefono: fd.get('telefono').trim(), categorias: fd.getAll('categorias') };
      if (nuevo) { await store.add('proveedores', { ...data, activo: true }, sesion); toast('Proveedor creado.', 'celebrando'); }
      else { await store.update('proveedores', p.id, data, sesion); toast('Cambios guardados.'); }
    },
  });
}

function formUsuario(u) {
  const nuevo = !u;
  u = u || { nombre: '', email: '', cedula: '', rol: 'cajero', turno: 'Mañana', activo: true };
  abrirModal({
    titulo: nuevo ? 'Nuevo empleado' : 'Editar empleado', enviar: nuevo ? 'Crear empleado' : 'Guardar cambios',
    cuerpo: `<div class="form-grid">
      ${campo('Nombre completo', `<input name="nombre" required value="${esc(u.nombre)}">`)}
      ${campo('Correo', `<input name="email" type="email" required value="${esc(u.email)}" ${nuevo ? '' : 'readonly'}>`, nuevo ? 'Con este correo inicia sesión' : 'El correo no se puede cambiar')}
      ${campo('Cédula', `<input name="cedula" value="${esc(u.cedula)}">`)}
      ${campo('Rol', `<select name="rol">${Object.entries(ROL).map(([k, v]) => opt(k, v, u.rol)).join('')}</select>`)}
      ${campo('Turno', `<select name="turno">${['Mañana', 'Tarde', 'Noche'].map(t => opt(t, t, u.turno)).join('')}</select>`)}
      <label class="field check-field"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''} ${u.id === sesion.id ? 'disabled' : ''}> <span>Puede iniciar sesión</span></label>
    </div>`,
    onSubmit: async fd => {
      const data = { nombre: fd.get('nombre').trim(), email: fd.get('email').trim().toLowerCase(), cedula: fd.get('cedula').trim(), rol: fd.get('rol'), turno: fd.get('turno'), activo: u.id === sesion.id ? true : fd.get('activo') === 'on' };
      if (u.id === sesion.id && data.rol !== 'admin') throw new Error('No puedes quitarte tu propio rol de administrador.');
      if (nuevo) { await store.add('usuarios', data, sesion); toast(`${data.nombre} ya puede usar FrescoStock.`, 'celebrando'); }
      else { await store.update('usuarios', u.id, data, sesion); if (u.id === sesion.id) Object.assign(sesion, data); toast('Cambios guardados.'); }
    },
  });
}

function htmlFactura(f) {
  return `<div class="invoice print-area">
    <div class="inv-head"><div><b class="inv-brand">FrescoStock</b><small>Supermercado · NIT 900.000.000-1</small></div><div class="r"><b class="mono">${f.numero}</b><small>${fechaHora(f.fecha)}</small></div></div>
    <table class="inv-table"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${f.items.map(l => `<tr><td>${esc(l.nombre)}</td><td class="r">${fmtCant(l.cantidad, l.unidad)}</td><td class="r">${money(l.precio)}</td><td class="r">${money(l.cantidad * l.precio)}</td></tr>`).join('')}</tbody></table>
    <div class="inv-total"><span>Total (IVA incluido)</span><b>${money(f.total)}</b></div>
    <small class="muted">Atendió: ${esc(f.cajeroNombre)}${f.estado === 'anulada' ? ' · <b class="neg-t">FACTURA ANULADA</b>' : ''}</small>
  </div>`;
}
function verFactura(f, recienCreada) {
  abrirModal({
    titulo: recienCreada ? '¡Venta registrada!' : `Factura ${f.numero}`, clase: 'wide',
    cuerpo: `${recienCreada ? `<div class="celebra">${tomi('celebrando', 'tomi-celebra')}<p>Factura generada y stock descontado automáticamente.</p></div>` : ''}${htmlFactura(f)}`,
    extra: `<button type="button" class="btn soft" data-act="imprimir">${icon('print')}Imprimir</button>`,
  });
}

// ---------- acciones ----------
const busca = (col, id) => S()[col].find(x => x.id === id);
const ACCIONES = {
  'ir': d => { ruta = d.ruta; ui.menu = false; render(); window.scrollTo({ top: 0 }); },
  'menu': () => { ui.menu = !ui.menu; render(); },
  'demo-login': async d => { try { sesion = await store.login(d.email); ruta = 'inicio'; render(); toast(`¡Bienvenido, ${sesion.nombre.split(' ')[0]}!`, 'celebrando'); } catch (e) { toast(e.message, 'preocupado'); } },
  'salir': async () => { await store.logout(); sesion = null; ui.menu = false; ui.carrito = []; render(); },
  'instalar': async () => { if (!instalador) return; instalador.prompt(); await instalador.userChoice; instalador = null; render(); },
  'reset': () => { ui.menu = false; render(); confirmar('Reiniciar demo', 'Se borran tus cambios y vuelven los datos de ejemplo.', 'Reiniciar', async () => { await store.reset(); ui.carrito = []; ui.recep = { proveedorId: '', items: [filaVacia()] }; toast('Datos de la demo reiniciados.'); }); },
  'semilla': async () => { try { await store.reset(); toast('Datos de ejemplo cargados.', 'celebrando'); } catch (e) { toast(e.message, 'preocupado'); } },
  'modal-cerrar': () => $('#modal').close(),
  'imprimir': () => window.print(),

  'prod-cat': d => { ui.prodCat = d.cat; render(); },
  'prod-nuevo': () => formProducto(),
  'prod-editar': d => formProducto(busca('productos', d.id)),
  'prod-ajustar': d => formAjuste(busca('productos', d.id)),
  'prod-eliminar': d => { const p = busca('productos', d.id); confirmar('Eliminar producto', `"${esc(p.nombre)}" dejará de aparecer en caja y en el catálogo. Su historial se conserva.`, 'Eliminar', async () => { await store.remove('productos', p.id, sesion); toast('Producto eliminado.'); }); },
  'categorias': () => formCategorias(),
  'cat-eliminar': async d => { try { await store.remove('categorias', d.id, sesion); formCategorias(); toast('Categoría eliminada.'); } catch (e) { const p = $('#modal-error'); p.textContent = e.message; p.hidden = false; } },

  'caja-cat': d => { ui.cajaCat = d.cat; render(); },
  'agregar': d => agregarAlCarrito(d.id),
  'mas': d => agregarAlCarrito(d.id),
  'menos': d => {
    const it = ui.carrito.find(i => i.productoId === d.id); const p = busca('productos', d.id);
    it.cantidad = r3(it.cantidad - (p.unidad === 'kg' ? 0.5 : 1));
    if (it.cantidad <= 0) ui.carrito = ui.carrito.filter(i => i !== it);
    render();
  },
  'vaciar': () => { ui.carrito = []; render(); },
  'cobrar': async (d, btn) => {
    btn.disabled = true;
    try { const f = await store.crearFactura(ui.carrito.map(i => ({ ...i })), sesion); ui.carrito = []; render(); verFactura(f, true); }
    catch (e) { btn.disabled = false; toast(e.message, 'preocupado'); }
  },
  'factura-ver': d => verFactura(busca('facturas', d.id)),
  'factura-anular': d => { const f = busca('facturas', d.id); confirmar('Anular factura', `La factura ${f.numero} por ${money(f.total)} quedará anulada y sus productos volverán al stock.`, 'Anular factura', async () => { await store.anularFactura(f.id, sesion); toast(`${f.numero} anulada. Stock devuelto.`); }); },

  'recibir': d => {
    const p = busca('productos', d.id);
    const prov = S().proveedores.find(x => x.categorias?.includes(p.categoriaId));
    ui.recep = { proveedorId: prov?.id ?? '', items: [{ ...filaVacia(), productoId: p.id, costoUnit: p.costo ?? '', cantidad: Math.max(p.stockMinimo * 2 - p.stock, 1) }] };
    ruta = 'recepcion'; render();
  },
  'rec-fila': () => { ui.recep.items.push(filaVacia()); render(); },
  'rec-quitar': d => { ui.recep.items.splice(Number(d.i), 1); if (!ui.recep.items.length) ui.recep.items.push(filaVacia()); render(); },
  'rec-registrar': async (d, btn) => {
    const filas = ui.recep.items.filter(f => f.productoId || f.cantidad);
    btn.disabled = true;
    try {
      const e = await store.registrarEntrega({ proveedorId: ui.recep.proveedorId, items: filas.map(f => ({ productoId: f.productoId, cantidad: Number(f.cantidad), costoUnit: Number(f.costoUnit), lote: f.lote.trim(), vence: f.vence })) }, sesion);
      ui.recep = { proveedorId: '', items: [filaVacia()] };
      render();
      toast(`Entrega de ${e.proveedorNombre} registrada: +${e.totalUnidades} al stock.`, 'celebrando');
    } catch (err) { btn.disabled = false; toast(err.message, 'preocupado'); }
  },
  'entrega-ver': d => {
    const e = busca('entregas', d.id);
    abrirModal({ titulo: `Entrega de ${e.proveedorNombre}`, clase: 'wide', cuerpo: `<p class="muted">${fechaHora(e.fecha)} · recibió ${esc(e.recibidoPor)}</p>
      <div class="table-wrap"><table class="table compact"><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo</th><th>Lote</th><th>Vence</th></tr></thead>
      <tbody>${e.items.map(l => `<tr><td>${esc(l.nombre)}</td><td class="r">${fmtCant(l.cantidad, l.unidad)}</td><td class="r">${money(l.costoUnit * l.cantidad)}</td><td class="mono">${esc(l.lote || '—')}</td><td>${esc(l.vence || '—')}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="r">${e.totalUnidades}</td><td class="r">${money(e.totalCosto)}</td><td></td><td></td></tr></tfoot></table></div>` });
  },

  'prov-nuevo': () => formProveedor(),
  'prov-editar': d => formProveedor(busca('proveedores', d.id)),
  'prov-eliminar': d => { const p = busca('proveedores', d.id); confirmar('Eliminar proveedor', `Se eliminará "${esc(p.nombre)}". Sus entregas anteriores se conservan en el historial.`, 'Eliminar', async () => { await store.remove('proveedores', p.id, sesion); toast('Proveedor eliminado.'); }); },

  'alerta-atender': async d => { await store.atenderAlerta(d.id, sesion); toast('Alerta marcada como atendida.'); },
  'hist-tab': d => { ui.histTab = d.tab; render(); },
  'hist-tipo': d => { ui.histTipo = d.tipo; render(); },

  'user-nuevo': () => formUsuario(),
  'user-editar': d => formUsuario(busca('usuarios', d.id)),
  'user-eliminar': d => { const u = busca('usuarios', d.id); confirmar('Eliminar empleado', `${esc(u.nombre)} ya no podrá entrar. Si solo sale a vacaciones, mejor márcalo como inactivo.`, 'Eliminar', async () => { await store.remove('usuarios', u.id, sesion); toast('Empleado eliminado.'); }); },
};

function agregarAlCarrito(id) {
  const p = busca('productos', id);
  if (!p) return;
  const it = ui.carrito.find(i => i.productoId === id);
  const nueva = r3((it?.cantidad || 0) + (p.unidad === 'kg' ? 0.5 : 1));
  if (nueva > p.stock) return toast(`Solo quedan ${fmtCant(p.stock, p.unidad)} de ${p.nombre}.`, 'preocupado');
  if (it) it.cantidad = nueva; else ui.carrito.push({ productoId: id, cantidad: nueva });
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) { if (ui.menu && !e.target.closest('.me')) { ui.menu = false; render(); } return; }
  if (b.tagName === 'A') e.preventDefault();
  ACCIONES[b.dataset.act]?.(b.dataset, b, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.bind) { ui[t.dataset.bind] = t.value; render(); return; }
  if (t.dataset.rec) {
    const fila = ui.recep.items[Number(t.dataset.i)];
    fila[t.dataset.rec] = t.value;
    if (t.dataset.rec === 'productoId') {
      fila.costoUnit = busca('productos', t.value)?.costo ?? '';
      render();
    } else {
      const totU = sum(ui.recep.items, f => Number(f.cantidad) || 0);
      const totC = sum(ui.recep.items, f => (Number(f.cantidad) || 0) * (Number(f.costoUnit) || 0));
      $('#rec-tot-u').textContent = totU.toLocaleString('es-CO');
      $('#rec-tot-c').textContent = money(totC);
    }
  }
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-recprov]')) { ui.recep.proveedorId = e.target.value; render(); }
});

// Escáner de código de barras: los lectores USB escriben el código y envían Enter.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.id !== 'cajaQ') return;
  const q = ui.cajaQ.trim();
  const exacto = activos().find(p => p.codigoBarras === q);
  const lista = filtrar(activos(), ui.cajaCat, q);
  const p = exacto || (lista.length === 1 ? lista[0] : null);
  if (!p) return toast(q ? 'No hay un producto con ese código.' : 'Escribe o escanea un código.', 'preocupado');
  ui.cajaQ = '';
  agregarAlCarrito(p.id);
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const err = $('#login-error');
  try {
    sesion = await store.login(fd.get('email'), fd.get('password'));
    ruta = 'inicio';
    render();
    toast(`¡Bienvenido, ${sesion.nombre.split(' ')[0]}!`, 'celebrando');
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
});

// ---------- PWA ----------
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalador = e; if (sesion) render(); });
window.addEventListener('appinstalled', () => { instalador = null; toast('FrescoStock quedó instalada en tu equipo.', 'celebrando'); if (sesion) render(); });


// ---------- arranque ----------
store.subscribe(() => { if (sesion) render(); });
const atajo = location.hash.slice(1);
if (RUTAS.some(r => r.id === atajo)) ruta = atajo; // accesos directos del ícono instalado
sesion = await store.restoreSession();
render();
