/* Islamic Companion, in-app ad units.
 *
 * Ads run on every app screen except three, per /privacy.html: the in-app
 * Quran reader, the Qibla compass and the prayer-times screen never carry an
 * ad, and the standalone /quran/ pages stay clean too (js/quran-ads.js is a
 * deliberate no-op). No ad interrupts a notification.
 *
 * Each unit sits at the bottom of its screen, below the content and the
 * controls, so nothing a person is doing gets pushed around. Google requires
 * an ins element to be visible before it is pushed, so a unit is only pushed
 * when its screen actually becomes the active tab.
 */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-8105508666234797';

  // Screens that must stay ad-free, whatever else changes.
  var NEVER = ['tab-prayer', 'tab-quran', 'tab-qibla'];

  // AdSense unit ids, used in rotation so the reports stay readable.
  var SLOTS = ['7522072149', '1278555430'];

  function build(slot) {
    var wrap = document.createElement('div');
    wrap.className = 'ic-ad';
    wrap.setAttribute('role', 'complementary');
    wrap.setAttribute('aria-label', 'Advertisement');
    wrap.style.cssText =
      'margin:1.2rem auto 0.4rem;max-width:728px;display:flex;flex-direction:column;' +
      'align-items:center;gap:.35rem';

    var label = document.createElement('span');
    label.textContent = 'Advertisement';
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);opacity:.8';

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;width:100%;min-height:90px';
    ins.setAttribute('data-ad-client', CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    wrap.appendChild(label);
    wrap.appendChild(ins);
    wrap.setAttribute('data-filled', '');
    return wrap;
  }

  function fill(tab) {
    if (!tab) return;
    var wrap = tab.querySelector('.ic-ad');
    if (!wrap || wrap.getAttribute('data-filled') === '1') return;
    if (!tab.classList.contains('active')) return;
    wrap.setAttribute('data-filled', '1');
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      wrap.setAttribute('data-filled', '');
    }
  }

  function mount() {
    var tabs = document.querySelectorAll('.tab-content[id]');
    var n = 0;
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (NEVER.indexOf(tab.id) !== -1) continue;

      if (!tab.querySelector('.ic-ad')) {
        tab.appendChild(build(SLOTS[n % SLOTS.length]));
      }
      n++;

      if (!tab.getAttribute('data-ic-ad-watch')) {
        tab.setAttribute('data-ic-ad-watch', '1');
        new MutationObserver(function (t) { return function () { fill(t); }; }(tab))
          .observe(tab, { attributes: true, attributeFilter: ['class'] });
      }
      fill(tab);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
