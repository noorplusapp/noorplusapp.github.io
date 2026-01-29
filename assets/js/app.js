/* =========================
   CONFIG (change if needed)
========================= */
const CONFIG = {
    latitude: 23.71,        // Dhaka
    longitude: 90.41,
    method: "Karachi",
    hanafi: true,
    offsets: {
        Dhuhr: 1,
        Maghrib: 1,
        Isha: 1,
    },
};

class App {
    constructor() {
        this.contentArea = document.getElementById('app-content');
        this.navItems = document.querySelectorAll('.nav-item');
        this.currentPage = '';
        this.currentDate = new Date(); // State for Home Page
        this.timerInterval = null;
        this.dateToggleInterval = null;

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

        // Load default page (Home)
        this.loadPage('home');
    }

    async loadPage(page) {
        if (this.currentPage === page) return;

        // Cleanup previous page intervals
        this.stopCheckers();

        // Update Nav UI
        this.navItems.forEach(item => item.classList.remove('active'));
        const navLink = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navLink) navLink.classList.add('active');

        // Show Loading
        this.contentArea.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

        try {
            const response = await fetch(`pages/${page}.html`);
            const html = await response.text();
            this.contentArea.innerHTML = html;
            this.currentPage = page;

            // Page Specific Logic
            if (page === 'home') {
                this.initHome();
            }

        } catch (error) {
            console.error('Error loading page:', error);
            this.contentArea.innerHTML = '<p>Error loading content.</p>';
        }
    }

    stopCheckers() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.dateToggleInterval) clearInterval(this.dateToggleInterval);
    }

    /* =========================
       HOME PAGE LOGIC
    ========================= */
    initHome() {
        this.renderHome(this.currentDate);

        // Bind Buttons
        const nextBtn = document.getElementById('nextDay');
        const prevBtn = document.getElementById('prevDay');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setDate(this.currentDate.getDate() + 1);
                this.renderHome(this.currentDate);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                this.renderHome(this.currentDate);
            });
        }

        // Setup Date Toggle (English / Hijri)
        this.setupDateToggle();

        // Start Live Timer for Countdown
        this.startLiveTimer();
    }

    setupDateToggle() {
        let showEnglish = true;
        const enEl = document.getElementById('date-en');
        const hijriEl = document.getElementById('date-hijri');

        if (!enEl || !hijriEl) return;

        this.dateToggleInterval = setInterval(() => {
            showEnglish = !showEnglish;
            if (showEnglish) {
                enEl.classList.add('active');
                hijriEl.classList.remove('active');
            } else {
                enEl.classList.remove('active');
                hijriEl.classList.add('active');
            }
        }, 5000); // Toggle every 5 seconds
    }

    startLiveTimer() {
        this.timerInterval = setInterval(() => {
            // Re-run render logic to update countdown/progress
            // Only if on home page
            if (this.currentPage === 'home') {
                this.updateDashboard(this.currentDate);
            }
        }, 1000);
    }

    renderHome(date) {
        // Render Prayers List
        const times = PrayerTimes.calculate({
            latitude: CONFIG.latitude,
            longitude: CONFIG.longitude,
            date: date,
            method: CONFIG.method,
            hanafi: CONFIG.hanafi,
            offsets: CONFIG.offsets,
        });

        const schedule = buildPrayerSchedule(times);

        // List View
        this.setText("fajr", schedule.prayers.Fajr);
        this.setText("dhuhr", schedule.prayers.Dhuhr);
        this.setText("asr", schedule.prayers.Asr);
        this.setText("maghrib", schedule.prayers.Maghrib);
        this.setText("isha", schedule.prayers.Isha);
        this.setText("tahajjud", schedule.prayers.Tahajjud);

        // Update Dashboard Data
        this.updateDashboard(date, times);
    }

    updateDashboard(date, cachedTimes) {
        // If cachedTimes is not provided (e.g. from interval), recalculate
        let times = cachedTimes;
        if (!times) {
            times = PrayerTimes.calculate({
                latitude: CONFIG.latitude,
                longitude: CONFIG.longitude,
                date: date,
                method: CONFIG.method,
                hanafi: CONFIG.hanafi,
                offsets: CONFIG.offsets,
            });
        }

        // 1. Update Dates
        this.setText("date-en", date.toLocaleDateString("en-GB", { weekday: 'short', day: "2-digit", month: "long", year: "numeric" }));
        // Mock Hijri for now (Real app would use Intl.DateTimeFormat with u-ca-islamic)
        this.setText("date-hijri", new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(date));

        // 2. Sunrise / Sunset
        const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        this.setText("sunrise-time", fmt(times.Sunrise));
        this.setText("sunset-time", fmt(times.Maghrib));

        // 3. Determine Current & Next Prayer
        const now = new Date();
        const prayerList = [
            { name: "Fajr", time: times.Fajr },
            { name: "Sunrise", time: times.Sunrise }, // Marker
            { name: "Dhuhr", time: times.Dhuhr },
            { name: "Asr", time: times.Asr },
            { name: "Maghrib", time: times.Maghrib },
            { name: "Isha", time: times.Isha }
        ];

        // Find next prayer (first one in future)
        let nextIdx = -1;
        for (let i = 0; i < prayerList.length; i++) {
            if (prayerList[i].time > now) {
                nextIdx = i;
                break;
            }
        }

        let currentP, nextP;

        if (nextIdx === -1) {
            // All passed today, Next is Fajr Tomorrow
            currentP = prayerList[prayerList.length - 1]; // Isha
            nextP = { name: "Fajr", time: new Date(times.Fajr.getTime() + 86400000) };
        } else if (nextIdx === 0) {
            // Before Fajr
            currentP = { name: "Isha", time: new Date(times.Isha.getTime() - 86400000) }; // Previous day Isha
            nextP = prayerList[0];
        } else {
            currentP = prayerList[nextIdx - 1];
            nextP = prayerList[nextIdx];
        }

        // Logic check: If existing "Sunrise" is the current 'prayer', we usually show Fajr as current 
        // until Dhuhr? Or show "Sunrise" as current phase?
        // User asked for "Current Prayer Name". 
        // Let's treat Sunrise as a phase but if it's the 'current', maybe display "Duha" or keep "Sunrise".
        // For simplicity, we stick to the list.

        this.setText("current-prayer-name", currentP.name);
        this.setText("current-prayer-time", fmt(currentP.time));
        this.setText("next-prayer-name", nextP.name);
        this.setText("next-prayer-time", fmt(nextP.time));

        // 4. Countdown Circle
        const totalDuration = nextP.time - currentP.time;
        const elapsed = now - currentP.time;
        const remaining = nextP.time - now;

        // Progress Ratio (0 to 1)
        // However, we want the circle to 'empty' as time passes, or 'fill'?
        // Usually "Remaining" means the circle shrinks.
        let ratio = remaining / totalDuration;
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;

        const circle = document.getElementById('countdown-progress');
        const circumference = 2 * Math.PI * 45; // r=45 -> ~283
        if (circle) {
            const offset = circumference * (1 - ratio);
            circle.style.strokeDashoffset = offset;
        }

        // Timer Text
        const hrs = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);

        const pad = (n) => n.toString().padStart(2, '0');
        this.setText("countdown-timer", `-${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    }

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
