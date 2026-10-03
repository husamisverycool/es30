// ---------------------------------------------------------------------------
// Every sheet, and the host that stacks them. Each is a bottom sheet on a
// phone and a centered dialog on desktop (see Sheet in ui-core).
// ---------------------------------------------------------------------------
function SheetHost() {
  const app = useApp();
  if (!app) return null;
  return html`${app.sheets.map((s) => {
    const C = SHEETS[s.kind];
    if (!C) return null;
    return html`<${C} key=${s.key} ...${s.props} onClose=${() => app.close(s.kind)} />`;
  })}`;
}

// ---- events (Partiful's guest list; "Can't" stays private to the host) ---------------------
function EventSheet({ m: m0, courseId, onClose }) {
  const app = useApp();
  useTick(30000);
  const m = ((app.feeds[courseId] || []).find((x) => x.id === m0.id)) || m0;
  const ev = m.event;
  const { going, maybe } = rsvpLists(ev);
  const mine = (ev.rsvps || {})[app.uid];
  const host = m.by === app.uid;
  const cant = host ? Object.entries(ev.rsvps || {}).filter(([, v]) => v && v.s === "no").map(([id]) => id) : [];
  const now = Clock.now(), end = ev.end || ev.at + 2 * 3600e3;
  const live = ev.at <= now && end > now, past = end <= now;
  const links = calLinks(ev.title, ev.at, end, (ev.note || "") + (ev.where ? "\n" + ev.where : "") + "\nFrom the " + course(app, courseId).code + " chat on Roster");
  const List = (t, ids) => (ids.length ? html`<section><h3 class="eyebrow">${t} · ${ids.length}</h3><div class="group">${ids.map((id) => html`<button class="prow" key=${id} onClick=${() => app.open("profile", { uid: id, courseId })}><${Avatar} uid=${id} size=${36} /><span class="grow prow-t"><b>${id === app.uid ? "You" : app.person(id).name}</b><small>${tagLine(app.person(id))}</small></span>${id === m.by ? html`<span class="pill sm">Host</span>` : null}</button>`)}</div></section>` : null);
  return html`<${Sheet} title="Study session" icon="calendar" onClose=${onClose} size="tall">
    <div class="evsheet">
      <span class="datetile lg"><small>${F.wds.format(ev.at).toUpperCase()}</small><b>${F.dnum.format(ev.at)}</b><small>${F.mon.format(ev.at).toUpperCase()}</small></span>
      <div class="grow"><h2 class="evsheet-t">${ev.title}</h2>
        <p class=${"time-chip" + (live ? " live" : "")}>${live ? html`<i class="pulse-dot"></i>Happening now` : past ? "Ended" : "In " + inWords(ev.at - now)}</p></div>
    </div>
    <div class="group">
      <div class="inforow"><${Icon} name="clock" /><span class="grow"><b>${F.wlmd.format(ev.at)}</b><small>${tShort(ev.at)} – ${tShort(end)}</small></span></div>
      <div class="inforow"><${Icon} name="mapPin" /><span class="grow"><b>${ev.where || "Place TBA"}</b><small>${course(app, courseId).code}</small></span></div>
      <div class="inforow"><${Avatar} uid=${m.by} size=${24} /><span class="grow"><b>Hosted by ${host ? "you" : app.person(m.by).name}</b></span></div>
    </div>
    ${ev.note ? html`<p class="evsheet-note">${ev.note}</p>` : null}
    ${!past && app.canWrite ? html`<div class="rsvp lg" role="group" aria-label="RSVP">${RSVP.map(([k, e, l]) => html`<button key=${k} class=${mine && mine.s === k ? "on" : ""} aria-pressed=${!!(mine && mine.s === k)} onClick=${() => app.rsvp(courseId, m, k)}><span class="emo">${e}</span>${l}</button>`)}</div>` : null}
    <div class="row-gap"><a class="btn sm soft" href=${links.google} target="_blank" rel="noopener noreferrer"><${Icon} name="calendarPlus" size=${16} />Google Calendar</a><a class="btn sm ghost" href=${links.outlook} target="_blank" rel="noopener noreferrer">Outlook</a></div>
    ${List("Going", going)}${List("Maybe", maybe)}
    ${host && cant.length ? html`<section><h3 class="eyebrow">Can't make it · only you see this</h3><div class="group">${cant.map((id) => html`<div class="prow" key=${id}><${Avatar} uid=${id} size=${30} /><span class="grow prow-t"><b>${app.person(id).name}</b></span></div>`)}</div></section>` : null}
  <//>`;
}

