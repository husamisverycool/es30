// ---------------------------------------------------------------------------
// Activity (Instagram/Threads activity: grouped actors, New / Earlier),
// Saved (Slack's Later), Tasks (Things 3: Today / Upcoming / Anytime /
// Logbook), and You (iOS Settings-style grouped lists).
// ---------------------------------------------------------------------------
const INBOX_COPY = {
  mention: (n) => html`<b>${n}</b> mentioned you`,
  reply: (n) => html`<b>${n}</b> replied to you`,
  reactions: (n, it) => html`<b>${n}</b> reacted ${it.emoji.join("")} to your message`,
  rsvp: (n) => html`<b>${n}</b> ${n.includes(" and ") ? "are" : "is"} going to your study session`,
  votes: (n) => html`<b>${n}</b> voted in your poll`,
  fix: () => html`<b>Your fix was applied.</b> Three classmates agreed`,
  recap: () => html`<b>New lecture recap</b> to check`,
  announce: () => html`<b>Announcement</b> from the organizer`,
};
function actorNames(app, ids) {
  const names = ids.map((id) => firstName(app.person(id).name));
  if (names.length <= 1) return names[0] || "Someone";
  if (names.length === 2) return names[0] + " and " + names[1];
  return names[0] + " and " + (names.length - 1) + " others";
}
function ActivityView() {
  const app = useApp();
  const [tab, setTab] = useState("you");
  const [seen] = useState(() => app.inboxSeen());
  const items = useMemo(() => Derive.inbox({ uid: app.uid, feeds: Object.fromEntries(Object.entries(app.feeds).filter(([, f]) => f)), fixes: app.fixes.map((f) => ({ ...f, appliedAt: appliedAt(f) })) }), [app.feeds, app.fixes]);
  useEffect(() => () => app.markInboxSeen(), []);
  const mine = items.filter((i) => i.kind !== "recap" && i.kind !== "announce");
  const other = items.filter((i) => i.kind === "recap" || i.kind === "announce");
  const list = tab === "you" ? mine : other;
  const fresh = list.filter((i) => i.ts > seen), today = list.filter((i) => i.ts <= seen && daysBetween(i.ts, Clock.now()) === 0), earlier = list.filter((i) => i.ts <= seen && daysBetween(i.ts, Clock.now()) > 0);
  const go = (it) => { const m = (app.feeds[it.cid] || []).find((x) => x.id === it.mid); app.openCourse(it.cid, it.kind === "recap" || it.kind === "fix" ? "recaps" : m && m.thread && m.thread !== "main" ? (m.thread.startsWith("sec-") ? "section" : "pset") : "chat", it.mid); };
  const Row = (it) => html`<button class=${"actrow" + (it.ts > seen ? " new" : "")} key=${it.id} onClick=${() => go(it)}>
    <span class="act-av">${it.actors.length ? html`<${Faces} ids=${it.actors.slice(0, 2)} size=${it.actors.length > 1 ? 30 : 40} max=${2} />` : html`<span class=${"act-ic k-" + it.kind}><${Icon} name=${it.kind === "fix" ? "checkCircle" : it.kind === "recap" ? "ai" : "megaphone"} size=${20} /></span>`}</span>
    <span class="grow act-t"><span>${INBOX_COPY[it.kind](actorNames(app, it.actors), it)} <span class="tm">${relShort(it.ts)}</span></span>
      ${it.text ? html`<small>“${(it.text || "").slice(0, 120)}”</small>` : null}</span>
    <${Tile} courseId=${it.cid} size=${28} />
  </button>`;
  const Group = (title, arr) => (arr.length ? html`<section key=${title}><h2 class="sec-h">${title}</h2><div class="group">${arr.map(Row)}</div></section>` : null);
  return html`<div class="page">
    <${PageHead} title="Activity"><${Seg} value=${tab} onChange=${setTab} label="Activity filter" options=${[["you", "For you", mine.filter((i) => i.ts > seen).length || null], ["class", "Recaps & news", other.filter((i) => i.ts > seen).length || null]]} /><//>
    <div class="scroller page-scroll"><div class="page-in">
      ${Group("New", fresh)}${Group("Today", today)}${Group("Earlier", earlier)}
      ${!list.length ? html`<${Empty} icon="bell" title=${tab === "you" ? "Nothing yet" : "No recaps or announcements yet"}>${tab === "you" ? "Replies, mentions and reactions to your messages show up here." : "Lecture recaps to check and organizer announcements show up here."}<//>` : null}
      <p class="fine">Roster doesn't send push notifications. This list only fills up when people respond to you.</p>
    </div></div>
  </div>`;
}

function SavedView() {
  const app = useApp();
  const list = Object.values(app.saved).sort((a, b) => b.ts - a.ts);
  return html`<div class="page">
    <${PageHead} title="Saved" sub=${list.length ? plural(list.length, "message") : ""} />
    <div class="scroller page-scroll"><div class="page-in">
      ${list.length ? html`<div class="group">${list.map((s) => html`<div class="savedrow" key=${s.id}>
        <button class="grow savedrow-b" onClick=${() => app.openCourse(s.cid, "chat", s.mid)}>
          <${Avatar} uid=${s.by} size=${36} />
          <span class="grow"><span class="savedrow-h"><b>${app.person(s.by).name}</b><span class="tm">${course(app, s.cid).code} · ${relShort(s.at)}</span></span>
            <small>${s.kind === "photo" ? "📷 " : s.kind === "poll" ? "📊 " : s.kind === "event" ? "📅 " : ""}${s.text || "Photo"}</small></span></button>
        <button class="iconbtn sm" onClick=${() => app.save(s.cid, { id: s.mid, by: s.by, ts: s.at, text: s.text, kind: s.kind })} aria-label="Remove from Saved"><${Icon} name="bookmark" size=${18} fill=${true} /></button>
      </div>`)}</div>` : html`<${Empty} icon="bookmark" title="Nothing saved">Save a message from its menu to find it here later: a link to the review sheet, a photo of the board, an explanation that clicked.<//>`}
    </div></div>
  </div>`;
}

function TasksView() {
  const app = useApp();
  useTick(60000);
  const now = Clock.now();
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = app.tasks.filter((t) => !t.done);
  const endToday = Sched.addDays(Sched.startOfDay(now), 1);
  const today = open.filter((t) => t.due && t.due < endToday).sort((a, b) => a.due - b.due);
  const upcoming = open.filter((t) => t.due && t.due >= endToday).sort((a, b) => a.due - b.due);
  const anytime = open.filter((t) => !t.due).sort((a, b) => b.ts - a.ts);
  const done = app.tasks.filter((t) => t.done).sort((a, b) => b.done - a.done);
  // Due dates in your classes you haven't turned into tasks yet.
  const fromDue = [];
  for (const cid of app.myCourses) for (const d of ((app.hubs[cid] && app.hubs[cid].due) || [])) if (d.at > now && !app.tasks.some((t) => t.from === cid + ":" + d.id)) fromDue.push({ ...d, cid });
  fromDue.sort((a, b) => a.at - b.at);
  const add = async () => { const t = title.trim(); if (!t) return; setTitle(""); await app.addTask({ title: t, quiet: true }); };
  const Sec = (t, arr, icon) => (arr.length ? html`<section><h2 class="sec-h">${icon ? html`<${Icon} name=${icon} size=${18} fill=${true} />` : null}${t}</h2><div class="group">${arr.map((x) => html`<${TaskRow} key=${x.id} t=${x} />`)}</div></section>` : null);
  return html`<div class="page">
    <${PageHead} title="Tasks" sub=${open.length ? plural(open.length, "open task") : "All done"}><button class="iconbtn" onClick=${() => app.open("task-new")} aria-label="New task with a date"><${Icon} name="calendarPlus" size=${22} /></button><//>
    <div class="scroller page-scroll"><div class="page-in">
      ${app.canWrite ? html`<div class="quickadd"><${Icon} name="plus" size=${18} /><input class="grow" placeholder="New task" value=${title} onInput=${(e) => setTitle(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && !e.isComposing && add()} aria-label="New task" />${title.trim() ? html`<button class="btn sm primary" onClick=${add}>Add</button>` : null}</div>` : null}
      ${Sec("Today", today, "star")}${Sec("Upcoming", upcoming)}${Sec("Anytime", anytime)}
      ${fromDue.length ? html`<section><h2 class="sec-h">From your classes</h2><div class="group">${fromDue.slice(0, 5).map((d) => html`<div class="taskrow ghost" key=${d.cid + d.id}>
        <span class="flag calm"><${Icon} name="flag" size=${14} /></span>
        <span class="grow taskrow-t"><b>${d.title}</b><small>${course(app, d.cid).code} · <span class=${"due-tone " + dueLadder(d.at).tone}>${dueLadder(d.at).text}</span></small></span>
        <button class="btn sm soft" onClick=${() => app.addTask({ title: "Start " + d.title, cid: d.cid, due: d.at, from: d.cid + ":" + d.id })}>Add</button></div>`)}</div></section>` : null}
      ${!open.length && !fromDue.length ? html`<${Empty} icon="checkSquare" title="Nothing to do">Add a task, or turn a due date in one of your classes into one.<//>` : null}
      ${done.length ? html`<button class="link logbook" onClick=${() => setShowDone(!showDone)}>${showDone ? "Hide" : "Show"} ${plural(done.length, "completed task")}</button>${showDone ? html`<div class="group">${done.map((t) => html`<${TaskRow} key=${t.id} t=${t} />`)}</div>` : null}` : null}
      <p class="fine">Tasks are private. Only you can see them.</p>
    </div></div>
  </div>`;
}

function TaskNewSheet({ cid: cid0, onClose }) {
  const app = useApp();
  const [title, setTitle] = useState("");
  const [cid, setCid] = useState(cid0 || "");
  const [when, setWhen] = useState("");
  const quick = [["Tonight", Sched.startOfDay(Clock.now()) + 21 * 3600e3], ["Tomorrow", Sched.startOfDay(Sched.addDays(Clock.now(), 1)) + 17 * 3600e3], ["This weekend", Sched.addDays(Sched.startOfWeek(Clock.now()), 5) + 12 * 3600e3]].filter(([, t]) => t > Clock.now());
  const save = async () => { if (!title.trim()) return; const ok = await app.addTask({ title: title.trim(), cid, due: fromLocalInput(when) || 0 }); if (ok) onClose(); };
  return html`<${Sheet} title="New task" icon="checkSquare" onClose=${onClose} footer=${html`<button class="btn primary" disabled=${!title.trim()} onClick=${save}>Add task</button>`}>
    <label class="field"><span>Task</span><input class="input lg" placeholder="Start PSet 5 problem 3" value=${title} onInput=${(e) => setTitle(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && save()} autofocus /></label>
    <label class="field"><span>Class</span><select class="input" value=${cid} onChange=${(e) => setCid(e.target.value)}><option value="">Personal</option>${app.myCourses.filter(Catalog.isCourse).map((c) => html`<option value=${c}>${course(app, c).code}</option>`)}</select></label>
    <label class="field"><span>When <small>optional</small></span><input class="input" type="datetime-local" value=${when} onInput=${(e) => setWhen(e.target.value)} /></label>
    <div class="chips">${quick.map(([l, t]) => html`<button key=${l} class=${"chip" + (when === toLocalInput(t) ? " on" : "")} onClick=${() => setWhen(toLocalInput(t))}>${l}</button>`)}</div>
  <//>`;
}

// ---- You ------------------------------------------------------------------------------
function useTheme() {
  const [t, setT] = useState(() => LS.get("roster:theme", "system"));
  useEffect(() => { if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }, [t]);
  return [t, (v) => { setT(v); LS.set("roster:theme", v); }];
}
function YouView() {
  const app = useApp();
  const me = app.me || {};
  const p = app.person(app.uid);
  const [theme, setTheme] = useTheme();
  const st = me.status && me.status.e && me.status.until > Clock.now() ? me.status : null;
  const friends = Object.values(me.following || {}).filter(Boolean).length;
  const Row = ({ icon, label, value, run, danger, tint }) => html`<button class=${"setrow" + (danger ? " danger" : "")} onClick=${run}><span class="set-ic" style=${tint ? { background: tint } : null}><${Icon} name=${icon} size=${18} fill=${true} /></span><span class="grow">${label}</span>${value ? html`<span class="set-v">${value}</span>` : null}<${Icon} name="chevronRight" size=${16} /></button>`;
  return html`<div class="page">
    <${PageHead} title="You" />
    <div class="scroller page-scroll"><div class="page-in">
      <button class="youcard" onClick=${() => app.open("profile", { uid: app.uid })}>
        <${Avatar} uid=${app.uid} size=${64} />
        <span class="grow"><b>${p.name}</b><small>${[me.year && "Class of 20" + me.year.slice(1), me.house, me.concentration].filter(Boolean).join(" · ")}</small>
          <small class="youcard-link">See your profile as classmates do</small></span><${Icon} name="chevronRight" size=${16} /></button>
      <div class="group">
        <${Row} icon="edit" label="Edit profile" run=${() => app.open("edit-profile")} tint="var(--c5-solid)" />
        <${Row} icon="smile" label="Status" value=${st ? st.e + " " + st.text : "None"} run=${() => app.open("status")} tint="var(--c3-solid)" />
        <${Row} icon="users" label="Friends" value=${String(friends)} run=${() => app.setRoute({ view: "people" })} tint="var(--c7-solid)" />
      </div>
      <h2 class="sec-h">Classes</h2>
      <div class="group">
        ${app.myCourses.map((cid) => html`<div class="setrow static" key=${cid}><${Tile} courseId=${cid} size=${30} /><span class="grow">${course(app, cid).code}${me.sections && me.sections[cid] && Catalog.slot(me.sections[cid]) ? html`<small> · Section ${Catalog.slot(me.sections[cid]).label}</small>` : null}</span>
          ${Catalog.isCourse(cid) ? html`<button class="btn sm ghost" onClick=${() => app.open("confirm", { title: "Leave " + course(app, cid).code + "?", body: "You'll stop seeing its chat. Your messages stay. You can add it again anytime.", cta: "Leave", danger: true, run: () => app.leaveCourse(cid) })}>Leave</button>` : html`<small class="muted">Auto</small>`}</div>`)}
        <${Row} icon="plus" label="Add a class" run=${() => app.open("add-classes")} tint="var(--c2-solid)" />
        <${Row} icon="calendar" label="Class times" run=${() => app.open("meetings")} tint="var(--c10-solid)" />
      </div>
      <h2 class="sec-h">Appearance</h2>
      <div class="group pad"><${Seg} value=${theme} onChange=${setTheme} label="Theme" options=${[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} /></div>
      <h2 class="sec-h">Help</h2>
      <div class="group">
        <${Row} icon="shield" label="Community guidelines" run=${() => app.open("pledge", { readOnly: true })} tint="var(--school-fill)" />
        <${Row} icon="keyboard" label="Keyboard shortcuts" value="?" run=${() => app.open("shortcuts")} tint="var(--ink-3)" />
        <${Row} icon="info" label="About this study" run=${() => app.open("about")} tint="var(--c6-solid)" />
      </div>
      ${app.isOrganizer ? html`<h2 class="sec-h">Organizer${app.demo ? " (demo)" : ""}</h2><div class="group">
        <${Row} icon="chart" label="Experiment results" run=${() => app.open("organizer", { courseId: app.myCourses.find(Catalog.isCourse) || "stat110", tab: "results" })} tint="var(--school-fill)" />
        <${Row} icon="ai" label="Draft a recap" run=${() => app.open("organizer", { courseId: app.myCourses.find(Catalog.isCourse) || "stat110", tab: "recap" })} tint="var(--c8-solid)" /></div>` : null}
      <h2 class="sec-h">${app.demo ? "Demo" : "Class"}</h2>
      <div class="group">
        ${app.demo ? html`<${Row} icon="history" label="Reset the demo class" run=${() => app.open("confirm", { title: "Reset the demo?", body: "Everything you did in the demo is cleared and you'll start onboarding again.", cta: "Reset", danger: true, run: () => app.resetDemo() })} tint="var(--ink-3)" />` : null}
        ${app.demo && app.rt.live && app.rt.canWrite !== false && !Notice.liveDenied ? html`<${Row} icon="door" label="Join the live class" run=${() => app.switchMode("live")} tint="var(--school-fill)" />` : null}
        ${!app.demo ? html`<${Row} icon="play" label="Open the demo class" run=${() => app.switchMode("demo")} tint="var(--ink-3)" />` : null}
      </div>
      <p class="fine">Roster · Harvard Fall 2026. Run by a student for ES30, not affiliated with Harvard or course staff.</p>
    </div></div>
  </div>`;
}
