// Mapeo centralizado de emojis de producto.
// Orden de prioridad: 1) p.icono guardado en el producto, 2) regla por nombre, 3) emoji de la categoría, 4) 🛒.
// Las reglas se evalúan en orden y el nombre va sin tildes y en minúsculas. Usa \b para palabras
// cortas (res, cola, ron…) y evitar falsos positivos como "fRESa" o "chocoLATE".
export const REGLAS_ICONO_PRODUCTO = [
  // Aseo con nombres compuestos (antes de "crema", "papel", etc.)
  [/crema dental|pasta dental|cepillo|enjuague|colgate/, '🪥'],
  [/papel higienico|\bpapel\b|servilleta|toalla/, '🧻'],
  [/desodorante|antitranspirante|talco|perfume/, '💨'],
  [/shampoo|champu|acondicionador|crema corporal/, '🧴'],

  // Panadería y repostería
  [/croissant|cruasan/, '🥐'],
  [/arepa/, '🫓'],
  [/mogolla|bagel/, '🥯'],
  [/pan integral|baguette|flauta/, '🥖'],
  [/tostada|calado/, '🥪'],
  [/galleta/, '🍪'],
  [/ponque|torta|pastel|cupcake|muffin/, '🍰'],
  [/panela/, '🍯'],
  [/\bpan\b/, '🍞'],

  // Huevos, carnes y pescados
  [/huevo/, '🥚'],
  [/\batun\b|sardina|pescado|salmon|marisco/, '🐟'],
  [/pollo|pechuga|alita/, '🍗'],
  [/\bcarne\b|\bres\b|cerdo|lomo|molida/, '🥩'],
  [/jamon|salchicha|chorizo|mortadela|tocineta/, '🌭'],

  // Bebidas específicas (antes de frutas como naranja/limón)
  [/cerveza|\bpola\b|lager/, '🍺'],
  [/\bvino\b|champan|licor|\bron\b|aguardiente/, '🍷'],
  [/energizante|red bull|monster/, '⚡'],
  [/te frio|te helado|\bte\b|aromatica/, '🧋'],
  [/jugo|nectar|\bhit\b/, '🧃'],
  [/gaseosa naranja|\bfanta\b|colombiana/, '🍹'],
  [/gaseosa|pepsi|coca cola|\bcola\b|\bsoda\b|refresco|sprite|7up/, '🥤'],
  [/agua\s*6\s*l|botellon|garrafon/, '🚰'],
  [/\bagua\b/, '💧'],

  // Lácteos y derivados
  [/queso/, '🧀'],
  [/mantequilla|margarina/, '🧈'],
  [/yogur.*(fresa|mora|melocoton|fruta)/, '🍓'],
  [/yogur|griego/, '🍨'],
  [/kumis|avena|malteada/, '🥤'],
  [/crema de leche|condensada|arequipe/, '🫙'],
  [/leche de (almendra|soya|coco)|almendra|\bsoya\b/, '🌰'],
  [/leche/, '🥛'],

  // Frutas y verduras
  [/tomate/, '🍅'],
  [/aguacate/, '🥑'],
  [/banano|platano|guineo/, '🍌'],
  [/manzana/, '🍎'],
  [/\bpapa\b|\byuca\b|criolla/, '🥔'],
  [/cebolla/, '🧅'],
  [/zanahoria/, '🥕'],
  [/limon.*tahiti|\blima\b/, '🍋‍🟩'],
  [/limon/, '🍋'],
  [/naranja|mandarina|tangelo/, '🍊'],
  [/\bfresa\b|\bmora\b|cereza/, '🍓'],
  [/\buva\b/, '🍇'],
  [/\bpina\b/, '🍍'],
  [/mango|papaya|melon/, '🥭'],
  [/sandia|patilla/, '🍉'],
  [/lechuga|espinaca|cilantro|perejil|\bapio\b|brocoli/, '🥬'],
  [/\bajo\b/, '🧄'],
  [/maiz|mazorca/, '🌽'],

  // Granos y despensa
  [/\bcafe\b|tinto/, '☕'],
  [/chocolate|cocoa|\bmilo\b/, '🍫'],
  [/arroz/, '🍚'],
  [/frijol|garbanzo|alverja|arveja/, '🫘'],
  [/lenteja/, '🥘'],
  [/cereal|granola/, '🥣'],
  [/pasta|spaghetti|espagueti|fideo|macarron/, '🍝'],
  [/aceite/, '🫗'],
  [/vinagre/, '🥗'],
  [/azucar|endulzante/, '🥄'],
  [/\bsal\b/, '🧂'],
  [/harina|trigo|maicena/, '🌾'],
  [/salsa|mayonesa|mostaza|\bsopa\b|\bcrema\b/, '🥫'],

  // Aseo y hogar
  [/jabon/, '🧼'],
  [/esponja|brilla|fibra/, '🧽'],
  [/detergente/, '🧺'],
  [/lavaloza|\bloza\b|platos/, '🫧'],
  [/cloro|limpido|desinfectante|blanqueador/, '🧪'],
  [/suavizante|aromatizante|ambientador/, '🌸'],
];

