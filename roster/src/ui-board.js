// ---------------------------------------------------------------------------
// Board: the campus-wide feed (Saturn's Bulletin, Fizz's school feed,
// Partiful's event cards, Facebook Marketplace's price-first grid).
// Everyone on Roster at Harvard sees it; posts have a category and, for
// events and study groups, a time, a place and RSVPs.
// ---------------------------------------------------------------------------
function useBoard(app) {
  return useCollection(() => app.db.collection("board").orderBy("ts", "desc").limit(100), [app.db]);
}
const catOf = (id) => Catalog.BOARD_CATS.find((c) => c.id === id) || Catalog.BOARD_CATS[4];
// No emoji in chrome (visual spec 4.9): categories carry Phosphor glyphs.
const CAT_ICON = { event: "ticket", study: "book", market: "tag", lost: "lost", general: "chat" };

function BoardView() {
  const app = useApp();
  useTick(30000);
  const posts = useBoard(app);
  const [cat, setCat] = useState(() => LS.get("roster:boardcat", "all"));
  const pick = (c) => { setCat(c); LS.set("roster:boardcat", c); };
  const now = Clock.now();
  const live = (posts || []).filter((p) => !p.deleted || app.isOrganizer);
  const list = live.filter((p) => cat === "all" || p.cat === cat);
  const upcoming = live.filter((p) => p.event && p.event.at && (p.event.end || p.event.at + 7200e3) > now).sort((a, b) => a.event.at - b.event.at);
  const counts = Object.fromEntries(Catalog.BOARD_CATS.map((c) => [c.id, live.filter((p) => p.cat === c.id).length]));
  return html`<div class="page">
    <${PageHead} title="Board" sub="Harvard · everyone on Roster">
      ${app.canWrite ? html`<button class="btn sm primary" onClick=${() => app.open("board-new", { cat: cat === "all" ? "event" : cat })}><${Icon} name="plus" size=${16} />Post</button>` : null}
    <//>
    <div class="chiprow" role="tablist" aria-label="Board categories">
      <button role="tab" aria-selected=${cat === "all"} class=${"fchip" + (cat === "all" ? " on" : "")} onClick=${() => pick("all")}>All</button>
      ${Catalog.BOARD_CATS.map((c) => html`<button key=${c.id} role="tab" aria-selected=${cat === c.id} class=${"fchip" + (cat === c.id ? " on" : "")} onClick=${() => pick(c.id)}><${Icon} name=${CAT_ICON[c.id]} size=${16} fill=${cat === c.id} />${c.label}${counts[c.id] ? html`<span class="fchip-n">${counts[c.id]}</span>` : null}</button>`)}
    </div>
    <div class="scroller page-scroll"><div class="page-in boardpage">
      ${posts === null ? html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>` : null}
      ${(cat === "all" || cat === "event" || cat === "study") && upcoming.length ? html`<section><div class="sec-hrow"><h2 class="sec-h">Coming up</h2></div>
        <div class="evrail">${upcoming.filter((p) => cat === "all" || p.cat === cat).map((p) => html`<${EventTile} key=${p.id} p=${p} />`)}</div></section>` : null}
      ${cat === "market" ? html`<div class="mgrid">${list.map((p) => html`<${MarketTile} key=${p.id} p=${p} />`)}</div>`
        : html`<section>${cat === "all" && upcoming.length ? html`<h2 class="sec-h">Latest</h2>` : null}<div class="feed">${list.map((p) => html`<${BoardCard} key=${p.id} p=${p} />`)}</div></section>`}
      ${posts && !list.length ? html`<${Empty} icon=${cat === "lost" ? "lost" : cat === "market" ? "store" : "board"} title=${cat === "all" ? "Nothing on the Board yet" : "Nothing in " + catOf(cat).label + " yet"}
        action=${app.canWrite ? html`<button class="btn primary" onClick=${() => app.open("board-new", { cat: cat === "all" ? "event" : cat })}>Post the first one</button>` : null}>Study breaks, study groups, a textbook to sell, a lost water bottle. Everyone at Harvard on Roster sees it.<//>` : null}
      <p class="fine">Be kind, no selling graded work, no personal info about others. <button class="link" onClick=${() => app.open("pledge", { readOnly: true })}>Community guidelines</button></p>
    </div></div>
  </div>`;
}

// Partiful-style tile: date block, title, who's going.
function EventTile({ p }) {
  const app = useApp();
  const ev = p.event, now = Clock.now();
  const { going } = rsvpLists(ev);
  const live = ev.at <= now && (ev.end || ev.at + 7200e3) > now;
  const mine = (ev.rsvps || {})[app.uid];
  return html`<button class=${"evtile" + (live ? " live" : "")} onClick=${() => app.open("board-post", { id: p.id })}>
    <span class="evtile-top"><span class="datetile sm"><small>${F.wds.format(ev.at).toUpperCase()}</small><b>${F.dnum.format(ev.at)}</b></span>
      <span class=${"time-chip" + (live ? " live" : "")}>${live ? html`<i class="pulse-dot"></i>Now` : dayLabel(ev.at) === "Today" ? "Tonight " + tShort(ev.at) : tShort(ev.at)}</span></span>
    <b class="evtile-t">${p.title}</b>
    <span class="evtile-w"><${Icon} name="mapPin" size=${13} />${ev.where || "TBA"}</span>
    <span class="evtile-who">${going.length ? html`<${Faces} ids=${going} total=${going.length} size=${20} max=${3} /><span>${going.length} going</span>` : html`<span>Be the first</span>`}
      ${mine && mine.s === "going" ? html`<span class="pill ok sm">You're going</span>` : null}</span>
  </button>`;
}

function MarketTile({ p }) {
  const app = useApp();
  return html`<button class="mtile" onClick=${() => app.open("board-post", { id: p.id })}>
    <span class="mtile-img">${p.image ? html`<img src=${Media.resolve(p.image.src)} alt="" loading="lazy" />` : html`<span class="mtile-ph"><${Icon} name="tag" size=${28} /></span>`}</span>
    <b class="mtile-price">${p.price || "Free"}</b><span class="mtile-t">${p.title}</span>
    <small>${firstName(app.person(p.by).name)} · ${shortHouse(app.person(p.by).house || "") || "Harvard"} · ${relShort(p.ts)}</small>
  </button>`;
}

function BoardReactions({ p }) {
  const app = useApp();
  const [pop, setPop] = useState(null);
  const reacts = Object.entries(p.reactions || {}).map(([e, who]) => ({ e, ids: Object.entries(who || {}).filter(([, t]) => t).map(([id]) => id) })).filter((r) => r.ids.length).sort((a, b) => b.ids.length - a.ids.length);
  return html`<span class="reacts inline">${reacts.map((r) => html`<button key=${r.e} class=${"react" + (r.ids.includes(app.uid) ? " me" : "")} disabled=${!app.canWrite} onClick=${(ev) => { ev.stopPropagation(); const el = ev.currentTarget; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); app.reactBoard(p, r.e); }}><span class="emo">${r.e}</span><span class="n">${r.ids.length}</span></button>`)}
    ${app.canWrite ? html`<button class="react add" onClick=${(e) => { e.stopPropagation(); setPop(e.currentTarget); }} aria-label="Add reaction"><${Icon} name="smile" size=${16} /></button>` : null}
    ${pop ? html`<${Popover} anchor=${pop} onClose=${() => setPop(null)}><${ReactionTray} onPick=${(e) => { setPop(null); app.reactBoard(p, e); }} /><//>` : null}</span>`;
}

function BoardRsvp({ p }) {
  const app = useApp();
  const mine = (p.event.rsvps || {})[app.uid];
  if (!app.canWrite) return null;
  return html`<div class="rsvp" role="group" aria-label="RSVP">${RSVP.map(([k, e, l]) => html`<button key=${k} class=${mine && mine.s === k ? "on" : ""} aria-pressed=${!!(mine && mine.s === k)} onClick=${(ev) => { ev.stopPropagation(); const el = ev.currentTarget; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); app.rsvpBoard(p, k); }}><span class="emo">${e}</span>${l}</button>`)}</div>`;
}

function BoardCard({ p, full }) {
  const app = useApp();
  const who = app.person(p.by);
  const c = catOf(p.cat);
  const [menu, setMenu] = useState(null);
  const ev = p.event;
  const now = Clock.now();
  const mine = p.by === app.uid;
  if (p.deleted && !app.isOrganizer) return null;
  const items = [[!mine && { key: "profile", label: "View " + firstName(who.name) + "'s profile", icon: "user" }, ev && ev.at && { key: "cal", label: "Add to Google Calendar", icon: "calendarPlus" }, { key: "copy", label: "Copy text", icon: "paste" }],
    [!mine && { key: "report", label: "Report", icon: "flag", danger: true }, (mine || app.isOrganizer) && !p.deleted && { key: "delete", label: mine ? "Delete post" : "Remove for everyone", icon: "trash", danger: true }]].filter((g) => g.some(Boolean));
  const run = (it) => {
    setMenu(null);
    if (it.key === "profile") app.open("profile", { uid: p.by });
    if (it.key === "cal") window.open(calLinks(p.title, ev.at, ev.end, (p.body || "") + (ev.where ? "\n" + ev.where : "")).google, "_blank", "noopener");
    if (it.key === "copy") navigator.clipboard.writeText(p.title + "\n" + (p.body || "")).then(() => app.toast("Copied"), () => {});
    if (it.key === "report") app.open("report", { board: p });
    if (it.key === "delete") app.open("confirm", { title: mine ? "Delete this post?" : "Remove this post for everyone?", body: "It disappears from the Board.", cta: mine ? "Delete" : "Remove", danger: true, run: () => app.deleteBoard(p) });
  };
  const open = () => !full && app.open("board-post", { id: p.id });
  return html`<article class=${"bcard" + (full ? " full" : "") + (p.deleted ? " is-hidden" : "")}>
    <header class="bcard-h">
      <button class="run-av" onClick=${() => app.open("profile", { uid: p.by })} aria-label=${"View " + who.name}><${Avatar} uid=${p.by} size=${36} /></button>
      <span class="grow bcard-who"><b>${mine ? "You" : who.name}</b><small>${[tagLine(who), relShort(p.ts)].filter(Boolean).join(" · ")}</small></span>
      <span class=${"catpill k-" + p.cat}><${Icon} name=${CAT_ICON[p.cat] || "chat"} size=${13} />${c.label.replace(/s$/, "")}</span>
      <button class="iconbtn sm" onClick=${(e) => setMenu(e.currentTarget)} aria-label="More"><${Icon} name="more" size=${18} /></button>
    </header>
    <div class="bcard-b" onClick=${open} role=${full ? undefined : "button"} tabindex=${full ? undefined : 0} onKeyDown=${(e) => !full && e.key === "Enter" && open()}>
      <h3 class="bcard-t">${p.price ? html`<span class="price">${p.price}</span>` : null}${p.title}</h3>
      ${p.body ? html`<p class=${"bcard-p" + (full ? "" : " clamp")}><${RichText} text=${p.body} /></p>` : null}
      ${p.image ? html`<div class="bcard-img"><img src=${Media.resolve(p.image.src)} alt="" loading="lazy" /></div>` : null}
      ${ev && ev.at ? html`<div class="bcard-ev">
        <span class="datetile"><small>${F.wds.format(ev.at).toUpperCase()}</small><b>${F.dnum.format(ev.at)}</b><small>${F.mon.format(ev.at).toUpperCase()}</small></span>
        <span class="grow"><b>${dayLabel(ev.at)} · ${tShort(ev.at)}${ev.end ? "–" + tShort(ev.end) : ""}</b><small><${Icon} name="mapPin" size=${13} />${ev.where || "Place TBA"}</small>
          ${(() => { const { going, maybe } = rsvpLists(ev); return going.length ? html`<span class="event-who"><${Faces} ids=${going} total=${going.length} size=${20} max=${4} /><span>${going.length} going${maybe.length ? " · " + maybe.length + " maybe" : ""}</span></span>` : null; })()}</span>
        ${ev.at <= now && (ev.end || ev.at + 7200e3) > now ? html`<span class="time-chip live"><i class="pulse-dot"></i>Now</span>` : null}
      </div>` : null}
    </div>
    ${ev && ev.at && (ev.end || ev.at + 7200e3) > now ? html`<${BoardRsvp} p=${p} />` : null}
    <footer class="bcard-f"><${BoardReactions} p=${p} /><span class="grow"></span>
      ${full ? null : html`<button class="bcard-c" onClick=${open}><${Icon} name="chat" size=${16} />${p.comments ? p.comments : "Comment"}</button>`}</footer>
    ${p.deleted ? html`<div class="answered warn">Removed · only organizers see this</div>` : null}
    ${menu ? html`<${Popover} anchor=${menu} onClose=${() => setMenu(null)} align="right"><${Menu} items=${items} onPick=${run} /><//>` : null}
  </article>`;
}

// ---- sheets --------------------------------------------------------------------------
function BoardPostSheet({ id, onClose }) {
  const app = useApp();
  const p = useDocData(() => app.db.doc("board/" + id), [id, app.db]);
  const comments = useCollection(() => app.db.collection("board/" + id + "/comments").orderBy("ts"), [id, app.db]) || [];
  const [text, setText] = useState("");
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const ok = await app.commentBoard(p, t);
    if (ok) app.db.doc("board/" + id).update({ comments: comments.length + 1 }).catch(() => {});
    else setText(t);
  };
  return html`<${Sheet} title=${p ? catOf(p.cat).label.replace(/s$/, "") : "Post"} onClose=${onClose} size="tall"
    footer=${p && app.canWrite ? html`<div class="cmt-composer"><${Avatar} uid=${app.uid} size=${28} /><input class="input" placeholder="Add a comment" value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === "Enter" && !e.isComposing && send()} /><button class=${"send" + (text.trim() ? " on" : "")} disabled=${!text.trim()} onClick=${send} aria-label="Send comment"><${Icon} name="send" size=${18} /></button></div>` : null}>
    ${p === null ? html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>` : p === false ? html`<${Empty} icon="board" title="This post was removed" />` : html`
      <${BoardCard} p=${{ ...p, id }} full=${true} />
      <h3 class="h3">${comments.length ? plural(comments.length, "comment") : "No comments yet"}</h3>
      <div class="cmts">${comments.map((c) => html`<div class="cmt" key=${c.id}><button class="run-av" onClick=${() => app.open("profile", { uid: c.by })}><${Avatar} uid=${c.by} size=${28} /></button>
        <div class="cmt-b"><b>${c.by === app.uid ? "You" : app.person(c.by).name}</b><span class="tm">${relShort(c.ts)}</span><p><${RichText} text=${c.text} /></p></div></div>`)}</div>`}
  <//>`;
}

