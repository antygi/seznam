const CACHE_NAME = 'nakupy-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// Instalace Service Workeru a uložení souborů do mezipaměti
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Otevřena mezipaměť');
        return cache.addAll(urlsToCache);
      })
  );
});

// Zpracování požadavků (když je aplikace spuštěná)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Pokud najdeme soubor v mezipaměti, vrátíme ho
        if (response) {
          return response;
        }
        // Jinak ho normálně stáhneme ze sítě
        return fetch(event.request);
      })
  );
});

// Aktualizace Service Workeru (promazání staré mezipaměti)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});