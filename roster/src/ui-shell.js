// ---------------------------------------------------------------------------
// App shell. One information architecture on phone and desktop (HIG
// sidebarAdaptable; Discord's 2023–26 split as the warning):
//   phone   — Saturn-style tab bar: Now · Classes · Calendar · Board · People,
//             header bell (Activity) + avatar (You); ⌘K / search icon.
//   desktop — sidebar with the same destinations + your classes and spaces.
// Linear "G then key" shortcuts, ⌘K palette, "?" legend (GitHub).
// ---------------------------------------------------------------------------
const NAV = [
  ["now", "Now", "clock"],
  ["classes", "Classes", "chats"],
  ["calendar", "Calendar", "calendar"],
  ["board", "Board", "board"],
  ["people", "People", "users"],
];
function BootScreen() {
  return html`<div class="boot"><div class="boot-mark">roster</div><div class="boot-sub">Opening your classes…</div></div>`;
}

function useShortcuts() {
  const app = useApp();
  const pending = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); app.open("palette", {}); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || app.sheets.length) return;
      if (e.key === "/") { e.preventDefault(); app.open("palette", {}); return; }
      if (e.key === "?") { app.open("shortcuts"); return; }
      if (pending.current) {
        const k = e.key.toLowerCase();
        clearTimeout(pending.current); pending.current = null;
        const map = { n: "now", c: "classes", l: "calendar", b: "board", p: "people", a: "activity", s: "saved", t: "tasks", y: "you" };
        if (map[k]) app.setRoute({ view: map[k] });
        else if (/^[1-9]$/.test(k) && app.myCourses[+k - 1]) app.openCourse(app.myCourses[+k - 1]);
        return;
      }
      if (e.key.toLowerCase() === "g") pending.current = setTimeout(() => (pending.current = null), 900);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

function AppShell() {
  const app = useApp();
  useShortcuts();
  const wide = useMedia("(min-width: 1024px)");
  const r = app.route;
  const inClass = r.view === "class" && r.courseId && app.myCourses.includes(r.courseId);
  const view = inClass ? "class" : r.view === "class" ? "classes" : r.view;
  const inboxN = useInboxCount();
  const navTo = (v) => app.setRoute({ view: v });
  let main;
  if (view === "class") main = html`<${ClassView} key=${r.courseId} courseId=${r.courseId} tab=${r.tab} onBack=${() => app.setRoute({ view: "classes" })} />`;
  else if (view === "now") main = html`<${NowView} />`;
  else if (view === "classes") main = wide && app.myCourses[0] ? html`<${ClassView} key=${app.myCourses[0]} courseId=${app.myCourses[0]} tab="chat" onBack=${() => {}} />` : html`<${ClassesView} />`;
  else if (view === "calendar") main = html`<${CalendarView} />`;
  else if (view === "board") main = html`<${BoardView} />`;
  else if (view === "people") main = html`<${PeopleView} />`;
  else if (view === "activity") main = html`<${ActivityView} />`;
  else if (view === "saved") main = html`<${SavedView} />`;
  else if (view === "tasks") main = html`<${TasksView} />`;
  else if (view === "you") main = html`<${YouView} />`;
  else main = html`<${NowView} />`;
  const tabView = ["now", "classes", "calendar", "board", "people"].includes(view) ? view : view === "class" ? "classes" : null;
  return html`<div class=${"shell" + (wide ? " wide" : "") + (view === "class" ? " in-class" : "")}>
    ${app.banner}
    <div class="shell-body">
      ${wide ? html`<${Sidebar} view=${view} inboxN=${inboxN} />` : null}
      <main class="main" id="main">${main}</main>
    </div>
    ${!wide && view !== "class" ? html`<nav class="tabbar" aria-label="Main">${NAV.map(([k, l, ic]) => html`<button key=${k} class=${tabView === k ? "on" : ""} aria-current=${tabView === k ? "page" : undefined} onClick=${() => navTo(k)}>
      <span class="tb-ic"><${Icon} name=${ic} size=${26} fill=${tabView === k} />${k === "classes" && unreadTotal(app) ? html`<i class="tb-dot"></i>` : null}</span><span>${l}</span></button>`)}</nav>` : null}
  </div>`;
}
function unreadTotal(app) {
  let n = 0;
  for (const cid of app.myCourses) { const f = app.feeds[cid]; if (!f) continue; const lr = app.lastRead(cid, "main"); n += f.filter((m) => m.ts > lr && m.by !== app.uid && (m.thread || "main") === "main" && m.kind !== "system").length; }
  return n;
}
function useInboxCount() {
  const app = useApp();
  return useMemo(() => {
    const seen = app.inboxSeen();
    const items = Derive.inbox({ uid: app.uid, feeds: Object.fromEntries(Object.entries(app.feeds).filter(([, f]) => f)), fixes: app.fixes.map((f) => ({ ...f, appliedAt: appliedAt(f) })) });
    return items.filter((i) => i.ts > seen && i.kind !== "recap").length;
  }, [app.feeds, app.fixes, app.lrVersion]);
}

