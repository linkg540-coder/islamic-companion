/* Islamic Companion — ad units on the standalone Quran pages only.
 *
 * Scope, per the promise on /privacy.html: ads may appear on the standalone
 * reading pages (/quran/...). The in-app Quran reader, the Qibla compass and
 * the prayer-times screen stay ad-free, and no ad interrupts a notification.
 *
 * Ad unit ids live in SLOTS below. Leave a slot empty and that placement
 * never touches the page at all.
 */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-8105508666234797';
  var SLOTS = {
    top: '7522072149',   // "Quran Top"
    bottom: ''           // "Quran Bottom" - pending id
  };

  var want = [];
  if (SLOTS.top) want.push('top');
  if (SLOTS.bottom) want.push('bottom');
  if (!want.length) return;              // nothing configured: leave the DOM alone

  function addStyle() {
    var s = document.createElement('style');
    s.textContent =
      '.ic-ad{margin:1.5rem 0;display:flex;flex-direction:column;align-items:center;gap:.35rem;' +
      'max-width:728px;margin-left:auto;margin-right:auto}' +
      '.ic-ad>span{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;' +
      'color:var(--muted,#a3b3c8);opacity:.8}' +
      '.ic-ad ins{display:block;width:100%;min-height:90px;background:transparent}';
    document.head.appendChild(s);
  }

  function build(slot) {
    var wrap = document.createElement('div');
    wrap.className = 'ic-ad';
    wrap.setAttribute('role', 'complementary');
    wrap.setAttribute('aria-label', 'Advertisement');

    var label = document.createElement('span');
    label.setAttribute('aria-hidden', 'true');
    label.textContent = 'Advertisement';

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    wrap.appendChild(label);
    wrap.appendChild(ins);
    return wrap;
  }

  function run() {
    // Surah pages read verse by verse; the index lists all 114 surahs.
    var verses = document.querySelector('.ayahs');
    var grid = document.querySelector('.grid');
    var pager = document.querySelector('nav.pager');

    var topRef = verses || grid;
    var bottomRef = pager || grid;

    addStyle();

    var pushed = 0;

    if (SLOTS.top && topRef && topRef.parentNode) {
      topRef.parentNode.insertBefore(build(SLOTS.top), topRef);
      pushed++;
    }
    if (SLOTS.bottom && bottomRef && bottomRef.parentNode) {
      bottomRef.parentNode.insertBefore(build(SLOTS.bottom), bottomRef.nextSibling);
      pushed++;
    }

    // one push per <ins>, in document order
    for (var i = 0; i < pushed; i++) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
