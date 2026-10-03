// ---------------------------------------------------------------------------
// Session: one mode (live class or demo class), its data, its actions.
// ---------------------------------------------------------------------------
const DEMO_KEY = "roster-demo-v4";
const Notice = { liveDenied: false, next: null };
let demoDB = null;
function getDemoDB() {
  if (!demoDB) {
    demoDB = LocalDB.create({ persistKey: DEMO_KEY });
    if (demoDB._isEmpty()) demoDB._seed(Demo.seed());
  }
  return demoDB;
}
const DEMO_ONLINE = new Set(["maya", "dev", "nora", "mei", "theo", "leila", "kofi", "ana", "zara", "jonah", "sam"].map((k) => "u_demo_" + k));
const errCopy = (e) => {
  const c = e && e.code;
  if (c === "invalid_argument") return "You don't have permission to change that here.";
  if (c === "quota_exceeded") return "This class chat has hit its storage limit. Tell the organizer.";
  if (c === "resource_exhausted") return "Slow down a little and try again.";
  return "That didn't go through. Check your connection and try again.";
};

function Session({ rt, mode, switchMode }) {
  const demo = mode === "demo";
  const db = demo ? getDemoDB() : rt.db;
  const uid = demo ? Demo.ME : rt.uid;
  useMemo(() => { Clock.offset = demo ? Demo.NOW - Date.now() : 0; }, [demo]);
  const [readOnly, setReadOnly] = useState(!demo && rt.canWrite === false);
  const canWrite = !readOnly;
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  useEffect(() => { if (Notice.next) { const m = Notice.next; Notice.next = null; setTimeout(() => toast(m), 300); } }, []);
  const liveOK = rt.live && rt.canWrite !== false && !Notice.liveDenied;
  const membersRaw = useCollection(() => db.collection("members"), [db]);
  const members = membersRaw || [];
  const myDoc = useDocData(() => db.doc("members/" + uid), [db, uid]);
  const config = useDocData(() => (demo ? null : db.doc("config/app")), [db]);
  const [profiles, setProfiles] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [peers, setPeers] = useState([]);
  const [route, setRoute] = useState(() => ({ courseId: LS.get("roster:last:" + mode, null), tab: "chat" }));
  const [pane, setPane] = useState("list");
  const [organizer, setOrganizer] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lrVersion, setLrVersion] = useState(0);
  const [arriving, setArriving] = useState(false); // keeps onboarding up through the arrival reveal
  const presenceRef = useRef({ c: null, t: 0 });

  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const isOrganizerReal = !demo && !!rt.isOwner;
  const organizerIds = demo ? [Demo.ORGANIZER] : [...new Set([...((config && config.organizers) || []), ...(isOrganizerReal ? [uid] : [])])];
  const customCourses = useMemo(() => {
    const out = {};
    for (const m of members) for (const [id, code] of Object.entries(m.courseCodes || {})) out[id] = { id, code, title: "", who: "", meets: "", where: "", size: 0, psets: "" };
    return out;
  }, [members]);

  // Owner registers as organizer once, so their activity stays out of the metrics.
  useEffect(() => {
    if (!demo && isOrganizerReal && config !== null && !((config && config.organizers) || []).includes(uid)) {
      db.doc("config/app").set({ ...(config || {}), organizers: [...((config && config.organizers) || []), uid] }).catch(() => {});
    }
  }, [config, isOrganizerReal]);

  // Profile photos for live members (names come from what people typed at sign-up).
  useEffect(() => {
    if (demo || !rt.user) return;
    const ids = [...new Set([uid, ...members.map((m) => m.id)])].filter((id) => id && !profiles[id]);
    if (!ids.length) return;
    rt.user.profiles(ids).then((ps) => setProfiles((p) => ({ ...p, ...ps }))).catch(() => {});
  }, [members]);

  // Presence: who's here now and who's typing (live only).
  useEffect(() => {
    if (demo || !rt.room) return;
    let off = null;
    try { off = rt.room.onPeers((ch) => setPeers(ch.peers), () => setPeers([])); } catch (_) { /* no room */ }
    return () => off && off();
  }, [demo]);
  const pushPresence = (patch) => {
    if (demo || !rt.room) return;
    presenceRef.current = { ...presenceRef.current, ...patch };
    rt.room.presence(presenceRef.current).catch(() => {});
  };
  useEffect(() => { pushPresence({ c: route.courseId, t: 0 }); }, [route.courseId]);

  const online = useMemo(() => {
    if (demo) return DEMO_ONLINE;
    const s = new Set();
    for (const p of peers) if (p.kind === "viewer" && p.by) s.add(p.by);
    return s;
  }, [peers, demo]);

  const person = (id) => {
    const m = membersById[id], pr = profiles[id], d = demo ? Demo.people[id] : null;
    const name = (m && m.displayName) || (pr && pr.name) || (d && d.name) || (id === uid ? "You" : "Classmate");
    const photo = pr && pr.avatarUrl && !/^data:/.test(pr.avatarUrl) ? pr.avatarUrl : "";
    return {
      id, name, avatarUrl: photo,
      color: (d && d.color) || (pr && pr.color) || ["#CC5049", "#D67722", "#955CDB", "#3A9A1F", "#2B8FAA", "#2F7CC2", "#C7508B"][hash(id || "") % 7],
      house: m && m.house, year: m && m.year, concentration: m && m.concentration,
    };
  };

  const write = async (fn, ok) => {
    if (!canWrite) { toast("You can read this class but not post."); return false; }
    try { await fn(); if (ok) toast(ok); return true; }
    catch (e) {
      if (e && e.code === "unavailable") {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        try { await fn(); if (ok) toast(ok); return true; } catch (e2) { toast(errCopy(e2)); return false; }
      }
      if (e && e.code === "invalid_argument" && !demo && !isOrganizerReal) {
        if (!myDoc) {
          // Not a member of the live class (e.g. viewing by a public link): show the demo instead.
          Notice.liveDenied = true;
          Notice.next = "You can view this page but not join the live class. Here's the demo class instead.";
          switchMode("demo");
          return false;
        }
        setReadOnly(true);
      }
      toast(errCopy(e));
      return false;
    }
  };
  const msgs = (c) => db.collection("courses/" + c + "/messages");

  const app = {
    rt, mode, demo, live: !demo, liveOK, db, uid, canWrite, isOrganizerReal, isOrganizer: demo || isOrganizerReal, organizerIds,
    sample: rt.sample, downloads: rt.downloads, members, membersById, me: myDoc || null, customCourses, online, person,
    viewerName: rt.me && rt.me.name, replyTo, setReplyTo, toast, write, lrVersion,
    switchMode: (m) => { LS.set("roster:mode", m); switchMode(m); },
    openOrganizer: (tab) => setOrganizer({ tab }),
    typing: (cid) => (demo ? [] : peers.filter((p) => !p.isMe && p.by && p.presence && p.presence.c === cid && p.presence.t && Date.now() - p.presence.t < 7000).map((p) => p.by)),
    setTyping: (cid, on) => pushPresence({ c: cid, t: on ? Date.now() : 0 }),
    send: (cid, { text, thread, tags, mentions }) => {
      const body = { by: uid, ts: Clock.now(), text, thread: thread || "main", kind: "text", reactions: {} };
      if (replyTo) body.replyTo = replyTo.id;
      if (tags) body.tags = tags;
      if (mentions) body.mentions = mentions;
      setReplyTo(null);
      return write(() => msgs(cid).add(body));
    },
    react: (cid, m, e) => {
      const mine = !!(m.reactions && m.reactions[e] && m.reactions[e][uid]);
      return write(() => msgs(cid).doc(m.id).update({ reactions: { [e]: { [uid]: mine ? 0 : Clock.now() } } }));
    },
    deleteMsg: (cid, m) => write(() => msgs(cid).doc(m.id).update({ deleted: true, text: "", attachments: [] }), "Message deleted"),
    sendDue: (cid, d) => write(() => msgs(cid).add({ by: uid, ts: Clock.now(), thread: "main", kind: "due", due: d, text: d.title, reactions: {} }), "Sent to the class chat"),
    toggleCheck: (cid, rid, bid, mine) => {
      const ref = db.doc("courses/" + cid + "/checks/" + rid + "~" + bid + "~" + uid);
      return write(() => (mine ? ref.delete() : ref.set({ recapId: rid, bulletId: bid, by: uid, ts: Clock.now() })));
    },
    suggestFix: (cid, f) => write(() => db.collection("courses/" + cid + "/fixes").add({ ...f, by: uid, ts: Clock.now(), votes: {}, nays: {}, status: "open" }), "Fix suggested. Classmates can now agree with it."),
    voteFix: async (cid, f, v) => {
      const willApply = v === "yes" && !autoApplied(f) && agreeN(f) + ((f.votes || {})[uid] ? 0 : 1) >= APPLY_AT && agreeN(f) + 1 >= 2 * (nayN(f) - ((f.nays || {})[uid] ? 1 : 0));
      const ok = await write(() => db.doc("courses/" + cid + "/fixes/" + f.id).update({ votes: { [uid]: v === "yes" ? Clock.now() : 0 }, nays: { [uid]: v === "no" ? Clock.now() : 0 } }));
      if (ok && willApply) toast("That was the third yes. The fix now replaces the AI's line for everyone.");
      return ok;
    },
    resolveFix: async (cid, f, status) => {
      const ok = await write(() => db.doc("courses/" + cid + "/fixes/" + f.id).update({ status }));
      if (ok && status === "applied") {
        const ref = db.doc("recaps/" + cid + "/items/" + f.recapId);
        const s = await ref.get();
        if (s.exists) {
          const r = s.data();
          await write(() => ref.set({ ...r, bullets: r.bullets.map((b) => (b.id === f.bulletId ? { ...b, fixedBy: f.id, fixedText: f.text } : b)) }), "Fix applied.");
        }
      }
      return ok;
    },
    postRecap: async (cid, r) => {
      const rid = "rc-" + Date.now().toString(36);
      const by = demo ? Demo.ORGANIZER : uid;
      const ok = await write(() => db.doc("recaps/" + cid + "/items/" + rid).set({ ...r, ts: Clock.now(), by }));
      if (!ok) return false;
      return write(() => msgs(cid).doc("rm-" + rid).set({ by, ts: Clock.now(), thread: "main", kind: "recap", recapId: rid, text: "Lecture " + r.lecture + " recap: " + r.title, reactions: {} }), "Recap posted. Classmates can now check it.");
    },
    joinCourses: async ({ displayName, year, house, concentration, picked }) => {
      const prev = myDoc || {};
      const now = Clock.now();
      const courses = { ...(prev.courses || {}) };
      const codes = { ...(prev.courseCodes || {}) };
      for (const p of picked) { if (!courses[p.id]) courses[p.id] = now; if (p.code && !Catalog.byId[p.id]) codes[p.id] = p.code; }
      const body = { ...prev, displayName: displayName || prev.displayName || "", year: year || prev.year || "", house: house || prev.house || "", concentration: concentration != null ? concentration : prev.concentration || "", courses, courseCodes: codes, joinedAt: prev.joinedAt || now, visits: prev.visits || {} };
      delete body.id;
      return write(() => db.doc("members/" + uid).set(body));
    },
    markVisit: (cid) => {
      if (!myDoc || !canWrite) return;
      const k = dayKey(Clock.now());
      if (myDoc.visits && myDoc.visits[cid] && myDoc.visits[cid][k]) return;
      db.doc("members/" + uid).update({ visits: { [cid]: { [k]: Clock.now() } } }).catch(() => {});
    },
    markRead: (cid, thread) => { LS.set("roster:lr:" + mode + ":" + cid + ":" + (thread || "main"), Clock.now()); setLrVersion((v) => v + 1); },
    resetDemo: () => { if (demoDB) { demoDB._reset(); demoDB._seed(Demo.seed()); } LS.set("roster:last:demo", null); try { Object.keys(localStorage).filter((k) => k.startsWith("roster:lr:demo") || k.startsWith("roster:draft:")).forEach((k) => localStorage.removeItem(k)); } catch (_) {} location.hash = ""; switchMode("demo-reset-" + Date.now()); },
    openCourse: (cid) => { setRoute({ courseId: cid, tab: "chat" }); setPane("chat"); LS.set("roster:last:" + mode, cid); setReplyTo(null); },
    openAdd: () => setAddOpen(true),
    go: (tab) => setRoute((r) => ({ ...r, tab })),
  };

  const banner = demo
    ? html`<div class="banner"><span class="emo">🧪</span><span class="grow"><b>Demo class.</b> Example classmates, STAT 110, Sat Oct 3. Your posts stay in this browser.</span>
        <button onClick=${app.resetDemo}>Reset</button>${liveOK ? html`<button onClick=${() => app.switchMode("live")}>Live class →</button>` : null}</div>`
    : readOnly ? html`<div class="banner"><span class="grow"><b>Read-only.</b> You can't post in the live class.</span><button onClick=${() => app.switchMode("demo")}>Try the demo →</button></div>` : null;
  app.banner = banner;

  let body;
  if (membersRaw === null || myDoc === null) body = html`<div class="boot"><div class="boot-mark">roster</div><div class="boot-sub">Opening your classes…</div></div>`;
  else if (arriving || !myDoc || !Object.keys(myDoc.courses || {}).length) body = html`<${Onboarding} onJoining=${(v) => setArriving(v)} onDone=${(cid) => { setArriving(false); app.openCourse(cid); }} />`;
  else body = html`<${Shell} route=${route} pane=${pane} setPane=${setPane} />`;

  return html`<${Ctx.Provider} value=${app}>
    ${body}
    ${organizer && route.courseId ? html`<${OrganizerModal} courseId=${route.courseId} initialTab=${organizer.tab} onClose=${() => setOrganizer(null)} />` : null}
    ${addOpen ? html`<${AddCoursesModal} onClose=${() => setAddOpen(false)} />` : null}
    <div class="toasts" role="status" aria-live="polite">${toasts.map((t) => html`<div class="toast" key=${t.id}>${t.msg}</div>`)}</div>
  <//>`;
}

