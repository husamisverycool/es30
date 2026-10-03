// ---------------------------------------------------------------------------
// Chat surface: message list, runs, bubbles, reactions, replies, composer,
// pinned bar, typing line. Anatomy per DESIGN.md §3 (GroupMe 2026 row on
// shared iMessage / WhatsApp / Telegram / Discord conventions).
// ---------------------------------------------------------------------------
function buildBlocks(msgs, uid, lastRead) {
  const blocks = [];
  let lastDay = null, run = null, unreadPlaced = false;
  for (const m of msgs) {
    const dk = dayKey(m.ts);
    if (dk !== lastDay) { blocks.push({ type: "day", ts: m.ts, key: "d" + dk }); lastDay = dk; run = null; }
    if (!unreadPlaced && lastRead && m.ts > lastRead && m.by !== uid) { blocks.push({ type: "unread", key: "unread" }); unreadPlaced = true; run = null; }
    if (m.kind === "system" || m.kind === "recap" || m.kind === "due") { blocks.push({ type: m.kind, m, key: m.id }); run = null; continue; }
    if (run && run.by === m.by && m.ts - run.last < 5 * 60e3 && run.items.length < 12) { run.items.push(m); run.last = m.ts; }
    else { run = { type: "run", by: m.by, items: [m], last: m.ts, key: "r" + m.id }; blocks.push(run); }
  }
  return blocks;
}