function BoardNewSheet({ cat: cat0, onClose }) {
  const app = useApp();
  const [cat, setCat] = useState(cat0 || "event");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [where, setWhere] = useState("");
  const tomorrow8 = Sched.startOfDay(Sched.addDays(Clock.now(), 1)) + 20 * 3600e3;
  const [at, setAt] = useState(toLocalInput(tomorrow8));
  const [dur, setDur] = useState(90);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const timed = cat === "event" || cat === "study";
  const PH = { event: ["Study break: dumplings in the Lowell JCR", "What, and who it's for. Anything people should bring."], study: ["Stat 110 PSet 5 group", "Which problems, what level, how long you'll be there."], market: ["Selling: TI-84, works great", "Condition, how to pick it up."], lost: ["Lost: black AirPods case near Lamont", "Where and when you last had it."], general: ["Food trucks on the Plaza today", "Say more…"] };
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); };
  const ok = title.trim().length >= 3 && (!timed || (fromLocalInput(at) && where.trim()));
  const post = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const start = fromLocalInput(at);
    const done = await app.postBoard({ cat, title: title.trim(), body: body.trim(), price: price.trim() ? (/^\$/.test(price.trim()) || /free/i.test(price) ? price.trim() : "$" + price.trim()) : "", at: start, end: start ? start + dur * 60e3 : 0, where: where.trim() }, file);
    setBusy(false);
    if (done) onClose();
  };
  return html`<${Sheet} title="New post" icon="board" onClose=${onClose} size="tall"
    footer=${html`<span class="muted sm grow">Everyone at Harvard on Roster can see this.</span><button class="btn primary" disabled=${!ok || busy} onClick=${post}>${busy ? "Posting…" : "Post"}</button>`}>
    <div class="catpick" role="radiogroup" aria-label="Category">${Catalog.BOARD_CATS.map((c) => html`<button key=${c.id} role="radio" aria-checked=${cat === c.id} class=${"catopt" + (cat === c.id ? " on" : "")} onClick=${() => setCat(c.id)}><${Icon} name=${CAT_ICON[c.id]} size=${18} fill=${cat === c.id} />${c.label.replace(/s$/, "")}</button>`)}</div>
    <label class="field"><span>Title</span><input class="input lg" maxlength="90" placeholder=${PH[cat][0]} value=${title} onInput=${(e) => setTitle(e.target.value)} autofocus /></label>
    ${cat === "market" ? html`<label class="field"><span>Price</span><input class="input" inputmode="decimal" placeholder="$25 or Free" value=${price} onInput=${(e) => setPrice(e.target.value)} /></label>` : null}
    ${timed ? html`<div class="field-row"><label class="field"><span>Starts</span><input class="input" type="datetime-local" value=${at} onInput=${(e) => setAt(e.target.value)} /></label>
      <label class="field"><span>Length</span><select class="input" value=${dur} onChange=${(e) => setDur(+e.target.value)}>${[[30, "30 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [180, "3 hours"]].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></label></div>
      <label class="field"><span>Where</span><input class="input" placeholder="Cabot Library, 3rd floor" value=${where} onInput=${(e) => setWhere(e.target.value)} /></label>` : null}
    <label class="field"><span>Details <small>optional</small></span><textarea class="input" rows="3" maxlength="600" placeholder=${PH[cat][1]} value=${body} onInput=${(e) => setBody(e.target.value)}></textarea></label>
    <input type="file" accept="image/*" hidden ref=${fileRef} onChange=${onFile} />
    ${preview ? html`<div class="imgprev"><img src=${preview} alt="" /><button class="iconbtn sm" onClick=${() => { setFile(null); setPreview(null); }} aria-label="Remove photo"><${Icon} name="x" size=${16} /></button></div>`
      : html`<button class="btn ghost" onClick=${() => fileRef.current && fileRef.current.click()}><${Icon} name="image" size=${18} />Add a photo</button>`}
  <//>`;
}
