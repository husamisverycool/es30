// ---------------------------------------------------------------------------
// People: friends and who's free (Saturn), people who added you (Instagram's
// "Follow back"), suggestions from shared classes and your House, a
// directory, and profiles (Hinge's vitals + prompts, Saturn's schedule
// compare, Discord's mutual servers strip).
// ---------------------------------------------------------------------------
function personMeetings(app, m) { return Derive.meetingsOf(m, (id) => course(app, id)); }
function freeLabel(app, m, now) {
  const mt = personMeetings(app, m);
  const busy = Derive.busyAt(mt, now);
  if (busy) return { busy, text: "In " + course(app, busy.cid).code + " · free in " + inWords(busy.end - now), tone: "busy" };
  const next = Derive.nextOf(mt, now, 1);
  if (next && Sched.et(next.start).key === Sched.et(now).key) return { text: "Free until " + tShort(next.start), tone: "free" };
  return { text: "Free the rest of today", tone: "free" };
}

function PeopleView() {
  const app = useApp();
  useTick(30000);
  const now = Clock.now();
  const [q, setQ] = useState("");
  const me = app.me || {};
  const following = Object.entries(me.following || {}).filter(([, t]) => t).map(([id]) => id);
  const friends = following.map((id) => app.membersById[id]).filter(Boolean);
  const addedYou = app.members.filter((m) => m.id !== app.uid && m.following && m.following[app.uid] && !(me.following && me.following[m.id]));
  const sugg = useMemo(() => Derive.suggestions(me, app.members, app.uid).filter((x) => !x.addedYou).slice(0, 12), [app.members, me]);
  const st = me.status && me.status.e && me.status.until > now ? me.status : null;
  const withState = friends.map((m) => ({ m, f: freeLabel(app, m, now), st: m.status && m.status.e && m.status.until > now ? m.status : null }));
  const free = withState.filter((x) => x.f.tone === "free"), busy = withState.filter((x) => x.f.tone === "busy");
  const myIds = new Set(app.myCourses);
  const dir = q.trim() ? app.members.filter((m) => m.id !== app.uid && [m.displayName, m.house, m.concentration, m.year].join(" ").toLowerCase().includes(q.trim().toLowerCase()) && Object.keys(m.courses || {}).some((c) => myIds.has(c))).slice(0, 40) : [];
  return html`<div class="page">
    <${PageHead} title="People" sub=${plural(friends.length, "friend") + " · " + plural(new Set(app.members.filter((m) => m.id !== app.uid && Object.keys(m.courses || {}).some((c) => myIds.has(c) && Catalog.isCourse(c))).map((m) => m.id)).size, "classmate")} />
    <div class="scroller page-scroll"><div class="page-in">
      <button class="statusrow" onClick=${() => app.open("status")}>
        <${Avatar} uid=${app.uid} size=${40} />
        <span class="grow"><small>Your status</small><b>${st ? st.e + " " + st.text : "Set a status"}</b>${st ? html`<small>until ${tShort(st.until)}</small>` : html`<small>Friends see it on their Now screen</small>`}</span>
        <${Icon} name="chevronRight" size=${16} />
      </button>
      <input class="input search" placeholder="Search people in your classes" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search people" />
      ${q.trim() ? html`<section><h2 class="sec-h">Results</h2><div class="group">${dir.length ? dir.map((m) => html`<${PersonRow} key=${m.id} m=${m} right=${html`<${FollowBtn} id=${m.id} sm=${true} />`} />`) : html`<div class="rowempty">No one in your classes matches “${q.trim()}”.</div>`}</div></section>` : html`
      ${addedYou.length ? html`<section><h2 class="sec-h">Added you</h2><div class="group">${addedYou.map((m) => html`<${PersonRow} key=${m.id} m=${m} right=${html`<${FollowBtn} id=${m.id} sm=${true} back=${true} />`} />`)}</div></section>` : null}
      ${friends.length ? html`
        <section><h2 class="sec-h">Free now <span class="sec-n">${free.length}</span></h2><div class="group">${free.length ? free.map(({ m, f, st: s }) => html`<${FriendRow} key=${m.id} m=${m} f=${f} st=${s} />`) : html`<div class="rowempty">Everyone's in class right now.</div>`}</div></section>
        ${busy.length ? html`<section><h2 class="sec-h">In class <span class="sec-n">${busy.length}</span></h2><div class="group">${busy.map(({ m, f, st: s }) => html`<${FriendRow} key=${m.id} m=${m} f=${f} st=${s} />`)}</div></section>` : null}`
      : html`<div class="hintcard"><${Icon} name="users" size=${22} /><div><b>Add friends from your classes</b><p>When you add each other, you'll see each other's status and when you're both free.</p></div></div>`}
      ${sugg.length ? html`<section><div class="sec-hrow"><h2 class="sec-h">People you may know</h2></div>
        <div class="pcardrail">${sugg.map((x) => html`<${SuggCard} key=${x.m.id} x=${x} />`)}</div></section>` : null}`}
      <p class="fine">Only your name, House, year, concentration, classes and prompts are visible to classmates. Your class times are shared only with friends who add you back.</p>
    </div></div>
  </div>`;
}

function FriendRow({ m, f, st }) {
  const app = useApp();
  const now = Clock.now();
  const mutual = app.isFriend(m.id);
  return html`<button class="prow friendrow" onClick=${() => app.open("profile", { uid: m.id })}>
    <span class="friend-av sm">${f.busy ? html`<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" pathLength="100" style=${{ strokeDasharray: Math.round(((f.busy.end - now) / (f.busy.end - f.busy.start)) * 100) + " 100" }} /></svg>` : null}<${Avatar} uid=${m.id} size=${44} online=${app.online.has(m.id)} /></span>
    <span class="grow prow-t"><b>${m.displayName}</b><small>${st ? st.e + " " + st.text + " · " : ""}${mutual ? f.text : "Waiting for them to add you back"}</small></span>
    <span class=${"pill " + (f.tone === "free" ? "ok" : "")}>${f.tone === "free" ? "Free" : Math.ceil((f.busy.end - now) / 60e3) + "m left"}</span>
  </button>`;
}

function FollowBtn({ id, sm, back }) {
  const app = useApp();
  const on = !!(app.me && app.me.following && app.me.following[id]);
  const mutual = app.isFriend(id);
  if (!app.canWrite) return null;
  return html`<button class=${"btn " + (sm ? "sm " : "") + (on ? "ghost" : "primary")} onClick=${(e) => { e.stopPropagation(); app.follow(id); }} aria-pressed=${on}>
    ${on ? html`<${Icon} name=${mutual ? "userCheck" : "check"} size=${15} />${mutual ? "Friends" : "Added"}` : html`<${Icon} name="userPlus" size=${15} />${back ? "Add back" : "Add"}`}</button>`;
}

function SuggCard({ x }) {
  const app = useApp();
  const m = x.m;
  const why = x.shared.length ? x.shared.slice(0, 2).map((c) => course(app, c).code).join(" · ") + (x.house ? " · " + shortHouse(m.house) : "") : shortHouse(m.house);
  return html`<div class="pcard">
    <button class="pcard-b" onClick=${() => app.open("profile", { uid: m.id })}><${Avatar} uid=${m.id} size=${64} /><b>${m.displayName}</b><small>${why}</small></button>
    <${FollowBtn} id=${m.id} sm=${true} />
  </div>`;
}

// ---- profile sheet ---------------------------------------------------------------------
function ProfileSheet({ uid, courseId, onClose }) {
  const app = useApp();
  useTick(30000);
  const p = app.person(uid);
  const m = p.member || {};
  const now = Clock.now();
  const self = uid === app.uid;
  const mutual = app.isFriend(uid);
  const addedYou = !!(m.following && m.following[app.uid]);
  const st = m.status && m.status.e && m.status.until > now ? m.status : null;
  const theirs = Object.keys(m.courses || {});
  const shared = theirs.filter((c) => app.myCourses.includes(c));
  const sharedSec = shared.filter((c) => Catalog.isCourse(c) && m.sections && app.me && app.me.sections && m.sections[c] && m.sections[c] === app.me.sections[c]);
  const vit = [m.year && ["grad", "Class of 20" + m.year.slice(1)], m.house && ["house", m.house === "Pforzheimer" ? "Pfoho" : m.house], m.concentration && ["book", m.concentration]].filter(Boolean);
  const fl = !self && mutual ? freeLabel(app, m, now) : null;
  const msgIn = courseId && Catalog.isCourse(courseId) ? courseId : shared.find(Catalog.isCourse) || shared[0];
  const mention = () => {
    if (!msgIn) return;
    const key = "roster:draft:" + msgIn + ":main";
    const cur = LS.get(key, "");
    LS.set(key, (cur ? cur + " " : "") + "@" + p.name + " ");
    onClose();
    app.openCourse(msgIn);
  };
  return html`<${Sheet} bare label=${p.name} onClose=${onClose} size="tall">
    <div class="prof">
      <div class="prof-cover" style=${{ "--av": p.color }}></div>
      <div class="prof-id">
        <span class="prof-av"><${Avatar} uid=${uid} size=${88} online=${app.online.has(uid)} /></span>
        <h2>${p.name}${m.verified ? html`<span class="verified" title=${m.verified === "org" ? "Verified member of the class's organization" : m.verified === "placed" ? "Placed in this class by the organizer" : m.verified === "organizer" ? "Organizer" : "Verified " + m.verified + " account"}><${Icon} name="checkCircle" size=${18} fill=${true} /></span>` : null}</h2>
        ${app.demo && uid !== app.uid ? html`<span class="pill sm">Example classmate</span>` : null}
        ${st ? html`<span class="prof-status">${st.e} ${st.text} <small>until ${tShort(st.until)}</small></span>` : null}
      </div>
      ${vit.length ? html`<div class="vitals">${vit.map(([ic, t]) => html`<span key=${t}><${Icon} name=${ic} size=${16} />${t}</span>`)}</div>` : null}
      <div class="prof-acts">
        ${self ? html`<button class="btn primary" onClick=${() => { onClose(); app.open("edit-profile"); }}><${Icon} name="edit" size=${16} />Edit profile</button><button class="btn ghost" onClick=${() => { onClose(); app.open("status"); }}>Set status</button>`
          : html`<${FollowBtn} id=${uid} back=${addedYou} />${msgIn ? html`<button class="btn ghost" onClick=${mention}><${Icon} name="chat" size=${16} />Mention in ${course(app, msgIn).code}</button>` : null}`}
      </div>
      ${!self && addedYou && !mutual ? html`<p class="muted sm center">${firstName(p.name)} added you. Add back to see each other's free time.</p>` : null}
      ${fl ? html`<div class=${"freebar " + fl.tone}><i></i>${fl.text}</div>` : null}
      ${!self && shared.length ? html`<section class="prof-sec"><h3 class="eyebrow">In common</h3><div class="shared">${shared.map((c) => html`<button key=${c} class="sharedc" onClick=${() => { onClose(); app.openCourse(c); }}><${Tile} courseId=${c} size=${36} /><span>${course(app, c).code}</span>${sharedSec.includes(c) ? html`<small>Same section</small>` : null}</button>`)}</div></section>` : null}
      ${(m.prompts || []).filter((x) => x.a).length ? html`<section class="prof-sec">${m.prompts.filter((x) => x.a).map((x) => html`<div class="promptcard" key=${x.q}><small>${x.q}</small><p>${x.a}</p></div>`)}</section>` : self ? html`<button class="promptcard empty" onClick=${() => { onClose(); app.open("edit-profile", { focus: "prompts" }); }}><small>Add a prompt</small><p>Give classmates something to say hi about.</p></button>` : null}
      ${theirs.filter(Catalog.isCourse).length ? html`<section class="prof-sec"><h3 class="eyebrow">${self ? "Your" : firstName(p.name) + "'s"} classes</h3><div class="shelf">${theirs.filter(Catalog.isCourse).map((c) => html`<span class="shelf-c" key=${c}><${Tile} courseId=${c} size=${52} /><small>${course(app, c).code}</small></span>`)}</div></section>` : null}
      ${!self ? (mutual ? html`<${Compare} other=${m} name=${firstName(p.name)} />` : html`<div class="hintcard"><${Icon} name="lock" size=${20} /><div><b>Compare schedules</b><p>Add each other to see when you're both free this week.</p></div></div>`) : null}
      ${!self && app.canWrite ? html`<div class="prof-foot"><button class="link danger" onClick=${() => app.open("report", { person: uid })}>Report ${firstName(p.name)}</button></div>` : null}
    </div>
  <//>`;
}

// Saturn's "Me | Them" side-by-side day, with shared free blocks highlighted.
function Compare({ other, name }) {
  const app = useApp();
  const now = Clock.now();
  const week = Sched.startOfWeek(now);
  const todayIdx = (Sched.et(now).wd + 6) % 7;
  const [di, setDi] = useState(Math.min(4, todayIdx));
  const day = Sched.addDays(week, di);
  const mine = myMeetings(app), theirs = personMeetings(app, other);
  const together = Derive.freeTogether(mine, theirs, day);
  const lo = 8 * 60, hi = 22 * 60, px = 0.6;
  const occ = (mt) => Sched.occurrences(mt, Sched.startOfDay(day), Sched.addDays(day, 1));
  const mins = (ts) => { const q = Sched.et(ts); return q.h * 60 + q.mi; };
  const block = (o) => html`<span class="cmp-ev" key=${o.cid + o.start} style=${{ top: (mins(o.start) - lo) * px + "px", height: Math.max(16, ((o.end - o.start) / 60e3) * px - 2) + "px", "--edge": courseLook(o.cid).solid, "--tint": courseLook(o.cid).tint, "--tx": courseLook(o.cid).text }}><b>${course(app, o.cid).code}</b></span>`;
  return html`<section class="prof-sec"><h3 class="eyebrow">Free together</h3>
    <div class="seg days" role="tablist">${["M", "Tu", "W", "Th", "F"].map((l, i) => html`<button key=${l} role="tab" aria-selected=${di === i} class=${di === i ? "on" : ""} onClick=${() => setDi(i)}>${l}</button>`)}</div>
    <div class="freelist">${together.length ? together.map(([s, e]) => html`<span class="freechip" key=${s}>${tShort(s)}–${tShort(e)}</span>`) : html`<span class="muted sm">No shared free time between 8 AM and 10 PM.</span>`}</div>
    <div class="cmp">
      <div class="cmp-gut">${[9, 12, 15, 18, 21].map((h) => html`<span key=${h} style=${{ top: (h * 60 - lo) * px + "px" }}>${Sched.fmtMin(h * 60).replace(":00", "")}</span>`)}</div>
      <div class="cmp-col"><small class="cmp-h">You</small><div class="cmp-track" style=${{ height: (hi - lo) * px + "px" }}>${together.map(([s, e]) => html`<i class="cmp-free" key=${"f" + s} style=${{ top: (mins(s) - lo) * px + "px", height: ((e - s) / 60e3) * px + "px" }}></i>`)}${occ(mine).map(block)}</div></div>
      <div class="cmp-col"><small class="cmp-h">${name}</small><div class="cmp-track" style=${{ height: (hi - lo) * px + "px" }}>${together.map(([s, e]) => html`<i class="cmp-free" key=${"f" + s} style=${{ top: (mins(s) - lo) * px + "px", height: ((e - s) / 60e3) * px + "px" }}></i>`)}${occ(theirs).map(block)}</div></div>
    </div>
  </section>`;
}

// ---- status (Slack's status picker: emoji + text + "clear after") -------------------------
function StatusSheet({ onClose }) {
  const app = useApp();
  const cur = app.me && app.me.status && app.me.status.e && app.me.status.until > Clock.now() ? app.me.status : null;
  const [e, setE] = useState(cur ? cur.e : "📚");
  const [text, setText] = useState(cur ? cur.text : "");
  const [dur, setDur] = useState(120);
  const until = dur === -1 ? Sched.startOfDay(Sched.addDays(Clock.now(), 1)) : Clock.now() + dur * 60e3;
  const save = async () => { const ok = await app.setStatus({ e, text: text.trim() || (Catalog.STATUSES.find((s) => s[0] === e) || ["", "Busy"])[1], until }); if (ok) onClose(); };
  return html`<${Sheet} title="Set a status" icon="smile" onClose=${onClose}
    footer=${html`${cur ? html`<button class="btn ghost" onClick=${async () => { if (await app.setStatus(null)) onClose(); }}>Clear status</button>` : null}<span class="grow"></span><button class="btn primary" onClick=${save}>Save</button>`}>
    <div class="status-in"><span class="emo big">${e}</span><input class="input" maxlength="40" placeholder="What are you up to?" value=${text} onInput=${(ev) => setText(ev.target.value)} autofocus /></div>
    <div class="group">${Catalog.STATUSES.map(([em, l]) => html`<button key=${l} class=${"statusopt" + (e === em && text === l ? " on" : "")} onClick=${() => { setE(em); setText(l); }}><span class="emo">${em}</span><span class="grow">${l}</span>${e === em && text === l ? html`<${Icon} name="check" size=${16} />` : null}</button>`)}</div>
    <label class="field"><span>Clear after</span>
      <div class="seg">${[[30, "30 min"], [60, "1 hour"], [120, "2 hours"], [240, "4 hours"], [-1, "Today"]].map(([v, l]) => html`<button key=${v} class=${dur === v ? "on" : ""} onClick=${() => setDur(v)}>${l}</button>`)}</div></label>
    <p class="muted sm">Friends see your status on their Now screen until ${tShort(until)}${dur === -1 ? " tonight" : ""}.</p>
  <//>`;
}