function MessageList({ courseId, messages, byId, lastRead, empty, header, recapCtx }) {
  const app = useApp();
  const scroller = useRef(null);
  const [newCount, setNewCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const prevLen = useRef(0);
  const opened = useRef(false);
  const blocks = useMemo(() => buildBlocks(messages, app.uid, lastRead), [messages, app.uid, lastRead]);

  const nearBottom = () => { const el = scroller.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140; };
  const toBottom = (smooth) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!opened.current && messages.length) {
      opened.current = true;
      const div = el.querySelector(".unread-div");
      if (div) el.scrollTop = Math.max(0, div.offsetTop - 80); else el.scrollTop = el.scrollHeight;
      prevLen.current = messages.length;
      return;
    }
    if (messages.length > prevLen.current) {
      const last = messages[messages.length - 1];
      if (atBottom || (last && last.by === app.uid)) toBottom(prevLen.current > 0);
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
      ${messages.length === 0 ? empty : null}
      ${blocks.map((b) => {
        if (b.type === "day") return html`<div class="daysep" key=${b.key}>${dayLabel(b.ts)}</div>`;
        if (b.type === "unread") return html`<div class="unread-div" key="unread">Unread messages</div>`;
        if (b.type === "system") return html`<div class="sysline" key=${b.key}>${b.m.text}</div>`;
        if (b.type === "recap") return html`<${RecapInChat} key=${b.key} m=${b.m} courseId=${courseId} ctx=${recapCtx} />`;
        if (b.type === "due") return html`<${DueInChat} key=${b.key} m=${b.m} />`;
        return html`<${Run} key=${b.key} run=${b} courseId=${courseId} byId=${byId} flash=${flash} />`;
      })}
    </div>
    ${!atBottom ? html`<button class="jump" onClick=${() => { toBottom(true); setNewCount(0); }}><${Icon} name="arrowDown" size=${18} />${newCount ? newCount + " new" : "Latest"}</button>` : null}
  </div>`;
}

function Run({ run, courseId, byId, flash }) {
  const app = useApp();
  const mine = run.by === app.uid;
  const p = app.person(run.by);
  return html`<div class=${"run" + (mine ? " mine" : "")}>
    ${mine ? null : html`<${Avatar} uid=${run.by} size=${32} online=${app.online.has(run.by)} />`}
    <div class="col">
      ${run.items.map((m, i) => html`<${Msg} key=${m.id} m=${m} first=${i === 0} mine=${mine} person=${p} courseId=${courseId} byId=${byId} flash=${flash} />`)}
      ${mine ? html`<div class="mine-meta">${F.time.format(run.last)}</div>` : null}
    </div>
  </div>`;
}

function Msg({ m, first, mine, person, courseId, byId, flash }) {
  const app = useApp();
  const [picker, setPicker] = useState(null);
  const [sheet, setSheet] = useState(false);
  const press = useRef(null);
  const mentionsMe = (m.mentions || []).includes(app.uid);
  const mentionNames = useMemo(() => (m.mentions || []).map((id) => app.person(id).name).filter(Boolean), [m.mentions, app.members]);
  const reply = m.replyTo ? byId[m.replyTo] : null;
  const canAct = app.canWrite && !m.deleted;

  const onTouchStart = () => { if (!canAct) return; press.current = setTimeout(() => { press.current = null; setSheet(true); }, 430); };
  const cancelPress = () => { if (press.current) { clearTimeout(press.current); press.current = null; } };
  const onReact = (e) => { setPicker(null); setSheet(false); app.react(courseId, m, e); };
  const copy = async () => {
    setSheet(false);
    try { await navigator.clipboard.writeText(m.text || ""); app.toast("Copied"); } catch (_) { app.toast("Copy isn't available here. Select the text instead."); }
  };

  if (m.deleted) {
    return html`<div class="msg" data-mid=${m.id}><div class="bub" style=${{ opacity: 0.6, fontStyle: "italic" }}>Message deleted</div></div>`;
  }
  const reacts = Object.entries(m.reactions || {})
    .map(([e, who]) => ({ e, ids: Object.entries(who || {}).filter(([, t]) => t).map(([id]) => id) }))
    .filter((r) => r.ids.length)
    .sort((a, b) => b.ids.length - a.ids.length);

  return html`<div class=${"msg" + (mentionsMe ? " mentions-me" : "")} data-mid=${m.id}>
    <div class="bub" onContextMenu=${(e) => { if (canAct && matchMedia("(hover: none)").matches) { e.preventDefault(); setSheet(true); } }}
      onTouchStart=${onTouchStart} onTouchEnd=${cancelPress} onTouchMove=${cancelPress}>
      ${first && !mine ? html`<div class="hd"><b style=${{ color: nameColor(m.by) }}>${person.name}</b>${tagLine(person) ? html`<span class="tag">${tagLine(person)}</span>` : null}<span class="tm" title=${dueWhen(m.ts)}>${relShort(m.ts)}</span></div>` : null}
      ${m.replyTo ? html`<button class="quote" style=${{ color: reply ? nameColor(reply.by) : "var(--ink-3)" }} onClick=${() => flash(m.replyTo)}>
          <b>${reply ? app.person(reply.by).name : "Original message"}</b><span>${reply ? (reply.deleted ? "Message deleted" : reply.text) : "Not loaded"}</span></button>` : null}
      <div class="tx" title=${first ? undefined : F.time.format(m.ts)}>${(m.tags || []).map((t) => html`<span class="ptag">${prettyProblem(t)}</span>`)}${richText(m.text, mentionNames)}${m.editedAt ? html`<span class="edited">(edited)</span>` : null}</div>
      ${(m.attachments || []).map((a) => html`<button class="attach" onClick=${() => app.toast(app.demo ? "Example file in the demo class." : "Files open from the shared notes folder.")}>
          <span class=${"fi " + (a.kind || "")}>${a.kind === "image" ? "JPG" : "PDF"}</span><span style=${{ minWidth: 0 }}><span class="nm" style=${{ display: "block" }}>${a.name}</span><span class="sz">${a.size || ""}</span></span></button>`)}
    </div>
    ${reacts.length ? html`<div class="reacts">${reacts.map((r) => {
      const me = r.ids.includes(app.uid);
      const names = r.ids.slice(0, 6).map((id) => (id === app.uid ? "You" : app.person(id).name)).join(", ") + (r.ids.length > 6 ? " and " + (r.ids.length - 6) + " more" : "");
      return html`<button class=${"react" + (me ? " me" : "")} title=${names} disabled=${!app.canWrite} onClick=${() => app.react(courseId, m, r.e)}><span class="emo">${r.e}</span>${r.ids.length}</button>`;
    })}</div>` : null}
    ${canAct ? html`<div class="hover-tools">
      ${QUICK.slice(0, 3).map((e) => html`<button class="emo" onClick=${() => onReact(e)} aria-label=${"React " + e}>${e}</button>`)}
      <button onClick=${(e) => setPicker(e.currentTarget)} aria-label="Add reaction"><${Icon} name="smile" size=${18} /></button>
      <button onClick=${() => app.setReplyTo(m)} aria-label="Reply"><${Icon} name="reply" size=${18} /></button>
      ${mine ? html`<button onClick=${() => app.deleteMsg(courseId, m)} aria-label="Delete"><${Icon} name="x" size=${18} /></button>` : null}
    </div>` : null}
    ${picker ? html`<${EmojiPicker} anchor=${picker} onPick=${onReact} onClose=${() => setPicker(null)} />` : null}
    ${sheet ? html`<${Modal} title=${mine ? "Your message" : person.name} onClose=${() => setSheet(false)}>
      <div class="emoji-tray" style=${{ justifyContent: "space-between" }}>${QUICK.map((e) => html`<button class="emo" onClick=${() => onReact(e)}>${e}</button>`)}</div>
      <div class="menu">
        <button onClick=${() => { setSheet(false); app.setReplyTo(m); }}><${Icon} name="reply" />Reply</button>
        <button onClick=${copy}><${Icon} name="paste" />Copy text</button>
        ${mine ? html`<button onClick=${() => { setSheet(false); app.deleteMsg(courseId, m); }} style=${{ color: "var(--red)" }}><${Icon} name="x" />Delete</button>` : null}
      </div>
    <//>` : null}
  </div>`;
}

function DueInChat({ m }) {
  useTick(30000);
  const left = m.due ? m.due.at - Clock.now() : 0;
  const cal = m.due ? calLinks(m.due.title, m.due.at, 30, m.due.where || "") : null;
  return html`<div class="card" style=${{ alignSelf: "flex-start", margin: "10px 0 4px 40px", maxWidth: "420px", width: "calc(100% - 40px)" }}>
    <div class="due-card">
      <div class="top"><span class="emo" style=${{ fontSize: "22px" }}>📌</span>
        <div><div class="ttl">${m.due ? m.due.title : m.text}</div><div class="when">${m.due ? dueWhen(m.due.at) : ""}${m.due && m.due.where ? " · " + m.due.where : ""}</div></div>
        ${m.due && left > 0 ? html`<div class="left"><small>DUE IN</small><b>${countdown(left)}</b></div>` : null}
      </div>
      ${cal ? html`<div class="acts"><a class="btn btn-soft btn-sm" href=${cal.google} target="_blank" rel="noopener noreferrer"><${Icon} name="calendar" size=${16} />Google Calendar</a><a class="btn btn-ghost btn-sm" href=${cal.outlook} target="_blank" rel="noopener noreferrer">Outlook</a></div>` : null}
    </div>
  </div>`;
}

function PinBar({ items }) {
  useTick(1000);
  const [i, setI] = useState(0);
  if (!items.length) return null;
  const k = i % items.length;
  const it = items[k];
  const left = it.at ? it.at - Clock.now() : null;
  return html`<button class="pinbar" onClick=${() => setI(k + 1)} aria-label=${"Pinned " + (k + 1) + " of " + items.length + ". Show next."}>
    <span class="seg">${items.map((_, j) => html`<i class=${j === k ? "on" : ""} style=${{ height: Math.max(6, Math.floor(36 / items.length) - 2) + "px" }}></i>`)}</span>
    <span class="emo" style=${{ fontSize: "18px" }}>${it.emoji}</span>
    <span class="body"><span class="k" style=${{ display: "block" }}>Pinned${items.length > 1 ? " · " + (k + 1) + " of " + items.length : ""}</span><span class="v" style=${{ display: "block" }}>${it.text}</span></span>
    ${left != null && left > 0 ? html`<span class="cd"><small>DUE IN</small><b>${countdown(left)}</b></span>` : null}
  </button>`;
}

function TypingLine({ courseId }) {
  const app = useApp();
  const ids = app.typing(courseId);
  if (!ids.length) return html`<div class="typing"></div>`;
  const n = ids.map((id) => firstName(app.person(id).name));
  const txt = n.length === 1 ? html`<b>${n[0]}</b> is typing…` : n.length === 2 ? html`<b>${n[0]}</b> and <b>${n[1]}</b> are typing…` : n.length === 3 ? html`<b>${n[0]}</b>, <b>${n[1]}</b>, and <b>${n[2]}</b> are typing…` : "Several people are typing…";
  return html`<div class="typing"><span class="dots"><i></i><i></i><i></i></span><span>${txt}</span></div>`;
}

function Composer({ courseId, thread, placeholder, problems, problem, onProblem, members }) {
  const app = useApp();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState([]);
  const [suggest, setSuggest] = useState(null);
  const [plus, setPlus] = useState(null);
  const ta = useRef(null);
  const typingAt = useRef(0);
  const draftKey = "roster:draft:" + courseId + ":" + thread;
  useEffect(() => { setText(LS.get(draftKey, "")); }, [draftKey]);
  useLayoutEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(140, el.scrollHeight) + "px"; } }, [text]);
  useEffect(() => { if (app.replyTo && ta.current) ta.current.focus(); }, [app.replyTo]);

  if (!app.canWrite) {
    return html`<div class="composer-wrap"><div class="readonly"><${Icon} name="info" /><span class="grow">You can read this class but not post. ${app.demo ? "" : "Ask the organizer to add you as a contributor."}</span>
      ${app.live ? html`<button class="btn btn-soft btn-sm" onClick=${() => app.switchMode("demo")}>Try the demo class</button>` : null}</div></div>`;
  }
  const onInput = (e) => {
    const v = e.target.value;
    setText(v);
    LS.set(draftKey, v);
    const now = Date.now();
    if (now - typingAt.current > 2500) { typingAt.current = now; app.setTyping(courseId, true); }
    const caret = e.target.selectionStart;
    const mm = v.slice(0, caret).match(/(?:^|\s)@([\w'-]{0,20})$/);
    if (mm) {
      const q = mm[1].toLowerCase();
      const list = members.filter((x) => x.id !== app.uid && (x.displayName || "").toLowerCase().split(/\s+/).some((w) => w.startsWith(q))).slice(0, 5);
      setSuggest(list.length ? { q: mm[1], list } : null);
    } else setSuggest(null);
  };
  const pickMention = (mem) => {
    const el = ta.current, caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@([\w'-]{0,20})$/, "@" + mem.displayName + " ");
    const v = before + text.slice(caret);
    setText(v); setMentions((m) => [...new Set([...m, mem.id])]); setSuggest(null);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; }, 0);
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const used = mentions.filter((id) => t.includes("@" + app.person(id).name));
    setText(""); LS.set(draftKey, ""); setMentions([]); setSuggest(null);
    app.setTyping(courseId, false);
    const ok = await app.send(courseId, { text: t, thread, tags: problem && problem !== "all" ? [problem] : undefined, mentions: used.length ? used : undefined });
    if (!ok) setText(t);
  };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); }
    if (e.key === "Escape" && app.replyTo) app.setReplyTo(null);
  };
  const shareLink = () => {
    setPlus(null);
    setText((v) => (v ? v + " " : "") + "https://");
    setTimeout(() => ta.current && ta.current.focus(), 0);
  };
  const r = app.replyTo;
  return html`<div class="composer-wrap">
    <${TypingLine} courseId=${courseId} />
    ${r ? html`<div class="replying"><${Icon} name="reply" size=${18} /><div class="body"><b>Replying to ${r.by === app.uid ? "yourself" : app.person(r.by).name}</b><span>${r.text}</span></div><button class="iconbtn" onClick=${() => app.setReplyTo(null)} aria-label="Cancel reply"><${Icon} name="x" size=${18} /></button></div>` : null}
    ${suggest ? html`<div class="card menu" style=${{ maxWidth: "860px", margin: "0 auto 6px", padding: "4px" }}>${suggest.list.map((mem) => html`<button onClick=${() => pickMention(mem)}><${Avatar} uid=${mem.id} size=${24} /><span>${mem.displayName}</span><span class="muted" style=${{ fontSize: "12px", marginLeft: "auto" }}>${tagLine(mem)}</span></button>`)}</div>` : null}
    <div class="composer">
      <div class="field-wrap">
        <button class="iconbtn" onClick=${(e) => setPlus(e.currentTarget)} aria-label="More"><${Icon} name="plus" /></button>
        ${problems && problems.length ? html`<button class="ptag-pick" onClick=${(e) => setPlus({ el: e.currentTarget, kind: "problem" })} aria-label="Tag a problem">${problem && problem !== "all" ? prettyProblem(problem) : "General"}<${Icon} name="updown" size=${14} /></button>` : null}
        <textarea id=${"composer-" + courseId + "-" + thread} ref=${ta} rows="1" value=${text} onInput=${onInput} onKeyDown=${onKey} onBlur=${() => app.setTyping(courseId, false)} placeholder=${placeholder} aria-label=${placeholder}></textarea>
      </div>
      <button class="send" onClick=${send} disabled=${!text.trim()} aria-label="Send"><${Icon} name="send" size=${20} /></button>
    </div>
    ${plus && !plus.kind ? html`<${Popover} anchor=${plus} onClose=${() => setPlus(null)}><div class="menu" style=${{ minWidth: "220px" }}>
      <button onClick=${shareLink}><${Icon} name="link" />Share a link</button>
      <button onClick=${() => { setPlus(null); setText((v) => v + "@"); setTimeout(() => ta.current && ta.current.focus(), 0); }}><${Icon} name="users" />Mention a classmate</button>
    </div><//>` : null}
    ${plus && plus.kind === "problem" ? html`<${Popover} anchor=${plus.el} onClose=${() => setPlus(null)}><div class="menu" style=${{ minWidth: "160px" }}>
      <button onClick=${() => { onProblem("all"); setPlus(null); }}>General</button>
      ${problems.map((p) => html`<button onClick=${() => { onProblem(p); setPlus(null); }}>Problem ${prettyProblem(p)}</button>`)}
    </div><//>` : null}
  </div>`;
}
