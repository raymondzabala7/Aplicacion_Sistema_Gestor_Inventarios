import { defineConfig } from 'vite';

// Rutas relativas para que el build funcione en GitHub Pages (/Aplicacion_Sistema_Gestor_Inventarios/).
export default defineConfig({
  base: './',
  build: {
    // Firebase y three.js van en archivos aparte: cuando cambia la app, el navegador
    // y la app instalada solo descargan de nuevo el código propio, no las librerías.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
