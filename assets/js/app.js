// App behaviors: dynamic page loader, caching, bottom nav interactions, and API helpers
(function(){
	var fragmentCache = new Map();
	var apiCache = new Map();
	var API_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

	function setActive(button){
		document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(b){
			b.classList.remove('active');
		});
		if(button){
			button.classList.add('active');
		}
	}

	function insertContent(html, url){
		var content = document.getElementById('content');
		if(!content) return;
		// minimal reflow: replace innerHTML once
		content.innerHTML = html;
		window.scrollTo(0,0);
		// dispatch event so fragments can initialize
		document.dispatchEvent(new CustomEvent('fragmentLoaded', {detail:{url: url}}));
	}

	function loadPage(url){
		var content = document.getElementById('content');
		if(!content) return;
		insertContent('<div class="text-center text-muted py-4">Loading…</div>', url);

		if(fragmentCache.has(url)){
			// use cached fragment
			requestAnimationFrame(function(){ insertContent(fragmentCache.get(url), url); });
			return Promise.resolve(fragmentCache.get(url));
		}

		return fetch(url, {cache: 'no-store'})
			.then(function(r){ if(!r.ok) throw new Error('Network response was not ok'); return r.text(); })
			.then(function(html){ fragmentCache.set(url, html); insertContent(html, url); return html; })
			.catch(function(){ insertContent('<div class="text-center text-danger py-4">Could not load content.</div>', url); });
	}

	// Simple API helpers with caching
	function cacheGet(key){
		var entry = apiCache.get(key);
		if(!entry) return null;
		if(Date.now() - entry.t > API_CACHE_TTL){ apiCache.delete(key); return null; }
		return entry.v;
	}
	function cacheSet(key, value){ apiCache.set(key, {v:value, t:Date.now()}); }

	function fetchPrayerTimes(opts){
		// opts: {city, country, latitude, longitude}
		var key = 'prayer:' + (opts.city || '') + ':' + (opts.country || '') + ':' + (opts.latitude||'')+':' + (opts.longitude||'');
		var cached = cacheGet(key); if(cached) return Promise.resolve(cached);

		var url;
		if(opts.latitude && opts.longitude){
			url = 'https://api.aladhan.com/v1/timings?latitude=' + encodeURIComponent(opts.latitude) + '&longitude=' + encodeURIComponent(opts.longitude) + '&method=2';
		} else {
			var city = opts.city || 'Mecca';
			var country = opts.country || 'Saudi%20Arabia';
			url = 'https://api.aladhan.com/v1/timingsByCity?city=' + encodeURIComponent(city) + '&country=' + encodeURIComponent(country) + '&method=2';
		}

		return fetch(url).then(function(r){ if(!r.ok) throw new Error('Network'); return r.json(); }).then(function(d){
			if(d && d.data) { cacheSet(key, d.data); return d.data; }
			throw new Error('Invalid response');
		});
	}

	function fetchSurah(surah){
		var key = 'surah:' + surah;
		var cached = cacheGet(key); if(cached) return Promise.resolve(cached);
		var url = 'https://api.alquran.cloud/v1/surah/' + encodeURIComponent(surah);
		return fetch(url).then(function(r){ if(!r.ok) throw new Error('Network'); return r.json(); }).then(function(d){ if(d && d.data){ cacheSet(key, d.data); return d.data;} throw new Error('Invalid'); });
	}

	// render helpers for fragments
	function renderPrayerWidget(container){
		if(!container) return;
		container.innerHTML = '<div class="text-center text-muted">Loading prayer times…</div>';
		// try geolocation then fallback to default
		var opts = {};
		function doRender(data){
			var t = data.timings || data;
			var html = '<div class="card p-2">';
			html += '<div class="d-flex justify-content-between align-items-center"><strong>Prayer Times</strong><small class="text-muted">Today</small></div>';
			html += '<div class="mt-2 row small">';
			['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(function(k){ html += '<div class="col-6 mb-1"><strong>'+k+':</strong> '+(t[k]||'-')+'</div>'; });
			html += '</div></div>';
			container.innerHTML = html;
		}

		if(navigator.geolocation){
			var timedOut = false;
			var geoTimer = setTimeout(function(){ timedOut = true; fetchPrayerTimes({city:'Mecca',country:'Saudi Arabia'}).then(doRender).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; }); }, 2500);
			navigator.geolocation.getCurrentPosition(function(pos){ if(timedOut) return; clearTimeout(geoTimer); opts.latitude = pos.coords.latitude; opts.longitude = pos.coords.longitude; fetchPrayerTimes(opts).then(doRender).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; }); }, function(){ if(timedOut) return; clearTimeout(geoTimer); fetchPrayerTimes({city:'Mecca',country:'Saudi Arabia'}).then(doRender).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; }); }, {maximumAge:600000,timeout:4000});
		} else {
			fetchPrayerTimes({city:'Mecca',country:'Saudi Arabia'}).then(doRender).catch(function(){ container.innerHTML = '<div class="text-muted">Prayer times unavailable.</div>'; });
		}
	}

	// fragment loaded hook
	document.addEventListener('fragmentLoaded', function(e){
		var url = (e && e.detail && e.detail.url) || '';
		// if home page loaded, render prayer widget
		if(url.indexOf('home.html') !== -1){
			var p = document.getElementById('prayerTimes');
			if(p) renderPrayerWidget(p);
		}
		// if quran page, optionally prefetch first surah info
		if(url.indexOf('quran.html') !== -1){
			// quick prefetch of surah list (example using chapter 1)
			fetchSurah(1).then(function(d){
				var target = document.getElementById('quranPreview');
				if(target && d && d.ayahs){ target.innerHTML = '<p class="small text-muted">'+ (d.ayahs.slice(0,3).map(a=>a.text).join(' ')) + '</p>'; }
			}).catch(function(){});
		}
	});

	// attach nav buttons and initial load
	document.addEventListener('DOMContentLoaded', function(){
		document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(btn){
			btn.addEventListener('click', function(e){
				var page = btn.getAttribute('data-page');
				if(page){ loadPage(page); setActive(btn); }
			});
		});

		var brand = document.querySelector('.brand');
		if(brand) brand.addEventListener('click', function(e){ e.preventDefault(); var btn = document.querySelector('#homeBtn'); if(btn) btn.click(); });

		// initial load: home
		var homeBtn = document.querySelector('#homeBtn');
		if(homeBtn){ homeBtn.click(); }
	});

	// expose API helpers for debugging/extension
	window.NoorPlus = { fetchPrayerTimes: fetchPrayerTimes, fetchSurah: fetchSurah, _fragmentCache: fragmentCache, _apiCache: apiCache };

})();
