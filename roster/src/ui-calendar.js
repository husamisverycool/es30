// ---------------------------------------------------------------------------
// Calendar (time spec b/d). Desktop: a week grid like Notion Calendar/Google
// Calendar (overlaps split side by side, red now-line with a time label,
// all-day lane for deadlines). Phone: Apple Calendar's week strip over one
// day's timeline, or a list (Things' Upcoming). Your class times come from
// the catalog, and you can set or fix them (Saturn's schedule editor).
// ---------------------------------------------------------------------------
function calItems(app, from, to) {
  const now = Clock.now();
  const out = [], allDay = [];
  for (const o of Sched.occurrences(myMeetings(app), from, to)) {
    const c = course(app, o.cid);
    out.push({ key: "m" + o.cid + o.start + o.kind, start: o.start, end: o.end, cid: o.cid, kind: o.kind, title: c.code + (o.kind === "section" ? " · Section" : ""), sub: o.where || (o.kind === "section" ? "" : c.where) || "", run: () => app.openCourse(o.cid, o.kind === "section" ? "section" : "chat") });
  }
  for (const cid of app.myCourses) {
    for (const d of ((app.hubs[cid] && app.hubs[cid].due) || [])) if (d.at >= from && d.at < to) allDay.push({ key: "d" + cid + d.id, at: d.at, kind: "due", cid, title: d.title, sub: course(app, cid).code + " · " + tShort(d.at), tone: dueLadder(d.at).tone, run: () => app.openCourse(cid, "people") });
    for (const m of app.feeds[cid] || []) {
      if (m.kind !== "event" || !m.event || m.deleted || m.hidden) continue;
      const r = (m.event.rsvps || {})[app.uid];
      if (!r || !r.s || r.s === "no") continue;
      const ev = m.event, end = ev.end || ev.at + 2 * 3600e3;
      if (end > from && ev.at < to) out.push({ key: "e" + cid + m.id, start: ev.at, end, cid, kind: "event", rsvp: r.s, title: ev.title, sub: ev.where || "", run: () => app.open("event", { m, courseId: cid }) });
    }
  }
  for (const t of app.tasks) if (t.due && t.due >= from && t.due < to && !t.done) allDay.push({ key: "t" + t.id, at: t.due, kind: "task", cid: t.cid, title: t.title, sub: "Task · " + tShort(t.due), run: () => app.setRoute({ view: "tasks" }) });
  const norm = (t) => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z ]/g, "").trim().slice(0, 18);
  for (const d of Catalog.termDates) { const at = Date.parse(d.at); if (at >= from && at < to && !allDay.some((a) => Sched.et(a.at).key === Sched.et(at).key && norm(a.title) === norm(d.title))) allDay.push({ key: "td" + d.title, at, kind: "term", title: d.title, sub: d.kind === "holiday" ? "Harvard calendar" : "Registrar deadline", run: null }); }
  return { timed: out.sort((a, b) => a.start - b.start), allDay: allDay.sort((a, b) => a.at - b.at), now };
}
function useBoardGoing(app) {
  const board = useCollection(() => app.db.collection("board").orderBy("ts", "desc").limit(60), [app.db]) || [];
  return useMemo(() => board.filter((p) => !p.deleted && p.event && p.event.at && p.event.rsvps && p.event.rsvps[app.uid] && ["going", "maybe"].includes(p.event.rsvps[app.uid].s)), [board]);
}
function withBoard(app, items, board, from, to) {
  const extra = board.filter((p) => (p.event.end || p.event.at + 7200e3) > from && p.event.at < to).map((p) => ({ key: "b" + p.id, start: p.event.at, end: p.event.end || p.event.at + 7200e3, kind: "board", rsvp: p.event.rsvps[app.uid].s, title: p.title, sub: p.event.where || "", run: () => app.open("board-post", { id: p.id }) }));
  return [...items, ...extra].sort((a, b) => a.start - b.start);
}

// Overlap layout: cluster items that overlap, then greedy columns within a cluster.
function layoutDay(items) {
  const placed = [];
  let cluster = [], end = 0;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((last) => last <= it.start);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = it.end;
      placed.push({ ...it, col: c });
    }
    for (const p of placed.slice(placed.length - cluster.length)) p.cols = cols.length;
    cluster = []; end = 0;
  };
  for (const it of items) { if (cluster.length && it.start >= end) flush(); cluster.push(it); end = Math.max(end, it.end); }
  if (cluster.length) flush();
  return placed;
}

