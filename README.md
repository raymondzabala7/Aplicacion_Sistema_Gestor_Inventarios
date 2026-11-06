# FrescoStock

Gestor de inventario y punto de venta (POS) para supermercado: stock por categorías, recepción de proveedores, caja con múltiples medios de pago y cálculo de devuelta, facturación detallada, lector de códigos con cámara, alertas automáticas, exportación a Excel (CSV) e historial de movimientos. Hecho con Vite y Firebase, con Tomi 🍅 como mascota en 3D.

**App publicada:** https://raymondzabala7.github.io/Aplicacion_Sistema_Gestor_Inventarios/

## Equipo

| Integrante | Módulo |
| --- | --- |
| Julián | Líder · inicio de sesión y seguridad |
| Sneyder | Productos, categorías y proveedores |
| Felipe | Movimientos: recepción y caja |
| Raymond | Historial y alertas |
| Yeison | Usuarios y panel del administrador |
| José Angel | Diseño (UI/UX), pruebas y publicación |

## Novedades y Mejoras Recientes

- **Caja & POS Avanzado**:
  - Modal de cobro con **Efectivo** (cálculo de cambio/devuelta en tiempo real y botones de denominación rápida), **Transferencia / QR** (Nequi, Daviplata, Bancolombia) y **Tarjeta Débito/Crédito**.
  - Registro de cliente en factura (Nombre y Cédula/NIT para garantías y facturación).
  - Ticket de factura estilo térmico con desglose de IVA (19%), medio de pago, efectivo recibido y cambio.
  - Atajos de teclado en caja: `<kbd>F2</kbd>` para enfocar el buscador, `<kbd>F4</kbd>` para cobrar rápidamente y `<kbd>Esc</kbd>` para limpiar.
- **Escáner con Cámara Web / Móvil**:
  - Botón de cámara en caja para escanear códigos de barras usando la cámara del smartphone o computador mediante la API `BarcodeDetector` con feedback sonoro (bip).
- **Exportación de Reportes a Tabla de Excel (`.xlsx` / CSV)**:
  - Generación nativa de archivos `.xlsx` con tabla estructurada de Excel (`TablaFrescoStock`), filtros desplegables, ancho de columnas automático, formato de moneda, fila de totales y colores de estado:
    - **Catálogo de productos:** `Código de Barras`, `Producto`, `Categoría`, `Unidad`, `Costo Unitario`, `Precio Venta`, `Stock Actual`, `Stock Mínimo`, `Valor Total Stock` y `Estado`.
    - **Reporte de ventas de hoy:** facturas, cajero, cliente, medio de pago y totales.
    - **Kardex:** todos los movimientos de entradas, salidas y ajustes con stock antes y después.
- **Alertas y Control de Vencimientos**:
  - Botón directo *"Dar de baja"* en productos por vencer para registrar mermas automáticamente en el inventario.
- **Filtros por Fecha en Historial**:
  - Consulta de movimientos y actividad filtrando por *"Hoy"*, *"Últimos 7 días"*, *"Últimos 30 días"* o *"Cualquier fecha"*.
- **PWA Completa (Instalable y Offline)**:
  - `manifest.json`, iconos vectoriales (192 y 512px) y `Service Worker` (`sw.js`) con almacenamiento en caché para arranque instantáneo e instalabilidad nativa en Android, iOS, Windows y macOS.
- **Mascota Tomi Mejorada 🍅**:
  - Gráficos 3D más vivos y frescos con reflejos PBR jugosos (`clearcoat`), expresiones kawaii de ojos con destellos dobles, mejillas sonrojadas, interacción amigable por clics (giggle / frases alegres y reacción si se le aprieta rápido) y frases dinámicas para cada pantalla.

## Desarrollo

Requiere Node.js 20.19 o superior y npm.

```bash
npm install
npm run dev
```

La app abre en http://localhost:5173 y se conecta al Firebase del proyecto (ver más abajo).

