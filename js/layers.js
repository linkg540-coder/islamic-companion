
/* install-shortcut deep links: /?tab=quran etc. */
(function(){
  function apply(){
    var m = /[?&]tab=([a-z]+)/.exec(location.search);
    if (!m) return;
    var name = m[1];
    if (!document.getElementById('tab-' + name)) return;
    var btn = document.querySelector('.tab-btn[onclick*="showTab(\'' + name + '\'"]');
    try { showTab(name, btn); } catch (e) {}
  }
  window.addEventListener('load', function(){ setTimeout(apply, 400); });
})();

;

/* ---- accessibility layer (2026-11-16) -------------------------------------
   The app is one file with 121 buttons and almost no semantics. Rather than
   hand-editing every template string, this decorates the DOM once at boot and
   again after each tab switch: real tab semantics, accessible names for
   emoji-only buttons, labels for unlabelled fields, lang/dir on Arabic text,
   a polite live region for toasts and a main landmark.                        */
(function () {
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{200D}\u{FE0E}\s]/gu;

  function pretty(s) {
    return String(s || '').replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ').trim();
  }

  function tabs() {
    var list = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var m = /showTab\('([a-z]+)'/.exec(b.getAttribute('onclick') || '');
      if (!m) continue;
      var name = m[1];
      b.setAttribute('role', 'tab');
      if (!b.id) b.id = 'tabbtn-' + name;
      b.setAttribute('aria-controls', 'tab-' + name);
      b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
      var panel = document.getElementById('tab-' + name);
      if (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', b.id);
        if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '0');
      }
    }
  }

  function arabic(root) {
    var sel = '.arabic, .arabic-text, .dua-arabic';
    var els = (root || document).querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('lang')) continue;
      el.setAttribute('lang', 'ar');
      try { if (getComputedStyle(el).direction !== 'rtl') el.setAttribute('dir', 'rtl'); } catch (e) {}
    }
  }

  function buttons() {
    var list = document.querySelectorAll('button');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.hasAttribute('aria-label') || b.hasAttribute('aria-labelledby')) continue;
      var visible = (b.textContent || '').replace(EMOJI, '');
      if (visible.length) continue;                      // it already reads as text
      var label = b.getAttribute('title') || b.getAttribute('data-mood') || b.getAttribute('data-label');
      if (!label && b.id) label = pretty(b.id);
      if (!label) {
        var fn = /^\s*([A-Za-z_$][\w$]*)\(/.exec(b.getAttribute('onclick') || '');
        if (fn) label = pretty(fn[1]);
      }
      if (label) b.setAttribute('aria-label', label);
    }
  }

  function fields() {
    var list = document.querySelectorAll('input, select, textarea');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.type === 'hidden') continue;
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) continue;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')) continue;
      var label = el.getAttribute('placeholder') || el.getAttribute('title') || pretty(el.id) || el.tagName.toLowerCase();
      el.setAttribute('aria-label', label);
      if (el.tagName === 'SELECT' && !el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Choose an option');
    }
  }

  function landmarks() {
    if (document.querySelector('[role="main"]')) return;
    var first = document.getElementById('tab-prayer');
    if (first && first.parentElement) first.parentElement.setAttribute('role', 'main');
  }

  function toastLive() {
    if (typeof window.showToast !== 'function' || window.showToast.__a11y) return;
    var orig = window.showToast;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      var t = document.querySelector('.toast');
      if (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
      return r;
    };
    wrapped.__a11y = true;
    window.showToast = wrapped;
  }

  function tabHook() {
    if (typeof window.showTab !== 'function' || window.showTab.__a11y) return;
    var orig = window.showTab;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      try { tabs(); arabic(); buttons(); } catch (e) {}
      return r;
    };
    wrapped.__a11y = true;
    window.showTab = wrapped;
  }

  function run() {
    try { tabs(); arabic(); buttons(); fields(); landmarks(); toastLive(); tabHook(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 200); });
  else setTimeout(run, 200);
  window.addEventListener('load', function () { setTimeout(run, 600); });
})();

;

