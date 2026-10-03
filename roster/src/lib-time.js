// ---------------------------------------------------------------------------
// Schedules and time, all in Cambridge time (America/New_York).
// Meeting strings look like my.harvard's: "Tu Th 1:30–2:45 PM", "MWF 10:30-11:45 AM".
// A meeting is {d: [weekday...], s: minutes, e: minutes, where, kind}.
// ---------------------------------------------------------------------------
const Sched = (() => {
  const TZ = "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function et(ts) {
    const p = {};
    for (const { type, value } of parts.formatToParts(ts)) p[type] = value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: WD[p.weekday], key: p.year + "-" + p.month + "-" + p.day };
  }
  // Epoch for a Cambridge wall-clock time.
  function at(y, mo, d, minutes) {
    const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
    const p = et(guess);
    const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    return guess - (asUTC - guess);
  }
  const startOfDay = (ts) => { const p = et(ts); return at(p.y, p.mo, p.d, 0); };
  const addDays = (ts, n) => { const p = et(ts + 12 * 3600e3); const b = Date.UTC(p.y, p.mo - 1, p.d) + n * 864e5; const q = new Date(b); return at(q.getUTCFullYear(), q.getUTCMonth() + 1, q.getUTCDate(), 0); };
  const startOfWeek = (ts) => { const p = et(ts); return addDays(startOfDay(ts), -((p.wd + 6) % 7)); }; // Monday

  const DAY_TOKENS = [["Su", 0], ["Th", 4], ["Tu", 2], ["Sa", 6], ["M", 1], ["T", 2], ["W", 3], ["R", 4], ["F", 5]];
  function parseDays(s) {
    const out = new Set();
    let rest = s.replace(/\s+/g, "").replace(/Mon/gi, "M").replace(/Tue/gi, "Tu").replace(/Wed/gi, "W").replace(/Thu/gi, "Th").replace(/Fri/gi, "F").replace(/Sat/gi, "Sa").replace(/Sun/gi, "Su");
    while (rest.length) {
      const hit = DAY_TOKENS.find(([t]) => rest.startsWith(t));
      if (!hit) return null;
      out.add(hit[1]);
      rest = rest.slice(hit[0].length);
    }
    return [...out].sort();
  }
  const toMin = (h, m, ap) => { let hh = +h % 12; if (/p/i.test(ap)) hh += 12; return hh * 60 + (+m || 0); };
  function parseMeets(str, where) {
    if (!str) return [];
    const m = String(str).match(/^\s*([A-Za-z ]+?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!m) return [];
    const d = parseDays(m[1]);
    if (!d || !d.length) return [];
    const endAp = m[7];
    let s = toMin(m[2], m[3], m[4] || endAp), e = toMin(m[5], m[6], endAp);
    if (!m[4] && s > e) s -= 12 * 60; // "10:30–11:45 AM"/"11:30–1:00 PM"
    return [{ d, s, e, where: where || "", kind: "lecture" }];
  }
  const DAY_SHORT = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
  const DAY_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtMin = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return ((h + 11) % 12 + 1) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " AM" : " PM"); };
  const fmtMeeting = (mt) => mt.d.map((x) => DAY_SHORT[x]).join(" ") + " " + fmtMin(mt.s).replace(/ (AM|PM)$/, "") + "–" + fmtMin(mt.e);

  // Every occurrence of a set of meetings between two instants.
  function occurrences(meetings, from, to) {
    const out = [];
    for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
      const p = et(day + 12 * 3600e3);
      for (const mt of meetings) {
        if (!mt.d.includes(p.wd)) continue;
        const start = at(p.y, p.mo, p.d, mt.s), end = at(p.y, p.mo, p.d, mt.e);
        if (end > from && start < to) out.push({ ...mt, start, end });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  // Calm → soon → today → urgent → due, per Flighty-style "smart states".
  function urgency(msLeft) {
    if (msLeft <= 0) return "past";
    if (msLeft < 3 * 3600e3) return "urgent";
    if (msLeft < 24 * 3600e3) return "today";
    if (msLeft < 3 * 864e5) return "soon";
    return "calm";
  }

  return { et, at, startOfDay, addDays, startOfWeek, parseMeets, parseDays, occurrences, urgency, fmtMin, fmtMeeting, DAY_NAME, DAY_SHORT };
})();
