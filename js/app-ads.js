/* Islamic Companion, in-app ad units.
 *
 * Ads appear in exactly four sections and nowhere else, per /privacy.html:
 *   Knowledge (the AI question screen), Locations, Mosque search, Journal.
 * The Quran reader, the Qibla compass and the prayer-times screen never
 * carry an ad, and no ad interrupts a notification.
 *
 * Each unit sits at the bottom of its section, below the content and the
 * controls, so nothing a person is doing gets pushed around. Google requires
 * an ins element to be visible before it is pushed, so a unit is only pushed
 * when its section actually becomes the active tab.
 */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-8105508666234797';
  var SECTIONS = [
    { tab: 'ai',      slot: '7522072149' },  // Knowledge / AI answers
    { tab: 'towns',   slot: '1278555430' },  // Locations
    { tab: 'mosques', slot: '7522072149' },  // Mosque search
    { tab: 'journal', slot: '1278555430' }   // Journal
  ];

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
    SECTIONS.forEach(function (s) {
      var tab = document.getElementById('tab-' + s.tab);
      if (!tab) return;
      if (!tab.querySelector('.ic-ad')) tab.appendChild(build(s.slot));

      if (!tab.getAttribute('data-ic-ad-watch')) {
        tab.setAttribute('data-ic-ad-watch', '1');
        new MutationObserver(function () { fill(tab); })
          .observe(tab, { attributes: true, attributeFilter: ['class'] });
      }
      fill(tab);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
