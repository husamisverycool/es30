// ---------------------------------------------------------------------------
// Derived views over the class feeds — computed on the device, no AI:
// the Activity inbox, the "While you were away" digest, the weekly class
// story, and search. feeds: {courseId: [message…] ascending by ts}.
// ---------------------------------------------------------------------------
const Derive = (() => {
  const countReacts = (m) => Object.values(m.reactions || {}).reduce((n, who) => n + Object.values(who || {}).filter(Boolean).length, 0);
  const isChat = (m) => !m.deleted && !m.hidden && (m.kind === "text" || m.kind === "photo" || m.kind === "poll" || m.kind === "event");

  function inbox({ uid, feeds, fixes, recapsDone }) {
    const items = [];
    for (const [cid, feed] of Object.entries(feeds)) {
      const byId = {};
      for (const m of feed) byId[m.id] = m;
      for (const m of feed) {
        if (m.deleted || m.hidden) continue;
        if (m.by !== uid && (m.mentions || []).includes(uid)) items.push({ id: "men:" + cid + m.id, kind: "mention", cid, mid: m.id, ts: m.ts, actors: [m.by], text: m.text });
        if (m.by !== uid && m.replyTo && byId[m.replyTo] && byId[m.replyTo].by === uid) items.push({ id: "rep:" + cid + m.id, kind: "reply", cid, mid: m.id, ts: m.ts, actors: [m.by], text: m.text, quote: byId[m.replyTo].text });
        if (m.kind === "recap") items.push({ id: "rc:" + cid + m.id, kind: "recap", cid, mid: m.id, ts: m.ts, actors: [m.by], text: m.text, recapId: m.recapId, done: !!(recapsDone && recapsDone[m.recapId]) });
        if (m.kind === "announce") items.push({ id: "an:" + cid + m.id, kind: "announce", cid, mid: m.id, ts: m.ts, actors: [m.by], text: m.text });
        if (m.by === uid) {
          const reacts = [];
          for (const [e, who] of Object.entries(m.reactions || {})) for (const [id, t] of Object.entries(who || {})) if (t && id !== uid) reacts.push({ e, id, t });
          if (reacts.length) {
            reacts.sort((a, b) => b.t - a.t);
            items.push({ id: "rx:" + cid + m.id, kind: "reactions", cid, mid: m.id, ts: reacts[0].t, actors: [...new Set(reacts.map((r) => r.id))], emoji: [...new Set(reacts.map((r) => r.e))].slice(0, 3), text: m.text || (m.poll && m.poll.question) || (m.event && m.event.title) || "your photo" });
          }
          if (m.kind === "event" && m.event) {
            const going = Object.entries(m.event.rsvps || {}).filter(([id, v]) => id !== uid && v && v.s === "going").sort((a, b) => b[1].t - a[1].t);
            if (going.length) items.push({ id: "ev:" + cid + m.id, kind: "rsvp", cid, mid: m.id, ts: going[0][1].t, actors: going.map(([id]) => id), text: m.event.title });
          }
          if (m.kind === "poll" && m.poll) {
            const votes = Object.entries(m.poll.votes || {}).filter(([id, v]) => id !== uid && v && v.o).sort((a, b) => b[1].t - a[1].t);
            if (votes.length) items.push({ id: "pv:" + cid + m.id, kind: "votes", cid, mid: m.id, ts: votes[0][1].t, actors: votes.map(([id]) => id), text: m.poll.question });
          }
        }
      }
    }
    for (const f of fixes || []) if (f.by === uid && f.appliedAt) items.push({ id: "fx:" + f.cid + f.id, kind: "fix", cid: f.cid, ts: f.appliedAt, actors: [], text: f.text, recapId: f.recapId });
    return items.sort((a, b) => b.ts - a.ts);
  }

  function digest(feed, since, uid) {
    const fresh = feed.filter((m) => m.ts > since && m.by !== uid && (isChat(m) || m.kind === "recap"));
    const chat = fresh.filter(isChat);
    const authors = [...new Set(chat.map((m) => m.by))];
    const answered = new Set(feed.filter((m) => m.replyTo).map((m) => m.replyTo));
    return {
      count: chat.length,
      authors,
      top: [...chat].filter((m) => countReacts(m) >= 2).sort((a, b) => countReacts(b) - countReacts(a) || b.ts - a.ts).slice(0, 3),
      questions: chat.filter((m) => m.kind === "text" && /\?\s*$/.test(m.text || "") && !answered.has(m.id) && !m.resolved).slice(-3),
      shares: chat.filter((m) => m.kind === "photo" || /https?:\/\//.test(m.text || "") || (m.attachments && m.attachments.length)).slice(-4),
      recaps: fresh.filter((m) => m.kind === "recap"),
      events: chat.filter((m) => m.kind === "event"),
    };
  }

  function week({ feed, from, to, uid, fixes, checks, notes }) {
    const inWeek = feed.filter((m) => m.ts >= from && m.ts < to && isChat(m));
    const people = new Set(inWeek.map((m) => m.by));
    const byDay = {};
    for (const m of inWeek) { const k = Sched.et(m.ts).wd; byDay[k] = (byDay[k] || 0) + 1; }
    const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const emoji = {};
    let myReacts = 0;
    for (const m of feed) for (const [e, who] of Object.entries(m.reactions || {})) for (const [id, t] of Object.entries(who || {})) {
      if (!t || t < from || t >= to) continue;
      emoji[e] = (emoji[e] || 0) + 1;
      if (id === uid) myReacts++;
    }
    const problems = {};
    for (const m of inWeek) for (const t of m.tags || []) problems[t] = (problems[t] || 0) + 1;
    const topProblem = Object.entries(problems).sort((a, b) => b[1] - a[1])[0];
    const top = [...inWeek].sort((a, b) => countReacts(b) - countReacts(a))[0];
    const mine = inWeek.filter((m) => m.by === uid);
    const helped = new Set(inWeek.filter((m) => m.by === uid && m.replyTo).map((m) => { const q = feed.find((x) => x.id === m.replyTo); return q && q.by; }).filter((x) => x && x !== uid));
    return {
      messages: inWeek.length,
      people: people.size,
      busiest: busiest ? { day: +busiest[0], n: busiest[1] } : null,
      topEmoji: Object.entries(emoji).sort((a, b) => b[1] - a[1]).slice(0, 3),
      reactions: Object.values(emoji).reduce((a, b) => a + b, 0),
      topProblem: topProblem ? { p: topProblem[0], n: topProblem[1] } : null,
      top: top && countReacts(top) ? { m: top, n: countReacts(top) } : null,
      mine: mine.length,
      myReacts,
      helped: helped.size,
      fixes: (fixes || []).filter((f) => f.ts >= from && f.ts < to).length,
      checks: (checks || []).filter((c) => c.ts >= from && c.ts < to).length,
      notes: (notes || []).filter((n) => n.ts >= from && n.ts < to).length,
      photos: inWeek.filter((m) => m.kind === "photo").length,
      sessions: inWeek.filter((m) => m.kind === "event").length,
    };
  }

  function search(q, { feeds, members, courses, nameOf }) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { messages: [], people: [], classes: [] };
    const hit = (s) => { const t = (s || "").toLowerCase(); return terms.every((w) => t.includes(w)); };
    const messages = [];
    for (const [cid, feed] of Object.entries(feeds)) for (const m of feed) {
      if (m.deleted || m.hidden) continue;
      const body = [m.text, m.poll && m.poll.question, m.event && m.event.title, m.event && m.event.where, (m.tags || []).join(" ")].filter(Boolean).join(" ");
      if (hit(body) || hit(nameOf(m.by) + " " + body)) messages.push({ cid, m });
    }
    messages.sort((a, b) => b.m.ts - a.m.ts);
    return {
      messages: messages.slice(0, 40),
      people: members.filter((p) => hit([p.displayName, p.house, p.year, p.concentration].join(" "))).slice(0, 12),
      classes: courses.filter((c) => hit(c.code + " " + c.title + " " + (c.who || ""))).slice(0, 8),
    };
  }

  // ---- schedules of people (Saturn's "who's free", "compare") ----
  function meetingsOf(member, getCourse) {
    const out = [];
    if (!member) return out;
    for (const cid of Object.keys(member.courses || {})) {
      if (!Catalog.isCourse(cid)) continue;
      const c = getCourse(cid);
      const custom = member.schedule && member.schedule[cid];
      for (const mt of custom && custom.length ? custom : Sched.parseMeets(c.meets, c.where)) out.push({ ...mt, cid, kind: mt.kind || "lecture" });
      const sl = member.sections && member.sections[cid] && Catalog.slot(member.sections[cid]);
      if (sl) out.push({ d: sl.d, s: sl.s, e: sl.e, where: "", kind: "section", cid, label: sl.label });
    }
    return out;
  }
  function busyAt(meetings, ts) {
    return Sched.occurrences(meetings, ts - 6 * 3600e3, ts + 60e3).find((o) => o.start <= ts && o.end > ts) || null;
  }
  function nextOf(meetings, ts, days) {
    return Sched.occurrences(meetings, ts, ts + (days || 7) * 864e5).find((o) => o.start > ts) || null;
  }
  // Shared free blocks between two people on one day, 8 AM to 10 PM.
  function freeTogether(a, b, dayTs) {
    const from = Sched.startOfDay(dayTs) + 8 * 3600e3, to = Sched.startOfDay(dayTs) + 22 * 3600e3;
    const busy = [...Sched.occurrences(a, from, to), ...Sched.occurrences(b, from, to)].map((o) => [Math.max(o.start, from), Math.min(o.end, to)]).sort((x, y) => x[0] - y[0]);
    const free = [];
    let cur = from;
    for (const [s, e] of busy) { if (s - cur >= 45 * 60e3) free.push([cur, s]); cur = Math.max(cur, e); }
    if (to - cur >= 45 * 60e3) free.push([cur, to]);
    return free;
  }
  function suggestions(me, members, uid) {
    if (!me) return [];
    const mine = Object.keys(me.courses || {}).filter((c) => Catalog.isCourse(c));
    return members
      .filter((m) => m.id !== uid && !(me.following && me.following[m.id]))
      .map((m) => ({ m, shared: mine.filter((c) => m.courses && m.courses[c]), house: m.house && m.house === me.house, addedYou: !!(m.following && m.following[uid]) }))
      .filter((x) => x.shared.length || x.house || x.addedYou)
      .sort((x, y) => y.addedYou - x.addedYou || y.shared.length + (y.house ? 1.5 : 0) - (x.shared.length + (x.house ? 1.5 : 0)) || (x.m.displayName || "").localeCompare(y.m.displayName || ""));
  }

  return { inbox, digest, week, search, countReacts, isChat, meetingsOf, busyAt, nextOf, freeTogether, suggestions };
})();
