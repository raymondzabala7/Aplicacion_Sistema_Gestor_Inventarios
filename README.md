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

La aplicación todavía **no está conectada a Firebase**. Al iniciar usa únicamente `localStorage` para la demo; no guardes datos reales esperando que se sincronicen en Firestore.

Cuando tengas el proyecto y hayas definido las colecciones y reglas de seguridad:

1. Copia `.env.example` a `.env.local`.
2. Completa la configuración web de Firebase en las variables `VITE_FIREBASE_*`. La configuración web se usa en el cliente; nunca incluyas una clave privada ni un archivo de cuenta de servicio.
3. Implementa un adaptador Firestore en `src/data/` que respete las operaciones de `src/data/local-store.js` y selecciónalo desde `src/data/store.js`.
4. Define y prueba las reglas de Firestore antes de usar información real.

`src/firebase/client.js` valida la configuración cuando se invoca; el adaptador local continúa siendo el predeterminado hasta que se implemente y seleccione explícitamente el adaptador Firestore.