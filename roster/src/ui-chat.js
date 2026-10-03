// ---------------------------------------------------------------------------
// Chat surface (messaging spec): runs, bubbles, reactions, replies, photos,
// polls, study-session cards, catch-up, composer with attachments + mentions.
// ---------------------------------------------------------------------------
const RUN_GAP = 5 * 60e3; // Bluesky: cluster within 5 minutes
function buildBlocks(msgs, uid, lastRead) {
  const blocks = [];
  let lastDay = null, run = null, unreadPlaced = false;
  for (const m of msgs) {
    const dk = dayKey(m.ts);
    if (dk !== lastDay) { blocks.push({ type: "day", ts: m.ts, key: "d" + dk }); lastDay = dk; run = null; }
    if (!unreadPlaced && lastRead && m.ts > lastRead && m.by !== uid && m.kind !== "system") { blocks.push({ type: "unread", key: "unread" }); unreadPlaced = true; run = null; }
    if (["system", "recap", "due", "announce", "poll", "event"].includes(m.kind)) { blocks.push({ type: m.kind, m, key: m.id }); run = null; continue; }
    if (run && run.by === m.by && m.ts - run.last < RUN_GAP && run.items.length < 14) { run.items.push(m); run.last = m.ts; }
    else { run = { type: "run", by: m.by, items: [m], last: m.ts, key: "r" + m.id }; blocks.push(run); }
  }
  return blocks;
}

