/* =======================
   Utility helpers
======================= */
const addMinutes = (d, m) => new Date(d.getTime() + m * 60000);
const subMinutes = (d, m) => new Date(d.getTime() - m * 60000);

const format12 = (d) =>
    d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

/* =======================
   Prayer Times Engine
======================= */
class PrayerTimes {
    static METHODS = {
        MWL: { fajr: 18, isha: 17 },
        ISNA: { fajr: 15, isha: 15 },
        Egypt: { fajr: 19.5, isha: 17.5 },
        Karachi: { fajr: 18, isha: 18 },
        UmmAlQura: { fajr: 18.5, ishaInterval: 90 },
        Custom: { fajr: 18, isha: 18 },
    };

    static calculate({
        latitude,
        longitude,
        date = new Date(),
        method = "MWL",
        hanafi = true,
        offsets = {},
    }) {
        const cfg = this.METHODS[method] ?? this.METHODS.Custom;
        const tzMinutes = -date.getTimezoneOffset();

        let times = SolarTimes.calculate({
            latitude,
            longitude,
            date,
            tzMinutes,
            fajrAngle: -cfg.fajr,
            ishaAngle: cfg.isha ? -cfg.isha : null,
            hanafi,
        });

        // Umm al-Qura fixed Isha
        if (cfg.ishaInterval) {
            times.Isha = addMinutes(times.Maghrib, cfg.ishaInterval);
        }

        // Apply configurable offsets
        for (const k in offsets) {
            if (times[k]) times[k] = addMinutes(times[k], offsets[k]);
        }

        return times;
    }
}

/* =======================
   Solar Math (Core)
======================= */
class SolarTimes {
    static calculate({
        latitude,
        longitude,
        date,
        tzMinutes,
        fajrAngle,
        ishaAngle,
        hanafi,
    }) {
        const rad = (d) => (d * Math.PI) / 180;
        const deg = (r) => (r * 180) / Math.PI;
        const clamp = (x) => Math.max(-1, Math.min(1, x));

        const lat = rad(latitude);
        const utc = new Date(date.getTime() - tzMinutes * 60000);

        const y = utc.getUTCFullYear();
        const m = utc.getUTCMonth() + 1;
        const d =
            utc.getUTCDate() +
            (utc.getUTCHours() +
                utc.getUTCMinutes() / 60 +
                utc.getUTCSeconds() / 3600) /
            24;

        const a = Math.floor((14 - m) / 12);
        const y2 = y + 4800 - a;
        const m2 = m + 12 * a - 3;

        const jd =
            d +
            Math.floor((153 * m2 + 2) / 5) +
            365 * y2 +
            Math.floor(y2 / 4) -
            Math.floor(y2 / 100) +
            Math.floor(y2 / 400) -
            32045;

        const D = jd - 2451545;

        const g = rad((357.529 + 0.98560028 * D) % 360);
        const q = (280.459 + 0.98564736 * D) % 360;
        const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));

        const e = rad(23.439 - 0.00000036 * D);
        const decl = Math.asin(Math.sin(e) * Math.sin(L));

        const eqt =
            4 *
            deg(
                Math.tan(e / 2) ** 2 * Math.sin(2 * rad(q)) -
                2 * 0.0167 * Math.sin(g)
            );

        const noon = 12 + tzMinutes / 60 - longitude / 15 - eqt / 60;

        const toDate = (hours) => {
            let m = Math.round(hours * 60);
            m = ((m % 1440) + 1440) % 1440;
            return new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                Math.floor(m / 60),
                m % 60
            );
        };

        const timeAtAngle = (angle, after) => {
            const h = Math.acos(
                clamp(
                    (Math.sin(rad(angle)) -
                        Math.sin(lat) * Math.sin(decl)) /
                    (Math.cos(lat) * Math.cos(decl))
                )
            );
            return toDate(noon + (after ? deg(h) : -deg(h)) / 15);
        };

        // ✅ Correct Asr (shadow-based)
        const factor = hanafi ? 2 : 1;
        const asrH = Math.acos(
            clamp(
                (Math.sin(Math.atan(1 / (factor + Math.abs(Math.tan(lat - decl))))) -
                    Math.sin(lat) * Math.sin(decl)) /
                (Math.cos(lat) * Math.cos(decl))
            )
        );

        return {
            Fajr: timeAtAngle(fajrAngle, false),
            Sunrise: timeAtAngle(-0.833, false),
            Dhuhr: toDate(noon),
            Asr: toDate(noon + deg(asrH) / 15),
            Maghrib: timeAtAngle(-0.833, true),
            Isha: ishaAngle ? timeAtAngle(ishaAngle, true) : null,
        };
    }
}

/* =======================
   Prayer Ranges & Fiqh
======================= */
function buildPrayerSchedule(times) {
    const night =
        times.Fajr.getTime() + 86400000 - times.Maghrib.getTime();

    const midnight = new Date(times.Maghrib.getTime() + night / 2);
    const tahajjudStart = new Date(
        times.Maghrib.getTime() + (2 / 3) * night
    );

    const ranges = {
        Fajr: [times.Fajr, subMinutes(times.Sunrise, 1)],
        Dhuhr: [times.Dhuhr, subMinutes(times.Asr, 1)],
        Asr: [times.Asr, subMinutes(times.Maghrib, 15)],
        Maghrib: [times.Maghrib, subMinutes(times.Isha, 1)],
        Isha: [times.Isha, midnight],
        Tahajjud: [tahajjudStart, subMinutes(times.Fajr, 1)],
    };

    const forbidden = [
        ["After Sunrise", times.Sunrise, addMinutes(times.Sunrise, 15)],
        ["Zawal", subMinutes(times.Dhuhr, 6), times.Dhuhr],
        ["Before Sunset", subMinutes(times.Maghrib, 15), times.Maghrib],
    ];

    return {
        prayers: Object.fromEntries(
            Object.entries(ranges).map(([k, v]) => [
                k,
                `${format12(v[0])} – ${format12(v[1])}`,
            ])
        ),
        forbidden: forbidden.map(
            ([n, s, e]) => `${n}: ${format12(s)} – ${format12(e)}`
        ),
    };
}
