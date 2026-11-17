/* Islamic Companion — ad consent bootstrap (2026-11-17)
 *
 * Runs before the AdSense tag on every page. It does three things:
 *   1. Sets Google Consent Mode v2 defaults, so personalised advertising is
 *      off until something actually grants it.
 *   2. Honours Global Privacy Control: a GPC signal always means opted out and
 *      cannot be overridden by a stored choice or by the banner.
 *   3. Shows a consent message to EEA / UK / Switzerland visitors (detected by
 *      timezone) and remembers the answer on the device.
 *
 * If Google's own certified consent message is enabled in AdSense
 * (Privacy & messaging), it sets the same signals and this file stands down.
 */
(function () {
  'use strict';

  var KEY = 'ic_adconsent';                 // 'granted' | 'denied'
  var EEA_TZ = /^Europe\/|^Atlantic\/(Canary|Faroe|Madeira|Reykjavik)$/;
  var BANNER_ID = 'icConsentBanner';

  var gpc = false;
  try { gpc = navigator.globalPrivacyControl === true; } catch (e) {}

  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  if (stored !== 'granted' && stored !== 'denied') stored = null;

  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var restricted = EEA_TZ.test(tz);

  function decide() {
    if (gpc) return false;                  // a GPC signal always wins
    if (stored === 'denied') return false;
    if (stored === 'granted') return true;
    return !restricted;                     // outside EEA/UK/CH: on by default
  }

  var granted = decide();

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  function signal(g) {
    var d = g ? 'granted' : 'denied';
    gtag('consent', 'update', {
      ad_storage: d,
      ad_user_data: d,
      ad_personalization: d,
      analytics_storage: 'denied'
    });
    gtag('set', 'ads_data_redaction', !g);
  }

  gtag('consent', 'default', {
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
    analytics_storage: 'denied',            // GoatCounter is cookieless
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', !granted);

  // ---------- consent message (EEA / UK / CH only) ----------

  function bannerStyles() {
    return 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
      'background:#12112a;border-top:1px solid #3a3152;box-shadow:0 -8px 24px rgba(0,0,0,.45);' +
      'padding:14px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'font-size:.85rem;line-height:1.45;color:#e8e4f5;display:flex;flex-wrap:wrap;gap:10px;' +
      'align-items:center;justify-content:center;text-align:center;';
  }

  function btnStyles(kind) {
    var base = 'border-radius:10px;padding:9px 16px;font-size:.85rem;font-weight:600;' +
      'cursor:pointer;font-family:inherit;border:1px solid transparent;';
    return kind === 'yes'
      ? base + 'background:#d4af37;color:#1a1400;'
      : base + 'background:transparent;color:#c9b8ff;border-color:#3a3152;';
  }

  function renderBanner() {
    if (!restricted || gpc || stored || document.getElementById(BANNER_ID)) return;
    if (window.googlefc) return;            // Google's certified CMP is in charge

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Advertising consent');
    el.style.cssText = bannerStyles();

    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1 1 260px;text-align:left;';
    msg.textContent = 'We use Google AdSense. Personalised advertising stays off unless you allow it. ' +
      'You can change this any time on the Privacy page.';

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'Allow personalised ads';
    yes.style.cssText = btnStyles('yes');
    yes.addEventListener('click', function () { window.icAdConsent.set('granted'); });

    var no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'No thanks';
    no.style.cssText = btnStyles('no');
    no.addEventListener('click', function () { window.icAdConsent.set('denied'); });

    el.appendChild(msg);
    el.appendChild(yes);
    el.appendChild(no);
    (document.body || document.documentElement).appendChild(el);
  }

  function dropBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---------- control on the Privacy page ----------

  function renderPrefs() {
    var box = document.getElementById('icAdPrefs');
    if (!box) return;

    var on = granted;
    var status;
    if (gpc) {
      status = 'Your browser sent a Global Privacy Control signal, so personalised ads are off and this setting cannot be turned back on here.';
    } else if (on) {
      status = 'Personalised ads are on for this device.';
    } else {
      status = 'Personalised ads are off for this device. Ads may still appear, but they will not be personalised.';
    }

    box.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = status;
    p.style.cssText = 'margin:0 0 10px;';
    box.appendChild(p);

    if (!gpc) {
      [['granted', 'Allow personalised ads'], ['denied', 'Turn personalised ads off']].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = pair[1];
        b.disabled = (pair[0] === 'granted' ? on : !on);
        b.style.cssText = btnStyles(pair[0] === 'granted' ? 'yes' : 'no') +
          'margin:0 8px 8px 0;' + 'opacity:' + (b.disabled ? '.45' : '1') + ';';
        b.addEventListener('click', function () { window.icAdConsent.set(pair[0]); });
        box.appendChild(b);
      });

      if (stored) {
        var r = document.createElement('button');
        r.type = 'button';
        r.textContent = 'Reset my choice';
        r.style.cssText = 'background:none;border:0;color:#8b7db8;font-size:.8rem;' +
          'text-decoration:underline;cursor:pointer;padding:4px 0;font-family:inherit;display:block;';
        r.addEventListener('click', function () { window.icAdConsent.reset(); });
        box.appendChild(r);
      }
    }
  }

  window.icAdConsent = {
    gpc: gpc,
    regionRestricted: restricted,
    stored: stored,
    granted: granted,
    set: function (v) {
      if (gpc) return false;
      var want = v === 'granted';
      try { localStorage.setItem(KEY, want ? 'granted' : 'denied'); } catch (e) {}
      stored = want ? 'granted' : 'denied';
      granted = want;
      signal(granted);
      dropBanner();
      renderPrefs();
      return true;
    },
    reset: function () {
      if (gpc) return false;
      try { localStorage.removeItem(KEY); } catch (e) {}
      stored = null;
      granted = decide();
      signal(granted);
      renderPrefs();
      renderBanner();
      return true;
    },
    state: function () {
      return { granted: granted, gpc: gpc, regionRestricted: restricted, stored: stored };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderBanner(); renderPrefs(); });
  } else {
    renderBanner();
    renderPrefs();
  }
})();