function AddCoursesModal({ onClose }) {
  const app = useApp();
  const [picked, setPicked] = useState([]);
  const mine = Object.keys((app.me && app.me.courses) || {});
  const add = async () => {
    const fresh = picked.filter((p) => !mine.includes(p.id));
    const ok = await app.joinCourses({ picked: fresh });
    if (ok) { app.toast(fresh.length ? "You're in " + fresh.length + " more " + (fresh.length === 1 ? "chat" : "chats") : "Already in those"); onClose(); if (fresh[0]) app.openCourse(fresh[0].id); }
  };
  return html`<${Modal} title="Add a class" icon="plus" onClose=${onClose} footer=${html`<button class="btn btn-ghost" onClick=${onClose}>Cancel</button><button class="btn btn-primary" disabled=${!picked.length} onClick=${add}>Join ${picked.length || ""} ${picked.length === 1 ? "chat" : "chats"}</button>`}>
    <${CoursePicker} picked=${picked} setPicked=${setPicked} />
  <//>`;
}

// ---------------------------------------------------------------------------
// Shell: classes | chat | hub
// ---------------------------------------------------------------------------
function Shell({ route, pane, setPane }) {
  const app = useApp();
  const mine = Object.entries((app.me && app.me.courses) || {}).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const courseId = route.courseId && mine.includes(route.courseId) ? route.courseId : mine[0];
  const hubs = useHubs(mine);
  const wide = useMedia("(min-width: 1100px)");
  return html`<div class="app" data-pane=${pane}>
    <aside class="pane pane-side" aria-label="Your classes"><${Sidebar} courses=${mine} current=${courseId} hubs=${hubs} /></aside>
    <main class="pane pane-main">${app.banner}<${CourseView} key=${courseId} courseId=${courseId} tab=${route.tab} hub=${hubs[courseId]} wide=${wide} onBack=${() => setPane("list")} /></main>
    ${wide ? html`<aside class="pane pane-hub" aria-label="Class hub"><${HubPanel} courseId=${courseId} hub=${hubs[courseId]} members=${app.members.filter((m) => m.courses && m.courses[courseId])} /></aside>` : null}
  </div>`;
}
function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}
function useHubs(ids) {
  const app = useApp();
  const [hubs, setHubs] = useState({});
  const key = ids.join(",");
  useEffect(() => {
    const offs = ids.map((id) => app.db.doc("hub/" + id).onSnapshot((s) => setHubs((h) => ({ ...h, [id]: s.exists ? s.data() : null })), () => {}));
    return () => offs.forEach((o) => o());
  }, [key, app.db]);
  return hubs;
}