/* ---- update nudge (2026-11-16) -------------------------------------------
   Fixes the stale-build trap: sw.js calls skipWaiting() on install and
   clients.claim() on activate, so a new version takes control while the old
   page keeps running. Before this, the page you were looking at could be a
   build behind and nothing said so. Now the moment a new worker takes over
   (and only when there was already one before, so first installs stay quiet)
   a small chip appears; tapping it reloads into the new build. It is
   deliberately a tap and not an auto-reload, so it can never interrupt
   prayer audio or wipe a half-filled journal entry.                        */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var hadController = !!navigator.serviceWorker.controller;
  var chipShown = false;

  function showChip() {
    if (chipShown || document.getElementById('icUpdateChip')) return;
    chipShown = true;
    var b = document.createElement('button');
    b.id = 'icUpdateChip';
    b.type = 'button';
    b.setAttribute('aria-label', 'A new version is ready. Reload the app now.');
    b.textContent = '\u21bb Update ready \u2014 tap to refresh';
    b.style.cssText = [
      'position:fixed', 'left:50%', 'transform:translateX(-50%)',
      'bottom:calc(18px + env(safe-area-inset-bottom))',
      'z-index:100000', 'background:var(--gold,#d4af37)', 'color:#10142a',
      'border:0', 'border-radius:999px', 'padding:.62rem 1.1rem',
      'font:700 .85rem/1.1 inherit', 'box-shadow:0 6px 24px rgba(0,0,0,.45)',
      'cursor:pointer', 'max-width:88vw', 'white-space:nowrap'
    ].join(';');
    b.addEventListener('click', function () {
      b.textContent = '\u21bb Refreshing\u2026';
      b.disabled = true;
      location.reload();
    });
    document.body.appendChild(b);
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadController) showChip();   // brand new worker took over the old page
  });

  // the worker announces a new build itself, including when it activated with no
  // window open (in that case it also fires a local notification)
  navigator.serviceWorker.addEventListener('message', function (ev) {
    if (ev && ev.data && ev.data.type === 'IC_UPDATED') showChip();
  });

  // Active checking instead of passive: periodic background sync lets the app
  // discover a new build while it is closed. Chrome/Android only, silently
  // skipped elsewhere and never prompts for permission on its own.
  function registerPeriodic(reg) {
    try {
      if (!('periodicSync' in reg) || !navigator.permissions || !navigator.permissions.query) return;
      navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (p) {
        if (p.state !== 'granted') return;
        reg.periodicSync.register('ic-update-check', { minInterval: 6 * 60 * 60 * 1000 }).catch(function () {});
      }).catch(function () {});
    } catch (e) {}
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(function (reg) {
      registerPeriodic(reg);
      if (reg.waiting && navigator.serviceWorker.controller) showChip();
      reg.addEventListener && reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showChip();
        });
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && reg.update) { try { reg.update(); } catch (e) {} }
      });
    }).catch(function () {});
  }
})();

;

/* ---- tafsir (2026-11-16, hardened 2026-11-16b) ------------------------------
   Ibn Kathir (English, abridged) per ayah, fetched only for the verse you tap
   and cached for offline reads. Hardened because one CDN was a single point of
   failure: four independent mirrors are tried in order, the cache is consulted
   first, and Promise.any picks whichever cached mirror has the verse, so an
   already-opened ayah keeps reading with no network at all. */
(function () {
  var MIRRORS = [
    'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir/{s}/{a}.json',
    'https://fastly.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir/{s}/{a}.json',
    'https://gcore.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir/{s}/{a}.json',
    'https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/en-tafisr-ibn-kathir/{s}/{a}.json'
  ];
  var TIMEOUT = 9000;
  var memo = {};
  var lastGood = 0;

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function paras(text) {
    return String(text || '').split(/\n{1,}/).map(function (p) {
      p = p.trim();
      return p ? '<p style="margin:.45rem 0">' + esc(p) + '</p>' : '';
    }).join('');
  }
  function urlFor(i, s, a) {
    return MIRRORS[i].replace('{s}', s).replace('{a}', a);
  }
  function withTimeout(url) {
    if (typeof AbortController !== 'function') return fetch(url, { cache: 'force-cache' });
    var ctrl = new AbortController();
    var t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT);
    return fetch(url, { cache: 'force-cache', signal: ctrl.signal }).then(
      function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }
  function fromCache(s, a) {
    if (typeof caches === 'undefined' || !caches.match) return Promise.reject(new Error('no cache'));
    // Cache.match RESOLVES with undefined on a miss, it does not reject, so each
    // probe must be converted into a rejection or Promise.any would win on a miss
    var tries = MIRRORS.map(function (_, i) {
      return caches.match(urlFor(i, s, a)).then(function (r) {
        if (r) return r;
        throw new Error('miss');
      });
    });
    if (Promise.any) return Promise.any(tries);
    return Promise.all(tries).then(function (rs) {
      for (var i = 0; i < rs.length; i++) if (rs[i]) return rs[i];
      throw new Error('miss');
    });
  }
  function fromNetwork(s, a) {
    var order = MIRRORS.map(function (_, i) { return i; });
    if (lastGood) order = [lastGood].concat(order.filter(function (i) { return i !== lastGood; }));
    var i = 0;
    function next() {
      if (i >= order.length) return Promise.reject(new Error('all mirrors down'));
      var idx = order[i++];
      return withTimeout(urlFor(idx, s, a)).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (j) {
          if (!j || (!j.text && !j.tafsir)) throw new Error('empty');
          lastGood = idx;
          return j;
        });
      }).catch(next);
    }
    return next();
  }

  window.toggleTafsir = function (surah, idx) {
    var box = document.getElementById('tf-' + idx);
    var btn = document.getElementById('tfbtn-' + idx);
    if (!box) return;
    if (!box.hidden) { box.hidden = true; if (btn) btn.style.color = ''; return; }
    box.hidden = false;
    if (btn) btn.style.color = 'var(--gold)';
    if (box.dataset.loaded === '1') return;

    var key = surah + ':' + idx, ayah = idx + 1;
    box.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Loading tafsir…</p>';

    function paint(entry) {
      var body = entry.tafsir || entry.text || '';
      box.innerHTML = '<div class="tafsir-head">📘 Tafsir Ibn Kathir · ' +
        esc(entry.source || 'abridged, English') + '</div>' + paras(body);
      box.dataset.loaded = '1';
      memo[key] = body;
    }

    if (memo[key]) { paint({ tafsir: memo[key] }); return; }

    fromCache(surah, ayah)
      .then(function (res) { return res.json(); })
      .catch(function () { return fromNetwork(surah, ayah); })
      .then(function (j) { paint(j); })
      .catch(function () {
        box.innerHTML = '<p style="color:var(--danger);font-size:.85rem">Tafsir could not load from any source. It needs a connection the first time you open a verse.</p>';
      });
  };
})();

