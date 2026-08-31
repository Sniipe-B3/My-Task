// ==========================================
// SERVICE WORKER (Pour le mode hors-ligne absolu)
// ==========================================
const CACHE_NAME = 'my-task-cache-v1.7.7';

// Fichiers indispensables à mettre en cache pour fonctionner hors-ligne
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './history.js',
  './manifest.json',
  './icon.png',
  './icon512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// --- 1. INSTALLATION ---
// Se déclenche lors du premier lancement de l'application
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Fichiers mis en cache avec succès.');
        return cache.addAll(urlsToCache);
      })
  );
  // Force le service worker à s'activer immédiatement
  self.skipWaiting();
});

// --- 2. ACTIVATION ---
// Nettoie les anciens caches si la version (CACHE_NAME) change
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Ancien cache supprimé:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prend le contrôle de la page immédiatement
  event.waitUntil(self.clients.claim());
});

// --- 3. INTERCEPTION DES REQUÊTES (Le cœur du hors-ligne) ---
self.addEventListener('fetch', event => {
  // On ignore les requêtes vers Firebase (Firestore/Auth)
  // car l'application Firebase gère son propre cache hors-ligne
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('securetoken.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // Pour le reste (HTML, CSS, JS, Images), on cherche d'abord dans le cache.
  // Si ce n'est pas dans le cache, on va le chercher sur internet.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - retourne la réponse du cache
        if (response) {
          return response;
        }
        // Sinon, va sur le réseau
        return fetch(event.request).then(
          function(response) {
            // Vérifie si on a reçu une réponse valide
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Met en cache la nouvelle réponse pour la prochaine fois
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});