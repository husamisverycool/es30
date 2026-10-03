// ---------------------------------------------------------------------------
// Now (time spec a + Saturn's home): one summary sentence, a now/next hero
// with smart states, friends' status row, due soon, tasks, today's classes,
// "This Evening", what's new in your classes, and the weekly story (pull-only).
// ---------------------------------------------------------------------------
function myMeetings(app, member) {
  return Derive.meetingsOf(member || app.me, (id) => course(app, id));
}
function heroState(app, meetings) {
  const now = Clock.now();
  const occ = Sched.occurrences(meetings, now - 864e5, now + 8 * 864e5);
  const cur = occ.find((o) => o.start <= now && o.end > now);
  if (cur) return { s: "in", o: cur };
  const justEnded = occ.filter((o) => o.end <= now && now - o.end < 15 * 60e3).pop();
  const next = occ.find((o) => o.start > now);
  const today = Sched.et(now).key;
  if (justEnded) return { s: "ended", o: justEnded, next };
  if (!next) return { s: "none" };
  const ms = next.start - now;
  if (Sched.et(next.start).key !== today) return { s: occ.some((o) => Sched.et(o.start).key === today) ? "done" : "free", next };
  if (ms <= 10 * 60e3) return { s: "starting", o: next };
  if (ms <= 60 * 60e3) return { s: "soon", o: next };
  return { s: "later", o: next };
}

function NowView() {
  const app = useApp();
  useTick(1000);
  const now = Clock.now();
  const meetings = useMemo(() => myMeetings(app), [app.me]);
  const H = heroState(app, meetings);
  const due = [];
  for (const cid of app.myCourses) for (const d of ((app.hubs[cid] && app.hubs[cid].due) || [])) if (d.at > now - 3600e3 && d.at - now < 72 * 3600e3) due.push({ ...d, cid });
  due.sort((a, b) => a.at - b.at);
  const tasks = app.tasks.filter((t) => !t.done).sort((a, b) => (a.due || 9e15) - (b.due || 9e15)).slice(0, 4);
  const todays = Sched.occurrences(meetings, Sched.startOfDay(now), Sched.addDays(now, 1)).filter((o) => o.start < Sched.addDays(Sched.startOfDay(now), 1));
  const events = useLiveEvents(app);
  const liveNow = events.filter((e) => e.ev.at <= now && (e.ev.end || e.ev.at + 7200e3) > now);
  const evening = events.filter((e) => e.ev.at > now && Sched.et(e.ev.at).key === Sched.et(now).key && Sched.et(e.ev.at).h >= 17);
  const nextDue = due.find((d) => d.at > now);
  const summary = [
    H.s === "in" ? "In " + course(app, H.o.cid).code + " now" : H.o && (H.s === "soon" || H.s === "starting" || H.s === "later") ? course(app, H.o.cid).code + " " + (H.s === "later" ? "at " + tShort(H.o.start) : "in " + inWords(H.o.start - now)) : H.s === "free" || H.s === "none" ? "No classes today" : "No more classes today",
    nextDue ? nextDue.title + " due " + dueLadder(nextDue.at).text.replace(/^Today /, "today ").replace(/^Tomorrow /, "tomorrow ") : due.length ? "" : "nothing due in the next 3 days",
  ].filter(Boolean).join(" · ");
  return html`<div class="page">
    <${PageHead} title=${F.wlmd.format(now)} sub=${summary} />
    <div class="scroller page-scroll"><div class="page-in now">
      <${NowHero} H=${H} />
      ${liveNow.map((e) => html`<div class="livecard" key=${e.key}><span class="eyebrow live"><i class="pulse-dot"></i>Happening now${e.cid ? " · " + course(app, e.cid).code : " · Board"}</span><${EventCard} m=${e.m} courseId=${e.cid} /></div>`)}
      <${FriendsRow} />
      ${due.length ? html`<section><h2 class="sec-h">Due soon</h2><div class="group">${due.map((d) => html`<${DueRow} key=${d.cid + d.id} d=${d} courseId=${d.cid} compact=${true} />`)}</div></section>` : null}
      <section><div class="sec-hrow"><h2 class="sec-h">Tasks</h2><button class="link" onClick=${() => app.setRoute({ view: "tasks" })}>See all</button></div>
        <div class="group">${tasks.length ? tasks.map((t) => html`<${TaskRow} key=${t.id} t=${t} />`) : html`<div class="rowempty">Nothing on your list. Add “Start PSet 5” from a due date, or <button class="link" onClick=${() => app.open("task-new")}>add a task</button>.</div>`}</div></section>
      <section><h2 class="sec-h">${todays.length ? "Today's classes" : "Next class"}</h2>
        <div class="group">${todays.length ? todays.map((o) => html`<${MeetingRow} key=${o.cid + o.start} o=${o} />`)
          : H.next || H.o ? html`<${MeetingRow} o=${H.next || H.o} showDay=${true} />` : html`<div class="rowempty">Add meeting times in <button class="link" onClick=${() => app.setRoute({ view: "calendar" })}>Calendar</button> to see your classes here.</div>`}</div></section>
      ${evening.length ? html`<section><h2 class="sec-h"><${Icon} name="moon" size=${18} fill=${true} /> This Evening</h2>${evening.map((e) => html`<${EventCard} key=${e.key} m=${e.m} courseId=${e.cid} />`)}</section>` : null}
      <${InYourClasses} />
      <${StoryEntry} />
    </div></div>
  </div>`;
}