// Header used by top-level views (iOS large title; actions on the right like Saturn's inbox icon).
function PageHead({ title, sub, children }) {
  const app = useApp();
  const wide = useMedia("(min-width: 1024px)");
  const inboxN = useInboxCount();
  return html`<header class="pagehead">
    <div class="pagehead-t"><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : null}</div>
    <div class="pagehead-a">${children}
      ${!wide ? html`<button class="iconbtn" onClick=${() => app.open("palette", {})} aria-label="Search"><${Icon} name="search" size=${22} /></button>
      <button class="iconbtn badge-host" onClick=${() => app.setRoute({ view: "activity" })} aria-label=${"Activity" + (inboxN ? ", " + inboxN + " new" : "")}><${Icon} name="bell" size=${22} />${inboxN ? html`<span class="badge">${inboxN > 9 ? "9+" : inboxN}</span>` : null}</button>
      <button class="me-btn" onClick=${() => app.setRoute({ view: "you" })} aria-label="You"><${Avatar} uid=${app.uid} size=${32} /></button>` : null}
    </div>
  </header>`;
}

function Sidebar({ view, inboxN }) {
  const app = useApp();
  const r = app.route;
  const courses = app.myCourses.filter(Catalog.isCourse), spaces = app.myCourses.filter((c) => !Catalog.isCourse(c));
  const me = app.person(app.uid);
  const item = (k, label, icon, n, cur) => html`<button class=${"nav-i" + (cur ? " on" : "")} onClick=${() => app.setRoute({ view: k })} aria-current=${cur ? "page" : undefined}><${Icon} name=${icon} size=${20} fill=${cur} /><span class="grow">${label}</span>${n ? html`<span class="nav-n">${n}</span>` : null}</button>`;
  return html`<aside class="sidebar" aria-label="Navigation">
    <div class="side-top">
      <span class="wordmark">roster</span><span class="schoolchip"><i></i>Harvard · Fall 26</span>
      <span class="grow"></span>
      <button class="iconbtn" onClick=${() => app.open("palette", {})} aria-label="Search (⌘K)" title="Search  ⌘K"><${Icon} name="search" size=${20} /></button>
    </div>
    <button class="searchbar" onClick=${() => app.open("palette", {})}><${Icon} name="search" size=${16} /><span class="grow">Search or jump to…</span><kbd>⌘K</kbd></button>
    <nav class="side-nav">
      ${item("now", "Now", "clock", 0, view === "now")}
      ${item("activity", "Activity", "bell", inboxN, view === "activity")}
      ${item("calendar", "Calendar", "calendar", 0, view === "calendar")}
      ${item("board", "Board", "board", 0, view === "board")}
      ${item("people", "People", "users", 0, view === "people")}
      ${item("tasks", "Tasks", "tasks", app.tasks.filter((t) => !t.done).length, view === "tasks")}
      ${item("saved", "Saved", "bookmark", 0, view === "saved")}
    </nav>
    <div class="side-h"><span>Classes</span><button class="iconbtn sm" onClick=${() => app.open("add-classes")} aria-label="Add a class"><${Icon} name="plus" size=${16} /></button></div>
    <div class="side-list">${courses.map((cid, i) => html`<${SideClass} key=${cid} courseId=${cid} on=${(view === "class" && r.courseId === cid) || (view === "classes" && i === 0)} />`)}</div>
    ${spaces.length ? html`<div class="side-h"><span>Spaces</span></div><div class="side-list">${spaces.map((cid) => html`<${SideClass} key=${cid} courseId=${cid} on=${view === "class" && r.courseId === cid} />`)}</div>` : null}
    <span class="grow"></span>
    <button class="me-island" onClick=${() => app.setRoute({ view: "you" })}>
      <${Avatar} uid=${app.uid} size=${32} />
      <span class="grow me-t"><b>${me.name}</b><small>${app.me && app.me.status && app.me.status.e && app.me.status.until > Clock.now() ? app.me.status.e + " " + app.me.status.text : [tagLine(me), app.demo ? "demo" : ""].filter(Boolean).join(" · ")}</small></span>
      <${Icon} name="settings" size=${18} />
    </button>
  </aside>`;
}
function classUnread(app, cid) {
  const f = app.feeds[cid];
  if (!f) return 0;
  const lr = app.lastRead(cid, "main");
  return f.filter((m) => m.ts > lr && m.by !== app.uid && (m.thread || "main") === "main" && m.kind !== "system").length;
}
function SideClass({ courseId, on }) {
  const app = useApp();
  const n = on ? 0 : classUnread(app, courseId);
  const c = course(app, courseId);
  return html`<button class=${"side-c" + (on ? " on" : "") + (n ? " unread" : "")} onClick=${() => app.openCourse(courseId)} aria-current=${on ? "page" : undefined}>
    <${Tile} courseId=${courseId} size=${26} /><span class="grow side-c-t">${c.code}</span>${n ? html`<span class="nav-n accent">${n > 99 ? "99+" : n}</span>` : null}</button>`;
}