function CalendarView() {
  const app = useApp();
  useTick(30000);
  const wide = useMedia("(min-width: 900px)");
  const now = Clock.now();
  const [mode, setModeS] = useState(() => LS.get("roster:cal", "grid"));
  const setMode = (m) => { setModeS(m); LS.set("roster:cal", m); };
  const [day, setDay] = useState(() => Sched.startOfDay(now));
  const week = Sched.startOfWeek(day);
  const board = useBoardGoing(app);
  const days = wide ? Array.from({ length: 7 }, (_, i) => Sched.addDays(week, i)) : [day];
  const from = days[0], to = Sched.addDays(days[days.length - 1], 1);
  const shift = (n) => setDay(Sched.addDays(day, wide ? 7 * n : n));
  const title = wide || mode === "list" ? F.mon.format(Sched.addDays(week, 3)) + " " + Sched.et(Sched.addDays(week, 3)).y : F.wlml.format(day);
  const noTimes = app.myCourses.filter(Catalog.isCourse).filter((cid) => !Sched.parseMeets(course(app, cid).meets).length && !(app.me && app.me.schedule && app.me.schedule[cid] && app.me.schedule[cid].length));
  return html`<div class="page">
    <${PageHead} title="Calendar" sub=${title}>
      <${Seg} value=${mode} onChange=${setMode} label="Calendar view" options=${[["grid", wide ? "Week" : "Day"], ["list", "List"]]} />
    <//>
    <div class="calbar">
      <button class="btn sm ghost" onClick=${() => setDay(Sched.startOfDay(Clock.now()))}>Today</button>
      ${mode === "grid" ? html`<button class="iconbtn sm" onClick=${() => shift(-1)} aria-label=${wide ? "Previous week" : "Previous day"}><${Icon} name="chevronLeft" size=${18} /></button>
      <button class="iconbtn sm" onClick=${() => shift(1)} aria-label=${wide ? "Next week" : "Next day"}><${Icon} name="chevronRight" size=${18} /></button>` : null}
      <span class="grow"></span>
      <button class="btn sm soft" onClick=${() => app.open("meetings")}><${Icon} name="sliders" size=${15} />Class times</button>
    </div>
    ${!wide && mode === "grid" ? html`<${WeekStrip} day=${day} onPick=${setDay} />` : null}
    ${noTimes.length ? html`<button class="calnote" onClick=${() => app.open("meetings")}><${Icon} name="info" size=${16} /><span class="grow">${noTimes.map((c) => course(app, c).code).join(", ")} ${noTimes.length === 1 ? "has" : "have"} no meeting times yet. Add them to see ${noTimes.length === 1 ? "it" : "them"} here.</span><${Icon} name="chevronRight" size=${14} /></button>` : null}
    ${mode === "grid" ? html`<${TimeGrid} days=${days} items=${withBoard(app, calItems(app, from, to).timed, board, from, to)} allDay=${calItems(app, from, to).allDay} />`
      : html`<${Agenda} from=${Sched.startOfDay(Clock.now())} board=${board} />`}
  </div>`;
}

function WeekStrip({ day, onPick }) {
  const app = useApp();
  const week = Sched.startOfWeek(day);
  const today = Sched.et(Clock.now()).key;
  const busy = useMemo(() => {
    const { timed, allDay } = calItems(app, week, Sched.addDays(week, 7));
    const s = {};
    for (const it of timed) s[Sched.et(it.start).key] = (s[Sched.et(it.start).key] || 0) + 1;
    for (const it of allDay) s[Sched.et(it.at).key] = (s[Sched.et(it.at).key] || 0) + 1;
    return s;
  }, [week, app.me, app.hubs, app.feeds, app.tasks]);
  return html`<div class="weekstrip" role="tablist" aria-label="Days this week">${Array.from({ length: 7 }, (_, i) => {
    const d = Sched.addDays(week, i), p = Sched.et(d), sel = p.key === Sched.et(day).key;
    return html`<button key=${p.key} role="tab" aria-selected=${sel} class=${"ws-d" + (sel ? " on" : "") + (p.key === today ? " today" : "")} onClick=${() => onPick(d)}>
      <small>${Sched.DAY_NAME[p.wd].slice(0, 1)}</small><b class="tnum">${p.d}</b><i class=${busy[p.key] ? "has" : ""}></i></button>`;
  })}</div>`;
}