function Sidebar({ courses, current, hubs }) {
  const app = useApp();
  useTick(1000);
  const [menu, setMenu] = useState(null);
  const now = Clock.now();
  const upcoming = [];
  for (const cid of courses) for (const d of ((hubs[cid] && hubs[cid].due) || [])) if (d.at > now) upcoming.push({ ...d, cid });
  upcoming.sort((a, b) => a.at - b.at);
  const next = upcoming[0];
  const me = app.person(app.uid);
  return html`<div class="pane" style=${{ height: "100%" }}>
    <div class="band">
      <div class="band-top"><span class="wordmark">roster<small>Harvard · Fall 2026</small></span>
        <button class="iconbtn" onClick=${app.openAdd} aria-label="Add a class"><${Icon} name="plus" /></button></div>
      ${next ? html`<button class="countpill" onClick=${() => app.openCourse(next.cid)}><span class="t">${countdown(next.at - now)}</span><span class="txt">until ${next.title} · <span class="emo">${courseLook(next.cid).emoji}</span> ${Catalog.get(next.cid, app.customCourses).code}</span></button>`
        : html`<div class="countpill"><span class="t">—</span><span class="txt">Nothing due. Enjoy it.</span></div>`}
    </div>
    <div class="sheet">
      <div class="sheet-scroll">
        <div class="side-h"><span class="label">Your classes</span></div>
        ${courses.map((cid) => html`<${ClassRow} key=${cid} courseId=${cid} on=${cid === current} />`)}
        ${upcoming.length ? html`<div class="side-h" style=${{ marginTop: "8px" }}><span class="label">Coming up</span></div>
          ${upcoming.slice(0, 5).map((d) => html`<button class="up-row" style=${{ width: "100%", textAlign: "left" }} key=${d.cid + d.id} onClick=${() => app.openCourse(d.cid)}>
            <span class="d"><span>${F.mon.format(d.at)}</span><b>${F.dnum.format(d.at)}</b></span>
            <span class="body"><span class="t1" style=${{ display: "block" }}>${d.title}</span><span class="t2">${Catalog.get(d.cid, app.customCourses).code} · ${F.wds.format(d.at)} ${F.time.format(d.at)}</span></span>
            <span class="left">${countdown(d.at - now)}</span></button>`)}` : null}
      </div>
      <div class="me-island">
        <${Avatar} uid=${app.uid} size=${36} online=${!app.demo} />
        <div class="who"><div class="n">${me.name}</div><div class="s">${[tagLine(me), app.demo ? "demo" : ""].filter(Boolean).join(" · ") || "Harvard College"}</div></div>
        <button class="iconbtn" onClick=${(e) => setMenu(e.currentTarget)} aria-label="Settings"><${Icon} name="settings" /></button>
      </div>
    </div>
    ${menu ? html`<${Popover} anchor=${menu} onClose=${() => setMenu(null)} align="right"><div class="menu" style=${{ minWidth: "230px" }}>
      <button onClick=${() => { setMenu(null); app.openAdd(); }}><${Icon} name="plus" />Add a class</button>
      ${app.isOrganizer ? html`<button onClick=${() => { setMenu(null); app.openOrganizer("results"); }}><${Icon} name="chart" />Organizer tools${app.demo ? " (demo)" : ""}</button>` : null}
      ${app.demo && app.liveOK ? html`<button onClick=${() => app.switchMode("live")}><${Icon} name="users" />Go to the live class</button>` : null}
      ${!app.demo ? html`<button onClick=${() => app.switchMode("demo")}><${Icon} name="book" />Open the demo class</button>` : null}
      ${app.demo ? html`<button onClick=${app.resetDemo}><${Icon} name="history" />Reset the demo</button>` : null}
    </div><//>` : null}
  </div>`;
}

function ClassRow({ courseId, on }) {
  const app = useApp();
  const recent = useCollection(() => app.db.collection("courses/" + courseId + "/messages").orderBy("ts", "desc").limit(40), [courseId, app.db]);
  const c = Catalog.get(courseId, app.customCourses);
  const last = recent && recent.find((m) => !m.deleted);
  const lr = LS.get("roster:lr:" + app.mode + ":" + courseId + ":main", defaultLastRead(app, courseId));
  const unread = on ? 0 : (recent || []).filter((m) => m.ts > lr && m.by !== app.uid && m.thread === "main" && m.kind !== "system").length;
  const preview = last ? (last.kind === "recap" ? html`<b>Recap</b> ${last.text.replace(/^Lecture \d+ recap: /, "")}` : last.kind === "system" ? last.text : html`<b>${last.by === app.uid ? "You" : firstName(app.person(last.by).name)}:</b> ${last.text}`) : "No messages yet. Say hi.";
  return html`<button class=${"class-row" + (on ? " on" : "") + (unread ? " unread" : "")} onClick=${() => app.openCourse(courseId)} aria-current=${on ? "page" : undefined}>
    <${Tile} courseId=${courseId} size=${44} />
    <span class="body"><span class="top"><span class="code">${c.code}</span><span class="when">${last ? relShort(last.ts) : ""}</span></span>
      <span style=${{ display: "flex", alignItems: "center" }}><span class="prev" style=${{ flex: 1 }}>${preview}</span>${unread ? html`<span class="badge">${unread > 99 ? "99+" : unread}</span>` : null}</span></span>
  </button>`;
}
function defaultLastRead(app, cid) {
  if (app.demo) return Clock.now() - 2 * 3600e3;
  return (app.me && app.me.courses && app.me.courses[cid]) || 0;
}

// ---------------------------------------------------------------------------
// One course: header, tabs, and the chat / pset / recaps / hub views.
// ---------------------------------------------------------------------------
function CourseView({ courseId, tab, hub, wide, onBack }) {
  const app = useApp();
  useTick(15000);
  const c = Catalog.get(courseId, app.customCourses);
  const desc = useCollection(() => app.db.collection("courses/" + courseId + "/messages").orderBy("ts", "desc").limit(400), [courseId, app.db]);
  const threads = useCollection(() => app.db.collection("courses/" + courseId + "/threads"), [courseId, app.db]) || [];
  const recapList = useCollection(() => app.db.collection("recaps/" + courseId + "/items"), [courseId, app.db]) || [];
  const fixes = useCollection(() => app.db.collection("courses/" + courseId + "/fixes"), [courseId, app.db]) || [];
  const checks = useCollection(() => app.db.collection("courses/" + courseId + "/checks").limit(1000), [courseId, app.db]) || [];
  const messages = useMemo(() => (desc ? [...desc].reverse() : []), [desc]);
  const byId = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);
  const ctx = useMemo(() => ({ recaps: Object.fromEntries(recapList.map((r) => [r.id, r])), fixes, checks }), [recapList, fixes, checks]);
  const members = useMemo(() => app.members.filter((m) => m.courses && m.courses[courseId]), [app.members, courseId]);
  const lrKey = "roster:lr:" + app.mode + ":" + courseId + ":main";
  const [lastRead] = useState(() => LS.get(lrKey, defaultLastRead(app, courseId)));
  const now = Clock.now();
  const psets = threads.filter((t) => t.kind === "pset").sort((a, b) => (a.due || 0) - (b.due || 0));
  const pset = psets.find((t) => t.due > now - 864e5) || psets[psets.length - 1];
  const mainMsgs = useMemo(() => messages.filter((m) => (m.thread || "main") === "main"), [messages]);
  const openFixes = fixes.filter((f) => !autoApplied(f) && f.status !== "dismissed" && !recapList.some((r) => r.bullets.some((b) => b.fixedBy === f.id))).length;
  const activeTab = tab === "pset" && !pset ? "chat" : tab === "hub" && wide ? "chat" : tab;
  const online = [...app.online].filter((id) => members.some((m) => m.id === id)).length;
  const typing = app.typing(courseId);

  useEffect(() => { app.markVisit(courseId); }, [courseId, !!app.me]);
  useEffect(() => { if (desc && activeTab === "chat") app.markRead(courseId, "main"); }, [desc && desc.length, activeTab]);

  const pins = [];
  const psetFirst = (d) => (/pset|problem set/i.test(d.title) ? 0 : 1);
  for (const d of ((hub && hub.due) || []).filter((x) => x.at > now).sort((a, b) => psetFirst(a) - psetFirst(b) || a.at - b.at).slice(0, 2)) pins.push({ emoji: "📌", text: d.title + " · " + dueWhen(d.at), at: d.at });
  if (hub && hub.rules && hub.rules[0]) pins.push({ emoji: "🤝", text: hub.rules[0] });
  if (hub && hub.notesFolder) pins.push({ emoji: "📁", text: "Lecture notes go in the " + hub.notesFolder.toLowerCase() });

  return html`<div class="pane" style=${{ flex: 1, minHeight: 0 }}>
    <header class="chat-head">
      <button class="iconbtn back" onClick=${onBack} aria-label="Back to classes"><${Icon} name="chevronLeft" /></button>
      <${Tile} courseId=${courseId} size=${40} />
      <div class="meta">
        <div class="t"><span class="code">${c.code}</span>${c.title ? html`<span class="ttl muted" style=${{ fontWeight: 600, fontSize: "14px" }}>${c.short || c.title}</span>` : null}</div>
        <div class="s">${typing.length ? html`<span class="on">${typing.length === 1 ? firstName(app.person(typing[0]).name) + " is typing…" : "Several people are typing…"}</span>`
          : html`${members.length} ${members.length === 1 ? "member" : "members"}${online ? html`, <span class="on">${online} online</span>` : ""}`}</div>
      </div>
      ${app.isOrganizer ? html`<button class="iconbtn" onClick=${() => app.openOrganizer("results")} aria-label="Organizer tools" title="Organizer tools"><${Icon} name="chart" /></button>` : null}
    </header>
    <nav class="tabs" role="tablist" aria-label=${c.code + " sections"}>
      <button class=${"tab" + (activeTab === "chat" ? " on" : "")} role="tab" aria-selected=${activeTab === "chat"} onClick=${() => app.go("chat")}>Chat</button>
      ${pset ? html`<button class=${"tab" + (activeTab === "pset" ? " on" : "")} role="tab" aria-selected=${activeTab === "pset"} onClick=${() => app.go("pset")}>${pset.title}</button>` : null}
      <button class=${"tab" + (activeTab === "recaps" ? " on" : "")} role="tab" aria-selected=${activeTab === "recaps"} onClick=${() => app.go("recaps")}>Recaps${openFixes ? html`<span class="badge" style=${{ background: "#E9A23B" }}>${openFixes}</span>` : null}</button>
      <button class=${"tab tab-hub" + (activeTab === "hub" ? " on" : "")} role="tab" aria-selected=${activeTab === "hub"} onClick=${() => app.go("hub")}>Hub</button>
    </nav>
    ${desc === null ? html`<div class="empty"><div class="dots"><i></i><i></i><i></i></div></div>` : null}
    ${desc !== null && activeTab === "chat" ? html`
      <${PinBar} items=${pins} />
      <${MessageList} courseId=${courseId} messages=${mainMsgs} byId=${byId} lastRead=${lastRead} recapCtx=${ctx}
        empty=${html`<div class="empty"><div class="big emo">${courseLook(courseId).emoji}</div><h3>You're early.</h3><p>Everyone who adds ${c.code} lands in this chat. Say hi, or ask what everyone's working on.</p></div>`} />
      <${Composer} courseId=${courseId} thread="main" members=${members} placeholder=${"Message " + c.code} />` : null}
    ${desc !== null && activeTab === "pset" && pset ? html`<${PsetView} key=${pset.id} courseId=${courseId} thread=${pset} messages=${messages} byId=${byId} ctx=${ctx} members=${members} />` : null}
    ${activeTab === "recaps" ? html`<${RecapsView} courseId=${courseId} ctx=${ctx} />` : null}
    ${activeTab === "hub" ? html`<div class="scroller"><${HubPanel} courseId=${courseId} hub=${hub} members=${members} /></div>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function Root({ rt }) {
  const [mode, setMode] = useState(() => {
    if (!rt.live || rt.canWrite === false) return "demo";
    return LS.get("roster:mode", "live") === "demo" ? "demo" : "live";
  });
  const key = mode.startsWith("demo") ? mode : "live";
  const base = mode.startsWith("demo") ? "demo" : "live";
  return html`<${Session} key=${key} rt=${rt} mode=${base} switchMode=${setMode} />`;
}
(async function start() {
  const mount = document.getElementById("app");
  const rt = await Runtime.boot();
  mount.innerHTML = "";
  render(html`<${Root} rt=${rt} />`, mount);
})();
