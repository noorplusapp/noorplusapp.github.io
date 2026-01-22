// App behaviors: dynamic page loader and bottom nav interactions
(function(){
	function setActive(button){
		document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(b){
			b.classList.remove('active');
			if(b.querySelector('i')) b.querySelector('i').classList.remove('text-white');
		});
		if(button){
			button.classList.add('active');
			var icon = button.querySelector('i');
			if(icon && button.classList.contains('home-btn')) icon.classList.add('text-white');
		}
	}

	function loadPage(url){
		var content = document.getElementById('content');
		if(!content) return;
		content.innerHTML = '<p class="text-center text-muted">Loading…</p>';
		fetch(url, {cache: 'no-store'}).then(function(r){
			if(!r.ok) throw new Error('Network response was not ok');
			return r.text();
		}).then(function(html){
			content.innerHTML = html;
			window.scrollTo(0,0);
		}).catch(function(){
			content.innerHTML = '<p class="text-center text-danger">Could not load content.</p>';
		});
	}

	document.addEventListener('DOMContentLoaded', function(){
		// attach nav buttons
		document.querySelectorAll('.bottom-nav .nav-btn').forEach(function(btn){
			btn.addEventListener('click', function(e){
				var page = btn.getAttribute('data-page');
				if(page){
					loadPage(page);
					setActive(btn);
				}
			});
		});

		// brand click loads home
		var brand = document.querySelector('.brand');
		if(brand) brand.addEventListener('click', function(e){
			e.preventDefault();
			var btn = document.querySelector('#homeBtn');
			if(btn) btn.click();
		});

		// initial load: home
		var homeBtn = document.querySelector('#homeBtn');
		if(homeBtn){ homeBtn.click(); }
	});
})();
