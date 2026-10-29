# FrescoStock

Aplicación de inventario organizada como módulos ES y preparada para ejecutarse con Vite.

## Desarrollo

Requiere Node.js y npm.

```bash
npm install
npm run dev
```

Para validar la compilación y ejecutar las pruebas:

```bash
npm run build
npm test
```

## Organización

- `src/domain/inventory.js`: reglas de inventario puras.
- `src/data/seed.js`: datos de demostración.
- `src/data/local-store.js`: persistencia local de la demo.
- `src/data/store.js`: punto de selección del adaptador de datos.
- `src/firebase/client.js`: inicialización validada de Firebase Auth y Firestore.
- `src/ui/tomi.js`: SVG de la mascota.
- `src/app.js`: estado, vistas y eventos de la interfaz.
- `src/styles.css`: estilos de la aplicación.

## Firebase

La app usa Cloud Firestore del proyecto `gestorinventario-66266` a través de `src/data/firestore-store.js`. La configuración web está en `.env` (sus valores son públicos; la seguridad la dan `firestore.rules` y Authentication). Para apuntar a otro proyecto en tu equipo, crea `.env.local` con tus valores; si quitas las variables, la app vuelve a la demo local.

Configuración del proyecto de Firebase (ya hecha para `gestorinventario-66266`):

1. **Firestore Database** (no Realtime Database), **Authentication → Correo electrónico/contraseña** y una app web registrada.
2. `firestore.rules` pegadas en Firestore → Reglas y publicadas.
3. Por cada empleado:
   - Authentication → Usuarios → Agregar usuario (correo y contraseña).
   - Firestore → colección `usuarios`, documento con ID = ese correo en minúsculas, campos `nombre` (string), `email` (string), `rol` = `admin`, `bodega` o `cajero` (string), `activo` = `true` (boolean).
4. Authentication → Configuración → Dominios autorizados: `raymondzabala7.github.io` para que funcione el inicio de sesión en GitHub Pages.

La base empieza vacía: un admin crea primero las categorías (Productos → Categorías), luego proveedores y productos.

## GitHub Pages

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala, corre las pruebas, compila y publica en https://raymondzabala7.github.io/Aplicacion_Sistema_Gestor_Inventarios/. La primera vez, el dueño del repositorio debe elegir **Settings → Pages → Source: GitHub Actions**.

Cada empleado nuevo se crea en la pantalla Usuarios y su contraseña en Authentication con el mismo correo. Ventas, entregas, anulaciones y ajustes corren dentro de `runTransaction`, así el stock nunca queda negativo aunque dos cajas vendan a la vez.