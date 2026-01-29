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

/* =========================
   STATE
========================= */
let currentDate = new Date();

/* =========================
   DOM HELPERS
========================= */
const $ = (id) => document.getElementById(id);

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

/* =========================
   RENDER FUNCTIONS
========================= */
function renderDate(date) {
    const options = { day: "2-digit", month: "short", year: "numeric" };
    setText("currentDate", date.toLocaleDateString("en-GB", options));
}

function renderPrayers(schedule) {
    // Prayer ranges
    setText("fajr", schedule.prayers.Fajr);
    setText("dhuhr", schedule.prayers.Dhuhr);
    setText("asr", schedule.prayers.Asr);
    setText("maghrib", schedule.prayers.Maghrib);
    setText("isha", schedule.prayers.Isha);
    setText("tahajjud", schedule.prayers.Tahajjud);

    // Forbidden times (list)
    const forbiddenEl = $("forbiddenTimes");
    if (forbiddenEl) {
        forbiddenEl.innerHTML = "";
        schedule.forbidden.forEach((f) => {
            const li = document.createElement("li");
            li.textContent = f;
            forbiddenEl.appendChild(li);
        });
    }
}

/* =========================
   MAIN RENDER
========================= */
function render(date) {
    renderDate(date);

    const times = PrayerTimes.calculate({
        latitude: CONFIG.latitude,
        longitude: CONFIG.longitude,
        date,
        method: CONFIG.method,
        hanafi: CONFIG.hanafi,
        offsets: CONFIG.offsets,
    });

    const schedule = buildPrayerSchedule(times);
    renderPrayers(schedule);
}

/* =========================
   NAVIGATION
========================= */
function nextDay() {
    currentDate.setDate(currentDate.getDate() + 1);
    render(currentDate);
}

function prevDay() {
    currentDate.setDate(currentDate.getDate() - 1);
    render(currentDate);
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
    // Button bindings (if present)
    if ($("nextDay")) $("nextDay").addEventListener("click", nextDay);
    if ($("prevDay")) $("prevDay").addEventListener("click", prevDay);

    // Initial render
    render(currentDate);
});