function NowHero({ H }) {
  const app = useApp();
  const now = Clock.now();
  if (H.s === "in") {
    const o = H.o, left = o.end - now, pct = Math.min(1, (now - o.start) / (o.end - o.start));
    return html`<section class="hero in" style=${{ "--edge": courseLook(o.cid).hue }}>
      <span class="eyebrow">${o.kind === "section" ? "In section" : "In lecture"}</span>
      <div class="hero-row"><${Tile} courseId=${o.cid} size=${44} /><div class="grow"><b>${course(app, o.cid).code}</b><small>${tShort(o.start)}–${tShort(o.end)}${o.where ? " · " + o.where : ""}</small></div>
        <div class="hero-cd"><small>ENDS IN</small><b class="tnum">${countdown(left)}</b></div></div>
      <div class="hero-bar"><i style=${{ width: pct * 100 + "%" }}></i></div>
      <div class="hero-acts"><button class="btn primary sm" onClick=${() => app.openCourse(o.cid)}><${Icon} name="chat" size=${16} />Class chat</button><button class="btn ghost sm" onClick=${() => app.open("task-new", { cid: o.cid })}><${Icon} name="plus" size=${16} />New task</button></div>
    </section>`;
  }
  if (H.s === "soon" || H.s === "starting") {
    const o = H.o, ms = o.start - now;
    return html`<section class="hero soon" style=${{ "--edge": courseLook(o.cid).hue }}>
      <span class="eyebrow">${H.s === "starting" ? html`<i class="pulse-dot"></i>Starting` : "Up next"}</span>
      <div class="hero-row"><${Tile} courseId=${o.cid} size=${44} /><div class="grow"><b>${course(app, o.cid).code} starts in ${Math.max(1, Math.ceil(ms / 60e3))} min</b><small>${tShort(o.start)}${o.where ? " · " + o.where : ""}</small></div></div>
      <div class="hero-acts"><button class="btn ghost sm" onClick=${() => app.openCourse(o.cid)}>Open chat</button></div>
    </section>`;
  }
  if (H.s === "later") {
    const o = H.o;
    return html`<button class="hero later" onClick=${() => app.openCourse(o.cid)} style=${{ "--edge": courseLook(o.cid).hue }}>
      <span class="eyebrow">Next</span><div class="hero-row"><${Tile} courseId=${o.cid} size=${40} /><div class="grow"><b>${course(app, o.cid).code} · ${tShort(o.start)}</b><small>${o.where || course(app, o.cid).title}</small></div><${Icon} name="chevronRight" size=${18} /></div></button>`;
  }
  if (H.s === "ended") {
    return html`<section class="hero"><span class="eyebrow">${course(app, H.o.cid).code} ended</span>
      <div class="hero-row"><div class="grow"><b>${H.next ? "Next: " + course(app, H.next.cid).code + " · " + (Sched.et(H.next.start).key === Sched.et(now).key ? tShort(H.next.start) : dayLabel(H.next.start) + " " + tShort(H.next.start)) : "That's it for today"}</b><small>Anything said in class is in the chat.</small></div>
      <button class="btn ghost sm" onClick=${() => app.openCourse(H.o.cid)}>Open chat</button></div></section>`;
  }
  const n = H.next;
  return html`<section class="hero quiet">
    <span class="chip-allday">${H.s === "done" ? "Done for today" : Sched.et(now).wd === 0 || Sched.et(now).wd === 6 ? "No classes · Weekend" : "No classes today"}</span>
    ${n ? html`<button class="hero-row hero-next" onClick=${() => app.openCourse(n.cid)}><${Tile} courseId=${n.cid} size=${36} /><div class="grow"><small>First class next</small><b>${course(app, n.cid).code} · ${dayLabel(n.start)} ${tShort(n.start)}</b></div><${Icon} name="chevronRight" size=${18} /></button>` : null}
  </section>`;
}

