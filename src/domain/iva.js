// Gestión de IVA (Impuesto al Valor Agregado) para Colombia: 0%, 5% y 19%.

/**
 * @typedef {0 | 5 | 19} TarifaIVA
 *
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} nombre
 * @property {string} codigoBarras
 * @property {string} categoriaId
 * @property {'und' | 'kg' | 'lt'} unidad
 * @property {number} precioVenta - Precio final al público por unidad (IVA incluido)
 * @property {number} costo - Costo unitario de compra
 * @property {number} stock - Stock actual disponible
 * @property {number} stockMinimo - Stock mínimo para alerta
 * @property {TarifaIVA} iva - Tarifa de IVA en Colombia (0 | 5 | 19)
 * @property {TarifaIVA} [ivaRate] - Alias opcional de la tarifa de IVA
 * @property {string} [icono]
 * @property {string} [imagen]
 * @property {boolean} [activo]
 */

/**
 * @typedef {Object} DesgloseLineaIVA
 * @property {TarifaIVA} iva
 * @property {number} subtotalSinIva
 * @property {number} valorIva
 * @property {number} totalConIva
 */

/**
 * @typedef {Object} ResumenIVA
 * @property {number} subtotalSinIva - Base gravable total antes de impuestos
 * @property {number} base0 - Base exenta/excluida (0%)
 * @property {number} base5 - Base gravable de productos al 5%
 * @property {number} base19 - Base gravable de productos al 19%
 * @property {number} iva5 - Total impuesto IVA 5%
 * @property {number} iva19 - Total impuesto IVA 19%
 * @property {number} totalIva - Suma total de IVA (5% + 19%)
 * @property {number} total - Total final a pagar (IVA incluido)
 * @property {DesgloseLineaIVA[]} lineas
 */

/** @type { readonly [0, 5, 19] } */
export const TARIFAS_IVA = Object.freeze([0, 5, 19]);

/** Opciones para el selector desplegable en el formulario de producto */
export const OPCIONES_IVA = Object.freeze([
  { valor: 0, etiqueta: '0% (Exento/Excluido)' },
  { valor: 5, etiqueta: '5% (Canasta básica procesada)' },
  { valor: 19, etiqueta: '19% (Tarifa general)' },
]);

const norm = texto =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Verifica si un valor corresponde a una tarifa de IVA válida en Colombia (0, 5 o 19).
 * @param {unknown} valor
 * @returns {valor is TarifaIVA}
 */
export function esTarifaIvaValida(valor) {
  if (valor === '' || valor === null || valor === undefined || typeof valor === 'boolean') return false;
  const n = Number(valor);
  return n === 0 || n === 5 || n === 19;
}

/**
 * Normaliza cualquier entrada a una tarifa válida (0 | 5 | 19).
 * @param {unknown} valor
 * @param {TarifaIVA} [porDefecto=19]
 * @returns {TarifaIVA}
 */
export function normalizarTarifaIva(valor, porDefecto = 19) {
  if (esTarifaIvaValida(valor)) return /** @type {TarifaIVA} */ (Number(valor));
  return porDefecto;
}

/**
 * Devuelve la tarifa de IVA por defecto al seleccionar una categoría en el formulario.
 * - 'Frutas y verduras' -> 0%
 * - 'Aseo' -> 19%
 *
 * @param {string} [categoriaId]
 * @param {string} [nombreCategoria]
 * @returns {TarifaIVA}
 */
export function ivaPorDefectoCategoria(categoriaId = '', nombreCategoria = '') {
  const c = `${norm(categoriaId)} ${norm(nombreCategoria)}`;
  if (/fruta|verdura|hortaliza/.test(c)) return 0;
  if (/aseo|limpieza|higiene/.test(c)) return 19;
  if (/lacteo|panaderia|grano|despensa/.test(c)) return 0;
  if (/bebida|licor|gaseosa/.test(c)) return 19;
  return 19;
}

// Reglas según normativa colombiana (Estatuto Tributario Art. 424, 468, 468-1 y 477)
const REGEX_ASEO_19 = /\b(detergente|cloro|limpido|blanqueador|desodorante|champu|shampoo|jabon|lavaloza|suavizante|vinagre|papel higienico|crema dental|cepillo|esponja|desinfectante)\b/;
const REGEX_CANASTA_5 = /\b(azucar|cafe|pasta|spaghetti|espagueti|harina|avena|chocolate de mesa)\b/;
const REGEX_PROCESADOS_19 = /\b(gaseosa|cola|pepsi|jugo|energizante|te frio|cerveza|almendra|almendras|galleta|galletas|soda|ponque|ponques|croissant|croissants|atun|sardina|en lata|yogur|yogurt|kumis|crema de leche|mantequilla|margarina|aceite)\b/;
const REGEX_EXENTOS_0 = /\b(aguacate|banano|cebolla|limon|manzana|naranja|tangelo|papa|platano|tomate|zanahoria|fruta|verdura|huevo|huevos|leche|queso|arroz|panela|sal|frijol|frijoles|lenteja|lentejas|garbanzo|arveja|arepa|arepas|pan|mogolla|calado|tostada|agua)\b/;

