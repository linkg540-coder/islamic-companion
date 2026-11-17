// Islamic Companion — service worker
// 1. Push notifications (unchanged behaviour)
// 2. Offline support: app shell + Quran/prayer API responses cached
//
// Caching strategy
//   navigation  -> network first, cached index.html when offline
//   alquran / aladhan APIs -> stale-while-revalidate (open a surah once, read it offline forever)
//   same-origin static -> cache first, refreshed in the background
// The Base44 function API (push subscribe, sync) is never cached.

//
// v3.2 (2026-11-17): app-ads.js is requested with ?v=3 because the CDN keeps
//   static JS for 10 minutes; the old copy was outliving the deploy.
// v3.1 (2026-11-17): ads now run on every app screen except prayer times, the
//   Quran reader and the Qibla compass.
// v3.0 (2026-11-17): ads moved into the app. js/app-ads.js carries four units
//   (Knowledge, Locations, Mosque search, Journal) and js/quran-ads.js is now a
//   no-op, so the standalone /quran/ pages carry no ads at all.
// v2.9 (2026-11-17): serve /js/quran-ads.js network-first. It carries the live ad
//   unit ids, and the cache-first path kept re-storing a stale copy from the
//   browser HTTP cache, so the second unit stayed invisible for 10+ minutes
//   after deploy. This file is 3KB; going to the network costs nothing.
// v2.8 (2026-11-17): cache bump for the second live ad unit ("Quran Bottom" =
//   1278555430) now that both SLOTS in js/quran-ads.js are populated.
// v2.7 (2026-11-17): STATIC cache bump so the live ad-unit id in js/quran-ads.js
//   (AdSense "Quran Top" = 7522072149) reaches returning readers instead of the
//   cache-first copy with empty slots.
// v2.6 (2026-11-16): mosque finder no longer hangs on a dead Overpass mirror (Photon fallback).
// v2.5 (2026-11-16): cache bump so the corrected app.js (Hijri date spacing) and the
// analytics tag reach installed users on their next launch.
// v2.4 (2026-11-16): pre-adhan ON by default (js/app.js precache bumped), split JS precached, tafsir mirror-agnostic, and an
// ACTIVE update notice: when a new worker activates while no window is open we
// post a local notification, and periodic background sync asks for an update
// even if the app was never opened.: byte-level change to force a re-install so every client
// re-precaches the shell. Symptom this fixes: after an index.html update some
// devices kept serving the old HTML from the shell cache, so new features
// (manifest, iOS safe areas, accessibility semantics) never appeared until the
// cache expired. The install step below already fetches with cache:'reload', so
// touching this file is enough to hand clients a fresh shell.

const VERSION = 'ic-v29';
const SHELL = `${VERSION}-shell`;
const QURAN = `${VERSION}-quran`;
const STATIC = `${VERSION}-static`;
const SHELL_FILES = ['./', './index.html', './js/app.js', './js/quran-player.js', './js/layers.js', './js/app-ads.js?v=3'];
const API_HOSTS = ['api.alquran.cloud', 'api.aladhan.com'];
// tafsir is served from any of these mirrors; cache whichever one answered
const TAFSIR_HOSTS = ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net', 'raw.githubusercontent.com'];

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
    await announceUpdate();
  })());
});

// A new build is live. Open windows get the in-app pill; if the app is closed,
// the owner gets a local notification instead, so the update is not silent.
async function announceUpdate() {
  try {
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(c => c.visibilityState === 'visible' || c.visibilityState === 'hidden');
    for (const c of windows) { try { c.postMessage({ type: 'IC_UPDATED' }); } catch (_) {} }
    if (windows.length) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    await self.registration.showNotification('🕌 Islamic Companion updated', {
      body: 'A new version is ready. Tap to open it.',
      tag: 'ic-update',
      data: { url: '/' },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    });
  } catch (_) {}
}

// Chrome/Android periodic background sync: lets the app learn about a new build
// while it is closed and closed-notify the owner.
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'ic-update-check') return;
  e.waitUntil((async () => {
    try { await self.registration.update(); } catch (_) {}
    // update() only downloads a changed worker; activation does the notifying
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

  // tafsir (Ibn Kathir text per ayah) — open a verse once, read it offline after
  if (TAFSIR_HOSTS.indexOf(url.hostname) !== -1 && url.pathname.indexOf('/tafsir_api') !== -1) {
    e.respondWith(staleWhileRevalidate(req, QURAN));
    return;
  }

  // ad-unit config: network first, so a deploy reaches readers immediately
  if (url.origin === location.origin && url.pathname === '/js/quran-ads.js') {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC);
      try {
        const res = await fetch(req, { cache: 'reload' });
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return (await cache.match(req)) || Response.error();
      }
    })());
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