const GRID_PX = 52; // per hour, Notion Calendar's density
function TimeGrid({ days, items, allDay }) {
  const app = useApp();
  const ref = useRef(null);
  const now = Clock.now();
  const mins = (ts) => { const p = Sched.et(ts); return p.h * 60 + p.mi; };
  const lo = Math.min(8 * 60, ...items.map((it) => Math.floor(mins(it.start) / 60) * 60));
  const hi = Math.max(22 * 60, ...items.map((it) => Math.min(24 * 60, Math.ceil((mins(it.end) || 1440) / 60) * 60)));
  const px = GRID_PX / 60;
  const todayKey = Sched.et(now).key;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = items.length ? Math.min(...items.map((it) => mins(it.start))) : 9 * 60;
    // Today in view: keep the now-line on screen (Notion Calendar opens at the current time).
    const target = days.some((d) => Sched.et(d).key === todayKey) ? Math.max(lo, mins(now) - el.clientHeight / px / 2) : first - 30;
    el.scrollTop = Math.max(0, (target - lo) * px);
  }, [days[0]]);
  const hours = [];
  for (let m = lo; m < hi; m += 60) hours.push(m);
  return html`<div class=${"tgrid" + (days.length === 1 ? " one" : "")}>
    ${days.length > 1 ? html`<div class="tg-head"><span class="tg-gut"></span>${days.map((d) => { const p = Sched.et(d); return html`<span key=${p.key} class=${"tg-dh" + (p.key === todayKey ? " today" : "")}><small>${Sched.DAY_NAME[p.wd].toUpperCase()}</small><b class="tnum">${p.d}</b></span>`; })}</div>` : null}
    ${allDay.length ? html`<div class="tg-allday"><span class="tg-gut"><small>all-day</small></span>${days.map((d) => {
      const k = Sched.et(d).key, list = allDay.filter((a) => Sched.et(a.at).key === k);
      return html`<span class="tg-adcol" key=${k}>${list.map((a) => html`<button key=${a.key} class=${"adchip " + a.kind + (a.tone ? " " + a.tone : "")} style=${a.cid ? { "--edge": courseLook(a.cid).hue, "--tint": courseLook(a.cid).tint } : null} onClick=${a.run || undefined} title=${a.title + " · " + a.sub}>
        <${Icon} name=${a.kind === "due" ? "flag" : a.kind === "task" ? "checkSquare" : "calendar"} size=${12} /><span>${a.title}</span></button>`)}</span>`;
    })}</div>` : null}
    <div class="tg-body" ref=${ref}>
      <div class="tg-inner" style=${{ height: (hi - lo) * px + "px" }}>
        <div class="tg-gut">${hours.map((m) => html`<span key=${m} class="tg-hr" style=${{ top: (m - lo) * px + "px" }}>${m === lo ? "" : Sched.fmtMin(m).replace(":00", "")}</span>`)}</div>
        <div class="tg-cols">
          ${hours.map((m) => html`<i key=${"l" + m} class="tg-line" style=${{ top: (m - lo) * px + "px" }}></i>`)}
          ${days.map((d) => {
            const k = Sched.et(d).key;
            const list = layoutDay(items.filter((it) => Sched.et(it.start).key === k));
            const isToday = k === todayKey;
            return html`<div class=${"tg-col" + (isToday ? " today" : "")} key=${k}>
              ${list.map((it) => {
                const top = (mins(it.start) - lo) * px, h = Math.max(22, ((it.end - it.start) / 60e3) * px - 2);
                const L = it.cid ? courseLook(it.cid) : null;
                const past = it.end < now, live = it.start <= now && it.end > now;
                return html`<button key=${it.key} class=${"tg-ev " + it.kind + (it.rsvp === "maybe" ? " maybe" : "") + (past ? " past" : "") + (live ? " live" : "") + (h < 40 ? " short" : "")}
                  style=${{ top: top + "px", height: h + "px", left: "calc(" + (it.col / it.cols) * 100 + "% + 2px)", width: "calc(" + 100 / it.cols + "% - 4px)", "--edge": L ? L.solid : "var(--ink-2)", "--tint": L ? L.tint : "var(--fill-2)", "--tx": L ? L.text : "var(--ink)" }}
                  onClick=${it.run} title=${it.title + " · " + tShort(it.start) + "–" + tShort(it.end) + (it.sub ? " · " + it.sub : "")}>
                  <b>${it.title}</b>${h >= 40 ? html`<small>${tShort(it.start)}${it.sub ? " · " + it.sub : ""}</small>` : null}</button>`;
              })}
              ${isToday ? html`<div class="tg-now" style=${{ top: (mins(now) - lo) * px + "px" }}><i></i></div>` : null}
            </div>`;
          })}
          ${days.some((d) => Sched.et(d).key === todayKey) ? html`<span class="tg-nowlabel tnum" style=${{ top: (mins(now) - lo) * px + "px" }}>${tShort(now).replace(/ (AM|PM)/, "")}</span>` : null}
        </div>
      </div>
    </div>
    ${!items.length && days.length === 1 ? html`<div class="tg-empty">${Sched.et(days[0]).wd % 6 === 0 ? "No classes on weekends." : "Nothing scheduled."}</div>` : null}
  </div>`;
}

