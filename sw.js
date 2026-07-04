/**
 * sw.js — Pipeline CRM Service Worker
 * Strategy:
 *  - App shell (HTML/CSS/JS): Cache-first, update in background
 *  - CDN assets (fonts, icons, chart.js, lucide, tailwind): Cache-first, long TTL
 *  - Everything else: Network-first with cache fallback
 */

const CACHE_VERSION = 'pipeline-v1';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const CDN_CACHE     = `${CACHE_VERSION}-cdn`;

// Local app shell — always cache these
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  '/styles.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
];

// CDN assets — cache on first use, never expire during this SW version
const CDN_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
];

// ─── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // addAll fails silently per-item so we catch individually
      return Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Failed to cache ${url}:`, err)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('pipeline-') && key !== SHELL_CACHE && key !== CDN_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: routing logic ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // CDN assets → cache-first
  if (CDN_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    event.respondWith(cdnCacheFirst(request));
    return;
  }

  // Same-origin shell assets → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else → network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/** Cache-first for CDN assets (fonts, libraries). Never goes stale in this SW version. */
async function cdnCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CDN_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached ?? new Response('CDN resource unavailable offline.', { status: 503 });
  }
}

/** Stale-while-revalidate for app shell. Serves cache immediately, updates in background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  // Fire-and-forget background update
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => {});

  if (cached) return cached;

  // No cache yet — wait for network
  try {
    return await networkFetch;
  } catch {
    return offlineFallback(request);
  }
}

/** Network-first with cache fallback for everything else. */
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? offlineFallback(request);
  }
}

/** Graceful offline fallback page (for navigations) or a 503 for sub-resources. */
async function offlineFallback(request) {
  const isNavigation = request.mode === 'navigate';
  if (isNavigation) {
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    // Inline minimal fallback if offline.html wasn't cached
    return new Response(
      `<!DOCTYPE html><html><head><title>PIPELINE — Offline</title>
      <style>body{background:#10131A;color:#E8EAF0;font-family:monospace;display:flex;align-items:center;
      justify-content:center;height:100vh;margin:0;text-align:center;flex-direction:column;gap:1rem;}
      .tag{color:#4FD1C5;font-size:.8rem;letter-spacing:.1em;}</style></head>
      <body><div class="tag">PIPELINE // OFFLINE</div>
      <h1 style="font-size:1.2rem">No network connection</h1>
      <p style="color:#8B92A5;max-width:300px">Your locally saved data is still accessible — reconnect to sync.</p>
      <button onclick="location.reload()" style="background:#4FD1C5;color:#10131A;border:none;
      padding:.7rem 1.5rem;border-radius:10px;font-weight:700;cursor:pointer;margin-top:.5rem">Retry</button>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  return new Response('Offline', { status: 503 });
}

// ─── Background sync placeholder (future backend) ────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'pipeline-sync') {
    event.waitUntil(syncToBackend());
  }
});

async function syncToBackend() {
  // When BACKEND_CONFIG.enabled becomes true in config.js, implement
  // reading a pending-writes queue from IndexedDB and POSTing here.
  console.log('[SW] Background sync fired (no-op until backend is live)');
}

// ─── Push notifications placeholder ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'PIPELINE', body: 'You have an update.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'pipeline-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
