const CACHE_NAME = 'conify-offline-v1';
// FIXED: The path MUST be relative to the root, not inside /js/
const OFFLINE_URL = '/offline.html';
const CSS_URL = '/css/global.css'; // Path to your CSS
const OFFLINE_IMAGE = '/stock_image/offline.svg'; // Path to your offline image

// 1. Install the service worker and cache all necessary offline assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Service Worker: Caching offline assets');
      try {
        await cache.addAll([
          '/', // Caches index.html at the root
          OFFLINE_URL,
          CSS_URL, // Cache the CSS
          OFFLINE_IMAGE // Cache the SVG
        ]);
      } catch (err) {
        console.error('Service Worker: Cache addAll failed →', err);
      }
    })()
  );
  self.skipWaiting();
});

// 2. Activate the service worker and clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Only intercept navigation requests (e.g., loading a new page)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try to fetch the page from the network first
          const networkResponse = await fetch(req);
          return networkResponse;
        } catch (error) {
          // If the network fails (offline), serve the cached offline page
          console.log('Fetch failed; returning offline page.');
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
  
  // For other requests (CSS, images), try cache first
  // This ensures your offline.html can load its CSS and image
  if (req.destination === 'style' || req.destination === 'image') {
    event.respondWith(
      caches.match(req)
        .then(cachedResponse => {
          // Return from cache if found
          if (cachedResponse) {
            return cachedResponse;
          }
          // Otherwise, fetch from network
          return fetch(req);
        })
    );
  }
});