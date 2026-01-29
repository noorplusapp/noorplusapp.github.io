class App {
    constructor() {
        this.contentArea = document.getElementById('app-content');
        this.navItems = document.querySelectorAll('.nav-item');
        this.currentPage = '';
        this.prayerTimes = null;

        this.init();
    }

    init() {
        // Handle Navigation Clicks
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.loadPage(page);
            });
        });

        // Initialize Prayer Times Engine
        this.initPrayerTimes();

        // Load default page (Home)
        this.loadPage('home');
    }

    async loadPage(page) {
        if (this.currentPage === page) return;

        // Update Nav UI
        this.navItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

        // Show Loading
        this.contentArea.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

        try {
            const response = await fetch(`pages/${page}.html`);
            const html = await response.text();
            this.contentArea.innerHTML = html;
            this.currentPage = page;

            // Page Specific Logic
            if (page === 'home') {
                this.updateHomeUI();
            }

        } catch (error) {
            console.error('Error loading page:', error);
            this.contentArea.innerHTML = '<p>Error loading content.</p>';
        }
    }

    initPrayerTimes() {
        // Coordinates for Mecca (Default fallback) or user location
        // For now, let's use a fixed location or generic calculation
        // In a real app, we'd ask for Geolocation.
        // Using approximate coordinates for now (e.g., London).
        const coords = { latitude: 51.5074, longitude: -0.1278 };

        this.prayerTimes = PrayerTimes.calculate({
            latitude: coords.latitude,
            longitude: coords.longitude,
            method: 'MWL', // Muslim World League
            hanafi: false // Default to Standard (Shafi/Maliki/Hanbali)
        });

        console.log('Prayer Times Calculated:', this.prayerTimes);
    }

    updateHomeUI() {
        if (!this.prayerTimes) return;

        // Update Date
        const dateEl = document.querySelector('.hijri-date');
        const now = new Date();
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Format Helper
        const formatTime = (date) => {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        // Update Prayer List
        const prayers = {
            fajr: this.prayerTimes.Fajr,
            dhuhr: this.prayerTimes.Dhuhr,
            asr: this.prayerTimes.Asr,
            maghrib: this.prayerTimes.Maghrib,
            isha: this.prayerTimes.Isha
        };

        for (const [key, time] of Object.entries(prayers)) {
            const el = document.querySelector(`#prayer-${key} .prayer-time`);
            if (el) el.textContent = formatTime(time);
        }

        // Determine Next Prayer
        this.updateNextPrayer(prayers);
    }

    updateNextPrayer(prayers) {
        const now = new Date();
        let nextPrayerName = 'Fajr';
        let nextPrayerTime = prayers.fajr;
        let minDiff = Infinity;

        // Find the next prayer
        // This is a simplified check. Real app needs to handle "next day Fajr" if Isha passed.
        for (const [name, time] of Object.entries(prayers)) {
            if (time > now) {
                const diff = time - now;
                if (diff < minDiff) {
                    minDiff = diff;
                    nextPrayerName = name.charAt(0).toUpperCase() + name.slice(1);
                    nextPrayerTime = time;
                }
            }
        }

        // If all prayers passed today, next is Fajr tomorrow
        if (now > prayers.isha) {
            nextPrayerName = 'Fajr';
            // We would re-calculate for tomorrow in a robust engine
            // For UI demo, just show "Tomorrow"
            nextPrayerTime = new Date(prayers.fajr.getTime() + 24 * 60 * 60 * 1000);
        }

        const nameEl = document.querySelector('.next-name');
        const timeEl = document.querySelector('.next-time');
        const countEl = document.querySelector('.time-left');

        if (nameEl) nameEl.textContent = nextPrayerName;
        if (timeEl) timeEl.textContent = nextPrayerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Countdown Timer
        const updateTimer = () => {
            const nowTick = new Date();
            const diff = nextPrayerTime - nowTick;

            if (diff <= 0) {
                // Timer finished, refresh UI
                this.updateHomeUI();
                return;
            }

            const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (countEl) countEl.textContent = `-${hrs}h ${mins}m ${secs}s`;
        };

        // Clear previous interval if any
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(updateTimer, 1000);
        updateTimer(); // Initial call
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