const normalizar = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Imágenes ilustradas incluidas para todos los productos del catálogo
export const REGLAS_IMAGEN_PRODUCTO = [
  // Aseo
  [/detergente/, './productos/detergente.png'],
  [/cloro|limpido|blanqueador/, './productos/cloro.png'],
  [/desodorante|antitranspirante/, './productos/desodorante.png'],
  [/vinagre/, './productos/vinagre.png'],

  // Panadería (antes de mantequilla/panela para evitar colisiones con "Pan tajado de mantequilla")
  [/arepa/, './productos/arepas.png'],
  [/croissant|cruasan/, './productos/croissant.png'],
  [/galleta/, './productos/galletas-soda.png'],
  [/mogolla|bagel/, './productos/mogolla.png'],
  [/pan integral|baguette|flauta/, './productos/pan-integral.png'],
  [/panela/, './productos/panela.png'],
  [/\bpan\b|pan tajado/, './productos/pan-tajado.png'],

  // Bebidas (antes de frutas como naranja/limón y antes de leche)
  [/agua\s*6\s*l|botellon|garrafon/, './productos/agua-6l.png'],
  [/\bagua\b/, './productos/agua-600ml.png'],
  [/energizante|red bull|monster/, './productos/energizante.png'],
  [/cerveza|\bpola\b|lager/, './productos/cerveza.png'],
  [/gaseosa naranja|\bfanta\b|colombiana/, './productos/gaseosa-naranja.png'],
  [/pepsi/, './productos/pepsi.png'],
  [/gaseosa|coca cola|\bcola\b|\bsoda\b|refresco/, './productos/gaseosa-cola.png'],
  [/jugo|nectar|\bhit\b/, './productos/jugo-naranja.png'],
  [/te frio|te helado|\bte\b/, './productos/te-frio.png'],
  [/leche de (almendra|soya|coco)|almendra/, './productos/leche-almendras.png'],

  // Lácteos y huevos
  [/huevo/, './productos/huevos.png'],
  [/crema de leche/, './productos/crema-leche.png'],
  [/kumis/, './productos/kumis.png'],
  [/leche deslactosada|deslactosada/, './productos/leche-deslactosada.png'],
  [/leche/, './productos/leche-entera.png'],
  [/mantequilla|margarina/, './productos/mantequilla.png'],
  [/queso.*mozzarella|mozzarella/, './productos/queso-mozzarella.png'],
  [/queso/, './productos/queso-campesino.png'],
  [/yogur.*(fresa|mora|melocoton|fruta)/, './productos/yogur-fresa.png'],
  [/yogur.*griego|\bgriego\b|yogur/, './productos/yogur-griego.png'],

  // Granos y despensa
  [/aceite/, './productos/aceite.png'],
  [/arroz\s*5\s*kg/, './productos/arroz-5kg.png'],
  [/arroz/, './productos/arroz-500g.png'],
  [/\batun\b|sardina/, './productos/atun.png'],
  [/azucar|endulzante/, './productos/azucar.png'],
  [/\bcafe\b|tinto/, './productos/cafe.png'],
  [/frijol|garbanzo|alverja|arveja/, './productos/frijol.png'],
  [/harina|trigo|maicena/, './productos/harina.png'],
  [/lenteja/, './productos/lenteja.png'],
  [/pasta|spaghetti|espagueti|fideo/, './productos/pasta.png'],
  [/\bsal\b/, './productos/sal.png'],

  // Frutas y verduras
  [/aguacate/, './productos/aguacate.png'],
  [/platano/, './productos/platano-verde.png'],
  [/banano|guineo/, './productos/banano.png'],
  [/cebolla/, './productos/cebolla.png'],
  [/limon|\blima\b/, './productos/limon-tahiti.png'],
  [/manzana/, './productos/manzana.png'],
  [/naranja|mandarina|tangelo/, './productos/naranja.png'],
  [/\bpapa\b|\byuca\b|criolla/, './productos/papa.png'],
  [/tomate/, './productos/tomate.png'],
  [/zanahoria/, './productos/zanahoria.png'],
];

export function imagenPorDefectoProducto(p) {
  if (!p) return null;
  if (p.imagen && String(p.imagen).trim()) return String(p.imagen).trim();
  const n = normalizar(p.nombre);
  for (const [regex, ruta] of REGLAS_IMAGEN_PRODUCTO) {
    if (regex.test(n)) return ruta;
  }
  return null;
}

export function iconoProducto(p, iconoCategoria) {
  if (!p) return '🛒';
  if (p.icono && String(p.icono).trim()) return String(p.icono).trim();
  const n = normalizar(p.nombre);
  for (const [regex, emoji] of REGLAS_ICONO_PRODUCTO) {
    if (regex.test(n)) return emoji;
  }
  return iconoCategoria || '🛒';
}
