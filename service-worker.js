const CACHE_NAME = 'painel-financeiro-v5';
const APP_SHELL = [
  '/painel-financeiro/', '/painel-financeiro/index.html', '/painel-financeiro/style.css',
  '/painel-financeiro/manifest.json', '/painel-financeiro/icon-192.png', '/painel-financeiro/icon-512.png',
  '/painel-financeiro/app/app.js', '/painel-financeiro/app/calculations.js',
  '/painel-financeiro/app/date-utils.js', '/painel-financeiro/app/default-state.js',
  '/painel-financeiro/app/repository.js', '/painel-financeiro/app/ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (event.request.mode === 'navigate' || APP_SHELL.includes(url.pathname))) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(response => response || caches.match('/painel-financeiro/'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