// ---- photos (iMessage full-screen viewer) -------------------------------------------------
function PhotoSheet({ m: m0, courseId, onClose }) {
  const app = useApp();
  const m = ((app.feeds[courseId] || []).find((x) => x.id === m0.id)) || m0;
  const [zoom, setZoom] = useState(false);
  const src = Media.resolve(m.image.src);
  return html`<div class="viewer" role="dialog" aria-label="Photo" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <header class="viewer-h"><button class="iconbtn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
      <span class="grow viewer-who"><${Avatar} uid=${m.by} size=${28} /><span><b>${m.by === app.uid ? "You" : app.person(m.by).name}</b><small>${course(app, courseId).code} · ${dueWhen(m.ts)}</small></span></span>
      <a class="iconbtn" href=${src} download=${"roster-" + m.id + ".jpg"} aria-label="Download"><${Icon} name="download" /></a></header>
    <div class=${"viewer-img" + (zoom ? " zoom" : "")} onClick=${() => setZoom(!zoom)}><img src=${src} alt=${m.text || "Photo"} /></div>
    ${m.text ? html`<p class="viewer-cap"><${RichText} text=${m.text} /></p>` : null}
    ${app.canWrite ? html`<footer class="viewer-f">${QUICK.slice(0, 4).map((e) => html`<button key=${e} class=${"emo" + (m.reactions && m.reactions[e] && m.reactions[e][app.uid] ? " on" : "")} onClick=${() => app.react(courseId, m, e)}>${e}</button>`)}
      <span class="grow"></span><button class="btn sm" onClick=${() => { app.setReplyTo(m); onClose(); }}><${Icon} name="reply" size=${16} />Reply</button>
      <button class="btn sm" onClick=${() => app.save(courseId, m)}><${Icon} name="bookmark" size=${16} fill=${!!app.saved[courseId + "~" + m.id]} />${app.saved[courseId + "~" + m.id] ? "Saved" : "Save"}</button></footer>` : null}
  </div>`;
}
function PhotoSendSheet({ courseId, thread, file, tags, onClose }) {
  const app = useApp();
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const send = async () => { setBusy(true); const ok = await app.sendPhoto(courseId, file, { caption: cap.trim(), thread, tags }); setBusy(false); if (ok) onClose(); };
  return html`<${Sheet} title=${"Send to " + course(app, courseId).code} icon="image" onClose=${onClose}
    footer=${html`<input class="input grow" placeholder="Add a caption" value=${cap} onInput=${(e) => setCap(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && !e.isComposing && send()} autofocus /><button class="send on" disabled=${busy} onClick=${send} aria-label="Send photo"><${Icon} name="send" size=${20} /></button>`}>
    <div class="sendprev"><img src=${url} alt="" /></div>
    ${tags && tags.length ? html`<p class="muted sm">Tagged problem ${tags.map(prettyProblem).join(", ")}</p>` : null}
    <p class="muted sm">Photos are resized before sending. Don't post photos of graded work before the deadline.</p>
  <//>`;
}

// ---- attach menu (Telegram's attach sheet) ------------------------------------------------
function AttachSheet({ courseId, thread, pick, problem, onClose }) {
  const app = useApp();
  const isCourse = Catalog.isCourse(courseId);
  const opts = [
    ["image", "Photo", "var(--c5-solid)", () => { onClose(); setTimeout(pick, 50); }],
    ["poll", "Poll", "var(--c3-solid)", () => { onClose(); app.open("poll-new", { courseId, thread, problem }); }],
    ["calendarPlus", "Study session", "var(--c7-solid)", () => { onClose(); app.open("event-new", { courseId, thread }); }],
    isCourse && ["note", "Lecture notes", "var(--c10-solid)", () => { onClose(); app.open("note-new", { courseId }); }],
  ].filter(Boolean);
  return html`<${Sheet} title="Share" onClose=${onClose}>
    <div class="attach-grid">${opts.map(([ic, l, c, run]) => html`<button key=${l} class="attach-o" onClick=${run}><span class="attach-ic" style=${{ background: c }}><${Icon} name=${ic} size=${26} fill=${true} /></span><span>${l}</span></button>`)}</div>
  <//>`;
}
function PollNewSheet({ courseId, thread, problem, onClose }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const set = (i, v) => { const n = [...opts]; n[i] = v; if (i === n.length - 1 && v && n.length < 6) n.push(""); setOpts(n); };
  const post = async () => { const ok = await app.createPoll(courseId, { question: q.trim(), options: clean, thread, tags: problem && problem !== "all" ? [problem] : undefined }); if (ok) onClose(); };
  return html`<${Sheet} title="New poll" icon="poll" onClose=${onClose} footer=${html`<span class="muted sm grow">Votes are public. People vote before seeing results.</span><button class="btn primary" disabled=${!q.trim() || clean.length < 2} onClick=${post}>Post poll</button>`}>
    <label class="field"><span>Question</span><input class="input lg" maxlength="140" placeholder="When are we doing the PSet 5 grind?" value=${q} onInput=${(e) => setQ(e.target.value)} autofocus /></label>
    <div class="field"><span>Options</span>${opts.map((o, i) => html`<div class="optin" key=${i}><span class="opt-radio"></span><input class="input" maxlength="60" placeholder=${"Option " + (i + 1)} value=${o} onInput=${(e) => set(i, e.target.value)} />${opts.length > 2 && o ? html`<button class="iconbtn sm" onClick=${() => setOpts(opts.filter((_, j) => j !== i))} aria-label="Remove option"><${Icon} name="x" size=${16} /></button>` : null}</div>`)}</div>
  <//>`;
}
function EventNewSheet({ courseId, thread, onClose }) {
  const app = useApp();
  const now = Clock.now();
  const base = Sched.startOfDay(now);
  const quick = [["Tonight 8 PM", base + 20 * 3600e3], ["Tomorrow 2 PM", Sched.addDays(base, 1) + 14 * 3600e3], ["Tomorrow 7 PM", Sched.addDays(base, 1) + 19 * 3600e3]].filter(([, t]) => t > now + 15 * 60e3);
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(toLocalInput(quick[0] ? quick[0][1] : Sched.addDays(base, 1) + 19 * 3600e3));
  const [dur, setDur] = useState(120);
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");
  const PLACES = ["Cabot Library", "Lamont Library", "Science Center", "Widener", "Smith Center"];
  const start = fromLocalInput(at);
  const post = async () => { const ok = await app.createEvent(courseId, { title: title.trim(), at: start, end: start + dur * 60e3, where: where.trim(), note: note.trim(), thread }); if (ok) onClose(); };
  return html`<${Sheet} title="Study session" icon="calendarPlus" onClose=${onClose} size="tall" footer=${html`<span class="muted sm grow">You'll be marked as going.</span><button class="btn primary" disabled=${!title.trim() || !start || !where.trim()} onClick=${post}>Post to ${course(app, courseId).code}</button>`}>
    <label class="field"><span>What</span><input class="input lg" maxlength="80" placeholder=${Catalog.isCourse(courseId) ? course(app, courseId).code + " pset grind" : "Study session"} value=${title} onInput=${(e) => setTitle(e.target.value)} autofocus /></label>
    <div class="chips">${quick.map(([l, t]) => html`<button key=${l} class=${"chip" + (at === toLocalInput(t) ? " on" : "")} onClick=${() => setAt(toLocalInput(t))}>${l}</button>`)}</div>
    <div class="field-row"><label class="field"><span>Starts</span><input class="input" type="datetime-local" value=${at} onInput=${(e) => setAt(e.target.value)} /></label>
      <label class="field"><span>Length</span><select class="input" value=${dur} onChange=${(e) => setDur(+e.target.value)}>${[[60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [180, "3 hours"]].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></label></div>
    <label class="field"><span>Where</span><input class="input" placeholder="Cabot Library, 3rd floor" value=${where} onInput=${(e) => setWhere(e.target.value)} /></label>
    <div class="chips">${PLACES.map((p) => html`<button key=${p} class=${"chip" + (where === p ? " on" : "")} onClick=${() => setWhere(p)}>${p}</button>`)}</div>
    <label class="field"><span>Note <small>optional</small></span><input class="input" maxlength="140" placeholder="Bring problem 3 attempts" value=${note} onInput=${(e) => setNote(e.target.value)} /></label>
  <//>`;
}

// ---- notes ------------------------------------------------------------------------------------
function NoteNewSheet({ courseId, lectures, onClose }) {
  const app = useApp();
  const latest = (lectures && lectures[0]) || 1;
  const [lecture, setLecture] = useState(latest);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const ref = useRef(null);
  const save = async () => { const ok = await app.addNote(courseId, { lecture: +lecture, title: title.trim(), body: body.trim() }, file); if (ok) onClose(); };
  return html`<${Sheet} title="Share notes" icon="note" onClose=${onClose} size="tall" footer=${html`<span class="muted sm grow">Your name shows on your notes.</span><button class="btn primary" disabled=${!title.trim() || (!body.trim() && !file)} onClick=${save}>Share</button>`}>
    <div class="field-row"><label class="field"><span>Lecture</span><select class="input" value=${lecture} onChange=${(e) => setLecture(e.target.value)}>${Array.from({ length: Math.max(latest + 1, 12) }, (_, i) => i + 1).reverse().map((n) => html`<option value=${n}>Lecture ${n}</option>`)}<option value="0">General</option></select></label></div>
    <label class="field"><span>Title</span><input class="input lg" maxlength="80" placeholder="Lecture 9: conditional independence, cleaned up" value=${title} onInput=${(e) => setTitle(e.target.value)} autofocus /></label>
    <label class="field"><span>Notes</span><textarea class="input mono" rows="8" placeholder=${"- **Bold** and *italic* work\n- So does math: $P(A|B)$\n1. Numbered lists too"} value=${body} onInput=${(e) => setBody(e.target.value)}></textarea></label>
    <input type="file" accept="image/*" hidden ref=${ref} onChange=${(e) => { setFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
    <button class="btn ghost" onClick=${() => ref.current && ref.current.click()}><${Icon} name="camera" size=${18} />${file ? "Photo added · change" : "Add a photo of your notes"}</button>
  <//>`;
}
function NoteSheet({ courseId, n: n0, onClose }) {
  const app = useApp();
  const notes = useCollection(() => app.db.collection("courses/" + courseId + "/notes"), [courseId, app.db]) || [];
  const n = notes.find((x) => x.id === n0.id) || n0;
  const mine = !!(n.helpful && n.helpful[app.uid]);
  const count = Object.values(n.helpful || {}).filter(Boolean).length;
  return html`<${Sheet} title=${n.lecture ? "Lecture " + n.lecture : "Notes"} icon="note" onClose=${onClose} size="tall"
    footer=${html`<button class=${"upv lg" + (mine ? " on" : "")} aria-pressed=${mine} onClick=${() => app.canWrite && app.toggleHelpful(courseId, n)}>↑<span>${count}</span></button><span class="grow muted sm">${mine ? "You found this helpful" : "Helpful? Upvote it so others find it first."}</span>`}>
    <h2 class="note-t">${n.title}</h2>
    <button class="byline" onClick=${() => app.open("profile", { uid: n.by, courseId })}><${Avatar} uid=${n.by} size=${24} /><span>${app.person(n.by).name} · ${relShort(n.ts)}</span></button>
    ${n.image ? html`<img class="note-img" src=${Media.resolve(n.image.src)} alt="Notes photo" />` : null}
    <div class="notebody"><${NoteBody} text=${n.body || ""} /></div>
  <//>`;
}

// ---- report (Instagram's reason list, then a done screen) ------------------------------------
const REPORT_REASONS = [["Sharing graded answers", "Full solutions before the deadline"], ["Harassment or bullying", "Targeting someone"], ["Hate or discrimination", ""], ["Spam or scams", "Selling, links, repeated posts"], ["Personal information", "Someone's address, phone, grades"], ["Something else", ""]];
function ReportSheet({ courseId, m, board, person, onClose }) {
  const app = useApp();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const target = m ? { cid: courseId, m } : board ? { cid: "board", m: { id: board.id, by: board.by, text: board.title + "\n" + (board.body || "") } } : { cid: "person", m: { id: person, by: person, text: "" } };
  const send = async () => { const ok = await app.report(target.cid, target.m, reason, note.trim()); if (ok) setDone(true); };
  if (done) return html`<${Sheet} title="Thanks for telling us" icon="checkCircle" onClose=${onClose} footer=${html`<button class="btn primary block" onClick=${onClose}>Done</button>`}>
    <div class="done-art"><${Icon} name="shield" size=${36} fill=${true} /></div>
    <p>The organizer reviews every report. ${board ? "The post" : m ? "The message" : "Their messages"} stay${board || m ? "s" : ""} up until then. The person you reported isn't told who reported them.</p>
    ${m || person ? html`<button class="setrow" onClick=${() => { onClose(); app.open("profile", { uid: target.m.by }); }}><span class="grow">See ${firstName(app.person(target.m.by).name)}'s profile</span><${Icon} name="chevronRight" size=${16} /></button>` : null}
  <//>`;
  return html`<${Sheet} title=${"Report " + (board ? "post" : m ? "message" : firstName(app.person(person).name))} icon="flag" onClose=${onClose} footer=${html`<button class="btn ghost" onClick=${onClose}>Cancel</button><button class="btn danger" disabled=${!reason} onClick=${send}>Send report</button>`}>
    ${m && m.text ? html`<blockquote class="rep-q">${m.text.slice(0, 200)}</blockquote>` : null}
    <div class="group" role="radiogroup">${REPORT_REASONS.map(([r, s]) => html`<button key=${r} role="radio" aria-checked=${reason === r} class=${"radrow" + (reason === r ? " on" : "")} onClick=${() => setReason(r)}><span class="grow"><b>${r}</b>${s ? html`<small>${s}</small>` : null}</span><span class="radio"></span></button>`)}</div>
    ${reason ? html`<label class="field"><span>Anything else? <small>optional</small></span><textarea class="input" rows="2" maxlength="300" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea></label>` : null}
    <p class="muted sm">Only the organizer sees reports. Roster isn't run by Harvard; for anything serious, contact the Dean of Students Office.</p>
  <//>`;
}

function ConfirmSheet({ title, body, cta, danger, run, onClose }) {
  return html`<${Sheet} title=${title} onClose=${onClose} size="sm" footer=${html`<button class="btn ghost" onClick=${onClose}>Cancel</button><button class=${"btn " + (danger ? "danger" : "primary")} onClick=${async () => { await run(); onClose(); }} autofocus>${cta}</button>`}>
    <p>${body}</p>
  <//>`;
}

// ---- survey ------------------------------------------------------------------------------------
function SurveySheet({ courseId, label, onClose }) {
  const app = useApp();
  const [q1, setQ1] = useState(null), [q2, setQ2] = useState([]), [q3, setQ3] = useState("");
  const submit = async () => { const ok = await app.write(() => app.db.doc("survey/" + app.uid).set({ course: courseId, q1, q2, q3: q3.trim(), ts: Clock.now() }), "Thanks. Only the organizer sees your answers."); if (ok) onClose(); };
  return html`<${Sheet} title="3 quick questions" icon="poll" onClose=${onClose} footer=${html`<button class="btn ghost" onClick=${onClose}>Later</button><button class="btn primary" disabled=${!q1} onClick=${submit}>Send answers</button>`}>
    <div class="field"><span>During ${label}, how often did you open this chat?</span><div class="chips">${Q1.map((o) => html`<button key=${o} class=${"chip" + (q1 === o ? " on" : "")} onClick=${() => setQ1(o)}>${o}</button>`)}</div></div>
    <div class="field"><span>Did it replace anything you used before? Pick any.</span><div class="chips">${Q2.map((o) => html`<button key=${o} class=${"chip" + (q2.includes(o) ? " on" : "")} onClick=${() => setQ2(q2.includes(o) ? q2.filter((x) => x !== o) : [...q2, o])}>${o}</button>`)}</div></div>
    <label class="field"><span>What would make it worth opening?</span><textarea class="input" rows="3" value=${q3} onInput=${(e) => setQ3(e.target.value)} placeholder="Be blunt. This decides what gets built."></textarea></label>
    <p class="muted sm">Only the organizer sees your answers.</p>
  <//>`;
}

// ---- pledge (Airbnb's Community Commitment: plain promises, "Agree and continue") -------------
const PLEDGE = [
  ["users", "Treat classmates with respect", "No harassment, no slurs, no piling on. Disagree with ideas, not people."],
  ["shield", "Follow your course's collaboration policy", "Talk through ideas. Don't post or ask for full solutions before a deadline."],
  ["lock", "Keep what's personal, personal", "No screenshots of private messages, no one's grades, address or phone number."],
  ["flag", "Report, don't retaliate", "If something's wrong, report it. The organizer reviews every report."],
];
function PledgeSheet({ readOnly, onClose }) {
  const app = useApp();
  const agree = async () => { const ok = await app.updateProfile({ pledgeAt: Clock.now() }, "Thanks. You're all set to post."); if (ok) onClose(); };
  return html`<${Sheet} title="The Roster pledge" icon="shield" onClose=${onClose}
    footer=${readOnly || (app.me && app.me.pledgeAt) ? html`<button class="btn primary block" onClick=${onClose}>Done</button>` : html`<button class="btn ghost" onClick=${onClose}>Not now</button><button class="btn primary" onClick=${agree}>Agree and continue</button>`}>
    <p class="lead">Roster works because everyone in your classes is in the same room. To keep it useful, everyone agrees to four things.</p>
    <ol class="pledge">${PLEDGE.map(([ic, t, s]) => html`<li key=${t}><span class="pledge-ic"><${Icon} name=${ic} size=${20} /></span><div><b>${t}</b><p>${s}</p></div></li>`)}</ol>
    ${readOnly ? null : html`<p class="muted sm">Not now means you can keep reading, but you won't be able to post.</p>`}
  <//>`;
}

// ---- ⌘K palette (Linear / Raycast: grouped results, arrow keys, actions) -----------------------
function Palette({ scope, onClose }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [sc, setSc] = useState(scope || null);
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);
  const commands = [
    ["Go to Now", "clock", "G N", () => app.setRoute({ view: "now" })], ["Go to Classes", "chats", "G C", () => app.setRoute({ view: "classes" })],
    ["Go to Calendar", "calendar", "G L", () => app.setRoute({ view: "calendar" })], ["Go to Board", "board", "G B", () => app.setRoute({ view: "board" })],
    ["Go to People", "users", "G P", () => app.setRoute({ view: "people" })], ["Go to Activity", "bell", "G A", () => app.setRoute({ view: "activity" })],
    ["Go to Tasks", "tasks", "G T", () => app.setRoute({ view: "tasks" })], ["Go to Saved", "bookmark", "G S", () => app.setRoute({ view: "saved" })],
    ["New task", "checkSquare", "", () => app.open("task-new")], ["Set a status", "smile", "", () => app.open("status")],
    ["Post to the Board", "board", "", () => app.open("board-new", {})], ["Add a class", "plus", "", () => app.open("add-classes")],
    ["Edit class times", "sliders", "", () => app.open("meetings")], ["Edit profile", "edit", "", () => app.open("edit-profile")],
    ["Keyboard shortcuts", "keyboard", "?", () => app.open("shortcuts")],
  ];
  const feeds = Object.fromEntries(Object.entries(app.feeds).filter(([cid, f]) => f && (!sc || cid === sc)));
  const res = useMemo(() => Derive.search(q, { feeds, members: sc ? [] : app.members.filter((m) => m.id !== app.uid), courses: sc ? [] : app.myCourses.map((c) => course(app, c)), nameOf: (id) => app.person(id).name }), [q, sc, app.feeds]);
  const ql = q.trim().toLowerCase();
  const cmds = sc ? [] : commands.filter(([l]) => !ql || l.toLowerCase().includes(ql)).slice(0, ql ? 5 : 8);
  const rows = [];
  if (!ql && !sc) app.myCourses.forEach((c) => rows.push({ g: "Classes", key: "c" + c, icon: null, tile: c, label: course(app, c).code, sub: course(app, c).title, run: () => app.openCourse(c) }));
  res.classes.forEach((c) => rows.push({ g: "Classes", key: "c" + c.id, tile: c.id, label: c.code, sub: c.title, run: () => app.openCourse(c.id) }));
  cmds.forEach(([l, ic, k, run]) => rows.push({ g: "Actions", key: "a" + l, icon: ic, label: l, kbd: k, run }));
  res.people.forEach((m) => rows.push({ g: "People", key: "p" + m.id, uid: m.id, label: m.displayName, sub: tagLine(m) + (m.concentration ? " · " + m.concentration : ""), run: () => app.open("profile", { uid: m.id }) }));
  res.messages.slice(0, 20).forEach(({ cid, m }) => rows.push({ g: "Messages", key: "m" + cid + m.id, uid: m.by, label: m.text || (m.poll && m.poll.question) || (m.event && m.event.title) || "Photo", sub: app.person(m.by).name + " · " + course(app, cid).code + " · " + relShort(m.ts), run: () => app.openCourse(cid, m.thread && m.thread !== "main" ? (m.thread.startsWith("sec-") ? "section" : "pset") : "chat", m.id) }));
  useEffect(() => setSel(0), [q, sc]);
  useEffect(() => { const el = listRef.current && listRef.current.querySelector(".pal-row.on"); if (el) el.scrollIntoView({ block: "nearest" }); }, [sel]);
  const go = (r) => { onClose(); setTimeout(r.run, 0); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(rows.length - 1, sel + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); }
    else if (e.key === "Enter" && rows[sel]) { e.preventDefault(); go(rows[sel]); }
    else if (e.key === "Backspace" && !q && sc) setSc(null);
  };
  let lastG = null;
  return html`<${Sheet} bare label="Search" onClose=${onClose} size="palette">
    <div class="pal-in"><${Icon} name="search" size=${20} />${sc ? html`<span class="pal-scope">${course(app, sc).code}<button onClick=${() => setSc(null)} aria-label="Search everywhere"><${Icon} name="x" size=${12} /></button></span>` : null}
      <input class="grow" placeholder=${sc ? "Search this class" : "Search messages, people, classes…"} value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${onKey} autofocus aria-label="Search" />
      <kbd>esc</kbd></div>
    <div class="pal-list" ref=${listRef} role="listbox">
      ${rows.map((r, i) => {
        const head = r.g !== lastG ? html`<div class="pal-g" key=${"g" + r.g}>${r.g}</div>` : null;
        lastG = r.g;
        return html`${head}<button key=${r.key} role="option" aria-selected=${i === sel} class=${"pal-row" + (i === sel ? " on" : "")} onMouseMove=${() => sel !== i && setSel(i)} onClick=${() => go(r)}>
          ${r.tile ? html`<${Tile} courseId=${r.tile} size=${28} />` : r.uid ? html`<${Avatar} uid=${r.uid} size=${28} />` : html`<span class="pal-ic"><${Icon} name=${r.icon} size=${18} /></span>`}
          <span class="grow pal-t"><b>${r.label}</b>${r.sub ? html`<small>${r.sub}</small>` : null}</span>${r.kbd ? html`<kbd>${r.kbd}</kbd>` : i === sel ? html`<kbd>↵</kbd>` : null}</button>`;
      })}
      ${ql && !rows.length ? html`<div class="pal-empty">No results for “${q.trim()}”${sc ? html` in ${course(app, sc).code}. <button class="link" onClick=${() => setSc(null)}>Search everywhere</button>` : ""}</div>` : null}
    </div>
    <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span class="grow"></span><span>${res.messages.length ? plural(res.messages.length, "message") : ""}</span></div>
  <//>`;
}

function ShortcutsSheet({ onClose }) {
  const rows = [["Search or jump", ["⌘", "K"]], ["Search", ["/"]], ["This list", ["?"]], ["Now", ["G", "N"]], ["Classes", ["G", "C"]], ["Calendar", ["G", "L"]], ["Board", ["G", "B"]], ["People", ["G", "P"]], ["Activity", ["G", "A"]], ["Tasks", ["G", "T"]], ["Saved", ["G", "S"]], ["You", ["G", "Y"]], ["Your 1st–9th class", ["G", "1–9"]], ["Send message", ["↵"]], ["New line", ["⇧", "↵"]], ["Cancel reply or edit", ["esc"]]];
  return html`<${Sheet} title="Keyboard shortcuts" icon="keyboard" onClose=${onClose}>
    <div class="kbdlist">${rows.map(([l, ks]) => html`<div class="kbdrow" key=${l}><span class="grow">${l}</span>${ks.map((k, i) => html`${i ? html`<small>then</small>` : null}<kbd>${k}</kbd>`)}</div>`)}</div>
  <//>`;
}

// ---- weekly story (Instagram stories mechanics; Spotify Wrapped's one-stat cards). Pull-only:
// nothing here asks you to post, and it never opens by itself. ----------------------------------
function StorySheet({ courseId, onClose }) {
  const app = useApp();
  const D = useClassData(courseId);
  const from = Sched.startOfWeek(Clock.now()), to = Sched.addDays(from, 7);
  const W = useMemo(() => Derive.week({ feed: D.messages, from, to, uid: app.uid, fixes: D.fixes, checks: D.checks, notes: D.notes }), [D.messages, D.fixes, D.checks, D.notes]);
  const look = courseLook(courseId);
  const c = course(app, courseId);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const byDay = useMemo(() => { const a = [0, 0, 0, 0, 0, 0, 0]; for (const m of D.messages) if (m.ts >= from && m.ts < to && Derive.isChat(m)) a[(Sched.et(m.ts).wd + 6) % 7]++; return a; }, [D.messages]);
  const max = Math.max(1, ...byDay);
  const cards = [
    html`<div class="st-c"><span class="st-k">${F.md.format(from)} – ${F.md.format(Sched.addDays(from, 6))}</span><h2>Your week in ${c.code}</h2><p class="st-big tnum">${W.messages}</p><p>messages from <b>${plural(W.people, "classmate")}</b></p></div>`,
    html`<div class="st-c"><span class="st-k">Busiest day</span><h2>${W.busiest ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][W.busiest.day] : "Quiet week"}</h2>
      <div class="st-bars">${byDay.map((n, d) => html`<span key=${d}><i style=${{ height: Math.max(4, (n / max) * 100) + "%" }} class=${W.busiest && (W.busiest.day + 6) % 7 === d ? "on" : ""}></i><small>${["M", "T", "W", "T", "F", "S", "S"][d]}</small></span>`)}</div>
      <p>${W.busiest ? plural(W.busiest.n, "message") + " that day" : ""}</p></div>`,
    html`<div class="st-c"><span class="st-k">Most talked about</span>${W.topProblem ? html`<h2>Problem ${prettyProblem(W.topProblem.p)}</h2><p class="st-big tnum">${W.topProblem.n}</p><p>messages tagged with it</p>` : html`<h2>No tagged problems yet</h2>`}</div>`,
    html`<div class="st-c"><span class="st-k">Most reacted</span>${W.top ? html`<blockquote class="st-q"><${RichText} text=${W.top.m.text || (W.top.m.poll && W.top.m.poll.question) || "📷 Photo"} /></blockquote><p><b>${app.person(W.top.m.by).name}</b> · ${plural(W.top.n, "reaction")}</p>` : html`<h2>No reactions yet</h2>`}
      ${W.topEmoji.length ? html`<p class="st-emoji">${W.topEmoji.map(([e, n]) => html`<span key=${e}>${e}<small>${n}</small></span>`)}</p>` : null}</div>`,
    html`<div class="st-c"><span class="st-k">Recaps</span><h2>The class checked the AI</h2><p class="st-big tnum">${W.checks}</p><p>lines checked · <b>${plural(W.fixes, "fix", "fixes")}</b> suggested · ${plural(W.notes, "set")} of notes shared</p></div>`,
    html`<div class="st-c"><span class="st-k">You</span><h2>${W.mine ? "Your week" : "You mostly read this week"}</h2><p>${plural(W.mine, "message")} · ${plural(W.myReacts, "reaction")}${W.helped ? " · replied to " + plural(W.helped, "classmate") : ""}</p><p class="st-end">That's the week in ${c.code}.</p></div>`,
  ];
  useEffect(() => { if (paused) return; const t = setTimeout(() => (i < cards.length - 1 ? setI(i + 1) : null), 6000); return () => clearTimeout(t); }, [i, paused]);
  useEffect(() => { const k = (e) => { if (e.key === "ArrowRight") setI((x) => Math.min(cards.length - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  return html`<div class="story" role="dialog" aria-label=${"Your week in " + c.code} style=${{ "--st": look.solid }}>
    <div class="st-prog">${cards.map((_, j) => html`<i key=${j}><b class=${j < i ? "done" : j === i ? (paused ? "on paused" : "on") : ""}></b></i>`)}</div>
    <header class="st-h"><${Tile} courseId=${courseId} size=${32} /><b class="grow">${c.code}</b><button class="iconbtn" onClick=${() => setPaused(!paused)} aria-label=${paused ? "Play" : "Pause"}><${Icon} name=${paused ? "play" : "pause"} fill=${true} /></button><button class="iconbtn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></header>
    <div class="st-body" key=${i}>${cards[i]}</div>
    <button class="st-tap l" onClick=${() => setI(Math.max(0, i - 1))} aria-label="Previous"></button>
    <button class="st-tap r" onClick=${() => (i < cards.length - 1 ? setI(i + 1) : onClose())} aria-label="Next"></button>
  </div>`;
}

// ---- add classes / edit profile / about ----------------------------------------------------------
function AddClassesSheet({ onClose }) {
  const app = useApp();
  const [picked, setPicked] = useState([]);
  const fresh = picked.filter((p) => !app.myCourses.includes(p.id));
  const join = async () => { const ok = await app.joinCourses({ picked: fresh }); if (ok) { onClose(); app.toast("Added " + plural(fresh.length, "class", "classes")); app.openCourse(fresh[0].id); } };
  return html`<${Sheet} title="Add classes" icon="plus" onClose=${onClose} size="tall" footer=${html`<button class="btn primary block" disabled=${!fresh.length} onClick=${join}>${fresh.length ? "Join " + plural(fresh.length, "class chat") : "Pick a class"}</button>`}>
    <${CoursePicker} picked=${picked} setPicked=${setPicked} exclude=${app.myCourses} />
  <//>`;
}

const SWATCHES = ["#CC5049", "#D67722", "#B8860B", "#3A9A1F", "#2B8FAA", "#2F7CC2", "#955CDB", "#C7508B", "#6C6C70"];
function EditProfileSheet({ onClose }) {
  const app = useApp();
  const me = app.me || {};
  const [name, setName] = useState(me.displayName || "");
  const [year, setYear] = useState(me.year || "'29");
  const [house, setHouse] = useState(me.house || "");
  const [conc, setConc] = useState(me.concentration || "");
  const [color, setColor] = useState(me.color || app.person(app.uid).color);
  const [photo, setPhoto] = useState(me.photo || "");
  const [prompts, setPrompts] = useState(() => { const p = [...(me.prompts || [])]; while (p.length < 3) p.push({ q: Catalog.PROMPTS[p.length + 2], a: "" }); return p.slice(0, 3); });
  const ref = useRef(null);
  const onFile = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { const img = await Media.compress(f, { max: 320 }); setPhoto(img.src); } catch (_) { app.toast("That file isn't an image Roster can read."); } };
  const save = async () => {
    const ok = await app.updateProfile({ displayName: name.trim(), year, house, concentration: conc, color, photo, prompts: prompts.filter((p) => p.a.trim()).map((p) => ({ q: p.q, a: p.a.trim() })) });
    if (ok) onClose();
  };
  const setP = (i, patch) => setPrompts(prompts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return html`<${Sheet} title="Edit profile" icon="edit" onClose=${onClose} size="tall" footer=${html`<button class="btn ghost" onClick=${onClose}>Cancel</button><button class="btn primary" disabled=${!name.trim()} onClick=${save}>Save</button>`}>
    <div class="ep-av"><span class="av" style=${{ width: "84px", height: "84px", fontSize: "32px", "--av": color }}>${photo ? html`<img src=${Media.resolve(photo)} alt="" />` : html`<span class="av-in">${initials(name)}</span>`}</span>
      <div class="grow"><button class="btn sm soft" onClick=${() => ref.current && ref.current.click()}><${Icon} name="camera" size=${16} />${photo ? "Change photo" : "Add photo"}</button>${photo ? html` <button class="btn sm ghost" onClick=${() => setPhoto("")}>Remove</button>` : null}
        <div class="swatches" role="radiogroup" aria-label="Colour">${SWATCHES.map((s) => html`<button key=${s} role="radio" aria-checked=${color === s} class=${"sw" + (color === s ? " on" : "")} style=${{ background: s }} onClick=${() => setColor(s)} aria-label=${s}></button>`)}</div></div>
      <input type="file" accept="image/*" hidden ref=${ref} onChange=${onFile} /></div>
    <label class="field"><span>Name</span><input class="input" value=${name} onInput=${(e) => setName(e.target.value)} autocomplete="name" /></label>
    <div class="field-row"><label class="field"><span>Class year</span><select class="input" value=${year} onChange=${(e) => setYear(e.target.value)}>${Catalog.years.map((y) => html`<option value=${y}>Class of 20${y.slice(1)}</option>`)}</select></label>
      <label class="field"><span>House</span><select class="input" value=${house} onChange=${(e) => setHouse(e.target.value)}><option value="">Choose…</option>${Catalog.houses.map((h) => html`<option value=${h}>${h}</option>`)}</select></label></div>
    <label class="field"><span>Concentration</span><select class="input" value=${conc} onChange=${(e) => setConc(e.target.value)}><option value="">Choose…</option>${Catalog.CONCENTRATIONS.map((c) => html`<option value=${c}>${c}</option>`)}</select></label>
    <div class="field"><span>Prompts</span>${prompts.map((p, i) => html`<div class="promptedit" key=${i}>
      <select class="pe-q" value=${p.q} onChange=${(e) => setP(i, { q: e.target.value })}>${Catalog.PROMPTS.map((q) => html`<option value=${q}>${q}</option>`)}</select>
      <textarea class="input" rows="2" maxlength="150" placeholder="Your answer" value=${p.a} onInput=${(e) => setP(i, { a: e.target.value })}></textarea></div>`)}</div>
    <p class="muted sm">${house && house !== me.house ? "Changing your House moves you to its chat too. " : ""}Everyone in your classes can see your profile.</p>
  <//>`;
}

function AboutSheet({ onClose }) {
  const app = useApp();
  return html`<${Sheet} title="About this study" icon="info" onClose=${onClose}>
    <p class="lead">Roster is a student project for ES30 at Harvard testing one question: if everyone in a class is placed in its chat automatically, do people actually use it, and do they keep using it?</p>
    <h3 class="h3">What's counted</h3>
    <ul class="bul"><li>How many people post, reply or react in each pset cycle, and whether they come back the next cycle.</li><li>How many people open the chat on a given day (one mark per day, not every visit).</li><li>Fixes suggested to AI lecture recaps.</li></ul>
    <h3 class="h3">What isn't</h3>
    <ul class="bul"><li>The organizer's export has no names and no message text. People are listed as S001, S002…</li><li>Tasks, Saved and your status history are private to you.</li><li>Nothing is sold or shared outside this class.</li></ul>
    <p class="muted sm">${app.demo ? "You're in the demo class: everything you do stays in this browser." : "Questions or want your data removed? Message the organizer in any class chat."}</p>
  <//>`;
}

const SHEETS = {
  profile: ProfileSheet, event: EventSheet, photo: PhotoSheet, "photo-send": PhotoSendSheet, attach: AttachSheet, "poll-new": PollNewSheet,
  "event-new": EventNewSheet, "note-new": NoteNewSheet, note: NoteSheet, fix: FixSheet, report: ReportSheet, confirm: ConfirmSheet,
  survey: SurveySheet, pledge: PledgeSheet, palette: Palette, shortcuts: ShortcutsSheet, story: StorySheet, status: StatusSheet,
  "task-new": TaskNewSheet, "add-classes": AddClassesSheet, "edit-profile": EditProfileSheet, about: AboutSheet,
  "board-new": BoardNewSheet, "board-post": BoardPostSheet, meetings: MeetingsSheet,
  organizer: (p) => html`<${OrganizerSheet} ...${p} />`,
};
