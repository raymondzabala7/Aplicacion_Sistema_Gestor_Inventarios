# FrescoStock

Gestor de inventario para supermercado: stock por categorías, recepción de proveedores, caja con factura que descuenta el stock, alertas automáticas e historial. Hecho con Vite y Firebase, con Tomi 🍅 como mascota en 3D.

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
- **three.js** (r128): Tomi en 3D.
- JavaScript con módulos ES y CSS propio, sin framework.

## Organización

- `src/main.js`: punto de entrada; carga estilos y la app.
- `src/app.js`: estado, vistas y eventos de la interfaz.
- `src/styles.css`: estilos de la aplicación.
- `src/domain/inventory.js`: reglas de inventario puras (facturar, recibir, anular, ajustar, alertas).
- `src/data/store.js`: elige el adaptador de datos (Firestore si hay configuración, si no la demo local).
- `src/data/firestore-store.js`: adaptador de Cloud Firestore; las operaciones de stock usan `runTransaction`.
- `src/data/local-store.js`: adaptador de la demo local (`localStorage`).
- `src/data/seed.js`: datos de la demo local.
- `src/firebase/client.js`: inicialización validada de Firebase Auth y Firestore.
- `src/ui/tomi3d.js`: Tomi en 3D (carga, login, logo, inicio, caja y alertas).
- `src/ui/tomi.js`: Tomi en SVG para íconos pequeños (avisos, listas vacías).
- `tests/inventory.test.js`: pruebas de las reglas de inventario.
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
| `facturas` | Ventas con su número FV-000001… | Automático |
| `config/consecutivos` | Contador de facturas | `consecutivos` |
| `movimientos` | Cada entrada, salida y ajuste con stock antes y después | Automático |
| `alertas` | Una alerta por producto bajo o agotado | ID del producto |
| `historial` | Quién hizo qué y cuándo | Automático |

El stock solo cambia por Recepción (entrada), Caja (salida) o Ajustar stock (ajuste). Ventas, entregas, anulaciones y ajustes corren dentro de `runTransaction`, así el stock nunca queda negativo aunque dos cajas vendan a la vez.

### Configuración del proyecto (ya hecha para `gestorinventario-66266`)

1. **Firestore Database** (no Realtime Database), **Authentication → Correo electrónico/contraseña** y una app web registrada.
2. `firestore.rules` pegadas en Firestore → Reglas y publicadas.
3. Authentication → Configuración → Dominios autorizados: `raymondzabala7.github.io`, para que funcione el inicio de sesión en GitHub Pages.

### Agregar un empleado

1. En la app, **Usuarios → + Empleado** (crea `usuarios/{correo}` con su rol). El primer administrador se crea a mano en Firestore → colección `usuarios`, documento con ID = su correo en minúsculas y campos `nombre` (string), `email` (string), `rol` = `admin` (string), `activo` = `true` (boolean).
2. En Firebase, **Authentication → Usuarios → Agregar usuario** con el mismo correo y una contraseña. Las contraseñas solo se crean allí.

La base empieza vacía: un admin crea primero las categorías (Productos → Categorías), luego proveedores y productos.

## GitHub Pages

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala, corre las pruebas, compila y publica en https://raymondzabala7.github.io/Aplicacion_Sistema_Gestor_Inventarios/.

La primera vez, el dueño del repositorio debe elegir **Settings → Pages → Source: GitHub Actions** y luego **Actions → Publicar en GitHub Pages → Run workflow**. Si en los checks aparece "pages build and deployment", Pages todavía está en "Deploy from a branch" y publica el código sin compilar.
