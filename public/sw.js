/* Carz Management service worker.
 *
 * Strategy, chosen for a field app on patchy mobile data:
 *   - App shell + static assets: cache-first, so a cold start on no signal
 *     still paints.
 *   - Navigations: network-first with a cache fallback, then /offline, so the
 *     staff app opens to something useful rather than the browser error page.
 *   - API GETs: network-first with a short-lived cache, so a wash boy who
 *     loses signal mid-round still sees the list he loaded at the depot.
 *   - Anything that mutates (POST/PATCH/DELETE): never cached.
 */

const VERSION = 'v4';
const SHELL_CACHE = `carzz-shell-${VERSION}`;
const PAGE_CACHE = `carzz-pages-${VERSION}`;
const API_CACHE = `carzz-api-${VERSION}`;

const SHELL_ASSETS = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One bad URL must not fail the whole install, so add them individually.
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((url) => cache.add(url).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('carzz-') && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never serve a stale session decision or webpack HMR.
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname.includes('webpack-hmr') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Next.js App Router client navigation RSC payloads
  if (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree') ||
    url.searchParams.has('_rsc')
  ) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
      return response;
    }
    // If the server returned a 5xx error (e.g. database unreachable when offline),
    // serve the cached version or fallback to /offline rather than showing raw server error.
    if (response.status >= 500) {
      const cached = await caches.match(request);
      if (cached) return cached;
      const offline = await caches.match('/offline');
      if (offline) return offline;
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline');
    return (
      offline ??
      new Response(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Carz</title><style>body{background:#081429;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center}.card{background:#0e203f;border:1px solid #1e3a6a;border-radius:16px;padding:32px 24px;max-width:400px;width:100%}h1{font-size:22px;margin:0 0 10px;font-weight:800}p{color:#94a3b8;font-size:14px;line-height:1.5;margin:0 0 20px}button{background:#2563eb;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;width:100%}</style></head><body><div class="card"><h1>You are offline</h1><p>Carz will reload automatically when your connection returns. Last loaded data is saved.</p><button onclick="window.location.reload()">Retry Connection</button></div></body></html>',
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      return response;
    }
    if (response.status >= 500) {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No connection.', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