/* ---- API resilience (2026-11-16) -----------------------------------------
   Prayer times, Quran text and mosque search all depend on free public APIs
   (aladhan, alquran.cloud, nominatim). When one of them throws a 503 the app
   used to show a broken tab, and repeated taps hammered the same dying host.
   This wraps window.fetch once and, for those three read-only GET hosts only:
     - retries once after a short jittered backoff
     - opens a 45s circuit breaker after 3 failures and serves the cached copy
       instead of calling a host that is clearly down
     - still respects any AbortSignal a caller passes (fetchWithTimeout keeps
       its own 10s cancellation), and never retries non-GET requests
   Everything else passes straight through untouched.                        */
(function () {
  var HOSTS = ['api.aladhan.com', 'api.alquran.cloud', 'nominatim.openstreetmap.org'];
  var TIMEOUT = 12000, FAILS_TO_OPEN = 3, COOLDOWN = 45000;
  var state = {};
  var orig = window.fetch;
  if (!orig || orig.__icResilient) return;

  function hostOf(input) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
      if (!u) return '';
      return new URL(u, location.href).hostname;
    } catch (e) { return ''; }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function isGet(init) {
    if (init && init.method && String(init.method).toUpperCase() !== 'GET') return false;
    return true;
  }
  function cached(input) {
    return new Promise(function (resolve, reject) {
      if (typeof caches === 'undefined' || !caches.match) return reject(new Error('no cache'));
      caches.match(input).then(function (hit) { hit ? resolve(hit) : reject(new Error('miss')); },
                               function () { reject(new Error('miss')); });
    });
  }
  function once(input, init) {
    if (init && init.signal) return orig.call(window, input, init);   // caller owns cancellation
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var opts = {}, k;
    if (init) for (k in init) if (Object.prototype.hasOwnProperty.call(init, k)) opts[k] = init[k];
    if (ctrl) opts.signal = ctrl.signal;
    var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT) : null;
    return orig.call(window, input, opts).then(
      function (r) { if (timer) clearTimeout(timer); return r; },
      function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  var resilient = function (input, init) {
    var host = hostOf(input);
    if (HOSTS.indexOf(host) === -1 || !isGet(init)) return orig.apply(window, arguments);
    var st = state[host] || (state[host] = { fails: 0, openUntil: 0, recovered: 0 });

    function ok(r) {
      if (r && (r.ok || r.type === 'opaque' || r.status === 0)) { st.fails = 0; return r; }
      throw new Error('HTTP ' + (r && r.status));
    }

    // circuit open: hand back the cached response, never call a dead host
    if (Date.now() < st.openUntil) {
      return cached(input).catch(function () { return once(input, init).then(ok); });
    }

    return once(input, init).then(ok).catch(function (err) {
      st.fails++;
      return sleep(350 + Math.random() * 350)
        .then(function () { return once(input, init); })
        .then(ok)
        .catch(function () {
          if (st.fails >= FAILS_TO_OPEN) st.openUntil = Date.now() + COOLDOWN;
          return cached(input).catch(function () { throw err; });
        });
    });
  };
  resilient.__icResilient = true;
  window.fetch = resilient;
  window.icApiHealth = function () { return JSON.parse(JSON.stringify(state)); };
})();
