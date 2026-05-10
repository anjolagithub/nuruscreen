const CACHE_VERSION = 'nuruscreen-v3';
const MODEL_CACHE   = 'nuruscreen-models-v2';

const APP_SHELL = [
  '/',
  '/dashboard',
  '/screen',
  '/children',
  '/history',
  '/profile',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/pose_landmarker_lite.task',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install cache error:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== MODEL_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // MediaPipe model file — cache aggressively, it's 5MB
  if (request.url.includes('pose_landmarker_lite.task')) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  // MediaPipe WASM from CDN — use no-cors to avoid CORS errors during caching
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirstCDN(request, MODEL_CACHE));
    return;
  }

  // Next.js static assets — cache first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
    return;
  }

  // App pages — network first, cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, CACHE_VERSION));
    return;
  }
});

// Cache first — for static assets that never change
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline — resource not cached', { status: 503 });
  }
}

// CDN cache first — uses no-cors for cross-origin WASM files
// opaque responses still work for loading WASM (browser handles it)
async function cacheFirstCDN(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    // Try normal fetch first (works when online with COEP headers)
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('CDN resource unavailable offline', { status: 503 });
  }
}

// Network first — for pages that should update when online
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match('/');
    return offline || new Response('Offline', { status: 503 });
  }
}