Para validar la compilación y ejecutar las pruebas:

```bash
npm run build
npm test
```

## Tecnologías

- **Vite**: servidor de desarrollo y compilación.
- **Firebase**: Authentication (correo y contraseña) y Cloud Firestore.
- **three.js** (r128): Tomi en 3D interactivo.
- **PWA**: Web App Manifest y Service Worker para soporte offline.
- JavaScript con módulos ES y CSS propio, sin framework.

## Organización

- `src/main.js`: punto de entrada; carga estilos y la app.
- `src/app.js`: estado, vistas, eventos, atajos de teclado, exportaciones CSV y escáner de cámara.
- `src/styles.css`: estilos de la aplicación, diseño térmico de facturas y animaciones.
- `src/domain/inventory.js`: reglas de inventario puras (facturar con medios de pago y cambio, recibir, anular, ajustar, alertas y generador CSV).
- `src/data/store.js`: elige el adaptador de datos (Firestore si hay configuración, si no la demo local).
- `src/data/firestore-store.js`: adaptador de Cloud Firestore; las operaciones de stock usan `runTransaction`.
- `src/data/local-store.js`: adaptador de la demo local (`localStorage`).
- `src/data/seed.js`: datos de la demo local.
- `src/firebase/client.js`: inicialización validada de Firebase Auth y Firestore.
- `src/ui/tomi3d.js`: Tomi en 3D interactivo (materiales jugosos, animaciones, expresiones y frases).
- `src/ui/tomi.js`: Tomi en SVG kawaii para avisos y estados vacíos.
- `public/manifest.json` y `public/sw.js`: PWA y Service Worker.
- `tests/inventory.test.js`: suite ampliada de pruebas unitarias (12 pruebas automatizadas).
- `firestore.rules`: reglas de seguridad de Firestore por rol.
- `vite.config.js`: rutas relativas para que el build funcione en GitHub Pages.
- `.github/workflows/deploy.yml`: prueba, compila y publica en GitHub Pages.

## Roles

| Rol | Pantallas |
| --- | --- |
| `admin` | Todas |
| `bodega` | Inicio, Productos (ver y ajustar stock), Recepción, Proveedores, Alertas, Historial |
| `cajero` | Inicio, Caja, Productos (solo ver), Alertas |

## Firebase

La app usa Cloud Firestore del proyecto `gestorinventario-66266` a través de `src/data/firestore-store.js`. La configuración web está en `.env` (sus valores son públicos; la seguridad la dan `firestore.rules` y Authentication). Para apuntar a otro proyecto en tu equipo, crea `.env.local` con tus valores; si quitas las variables, la app vuelve a la demo local.

### Colecciones

| Colección | Qué guarda | ID del documento |
| --- | --- | --- |
| `usuarios` | Empleados: nombre, rol, turno, activo | Correo en minúsculas |
| `categorias` | Categorías del catálogo | Automático |
| `proveedores` | Proveedores y categorías que surten | Automático |
| `productos` | Precio, costo, stock y stock mínimo (`activo: false` = eliminado) | Automático |
| `entregas` | Recepciones de proveedores con lote y vencimiento | Automático |
| `facturas` | Ventas con número FV-000001, cliente, método de pago y cambio | Automático |
| `config/consecutivos` | Contador de facturas | `consecutivos` |
| `movimientos` | Cada entrada, salida y ajuste con stock antes y después | Automático |
| `alertas` | Una alerta por producto bajo o agotado | ID del producto |
| `historial` | Quién hizo qué y cuándo | Automático |

El stock solo cambia por Recepción (entrada), Caja (salida) o Ajustar stock (ajuste). Ventas, entregas, anulaciones y ajustes corren dentro de `runTransaction`, así el stock nunca queda negativo aunque dos cajas vendan a la vez.

## GitHub Pages

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala, corre las pruebas, compila y publica en https://raymondzabala7.github.io/Aplicacion_Sistema_Gestor_Inventarios/.
