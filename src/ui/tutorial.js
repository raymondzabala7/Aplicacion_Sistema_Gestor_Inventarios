// Tutorial "Aprende con Tomi": los pasos que ve cada rol.
// Cada paso dice para qué roles aplica (roles), qué pantalla abre (ruta), qué parte de ella se resalta
// (foco: un selector CSS, o una lista: se usa el primero que exista; en el código las partes
// llevan data-tut), si muestra una vista previa de una ventana (vista) y cómo se ve Tomi (estado).
// `texto` puede ser un solo texto o uno distinto por rol: { admin, bodega, cajero }.
// Para cambiar lo que explica Tomi, edita solo este archivo.

const TODOS = ['admin', 'bodega', 'cajero'];

export const PASOS = [
  {
    id: 'bienvenida', roles: TODOS, ruta: null, foco: null, icono: 'home', estado: 'celebrando',
    titulo: '¡Hola! Soy Tomi 🍅',
    texto: {
      admin: 'Como administrador puedes hacer todo en FrescoStock: vender, recibir mercancía, manejar el catálogo y los proveedores, revisar alertas e historial y administrar a los empleados. Te muestro cada parte.',
      bodega: 'Como encargado de bodega mantienes el stock al día: recibes a los proveedores, ajustas el inventario y atiendes las alertas. Te muestro cómo se hace.',
      cajero: 'Como cajero atiendes a los clientes: armas la venta, cobras y entregas la factura. El stock se descuenta solo. Te muestro cómo se hace.',
    },
  },
  {
    id: 'inicio', roles: TODOS, ruta: 'inicio', foco: '[data-tut="kpis"]', icono: 'home', estado: 'feliz',
    titulo: 'Inicio: el día de un vistazo',
    texto: {
      admin: 'Aquí ves las ventas de hoy, el ticket promedio, lo recibido en 7 días, los productos bajo el mínimo y el valor del inventario, más los gráficos de la semana. Todo se actualiza en tiempo real.',
      bodega: 'Aquí ves el resumen del día y la lista de productos con stock bajo, con un botón para pedirlos. También tienes un acceso rápido para recibir a un proveedor.',
      cajero: 'Aquí ves el resumen del día y las últimas facturas. Con el botón Nueva venta llegas directo a la caja.',
    },
  },
  {
    id: 'caja-agregar', roles: ['admin', 'cajero'], ruta: 'caja', foco: '[data-tut="caja-catalogo"]', icono: 'cart', estado: 'feliz',
    titulo: 'Caja: agregar productos',
    texto: 'Toca la tarjeta de un producto, búscalo por nombre con F2 o escanea su código de barras con la pistola USB o con la cámara. El número verde en la tarjeta muestra cuántas unidades llevas.',
  },
  {
    id: 'caja-venta', roles: ['admin', 'cajero'], ruta: 'caja', foco: '[data-tut="caja-ticket"]', icono: 'receipt', estado: 'feliz',
    titulo: 'Caja: la venta actual',
    texto: 'Ajusta las cantidades con más y menos; los productos por kilo suben de medio en medio kilo. El sistema no deja vender más de lo que hay. Abajo ves el subtotal sin IVA, el IVA del 5 y del 19 por ciento, y el total.',
  },
  {
    id: 'caja-cobrar', roles: ['admin', 'cajero'], ruta: 'caja', foco: '[data-tut="caja-cobrar"]', icono: 'coin', estado: 'feliz',
    titulo: 'Caja: cobrar y facturar',
    texto: 'Cuando la venta esté lista, presiona Cobrar y facturar o la tecla F4. Se abre la ventana de cobro, que te muestro en el siguiente paso.',
  },
  {
    // vista: en vez de resaltar algo de la pantalla, la tarjeta muestra una vista previa de esa ventana.
    id: 'caja-ventana-cobro', roles: ['admin', 'cajero'], ruta: 'caja', foco: null, vista: 'cobro', icono: 'coin', estado: 'feliz',
    titulo: 'La ventana de cobro',
    texto: 'Arriba ves el subtotal sin IVA, el IVA del 5 y del 19 por ciento y el total a pagar. Elige efectivo, transferencia o QR, o tarjeta. En efectivo, escribe con cuánto paga el cliente o usa los botones Exacto, más 2.000, 5.000, 10.000, 20.000 o 50.000, y yo calculo la devuelta que debes entregar. El cliente es opcional: si no lo pides, queda como Consumidor Final con el NIT genérico. Termina con Confirmar y facturar.',
  },
  {
    id: 'caja-imprimir', roles: ['admin', 'cajero'], ruta: 'caja', foco: ['[data-act="factura-ver"]', '[data-tut="caja-facturas"]'], vista: 'factura', icono: 'print', estado: 'celebrando',
    titulo: 'Imprimir la factura',
    texto: 'Al confirmar aparece la factura con el botón Imprimir, para entregarle el comprobante al cliente. Si la necesitas después, en Facturas de hoy toca Ver y luego Imprimir. Solo se imprime la factura, sin el resto de la pantalla.',
  },
  {
    id: 'caja-facturas', roles: ['admin', 'cajero'], ruta: 'caja', foco: '[data-tut="caja-facturas"]', icono: 'receipt', estado: 'feliz',
    titulo: 'Facturas de hoy',
    texto: {
      admin: 'Abajo de la caja ves las facturas del día con su método de pago. Puedes exportar las ventas del día a Excel. Como administrador también puedes anular una factura: queda marcada como anulada y los productos vuelven al stock.',
      cajero: 'Abajo de la caja ves las facturas del día con su método de pago, y puedes exportar las ventas del día a Excel. Si hay que anular una factura, pídeselo al administrador.',
    },
  },
  {
    id: 'recepcion', roles: ['admin', 'bodega'], ruta: 'recepcion', foco: '[data-tut="recepcion"]', icono: 'truck', estado: 'feliz',
    titulo: 'Recepción de proveedores',
    texto: 'Cuando llega un proveedor, elígelo y agrega cada producto con su cantidad, costo, lote y fecha de vencimiento. Al presionar Registrar, el stock sube solo, la entrega queda guardada y las alertas de esos productos se cierran.',
  },
  {
    id: 'productos', roles: TODOS, ruta: 'productos', foco: '[data-tut="productos"]', icono: 'box', estado: 'feliz',
    titulo: 'Productos',
    texto: {
      admin: 'Aquí está el catálogo por categorías. Puedes crear y editar productos con código de barras, precio, costo, IVA, stock mínimo e imagen; administrar las categorías; ajustar el stock con un motivo y exportar el inventario a Excel. Eliminar un producto solo lo oculta, así no se pierde su historial.',
      bodega: 'Aquí ves el stock de cada producto. Con el botón de ajustar puedes sumar o restar unidades por merma, daño, vencimiento o conteo físico, y el motivo queda registrado. También puedes exportar el inventario a Excel.',
      cajero: 'Aquí puedes consultar el precio, el IVA y el stock de cualquier producto, y buscarlo por nombre o por código. Si algo está mal, avísale al administrador.',
    },
  },
  {
    id: 'proveedores', roles: ['admin', 'bodega'], ruta: 'proveedores', foco: '[data-tut="proveedores"]', icono: 'store', estado: 'feliz',
    titulo: 'Proveedores',
    texto: {
      admin: 'Aquí registras a quién te surte: nombre, NIT, contacto, teléfono y las categorías que entrega. También ves cuántas entregas ha hecho cada uno y por cuánto dinero. Puedes crearlos, editarlos y eliminarlos.',
      bodega: 'Aquí consultas el contacto de cada proveedor, qué categorías surte y cuánto ha entregado. Solo el administrador puede crearlos o editarlos.',
    },
  },
  {
    id: 'alertas', roles: TODOS, ruta: 'alertas', foco: '[data-tut="alertas"]', icono: 'bell', estado: 'preocupado',
    titulo: 'Alertas',
    texto: {
      admin: 'La campanita avisa cuando un producto llega a su stock mínimo o se agota. Aquí puedes ir directo a recibirlo, marcar la alerta como atendida y dar de baja los lotes vencidos. Cuando entra mercancía, la alerta se cierra sola.',
      bodega: 'La campanita avisa cuando un producto llega a su stock mínimo o se agota. Aquí puedes ir directo a recibirlo, marcar la alerta como atendida y dar de baja los lotes vencidos. Cuando entra mercancía, la alerta se cierra sola.',
      cajero: 'La campanita avisa cuando un producto llega a su stock mínimo o se agota. Si un cliente pide algo agotado, revisa aquí y avísale a bodega.',
    },
  },
  {
    id: 'historial', roles: ['admin', 'bodega'], ruta: 'historial', foco: '[data-tut="historial"]', icono: 'clock', estado: 'feliz',
    titulo: 'Historial',
    texto: 'Aquí ves quién hizo qué y cuándo, y cada movimiento de stock con la cantidad antes y después. Puedes filtrar por fecha y exportar el Kardex a Excel. Nadie puede editar ni borrar este registro.',
  },
  {
    id: 'usuarios', roles: ['admin'], ruta: 'usuarios', foco: '[data-tut="usuarios"]', icono: 'users', estado: 'feliz',
    titulo: 'Usuarios',
    texto: 'Aquí creas a cada empleado con su nombre, correo, cédula, rol y turno. Su contraseña se crea en Firebase Authentication con el mismo correo. Si alguien deja de trabajar, márcalo como inactivo: ya no podrá entrar, pero su historial se conserva.',
  },
  {
    id: 'roles', roles: ['admin'], ruta: null, foco: '[data-tut="menu"]', icono: 'users', estado: 'feliz',
    titulo: 'Qué puede hacer cada rol',
    texto: 'El cajero usa Inicio, Caja, Productos para consultar y Alertas. Bodega usa Inicio, Recepción, Productos para ajustar, Proveedores, Alertas e Historial. Y tú, como administrador, todo. Las reglas de seguridad lo controlan desde el servidor.',
  },
  {
    id: 'final', roles: TODOS, ruta: null, foco: '[data-act="tutorial"]', icono: 'check', estado: 'celebrando',
    titulo: '¡Listo, ya sabes lo esencial!',
    texto: 'Puedes volver a ver este tutorial cuando quieras con este botón, Aprende con Tomi. Y si me tocas, me enojo un poquito.',
  },
];

// Los pasos de un rol, con el texto ya elegido para ese rol.
export function pasosPara(rol) {
  return PASOS
    .filter(p => p.roles.includes(rol))
    .map(p => ({ ...p, texto: typeof p.texto === 'string' ? p.texto : p.texto[rol] }));
}

// Texto para la voz: sin emojis, que la síntesis lee como nombres raros.
export function textoParaVoz(paso) {
  const limpio = t => t.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
  return `${limpio(paso.titulo)}. ${limpio(paso.texto)}`;
}