function MessageList({ courseId, messages, byId, lastRead, empty, header, recapCtx, catchup }) {
  const app = useApp();
  const scroller = useRef(null);
  const [newCount, setNewCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const prevLen = useRef(0);
  const opened = useRef(false);
  const blocks = useMemo(() => buildBlocks(messages, app.uid, lastRead), [messages, app.uid, lastRead]);
  const unreadN = useMemo(() => messages.filter((m) => m.ts > lastRead && m.by !== app.uid && m.kind !== "system").length, [messages, lastRead]);
  const nearBottom = () => { const el = scroller.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160; };
  const toBottom = (smooth) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); };
  const toUnread = () => { const el = scroller.current, d = el && el.querySelector(".unread-div"); if (d) el.scrollTo({ top: Math.max(0, d.offsetTop - 90), behavior: "smooth" }); };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!opened.current && messages.length) {
      opened.current = true;
      const div = el.querySelector(".unread-div");
      if (div && unreadN > 4) el.scrollTop = Math.max(0, div.offsetTop - 120); else el.scrollTop = el.scrollHeight;
      prevLen.current = messages.length;
      setAtBottom(nearBottom());
      return;
    }
    if (messages.length > prevLen.current) {
      const last = messages[messages.length - 1];
      if (atBottom || (last && last.by === app.uid)) requestAnimationFrame(() => toBottom(true));
      else setNewCount((n) => n + (messages.length - prevLen.current));
    }
    prevLen.current = messages.length;
  }, [messages]);
  const onScroll = () => { const b = nearBottom(); if (b !== atBottom) setAtBottom(b); if (b && newCount) setNewCount(0); };
  const flash = (id) => {
    const el = scroller.current && scroller.current.querySelector('[data-mid="' + id + '"]');
    if (!el) { app.toast("That message is further back than this chat has loaded."); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };
  return html`<div class="scroller" ref=${scroller} onScroll=${onScroll}>
    <div class="msgs">
      ${header || null}
      ${catchup ? html`<${CatchUp} courseId=${courseId} messages=${messages} lastRead=${lastRead} byId=${byId} onJump=${flash} onUnread=${toUnread} />` : null}
      ${messages.length === 0 ? empty : null}
      ${blocks.map((b) => {
        if (b.type === "day") return html`<div class="daysep" key=${b.key}><span>${dayLabel(b.ts)}</span></div>`;
        if (b.type === "unread") return html`<div class="unread-div" key="unread"><span>${plural(unreadN, "new message")}</span></div>`;
        if (b.type === "system") return html`<div class="sysline" key=${b.key}>${b.m.text}</div>`;
        if (b.type === "recap") return html`<${RecapInChat} key=${b.key} m=${b.m} courseId=${courseId} ctx=${recapCtx} />`;
        if (b.type === "due") return html`<${DueCard} key=${b.key} m=${b.m} courseId=${courseId} />`;
        if (b.type === "announce") return html`<${AnnounceCard} key=${b.key} m=${b.m} />`;
        if (b.type === "poll") return html`<${CardMsg} key=${b.key} m=${b.m} courseId=${courseId} byId=${byId} flash=${flash}><${PollCard} m=${b.m} courseId=${courseId} /><//>`;
        if (b.type === "event") return html`<${CardMsg} key=${b.key} m=${b.m} courseId=${courseId} byId=${byId} flash=${flash}><${EventCard} m=${b.m} courseId=${courseId} /><//>`;
        return html`<${Run} key=${b.key} run=${b} courseId=${courseId} byId=${byId} flash=${flash} />`;
      })}
    </div>
    <button class=${"jump" + (atBottom ? "" : " show") + (newCount ? " wide" : "")} onClick=${() => { toBottom(true); setNewCount(0); }} aria-label="Jump to latest" tabindex=${atBottom ? -1 : 0}>
      <${Icon} name="arrowDown" size=${18} />${newCount ? html`<span>${newCount} new</span>` : null}
    </button>
  </div>`;
}

// "While you were away" — extractive, no AI, no calls to action (AI+data spec c).
function CatchUp({ courseId, messages, lastRead, byId, onJump, onUnread }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const d = useMemo(() => Derive.digest(messages, lastRead, app.uid), [messages, lastRead]);
  const away = Clock.now() - lastRead;
  const hub = app.hubs[courseId];
  const due = ((hub && hub.due) || []).filter((x) => x.at > Clock.now()).sort((a, b) => a.at - b.at)[0];
  const mentions = messages.filter((m) => m.ts > lastRead && (m.mentions || []).includes(app.uid));
  const things = d.top.length + d.questions.length + d.recaps.length + (d.shares.length ? 1 : 0) + mentions.length;
  if (gone || (d.count < 25 && away < 864e5) || !d.count) return null;
  const Q = ({ m, meta }) => html`<button class="cu-q" onClick=${() => onJump(m.id)}>
    <span class="cu-q-t">${m.kind === "photo" ? "📷 " : ""}<${RichText} text=${m.text || (m.poll && m.poll.question) || ""} /></span>
    <span class="cu-q-m"><${Avatar} uid=${m.by} size=${16} />${firstName(app.person(m.by).name)} · ${meta}</span></button>`;
  return html`<section class=${"catchup" + (open ? " open" : "")} aria-label="While you were away">
    <button class="cu-bar" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <span class="cu-dot"></span><span class="cu-t"><b>While you were away</b> · ${plural(d.count, "message")}${things ? " · " + plural(things, "thing") + " to see" : ""}</span>
      <${Icon} name="chevronDown" size=${16} />
    </button>
    ${open ? html`<div class="cu-body">
      ${mentions.length ? html`<div class="cu-sec"><span class="eyebrow">Mentions of you</span>${mentions.slice(-2).map((m) => html`<${Q} key=${m.id} m=${m} meta=${relShort(m.ts)} />`)}</div>` : null}
      ${due ? html`<div class="cu-sec"><span class="eyebrow">Due soon</span><div class="cu-due"><span>${due.title}</span><span class=${"due-tone " + dueLadder(due.at).tone}>${dueLadder(due.at).text}</span></div></div>` : null}
      ${d.recaps.length ? html`<div class="cu-sec"><span class="eyebrow">New recap</span>${d.recaps.map((m) => html`<button class="cu-q" key=${m.id} onClick=${() => onJump(m.id)}><span class="cu-q-t">${m.text}</span></button>`)}</div>` : null}
      ${d.top.length ? html`<div class="cu-sec"><span class="eyebrow">Most reacted</span>${d.top.slice(0, 2).map((m) => html`<${Q} key=${m.id} m=${m} meta=${Derive.countReacts(m) + " reactions · " + relShort(m.ts)} />`)}</div>` : null}
      ${d.questions.length ? html`<div class="cu-sec"><span class="eyebrow">Open questions</span>${d.questions.slice(-2).map((m) => html`<${Q} key=${m.id} m=${m} meta=${"no replies yet · " + relShort(m.ts)} />`)}</div>` : null}
      ${d.shares.length ? html`<div class="cu-sec"><span class="eyebrow">Shared</span><div class="cu-chips">${d.shares.map((m) => html`<button class="chip" onClick=${() => onJump(m.id)}>${m.kind === "photo" ? "📷 Photo" : "🔗 Link"} · ${firstName(app.person(m.by).name)}</button>`)}</div></div>` : null}
      <div class="cu-foot"><span>Picked by reactions and replies. Nothing here is written by AI.</span>
        <span class="cu-acts"><button onClick=${onUnread}>Read from where I left off</button><button onClick=${() => setGone(true)}>Dismiss</button></span></div>
    </div>` : null}
  </section>`;
}

function Run({ run, courseId, byId, flash }) {
  const app = useApp();
  const mine = run.by === app.uid;
  const p = app.person(run.by);
  return html`<div class=${"run" + (mine ? " mine" : "")}>
    ${mine ? null : html`<button class="run-av" onClick=${() => app.open("profile", { uid: run.by, courseId })} aria-label=${"View " + p.name}><${Avatar} uid=${run.by} size=${30} online=${app.online.has(run.by)} /></button>`}
    <div class="col">
      ${run.items.map((m, i) => html`<${Msg} key=${m.id} m=${m} first=${i === 0} last=${i === run.items.length - 1} mine=${mine} person=${p} courseId=${courseId} byId=${byId} flash=${flash} />`)}
      ${mine ? html`<div class="mine-meta">${tShort(run.last)}</div>` : null}
    </div>
  </div>`;
}

// Poll / event cards keep an author row (Discord poll card).
function CardMsg({ m, courseId, byId, flash, children }) {
  const app = useApp();
  const p = app.person(m.by);
  return html`<div class=${"cardmsg" + (m.by === app.uid ? " mine" : "")} data-mid=${m.id}>
    <div class="cardmsg-h"><button class="run-av" onClick=${() => app.open("profile", { uid: m.by, courseId })}><${Avatar} uid=${m.by} size=${22} /></button>
      <b style=${{ color: nameColor(m.by) }}>${m.by === app.uid ? "You" : p.name}</b><span class="tm">${relShort(m.ts)}</span>
      <span class="grow"></span>${(m.tags || []).map((t) => html`<span class="pchip">${prettyProblem(t)}</span>`)}
      <${MsgMenuButton} m=${m} courseId=${courseId} />
    </div>
    ${children}
    <${Reactions} m=${m} courseId=${courseId} />
  </div>`;
}

function Reactions({ m, courseId }) {
  const app = useApp();
  const [pop, setPop] = useState(null);
  const reacts = Object.entries(m.reactions || {})
    .map(([e, who]) => ({ e, ids: Object.entries(who || {}).filter(([, t]) => t).sort((a, b) => a[1] - b[1]).map(([id]) => id) }))
    .filter((r) => r.ids.length).sort((a, b) => b.ids.length - a.ids.length);
  if (!reacts.length) return null;
  return html`<div class="reacts">${reacts.map((r) => {
    const me = r.ids.includes(app.uid);
    const names = r.ids.slice(0, 6).map((id) => (id === app.uid ? "You" : app.person(id).name)).join(", ") + (r.ids.length > 6 ? " and " + (r.ids.length - 6) + " more" : "");
    return html`<button key=${r.e} class=${"react" + (me ? " me" : "")} title=${names} aria-label=${r.e + " " + names} disabled=${!app.canWrite}
      onClick=${(ev) => { const el = ev.currentTarget; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); app.react(courseId, m, r.e); }}>
      <span class="emo">${r.e}</span>${r.ids.length <= 3 ? html`<${Faces} ids=${r.ids} size=${16} max=${3} />` : html`<span class="n">${r.ids.length}</span>`}</button>`;
  })}${app.canWrite ? html`<button class="react add" onClick=${(e) => setPop(e.currentTarget)} aria-label="Add reaction"><${Icon} name="smile" size=${16} /></button>` : null}
  ${pop ? html`<${Popover} anchor=${pop} onClose=${() => setPop(null)}><${ReactionTray} onPick=${(e) => { setPop(null); app.react(courseId, m, e); }} /><//>` : null}</div>`;
}

function msgActions(app, m, courseId, mine) {
  const savedOn = !!app.saved[courseId + "~" + m.id];
  return [
    [app.canWrite && { key: "reply", label: "Reply", icon: "reply" }, m.text && { key: "copy", label: "Copy text", icon: "paste" }, { key: "save", label: savedOn ? "Remove from Saved" : "Save", icon: "bookmark", hint: "S" }],
    [mine && m.thread && m.thread !== "main" && m.text && /\?/.test(m.text) && { key: "resolve", label: m.resolved ? "Mark as open" : "Mark as answered", icon: "checkCircle" },
      mine && m.kind === "text" && { key: "edit", label: "Edit", icon: "edit" }],
    [!mine && { key: "profile", label: "View " + firstName(app.person(m.by).name) + "'s profile", icon: "users" }],
    [!mine && { key: "report", label: "Report", icon: "flag", danger: true }, app.isOrganizer && !mine && { key: "hide", label: m.hidden ? "Restore message" : "Remove for everyone", icon: "x", danger: true }, mine && { key: "delete", label: "Delete", icon: "x", danger: true }],
  ].filter((g) => g.some(Boolean));
}
function runAction(app, it, m, courseId, extra) {
  const k = it.key;
  if (k === "reply") app.setReplyTo(m);
  if (k === "copy") navigator.clipboard.writeText(m.text || "").then(() => app.toast("Copied"), () => app.toast("Copy isn't available here. Select the text instead."));
  if (k === "save") app.save(courseId, m);
  if (k === "resolve") app.resolveMsg(courseId, m);
  if (k === "edit") extra && extra.edit ? extra.edit() : app.setEditing && app.setEditing({ courseId, m });
  if (k === "profile") app.open("profile", { uid: m.by, courseId });
  if (k === "report") app.open("report", { courseId, m });
  if (k === "hide") app.hideMsg(courseId, m);
  if (k === "delete") app.open("confirm", { title: "Delete this message?", body: "It's removed for everyone. Replies stay, showing “Message deleted”.", cta: "Delete", danger: true, run: () => app.deleteMsg(courseId, m) });
}
function MsgMenuButton({ m, courseId }) {
  const app = useApp();
  const [pop, setPop] = useState(null);
  const mine = m.by === app.uid;
  return html`<button class="iconbtn sm" onClick=${(e) => setPop(e.currentTarget)} aria-label="More actions"><${Icon} name="more" size=${18} /></button>
    ${pop ? html`<${Popover} anchor=${pop} onClose=${() => setPop(null)} align="right"><${Menu} items=${msgActions(app, m, courseId, mine)} onPick=${(it) => { setPop(null); runAction(app, it, m, courseId); }} /><//>` : null}`;
}

function Msg({ m, first, last, mine, person, courseId, byId, flash }) {
  const app = useApp();
  const [pop, setPop] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [dx, setDx] = useState(0);
  const g = useRef(null);
  const mentionNames = useMemo(() => (m.mentions || []).map((id) => app.person(id).name).filter(Boolean), [m.mentions, app.members]);
  if (m.deleted || (m.hidden && !app.isOrganizer)) {
    return html`<div class="msg" data-mid=${m.id}><div class="bub ghost">${m.hidden ? "Removed by the organizer" : "Message deleted"}</div></div>`;
  }
  const reply = m.replyTo ? byId[m.replyTo] : null;
  const canAct = app.canWrite;
  const onReact = (e) => { setPop(null); setSheet(false); app.react(courseId, m, e); };

  // Touch: swipe inward to reply (Bluesky 56px + 32px resistance), press-and-hold for the menu.
  const onPointerDown = (e) => {
    if (e.pointerType !== "touch" || !canAct) return;
    g.current = { x: e.clientX, y: e.clientY, armed: false, hold: setTimeout(() => { if (g.current && !g.current.armed) { g.current = null; setSheet(true); if (navigator.vibrate) navigator.vibrate(10); } }, 400) };
  };
  const onPointerMove = (e) => {
    const s = g.current;
    if (!s) return;
    const ddx = (e.clientX - s.x) * (mine ? -1 : 1), ddy = Math.abs(e.clientY - s.y);
    if (!s.armed && (Math.abs(e.clientX - s.x) > 10 || ddy > 10)) { clearTimeout(s.hold); if (ddy > 10 || ddx < 0) { g.current = null; setDx(0); return; } s.armed = true; }
    if (s.armed) {
      const x = Math.max(0, ddx);
      const v = x <= 56 ? x : 56 + 32 * (1 - Math.exp(-(x - 56) / 32));
      if (!s.crossed && x > 56) { s.crossed = true; if (navigator.vibrate) navigator.vibrate(10); }
      setDx(v * (mine ? -1 : 1));
    }
  };
  const onPointerUp = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    clearTimeout(s.hold);
    if (s.armed && s.crossed) app.setReplyTo(m);
    setDx(0);
  };
  const mentionsMe = (m.mentions || []).includes(app.uid);
  return html`<div class=${"msg" + (mentionsMe ? " mentions-me" : "") + (first ? " first" : "") + (last ? " last" : "") + (m.hidden ? " is-hidden" : "")} data-mid=${m.id}>
    <div class="swipe-ic" style=${{ opacity: Math.min(1, Math.abs(dx) / 56), transform: "scale(" + (0.5 + Math.min(1, Math.abs(dx) / 56) * 0.5) + ")" }} aria-hidden="true"><${Icon} name="reply" size=${18} /></div>
    <div class=${"bub" + (m.kind === "photo" ? " photo" : "")} style=${dx ? { transform: "translateX(" + dx + "px)", transition: "none" } : null}
      onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}
      onContextMenu=${(e) => { if (canAct && matchMedia("(hover: none)").matches) e.preventDefault(); }}
      onDblClick=${() => canAct && matchMedia("(hover: hover)").matches && app.setReplyTo(m)}>
      ${first && !mine ? html`<div class="hd"><b style=${{ color: nameColor(m.by) }}>${person.name}</b>${tagLine(person) ? html`<span class="tag">${tagLine(person)}</span>` : null}<span class="tm" title=${dueWhen(m.ts)}>${relShort(m.ts)}</span></div>` : null}
      ${m.replyTo ? html`<button class="quote" style=${{ "--qc": reply ? nameColor(reply.by) : "var(--ink-3)" }} onClick=${() => flash(m.replyTo)}>
          <b>${reply ? (reply.by === app.uid ? "You" : app.person(reply.by).name) : "Earlier message"}</b><span>${reply ? (reply.deleted ? "Message deleted" : reply.kind === "photo" ? "📷 Photo" + (reply.text ? " · " + reply.text : "") : reply.text) : "Not loaded"}</span></button>` : null}
      ${m.kind === "photo" && m.image ? html`<button class="ph" onClick=${() => app.open("photo", { m, courseId })} style=${{ aspectRatio: (m.image.w || 4) + "/" + (m.image.h || 3) }} aria-label="Open photo"><img src=${Media.resolve(m.image.src)} alt=${m.text || "Photo"} loading="lazy" /></button>` : null}
      ${m.text || (m.tags && m.tags.length) ? html`<div class="tx">${(m.tags || []).map((t) => html`<span class="pchip">${prettyProblem(t)}</span>`)}<${RichText} text=${m.text} mentions=${mentionNames} />${m.editedAt ? html`<span class="edited">edited</span>` : null}</div>` : null}
      ${(m.attachments || []).map((a) => html`<button class="attach" onClick=${() => app.toast(app.demo ? "Example file in the demo class." : "Files open from the shared notes folder.")}>
          <span class=${"fi " + (a.kind || "")}>${a.kind === "image" ? "JPG" : "PDF"}</span><span class="attach-t"><b>${a.name}</b><small>${a.size || ""}</small></span></button>`)}
      ${m.resolved ? html`<div class="answered"><${Icon} name="checkCircle" size=${14} />Answered</div>` : null}
      ${m.hidden ? html`<div class="answered warn">Hidden from classmates</div>` : null}
    </div>
    <${Reactions} m=${m} courseId=${courseId} />
    ${canAct ? html`<div class="hover-tools" role="toolbar" aria-label="Message actions">
      <button onClick=${(e) => setPop(e.currentTarget)} aria-label="React"><${Icon} name="smile" size=${18} /></button>
      <button onClick=${() => app.setReplyTo(m)} aria-label="Reply"><${Icon} name="reply" size=${18} /></button>
      <${MsgMenuButton} m=${m} courseId=${courseId} />
    </div>` : null}
    ${pop ? html`<${Popover} anchor=${pop} onClose=${() => setPop(null)}><${ReactionTray} onPick=${onReact} /><//>` : null}
    ${sheet ? html`<${Sheet} bare label="Message actions" onClose=${() => setSheet(false)} size="ctx">
      <div class="ctx-preview"><div class=${"bub" + (mine ? " own" : "")}>${m.kind === "photo" ? "📷 " : ""}${m.text || (m.kind === "photo" ? "Photo" : "")}</div></div>
      <${ReactionTray} onPick=${onReact} compact />
      <${Menu} items=${msgActions(app, m, courseId, mine)} onPick=${(it) => { setSheet(false); runAction(app, it, m, courseId); }} />
    <//>` : null}
  </div>`;
}

// ---- cards ------------------------------------------------------------------
function PollCard({ m, courseId }) {
  const app = useApp();
  const p = m.poll;
  const votes = Object.entries(p.votes || {}).filter(([, v]) => v && v.o);
  const mine = (p.votes || {})[app.uid];
  const voted = !!(mine && mine.o);
  const counts = Object.fromEntries(p.options.map((o) => [o.id, votes.filter(([, v]) => v.o === o.id)]));
  const lead = Math.max(1, ...Object.values(counts).map((l) => l.length));
  return html`<div class=${"poll" + (voted ? " voted" : "")}>
    <div class="poll-meta"><span class="kchip">Poll</span><span>Public · Select one</span></div>
    <h4>${p.question}</h4>
    <div class="poll-opts">${p.options.map((o) => {
      const list = counts[o.id], n = list.length, pct = votes.length ? Math.round((n / votes.length) * 100) : 0;
      const isMine = mine && mine.o === o.id;
      return html`<button key=${o.id} class=${"opt" + (isMine ? " mine" : "")} onClick=${() => app.canWrite && app.votePoll(courseId, m, o.id)} disabled=${!app.canWrite} aria-pressed=${isMine}>
        ${voted ? html`<span class="opt-pct">${pct}%</span>` : html`<span class="opt-radio"></span>`}
        <span class="opt-body"><span class="opt-t">${o.text}${isMine ? html` <${Icon} name="check" size=${14} />` : null}</span>
          ${voted ? html`<span class="opt-bar"><i style=${{ width: (n / lead) * 100 + "%" }}></i></span>` : null}</span>
        ${voted && n ? html`<${Faces} ids=${list.map(([id]) => id).slice(-3)} size=${18} max=${3} />` : null}
      </button>`;
    })}</div>
    <div class="poll-foot">${voted ? plural(votes.length, "vote") : plural(votes.length, "vote") + " cast · Vote to see results"}${voted ? html` · <button class="link" onClick=${() => app.votePoll(courseId, m, mine.o)}>Retract vote</button>` : null}</div>
  </div>`;
}

const RSVP = [["going", "👍", "Going"], ["maybe", "🤔", "Maybe"], ["no", "😢", "Can't"]];
function rsvpLists(ev) {
  const all = Object.entries(ev.rsvps || {}).filter(([, v]) => v && v.s);
  return { going: all.filter(([, v]) => v.s === "going").sort((a, b) => a[1].t - b[1].t).map(([id]) => id), maybe: all.filter(([, v]) => v.s === "maybe").map(([id]) => id) };
}
function EventCard({ m, courseId, compact }) {
  const app = useApp();
  useTick(30000);
  const ev = m.event;
  const { going, maybe } = rsvpLists(ev);
  const mine = (ev.rsvps || {})[app.uid];
  const now = Clock.now();
  const live = ev.at <= now && (ev.end || ev.at + 2 * 3600e3) > now;
  const past = (ev.end || ev.at + 2 * 3600e3) <= now;
  const chip = live ? "Happening now" : past ? "Ended" : "In " + inWords(ev.at - now);
  const names = going.slice(0, 2).map((id) => (id === app.uid ? "You" : firstName(app.person(id).name)));
  return html`<div class=${"event" + (live ? " live" : "") + (past ? " past" : "")}>
    <button class="event-main" onClick=${() => app.open("event", { m, courseId })}>
      <span class="datetile"><small>${F.wds.format(ev.at).toUpperCase()}</small><b>${F.dnum.format(ev.at)}</b><small>${tShort(ev.at).replace(/ (AM|PM)/, (x) => x.trim().toLowerCase()[0])}</small></span>
      <span class="event-body">
        <span class=${"time-chip" + (live ? " live" : "")}>${live ? html`<i class="pulse-dot"></i>` : null}${chip}</span>
        <b class="event-t">${ev.title}</b>
        <span class="event-w"><${Icon} name="pin" size=${14} />${ev.where}</span>
        <span class="event-who">${going.length ? html`<${Faces} ids=${going} total=${going.length} size=${20} max=${4} /><span>${names.join(", ")}${going.length > 2 ? " and " + (going.length - 2) + " others" : ""} going${maybe.length ? " · " + maybe.length + " maybe" : ""}</span>` : html`<span>Be the first to say you're going</span>`}</span>
      </span>
    </button>
    ${!past && app.canWrite ? html`<div class="rsvp" role="group" aria-label="RSVP">${RSVP.map(([k, e, l]) => html`<button key=${k} class=${mine && mine.s === k ? "on" : ""} aria-pressed=${!!(mine && mine.s === k)} onClick=${(ev2) => { const el = ev2.currentTarget; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); app.rsvp(courseId, m, k); }}><span class="emo">${e}</span>${l}</button>`)}</div>` : null}
  </div>`;
}
function DueCard({ m, courseId }) {
  useTick(30000);
  const d = m.due;
  if (!d) return null;
  const lad = dueLadder(d.at);
  const c = calLinks(d.title, d.at, d.at + 30 * 60e3, d.where ? "On " + d.where : "");
  return html`<div class="duecard" data-mid=${m.id} style=${{ "--edge": courseLook(courseId).hue }}>
    <div class="duecard-top"><span class=${"flag " + lad.tone}><${Icon} name="flag" size=${14} /></span>
      <div class="grow"><b>${d.title}</b><small>${dueWhen(d.at)}${d.where ? " · " + d.where : ""}</small></div>
      <span class=${"due-tone " + lad.tone}>${lad.text}</span></div>
    <div class="duecard-acts"><a class="btn sm soft" href=${c.google} target="_blank" rel="noopener noreferrer"><${Icon} name="calendar" size=${16} />Google</a><a class="btn sm ghost" href=${c.outlook} target="_blank" rel="noopener noreferrer">Outlook</a></div>
  </div>`;
}
function AnnounceCard({ m }) {
  const app = useApp();
  return html`<div class="announce" data-mid=${m.id}><span class="eyebrow">📣 From the organizer · ${relShort(m.ts)}</span><p><${RichText} text=${m.text} /></p></div>`;
}

function TypingLine({ courseId }) {
  const app = useApp();
  const ids = app.typing(courseId);
  if (!ids.length) return html`<div class="typing"></div>`;
  const n = ids.map((id) => firstName(app.person(id).name));
  const txt = n.length === 1 ? html`<b>${n[0]}</b> is typing` : n.length === 2 ? html`<b>${n[0]}</b> and <b>${n[1]}</b> are typing` : n.length === 3 ? html`<b>${n[0]}</b>, <b>${n[1]}</b> and <b>${n[2]}</b> are typing` : "Several people are typing";
  return html`<div class="typing show"><${Faces} ids=${ids.slice(0, 3)} size=${18} max=${3} /><span class="dots"><i></i><i></i><i></i></span><span>${txt}</span></div>`;
}

// ---- composer ------------------------------------------------------------------
function Composer({ courseId, thread, placeholder, problems, problem, onProblem, members, hint }) {
  const app = useApp();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState([]);
  const [suggest, setSuggest] = useState(null);
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(null);
  const [probPop, setProbPop] = useState(null);
  const ta = useRef(null);
  const file = useRef(null);
  const typingAt = useRef(0);
  const draftKey = "roster:draft:" + courseId + ":" + thread;
  useEffect(() => { setText(LS.get(draftKey, "")); }, [draftKey]);
  useLayoutEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(150, el.scrollHeight) + "px"; } }, [text]);
  useEffect(() => { if (app.replyTo && ta.current) ta.current.focus(); }, [app.replyTo]);
  useEffect(() => {
    app.setEditing = ({ m }) => { setEditing(m); setText(m.text || ""); setTimeout(() => ta.current && ta.current.focus(), 0); };
  });
  if (!app.canWrite) {
    return html`<div class="composer-wrap"><div class="readonly"><${Icon} name="info" /><span class="grow">You can read this class but not post.${app.demo ? "" : " Ask the organizer to add you as a contributor."}</span>
      ${app.live ? html`<button class="btn sm soft" onClick=${() => app.switchMode("demo")}>Try the demo class</button>` : null}</div></div>`;
  }
  if (app.me && !app.me.pledgeAt) {
    return html`<div class="composer-wrap"><button class="pledge-gate" onClick=${() => app.open("pledge")}><span class="emo">👋</span><span class="grow"><b>Take the Roster pledge to start talking.</b><small>You can read everything already.</small></span><span class="btn sm primary">Continue</span></button></div>`;
  }
  const onInput = (e) => {
    const v = e.target.value;
    setText(v); LS.set(draftKey, v);
    const now = Date.now();
    if (now - typingAt.current > 2500) { typingAt.current = now; app.setTyping(courseId, true); }
    const mm = v.slice(0, e.target.selectionStart).match(/(?:^|\s)@([\w'-]{0,20})$/);
    if (mm) {
      const q = mm[1].toLowerCase();
      const list = members.filter((x) => x.id !== app.uid && (x.displayName || "").toLowerCase().split(/\s+/).some((w) => w.startsWith(q))).slice(0, 6);
      setSuggest(list.length ? list : null); setSel(0);
    } else setSuggest(null);
  };
  const pickMention = (mem) => {
    const el = ta.current, caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@([\w'-]{0,20})$/, "@" + mem.displayName + " ");
    setText(before + text.slice(caret)); setMentions((x) => [...new Set([...x, mem.id])]); setSuggest(null);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; }, 0);
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (editing) { const ok = await app.editMsg(courseId, editing, t); if (ok) { setEditing(null); setText(""); LS.set(draftKey, ""); } return; }
    const used = mentions.filter((id) => t.includes("@" + app.person(id).name));
    setText(""); LS.set(draftKey, ""); setMentions([]); setSuggest(null);
    app.setTyping(courseId, false);
    const ok = await app.send(courseId, { text: t, thread, tags: problem && problem !== "all" ? [problem] : undefined, mentions: used });
    if (!ok) setText(t);
  };
  const onKey = (e) => {
    if (suggest) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((sel + 1) % suggest.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((sel - 1 + suggest.length) % suggest.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(suggest[sel]); return; }
      if (e.key === "Escape") { setSuggest(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); }
    if (e.key === "Escape") { if (editing) { setEditing(null); setText(""); } else if (app.replyTo) app.setReplyTo(null); }
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) app.open("photo-send", { courseId, thread, file: f, tags: problem && problem !== "all" ? [problem] : undefined });
  };
  const r = app.replyTo;
  return html`<div class="composer-wrap">
    <${TypingLine} courseId=${courseId} />
    ${suggest ? html`<div class="mentions" role="listbox">${suggest.map((mem, i) => html`<button role="option" aria-selected=${i === sel} class=${i === sel ? "on" : ""} onMouseEnter=${() => setSel(i)} onClick=${() => pickMention(mem)}>
      <${Avatar} uid=${mem.id} size=${28} online=${app.online.has(mem.id)} /><span class="grow"><b>${mem.displayName}</b><small>${[tagLine(mem), mem.sections && mem.sections[courseId] && Catalog.slot(mem.sections[courseId]) ? "Section " + Catalog.slot(mem.sections[courseId]).label : ""].filter(Boolean).join(" · ")}</small></span></button>`)}</div>` : null}
    ${hint && !text ? html`<div class="composer-hint">${hint}</div>` : null}
    <div class="composer">
      <button class="cbtn" onClick=${() => app.open("attach", { courseId, thread, pick: () => file.current && file.current.click(), problem })} aria-label="Add a photo, poll or study session"><${Icon} name="plus" size=${22} /></button>
      <input type="file" accept="image/*" ref=${file} hidden onChange=${onFile} />
      <div class="pillbox">
        ${r || editing ? html`<div class="embed"><span class="embed-rail" style=${{ background: editing ? "var(--accent)" : nameColor(r.by) }}></span>
          <span class="grow"><b>${editing ? "Editing message" : "Reply to " + (r.by === app.uid ? "yourself" : app.person(r.by).name)}</b><small>${(editing || r).text || "📷 Photo"}</small></span>
          <button class="iconbtn sm" onClick=${() => { if (editing) { setEditing(null); setText(""); } else app.setReplyTo(null); }} aria-label="Cancel"><${Icon} name="x" size=${16} /></button></div>` : null}
        <div class="pillrow">
          ${problems && problems.length ? html`<button class="pchip pick" onClick=${(e) => setProbPop(e.currentTarget)} aria-label="Tag a problem">${problem && problem !== "all" ? prettyProblem(problem) : "Tag"}<${Icon} name="updown" size=${12} /></button>` : null}
          <textarea id=${"composer-" + courseId + "-" + thread} ref=${ta} rows="1" value=${text} onInput=${onInput} onKeyDown=${onKey} onBlur=${() => app.setTyping(courseId, false)} placeholder=${placeholder} aria-label=${placeholder}></textarea>
        </div>
      </div>
      <button class=${"send" + (text.trim() ? " on" : "")} onClick=${send} disabled=${!text.trim()} aria-label=${editing ? "Save edit" : "Send"}><${Icon} name=${editing ? "check" : "send"} size=${20} /></button>
    </div>
    ${probPop ? html`<${Popover} anchor=${probPop} onClose=${() => setProbPop(null)}><${Menu} items=${[[{ key: "all", label: "No problem tag", icon: "x" }, ...problems.map((p) => ({ key: p, label: "Problem " + prettyProblem(p), icon: "hash" }))]]} onPick=${(it) => { onProblem(it.key); setProbPop(null); }} /><//>` : null}
  </div>`;
}
