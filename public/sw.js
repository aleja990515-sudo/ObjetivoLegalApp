// Service worker mínimo: permite instalar la app y abrirla sin conexión (los datos requieren red).
const CACHE = 'procesos-v4';
const ARCHIVOS = ['/', '/index.html', '/styles.css', '/app.js', '/festivos.js', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Red primero, caché como respaldo.
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))));
});
