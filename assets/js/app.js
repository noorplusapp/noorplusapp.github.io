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
        // Load Config from LocalStorage if exists
        const saved = localStorage.getItem('prayerConfig');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge carefully
                Object.assign(CONFIG, parsed);
            } catch (e) {
                console.error("Error parsing saved config", e);
            }
        }

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
            } else if (page === 'settings') {
                this.initSettings();
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
       SETTINGS LOGIC
    ========================= */
    initSettings() {
        // Populate Form
        const safeVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const safeCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };

        safeVal('latitude', CONFIG.latitude);
        safeVal('longitude', CONFIG.longitude);
        safeVal('calc-method', CONFIG.method);
        safeCheck('juristics', CONFIG.hanafi);

        safeVal('adj-fajr', CONFIG.offsets.Fajr || 0);
        safeVal('adj-dhuhr', CONFIG.offsets.Dhuhr || 0);
        safeVal('adj-asr', CONFIG.offsets.Asr || 0);
        safeVal('adj-maghrib', CONFIG.offsets.Maghrib || 0);
        safeVal('adj-isha', CONFIG.offsets.Isha || 0);

        // Handle Save
        const form = document.getElementById('settings-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                // Update Config
                CONFIG.latitude = parseFloat(document.getElementById('latitude').value);
                CONFIG.longitude = parseFloat(document.getElementById('longitude').value);
                CONFIG.method = document.getElementById('calc-method').value;
                CONFIG.hanafi = document.getElementById('juristics').checked;

                CONFIG.offsets = {
                    Fajr: parseInt(document.getElementById('adj-fajr').value) || 0,
                    Dhuhr: parseInt(document.getElementById('adj-dhuhr').value) || 0,
                    Asr: parseInt(document.getElementById('adj-asr').value) || 0,
                    Maghrib: parseInt(document.getElementById('adj-maghrib').value) || 0,
                    Isha: parseInt(document.getElementById('adj-isha').value) || 0,
                };

                // Save to LocalStorage
                localStorage.setItem('prayerConfig', JSON.stringify(CONFIG));

                alert('Settings Saved!');
            });
        }
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
        let state = 0; // 0: Today, 1: English, 2: Hijri
        const todayEl = document.getElementById('date-today');
        const enEl = document.getElementById('date-en');
        const hijriEl = document.getElementById('date-hijri');

        if (!todayEl || !enEl || !hijriEl) return;

        // Function to update visibility
        const updateVisibility = () => {
            todayEl.classList.remove('active');
            enEl.classList.remove('active');
            hijriEl.classList.remove('active');

            if (state === 0) todayEl.classList.add('active');
            else if (state === 1) enEl.classList.add('active');
            else if (state === 2) hijriEl.classList.add('active');
        };

        // Initial Set
        updateVisibility();

        this.dateToggleInterval = setInterval(() => {
            state = (state + 1) % 3; // Cycle 0 -> 1 -> 2 -> 0
            updateVisibility();
        }, 3000); // Cycle every 3 seconds (faster for 3 items)
    }

    startLiveTimer() {
        this.timerInterval = setInterval(() => {
            // Re-run render logic to update countdown/progress
            // Only if on home page
            if (this.currentPage === 'home') {
                // Pass currentDate to updateDashboard, but dashboard logic will also use System Time
                let navigatedDate = this.currentDate;
                const times = PrayerTimes.calculate({
                    latitude: CONFIG.latitude,
                    longitude: CONFIG.longitude,
                    date: navigatedDate,
                    method: CONFIG.method,
                    hanafi: CONFIG.hanafi,
                    offsets: CONFIG.offsets,
                });
                this.updateDashboard(navigatedDate, times);
            }
        }, 1000);
    }

    renderHome(date) {
        // Calculate Times
        const times = PrayerTimes.calculate({
            latitude: CONFIG.latitude,
            longitude: CONFIG.longitude,
            date: date, // Navigated Date
            method: CONFIG.method,
            hanafi: CONFIG.hanafi,
            offsets: CONFIG.offsets,
        });

        // Use new buildPrayerRanges
        const ranges = buildPrayerRanges(times);

        // Helper to format Range {start, end} to string "HH:MM am - HH:MM pm"
        const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const formatRange = (range) => `${fmt(range.start)} – ${fmt(range.end)}`;

        // List View - Populate manually since buildPrayerSchedule is gone
        this.setText("fajr", formatRange(ranges.Fajr));
        this.setText("dhuhr", formatRange(ranges.Dhuhr));
        this.setText("asr", formatRange(ranges.Asr));
        this.setText("maghrib", formatRange(ranges.Maghrib));
        this.setText("isha", formatRange(ranges.Isha));
        this.setText("tahajjud", formatRange(ranges.Tahajjud));

        // Update Dashboard (Live Status)
        this.updateDashboard(date, times);
    }

    updateDashboard(date, navigatedTimes) {
        // --- 1. Update List Headers (Navigated Date) ---
        this.setText("date-en", date.toLocaleDateString("en-GB", { weekday: 'short', day: "2-digit", month: "long", year: "numeric" }));
        this.setText("date-hijri", new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(date));

        // Sunrise/Sunset for the VIEWED DAY (from List)
        const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        this.setText("sunrise-time", fmt(navigatedTimes.Sunrise));
        this.setText("sunset-time", fmt(navigatedTimes.Maghrib));

        // --- 2. Live Status (System Time) ---
        const now = new Date();
        const liveTimes = PrayerTimes.calculate({
            latitude: CONFIG.latitude,
            longitude: CONFIG.longitude,
            date: now,
            method: CONFIG.method,
            hanafi: CONFIG.hanafi,
            offsets: CONFIG.offsets,
        });

        // Use new getCurrentPrayerState API
        const state = getCurrentPrayerState(liveTimes, now);

        let currentName = "--";
        let currentTimeDisplay = "--:--";
        let nextName = "--";
        let nextTimeDisplay = "--:--";
        let remainingMs = 0;
        let totalDuration = 1000 * 60 * 60; // default 1hr avoid div by 0

        if (state.state === 'FORBIDDEN') {
            currentName = `Forbidden (${state.reason})`;
            // Show remaining time until forbidden ends
            currentTimeDisplay = "Ends " + fmt(new Date(now.getTime() + state.remainingMs));
            remainingMs = state.remainingMs;

            // Heuristic for total duration: 15 mins for sunrise/sunset, ~10 for zawal.
            // We just let it fill down.
            totalDuration = 1000 * 60 * 15;

            // Next Prayer? If After Sunrise -> Dhuhr. If Zawal -> Dhuhr. If Before Sunset -> Maghrib.
            // Simplified:
            if (state.reason === 'After Sunrise') { nextName = 'Dhuhr'; nextTimeDisplay = fmt(liveTimes.Dhuhr); }
            else if (state.reason === 'Zawal') { nextName = 'Dhuhr'; nextTimeDisplay = fmt(liveTimes.Dhuhr); }
            else if (state.reason === 'Before Sunset') { nextName = 'Maghrib'; nextTimeDisplay = fmt(liveTimes.Maghrib); }

        } else if (state.state === 'PRAYER') {
            currentName = state.prayer;
            // Show Start Time of current prayer
            const ranges = buildPrayerRanges(liveTimes);
            const currentRange = ranges[state.prayer];

            if (currentRange) {
                currentTimeDisplay = fmt(currentRange.start);
                remainingMs = state.remainingMs; // Time until END of prayer
                totalDuration = currentRange.end.getTime() - currentRange.start.getTime();
            }

            // Determine Next Prayer
            const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const idx = order.indexOf(state.prayer);
            if (idx > -1 && idx < order.length - 1) {
                const nextP = order[idx + 1];
                nextName = nextP;
                nextTimeDisplay = fmt(ranges[nextP].start);
            } else if (state.prayer === 'Isha') {
                nextName = 'Fajr';
                // Need tomorrow's Fajr
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const nextDayTimes = PrayerTimes.calculate({
                    latitude: CONFIG.latitude,
                    longitude: CONFIG.longitude,
                    date: tomorrow,
                    method: CONFIG.method,
                    hanafi: CONFIG.hanafi,
                    offsets: CONFIG.offsets,
                });
                nextTimeDisplay = fmt(nextDayTimes.Fajr);
            }
        } else {
            // Neutral State (e.g. after Sunrise/Ishraq before Dhuhr)
            currentName = "Waiting";
            currentTimeDisplay = "--";

            // Find next prayer logic
            if (now < liveTimes.Dhuhr && now > liveTimes.Sunrise) {
                nextName = "Dhuhr";
                nextTimeDisplay = fmt(liveTimes.Dhuhr);
                remainingMs = liveTimes.Dhuhr - now;
                totalDuration = liveTimes.Dhuhr - liveTimes.Sunrise;
            } else if (now > liveTimes.Isha || now < liveTimes.Fajr) {
                // Late night / Early Morning
                nextName = "Fajr";

                let fajrTime = liveTimes.Fajr;
                // If now > fajr (and still neutral? impossible if prayer covers range).
                // If now < fajr, then fajr is today.
                // If now > isha, fajr is tomorrow.
                if (now > liveTimes.Isha) {
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const nextDayTimes = PrayerTimes.calculate({
                        latitude: CONFIG.latitude, longitude: CONFIG.longitude, date: tomorrow, method: CONFIG.method, hanafi: CONFIG.hanafi, offsets: CONFIG.offsets
                    });
                    fajrTime = nextDayTimes.Fajr;
                }
                nextTimeDisplay = fmt(fajrTime);
                remainingMs = fajrTime - now;
                // Total duration? From Isha end to Fajr start? ~ 1/3 night
                // For circle, we can just use an arbitrary max or 4 hours
                totalDuration = 1000 * 60 * 60 * 4;
            }
        }

        this.setText("current-prayer-name", currentName);
        this.setText("current-prayer-time", currentTimeDisplay);
        this.setText("next-prayer-name", nextName);
        this.setText("next-prayer-time", nextTimeDisplay);

        // --- 3. Countdown Circle ---
        let ratio = remainingMs / totalDuration;
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;
        if (isNaN(ratio)) ratio = 0;

        const circle = document.getElementById('countdown-progress');
        const circumference = 2 * Math.PI * 45;
        if (circle) {
            // We want it to "empty" as time goes on.
            const offset = circumference * (1 - ratio);
            circle.style.strokeDashoffset = offset;
        }

        // Timer Text
        if (remainingMs < 0) remainingMs = 0;
        const hrs = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);

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
