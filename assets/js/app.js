/* =========================
   CONFIG (change if needed)
========================= */
const CONFIG = {
    latitude: 23.71,        // Dhaka
    longitude: 90.41,
    method: "Karachi",
    hanafi: true,
    offsets: {
        Dhuhr: 1, // Adjusted based on user config
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
    }

    renderHome(date) {
        // update date display
        this.setText("currentDate", date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));

        // Calculate Times
        const times = PrayerTimes.calculate({
            latitude: CONFIG.latitude,
            longitude: CONFIG.longitude,
            date: date,
            method: CONFIG.method,
            hanafi: CONFIG.hanafi,
            offsets: CONFIG.offsets,
        });

        const schedule = buildPrayerSchedule(times);

        // Render Prayers
        this.setText("fajr", schedule.prayers.Fajr);
        this.setText("dhuhr", schedule.prayers.Dhuhr);
        this.setText("asr", schedule.prayers.Asr);
        this.setText("maghrib", schedule.prayers.Maghrib);
        this.setText("isha", schedule.prayers.Isha);
        this.setText("tahajjud", schedule.prayers.Tahajjud);

        // Render Forbidden
        const forbiddenEl = document.getElementById("forbiddenTimes");
        if (forbiddenEl) {
            forbiddenEl.innerHTML = "";
            schedule.forbidden.forEach((f) => {
                const li = document.createElement("li");
                li.textContent = f;
                forbiddenEl.appendChild(li);
            });
        }
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
