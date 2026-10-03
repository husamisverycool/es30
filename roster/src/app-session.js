// ---------------------------------------------------------------------------
// Session (v2): one mode (live class or demo class), its data, every action.
// UI modules read everything through `useApp()`.
// ---------------------------------------------------------------------------
const DEMO_KEY = "roster-demo-v6";
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
const PLACEMENT_SALT = "roster/harvard/2026";
async function emailHash(email) {
  const data = new TextEncoder().encode(PLACEMENT_SALT + ":" + String(email).trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
const errCopy = (e) => {
  const c = e && e.code;
  if (c === "invalid_argument") return "You don't have permission to change that here.";
  if (c === "quota_exceeded") return "This class chat has hit its storage limit. Tell the organizer.";
  if (c === "resource_exhausted") return "Slow down a little and try again.";
  return "That didn't go through. Check your connection and try again.";
};
// Fix consensus (Community Notes style), shared by the recap UI and the inbox.
const APPLY_AT = 3;
const agreeN = (f) => Object.values(f.votes || {}).filter(Boolean).length;
const nayN = (f) => Object.values(f.nays || {}).filter(Boolean).length;
const autoApplied = (f) => f.status === "applied" || (f.status !== "dismissed" && agreeN(f) >= APPLY_AT && agreeN(f) >= 2 * nayN(f));
const appliedAt = (f) => f.appliedAt || (autoApplied(f) ? Object.values(f.votes || {}).filter(Boolean).sort((a, b) => a - b)[APPLY_AT - 1] || f.ts : 0);

function useMultiSnap(ids, makeRef, deps) {
  const [map, setMap] = useState({});
  const key = ids.join(",");
  useEffect(() => {
    const offs = ids.map((id) => {
      let ref = null;
      try { ref = makeRef(id); } catch (e) { console.error(e); }
      if (!ref) return () => {};
      return ref.onSnapshot((s) => setMap((m) => ({ ...m, [id]: s })), () => {});
    });
    return () => offs.forEach((o) => o());
  }, [key, ...deps]);
  return map;
}

function Session({ rt, mode, switchMode }) {
  const demo = mode === "demo";
  const db = demo ? getDemoDB() : rt.db;
  const uid = demo ? Demo.ME : rt.uid;
  useMemo(() => { Clock.offset = demo ? Demo.NOW - Date.now() : 0; }, [demo]);
  const [readOnly, setReadOnly] = useState(!demo && rt.canWrite === false);
  const canWrite = !readOnly;
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, action) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5200 : 3400);
  }, []);
  useEffect(() => { if (Notice.next) { const m = Notice.next; Notice.next = null; setTimeout(() => toast(m), 300); } }, []);
  const liveOK = rt.live && rt.canWrite !== false && !Notice.liveDenied;

  // ---- data ----
  const membersRaw = useCollection(() => db.collection("members"), [db]);
  const members = membersRaw || [];
  const myDoc = useDocData(() => db.doc("members/" + uid), [db, uid]);
  const config = useDocData(() => (demo ? null : db.doc("config/app")), [db]);
  const savedList = useCollection(() => (uid ? db.collection("data/users/" + uid) : null), [db, uid]);
  const myCourses = useMemo(() => Object.entries((myDoc && myDoc.courses) || {}).sort((a, b) => a[1] - b[1]).map(([id]) => id), [myDoc]);
  const feedSnaps = useMultiSnap(myCourses, (cid) => db.collection("courses/" + cid + "/messages").orderBy("ts", "desc").limit(400), [db]);
  const hubSnaps = useMultiSnap(myCourses, (cid) => db.doc("hub/" + cid), [db]);
  const fixSnaps = useMultiSnap(myCourses, (cid) => db.collection("courses/" + cid + "/fixes"), [db]);
  const feeds = useMemo(() => {
    const out = {};
    for (const cid of myCourses) { const s = feedSnaps[cid]; out[cid] = s ? s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse() : null; }
    return out;
  }, [feedSnaps, myCourses]);
  const hubs = useMemo(() => Object.fromEntries(myCourses.map((cid) => { const s = hubSnaps[cid]; return [cid, s && s.exists ? s.data() : null]; })), [hubSnaps, myCourses]);
  const fixes = useMemo(() => myCourses.flatMap((cid) => { const s = fixSnaps[cid]; return s ? s.docs.map((d) => ({ id: d.id, cid, ...d.data() })) : []; }), [fixSnaps, myCourses]);

  const [profiles, setProfiles] = useState({});
  const [peers, setPeers] = useState([]);
  const [placement, setPlacement] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [lrVersion, setLrVersion] = useState(0);
  const [arriving, setArriving] = useState(false);
  const [route, setRouteState] = useState(() => ({ view: LS.get("roster:view:" + mode, "today"), courseId: LS.get("roster:last:" + mode, null), tab: "chat" }));
  const [sheets, setSheets] = useState([]);
  const presenceRef = useRef({ c: null, t: 0 });

  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const isOrganizerReal = !demo && !!rt.isOwner;
  const organizerIds = demo ? [Demo.ORGANIZER] : [...new Set([...((config && config.organizers) || []), ...(isOrganizerReal ? [uid] : [])])];
  const customCourses = useMemo(() => {
    const out = {};
    for (const m of members) for (const [id, code] of Object.entries(m.courseCodes || {})) out[id] = { id, code, title: "", who: "", meets: "", where: "", size: 0, psets: "" };
    return out;
  }, [members]);
  const saved = useMemo(() => Object.fromEntries((savedList || []).map((s) => [s.id, s])), [savedList]);

  useEffect(() => {
    if (!demo && isOrganizerReal && config !== null && !((config && config.organizers) || []).includes(uid)) {
      db.doc("config/app").set({ ...(config || {}), organizers: [...((config && config.organizers) || []), uid] }).catch(() => {});
    }
  }, [config, isOrganizerReal]);
  useEffect(() => {
    if (demo || !rt.user) return;
    const ids = [...new Set([uid, ...members.map((m) => m.id)])].filter((id) => id && !profiles[id]);
    if (!ids.length) return;
    rt.user.profiles(ids).then((ps) => setProfiles((p) => ({ ...p, ...ps }))).catch(() => {});
  }, [members]);
  // Organizer placement: a hashed email list decides which chats you start in.
  useEffect(() => {
    if (demo || !rt.me || !rt.me.email || myDoc === null || (myDoc && Object.keys(myDoc.courses || {}).length)) return;
    emailHash(rt.me.email).then((h) => db.doc("placements/" + h).get()).then((s) => { if (s.exists) setPlacement(s.data()); }).catch(() => {});
  }, [myDoc === null]);
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
  useEffect(() => { pushPresence({ c: route.view === "class" ? route.courseId : null, t: 0 }); }, [route.courseId, route.view]);
  const online = useMemo(() => {
    if (demo) return DEMO_ONLINE;
    const s = new Set();
    for (const p of peers) if (p.kind === "viewer" && p.by) s.add(p.by);
    return s;
  }, [peers, demo]);

  const person = (id) => {
    const m = membersById[id], pr = profiles[id], d = demo ? Demo.people[id] : null;
    const name = (m && m.displayName) || (pr && pr.name) || (d && d.name) || (id === uid ? "You" : "Classmate");
    const photo = (m && m.photo) || (pr && pr.avatarUrl && !/^data:/.test(pr.avatarUrl) ? pr.avatarUrl : "");
    return {
      id, name, avatarUrl: photo,
      color: (m && m.color) || (d && d.color) || ["#CC5049", "#D67722", "#955CDB", "#3A9A1F", "#2B8FAA", "#2F7CC2", "#C7508B"][hash(id || "") % 7],
      house: m && m.house, year: m && m.year, concentration: m && m.concentration, prompts: (m && m.prompts) || [], sections: (m && m.sections) || {},
      courses: Object.keys((m && m.courses) || {}), reach: (m && m.reach) || {}, verified: m && m.verified, member: m,
    };
  };

  const write = async (fn, ok, action) => {
    if (!canWrite) { toast("You can read this class but not post."); return false; }
    try { await fn(); if (ok) toast(ok, action); return true; }
    catch (e) {
      if (e && e.code === "unavailable") {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        try { await fn(); if (ok) toast(ok, action); return true; } catch (e2) { toast(errCopy(e2)); return false; }
      }
      if (e && e.code === "invalid_argument" && !demo && !isOrganizerReal) {
        if (!myDoc) {
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
  const now = () => Clock.now();
  const setRoute = (patch) => setRouteState((r) => {
    const n = { ...r, ...patch };
    LS.set("roster:view:" + mode, n.view);
    if (n.courseId) LS.set("roster:last:" + mode, n.courseId);
    return n;
  });

  const app = {
    rt, mode, demo, live: !demo, liveOK, db, uid, canWrite, isOrganizerReal, isOrganizer: demo || isOrganizerReal, organizerIds,
    sample: rt.sample, downloads: rt.downloads, members, membersById, me: myDoc || null, myCourses, customCourses, online, person,
    feeds, hubs, fixes, saved, placement,
    viewerName: rt.me && rt.me.name, viewerEmail: rt.me && rt.me.email, replyTo, setReplyTo, toast, write, lrVersion,
    route, setRoute, sheets,
    open: (kind, props) => setSheets((s) => [...s.filter((x) => x.kind !== kind), { kind, props: props || {}, key: Math.random() }]),
    close: (kind) => setSheets((s) => (kind ? s.filter((x) => x.kind !== kind) : s.slice(0, -1))),
    switchMode: (m) => { LS.set("roster:mode", m); switchMode(m); },
    typing: (cid) => (demo ? [] : peers.filter((p) => !p.isMe && p.by && p.presence && p.presence.c === cid && p.presence.t && Date.now() - p.presence.t < 7000).map((p) => p.by)),
    setTyping: (cid, on) => pushPresence({ c: cid, t: on ? Date.now() : 0 }),
    openCourse: (cid, tab) => { setRoute({ view: "class", courseId: cid, tab: tab || "chat", open: true }); setReplyTo(null); },

    // ---- messages ----
    send: (cid, { text, thread, tags, mentions }) => {
      const body = { by: uid, ts: now(), text, thread: thread || "main", kind: "text", reactions: {} };
      if (replyTo) body.replyTo = replyTo.id;
      if (tags) body.tags = tags;
      if (mentions && mentions.length) body.mentions = mentions;
      setReplyTo(null);
      return write(() => msgs(cid).add(body));
    },
    sendPhoto: async (cid, file, { caption, thread, tags }) => {
      let image;
      try { image = await Media.compress(file); } catch (_) { toast("That file isn't an image Roster can read. Try a JPG or PNG."); return false; }
      const body = { by: uid, ts: now(), text: caption || "", thread: thread || "main", kind: "photo", image, reactions: {} };
      if (tags) body.tags = tags;
      return write(() => msgs(cid).add(body), "Photo sent");
    },
    createPoll: (cid, { question, options, thread, tags }) => write(() => msgs(cid).add({ by: uid, ts: now(), text: "", thread: thread || "main", kind: "poll", tags, poll: { question, options: options.map((t, i) => ({ id: "o" + i, text: t })), votes: {} }, reactions: {} }), "Poll posted"),
    votePoll: (cid, m, o) => {
      const cur = m.poll && m.poll.votes && m.poll.votes[uid];
      return write(() => msgs(cid).doc(m.id).update({ poll: { votes: { [uid]: { o: cur && cur.o === o ? "" : o, t: now() } } } }));
    },
    createEvent: (cid, ev) => write(() => msgs(cid).add({ by: uid, ts: now(), text: "", thread: ev.thread || "main", kind: "event", event: { title: ev.title, at: ev.at, end: ev.end, where: ev.where, note: ev.note || "", rsvps: { [uid]: { s: "going", t: now() } } }, reactions: {} }), "Study session posted. You're going."),
    rsvp: (cid, m, s) => {
      const cur = m.event && m.event.rsvps && m.event.rsvps[uid];
      return write(() => msgs(cid).doc(m.id).update({ event: { rsvps: { [uid]: { s: cur && cur.s === s ? "" : s, t: now() } } } }));
    },
    react: (cid, m, e) => {
      const mine = !!(m.reactions && m.reactions[e] && m.reactions[e][uid]);
      return write(() => msgs(cid).doc(m.id).update({ reactions: { [e]: { [uid]: mine ? 0 : now() } } }));
    },
    editMsg: (cid, m, text) => write(() => msgs(cid).doc(m.id).update({ text, editedAt: now() }), "Edited"),
    deleteMsg: (cid, m) => write(() => msgs(cid).doc(m.id).update({ deleted: true, text: "", image: null, attachments: [] }), "Message deleted"),
    resolveMsg: (cid, m) => write(() => msgs(cid).doc(m.id).update({ resolved: m.resolved ? 0 : now() }), m.resolved ? "Marked as open" : "Marked as answered"),
    hideMsg: (cid, m) => write(() => msgs(cid).doc(m.id).update({ hidden: m.hidden ? 0 : now() }), m.hidden ? "Message restored" : "Message removed for everyone"),
    sendDue: (cid, d) => write(() => msgs(cid).add({ by: uid, ts: now(), thread: "main", kind: "due", due: d, text: d.title, reactions: {} }), "Sent to the class chat"),
    announce: (cid, text) => write(() => msgs(cid).add({ by: uid, ts: now(), thread: "main", kind: "announce", text, reactions: {} }), "Announcement posted"),
    toggleStuck: (cid, thread, problem, mine) => {
      const ref = db.doc("courses/" + cid + "/stuck/" + thread + "~" + problem + "~" + uid);
      return write(() => (mine ? ref.delete() : ref.set({ thread, problem, by: uid, ts: now() })), mine ? null : "Marked. Classmates see how many people are stuck here.");
    },
    save: (cid, m) => {
      const ref = db.doc("data/users/" + uid + "/" + cid + "~" + m.id);
      const on = !!saved[cid + "~" + m.id];
      return write(() => (on ? ref.delete() : ref.set({ cid, mid: m.id, by: m.by, ts: now(), at: m.ts, kind: m.kind, text: m.text || (m.poll && m.poll.question) || (m.event && m.event.title) || "" })), on ? "Removed from Saved" : "Saved for later");
    },
    report: (cid, m, reason, note) => write(() => db.collection("reports/" + uid + "/items").add({ cid, mid: m.id, author: m.by, reason, note: note || "", text: (m.text || "").slice(0, 300), ts: now() }), "Reported. Only the organizer sees reports."),

    // ---- notes ----
    addNote: async (cid, n, file) => {
      const body = { by: uid, ts: now(), lecture: n.lecture || 0, title: n.title, body: n.body || "", helpful: {} };
      if (file) { try { body.image = await Media.compress(file); } catch (_) { /* skip image */ } }
      return write(() => db.collection("courses/" + cid + "/notes").add(body), "Notes shared with the class");
    },
    toggleHelpful: (cid, n) => write(() => db.doc("courses/" + cid + "/notes/" + n.id).update({ helpful: { [uid]: n.helpful && n.helpful[uid] ? 0 : now() } })),

    // ---- recaps ----
    toggleCheck: (cid, rid, bid, mine) => {
      const ref = db.doc("courses/" + cid + "/checks/" + rid + "~" + bid + "~" + uid);
      return write(() => (mine ? ref.delete() : ref.set({ recapId: rid, bulletId: bid, by: uid, ts: now() })));
    },
    suggestFix: (cid, f) => write(() => db.collection("courses/" + cid + "/fixes").add({ ...f, by: uid, ts: now(), votes: {}, nays: {}, status: "open" }), "Fix suggested. Classmates can now agree with it."),
    voteFix: async (cid, f, v) => {
      const willApply = v === "yes" && !autoApplied(f) && agreeN(f) + ((f.votes || {})[uid] ? 0 : 1) >= APPLY_AT && agreeN(f) + 1 >= 2 * (nayN(f) - ((f.nays || {})[uid] ? 1 : 0));
      const patch = { votes: { [uid]: v === "yes" ? now() : 0 }, nays: { [uid]: v === "no" ? now() : 0 } };
      if (willApply) patch.appliedAt = now();
      const ok = await write(() => db.doc("courses/" + cid + "/fixes/" + f.id).update(patch));
      if (ok && willApply) toast("That was the third yes. The fix now replaces the AI's line for everyone.");
      return ok;
    },
    resolveFix: async (cid, f, status) => {
      const ok = await write(() => db.doc("courses/" + cid + "/fixes/" + f.id).update({ status, appliedAt: status === "applied" ? now() : 0 }));
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
      const ok = await write(() => db.doc("recaps/" + cid + "/items/" + rid).set({ ...r, ts: now(), by }));
      if (!ok) return false;
      return write(() => msgs(cid).doc("rm-" + rid).set({ by, ts: now(), thread: "main", kind: "recap", recapId: rid, text: "Lecture " + r.lecture + " recap: " + r.title, reactions: {} }), "Recap posted. Classmates can now check it.");
    },

    // ---- me ----
    joinCourses: async ({ picked, profile, sections }) => {
      const prev = myDoc || {};
      const t = now();
      const courses = { ...(prev.courses || {}) };
      const codes = { ...(prev.courseCodes || {}) };
      for (const p of picked || []) { if (!courses[p.id]) courses[p.id] = t; if (p.code && !Catalog.byId[p.id]) codes[p.id] = p.code; }
      const body = { ...prev, ...(profile || {}), courses, courseCodes: codes, sections: { ...(prev.sections || {}), ...(sections || {}) }, joinedAt: prev.joinedAt || t, visits: prev.visits || {} };
      delete body.id;
      return write(() => db.doc("members/" + uid).set(body));
    },
    updateProfile: (patch, ok) => {
      const prev = myDoc || {};
      const body = { ...prev, ...patch };
      delete body.id;
      return write(() => db.doc("members/" + uid).set(body), ok || "Profile updated");
    },
    leaveCourse: (cid) => {
      const prev = { ...(myDoc || {}) };
      const courses = { ...(prev.courses || {}) }; delete courses[cid];
      const sections = { ...(prev.sections || {}) }; delete sections[cid];
      const body = { ...prev, courses, sections }; delete body.id;
      return write(() => db.doc("members/" + uid).set(body), "You left " + Catalog.get(cid, customCourses).code);
    },
    markVisit: (cid) => {
      if (!myDoc || !canWrite) return;
      const k = dayKey(now());
      if (myDoc.visits && myDoc.visits[cid] && myDoc.visits[cid][k]) return;
      db.doc("members/" + uid).update({ visits: { [cid]: { [k]: now() } } }).catch(() => {});
    },
    markRead: (cid, thread) => { LS.set("roster:lr:" + mode + ":" + cid + ":" + (thread || "main"), now()); setLrVersion((v) => v + 1); },
    lastRead: (cid, thread) => LS.get("roster:lr:" + mode + ":" + cid + ":" + (thread || "main"), demo ? now() - 2 * 3600e3 : ((myDoc && myDoc.courses && myDoc.courses[cid]) || 0)),
    inboxSeen: () => LS.get("roster:inbox:" + mode, demo ? Demo.NOW - 26 * 3600e3 : 0),
    markInboxSeen: () => { LS.set("roster:inbox:" + mode, now()); setLrVersion((v) => v + 1); },
    resetDemo: () => {
      if (demoDB) { demoDB._reset(); demoDB._seed(Demo.seed()); }
      try { Object.keys(localStorage).filter((k) => /^roster:(lr|draft|last|view|inbox):?(demo)?/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* ignore */ }
      switchMode("demo-reset-" + Date.now());
    },

    // ---- organizer ----
    placeEmails: async (emails, courses) => {
      const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)))];
      for (const e of list) {
        const h = await emailHash(e);
        const ok = await write(() => db.doc("placements/" + h).set({ courses, ts: now() }));
        if (!ok) return 0;
      }
      return list.length;
    },
  };
  app.setArriving = setArriving;

  let body;
  if (membersRaw === null || myDoc === null) body = html`<${BootScreen} />`;
  else if (arriving || !myDoc || !Object.keys(myDoc.courses || {}).length) body = html`<${Onboarding} onDone=${(cid) => { setArriving(false); if (cid) app.openCourse(cid); else setRoute({ view: "today" }); }} />`;
  else body = html`<${AppShell} />`;

  return html`<${Ctx.Provider} value=${app}>
    ${body}
    <${SheetHost} />
    <div class="toasts" role="status" aria-live="polite">${toasts.map((t) => html`<div class="toast" key=${t.id}><span>${t.msg}</span>${t.action ? html`<button onClick=${t.action.run}>${t.action.label}</button>` : null}</div>`)}</div>
  <//>`;
}

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