function Agenda({ from, board }) {
  const app = useApp();
  const to = Sched.addDays(from, 21);
  const { timed, allDay } = calItems(app, from, to);
  const all = withBoard(app, timed, board, from, to);
  const now = Clock.now();
  const days = [];
  for (let d = from; d < to; d = Sched.addDays(d, 1)) {
    const k = Sched.et(d).key;
    const t = all.filter((it) => Sched.et(it.start).key === k), a = allDay.filter((it) => Sched.et(it.at).key === k);
    if (t.length || a.length || d === from) days.push({ d, k, t, a });
  }
  return html`<div class="scroller page-scroll"><div class="page-in agenda">
    ${days.map(({ d, k, t, a }) => html`<section key=${k} class="ag-day">
      <h2 class="ag-h"><b>${dayLabel(d) === "Today" || dayLabel(d) === "Tomorrow" ? dayLabel(d) : F.wd.format(d)}</b><span>${F.md.format(d)}</span></h2>
      <div class="group">
        ${a.map((it) => html`<button key=${it.key} class="ag-row allday" onClick=${it.run || undefined} disabled=${!it.run}>
          <span class="ag-time"><span class=${"flag " + (it.tone || "calm")}><${Icon} name=${it.kind === "due" ? "flag" : it.kind === "task" ? "checkSquare" : "calendar"} size=${14} /></span></span>
          <span class="grow ag-t"><b>${it.title}</b><small>${it.sub}</small></span>
          ${it.kind === "due" ? html`<span class=${"due-tone " + it.tone}>${dueLadder(it.at).text}</span>` : null}</button>`)}
        ${t.map((it) => {
          const past = it.end < now, live = it.start <= now && it.end > now;
          return html`<button key=${it.key} class=${"ag-row" + (past ? " past" : "") + (live ? " live" : "")} onClick=${it.run} style=${{ "--edge": it.cid ? courseLook(it.cid).hue : "var(--ink-3)" }}>
            <span class="ag-time tnum">${tShort(it.start)}<small>${tShort(it.end)}</small></span><span class="mrow-edge"></span>
            <span class="grow ag-t"><b>${it.title}</b><small>${[it.kind === "event" || it.kind === "board" ? (it.rsvp === "maybe" ? "Maybe" : "Going") : "", it.sub].filter(Boolean).join(" · ")}</small></span>
            ${live ? html`<span class="pill live">Now</span>` : past ? html`<${Icon} name="check" size=${16} />` : null}</button>`;
        })}
        ${!t.length && !a.length ? html`<div class="rowempty">Nothing scheduled today.</div>` : null}
      </div>
    </section>`)}
    <p class="muted sm center">Showing the next 3 weeks. Study sessions and Board events appear once you say you're going.</p>
  </div></div>`;
}

