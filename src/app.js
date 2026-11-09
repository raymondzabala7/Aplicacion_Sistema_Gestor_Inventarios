import { createStore } from './data/store.js';
import {
  OPCIONES_IVA,
  calcularResumenIVA,
  descargarCSV,
  fmtCant,
  ivaPorDefectoCategoria,
  normalizarTarifaIva,
  obtenerIvaProducto,
  r3,
} from './domain/inventory.js';
import { iconoProducto as iconoDe, imagenPorDefectoProducto } from './domain/iconos.js';
import { tomi } from './ui/tomi.js';
import { tomi3D } from './ui/tomi3d.js';
import { saludarAlEntrar, alternarSonido, sonidoHabilitado, leerEnVoz, callarVoz } from './ui/tomi-audio.js';
import { pasosPara, textoParaVoz } from './ui/tutorial.js';

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

// Emoji del producto (propiedad `icono`, mapeo por nombre o emoji de su categoría)
const iconoProducto = p => iconoDe(p, categoria(p?.categoriaId)?.icono);

// Tarifa de IVA del producto (0%, 5% o 19%) según normativa colombiana
const ivaDe = p => obtenerIvaProducto(p, categoria(p?.categoriaId)?.nombre);
const pillIva = p => {
  const t = ivaDe(p);
  const cls = t === 0 ? 'ok' : t === 5 ? 'info' : 'warn';
  return `<span class="pill ${cls}">${t}%</span>`;
};

// Miniatura del producto: su foto o ilustración incluida si la tiene; si no, el emoji correspondiente.
// encuadrar (tarjetas del catálogo): la foto se muestra encuadrada sobre el producto (ver abajo).
function imgProducto(p, alt = '', encuadrar = false) {
  const src = imagenPorDefectoProducto(p);
  // Sin loading="lazy": al redibujar, una imagen perezosa queda un instante en blanco y parpadea.
  if (!src) return iconoProducto(p);
  const enc = encuadrar && ENCUADRE ? encuadres.get(src) : undefined;
  const estilo = enc ? estiloEncuadre(enc) : '';
  const extra = !encuadrar || !ENCUADRE ? '' : enc === undefined ? ' data-encuadrar' : estilo ? ` style="${estilo}"` : '';
  return `<img class="prod-img" src="${esc(src)}" alt="${esc(alt || p?.nombre || '')}"${extra}>`;
}

// Encuadre de las fotos del catálogo: las fotos son cuadradas con margen transparente o blanco,
// así que un producto ancho (galletas, huevos) se veía bajito y uno alto (botellas) delgado.
// Se mide UNA vez dónde está el producto dentro de cada foto y se muestra solo esa zona
// (object-view-box + object-fit: contain): todos llenan el espacio de forma pareja, sin
// recortar el producto, sin deformarlo y sin tocar el archivo original. Los navegadores que no
// conocen object-view-box muestran la foto completa como siempre.
// Nitidez: la foto nunca se agranda más allá de sus píxeles reales en PC (pantallas de hasta 2x);
// en celulares de 3x se permite un poco más, porque a esa densidad no se nota.
const ENCUADRE = typeof CSS !== 'undefined' && CSS.supports?.('object-view-box', 'inset(0)');
const encuadres = new Map(); // src -> { marco: 'inset(…)', w, h } (marco '' si no se pudo medir)
function estiloEncuadre({ marco, w, h }) {
  if (!marco) return '';
  const d = Math.min(window.devicePixelRatio || 1, 2);
  return `object-view-box:${marco};max-width:min(100%,${(w / d).toFixed(1)}px);max-height:min(100%,${(h / d).toFixed(1)}px)`;
}
function aplicarEncuadre(img, enc) {
  const estilo = estiloEncuadre(enc);
  if (estilo) img.setAttribute('style', estilo);
  img.removeAttribute('data-encuadrar');
}
function medirEncuadre(img) {
  const src = img.getAttribute('src');
  if (encuadres.has(src)) return aplicarEncuadre(img, encuadres.get(src));
  if (!img.complete || !img.naturalWidth) { img.addEventListener('load', () => medirEncuadre(img), { once: true }); return; }
  const enc = { marco: '', w: 0, h: 0 };
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const fondo = d[k + 3] < 24 || (d[k] > 240 && d[k + 1] > 240 && d[k + 2] > 240); // transparente o blanco
      if (fondo) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= x0 && y1 >= y0) {
      const aire = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04); // un poco de aire alrededor
      const t = Math.max(0, y0 - aire), l = Math.max(0, x0 - aire), b = Math.max(0, h - 1 - y1 - aire), r = Math.max(0, w - 1 - x1 - aire);
      const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
      enc.marco = `inset(${pct(t, h)} ${pct(r, w)} ${pct(b, h)} ${pct(l, w)})`;
      enc.w = w - l - r; enc.h = h - t - b; // píxeles reales de la zona que se muestra
    }
  } catch { /* imagen de otro dominio: se muestra completa */ }
  encuadres.set(src, enc);
  document.querySelectorAll('img[data-encuadrar]').forEach(i => { if (i.getAttribute('src') === src) aplicarEncuadre(i, enc); });
}

// Reduce la foto a un cuadrado de 256 px (JPEG) para que quepa bien en la base de datos.
function redimensionarImagen(file, lado = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = lado;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lado, lado);
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen. Usa un archivo JPG o PNG.')); };
    img.src = url;
  });
}


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
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.4-.5-3-1.5"/><path d="M12 6v2M12 16v2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<path d="M5 12l5 5 9-10"/>', print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>', refresh: '<path d="M20 12a8 8 0 11-3-6.3"/><path d="M20 4v5h-5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="6" y="6" width="1" height="1"/><rect x="17" y="6" width="1" height="1"/><rect x="17" y="17" width="1" height="1"/><rect x="6" y="17" width="1" height="1"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const TODOS = ['admin', 'bodega', 'cajero'];
// grupo: título de la sección en la barra lateral
const RUTAS = [
  { id: 'inicio', label: 'Inicio', icon: 'home', roles: TODOS, grupo: '', titulo: 'Panel general', sub: 'Ventas, entregas y stock de un vistazo' },
  { id: 'caja', label: 'Caja', icon: 'cart', roles: ['admin', 'cajero'], grupo: 'Operación', titulo: 'Caja', sub: 'Arma la venta, factura y el stock se descuenta solo' },
  { id: 'recepcion', label: 'Recepción', icon: 'truck', roles: ['admin', 'bodega'], grupo: 'Operación', titulo: 'Recepción de proveedores', sub: 'Registra lo que llega y súmalo al stock' },
  { id: 'productos', label: 'Productos', icon: 'box', roles: TODOS, grupo: 'Catálogo', titulo: 'Productos', sub: 'Stock por categoría' },
  { id: 'proveedores', label: 'Proveedores', icon: 'store', roles: ['admin', 'bodega'], grupo: 'Catálogo', titulo: 'Proveedores', sub: 'Quién nos surte y cuánto ha entregado' },
  { id: 'alertas', label: 'Alertas', icon: 'bell', roles: TODOS, grupo: 'Control', titulo: 'Alertas', sub: 'Stock bajo, agotados y productos por vencer' },
  { id: 'historial', label: 'Historial', icon: 'clock', roles: ['admin', 'bodega'], grupo: 'Control', titulo: 'Historial', sub: 'Quién hizo qué y cada movimiento de stock' },
  { id: 'usuarios', label: 'Usuarios', icon: 'users', roles: ['admin'], grupo: 'Control', titulo: 'Usuarios', sub: 'Empleados, roles y turnos' },
];

// ---------- estado de la interfaz ----------
let sesion = null;
let ruta = 'inicio';
let instalador = null;
const filaVacia = () => ({ productoId: '', cantidad: '', costoUnit: '', lote: '', vence: '' });
const ui = {
  prodCat: 'todas', prodQ: '', cajaCat: 'todas', cajaQ: '', carrito: [],
  recep: { proveedorId: '', items: [filaVacia()] }, histTab: 'actividad', histTipo: 'todos', histRango: 'todos', menu: false,
};
const puede = (...roles) => roles.includes(sesion?.rol);

// ---------- render ----------
let rutaPintada = null; // la pantalla que está dibujada ahora

// Firebase avisa por separado de cada colección que cambia (una venta toca facturas, productos,
// movimientos, alertas…): se juntan esos avisos en un solo redibujo.
let renderPendiente = null;
function programarRender() {
  if (renderPendiente) return;
  renderPendiente = setTimeout(() => { renderPendiente = null; render(); }, 40);
}

