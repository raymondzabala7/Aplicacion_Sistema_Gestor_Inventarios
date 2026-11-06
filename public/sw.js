// Service Worker para FrescoStock PWA
// Sube la versión cuando cambies esta lista o la forma de guardar en caché.
const CACHE_NAME = 'frescostock-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Advertencia en precache inicial:', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

const esFuente = url => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return; // extensiones del navegador, etc.

  // Firestore, Auth y demás servicios de Google/Firebase van siempre directo a la red.
  if (!esFuente(url) && (url.hostname.includes('googleapis') || url.hostname.includes('firebase') || url.hostname.includes('gstatic'))) return;

  // Fuentes: casi nunca cambian; primero caché para que la app abra rápido y sin conexión.
  if (esFuente(url)) {
    event.respondWith(
      caches.match(req).then(guardado => guardado || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copia));
        }
        return res;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App: red primero (siempre la versión más nueva); la caché solo se usa sin conexión.
  event.respondWith(
    fetch(req).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, responseToCache));
      }
      return networkResponse;
    }).catch(async () => {
      const guardado = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      // Sin conexión, cualquier página de la app abre el index guardado.
      return guardado || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