/**
 * Obtiene la tarifa de IVA (0 | 5 | 19) de un producto.
 * Prioriza el campo explícito `iva` (o `ivaRate`) del producto y, si no está definido,
 * aplica la clasificación tributaria colombiana según nombre y categoría.
 *
 * @param {Partial<Product> | null | undefined} producto
 * @param {string} [nombreCategoria]
 * @returns {TarifaIVA}
 */
export function obtenerIvaProducto(producto, nombreCategoria = '') {
  if (!producto) return 19;
  if (esTarifaIvaValida(producto.iva)) return /** @type {TarifaIVA} */ (Number(producto.iva));
  if (esTarifaIvaValida(producto.ivaRate)) return /** @type {TarifaIVA} */ (Number(producto.ivaRate));

  const nombre = norm(producto.nombre);
  const cat = `${norm(producto.categoriaId)} ${norm(nombreCategoria)}`;

  // 1. Todo Aseo va al 19% (incluye vinagre, detergentes, cloro, desodorante, jabón, champú, lavaloza, suavizante)
  if (/\baseo\b/.test(cat) || REGEX_ASEO_19.test(nombre)) return 19;

  // 2. Frutas y verduras (todas) van al 0%
  if (/fruta|verdura/.test(cat)) return 0;

  // 3. Tarifa reducida 5%: azúcar, café molido, pasta spaghetti, harina de trigo
  if (REGEX_CANASTA_5.test(nombre)) return 5;

  // 4. Tarifa general 19%: bebidas procesadas/gaseosas, leche de almendras, ultraprocesados, atún en lata, yogures/derivados
  if (REGEX_PROCESADOS_19.test(nombre)) return 19;

  // 5. Exentos / excluidos 0%: huevos, leches líquidas simples, arroz, panela, sal, frijol, lenteja, arepas, pan corriente, agua pura
  if (REGEX_EXENTOS_0.test(nombre)) return 0;

  return ivaPorDefectoCategoria(producto.categoriaId, nombreCategoria);
}

/**
 * Calcula el desglose de IVA para una línea de venta dado su precio unitario final (con IVA incluido).
 *
 * @param {number} cantidad
 * @param {number} precioUnitarioConIva
 * @param {TarifaIVA} [tarifaIva=0]
 * @returns {DesgloseLineaIVA}
 */
export function calcularLineaIVA(cantidad, precioUnitarioConIva, tarifaIva = 0) {
  const iva = normalizarTarifaIva(tarifaIva, 0);
  const totalConIva = Math.round((Number(cantidad) || 0) * (Number(precioUnitarioConIva) || 0));
  if (iva === 0) {
    return {
      iva: 0,
      subtotalSinIva: totalConIva,
      valorIva: 0,
      totalConIva,
    };
  }
  const subtotalSinIva = Math.round(totalConIva / (1 + iva / 100));
  const valorIva = totalConIva - subtotalSinIva;
  return {
    iva,
    subtotalSinIva,
    valorIva,
    totalConIva,
  };
}

/**
 * Calcula el resumen completo de impuestos para el carrito o una factura:
 * - Subtotal sin IVA (base gravable)
 * - Discriminación de IVA 5% y IVA 19%
 * - Total final a pagar
 *
 * @param {Array<Record<string, any>>} items
 * @param {Array<Partial<Product>>} [catalogoProductos=[]]
 * @returns {ResumenIVA}
 */
export function calcularResumenIVA(items = [], catalogoProductos = []) {
  let subtotalSinIva = 0;
  let base0 = 0;
  let base5 = 0;
  let base19 = 0;
  let iva5 = 0;
  let iva19 = 0;
  let total = 0;

  const lineas = items.map(it => {
    const prod = it.p || it.producto || catalogoProductos.find(p => p.id === it.productoId) || it;
    const precio = Number(it.precio ?? prod?.precioVenta ?? 0);
    const tarifa = esTarifaIvaValida(it.iva)
      ? /** @type {TarifaIVA} */ (Number(it.iva))
      : esTarifaIvaValida(it.ivaRate)
        ? /** @type {TarifaIVA} */ (Number(it.ivaRate))
        : obtenerIvaProducto(prod);

    const desglose = calcularLineaIVA(Number(it.cantidad) || 0, precio, tarifa);
    subtotalSinIva += desglose.subtotalSinIva;
    total += desglose.totalConIva;

    if (desglose.iva === 0) {
      base0 += desglose.subtotalSinIva;
    } else if (desglose.iva === 5) {
      base5 += desglose.subtotalSinIva;
      iva5 += desglose.valorIva;
    } else if (desglose.iva === 19) {
      base19 += desglose.subtotalSinIva;
      iva19 += desglose.valorIva;
    }

    return desglose;
  });

  return {
    subtotalSinIva,
    base0,
    base5,
    base19,
    iva5,
    iva19,
    totalIva: iva5 + iva19,
    total,
    lineas,
  };
}