function render() {
  clearTimeout(renderPendiente);
  renderPendiente = null;
  let fid = null, sel = null;
  try {
    const a = document.activeElement;
    if (a && a.id && !a.closest('dialog')) { fid = a.id; sel = [a.selectionStart, a.selectionEnd]; }
  } catch { /* inputs numéricos no tienen selección */ }

  const app = $('#app');
  if (!sesion) { app.innerHTML = vistaLogin(); ubicarTomi(); rutaPintada = null; return; }
  const r = RUTAS.find(x => x.id === ruta && x.roles.includes(sesion.rol)) || RUTAS[0];
  ruta = r.id;
  // Las animaciones de entrada solo corren al cambiar de pantalla. Si es la misma pantalla
  // (un clic, una venta, un aviso de Firebase), se redibuja "quieta" y sin saltar de posición.
  const mismaPantalla = rutaPintada === r.id && Boolean($('.layout'));
  const y = window.scrollY;
  app.classList.toggle('quieto', mismaPantalla);
  // Listas con su propio desplazamiento (carrito, categorías, tablas): se guarda dónde iban para
  // que al tocar "+" en el último producto la lista no salte al principio.
  const DESPLAZABLES = '.cart, .chips, .table-wrap';
  const desplazado = mismaPantalla ? [...document.querySelectorAll(DESPLAZABLES)].map(el => [el.scrollTop, el.scrollLeft]) : [];
  app.innerHTML = shell(r, VISTAS[r.id]());
  document.querySelectorAll(DESPLAZABLES).forEach((el, i) => { if (desplazado[i]) [el.scrollTop, el.scrollLeft] = desplazado[i]; });
  // La línea que se acaba de agregar o sumar queda a la vista dentro del carrito.
  const nueva = $('.cart li.nuevo'), carrito = $('.cart');
  if (nueva && carrito) {
    const a = nueva.getBoundingClientRect(), c = carrito.getBoundingClientRect();
    if (a.bottom > c.bottom) carrito.scrollTop += a.bottom - c.bottom;
    else if (a.top < c.top) carrito.scrollTop -= c.top - a.top;
  }
  rutaPintada = r.id;
  ui.recienAgregado = null;
  if (mismaPantalla && window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });
  document.querySelectorAll('img[data-encuadrar]').forEach(medirEncuadre); // fotos del catálogo aún sin medir
  ubicarTomi();
  posicionarTutorial(); // la pantalla se redibujó: el resaltado sigue a su parte

  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus(); try { if (sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}

// Tomi 3D: después de cada render cada lienzo se mueve al lugar marcado con data-tomi3d
// (data-estado: feliz, preocupado o celebrando). El del logo es otra instancia.
const FRASES = {
  carga: ['Cargando el inventario… 🍅', 'Contando tomates…', 'Un momento, reviso los estantes.'],
  login: [
    '¡Hola! Soy Tomi 🍅 Tu compañero de inventario.',
    'Cada venta descuenta el stock solita.',
    'Si un producto se agota, yo te aviso.',
    '¿Llegó el proveedor? Lo registramos en Recepción.',
    'Psst… no compartas tu contraseña 🔐',
    '¡Los tomates frescos hacen clientes felices! ✨',
  ],
  caja: [
    '¡Listo para vender! 🛒',
    'Presiona F2 para enfocar el buscador.',
    'Presiona F4 para cobrar rápido.',
    'Puedes escanear códigos con la cámara o pistola USB.',
    'Calculo la devuelta en efectivo automáticamente.',
  ],
  inicio: [
    '¡Hola! Qué gusto verte hoy.',
    'Aquí tienes los indicadores clave del día.',
    'Cualquier duda, ¡hazme clic! 🍅',
  ],
  alertas: [
    '¡Revisemos qué productos necesitan reposición!',
    'Un producto agotado es una venta perdida.',
    'Si un lote está por vencer, llama al proveedor para cambiarlo.',
  ],
};

function obtenerFrases(lugar) {
  if (lugar === 'inicio') {
    const nombre = sesion?.nombre ? sesion.nombre.trim().split(/\s+/)[0] : '';
    const saludo = nombre ? `¡Hola, ${nombre}! 🍅✨` : '¡Hola! 🍅✨ ¡Qué alegría verte!';
    return [
      saludo,
      'Aquí tienes los indicadores clave del día.',
      'Cualquier duda, ¡hazme clic! 🍅',
      '¡El inventario está en las mejores manos!',
    ];
  }
  return FRASES[lugar] || [];
}

function ubicarTomi() {
  // Todos los mensajes y reacciones de Tomi salen como notificación (toast) para no tapar la pantalla.
  const reaccion = (texto, enojado) => toast(texto, enojado ? 'preocupado' : 'feliz');
  document.querySelectorAll('[data-tomi3d]').forEach(slot => {
    const lugar = slot.dataset.tomi3d;
    const estado = slot.dataset.estado || 'feliz';
    const frasesLugar = obtenerFrases(lugar);
    if (lugar === 'tutorial') tomi3D('tutorial').colocar(slot, { globo: false, estado });
    else if (lugar === 'logo') tomi3D('logo').colocar(slot, { globo: false, estado, alHablar: reaccion });
    else tomi3D().colocar(slot, { globo: false, frases: frasesLugar, estado, alHablar: reaccion });
  });
}

function shell(r, contenido) {
  const rutas = RUTAS.filter(x => x.roles.includes(sesion.rol));
  const nAlertas = S().alertas.filter(a => !a.atendida).length;
  const link = x => `<button class="nav-link ${x.id === ruta ? 'on' : ''}" data-act="ir" data-ruta="${x.id}" ${x.id === ruta ? 'aria-current="page"' : ''}>
      ${icon(x.icon)}<span>${x.label}</span>${x.id === 'alertas' && nAlertas ? `<em class="nav-badge">${nAlertas}</em>` : ''}</button>`;
  const grupos = [...new Set(rutas.map(x => x.grupo))];
  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `
  <div class="layout">
    <aside class="side">
      <div class="brand"><div class="tomi-logo3d" data-tomi3d="logo" title="Tomi"></div><span>Fresco<b>Stock</b></span><small>Tu negocio en buenas manos</small></div>
      <nav class="nav" data-tut="menu">${grupos.map(g => `<div class="nav-group">${g ? `<span class="nav-title">${g}</span>` : ''}${rutas.filter(x => x.grupo === g).map(link).join('')}</div>`).join('')}</nav>
      <div class="side-foot">
        <div class="side-user"><span class="avatar">${esc(sesion.nombre[0])}</span><span><b>${esc(sesion.nombre)}</b><small>${ROL[sesion.rol]}</small></span></div>
        <span class="modo ${store.mode}">${store.mode === 'firebase' ? 'Conectado a Firebase' : 'Modo demo · datos en este navegador'}</span>
      </div>
    </aside>
    <div class="content">
      <header class="topbar">
        <label class="top-search">${icon('search')}<input id="globalQ" type="search" placeholder="Buscar productos o códigos…" aria-label="Buscar productos en toda la app" autocomplete="off"><kbd>Enter</kbd></label>
        <div class="top-actions">
          <span class="today">${icon('calendar')}${hoy}</span>
          ${instalador ? `<button class="btn soft sm" data-act="instalar">${icon('download')}<span>Instalar app</span></button>` : ''}
          ${r.id === 'inicio' ? '' /* en Inicio ya está el botón de la tarjeta de Tomi */ : `<button class="btn soft sm tut-btn" data-act="tutorial" title="Tutorial de tu rol con Tomi">${tomi('feliz', 'tomi-btn')}<span>Aprende con Tomi</span></button>`}
          <button class="icon-btn" data-act="toggle-sonido" title="${sonidoHabilitado() ? 'Silenciar sonidos de Tomi' : 'Activar sonidos de Tomi'}" aria-label="Sonido">${icon(sonidoHabilitado() ? 'volume' : 'mute')}</button>
          <div class="avisos-wrap">
            <button class="icon-btn bell ${ui.avisos ? 'on' : ''}" data-act="avisos" aria-expanded="${Boolean(ui.avisos)}" aria-label="Alertas: ${nAlertas}">${icon('bell')}${nAlertas ? `<em>${nAlertas}</em>` : ''}</button>
            ${ui.avisos ? panelAvisos() : ''}
          </div>
          <div class="me">
            <button class="me-btn" data-act="menu" aria-expanded="${ui.menu}"><span class="avatar">${esc(sesion.nombre[0])}</span><span class="me-txt"><b>${esc(sesion.nombre)}</b><small>${ROL[sesion.rol]}</small></span></button>
            ${ui.menu ? `<div class="menu">
              ${store.mode === 'local' ? `<button data-act="reset">${icon('refresh')}Reiniciar datos de la demo</button>` : ''}
              <button data-act="salir">${icon('logout')}Cerrar sesión</button></div>` : ''}
          </div>
        </div>
      </header>
      ${r.id === 'inicio' ? '' : `<div class="top"><div class="top-title"><h1>${r.titulo}</h1><p>${r.sub}</p></div></div>`}
      <main class="view">${contenido}</main>
    </div>
    <nav class="bottom-nav">${rutas.map(link).join('')}</nav>
  </div>`;
}

// Panel de la campanita: lista de alertas solo para leer (sin botones que cambien datos).
function panelAvisos() {
  const activas = alertasActivas();
  const vencen = lotesPorVencer().length;
  return `<div class="avisos" role="dialog" aria-label="Alertas activas">
    <div class="avisos-head"><b>Alertas</b><span class="pill ${activas.length ? 'bad' : 'ok'}">${activas.length} activa${activas.length === 1 ? '' : 's'}</span></div>
    ${activas.length ? `<ul class="avisos-list">${activas.slice(0, 6).map(a => `<li class="${a.tipo}">
      <span class="prod-emoji">${imgProducto(S().productos.find(p => p.id === a.productoId) || { nombre: a.productoNombre })}</span>
      <div><b>${esc(a.productoNombre)}</b><small>Quedan ${a.stock} · mínimo ${a.stockMinimo ?? '—'}</small></div>
      <span class="pill ${a.tipo === 'agotado' ? 'bad' : 'warn'}">${a.tipo === 'agotado' ? 'Agotado' : 'Stock bajo'}</span></li>`).join('')}</ul>
      ${activas.length > 6 ? `<p class="muted small">Y ${activas.length - 6} más…</p>` : ''}`
      : `<p class="avisos-vacio">${icon('check')}No hay alertas de stock. ¡Todo en orden!</p>`}
    ${vencen ? `<p class="avisos-vence">${icon('calendar')}${vencen} lote${vencen === 1 ? '' : 's'} vence${vencen === 1 ? '' : 'n'} en los próximos 7 días</p>` : ''}
    ${puede('admin') ? '' : '<p class="avisos-nota">Solo lectura. Si ves stock bajo, avísale al administrador.</p>'}
    <button class="btn soft block" data-act="ir" data-ruta="alertas">Ver todas las alertas</button>
  </div>`;
}

// ---------- tutorial "Aprende con Tomi" ----------
// Recorrido guiado sobre la app real: en cada paso abre la pantalla, resalta la parte
// que se explica (data-tut) y Tomi la cuenta con texto y voz. Solo los pasos del rol
// que inició sesión (src/ui/tutorial.js).
const TUT_VOZ = 'frescostock_tutorial_voz';
const tutVisto = () => 'frescostock:tutorial-visto:' + sesion?.id;
const vozTutorial = () => { try { return localStorage.getItem(TUT_VOZ) !== 'false'; } catch { return true; } };

function abrirTutorial(i = 0) {
  if (!sesion) return;
  ui.tut = { pasos: pasosPara(sesion.rol), i };
  ui.menu = false;
  try { localStorage.setItem(tutVisto(), '1'); } catch {}
  if (!$('#tutorial')) {
    // capa: bloquea clics en la app; luz: el recuadro que resalta; panel: la tarjeta de Tomi.
    const t = document.createElement('div');
    t.id = 'tutorial';
    t.innerHTML = '<div class="tut-capa"></div><div class="tut-luz" hidden></div><div class="tut-panel" role="dialog" aria-label="Tutorial de FrescoStock"></div>';
    document.body.append(t);
  }
  pintarTutorial();
}

function cerrarTutorial() {
  callarVoz();
  ui.tut = null;
  $('#tutorial')?.remove(); // al salir del documento, el Tomi del tutorial deja de dibujarse
}

function pintarTutorial() {
  const { pasos, i } = ui.tut;
  const p = pasos[i];
  if (p.ruta && ruta !== p.ruta) { ruta = p.ruta; render(); }
  const primero = i === 0;
  const ultimo = i === pasos.length - 1;
  const voz = vozTutorial();
  $('#tutorial .tut-panel').innerHTML = `
    <div class="tut-tomi" data-tomi3d="tutorial" data-estado="${p.estado}"></div>
    <div class="tut-body">
      <div class="tut-top">
        <span class="pill info">Tutorial · ${ROL[sesion.rol]}</span>
        <span class="muted small">Paso ${i + 1} de ${pasos.length}</span>
        <button class="icon-btn" data-act="tut-cerrar" aria-label="Cerrar tutorial">${icon('x')}</button>
      </div>
      <div class="tut-card" aria-live="polite">
        <h2><span class="tut-ic">${icon(p.icono)}</span>${esc(p.titulo)}</h2>
        <p>${esc(p.texto)}</p>
      </div>
      <div class="tut-dots">${pasos.map((_, k) => `<button class="tut-dot ${k === i ? 'on' : ''}" data-act="tut-paso" data-i="${k}" aria-label="Ir al paso ${k + 1}"></button>`).join('')}</div>
      <div class="tut-foot">
        <button class="btn ghost sm" data-act="tut-voz" aria-pressed="${voz}" title="${voz ? 'Apagar la voz de Tomi' : 'Encender la voz de Tomi'}">${icon(voz ? 'volume' : 'mute')}<span>${voz ? 'Voz' : 'Sin voz'}</span></button>
        ${voz ? `<button class="btn ghost sm" data-act="tut-repetir" title="Repetir">${icon('refresh')}<span>Repetir</span></button>` : ''}
        <div class="tut-spacer"></div>
        ${primero ? '<button class="btn ghost" data-act="tut-cerrar">Ahora no</button>' : '<button class="btn ghost" data-act="tut-ant">Anterior</button>'}
        ${ultimo ? `<button class="btn primary" data-act="tut-cerrar">${icon('check')}Terminar</button>` : `<button class="btn primary" data-act="tut-sig">${primero ? 'Empezar' : 'Siguiente'}</button>`}
      </div>
    </div>
    ${p.vista ? `<div class="tut-vista" aria-hidden="true">${vistaPreviaTutorial(p.vista)}</div>` : ''}`;
  ubicarTomi();
  posicionarTutorial(true);
  setTimeout(() => posicionarTutorial(), 350); // por si las imágenes cambian el tamaño de la pantalla
  if (voz) leerEnVoz(textoParaVoz(p)); else callarVoz();
}

// Ventanas que se abren solo con una venta en curso (cobro, factura): el tutorial muestra
// una copia de ejemplo hecha con las mismas clases, sin tocar el carrito ni crear facturas.
function vistaPreviaTutorial(nombre) {
  if (nombre === 'cobro') {
    return `
      <p class="tut-vista-tit">${icon('coin')}Cobrar venta</p>
      <div class="tax-box">
        <div class="tax-row"><span>Subtotal sin IVA <small>(base gravable)</small></span><span class="num">${money(13067)}</span></div>
        <div class="tax-row"><span>Total IVA 5%</span><span class="num">${money(233)}</span></div>
        <div class="tax-row"><span>Total IVA 19%</span><span class="num">${money(0)}</span></div>
      </div>
      <div class="total"><span>Total a pagar <small>IVA incluido</small></span><b class="num">${money(13300)}</b></div>
      <div class="pay-grid">
        <span class="pay-tile on">${icon('coin')}<span>Efectivo</span></span>
        <span class="pay-tile">${icon('qr')}<span>Transf. / QR</span></span>
        <span class="pay-tile">${icon('creditCard')}<span>Tarjeta</span></span>
      </div>
      <div class="denoms"><span>Exacto</span><span>+$2.000</span><span>+$5.000</span><span>+$10.000</span><span>+$20.000</span><span>+$50.000</span></div>
      <div class="cambio-box positivo"><div><span class="muted block small">Paga con ${money(20000)}</span><b>Devuelta</b></div><span class="cambio-val num">${money(6700)}</span></div>
      <p class="tut-vista-cliente"><span>Cliente: Consumidor Final</span><span>NIT 222222222222</span></p>
      <span class="btn primary tut-vista-btn">Confirmar y facturar</span>`;
  }
  if (nombre === 'factura') {
    return `
      <div class="invoice tut-vista-factura">
        <div class="inv-head"><div><b class="inv-brand">FrescoStock</b><small>Factura de venta</small></div><div class="r"><b class="mono">FV-000123</b><small>Efectivo</small></div></div>
        <div class="inv-calc">
          <div class="inv-calc-row"><span>Leche entera 1 L × 2</span><span class="num">${money(9800)}</span></div>
          <div class="inv-calc-row"><span>Tomate chonto 1 kg</span><span class="num">${money(3500)}</span></div>
        </div>
        <div class="inv-total"><span>Total</span><b>${money(13300)}</b></div>
      </div>
      <span class="btn soft tut-vista-btn">${icon('print')}Imprimir</span>`;
  }
  return '';
}

// Resalta la parte del paso actual y pone la tarjeta del lado contrario para no taparla.
function posicionarTutorial(desplazar = false) {
  const t = $('#tutorial');
  if (!ui.tut || !t) return;
  const p = ui.tut.pasos[ui.tut.i];
  const luz = t.querySelector('.tut-luz');
  const panel = t.querySelector('.tut-panel');
  // foco puede ser una lista: se usa la primera parte que esté en pantalla.
  const el = [].concat(p.foco || []).map(s => document.querySelector(s))
    .find(e => e && e.getClientRects().length && e.getBoundingClientRect().width > 0);
  const visible = Boolean(el);
  t.classList.toggle('sin-foco', !visible);
  panel.className = p.vista ? 'tut-panel con-vista' : 'tut-panel';
  panel.removeAttribute('style');
  if (!visible) { luz.hidden = true; return; }

  const vw = window.innerWidth, vh = window.innerHeight, M = 16;
  const bajar = y => { if (desplazar && Math.abs(y) > 1) window.scrollBy({ top: y, behavior: 'instant' }); };
  // Si está dentro de una tabla que se desplaza de lado (celular), primero la mueve hasta verlo.
  if (desplazar) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  let r = el.getBoundingClientRect();
  let zona; // franja de la pantalla que la tarjeta no tapa: ahí debe quedar lo señalado

  // 1) Al lado: en PC, si a la derecha o a la izquierda cabe la tarjeta, va ahí y no tapa nada.
  const W = panel.offsetWidth;
  const lado = vw > 900 && !p.vista && (vw - r.right >= W + 2 * M ? 'der' : r.left >= W + 2 * M ? 'izq' : null);
  if (lado) {
    bajar(r.top - Math.max(M, (vh - r.height) / 2));
    r = el.getBoundingClientRect();
    const H = panel.offsetHeight;
    panel.style.left = `${lado === 'der' ? r.right + M : r.left - M - W}px`;
    panel.style.top = `${Math.min(Math.max(r.top, M), vh - H - M)}px`;
    zona = [M / 2, vh - M / 2];
  } else {
    // 2) Apilada: la tarjeta ancha va abajo y lo señalado se acomoda en el espacio de arriba.
    panel.classList.add('apilado', 'abajo');
    const H = panel.offsetHeight;
    const libre = vh - H - 3 * M;
    bajar(r.top - (M + Math.max(0, (libre - r.height) / 2)));
    r = el.getBoundingClientRect();
    if (r.top > libre + M && r.top > H + 2 * M) {
      // La página no pudo bajar más (lo señalado está al final): la tarjeta sube.
      panel.classList.replace('abajo', 'arriba');
      zona = [H + 2 * M, vh - M / 2];
    } else {
      zona = [M / 2, vh - H - 2 * M];
    }
  }

  // El recuadro se recorta a la franja visible, así nunca queda debajo de la tarjeta.
  const m = 8;
  const top = Math.max(r.top - m, zona[0]);
  const bottom = Math.min(r.bottom + m, zona[1]);
  Object.assign(luz.style, { top: `${top}px`, left: `${Math.max(r.left - m, 4)}px`, width: `${Math.min(r.width + m * 2, vw - 8)}px`, height: `${Math.max(bottom - top, 24)}px` });
  luz.hidden = false;
}
// Al cambiar el tamaño (girar el celular, achicar la ventana) se vuelve a acomodar todo.
let tutResize = null;
window.addEventListener('resize', () => { clearTimeout(tutResize); tutResize = setTimeout(() => posicionarTutorial(true), 150); });
window.addEventListener('scroll', () => posicionarTutorial(), { passive: true });

function irAPaso(i) {
  if (!ui.tut) return;
  ui.tut.i = Math.max(0, Math.min(ui.tut.pasos.length - 1, i));
  pintarTutorial();
}

// La primera vez que alguien inicia sesión en este navegador, Tomi ofrece el tutorial.
function ofrecerTutorial() {
  try { if (localStorage.getItem(tutVisto())) return; } catch { return; }
  setTimeout(() => { if (sesion && !$('#modal')?.open) abrirTutorial(0); }, 1600);
}

// ---------- login ----------
function vistaLogin() {
  const demo = store.mode === 'local';
  const cuentas = S().usuarios.filter(u => u.activo);
  return `
  <div class="login">
    <div class="login-shell">
      <aside class="login-side">
        <div class="login-hero" data-tomi3d="login"></div>
        <h2>El inventario del súper, siempre al día.</h2>
        <ul class="login-points">
          <li>${icon('box')}Stock por categorías en tiempo real</li>
          <li>${icon('receipt')}Facturas que descuentan el stock solas</li>
          <li>${icon('bell')}Avisos cuando algo se agota</li>
        </ul>
      </aside>
    <div class="login-card">
      <h1>Fresco<b>Stock</b></h1>
      <p class="muted">Entra con tu cuenta de empleado</p>
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
  const frase = bajos.length
    ? `Hay ${bajos.length} producto${bajos.length > 1 ? 's' : ''} bajo el mínimo. ¡Toca reabastecer!`
    : '¡Todo el stock está en orden! Buen trabajo.';
  const vacio = !s.productos.length && puede('admin');

  // --- Datos para los indicadores (todo sale de los datos reales) ---
  const ayer = dias[5].total;
  const cambio = ayer ? Math.round(((ventasHoy - ayer) / ayer) * 100) : null;
  const tendencia = cambio == null ? '<small class="trend">Sin ventas ayer para comparar</small>'
    : `<small class="trend ${cambio >= 0 ? 'up' : 'down'}">${cambio >= 0 ? '↑' : '↓'} ${Math.abs(cambio)}% <span>vs. ayer</span></small>`;
  const linea = dias.map((d, i) => `${(i * 100 / 6).toFixed(1)},${(30 - (d.total / maxDia) * 26).toFixed(1)}`).join(' ');
  const enStock = activos().filter(p => p.stock > 0).length;
  const nAlertas = s.alertas.filter(a => !a.atendida).length;
  const ticket = hoy.length ? ventasHoy / hoy.length : 0;
  const recibido7 = Math.round(sum(entregas7, e => e.totalUnidades));

  // --- Gráfico de barras con eje: tope "redondo" (1, 2, 2.5 o 5 × 10ⁿ) ---
  const paso = (() => { const x = maxDia / 4; const p = 10 ** Math.floor(Math.log10(x)); const n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; })();
  const tope = paso * 4;

  // --- Dona de ventas por categoría ---
  const COLORES = ['#159447', '#F6B942', '#FF634F', '#9B6BD6', '#2DBB61', '#F28C38', '#3C8DBC', '#064B32'];
  const totalCat = sum(porCat, x => x.total);
  let acum = 0;
  const dona = totalCat ? `conic-gradient(${porCat.map((x, i) => { const de = acum; acum += (x.total / totalCat) * 100; return `${COLORES[i % COLORES.length]} ${de.toFixed(2)}% ${acum.toFixed(2)}%`; }).join(', ')})` : 'var(--surface-2)';

  return `
  ${vacio ? `<div class="card banner"><div><b>Todavía no hay productos.</b><p class="muted">Empieza creando las categorías y luego los productos.</p></div><button class="btn primary" data-act="ir" data-ruta="productos">Ir a Productos</button></div>` : ''}
  <div class="home">
    <div class="hello">
      <div><h2><span class="wave" aria-hidden="true">👋</span> ¡Hola, ${esc(sesion.nombre.split(' ')[0])}!</h2><p>Aquí tienes un resumen de tu negocio hoy.</p></div>
      <div class="greet-actions">
        ${puede('admin', 'cajero') ? `<button class="btn primary" data-act="ir" data-ruta="caja">${icon('cart')}Nueva venta</button>` : ''}
        ${puede('admin', 'bodega') ? `<button class="btn ghost" data-act="ir" data-ruta="recepcion">${icon('truck')}Recibir proveedor</button>` : ''}
      </div>
    </div>

    <aside class="home-rail">
      <div class="tomi-card">
        <p class="bubble">${frase}</p>
        <div class="tomi-home3d" data-tomi3d="inicio" data-estado="${bajos.length ? 'preocupado' : 'feliz'}" title="Tomi"></div>
        <button class="btn dark block" data-act="tutorial">${icon('fileText')}Aprende con Tomi</button>
      </div>
      <div class="status-card ${bajos.length ? 'atencion' : ''}">
        <span class="status-ic">${icon(bajos.length ? 'bell' : 'check')}</span>
        <h3>${bajos.length ? 'Revisa el inventario' : 'Todo en orden'}</h3>
        <p>${bajos.length ? `${bajos.length} producto${bajos.length > 1 ? 's' : ''} bajo el mínimo y ${nAlertas} alerta${nAlertas === 1 ? '' : 's'} activa${nAlertas === 1 ? '' : 's'}.` : 'Tu inventario se encuentra estable y bajo control.'}</p>
        <button class="btn light block" data-act="ir" data-ruta="alertas">Ver alertas →</button>
      </div>
      <div class="fact-card">
        <span class="fact-ic">${icon('receipt')}</span>
        <div><b>Facturación</b><small>${hoy.length} factura${hoy.length === 1 ? '' : 's'} hoy${s.facturas[0] ? ` · última ${esc(s.facturas[0].numero)}` : ''}</small></div>
      </div>
    </aside>

    <div class="home-main">
      <div class="kpis" data-tut="kpis">
        <div class="kpi v-verde"><span class="kpi-ic">${icon('cart')}</span><div class="kpi-txt"><span>Ventas del día</span><b>${money(ventasHoy)}</b>${tendencia}
          <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="${linea}"/></svg><small>${hoy.length} facturas · ticket promedio ${money(ticket)}</small></div></div>
        <div class="kpi v-naranja"><span class="kpi-ic">${icon('box')}</span><div class="kpi-txt"><span>Productos en stock</span><b>${enStock} <i>de ${activos().length}</i></b>
          <div class="meter wide"><i class="ok" style="width:${activos().length ? (enStock / activos().length) * 100 : 0}%"></i></div><small>Recibido en 7 días: ${recibido7.toLocaleString('es-CO')} und · ${entregas7.length} entregas</small></div></div>
        <div class="kpi v-verde2"><span class="kpi-ic">${icon('coin')}</span><div class="kpi-txt"><span>Valor del inventario</span><b>${moneyCorto(valorInv)}</b><small>a precio de costo · ${money(valorInv)}</small></div></div>
        <div class="kpi v-coral ${bajos.length ? 'alert' : ''}"><span class="kpi-ic">${icon('bell')}</span><div class="kpi-txt"><span>Alertas activas</span><b>${nAlertas}</b><small>${bajos.length} bajo el mínimo de ${activos().length} productos</small>
          <button class="link coral" data-act="ir" data-ruta="alertas">Ver detalles →</button></div></div>
      </div>

      <div class="grid-2 home-charts">
        <section class="card">
          <div class="card-head"><h3><span class="h-ic">${icon('coin')}</span>Ventas de los últimos 7 días</h3><span class="muted num">${money(sum(semana, f => f.total))}</span></div>
          <div class="chart2">
            <div class="ejes">${[4, 3, 2, 1, 0].map(k => `<span>${k ? moneyCorto(paso * k) : '0'}</span>`).join('')}</div>
            <div class="barras">${dias.map((d, i) => `<div class="col ${i === 6 ? 'hoy' : ''}" title="${money(d.total)}">
              <div class="bar-wrap">${i === 6 ? `<em class="tip">${money(d.total)}</em>` : ''}<div class="bar" style="height:${(d.total / tope) * 100}%"></div></div>
              <span class="lbl">${i === 6 ? 'Hoy' : new Date(d.ini).toLocaleDateString('es-CO', { weekday: 'short' })}</span></div>`).join('')}</div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h3><span class="h-ic">${icon('receipt')}</span>Ventas por categoría</h3><span class="muted">7 días</span></div>
          <div class="donut-wrap">
            <div class="donut" style="background:${dona}"><div><b>${moneyCorto(totalCat)}</b><small>Total</small></div></div>
            <ul class="legend">${porCat.map((x, i) => `<li><i style="background:${COLORES[i % COLORES.length]}"></i><span>${x.c.icono} ${esc(x.c.nombre)}</span><b class="num">${moneyCorto(x.total)}</b></li>`).join('')}</ul>
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h3><span class="h-ic bad">${icon('bell')}</span>Productos críticos</h3><button class="link coral" data-act="ir" data-ruta="alertas">Ver todos →</button></div>
          ${bajos.length ? `<ul class="list crit">${bajos.slice(0, 6).map(p => `<li>
            <span class="prod-emoji">${imgProducto(p)}</span>
            <div class="li-main"><b>${esc(p.nombre)}</b><small>mínimo ${fmtCant(p.stockMinimo, p.unidad)}</small></div>
            <span class="pill ${p.stock <= 0 ? 'bad' : 'warn'}">Stock: ${fmtCant(p.stock, p.unidad)}</span>
            ${puede('admin', 'bodega') ? `<button class="btn soft sm" data-act="recibir" data-id="${p.id}">Pedir</button>` : ''}</li>`).join('')}</ul>`
            : `<div class="empty">${tomi('feliz', 'tomi-empty')}<p>Ningún producto bajo el mínimo.</p></div>`}
        </section>
        <section class="card">
          <div class="card-head"><h3><span class="h-ic">${icon('fileText')}</span>Últimas ventas</h3>${puede('admin', 'cajero') ? '<button class="link" data-act="ir" data-ruta="caja">Ir a caja →</button>' : ''}</div>
          ${s.facturas.length ? `<div class="table-wrap"><table class="table compact ventas">
            <thead><tr><th>Factura</th><th class="r">Productos</th><th class="r">Total</th><th>Fecha</th></tr></thead>
            <tbody>${s.facturas.slice(0, 6).map(f => `<tr>
              <td><b class="mono">${f.numero}</b><small class="block muted">${esc(f.cajeroNombre)}</small></td>
              <td class="r">${f.items.length}</td>
              <td class="r num"><b>${money(f.total)}</b>${f.estado === 'anulada' ? '<span class="pill bad">Anulada</span>' : ''}</td>
              <td class="nowrap muted">${fechaHora(f.fecha)}</td></tr>`).join('')}</tbody></table></div>`
            : '<p class="muted">Todavía no hay ventas.</p>'}
        </section>
      </div>
    </div>
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
    <button class="btn soft" data-act="exportar-productos" title="Descargar inventario en tabla de Excel (.xlsx)">${icon('download')}<span>Exportar Excel</span></button>
    ${puede('admin') ? `<button class="btn soft" data-act="categorias">Categorías</button><button class="btn primary" data-act="prod-nuevo">${icon('plus')}Producto</button>` : ''}
  </div>
  ${chipsCategorias(ui.prodCat, 'prod-cat', contar)}
  <div class="card flush" data-tut="productos">
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Producto</th><th>Categoría</th><th class="r">Precio (IVA incl.)</th><th class="r">IVA</th><th>Stock</th><th>Estado</th><th class="r">Acciones</th></tr></thead>
      <tbody>${lista.map(p => `<tr>
        <td><div class="prod-cell"><span class="prod-emoji">${imgProducto(p)}</span><div><b>${esc(p.nombre)}</b><small class="mono block">${esc(p.codigoBarras)}</small></div></div></td>
        <td>${categoria(p.categoriaId)?.icono ?? ''} ${esc(categoria(p.categoriaId)?.nombre ?? 'Sin categoría')}</td>
        <td class="r num">${money(p.precioVenta)}<small class="block muted">/${p.unidad}</small></td>
        <td class="r">${pillIva(p)}</td>
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
  const resumenIva = calcularResumenIVA(lineas, s.productos);
  const total = resumenIva.total;
  const hoy0 = inicioDia();
  const hoy = s.facturas.filter(f => f.fecha >= hoy0);
  return `
  <div class="pos">
    <div class="pos-catalog" data-tut="caja-catalogo">
      <div class="search-row">
        <label class="search">${icon('search')}<input id="cajaQ" data-bind="cajaQ" value="${esc(ui.cajaQ)}" placeholder="Buscar o escanear código y Enter (F2)" aria-label="Buscar producto para vender"></label>
        <button class="btn soft" data-act="camara" title="Escanear con cámara del celular o laptop">${icon('camera')}<span>Cámara</span></button>
      </div>
      <div class="kbd-hint">Atajos: <kbd>F2</kbd> Buscar · <kbd>F4</kbd> Cobrar · <kbd>Esc</kbd> Vaciar</div>
      ${chipsCategorias(ui.cajaCat, 'caja-cat', contar)}
      <div class="tiles">${lista.map(p => `<button class="tile ${p.stock <= 0 ? 'off' : p.stock <= p.stockMinimo ? 'low' : ''}" data-act="agregar" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
          <span class="tile-emoji">${imgProducto(p, '', true)}</span>
          ${ui.carrito.some(i => i.productoId === p.id) ? `<em class="tile-count">${fmtCant(ui.carrito.find(i => i.productoId === p.id).cantidad, '').trim()}</em>` : ''}
          <b>${esc(p.nombre)}</b>
          <span class="tile-price">${money(p.precioVenta)}<small>/${p.unidad} · IVA ${ivaDe(p)}%</small></span>
          <small class="${p.stock <= p.stockMinimo ? 'warn-t' : 'muted'}">${p.stock <= 0 ? 'Agotado' : 'Quedan ' + fmtCant(p.stock, p.unidad)}</small>
        </button>`).join('') || `<div class="empty">${tomi('preocupado', 'tomi-empty')}<p>Sin resultados.</p></div>`}</div>
    </div>
    <aside class="ticket card" data-tut="caja-ticket">
      <div class="card-head"><h3><span class="h-ic">${icon('cart')}</span>Venta actual</h3><span class="ticket-num mono">${store.numeroSiguiente()}</span></div>
      ${lineas.length ? `<ul class="cart">${lineas.map(l => `<li class="${l.p.id === ui.recienAgregado ? 'nuevo' : ''}">
          <div class="li-main"><b>${imgProducto(l.p)} ${esc(l.p.nombre)}</b><small>${money(l.p.precioVenta)} / ${l.p.unidad} · IVA ${ivaDe(l.p)}%</small></div>
          <div class="qty"><button class="icon-btn sm" data-act="menos" data-id="${l.p.id}" aria-label="Quitar uno">${icon('minus')}</button><span class="num">${fmtCant(l.cantidad, l.p.unidad)}</span><button class="icon-btn sm" data-act="mas" data-id="${l.p.id}" aria-label="Agregar uno">${icon('plus')}</button></div>
          <b class="num">${money(l.cantidad * l.p.precioVenta)}</b>
        </li>`).join('')}</ul>`
        : `<div class="empty small cart-empty"><div class="tomi-caja" data-tomi3d="caja" title="Tomi"></div><p>Toca un producto o escanea su código para empezar.</p></div>`}
      <div class="tax-box">
        <div class="tax-row"><span>Subtotal sin IVA <small>(base gravable)</small></span><span class="num">${money(resumenIva.subtotalSinIva)}</span></div>
        <div class="tax-row"><span>Total IVA 5%</span><span class="num">${money(resumenIva.iva5)}</span></div>
        <div class="tax-row"><span>Total IVA 19%</span><span class="num">${money(resumenIva.iva19)}</span></div>
      </div>
      <div class="total"><span>Total a pagar <small>IVA incluido</small></span><b class="num">${money(total)}</b></div>
      <div class="row">
        <button class="btn ghost" data-act="vaciar" ${lineas.length ? '' : 'disabled'}>Vaciar</button>
        <button class="btn accent grow lg" data-tut="caja-cobrar" data-act="cobrar" ${lineas.length ? '' : 'disabled'}>${icon('receipt')}Cobrar y facturar <small class="kbd" style="font-size:.7rem;margin-left:4px;opacity:.8">(F4)</small></button>
      </div>
    </aside>
  </div>
  <section class="card" data-tut="caja-facturas">
    <div class="card-head">
      <div><h3><span class="h-ic">${icon('receipt')}</span>Facturas de hoy</h3><span class="muted">${hoy.filter(f => f.estado === 'pagada').length} pagadas · ${money(sum(hoy.filter(f => f.estado === 'pagada'), f => f.total))}</span></div>
      ${hoy.length ? `<button class="btn soft sm" data-act="exportar-ventas" title="Descargar facturas de hoy en CSV">${icon('download')}<span>Exportar ventas</span></button>` : ''}
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Factura</th><th>Hora</th><th>Cajero</th><th>Cliente</th><th class="r">Productos</th><th class="r">Total</th><th>Método</th><th>Estado</th><th class="r"></th></tr></thead>
      <tbody>${hoy.map(f => `<tr>
        <td class="mono">${f.numero}</td><td>${hora(f.fecha)}</td><td>${esc(f.cajeroNombre)}</td>
        <td><small>${esc(f.cliente?.nombre || 'Consumidor Final')}</small></td>
        <td class="r">${f.items.length}</td>
        <td class="r num"><b>${money(f.total)}</b></td>
        <td><small class="pill info">${esc(f.metodoPago === 'tarjeta' ? 'Tarjeta' : f.metodoPago === 'transferencia' ? 'QR/Transf' : 'Efectivo')}</small></td>
        <td>${f.estado === 'anulada' ? '<span class="pill bad">Anulada</span>' : '<span class="pill ok">Pagada</span>'}</td>
        <td class="r actions"><button class="btn soft sm" data-act="factura-ver" data-id="${f.id}">Ver</button>
          ${puede('admin') && f.estado === 'pagada' ? `<button class="btn ghost sm" data-act="factura-anular" data-id="${f.id}">Anular</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Aún no hay facturas hoy.</td></tr>'}</tbody>
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
    <section class="card" data-tut="recepcion">
      <div class="card-head"><h3><span class="h-ic">${icon('truck')}</span>Nueva entrega</h3><span class="muted">${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
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
      <div class="card-head"><h3><span class="h-ic">${icon('store')}</span>Recibido por proveedor</h3><span class="muted">últimos 30 días</span></div>
      <div class="table-wrap"><table class="table compact">
        <thead><tr><th>Proveedor</th><th class="r">Entregas</th><th class="r">Unidades</th><th class="r">Costo</th></tr></thead>
        <tbody>${resumen.map(x => `<tr><td>${esc(x.p.nombre)}</td><td class="r">${x.n}</td><td class="r num">${Math.round(x.u).toLocaleString('es-CO')}</td><td class="r num">${money(x.c)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="r">${sum(resumen, x => x.n)}</td><td class="r num">${Math.round(sum(resumen, x => x.u)).toLocaleString('es-CO')}</td><td class="r num">${money(sum(resumen, x => x.c))}</td></tr></tfoot>
      </table></div>
      <div class="card-head sub"><h3><span class="h-ic">${icon('clock')}</span>Entregas recientes</h3></div>
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
  <div class="cards" data-tut="proveedores">${s.proveedores.map(p => {
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

// Alertas sin atender: primero los agotados, luego las más recientes.
const alertasActivas = () => S().alertas.filter(a => !a.atendida).sort((a, b) => (a.tipo === 'agotado' ? -1 : 0) - (b.tipo === 'agotado' ? -1 : 0) || b.fecha - a.fecha);
// Lotes recibidos que vencen en los próximos 7 días (con su entrega y proveedor).
function lotesPorVencer() {
  const s = S();
  const hoy = new Date(inicioDia()).toISOString().slice(0, 10);
  const limite = new Date(inicioDia() + 7 * DIA).toISOString().slice(0, 10);
  const vencen = [];
  for (const e of s.entregas) e.items.forEach((l, item) => {
    const p = s.productos.find(x => x.id === l.productoId);
    if (l.vence && l.vence >= hoy && l.vence <= limite && p?.activo !== false && p?.stock > 0) vencen.push({ ...l, proveedor: e.proveedorNombre, proveedorId: e.proveedorId, entregaId: e.id, item });
  });
  return vencen.sort((a, b) => a.vence.localeCompare(b.vence));
}
const diasPara = v => Math.round((new Date(v + 'T00:00:00') - inicioDia()) / DIA);
const textoVence = d => (d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `En ${d} días`);

function vistaAlertas() {
  const s = S();
  const activas = alertasActivas();
  const atendidas = s.alertas.filter(a => a.atendida).sort((a, b) => (b.fechaAtendida || 0) - (a.fechaAtendida || 0)).slice(0, 8);
  const vencen = lotesPorVencer();
  return `
  <div class="greet card ${activas.length ? 'warn-bg' : ''}">
    <div class="tomi-greet3d" data-tomi3d="alertas" data-estado="${activas.length ? 'preocupado' : 'celebrando'}" title="Tomi"></div>
    <div><h2>${activas.length ? `${activas.length} alerta${activas.length > 1 ? 's' : ''} por atender` : '¡Sin alertas pendientes!'}</h2>
    <p>${activas.length ? 'Se crean solas cuando un producto queda en su stock mínimo o se agota, y se cierran solas cuando entra mercancía.' : 'El inventario está sano. Tomi está feliz.'}</p></div>
    <div class="sev">
      <span class="sev-item bad"><b>${activas.filter(a => a.tipo === 'agotado').length}</b>Agotados</span>
      <span class="sev-item warn"><b>${activas.filter(a => a.tipo !== 'agotado').length}</b>Stock bajo</span>
      <span class="sev-item amber"><b>${vencen.length}</b>Por vencer</span>
    </div>
  </div>
  <div class="grid-2" data-tut="alertas">
    <section class="card">
      <div class="card-head"><h3><span class="h-ic bad">${icon('bell')}</span>Stock bajo y agotados</h3>${puede('admin') ? '' : '<span class="pill info">Solo lectura</span>'}</div>
      <ul class="list">${activas.map(a => `<li class="alert-li ${a.tipo}">
        <span class="prod-emoji">${imgProducto(s.productos.find(p => p.id === a.productoId) || { nombre: a.productoNombre })}</span>
        <div class="li-main"><b>${esc(a.productoNombre)}</b><small>Quedan ${a.stock} · mínimo ${a.stockMinimo ?? '—'} · ${fechaHora(a.fecha)}</small></div>
        <span class="pill ${a.tipo === 'agotado' ? 'bad' : 'warn'}">${a.tipo === 'agotado' ? 'Agotado' : 'Stock bajo'}</span>
        <div class="row">${puede('admin', 'bodega') ? `<button class="btn soft sm" data-act="recibir" data-id="${a.productoId}">Recibir</button>` : ''}
        ${puede('admin') ? `<button class="btn ghost sm" data-act="alerta-atender" data-id="${a.id}">${icon('check')}Atendida</button>` : ''}</div></li>`).join('') || `<li class="muted">Nada por aquí.</li>`}</ul>
      ${puede('admin') ? '' : '<p class="muted note solo-lectura">Puedes ver las alertas, pero solo el administrador las marca como atendidas. Si ves stock bajo, avísale.</p>'}
    </section>
    <section class="card">
      <div class="card-head"><h3><span class="h-ic warn">${icon('calendar')}</span>Por vencer en 7 días</h3><span class="muted">según lotes recibidos</span></div>
      <ul class="list">${vencen.map(v => { const d = diasPara(v.vence); return `<li>
        <div class="li-main"><b>${esc(v.nombre)}</b><small>Lote ${esc(v.lote || '—')} · ${esc(v.proveedor)} · ${fmtCant(v.cantidad, v.unidad)}</small></div>
        <span class="pill ${d <= 2 ? 'bad' : 'warn'}">${textoVence(d)}</span>
        ${puede('admin', 'bodega') ? `<button class="btn soft sm llamar-btn" data-act="llamar-proveedor" data-entrega="${v.entregaId}" data-item="${v.item}">${icon('phone')}Llamar al proveedor</button>` : ''}
        </li>`; }).join('') || '<li class="muted">Ningún lote vence esta semana.</li>'}</ul>
      <div class="card-head sub"><h3><span class="h-ic">${icon('check')}</span>Atendidas recientemente</h3></div>
      <ul class="list dim">${atendidas.map(a => `<li><div class="li-main"><b>${esc(a.productoNombre)}</b><small>${a.resuelta === 'auto' ? 'Se cerró sola al entrar mercancía' : 'Atendida por ' + esc(a.atendidaPor ?? '—')} · ${a.fechaAtendida ? fechaHora(a.fechaAtendida) : ''}</small></div><span class="pill ok">Resuelta</span></li>`).join('') || '<li class="muted">Ninguna todavía.</li>'}</ul>
    </section>
  </div>`;
}

function vistaHistorial() {
  const s = S();
  const hoy0 = inicioDia();
  const dentroRango = fecha => {
    if (ui.histRango === 'hoy') return fecha >= hoy0;
    if (ui.histRango === '7d') return fecha >= hoy0 - 6 * DIA;
    if (ui.histRango === '30d') return fecha >= hoy0 - 29 * DIA;
    return true;
  };
  const tipos = { entrada: ['Entrada', 'ok'], salida: ['Salida', 'info'], ajuste: ['Ajuste', 'warn'] };
  const historialFiltrado = s.historial.filter(h => dentroRango(h.fecha)).slice(0, 150);
  const movs = s.movimientos.filter(m => dentroRango(m.fecha) && (ui.histTipo === 'todos' || m.tipo === ui.histTipo)).slice(0, 150);
  return `
  <div class="toolbar" data-tut="historial" style="margin-bottom: 8px;">
    <div class="chips" style="margin: 0;">
      <button class="chip ${ui.histTab === 'actividad' ? 'on' : ''}" data-act="hist-tab" data-tab="actividad">Actividad del equipo</button>
      <button class="chip ${ui.histTab === 'movimientos' ? 'on' : ''}" data-act="hist-tab" data-tab="movimientos">Movimientos de stock</button>
    </div>
    <button class="btn soft sm" data-act="exportar-kardex" title="Descargar movimientos de stock en tabla de Excel (.xlsx)">${icon('download')}<span>Exportar Kardex (Excel)</span></button>
  </div>
  <div class="chips small" style="margin-bottom: 12px;">
    ${[['todos', 'Cualquier fecha'], ['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días']].map(([r, lbl]) => `<button class="chip ${ui.histRango === r ? 'on' : ''}" data-act="hist-rango" data-rango="${r}">${lbl}</button>`).join('')}
  </div>
  ${ui.histTab === 'actividad' ? `
  <section class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead>
    <tbody>${historialFiltrado.map(h => `<tr><td class="nowrap">${fechaHora(h.fecha)}</td><td>${esc(h.usuarioNombre)}</td><td>${esc(h.accion)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sin registros en este periodo.</td></tr>'}</tbody>
  </table></div></section>` : `
  <div class="chips small">${['todos', 'entrada', 'salida', 'ajuste'].map(t => `<button class="chip ${ui.histTipo === t ? 'on' : ''}" data-act="hist-tipo" data-tipo="${t}">${t === 'todos' ? 'Todos' : tipos[t][0] + 's'}</button>`).join('')}</div>
  <section class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="r">Cantidad</th><th class="r">Stock</th><th>Origen</th><th>Usuario</th></tr></thead>
    <tbody>${movs.map(m => `<tr>
      <td class="nowrap">${fechaHora(m.fecha)}</td><td>${esc(m.productoNombre)}</td>
      <td><span class="pill ${tipos[m.tipo][1]}">${tipos[m.tipo][0]}</span></td>
      <td class="r num ${m.cantidad > 0 ? 'pos-t' : 'neg-t'}">${m.cantidad > 0 ? '+' : ''}${Number(m.cantidad).toLocaleString('es-CO')}</td>
      <td class="r num nowrap">${m.stockAntes != null ? `${m.stockAntes} → ${m.stockDespues}` : '—'}</td>
      <td class="mono small">${esc(m.origen)}${m.motivo ? `<small class="block muted">${esc(m.motivo)}</small>` : ''}</td><td>${esc(m.usuarioNombre)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin movimientos en este periodo.</td></tr>'}</tbody>
  </table></div></section>`}`;
}

function vistaUsuarios() {
  const s = S();
  return `
  <div class="toolbar"><span class="muted">${s.usuarios.filter(u => u.activo).length} activos de ${s.usuarios.length}</span>
    <button class="btn primary" data-act="user-nuevo">${icon('plus')}Empleado</button></div>
  <section class="card flush" data-tut="usuarios"><div class="table-wrap"><table class="table">
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
  const cont = $('#toasts');
  while (cont.children.length >= 2) {
    cont.firstElementChild.remove();
  }
  const t = document.createElement('div');
  t.className = 'toast ' + estado;
  t.setAttribute('role', 'status');
  const titulo = estado === 'preocupado' ? 'Tomi · Atención' : estado === 'celebrando' ? 'Tomi · ¡Listo!' : 'Tomi · Notificación';
  t.innerHTML = `
    ${tomi(estado, 'tomi-toast')}
    <div class="toast-body">
      <div class="toast-head"><b>${titulo}</b><small>Ahora</small></div>
      <span>${esc(msg)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">×</button>
  `;
  t.querySelector('.toast-close')?.addEventListener('click', () => t.remove());
  cont.append(t);
  setTimeout(() => t.classList.add('fuera'), 3800);
  setTimeout(() => t.remove(), 4200);
}
const opt = (v, txt, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(txt)}</option>`;
const campo = (label, input, ayuda = '') => `<label class="field"><span>${label}</span>${input}${ayuda ? `<small class="muted">${ayuda}</small>` : ''}</label>`;

function formProducto(p) {
  const s = S();
  const nuevo = !p;
  const catInicial = p?.categoriaId || (ui.prodCat !== 'todas' ? ui.prodCat : s.categorias[0]?.id);
  const nomCatInicial = categoria(catInicial)?.nombre || '';
  const ivaInicial = nuevo ? ivaPorDefectoCategoria(catInicial, nomCatInicial) : ivaDe(p);
  p = p || { nombre: '', codigoBarras: '', categoriaId: catInicial, unidad: 'und', precioVenta: '', costo: '', stockMinimo: 10, stock: 0, icono: '', iva: ivaInicial };
  abrirModal({
    titulo: nuevo ? 'Nuevo producto' : 'Editar producto', enviar: nuevo ? 'Crear producto' : 'Guardar cambios',
    cuerpo: `<div class="form-grid">
      ${campo('Nombre', `<input name="nombre" required value="${esc(p.nombre)}" placeholder="Leche entera 1 L">`)}
      ${campo('Imagen del producto', `<div class="img-field"><span class="prod-emoji big" id="img-preview">${imgProducto(p)}</span><div><input name="imagen" type="file" accept="image/*" id="img-input">${p.imagen ? '<label class="small"><input type="checkbox" name="quitarImagen"> Quitar imagen actual</label>' : ''}</div></div>`, 'JPG o PNG; se recorta en cuadrado')}
      ${campo('Ícono / Emoji', `<input name="icono" maxlength="4" value="${esc(p.icono || '')}" placeholder="${iconoProducto(p)}">`, 'Se elige solo según el nombre si lo dejas vacío')}
      ${campo('Código de barras', `<input name="codigoBarras" required inputmode="numeric" pattern="[0-9]{8,14}" value="${esc(p.codigoBarras)}" placeholder="7702001012345">`, 'EAN-13: 8 a 14 dígitos')}
      ${campo('Categoría', `<select name="categoriaId" id="prod-categoria" required>${s.categorias.map(c => opt(c.id, `${c.icono} ${c.nombre}`, p.categoriaId)).join('')}</select>`)}
      ${campo('Tarifa de IVA', `<select name="iva" id="prod-iva" required>${OPCIONES_IVA.map(o => opt(o.valor, o.etiqueta, ivaInicial)).join('')}</select>`, 'Frutas y verduras: 0% · Aseo: 19%')}
      ${campo('Unidad', `<select name="unidad">${opt('und', 'Unidad (und)', p.unidad)}${opt('kg', 'Kilogramo (kg)', p.unidad)}${opt('lt', 'Litro (lt)', p.unidad)}</select>`)}
      ${campo('Precio de venta (IVA incluido)', `<input name="precioVenta" type="number" min="0" step="50" required value="${esc(p.precioVenta)}">`)}
      ${campo('Costo', `<input name="costo" type="number" min="0" step="50" required value="${esc(p.costo)}">`)}
      ${campo('Stock mínimo', `<input name="stockMinimo" type="number" min="0" step="any" required value="${esc(p.stockMinimo)}">`, 'Al llegar aquí se crea una alerta')}
      ${nuevo ? campo('Stock inicial', `<input name="stock" type="number" min="0" step="any" value="0">`, 'Queda registrado como entrada') : campo('Stock actual', `<input value="${fmtCant(p.stock, p.unidad)}" disabled>`, 'Cambia con entregas, ventas o ajustes')}
    </div>`,
    onSubmit: async fd => {
      const iconoTxt = (fd.get('icono') || '').trim();
      const ivaSeleccionado = normalizarTarifaIva(fd.get('iva'), 19);
      const data = {
        nombre: fd.get('nombre').trim(),
        codigoBarras: fd.get('codigoBarras').trim(),
        categoriaId: fd.get('categoriaId'),
        unidad: fd.get('unidad'),
        precioVenta: Number(fd.get('precioVenta')),
        costo: Number(fd.get('costo')),
        stockMinimo: Number(fd.get('stockMinimo')),
        iva: ivaSeleccionado,
        ...(iconoTxt ? { icono: iconoTxt } : {}),
      };
      const archivo = fd.get('imagen');
      if (archivo && archivo.size) data.imagen = await redimensionarImagen(archivo);
      else if (fd.get('quitarImagen')) data.imagen = '';
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
  const metodosNom = { efectivo: 'Efectivo', transferencia: 'Transferencia / QR', tarjeta: 'Tarjeta Débito/Crédito' };
  const resumenIva = calcularResumenIVA(f.items, S().productos);
  const cliente = f.cliente || { nombre: 'Consumidor Final', documento: '222222222222' };
  const metodo = metodosNom[f.metodoPago] || f.metodoPago || 'Efectivo';

  return `<div class="invoice print-area">
    <div class="inv-head">
      <div>
        <b class="inv-brand">🍅 FrescoStock</b>
        <small>Supermercado FrescoStock S.A.S.</small>
        <small>NIT: 900.543.210-1 · IVA Régimen Común</small>
        <small>Carrera 45 # 26-85 · Tel: (601) 345-6789</small>
      </div>
      <div class="r">
        <b class="mono" style="font-size: 1.15rem; color: var(--brand);">${f.numero}</b>
        <small>${fechaHora(f.fecha)}</small>
        <small>Caja 01 · ${esc(f.cajeroNombre)}</small>
      </div>
    </div>

    <div class="inv-client">
      <div><b>Cliente:</b> ${esc(cliente.nombre || 'Consumidor Final')}</div>
      <div><b>Doc/NIT:</b> <span class="mono">${esc(cliente.documento || '222222222222')}</span></div>
    </div>

    <table class="inv-table">
      <thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">IVA</th><th class="r">Precio</th><th class="r">Total</th></tr></thead>
      <tbody>${f.items.map((l, idx) => `<tr><td>${esc(l.nombre)}</td><td class="r">${fmtCant(l.cantidad, l.unidad)}</td><td class="r">${resumenIva.lineas[idx]?.iva ?? 0}%</td><td class="r">${money(l.precio)}</td><td class="r">${money(l.cantidad * l.precio)}</td></tr>`).join('')}</tbody>
    </table>

    <div class="inv-calc">
      <div class="inv-calc-row"><span class="muted">Subtotal sin IVA (base gravable):</span><span class="num">${money(resumenIva.subtotalSinIva)}</span></div>
      <div class="inv-calc-row"><span class="muted">Total IVA 5%:</span><span class="num">${money(resumenIva.iva5)}</span></div>
      <div class="inv-calc-row"><span class="muted">Total IVA 19%:</span><span class="num">${money(resumenIva.iva19)}</span></div>
      <div class="inv-total"><span>Total final a pagar:</span><b class="num">${money(resumenIva.total)}</b></div>

      <div class="inv-calc-row" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--line);">
        <span>Medio de pago:</span><b>${metodo}</b>
      </div>
      ${f.metodoPago === 'efectivo' && f.pagaCon != null ? `
      <div class="inv-calc-row"><span class="muted">Efectivo recibido:</span><span class="num">${money(f.pagaCon)}</span></div>
      <div class="inv-calc-row"><span class="muted">Cambio / Devuelta:</span><b class="num pos-t">${money(f.cambio || 0)}</b></div>
      ` : ''}
    </div>

    <div class="inv-foot">
      <div class="inv-barcode">|||| | ||| || |||||| | ||||</div>
      <p>¡Gracias por su compra en FrescoStock!</p>
      <small>Conserve este ticket para cambios o garantías (hasta 15 días).</small>
      ${f.estado === 'anulada' ? '<div class="form-error" style="text-align:center; margin-top: 6px;">FACTURA ANULADA</div>' : ''}
    </div>
  </div>`;
}

function verFactura(f, recienCreada) {
  abrirModal({
    titulo: recienCreada ? '¡Venta registrada!' : `Factura ${f.numero}`, clase: 'wide',
    cuerpo: `${recienCreada ? `<div class="celebra">${tomi('celebrando', 'tomi-celebra')}<p>Factura generada y stock descontado automáticamente.</p></div>` : ''}${htmlFactura(f)}`,
    extra: `<button type="button" class="btn soft" data-act="imprimir">${icon('print')}Imprimir</button>`,
  });
}

function formCobro(total) {
  let metodo = 'efectivo';
  const lineas = ui.carrito.map(it => ({ ...it, p: S().productos.find(p => p.id === it.productoId) })).filter(l => l.p);
  const resumenIva = calcularResumenIVA(lineas, S().productos);
  total = resumenIva.total || total;

  const actualizarCambio = () => {
    const inputPaga = $('#cobro-paga');
    const display = $('#cobro-cambio');
    const valor = Number(inputPaga?.value) || 0;
    const cambio = Math.max(0, valor - total);
    if (display) {
      display.textContent = money(cambio);
      $('#cobro-cambio-wrap')?.classList.toggle('positivo', valor >= total);
    }
  };

  abrirModal({
    titulo: 'Cobrar venta',
    enviar: 'Confirmar y Facturar',
    clase: 'wide',
    cuerpo: `
      <div class="tax-box">
        <div class="tax-row"><span>Subtotal sin IVA <small>(base gravable)</small></span><span class="num">${money(resumenIva.subtotalSinIva)}</span></div>
        <div class="tax-row"><span>Total IVA 5%</span><span class="num">${money(resumenIva.iva5)}</span></div>
        <div class="tax-row"><span>Total IVA 19%</span><span class="num">${money(resumenIva.iva19)}</span></div>
      </div>
      <div class="total" style="font-size: 1.25rem; margin-bottom: 8px;">
        <span>Total final a pagar <small>(IVA incluido)</small></span>
        <b class="num" style="font-size: 1.8rem; color: var(--brand);">${money(total)}</b>
      </div>
      
      <label class="field">
        <span>Método de pago</span>
        <div class="pay-grid" id="cobro-metodos">
          <button type="button" class="pay-tile on" data-metodo="efectivo">${icon('coin')}<span>Efectivo</span></button>
          <button type="button" class="pay-tile" data-metodo="transferencia">${icon('qr')}<span>Transferencia / QR</span></button>
          <button type="button" class="pay-tile" data-metodo="tarjeta">${icon('creditCard')}<span>Tarjeta</span></button>
        </div>
      </label>

      <div id="cobro-cash-section" class="stack">
        <label class="field">
          <span>Paga con cuánto efectivo ($)</span>
          <input id="cobro-paga" name="pagaCon" type="number" min="${total}" step="500" value="${total}">
          <div class="denoms">
            <button type="button" data-denom="exacto">Exacto (${money(total)})</button>
            <button type="button" data-denom="sumar" data-val="2000">+$2.000</button>
            <button type="button" data-denom="sumar" data-val="5000">+$5.000</button>
            <button type="button" data-denom="sumar" data-val="10000">+$10.000</button>
            <button type="button" data-denom="sumar" data-val="20000">+$20.000</button>
            <button type="button" data-denom="sumar" data-val="50000">+$50.000</button>
          </div>
        </label>
        
        <div class="cambio-box" id="cobro-cambio-wrap">
          <div><span class="muted block small">Cambio / Devuelta</span><b>A entregar al cliente</b></div>
          <span class="cambio-val num" id="cobro-cambio">$0</span>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 6px;">
        ${campo('Cliente (Opcional)', '<input name="clienteNombre" value="Consumidor Final" placeholder="Nombre completo">')}
        ${campo('Cédula o NIT', '<input name="clienteDoc" value="222222222222" placeholder="Número de documento">')}
      </div>
    `,
    onSubmit: async fd => {
      const datosCobro = {
        metodoPago: metodo,
        pagaCon: metodo === 'efectivo' ? Number(fd.get('pagaCon')) || total : total,
        cliente: {
          nombre: fd.get('clienteNombre'),
          documento: fd.get('clienteDoc'),
        },
      };
      const f = await store.crearFactura(ui.carrito.map(i => ({ ...i })), sesion, datosCobro);
      ui.carrito = [];
      render();
      verFactura(f, true);
    },
  });

  const modalEl = $('#modal');
  modalEl.querySelectorAll('#cobro-metodos .pay-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      modalEl.querySelectorAll('#cobro-metodos .pay-tile').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      metodo = btn.dataset.metodo;
      const cashSec = $('#cobro-cash-section');
      if (cashSec) cashSec.style.display = metodo === 'efectivo' ? 'grid' : 'none';
      const inputPaga = $('#cobro-paga');
      if (inputPaga) {
        inputPaga.required = metodo === 'efectivo';
        if (metodo !== 'efectivo') inputPaga.value = total;
      }
    });
  });

  const inputPaga = $('#cobro-paga');
  if (inputPaga) {
    inputPaga.addEventListener('input', actualizarCambio);
  }

  modalEl.querySelectorAll('[data-denom]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.denom === 'exacto') {
        inputPaga.value = total;
      } else if (btn.dataset.denom === 'sumar') {
        inputPaga.value = (Number(inputPaga.value) || total) + Number(btn.dataset.val);
      }
      actualizarCambio();
    });
  });
}

function exportarProductosCSV() {
  const prods = activos().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
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
  const filas = prods.map(p => {
    const c = categoria(p.categoriaId);
    const estado = p.stock <= 0 ? 'Agotado' : p.stock <= p.stockMinimo ? 'Bajo' : 'Disponible';
    const costo = Number(p.costo) || 0;
    const precio = Number(p.precioVenta) || 0;
    const stock = Number(p.stock) || 0;
    const minimo = Number(p.stockMinimo) || 0;
    return [
      String(p.codigoBarras || ''),
      p.nombre,
      c ? c.nombre : 'Sin categoría',
      p.unidad,
      costo,
      precio,
      stock,
      minimo,
      Math.round(stock * costo),
      estado,
    ];
  });
  const totalStock = r3(sum(prods, p => Number(p.stock) || 0));
  const totalValor = Math.round(sum(prods, p => (Number(p.stock) || 0) * (Number(p.costo) || 0)));
  const fechaStr = new Date().toISOString().slice(0, 10);
  descargarCSV(`frescostock_inventario_${fechaStr}`, encabezados, filas, {
    hoja: 'Inventario',
    tipos: ['codigo', 'texto', 'texto', 'codigo', 'moneda', 'moneda', 'numero', 'numero', 'moneda', 'estado'],
    totales: ['TOTAL', `${prods.length} productos`, '', '', '', '', totalStock, '', totalValor, ''],
  });
  toast('Tabla de inventario exportada a Excel.');
}

function exportarVentasCSV() {
  const hoy0 = inicioDia();
  const facturasHoy = S().facturas.filter(f => f.fecha >= hoy0);
  const encabezados = ['Número', 'Fecha y Hora', 'Cajero', 'Cliente', 'Documento', 'Método de Pago', 'Total', 'Estado', 'Detalle Items'];
  const filas = facturasHoy.map(f => [
    f.numero,
    fechaHora(f.fecha),
    f.cajeroNombre,
    f.cliente?.nombre || 'Consumidor Final',
    String(f.cliente?.documento || '—'),
    f.metodoPago || 'Efectivo',
    Number(f.total) || 0,
    f.estado === 'anulada' ? 'Anulada' : 'Pagada',
    f.items.map(it => `${it.nombre} (${it.cantidad} ${it.unidad})`).join(' · '),
  ]);
  const totalVentas = Math.round(sum(facturasHoy.filter(f => f.estado === 'pagada'), f => Number(f.total) || 0));
  const fechaStr = new Date().toISOString().slice(0, 10);
  descargarCSV(`frescostock_ventas_${fechaStr}`, encabezados, filas, {
    hoja: 'Ventas de Hoy',
    tipos: ['codigo', 'texto', 'texto', 'texto', 'codigo', 'texto', 'moneda', 'estado', 'texto'],
    totales: ['TOTAL PAGADAS', `${facturasHoy.length} facturas`, '', '', '', '', totalVentas, '', ''],
  });
  toast('Reporte de ventas de hoy exportado a Excel.');
}

function exportarKardexCSV() {
  const movs = S().movimientos;
  const encabezados = ['Fecha y Hora', 'Tipo', 'Producto', 'Cantidad', 'Stock Antes', 'Stock Después', 'Origen', 'Motivo', 'Usuario'];
  const filas = movs.map(m => [
    fechaHora(m.fecha),
    m.tipo,
    m.productoNombre,
    Number(m.cantidad) || 0,
    m.stockAntes ?? '—',
    m.stockDespues ?? '—',
    m.origen,
    m.motivo || '',
    m.usuarioNombre,
  ]);
  const fechaStr = new Date().toISOString().slice(0, 10);
  descargarCSV(`frescostock_movimientos_${fechaStr}`, encabezados, filas, {
    hoja: 'Movimientos Kardex',
    tipos: ['texto', 'codigo', 'texto', 'numero', 'numero', 'numero', 'codigo', 'texto', 'texto'],
  });
  toast('Historial de movimientos exportado a Excel.');
}

let camaraStream = null;
async function abrirCamaraEscaner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return toast('Tu navegador o dispositivo no soporta acceso a la cámara.', 'preocupado');
  }

  abrirModal({
    titulo: 'Escanear código de barras con cámara',
    clase: 'wide',
    cuerpo: `
      <div class="scanner-view">
        <p class="muted">Apunta la cámara al código de barras del producto.</p>
        <div class="scanner-wrap">
          <video id="scanner-video" autoplay playsinline muted></video>
          <div class="scanner-reticle"></div>
          <div class="scanner-laser"></div>
        </div>
        <p class="small muted" id="scanner-info">Buscando código de barras…</p>
      </div>
    `,
    extra: '',
  });

  const video = $('#scanner-video');
  const info = $('#scanner-info');

  try {
    camaraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    });
    if (video) {
      video.srcObject = camaraStream;
      await video.play();
    }

    const modalEl = $('#modal');
    modalEl.addEventListener('close', () => {
      if (camaraStream) {
        camaraStream.getTracks().forEach(t => t.stop());
        camaraStream = null;
      }
    }, { once: true });

    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'],
      });

      let activo = true;
      const escanearFrame = async () => {
        if (!activo || !video || video.readyState < 2 || !modalEl.open) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            activo = false;
            const codigo = barcodes[0].rawValue;
            beep();
            modalEl.close();
            procesarCodigoEscaneado(codigo);
            return;
          }
        } catch {}
        if (modalEl.open) requestAnimationFrame(escanearFrame);
      };
      requestAnimationFrame(escanearFrame);
    } else {
      if (info) info.textContent = 'Detección por cámara lista. Enfoca el código o escribe el número abajo.';
    }
  } catch (err) {
    if (info) info.textContent = 'No se pudo acceder a la cámara: ' + err.message;
  }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

function procesarCodigoEscaneado(codigo) {
  const exacto = activos().find(p => p.codigoBarras === codigo.trim());
  if (exacto) {
    agregarAlCarrito(exacto.id);
    toast(`¡Código leído! Agregado "${exacto.nombre}".`, 'celebrando');
  } else {
    toast(`Código ${codigo} no corresponde a ningún producto registrado.`, 'preocupado');
  }
}

function darDeBajaVencido(d) {
  const p = busca('productos', d.id);
  if (!p) return;
  abrirModal({
    titulo: `Dar de baja por vencimiento · ${p.nombre}`,
    enviar: 'Dar de baja (Merma)',
    peligro: true,
    cuerpo: `<p class="muted">Este lote de <b>${esc(p.nombre)}</b> venció o está próximo a expirar. Se restará del stock y quedará registrado en el historial como merma.</p>
      <div class="form-grid">
        ${campo('Cantidad a dar de baja', `<input name="cantidad" type="number" min="0" step="${p.unidad === 'und' ? '1' : '0.1'}" value="${d.cant || 1}" required>`)}
        ${campo('Motivo', `<input name="motivo" value="Producto vencido (Lote ${esc(d.lote || '—')})" readonly>`)}
        ${campo('Nota adicional (opcional)', '<input name="nota" placeholder="Ej: Retirado de estantería por vencimiento">')}
      </div>`,
    onSubmit: async fd => {
      const cant = -Math.abs(Number(fd.get('cantidad')));
      const motivo = fd.get('motivo') + (fd.get('nota').trim() ? ` · ${fd.get('nota').trim()}` : '');
      await store.ajustarStock(p.id, cant, motivo, sesion);
      toast(`Se dio de baja ${Math.abs(cant)} ${p.unidad} de ${p.nombre}.`, 'celebrando');
    },
  });
}

// ---------- acciones ----------
const busca = (col, id) => S()[col].find(x => x.id === id);
const ACCIONES = {
  'ir': d => { ruta = d.ruta; ui.menu = false; ui.avisos = false; render(); window.scrollTo({ top: 0 }); },
  'menu': () => { ui.menu = !ui.menu; ui.avisos = false; render(); },
  'avisos': () => { ui.avisos = !ui.avisos; ui.menu = false; render(); },
  'tutorial': () => abrirTutorial(0),
  'tut-sig': () => irAPaso(ui.tut.i + 1),
  'tut-ant': () => irAPaso(ui.tut.i - 1),
  'tut-paso': d => irAPaso(Number(d.i)),
  'tut-repetir': () => leerEnVoz(textoParaVoz(ui.tut.pasos[ui.tut.i])),
  'tut-voz': () => {
    try { localStorage.setItem(TUT_VOZ, vozTutorial() ? 'false' : 'true'); } catch {}
    pintarTutorial();
  },
  'tut-cerrar': () => cerrarTutorial(),
  'toggle-sonido': () => {
    const activo = alternarSonido();
    toast(activo ? 'Sonidos de Tomi activados 🔊' : 'Sonidos de Tomi silenciados 🔇', 'feliz');
    render();
  },
  'demo-login': async d => {
    try {
      sesion = await store.login(d.email);
      ruta = 'inicio';
      render();
      toast(`¡Bienvenido, ${sesion.nombre.split(' ')[0]}!`, 'celebrando');
      saludarAlEntrar(sesion.nombre);
      ofrecerTutorial();
    } catch (e) {
      toast(e.message, 'preocupado');
    }
  },
  'salir': async () => { cerrarTutorial(); await store.logout(); sesion = null; ui.menu = false; ui.carrito = []; render(); },
  'instalar': async () => { if (!instalador) return; instalador.prompt(); await instalador.userChoice; instalador = null; render(); },
  'reset': () => { ui.menu = false; render(); confirmar('Reiniciar demo', 'Se borran tus cambios y vuelven los datos de ejemplo.', 'Reiniciar', async () => { await store.reset(); ui.carrito = []; ui.recep = { proveedorId: '', items: [filaVacia()] }; toast('Datos de la demo reiniciados.'); }); },  'modal-cerrar': () => $('#modal').close(),
  'imprimir': () => window.print(),

  'prod-cat': d => { ui.prodCat = d.cat; render(); },
  'prod-nuevo': () => formProducto(),
  'prod-editar': d => formProducto(busca('productos', d.id)),
  'prod-ajustar': d => formAjuste(busca('productos', d.id)),
  'prod-eliminar': d => { const p = busca('productos', d.id); confirmar('Eliminar producto', `"${esc(p.nombre)}" dejará de aparecer en caja y en el catálogo. Su historial se conserva.`, 'Eliminar', async () => { await store.remove('productos', p.id, sesion); toast('Producto eliminado.'); }); },
  'categorias': () => formCategorias(),
  'cat-eliminar': async d => { try { await store.remove('categorias', d.id, sesion); formCategorias(); toast('Categoría eliminada.'); } catch (e) { const p = $('#modal-error'); p.textContent = e.message; p.hidden = false; } },

  'caja-cat': d => { ui.cajaCat = d.cat; render(); },
  'camara': () => abrirCamaraEscaner(),
  'exportar-productos': () => exportarProductosCSV(),
  'exportar-ventas': () => exportarVentasCSV(),
  'exportar-kardex': () => exportarKardexCSV(),
  'baja-vencimiento': d => darDeBajaVencido(d),
  'hist-rango': d => { ui.histRango = d.rango; render(); },
  'agregar': d => agregarAlCarrito(d.id),
  'mas': d => agregarAlCarrito(d.id),
  'menos': d => {
    const it = ui.carrito.find(i => i.productoId === d.id); const p = busca('productos', d.id);
    it.cantidad = r3(it.cantidad - (p.unidad === 'kg' ? 0.5 : 1));
    if (it.cantidad <= 0) ui.carrito = ui.carrito.filter(i => i !== it);
    render();
  },
  'vaciar': () => { ui.carrito = []; render(); },
  'cobrar': () => {
    const lineas = ui.carrito.map(it => ({ ...it, p: S().productos.find(p => p.id === it.productoId) })).filter(l => l.p);
    const total = sum(lineas, l => Math.round(l.cantidad * l.p.precioVenta));
    formCobro(total);
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

  'llamar-proveedor': d => {
    const e = busca('entregas', d.entrega);
    const l = e?.items[Number(d.item)];
    if (!l) return toast('No encontré ese lote. Recarga la pantalla.', 'preocupado');
    const prov = busca('proveedores', e.proveedorId) || S().proveedores.find(x => x.nombre === e.proveedorNombre);
    const tel = (prov?.telefono || '').trim();
    const dias = diasPara(l.vence);
    abrirModal({
      titulo: 'Llamar al proveedor',
      cuerpo: `<div class="llamar">
        <div class="llamar-prod"><span class="prod-emoji big">${imgProducto(busca('productos', l.productoId) || { nombre: l.nombre })}</span>
          <div><b>${esc(l.nombre)}</b><small>Lote ${esc(l.lote || '—')} · ${fmtCant(l.cantidad, l.unidad)} · vence ${esc(l.vence)}</small>
          <span class="pill ${dias <= 2 ? 'bad' : 'warn'}">${textoVence(dias)}</span></div></div>
        <dl class="dl"><dt>Proveedor</dt><dd><b>${esc(prov?.nombre || e.proveedorNombre)}</b></dd>
          <dt>Contacto</dt><dd>${esc(prov?.contacto || '—')}</dd>
          <dt>Teléfono</dt><dd class="mono">${esc(tel || '—')}</dd></dl>
        ${tel ? '<p class="note muted">Pídele el cambio de esta mercancía antes de que venza. La llamada no descuenta nada del inventario.</p>'
          : `<p class="form-error">${prov ? 'Este proveedor no tiene un teléfono registrado.' : 'Este proveedor ya no está en el sistema.'} Actualiza su información en Proveedores para poder llamarlo.</p>`}
      </div>`,
      extra: tel ? `<a class="btn primary btn-llamar" href="tel:${esc(tel.replace(/[^\d+]/g, ''))}">${icon('phone')}Llamar a ${esc(prov.nombre)}</a>`
        : prov && puede('admin') ? `<button type="button" class="btn soft btn-llamar" data-act="prov-editar" data-id="${prov.id}">${icon('edit')}Actualizar proveedor</button>` : '',
    });
  },
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
  ui.recienAgregado = id; // solo esa línea del carrito se anima
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) {
    if (ui.menu && !e.target.closest('.me')) { ui.menu = false; render(); }
    if (ui.avisos && !e.target.closest('.avisos-wrap')) { ui.avisos = false; render(); }
    return;
  }
  if (b.tagName === 'A') e.preventDefault();
  // Cualquier otro botón cierra el panel de la campanita.
  const cerrarAvisos = ui.avisos && !b.closest('.avisos-wrap');
  if (cerrarAvisos) ui.avisos = false;
  ACCIONES[b.dataset.act]?.(b.dataset, b, e);
  if (cerrarAvisos && $('.avisos')) programarRender();
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
  if (e.target.id === 'img-input' && e.target.files?.[0]) {
    const prev = $('#img-preview');
    if (prev) prev.innerHTML = `<img class="prod-img" alt="Vista previa" src="${URL.createObjectURL(e.target.files[0])}">`;
  }
  if (e.target.id === 'prod-categoria') {
    const cat = categoria(e.target.value);
    const selectIva = $('#prod-iva');
    if (selectIva) {
      selectIva.value = String(ivaPorDefectoCategoria(e.target.value, cat?.nombre || ''));
    }
  }
  if (e.target.matches('[data-recprov]')) { ui.recep.proveedorId = e.target.value; render(); }
});

// Escáner de código de barras y atajos de teclado rápidos para la caja
document.addEventListener('keydown', e => {
  // Con el tutorial abierto, las flechas pasan de paso y los atajos de caja no actúan.
  if (ui.tut) {
    if (e.key === 'ArrowRight') irAPaso(ui.tut.i + 1);
    if (e.key === 'ArrowLeft') irAPaso(ui.tut.i - 1);
    if (e.key === 'Escape') cerrarTutorial();
    return;
  }
  if (e.key === 'Escape' && ui.avisos) { ui.avisos = false; render(); return; }
  // F2: Enfocar barra de búsqueda / lector en caja
  if (e.key === 'F2') {
    e.preventDefault();
    if (ruta !== 'caja') { ruta = 'caja'; render(); }
    const input = $('#cajaQ');
    if (input) { input.focus(); input.select(); }
    return;
  }
  // F4: Cobrar venta si hay productos
  if (e.key === 'F4' && ruta === 'caja' && ui.carrito.length > 0 && !$('#modal')?.open) {
    e.preventDefault();
    const lineas = ui.carrito.map(it => ({ ...it, p: S().productos.find(p => p.id === it.productoId) })).filter(l => l.p);
    const total = sum(lineas, l => Math.round(l.cantidad * l.p.precioVenta));
    formCobro(total);
    return;
  }
  // Escape: limpiar búsqueda si no hay modal abierto
  if (e.key === 'Escape' && !$('#modal')?.open && ruta === 'caja' && ui.cajaQ) {
    ui.cajaQ = '';
    render();
    return;
  }

  // Enter en el buscador general de la barra superior: usa los buscadores que ya existen
  // (el de caja si estás vendiendo; si no, el del catálogo de Productos).
  if (e.key === 'Enter' && e.target.id === 'globalQ') {
    const q = e.target.value.trim();
    if (ruta === 'caja') { ui.cajaQ = q; ui.cajaCat = 'todas'; } else { ui.prodQ = q; ui.prodCat = 'todas'; ruta = 'productos'; }
    render();
    const destino = $(ruta === 'caja' ? '#cajaQ' : '#prodQ');
    if (destino) { destino.focus(); destino.setSelectionRange(destino.value.length, destino.value.length); }
    return;
  }

  // Enter en el buscador de caja: procesa escaneo con lector USB o teclado
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
    saludarAlEntrar(sesion.nombre);
    ofrecerTutorial();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
});

// ---------- PWA ----------
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalador = e; if (sesion) render(); });
window.addEventListener('appinstalled', () => { instalador = null; toast('FrescoStock quedó instalada en tu equipo.', 'celebrando'); if (sesion) render(); });


// ---------- arranque ----------
store.subscribe(() => { if (sesion) programarRender(); });
const atajo = location.hash.slice(1);
if (RUTAS.some(r => r.id === atajo)) ruta = atajo; // accesos directos del ícono instalado
ubicarTomi(); // pantalla de carga mientras Firebase revisa la sesión
sesion = await store.restoreSession();
render();
if (sesion) {
  // Saluda amablemente al usuario cuando interactúa por primera vez si restauró sesión
  window.addEventListener('pointerdown', () => {
    saludarAlEntrar(sesion?.nombre);
  }, { once: true });
}
