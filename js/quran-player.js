
// ===== MOBILE QURAN: mini player + media session + font size =====
(function(){
  var mp = document.createElement('div');
  mp.id = 'miniPlayer';
  mp.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:rgba(18,26,62,0.96);border-top:1px solid var(--gold);padding:0.55rem 0.8rem calc(0.55rem + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 24px rgba(0,0,0,0.55);backdrop-filter:blur(10px)';
  mp.innerHTML = '<div style="display:flex;align-items:center;gap:0.7rem">'
    + '<button id="mpPlay" style="background:var(--card);border:1px solid var(--gold);color:var(--gold);border-radius:50%;width:2.5rem;height:2.5rem;font-size:1.05rem;cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center">\u23F8</button>'
    + '<div style="flex:1;min-width:0">'
    + '<div id="mpTitle" style="font-size:0.8rem;color:var(--gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\u2014</div>'
    + '<div id="mpTime" style="font-size:0.68rem;color:var(--muted)">0:00 / 0:00</div>'
    + '</div>'
    + '<button id="mpStop" style="background:var(--card);border:1px solid var(--border);color:var(--muted);border-radius:50%;width:2.1rem;height:2.1rem;font-size:0.85rem;cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center">\u2715</button>'
    + '</div>'
    + '<input id="mpSeek" type="range" min="0" max="100" value="0" style="width:100%;accent-color:var(--gold);margin-top:0.4rem">';
  document.body.appendChild(mp);

  var mpPlay = mp.querySelector('#mpPlay');
  var mpTitle = mp.querySelector('#mpTitle');
  var mpTime = mp.querySelector('#mpTime');
  var mpSeek = mp.querySelector('#mpSeek');
  var seeking = false;

  function fmt(s){ if(!isFinite(s)) return '0:00'; var m = Math.floor(s/60), x = Math.floor(s%60); return m + ':' + (x<10?'0':'') + x; }
  function reciterName(){ try{ var r = RECITERS.find(function(x){return x.id === document.getElementById('reciterSelect').value}); return r ? r.name : 'Recitation'; }catch(e){ return 'Recitation'; } }
  function setTitle(){
    var sName = window.currentSurahName || (window.currentSurah ? ('Surah ' + window.currentSurah) : 'Quran');
    mpTitle.textContent = '\u{1F3A7} ' + sName + ' \u00B7 ' + reciterName();
  }
  function sync(){
    if(!audioEl || !audioEl.src) return;
    mp.style.display = 'block';
    document.body.classList.add('mp-on');
    setTitle();
    mpPlay.textContent = audioEl.paused ? '\u25B6' : '\u23F8';
    mpTime.textContent = fmt(audioEl.currentTime) + ' / ' + fmt(audioEl.duration);
    if(!seeking && isFinite(audioEl.duration) && audioEl.duration > 0){
      mpSeek.value = Math.round((audioEl.currentTime / audioEl.duration) * 100);
    }
  }
  function mpHide(){
    mp.style.display = 'none';
    document.body.classList.remove('mp-on');
  }
  window.mpToggle = function(){ if(!audioEl) return; if(audioEl.paused){ audioEl.play().catch(function(){}); } else { audioEl.pause(); } sync(); };
  window.mpStop = function(){ if(audioEl){ audioEl.pause(); try{ audioEl.currentTime = 0; }catch(e){} } mpSeek.value = 0; mpHide(); };
  mpPlay.addEventListener('click', window.mpToggle);
  mp.querySelector('#mpStop').addEventListener('click', window.mpStop);
  mpSeek.addEventListener('input', function(){ seeking = true; });
  mpSeek.addEventListener('change', function(){
    if(audioEl && isFinite(audioEl.duration) && audioEl.duration > 0){
      audioEl.currentTime = (mpSeek.value / 100) * audioEl.duration;
    }
    seeking = false;
  });

  function setMediaSession(){
    if(!('mediaSession' in navigator)) return;
    try{
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Surah ' + (window.currentSurahName || ''),
        artist: reciterName(),
        album: 'Islamic Companion'
      });
      navigator.mediaSession.setActionHandler('play', function(){ audioEl.play().catch(function(){}); });
      navigator.mediaSession.setActionHandler('pause', function(){ audioEl.pause(); });
      navigator.mediaSession.setActionHandler('stop', function(){ window.mpStop(); });
    }catch(e){}
  }

  var audio = document.getElementById('quranAudio');
  if(audio){
    audio.addEventListener('play', function(){ sync(); setMediaSession(); });
    audio.addEventListener('pause', sync);
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('ended', sync);
    audio.addEventListener('error', function(){ try{ if(audio.error && audio.networkState === audio.NETWORK_NO_SOURCE){ mpHide(); } }catch(e){} });
  }

  // ---- Arabic font size controls ----
  var st = document.createElement('style');
  st.textContent = '.ayah .arabic{font-size:var(--arabic-fs,28px)!important;line-height:2.3!important}.mp-fs-btn{padding:0.35rem 0.9rem;border-radius:1rem;border:1px solid var(--gold);background:var(--card);color:var(--gold);cursor:pointer;font-size:1.05rem;line-height:1}body.mp-on{padding-bottom:84px!important}';
  document.head.appendChild(st);
  var arabicFs = parseFloat(Settings.get('arabicFs', '28')) || 28;
  function applyFs(){ document.documentElement.style.setProperty('--arabic-fs', arabicFs + 'px'); Settings.set('arabicFs', String(arabicFs)); }
  window.adjustArabicFont = function(d){ arabicFs = d === 0 ? 28 : Math.max(16, Math.min(52, arabicFs + d * 2)); applyFs(); };
  applyFs();

  // insert A-/A+ buttons above the reciter bar
  function insertFsBtns(){
    var bar = document.querySelector('#tab-quran .reciter-bar');
    if(!bar || document.getElementById('mpFsWrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'mpFsWrap';
    wrap.style.cssText = 'display:flex;gap:0.5rem;align-items:center;margin-bottom:0.7rem;flex-wrap:wrap';
    wrap.innerHTML = '<span style="color:var(--muted);font-size:0.8rem">\u{1F4D6} Arabic size:</span>'
      + '<button class="mp-fs-btn" onclick="adjustArabicFont(-1)">A\u2212</button>'
      + '<button class="mp-fs-btn" onclick="adjustArabicFont(1)">A+</button>'
      + '<button class="mp-fs-btn" onclick="adjustArabicFont(0)" style="font-size:0.8rem">Reset</button>';
    bar.parentNode.insertBefore(wrap, bar);
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', insertFsBtns); } else { insertFsBtns(); }

  // On mobile, scroll to the reader when a surah is tapped
  var sList = document.getElementById('surahList');
  if(sList){
    sList.addEventListener('click', function(){
      if(window.innerWidth < 800){
        setTimeout(function(){
          var r = document.getElementById('quranReader');
          if(r && r.getBoundingClientRect().top < 0){ r.scrollIntoView({ behavior: 'smooth' }); }
        }, 600);
      }
    });
  }
})();
scheduleJournalReminder();
(function(){
  var h=location.hash;
  if(h==='#journal'||h==='#journal-reminder'){
    var btn=document.querySelector('.tab-btn[onclick*="showTab(\'journal\'"]');
    if(btn)showTab('journal',btn);
    if(h==='#journal-reminder')showJournalPane('reminder',null);
  }
})();
