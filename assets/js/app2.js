// NoorPlus improved app (app2.js)
(function(){
  var fragmentCache = new Map();
  var apiCache = new Map();
  var API_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  var STORAGE_KEY = 'noor_settings_v1';

  function setActive(button){
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(b){ b.classList.remove('active'); b.classList.remove('showing'); });
    if(button){ button.classList.add('active'); if(button.classList.contains('home-btn')) button.classList.add('showing'); }
    var hb = document.querySelector('.bottom-nav .home-btn'); if(hb){ hb.classList.toggle('active', hb.id === (button && button.id)); }
  }

  function insertContent(html, url){
    var content = document.getElementById('content'); if(!content) return;
    content.innerHTML = html;
    content.classList.remove('fade-in'); void content.offsetWidth; content.classList.add('fade-in');
    window.scrollTo(0,0);
    document.dispatchEvent(new CustomEvent('fragmentLoaded', {detail:{url: url}}));
  }

  function loadPage(url){
    var content = document.getElementById('content'); if(!content) return;
    insertContent('<div class="text-center text-muted py-4">Loading…</div>', url);
    if(fragmentCache.has(url)){ requestAnimationFrame(function(){ insertContent(fragmentCache.get(url), url); }); return Promise.resolve(fragmentCache.get(url)); }
    return fetch(url, {cache: 'no-store'}).then(function(r){ if(!r.ok) throw new Error('Network response was not ok'); return r.text(); }).then(function(html){ fragmentCache.set(url, html); insertContent(html, url); return html; }).catch(function(){ insertContent('<div class="text-center text-danger py-4">Could not load content.</div>', url); });
  }

  function cacheGet(key){ var entry = apiCache.get(key); if(!entry) return null; if(Date.now() - entry.t > API_CACHE_TTL){ apiCache.delete(key); return null; } return entry.v; }
  function cacheSet(key, value){ apiCache.set(key, {v:value, t:Date.now()}); }

  function formatTo12(timeStr){ if(!timeStr) return '-'; var m = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?/); if(!m) return timeStr; var hh = parseInt(m[1],10); var mm = m[2]; var am = hh < 12; var h = hh % 12; if(h === 0) h = 12; return h + ':' + mm + ' ' + (am ? 'AM' : 'PM'); }

  function determineMethodAndSchool(countryCode){ var c = (countryCode || '').toLowerCase(); var method = 2; var school = 0; var karachi = ['pk','bd','in']; var umm = ['sa']; var egypt = ['eg']; if(karachi.indexOf(c) !== -1) method = 1; else if(umm.indexOf(c) !== -1) method = 5; else if(egypt.indexOf(c) !== -1) method = 4; if(karachi.indexOf(c) !== -1) school = 1; return {method: method, school: school}; }

  function reverseGeocode(lat, lon){
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
    return fetch(url).then(function(r){ if(!r.ok) throw new Error('Geocode'); return r.json(); }).then(function(d){ var addr = d.address || {}; return {city: addr.city || addr.town || addr.village || addr.hamlet || addr.county || '', country: addr.country || '', countryCode: (addr.country_code||'').toLowerCase()}; }).catch(function(){ return {city:'',country:'',countryCode:''}; });
  }

  function saveSettings(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  function loadSettings(){ try{ var s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; }catch(e){return null;} }

  function fetchPrayerTimesForSettings(s){ var key = 'prayer:'+ (s.city||'') + ':' + (s.country||'') + ':' + (s.latitude||'') + ':' + (s.longitude||'') + ':' + (s.method||'') + ':' + (s.school||''); var cached = cacheGet(key); if(cached) return Promise.resolve(cached); var url = 'https://api.aladhan.com/v1/timings?latitude=' + encodeURIComponent(s.latitude) + '&longitude=' + encodeURIComponent(s.longitude) + '&method=' + encodeURIComponent(s.method || 2) + (s.school != null ? '&school=' + encodeURIComponent(s.school) : ''); return fetch(url).then(function(r){ if(!r.ok) throw new Error('Network'); return r.json(); }).then(function(d){ if(d && d.data){ cacheSet(key, d.data); return d.data; } throw new Error('Invalid'); }); }

  function collectAndSaveLocation(){
    return new Promise(function(resolve){
      var fallback = function(){ var s = {latitude:21.3891, longitude:39.8579, city:'Mecca', country:'Saudi Arabia', countryCode:'sa'}; var ms = determineMethodAndSchool(s.countryCode); s.method = ms.method; s.school = ms.school; s.savedAt = Date.now(); saveSettings(s); resolve(s); };
      if(!navigator.geolocation){ fallback(); return; }
      var timedOut = false; var geoTimer = setTimeout(function(){ timedOut = true; fallback(); }, 4500);
      navigator.geolocation.getCurrentPosition(function(pos){ if(timedOut) return; clearTimeout(geoTimer); var lat = pos.coords.latitude, lon = pos.coords.longitude; reverseGeocode(lat, lon).then(function(rc){ var ms = determineMethodAndSchool(rc.countryCode); var s = {latitude: lat, longitude: lon, city: rc.city || rc.country || '', country: rc.country || '', countryCode: rc.countryCode||'', method: ms.method, school: ms.school, savedAt: Date.now()}; saveSettings(s); resolve(s); }).catch(function(){ fallback(); }); }, function(){ if(timedOut) return; clearTimeout(geoTimer); fallback(); }, {maximumAge:600000, timeout:5000});
    });
  }

  function renderPrayerWidget(container){
    if(!container) return;
    container.innerHTML = '<div class="text-center text-muted">Loading prayer times…</div>';
    var settings = loadSettings();
    var prepare = settings ? Promise.resolve(settings) : collectAndSaveLocation();
    prepare.then(function(s){
      fetchPrayerTimesForSettings(s).then(function(data){
        var t = data.timings || data;
        var html = '<div class="card p-2">';
        html += '<div class="d-flex justify-content-between align-items-center"><div><strong>Prayer Times</strong><div class="small text-muted">'+ (s.city ? s.city + ' • ' + s.country : 'Location') +'</div></div><small class="text-muted">Today</small></div>';
        html += '<div class="mt-2 row small">';
        ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(function(k){ html += '<div class="col-6 mb-1"><strong>'+k+':</strong> '+ formatTo12(t[k]) +'</div>'; });
        html += '</div></div>';
        container.innerHTML = html;
      }).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; });
    }).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; });
  }

  document.addEventListener('fragmentLoaded', function(e){
    var url = (e && e.detail && e.detail.url) || '';
    if(url.indexOf('home.html') !== -1){ var p = document.getElementById('prayerTimes'); if(p) renderPrayerWidget(p); }
    if(url.indexOf('quran.html') !== -1){ fetchSurah(1).then(function(d){ var target = document.getElementById('quranPreview'); if(target && d && d.ayahs){ target.innerHTML = '<p class="small text-muted">'+ (d.ayahs.slice(0,3).map(function(a){ return a.text; }).join(' ')) + '</p>'; } }).catch(function(){}); }
    if(url.indexOf('menu.html') !== -1){ var s = loadSettings(); var loc = document.getElementById('settingsLocation'); var methodEl = document.getElementById('settingsMethod'); var schoolEl = document.getElementById('settingsSchool'); var btnRedetect = document.getElementById('btnRedetect'); var btnClear = document.getElementById('btnClear'); if(loc) loc.textContent = s ? (s.city ? s.city + ' • ' + s.country : (s.country||'Unknown')) : 'Not set'; if(methodEl) methodEl.textContent = s ? (s.method||'auto') : 'auto'; if(schoolEl) schoolEl.textContent = (s && s.school==1) ? 'Hanafi' : 'Standard'; if(btnRedetect) btnRedetect.addEventListener('click', function(){ btnRedetect.disabled = true; btnRedetect.textContent = 'Detecting…'; collectAndSaveLocation().then(function(ns){ if(loc) loc.textContent = ns.city ? ns.city + ' • ' + ns.country : ns.country; if(methodEl) methodEl.textContent = ns.method; if(schoolEl) schoolEl.textContent = ns.school==1 ? 'Hanafi' : 'Standard'; btnRedetect.disabled = false; btnRedetect.textContent = 'Redetect location'; }); }); if(btnClear) btnClear.addEventListener('click', function(){ localStorage.removeItem(STORAGE_KEY); if(loc) loc.textContent = 'Not set'; if(methodEl) methodEl.textContent = 'auto'; if(schoolEl) schoolEl.textContent = 'auto'; }); }
  });

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(btn){ btn.addEventListener('click', function(e){ var page = btn.getAttribute('data-page'); if(page){ loadPage(page); setActive(btn); } }); });
    var brand = document.querySelector('.brand'); if(brand) brand.addEventListener('click', function(e){ e.preventDefault(); var btn = document.querySelector('#homeBtn'); if(btn) btn.click(); });
    var homeBtn = document.querySelector('#homeBtn'); if(homeBtn){ homeBtn.click(); }
  });

  function fetchSurah(surah){ var key = 'surah:' + surah; var cached = cacheGet(key); if(cached) return Promise.resolve(cached); var url = 'https://api.alquran.cloud/v1/surah/' + encodeURIComponent(surah); return fetch(url).then(function(r){ if(!r.ok) throw new Error('Network'); return r.json(); }).then(function(d){ if(d && d.data){ cacheSet(key, d.data); return d.data;} throw new Error('Invalid'); }); }
  function cacheGet(key){ var entry = apiCache.get(key); if(!entry) return null; if(Date.now() - entry.t > API_CACHE_TTL){ apiCache.delete(key); return null; } return entry.v; }
  function cacheSet(key, value){ apiCache.set(key, {v:value, t:Date.now()}); }

  window.NoorPlus = { fetchPrayerTimesForSettings: fetchPrayerTimesForSettings, collectAndSaveLocation: collectAndSaveLocation, loadSettings: loadSettings };

})();