// Study sessions (class chats) and Board events, as one list.
function useLiveEvents(app) {
  const board = useCollection(() => app.db.collection("board").orderBy("ts", "desc").limit(60), [app.db]) || [];
  return useMemo(() => {
    const out = [];
    for (const [cid, f] of Object.entries(app.feeds)) for (const m of f || []) if (m.kind === "event" && m.event && !m.deleted && !m.hidden) out.push({ key: cid + m.id, m, cid, ev: m.event });
    for (const p of board) if (p.event && p.event.at && !p.deleted) out.push({ key: "b" + p.id, m: { ...p, kind: "event", event: { title: p.title, at: p.event.at, end: p.event.end, where: p.event.where, rsvps: p.event.rsvps } }, cid: null, board: p, ev: p.event });
    return out.sort((a, b) => a.ev.at - b.ev.at);
  }, [app.feeds, board]);
}

function MeetingRow({ o, showDay }) {
  const app = useApp();
  const now = Clock.now();
  const past = o.end < now, live = o.start <= now && o.end > now;
  return html`<button class=${"mrow" + (past ? " past" : "") + (live ? " live" : "")} onClick=${() => app.openCourse(o.cid, o.kind === "section" ? "section" : "chat")} style=${{ "--edge": courseLook(o.cid).hue }}>
    <span class="mrow-time tnum">${showDay ? dayLabel(o.start) + " " : ""}${tShort(o.start)}<small>${tShort(o.end)}</small></span>
    <span class="mrow-edge"></span>
    <span class="grow mrow-t"><b>${course(app, o.cid).code}${o.kind === "section" ? " · Section" : ""}</b><small>${o.where || course(app, o.cid).title || ""}</small></span>
    ${past ? html`<${Icon} name="check" size=${16} />` : live ? html`<span class="pill live">Now</span>` : null}
  </button>`;
}

