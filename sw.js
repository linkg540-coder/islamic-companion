// Islamic Companion — service worker
// 1. Push notifications (unchanged behaviour)
// 2. Offline support: app shell + Quran/prayer API responses cached
//
// Caching strategy
//   navigation  -> network first, cached index.html when offline
//   alquran / aladhan APIs -> stale-while-revalidate (open a surah once, read it offline forever)
//   same-origin static -> cache first, refreshed in the background
// The Base44 function API (push subscribe, sync) is never cached.

const VERSION = 'ic-v2';
const SHELL = `${VERSION}-shell`;
const QURAN = `${VERSION}-quran`;
const STATIC = `${VERSION}-static`;
const SHELL_FILES = ['./', './index.html'];
const API_HOSTS = ['api.alquran.cloud', 'api.aladhan.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.allSettled(SHELL_FILES.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, QURAN, STATIC]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

function isApi(url) {
  return API_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // app shell
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // only the app's own entry point may refresh the cached shell —
        // caching every navigation here would overwrite it with whatever page
        // happened to be opened (e.g. a probe or a redirect stub)
        if (url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
          const c = await caches.open(SHELL);
          c.put('./index.html', fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        const c = await caches.open(SHELL);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Quran + prayer times
  if (isApi(url)) {
    e.respondWith(staleWhileRevalidate(req, QURAN));
    return;
  }

  // own assets (icons, sw itself, manifest)
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const cached = await cache.match(req);
      if (cached) {
        fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});

// lets the page show how much is stored for offline use
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'ic-cache-stats') return;
  e.waitUntil((async () => {
    const stats = {};
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      stats[name] = (await c.keys()).length;
    }
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (e.source) e.source.postMessage({ type: 'ic-cache-stats', stats, total });
  })());
});

// ---------- push ----------
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || '🕌 Islamic Companion', {
    body: d.body || 'It is time for prayer.',
    tag: d.tag || 'prayer',
    data: { url: d.url || '/' },
    vibrate: [180, 90, 180],
    silent: false,
    requireInteraction: !!d.sticky
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