// ---- class times editor (sheet) --------------------------------------------------------
const WEEKDAYS = [[1, "M"], [2, "Tu"], [3, "W"], [4, "Th"], [5, "F"]];
const minToInput = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const inputToMin = (v) => { const [h, m] = (v || "0:0").split(":"); return +h * 60 + +m; };
function recurLink(app, cid, mt) {
  const c = course(app, cid);
  const first = Sched.occurrences([mt], Clock.now(), Clock.now() + 8 * 864e5)[0];
  if (!first) return null;
  const by = mt.d.map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d]).join(",");
  const base = calLinks(c.code + (mt.kind === "section" ? " section" : ""), first.start, first.end, c.title + (mt.where ? " · " + mt.where : ""));
  return base.google + "&recur=" + encodeURIComponent("RRULE:FREQ=WEEKLY;BYDAY=" + by + ";UNTIL=20261204T235959Z") + (mt.where ? "&location=" + encodeURIComponent(mt.where) : "");
}
function MeetingsSheet({ onClose }) {
  const app = useApp();
  const courses = app.myCourses.filter(Catalog.isCourse);
  const sched = (app.me && app.me.schedule) || {};
  const [edit, setEdit] = useState(null);
  const startEdit = (cid) => {
    const cur = sched[cid] && sched[cid].length ? sched[cid][0] : Sched.parseMeets(course(app, cid).meets, course(app, cid).where)[0];
    setEdit({ cid, d: cur ? cur.d : [2, 4], s: cur ? cur.s : 600, e: cur ? cur.e : 675, where: cur ? cur.where : "" });
  };
  const save = async () => {
    if (!edit.d.length || edit.e <= edit.s) { app.toast("Pick at least one day, and an end time after the start."); return; }
    const ok = await app.updateProfile({ schedule: { ...sched, [edit.cid]: [{ d: [...edit.d].sort(), s: edit.s, e: edit.e, where: edit.where.trim(), kind: "lecture" }] } }, course(app, edit.cid).code + " times saved");
    if (ok) setEdit(null);
  };
  if (edit) {
    const c = course(app, edit.cid);
    return html`<${Sheet} title=${c.code + " times"} onClose=${() => setEdit(null)} footer=${html`<button class="btn ghost" onClick=${() => setEdit(null)}>Cancel</button><button class="btn primary" onClick=${save}>Save</button>`}>
      <label class="field"><span>Days</span><div class="daypick">${WEEKDAYS.map(([d, l]) => html`<button key=${d} class=${"daychip" + (edit.d.includes(d) ? " on" : "")} aria-pressed=${edit.d.includes(d)} onClick=${() => setEdit({ ...edit, d: edit.d.includes(d) ? edit.d.filter((x) => x !== d) : [...edit.d, d] })}>${l}</button>`)}</div></label>
      <div class="field-row"><label class="field"><span>Starts</span><input class="input" type="time" step="300" value=${minToInput(edit.s)} onInput=${(e) => setEdit({ ...edit, s: inputToMin(e.target.value) })} /></label>
        <label class="field"><span>Ends</span><input class="input" type="time" step="300" value=${minToInput(edit.e)} onInput=${(e) => setEdit({ ...edit, e: inputToMin(e.target.value) })} /></label></div>
      <label class="field"><span>Where</span><input class="input" placeholder="Science Center Hall B" value=${edit.where} onInput=${(e) => setEdit({ ...edit, where: e.target.value })} /></label>
      <p class="muted sm">Only your calendar changes. Times from my.harvard are a starting point; fix them if your class moved.</p>
    <//>`;
  }
  return html`<${Sheet} title="Class times" icon="calendar" onClose=${onClose}>
    <div class="group">${courses.map((cid) => {
      const c = course(app, cid);
      const custom = sched[cid] && sched[cid].length;
      const mts = custom ? sched[cid] : Sched.parseMeets(c.meets, c.where);
      const sec = app.me && app.me.sections && app.me.sections[cid] && Catalog.slot(app.me.sections[cid]);
      const link = mts[0] ? recurLink(app, cid, mts[0]) : null;
      return html`<div class="mtrow" key=${cid}>
        <${Tile} courseId=${cid} size=${40} />
        <div class="grow mtrow-t"><b>${c.code}</b>
          <small>${mts.length ? mts.map((mt) => Sched.fmtMeeting(mt) + (mt.where ? " · " + mt.where : "")).join("; ") : "No times yet"}${custom ? " · edited" : ""}</small>
          ${sec ? html`<small>Section ${sec.label}</small>` : null}</div>
        ${link ? html`<a class="iconbtn sm" href=${link} target="_blank" rel="noopener noreferrer" aria-label=${"Add " + c.code + " to Google Calendar, repeating weekly"} title="Add to Google Calendar (repeats weekly)"><${Icon} name="calendarPlus" size=${18} /></a>` : null}
        <button class="btn sm soft" onClick=${() => startEdit(cid)}>${mts.length ? "Edit" : "Add"}</button>
      </div>`;
    })}</div>
    <p class="muted sm">Your classmates see your times only if you're friends, to find free time together.</p>
  <//>`;
}