// Saturn 2026: friends as faces with what they're doing right now.
function FriendsRow() {
  const app = useApp();
  const now = Clock.now();
  const following = Object.entries((app.me && app.me.following) || {}).filter(([, t]) => t).map(([id]) => id);
  const friends = following.map((id) => app.membersById[id]).filter(Boolean);
  if (!friends.length) {
    return html`<button class="friends-empty" onClick=${() => app.setRoute({ view: "people" })}><${Icon} name="userPlus" size=${20} /><span class="grow"><b>See who's free</b><small>Add friends from your classes and you'll see their status and free time here.</small></span><${Icon} name="chevronRight" size=${16} /></button>`;
  }
  return html`<section><div class="sec-hrow"><h2 class="sec-h">Friends</h2><button class="link" onClick=${() => app.setRoute({ view: "people" })}>All</button></div>
    <div class="friends">${friends.map((m) => {
      const busy = Derive.busyAt(myMeetings(app, m), now);
      const st = m.status && m.status.e && m.status.until > now ? m.status : null;
      const mutual = app.isFriend(m.id);
      return html`<button class="friend" key=${m.id} onClick=${() => app.open("profile", { uid: m.id })}>
        <span class="friend-av">${busy ? html`<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" pathLength="100" style=${{ strokeDasharray: Math.round(((busy.end - now) / (busy.end - busy.start)) * 100) + " 100" }} /></svg>` : null}
          <${Avatar} uid=${m.id} size=${56} />
          <span class=${"friend-chip" + (busy ? "" : st ? " st" : " free")}>${busy ? Math.ceil((busy.end - now) / 60e3) + "m" : st ? st.e : "Free"}</span></span>
        <span class="friend-n">${firstName(m.displayName)}</span>
        ${!mutual ? html`<span class="friend-pend">Pending</span>` : null}
      </button>`;
    })}</div></section>`;
}

function InYourClasses() {
  const app = useApp();
  const rows = app.myCourses.map((cid) => {
    const f = app.feeds[cid] || [];
    const lr = app.lastRead(cid, "main");
    const fresh = f.filter((m) => m.ts > lr && m.by !== app.uid && Derive.isChat(m));
    const top = [...fresh].sort((a, b) => Derive.countReacts(b) - Derive.countReacts(a))[0];
    return { cid, n: fresh.length, top };
  }).filter((r) => r.n);
  if (!rows.length) return null;
  return html`<section><h2 class="sec-h">New in your classes</h2><div class="group">${rows.map((r) => html`<button class="newrow" key=${r.cid} onClick=${() => app.openCourse(r.cid)}>
    <${Tile} courseId=${r.cid} size=${36} /><span class="grow newrow-t"><b>${course(app, r.cid).code} · ${plural(r.n, "new message")}</b>
      ${r.top ? html`<small>${firstName(app.person(r.top.by).name)}: ${r.top.kind === "photo" ? "📷 Photo" : r.top.kind === "poll" ? r.top.poll.question : r.top.kind === "event" ? r.top.event.title : r.top.text}</small>` : null}</span><${Icon} name="chevronRight" size=${16} /></button>`)}</div></section>`;
}

function StoryEntry() {
  const app = useApp();
  const cid = app.myCourses.find((c) => Catalog.isCourse(c) && (app.feeds[c] || []).length > 20);
  if (!cid) return null;
  const from = Sched.startOfWeek(Clock.now());
  return html`<button class="storyentry" onClick=${() => app.open("story", { courseId: cid })}>
    <${Tile} courseId=${cid} size=${40} /><span class="grow"><b>Your week in ${course(app, cid).code}</b><small>${F.md.format(from)} – ${F.md.format(Sched.addDays(from, 6))} · 6 cards</small></span><${Icon} name="play" size=${18} fill=${true} /></button>`;
}

function TaskRow({ t }) {
  const app = useApp();
  const lad = t.due ? dueLadder(t.due) : null;
  return html`<div class=${"taskrow" + (t.done ? " done" : "")}>
    <button class=${"checkbox" + (t.done ? " on" : "")} aria-pressed=${!!t.done} aria-label=${(t.done ? "Mark not done: " : "Mark done: ") + t.title} onClick=${(e) => { const el = e.currentTarget; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); app.toggleTask(t); }}><${Icon} name="check" size=${14} /></button>
    <span class="grow taskrow-t"><b>${t.title}</b><small>${t.cid ? course(app, t.cid).code : "Personal"}${lad ? " · " : ""}${lad ? html`<span class=${"due-tone " + lad.tone}>${lad.text}</span>` : null}</small></span>
    <button class="iconbtn sm" onClick=${() => app.deleteTask(t)} aria-label=${"Delete " + t.title}><${Icon} name="x" size=${16} /></button>
  </div>`;
}
