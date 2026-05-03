const CACHE_VERSION = 'nuruscreen-v2';
const MODEL_CACHE   = 'nuruscreen-models-v1';

// App shell — cached on install, served offline immediately
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
  // The MediaPipe model — largest file, must be cached on first load
  '/pose_landmarker_lite.task',
];

// External origins to cache (MediaPipe WASM from CDN)
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
];

// ── Install: pre-cache app shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // Activate immediately
      .catch(err => console.warn('SW install cache error:', err))
  );
});

// ── Activate: clean old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== MODEL_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // Take control immediately
  );
});

// ── Fetch: serve from cache, fall back to network ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // SKIP: non-GET requests (POST etc) — never cache these
  if (request.method !== 'GET') return;

  // SKIP: browser extensions and non-http
  if (!url.protocol.startsWith('http')) return;

  // MediaPipe model file — cache aggressively (it's 5MB, expensive to re-download)
  if (request.url.includes('pose_landmarker_lite.task')) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  // MediaPipe WASM from CDN — cache aggressively
  if (CDN_ORIGINS.some(o => request.url.startsWith(o))) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  // Next.js static assets (_next/static) — cache first, very long lived
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
    return;
  }

  // Next.js image optimisation — network first with cache fallback
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(networkFirst(request, CACHE_VERSION));
    return;
  }

  // App pages — network first so updates reach users, cache as fallback
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, CACHE_VERSION));
    return;
  }
});

// ── Strategy: Cache First ─────────────────────────────────────────
// Check cache → if hit, return immediately. If miss, fetch + cache.
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource not cached', { status: 503 });
  }
}

// ── Strategy: Network First ───────────────────────────────────────
// Try network → if offline/error, fall back to cache.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Last resort: return offline page if available
    const offline = await cache.match('/');
    return offline || new Response('Offline', { status: 503 });
  }
}