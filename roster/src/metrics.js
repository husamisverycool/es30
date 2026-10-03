// ---------------------------------------------------------------------------
// Research metrics — computed straight from the chat log, nothing
// self-reported. Thresholds come from the Assignment 2a plan:
//   contribution in pset cycle 1: success >= 35%, kill < 15%
//   cycle-2 student messages as a share of cycle 1: success >= 50%, kill < 25%
//   corrections per AI recap: success >= 1
//   unprompted shares (links, files, photos): success >= 3 a week
// The organizer is excluded from every numerator and denominator.
// ---------------------------------------------------------------------------
const Metrics = (() => {
  const URL_RE = /\bhttps?:\/\/\S+|\b(?:docs\.google|drive\.google|overleaf|notion\.so|canvas\.harvard|edstem)\S*/i;
  const isShare = (m) => m.kind === "photo" || (m.attachments && m.attachments.length > 0) || URL_RE.test(m.text || "");
  const verdict = (v, ok, kill) => (v == null ? "pending" : v >= ok ? "success" : v < kill ? "kill" : "revise");

  function compute({ courseId, members, messages, fixes, recaps, cycles, organizerIds, now, checks, stuck, notes }) {
    const org = new Set(organizerIds || []);
    const t = now || Date.now();
    const students = members.filter((m) => !org.has(m.id) && m.courses && m.courses[courseId]);

    // Every contribution event: who, when, what.
    const events = [];
    for (const m of messages) {
      if (!m.by || org.has(m.by) || m.kind === "system" || m.kind === "recap" || m.kind === "announce" || m.deleted) continue;
      events.push({ by: m.by, ts: m.ts, type: m.replyTo ? "reply" : "post", msg: m });
    }
    for (const m of messages) {
      for (const [emoji, who] of Object.entries(m.reactions || {})) {
        for (const [uid, ts] of Object.entries(who || {})) {
          if (ts && !org.has(uid)) events.push({ by: uid, ts, type: "react", emoji });
        }
      }
      // Poll votes and study-session RSVPs are one-tap responses, like a reaction.
      for (const [uid, v] of Object.entries((m.poll && m.poll.votes) || {})) {
        if (v && v.o && !org.has(uid)) events.push({ by: uid, ts: v.t || m.ts, type: "vote" });
      }
      for (const [uid, v] of Object.entries((m.event && m.event.rsvps) || {})) {
        if (v && v.s && !org.has(uid)) events.push({ by: uid, ts: v.t || m.ts, type: "rsvp" });
      }
    }
    for (const f of fixes) {
      if (!org.has(f.by)) events.push({ by: f.by, ts: f.ts, type: "fix" });
      for (const [uid, ts] of Object.entries(f.votes || {})) if (ts && !org.has(uid)) events.push({ by: uid, ts, type: "agree" });
      for (const [uid, ts] of Object.entries(f.nays || {})) if (ts && !org.has(uid)) events.push({ by: uid, ts, type: "agree" });
    }
    // A "looks right" on a recap line is the same act as a 👍 on a summary in GroupMe.
    for (const c of checks || []) if (!org.has(c.by)) events.push({ by: c.by, ts: c.ts, type: "check" });
    for (const st of stuck || []) if (!org.has(st.by)) events.push({ by: st.by, ts: st.ts, type: "stuck" });
    for (const n of notes || []) if (!org.has(n.by)) {
      events.push({ by: n.by, ts: n.ts, type: "note", msg: { kind: "note", text: n.link || "", attachments: [{}] } });
      for (const [uid, ts] of Object.entries(n.helpful || {})) if (ts && !org.has(uid)) events.push({ by: uid, ts, type: "check" });
    }

    const cyc = (cycles || []).map((c) => {
      const placed = students.filter((s) => (s.courses[courseId] || Infinity) < c.end);
      const placedIds = new Set(placed.map((s) => s.id));
      const inWin = events.filter((e) => e.ts >= c.start && e.ts < c.end && placedIds.has(e.by));
      const contributors = new Set(inWin.map((e) => e.by));
      // Stricter reading: only people who wrote something (post, reply, fix, notes).
      const writers = new Set(inWin.filter((e) => e.type === "post" || e.type === "reply" || e.type === "fix" || e.type === "note").map((e) => e.by));
      const posts = inWin.filter((e) => e.type === "post" || e.type === "reply");
      const sharesIn = inWin.filter((e) => (e.type === "post" || e.type === "reply" || e.type === "note") && isShare(e.msg));
      const perPoster = new Map();
      for (const e of posts) perPoster.set(e.by, (perPoster.get(e.by) || 0) + 1);
      const ranked = [...perPoster.values()].sort((a, b) => b - a);
      const top3 = ranked.slice(0, 3).reduce((a, b) => a + b, 0);
      const readers = new Set();
      for (const s of placed) {
        const v = (s.visits && s.visits[courseId]) || {};
        if (Object.values(v).some((ts) => ts >= c.start && ts < c.end)) readers.add(s.id);
      }
      const lurkers = [...readers].filter((id) => !contributors.has(id)).length;
      const opened = new Set([...readers, ...contributors]).size;
      const byType = { post: 0, reply: 0, react: 0, fix: 0, agree: 0, vote: 0, rsvp: 0, check: 0, stuck: 0, note: 0 };
      for (const e of inWin) byType[e.type]++;
      const started = t >= c.start;
      const finished = t >= c.end;
      const rate = placed.length ? contributors.size / placed.length : null;
      return {
        ...c,
        started,
        finished,
        placed: placed.length,
        contributors: contributors.size,
        rate: started ? rate : null,
        writers: writers.size,
        writerRate: started && placed.length ? writers.size / placed.length : null,
        studentMsgs: posts.length,
        posters: perPoster.size,
        top3Share: posts.length ? top3 / posts.length : null,
        readers: readers.size,
        opened,
        lurkers,
        byType,
        shares: sharesIn.length,
        light: byType.react + byType.vote + byType.rsvp + byType.check + byType.stuck + byType.agree,
      };
    });

    const c1 = cyc[0], c2 = cyc[1];
    const retention = c1 && c2 && c2.started && c1.studentMsgs ? c2.studentMsgs / c1.studentMsgs : null;

    const recapRows = (recaps || []).map((r) => ({
      id: r.id,
      title: r.title,
      lecture: r.lecture,
      ts: r.ts,
      fixes: fixes.filter((f) => f.recapId === r.id && !org.has(f.by)).length,
      agrees: fixes
        .filter((f) => f.recapId === r.id)
        .reduce((n, f) => n + Object.values(f.votes || {}).filter(Boolean).length, 0),
    }));

    const allShares = [...messages.filter((m) => m.by && !org.has(m.by) && !m.deleted && m.kind !== "system" && isShare(m)), ...(notes || []).filter((n) => !org.has(n.by))];
    const firstStart = cyc.length ? cyc[0].start : null;
    const weeks = firstStart ? Math.max(1, (Math.min(t, cyc[cyc.length - 1].end) - firstStart) / (7 * 864e5)) : 1;

    return {
      placed: students.length,
      cycles: cyc,
      retention,
      recaps: recapRows,
      sharesPerWeek: allShares.length / weeks,
      verdicts: {
        contribution: verdict(c1 && c1.started ? c1.rate : null, 0.35, 0.15),
        retention: verdict(retention, 0.5, 0.25),
        corrections: recapRows.length ? (recapRows.every((r) => r.fixes >= 1) ? "success" : recapRows.some((r) => r.fixes >= 1) ? "revise" : "kill") : "pending",
        shares: allShares.length ? (allShares.length / weeks >= 3 ? "success" : "revise") : "pending",
      },
      cycleFinal: { c1: c1 && c1.finished, c2: c2 && c2.finished },
    };
  }

  // A pseudonymous log for the write-up: no names, no message text.
  function csv({ courseId, members, messages, fixes, cycles, organizerIds, checks, stuck, notes }) {
    const org = new Set(organizerIds || []);
    const alias = new Map();
    const nameOf = (uid) => {
      if (org.has(uid)) return "ORGANIZER";
      if (!alias.has(uid)) alias.set(uid, "S" + String(alias.size + 1).padStart(3, "0"));
      return alias.get(uid);
    };
    members.filter((m) => m.courses && m.courses[courseId]).forEach((m) => nameOf(m.id));
    const cycleOf = (ts) => {
      const c = (cycles || []).find((c) => ts >= c.start && ts < c.end);
      return c ? c.label : "";
    };
    const rows = [["timestamp_iso", "cycle", "member", "event", "thread", "chars", "has_link_or_file", "target_id"]];
    const push = (ts, who, ev, thread, chars, share, reply) =>
      rows.push([new Date(ts).toISOString(), cycleOf(ts), nameOf(who), ev, thread || "", chars, share ? 1 : 0, reply || ""]);
    for (const m of messages) {
      if (m.deleted || !m.by) continue;
      const kind = m.kind === "recap" ? "recap" : m.kind === "announce" ? "announce" : m.kind === "poll" ? "poll" : m.kind === "event" ? "study_session" : m.kind === "photo" ? "photo" : m.replyTo ? "reply" : "post";
      if (m.kind !== "system") push(m.ts, m.by, kind, m.thread, (m.text || "").length, isShare(m), typeof m.replyTo === "string" ? m.replyTo : m.replyTo ? m.replyTo.id : "");
      for (const [emoji, who] of Object.entries(m.reactions || {}))
        for (const [uid, ts] of Object.entries(who || {})) if (ts) push(ts, uid, "react " + emoji, m.thread, 0, false, m.id);
      for (const [uid, v] of Object.entries((m.poll && m.poll.votes) || {})) if (v && v.o) push(v.t || m.ts, uid, "vote", m.thread, 0, false, m.id);
      for (const [uid, v] of Object.entries((m.event && m.event.rsvps) || {})) if (v && v.s) push(v.t || m.ts, uid, "rsvp " + v.s, m.thread, 0, false, m.id);
    }
    for (const f of fixes) {
      push(f.ts, f.by, "correction", "recap", (f.text || "").length, false, f.recapId);
      for (const [uid, ts] of Object.entries(f.votes || {})) if (ts) push(ts, uid, "agree", "recap", 0, false, f.id);
      for (const [uid, ts] of Object.entries(f.nays || {})) if (ts) push(ts, uid, "disagree", "recap", 0, false, f.id);
    }
    for (const c of checks || []) push(c.ts, c.by, "check_line", "recap", 0, false, c.recapId);
    for (const st of stuck || []) push(st.ts, st.by, "stuck", st.thread, 0, false, st.problem);
    for (const n of notes || []) {
      push(n.ts, n.by, "notes", "notes", (n.body || "").length, true, "");
      for (const [uid, ts] of Object.entries(n.helpful || {})) if (ts) push(ts, uid, "helpful", "notes", 0, false, n.id);
    }
    // One "open" per person per day, so readers who never post still show up.
    for (const m of members) for (const ts of Object.values((m.visits && m.visits[courseId]) || {})) if (ts && m.courses && m.courses[courseId]) push(ts, m.id, "open", "", 0, false, "");
    const header = rows.shift();
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    rows.unshift(header);
    return rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(",")).join("\n");
  }

  return { compute, csv, isShare };
})();