// ---- Classes list (phone) — Saturn's class rows + iMessage-style previews ----
function ClassesView() {
  const app = useApp();
  useTick(30000);
  const courses = app.myCourses.filter(Catalog.isCourse), spaces = app.myCourses.filter((c) => !Catalog.isCourse(c));
  return html`<div class="page">
    <${PageHead} title="Classes"><button class="iconbtn" onClick=${() => app.open("add-classes")} aria-label="Add a class"><${Icon} name="plus" size=${22} /></button><//>
    <div class="scroller page-scroll"><div class="page-in">
      <section class="group">${courses.map((cid) => html`<${ClassRow} key=${cid} courseId=${cid} />`)}</section>
      ${spaces.length ? html`<h2 class="sec-h">Spaces</h2><section class="group">${spaces.map((cid) => html`<${ClassRow} key=${cid} courseId=${cid} />`)}</section>` : null}
      <button class="addrow" onClick=${() => app.open("add-classes")}><${Icon} name="plus" size=${18} />Add a class</button>
    </div></div>
  </div>`;
}
function ClassRow({ courseId }) {
  const app = useApp();
  const f = app.feeds[courseId] || [];
  const c = course(app, courseId);
  const last = [...f].reverse().find((m) => !m.deleted && !m.hidden && (m.thread || "main") === "main");
  const n = classUnread(app, courseId);
  const preview = !last ? "No messages yet" : last.kind === "recap" ? html`<i>${last.text.replace(/^Lecture \d+ recap: /, "Recap · ")}</i>` : last.kind === "system" ? last.text
    : html`<b>${last.by === app.uid ? "You" : firstName(app.person(last.by).name)}:</b> ${last.kind === "photo" ? "📷 Photo" : last.kind === "poll" ? "📊 " + last.poll.question : last.kind === "event" ? "📅 " + last.event.title : last.text}`;
  return html`<button class=${"crow" + (n ? " unread" : "")} onClick=${() => app.openCourse(courseId)}>
    <${Tile} courseId=${courseId} size=${48} />
    <span class="crow-b"><span class="crow-top"><b>${c.code}</b><span class="crow-when">${last ? relShort(last.ts) : ""}</span></span>
      <span class="crow-bot"><span class="crow-prev">${preview}</span>${n ? html`<span class="badge">${n > 99 ? "99+" : n}</span>` : null}</span></span>
  </button>`;
}
