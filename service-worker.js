const CACHE_NAME = 'painel-financeiro-v1';
const urlsToCache = [
  '/painel-financeiro/',
  '/painel-financeiro/index.html',
  '/painel-financeiro/style.css',
  '/painel-financeiro/script.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Ativar Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se encontrar, senão busca da rede
        return response || fetch(event.request);
      })
  );
});
