// ---------------------------------------------------------------------------
// A class (or House / class-year space): header, tabs, and each tab's view.
// ---------------------------------------------------------------------------
function useClassData(courseId) {
  const app = useApp();
  const feed = app.feeds[courseId] || null;
  const threads = useCollection(() => app.db.collection("courses/" + courseId + "/threads"), [courseId, app.db]) || [];
  const recapList = useCollection(() => app.db.collection("recaps/" + courseId + "/items"), [courseId, app.db]) || [];
  const checks = useCollection(() => app.db.collection("courses/" + courseId + "/checks").limit(1000), [courseId, app.db]) || [];
  const notes = useCollection(() => app.db.collection("courses/" + courseId + "/notes"), [courseId, app.db]) || [];
  const stuck = useCollection(() => app.db.collection("courses/" + courseId + "/stuck"), [courseId, app.db]) || [];
  const fixes = useMemo(() => app.fixes.filter((f) => f.cid === courseId), [app.fixes, courseId]);
  const messages = feed || [];
  const byId = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);
  const ctx = useMemo(() => ({ recaps: Object.fromEntries(recapList.map((r) => [r.id, r])), fixes, checks }), [recapList, fixes, checks]);
  const members = useMemo(() => app.members.filter((m) => m.courses && m.courses[courseId]), [app.members, courseId]);
  const now = Clock.now();
  const psets = threads.filter((t) => t.kind === "pset").sort((a, b) => (a.due || 0) - (b.due || 0));
  const pset = psets.find((t) => t.due > now - 864e5) || psets[psets.length - 1] || null;
  return { feed, messages, byId, ctx, members, threads, psets, pset, recapList, fixes, checks, notes, stuck };
}

function ClassView({ courseId, tab, onBack }) {
  const app = useApp();
  useTick(15000);
  const c = course(app, courseId);
  const isCourse = Catalog.isCourse(courseId);
  const D = useClassData(courseId);
  const hub = app.hubs[courseId];
  const [lastRead] = useState(() => app.lastRead(courseId, "main"));
  const mySection = (app.me && app.me.sections && app.me.sections[courseId]) || "";
  const openFixes = D.fixes.filter((f) => !autoApplied(f) && f.status !== "dismissed" && !D.recapList.some((r) => r.bullets.some((b) => b.fixedBy === f.id))).length;
  const tabs = isCourse
    ? [["chat", "Chat"], D.pset && ["pset", D.pset.title], ["recaps", "Recaps", openFixes || null], ["notes", "Notes"], ["section", mySection ? "Section" : "Sections"], ["people", "People"]].filter(Boolean)
    : [["chat", "Chat"], ["people", "People"]];
  const active = tabs.some(([k]) => k === tab) ? tab : "chat";
  const online = D.members.filter((m) => app.online.has(m.id));
  const typing = app.typing(courseId);
  useEffect(() => { app.markVisit(courseId); }, [courseId, !!app.me]);
  useEffect(() => { if (D.feed && active === "chat") app.markRead(courseId, "main"); }, [D.feed && D.feed.length, active]);
  const mainMsgs = useMemo(() => D.messages.filter((m) => (m.thread || "main") === "main"), [D.messages]);

  const look = courseLook(courseId);
  return html`<div class="classview" style=${{ "--own": look.solid, "--own-tint": look.tint, "--own-text": look.text }}>
    <header class="classhead">
      <button class="iconbtn back" onClick=${onBack} aria-label="Back"><${Icon} name="chevronLeft" /></button>
      <button class="classhead-id" onClick=${() => app.go("people")}>
        <${Tile} courseId=${courseId} size=${38} />
        <span class="classhead-t"><b>${c.code}</b><small>${typing.length ? html`<span class="on">${typing.length === 1 ? firstName(app.person(typing[0]).name) + " is typing" : "Several people are typing"}</span>`
          : html`${plural(D.members.length, "member")}${online.length ? html` · <span class="on">${online.length} online</span>` : ""}`}</small></span>
      </button>
      <span class="grow"></span>
      ${online.length ? html`<span class="here"><${Faces} ids=${online.map((m) => m.id)} total=${online.length} size=${22} max=${3} /></span>` : null}
      <button class="iconbtn" onClick=${() => app.open("palette", { scope: courseId })} aria-label="Search this class"><${Icon} name="search" /></button>
      ${app.isOrganizer && isCourse ? html`<button class="iconbtn" onClick=${() => app.open("organizer", { courseId, tab: "results" })} aria-label="Organizer tools"><${Icon} name="chart" /></button>` : null}
    </header>
    <nav class="tabs" role="tablist" aria-label=${c.code + " sections"}>${tabs.map(([k, l, n]) => html`<button key=${k} role="tab" aria-selected=${active === k} class=${"tab" + (active === k ? " on" : "")} onClick=${() => app.go(k)}>${l}${n ? html`<span class="tab-n">${n}</span>` : null}</button>`)}</nav>
    ${D.feed === null && (active === "chat" || active === "pset" || active === "section") ? html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>` : null}
    ${D.feed !== null && active === "chat" ? html`
      <${PinBar} courseId=${courseId} hub=${hub} pset=${D.pset} />
      <${MessageList} courseId=${courseId} messages=${mainMsgs} byId=${D.byId} lastRead=${lastRead} recapCtx=${D.ctx} catchup=${true}
        empty=${html`<${Empty} icon="wave" title="You're early.">Everyone who adds ${c.code} lands in this chat. Say hi, or ask what everyone's working on.<//>`} />
      <${Composer} courseId=${courseId} thread="main" members=${D.members} placeholder=${"Message " + c.code} />` : null}
    ${D.feed !== null && active === "pset" && D.pset ? html`<${PsetBoard} key=${D.pset.id} courseId=${courseId} D=${D} />` : null}
    ${active === "recaps" ? html`<${RecapsView} courseId=${courseId} D=${D} />` : null}
    ${active === "notes" ? html`<${NotesView} courseId=${courseId} D=${D} />` : null}
    ${D.feed !== null && active === "section" ? html`<${SectionView} courseId=${courseId} D=${D} />` : null}
    ${active === "people" ? html`<div class="scroller"><${PeopleOfClass} courseId=${courseId} D=${D} /></div>` : null}
  </div>`;
}

// Telegram's pinned bar with a segmented rail; Saturn's amber countdown on deadlines.
function PinBar({ courseId, hub, pset }) {
  useTick(1000);
  const [i, setI] = useState(0);
  const now = Clock.now();
  const items = [];
  const psetFirst = (d) => (/pset|problem set/i.test(d.title) ? 0 : 1);
  for (const d of ((hub && hub.due) || []).filter((x) => x.at > now).sort((a, b) => psetFirst(a) - psetFirst(b) || a.at - b.at).slice(0, 2)) items.push({ icon: "flag", k: "Due", text: d.title + (d.where ? " · " + d.where : ""), at: d.at });
  if (hub && hub.rules && hub.rules[0]) items.push({ icon: "shield", k: "Class rule", text: hub.rules[0] });
  if (!items.length) return null;
  const k = i % items.length, it = items[k];
  const left = it.at ? it.at - now : null;
  return html`<button class="pinbar" onClick=${() => setI(k + 1)} aria-label=${"Pinned " + (k + 1) + " of " + items.length + ". Show next."}>
    <span class="pin-rail">${items.map((_, j) => html`<i class=${j === k ? "on" : ""}></i>`)}</span>
    <span class="grow pin-body"><span class="pin-k">Pinned · ${it.k}</span><span class="pin-v">${it.text}</span></span>
    ${left != null ? html`<span class="pin-cd"><small>${left < 864e5 ? "DUE IN" : dueLadder(it.at).text.toUpperCase()}</small><b class="tnum">${left < 864e5 ? countdown(left) : inWords(left)}</b></span>` : null}
  </button>`;
}

// ---- PSet board (Gradescope chips, Ed pills, GitHub upvote pill) ----
function PsetBoard({ courseId, D }) {
  const app = useApp();
  useTick(1000);
  const t = D.pset;
  const [problem, setProblem] = useState(null);
  const [sort, setSort] = useState("order");
  const inThread = D.messages.filter((m) => m.thread === t.id);
  const lrKey = "roster:lr:" + app.mode + ":" + courseId + ":" + t.id;
  const [lastRead] = useState(() => LS.get(lrKey, Clock.now() - 3 * 3600e3));
  useEffect(() => () => LS.set(lrKey, Clock.now()), [lrKey]);
  const left = t.due - Clock.now();
  const rows = (t.problems || []).map((p, idx) => {
    const msgs = inThread.filter((m) => (m.tags || []).includes(p));
    const qs = msgs.filter((m) => !m.replyTo && m.kind === "text");
    const answered = qs.length > 0 && qs.every((q) => q.resolved || msgs.some((x) => x.replyTo === q.id));
    const stuckers = D.stuck.filter((s) => s.thread === t.id && s.problem === p).map((s) => s.by);
    return { p, idx, msgs, qs, status: !msgs.length ? "none" : answered ? "answered" : "open", stuckers, mine: stuckers.includes(app.uid), fresh: msgs.filter((m) => m.ts > lastRead && m.by !== app.uid).length, last: msgs[msgs.length - 1] };
  });
  const sorted = [...rows].sort((a, b) => (sort === "stuck" ? b.stuckers.length - a.stuckers.length : sort === "open" ? (a.status === "open" ? -1 : 0) - (b.status === "open" ? -1 : 0) : 0) || a.idx - b.idx);
  if (problem) {
    const r = rows.find((x) => x.p === problem);
    return html`<div class="pane-col">
      <div class="probhead"><button class="iconbtn" onClick=${() => setProblem(null)} aria-label="All problems"><${Icon} name="chevronLeft" /></button>
        <span class="pchip lg">${prettyProblem(problem)}</span><b class="grow">${t.title} · problem ${prettyProblem(problem)}</b>
        ${app.canWrite ? html`<button class=${"stuck" + (r.mine ? " on" : "")} aria-pressed=${r.mine} onClick=${() => app.toggleStuck(courseId, t.id, problem, r.mine)}>↑ ${r.mine ? (r.stuckers.length > 1 ? "You + " + (r.stuckers.length - 1) + " stuck" : "You're stuck") : r.stuckers.length + " stuck"}</button>` : null}</div>
      <${MessageList} courseId=${courseId} messages=${r.msgs} byId=${D.byId} lastRead=${lastRead} recapCtx=${D.ctx}
        empty=${html`<${Empty} icon="question" title=${"No one's asked about " + prettyProblem(problem) + " yet"}>Ask the class. People stuck on the same part will find it here.<//>`} />
      <${Composer} courseId=${courseId} thread=${t.id} members=${D.members} problems=${t.problems} problem=${problem} onProblem=${(p) => p !== "all" && setProblem(p)}
        placeholder=${"Ask about " + prettyProblem(problem)} hint=${left > 0 ? "Explain the idea, not the final answer." : null} />
    </div>`;
  }
  return html`<div class="scroller"><div class="psetboard">
    <div class="psethero">
      <div class="grow"><span class="eyebrow">${t.title}</span><h3>Due ${dueWhen(t.due)}</h3><p class=${"due-tone " + dueLadder(t.due).tone}>${dueLadder(t.due).text}${dueLadder(t.due).sub ? " · " + dueLadder(t.due).sub : ""}</p></div>
      ${left > 0 && left < 2 * 864e5 ? html`<div class="bigcd"><small>ENDS IN</small><b class="tnum">${countdown(left)}</b></div>` : null}
    </div>
    <div class="policy"><${Icon} name="shield" size=${22} /><p><b>Collaboration policy.</b> ${(app.hubs[courseId] && app.hubs[courseId].rules && app.hubs[courseId].rules[0]) || "Talk through ideas, write up your own solutions."} Don't share or ask for full answers before the deadline.</p></div>
    <div class="board-h"><span class="eyebrow">Problems</span><span class="grow"></span>
      <${Seg} value=${sort} onChange=${setSort} label="Sort problems" options=${[["order", "In order"], ["stuck", "Most stuck"], ["open", "Unanswered"]]} /></div>
    <div class="probs">${sorted.map((r) => html`<div class=${"prob" + (r.fresh ? " fresh" : "")} key=${r.p}>
      <button class="prob-main" onClick=${() => setProblem(r.p)}>
        <span class="pchip lg">${prettyProblem(r.p)}</span>
        <span class="prob-body"><b>${r.qs[0] || r.msgs[0] ? html`${(r.qs[0] || r.msgs[0]).kind === "photo" ? "📷 " : ""}<${RichText} text=${(r.qs[0] || r.msgs[0]).text || "Photo"} />` : "No questions yet"}</b>
          <small>${r.msgs.length ? plural(r.msgs.length, "message") + " · last " + relShort(r.last.ts) : "Be the first to ask"}</small></span>
        <span class=${"status s-" + r.status}>${r.status === "answered" ? html`<${Icon} name="check" size=${12} />Answered` : r.status === "open" ? "Open" : ""}</span>
      </button>
      ${app.canWrite ? html`<button class=${"stuck" + (r.mine ? " on" : "")} aria-pressed=${r.mine} onClick=${() => app.toggleStuck(courseId, t.id, r.p, r.mine)} title="I'm stuck too">↑ ${r.stuckers.length}<span class="sr"> stuck</span></button>` : html`<span class="stuck">↑ ${r.stuckers.length}</span>`}
    </div>`)}</div>
    <p class="muted sm center">Tap ↑ if you're stuck too. You'll see when the problem gets answered.</p>
  </div></div>`;
}

function RecapsView({ courseId, D }) {
  const app = useApp();
  const list = [...D.recapList].sort((a, b) => b.ts - a.ts);
  return html`<div class="scroller"><div class="stack-col">
    ${app.isOrganizer ? html`<div class="row-end"><button class="btn sm soft" onClick=${() => app.open("organizer", { courseId, tab: "recap" })}><${Icon} name="ai" size=${16} />Draft a recap</button></div>` : null}
    ${list.length === 0 ? html`<${Empty} icon="ai" title="No recaps yet">After each lecture the organizer posts a short AI draft here. You check it against what was actually said, and fix what's wrong.<//>` : null}
    ${list.map((r) => html`<${RecapCard} key=${r.id} recap=${r} courseId=${courseId} fixes=${D.ctx.fixes} checks=${D.ctx.checks} />`)}
  </div></div>`;
}

// ---- Notes (GitHub upvote pill, Ed Top sort) ----
function NotesView({ courseId, D }) {
  const app = useApp();
  const [sort, setSort] = useState("top");
  const lectures = [...new Set([...D.notes.map((n) => n.lecture || 0), ...D.recapList.map((r) => r.lecture)])].sort((a, b) => b - a);
  const help = (n) => Object.values(n.helpful || {}).filter(Boolean).length;
  return html`<div class="scroller"><div class="stack-col">
    <div class="board-h"><span class="eyebrow">Lecture notes</span><span class="grow"></span><${Seg} value=${sort} onChange=${setSort} label="Sort notes" options=${[["top", "Top"], ["new", "Newest"]]} />
      ${app.canWrite ? html`<button class="btn sm primary" onClick=${() => app.open("note-new", { courseId, lectures })}><${Icon} name="plus" size=${16} />Share notes</button>` : null}</div>
    ${!lectures.length ? html`<${Empty} icon="note" title="No notes yet">Share yours after the next lecture. Classmates mark the ones that help.<//>` : null}
    ${lectures.map((L) => {
      const recap = D.recapList.find((r) => r.lecture === L);
      const ns = D.notes.filter((n) => (n.lecture || 0) === L).sort((a, b) => (sort === "top" ? help(b) - help(a) : 0) || b.ts - a.ts);
      return html`<section class="lecgroup" key=${L}>
        <h3 class="lec-h">${L ? "Lecture " + L : "General"}${recap ? html`<small> · ${recap.title}</small>` : null}</h3>
        ${recap ? html`<button class="notrow ai" onClick=${() => app.go("recaps")}><span class="ai-badge"><${Icon} name="ai" size=${14} />AI recap</span><span class="grow"><b>${recap.title}</b><small>${plural(recap.bullets.length, "line")} · checked by classmates</small></span><${Icon} name="chevronRight" size=${16} /></button>` : null}
        ${ns.map((n) => {
          const mine = !!(n.helpful && n.helpful[app.uid]);
          return html`<div class="notrow" key=${n.id}>
            <button class=${"upv" + (mine ? " on" : "")} aria-pressed=${mine} onClick=${() => app.canWrite && app.toggleHelpful(courseId, n)} title="Helpful">↑<span>${help(n)}</span></button>
            <button class="grow notrow-main" onClick=${() => app.open("note", { courseId, n })}><b>${n.title}</b><small>by ${firstName(app.person(n.by).name)} · ${relShort(n.ts)}${n.image ? " · photo" : ""}</small></button>
            ${n.image ? html`<img class="notethumb" src=${Media.resolve(n.image.src)} alt="" />` : null}
          </div>`;
        })}
      </section>`;
    })}
  </div></div>`;
}

// ---- Section rooms (WhatsApp Community + Telegram Topics) ----
function SectionView({ courseId, D }) {
  const app = useApp();
  const mine = (app.me && app.me.sections && app.me.sections[courseId]) || "";
  const slot = mine && Catalog.slot(mine);
  const counts = {};
  for (const m of D.members) { const s = m.sections && m.sections[courseId]; if (s) counts[s] = (counts[s] || 0) + 1; }
  if (!slot) {
    return html`<div class="scroller"><div class="stack-col">
      <h3 class="h3">Which section are you in?</h3>
      <p class="muted">Pick one to join its room with the people in it. You can change this anytime.</p>
      <div class="slotlist">${Catalog.SLOTS.map((s) => html`<button class="slot" key=${s.id} onClick=${() => app.updateProfile({ sections: { ...((app.me && app.me.sections) || {}), [courseId]: s.id } }, "You're in the " + s.label + " section room")}>
        <${Icon} name="users" /><span class="grow"><b>${s.label}</b><small>${counts[s.id] ? plural(counts[s.id], "classmate") : "No one yet"}</small></span><${Icon} name="chevronRight" size=${16} /></button>`)}</div>
    </div></div>`;
  }
  const thread = "sec-" + mine;
  const msgs = D.messages.filter((m) => m.thread === thread);
  const people = D.members.filter((m) => m.sections && m.sections[courseId] === mine);
  return html`<div class="pane-col">
    <div class="probhead"><${Icon} name="users" /><b class="grow">Section · ${slot.label}</b>
      <${Faces} ids=${people.map((p) => p.id)} total=${people.length} size=${22} max=${4} />
      <button class="btn sm ghost" onClick=${() => app.updateProfile({ sections: { ...app.me.sections, [courseId]: "" } }, "Left the section room")}>Change</button></div>
    <${MessageList} courseId=${courseId} messages=${msgs} byId=${D.byId} lastRead=${app.lastRead(courseId, thread)}
      empty=${html`<${Empty} icon="users" title="Your section's room">${plural(people.length, "person", "people")} in ${slot.label}. Say hi before section.<//>`} />
    <${Composer} courseId=${courseId} thread=${thread} members=${people} placeholder=${"Message your " + slot.label + " section"} />
  </div>`;
}

// ---- People in a class + class info (Partiful guest list filters, Discord grouping) ----
function PeopleOfClass({ courseId, D }) {
  const app = useApp();
  useTick(30000);
  const c = course(app, courseId);
  const look = courseLook(courseId);
  const hub = app.hubs[courseId];
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const me = app.me || {};
  const mySec = me.sections && me.sections[courseId];
  const knows = (m) => app.isFriend(m.id) || (me.following && me.following[m.id]);
  const others = D.members.filter((m) => m.id !== app.uid);
  const tiles = [
    me.house && ["house", others.filter((m) => m.house === me.house).length, "from " + shortHouse(me.house)],
    mySec && ["sec", others.filter((m) => m.sections && m.sections[courseId] === mySec).length, "in your section"],
    me.concentration && ["conc", others.filter((m) => m.concentration === me.concentration).length, "in " + me.concentration],
    ["know", others.filter(knows).length, "you know"],
  ].filter(Boolean);
  const pass = (m) => (f === "all" || (f === "house" && m.house === me.house) || (f === "sec" && m.sections && m.sections[courseId] === mySec) || (f === "conc" && m.concentration === me.concentration) || (f === "know" && knows(m)))
    && (!q.trim() || [m.displayName, m.house, m.concentration, m.year].join(" ").toLowerCase().includes(q.trim().toLowerCase()));
  const list = others.filter(pass);
  const groups = [["People you know", list.filter(knows)], me.house ? ["From " + shortHouse(me.house), list.filter((m) => !knows(m) && m.house === me.house)] : null, ["Everyone", list.filter((m) => !knows(m) && m.house !== me.house)]].filter((g) => g && g[1].length);
  const [shown, setShown] = useState(40);
  const due = ((hub && hub.due) || []).filter((d) => d.at > Clock.now() - 864e5).sort((a, b) => a.at - b.at);
  return html`<div class="stack-col">
    <div class="coverc" style=${{ background: look.tint, color: look.text }}><div class="coverc-t"><span class="coverc-code">${c.code}</span><span class="coverc-title">${c.title}</span></div><span class="coverc-bot">${look.bottom}</span></div>
    ${c.who || c.meets ? html`<p class="muted sm">${[c.who, c.meets, c.where].filter(Boolean).join(" · ")}</p>` : null}
    ${Catalog.isCourse(courseId) ? html`<${SurveyCard} courseId=${courseId} hub=${hub} />` : null}
    ${due.length ? html`<section><h3 class="h3">Coming up</h3>${due.map((d) => html`<${DueRow} key=${d.id} d=${d} courseId=${courseId} />`)}</section>` : null}
    ${hub && ((hub.rules && hub.rules.length) || (hub.links && hub.links.length)) ? html`<section class="card pad"><h3 class="h3">Pinned</h3>
      ${hub.rules && hub.rules.length ? html`<ol class="rules">${hub.rules.map((r) => html`<li>${r}</li>`)}</ol>` : null}
      ${(hub.links || []).map((l) => html`<a class="linkrow" href=${l.url} target="_blank" rel="noopener noreferrer"><${Icon} name="link" size=${16} /><span class="grow">${l.title}</span><${Icon} name="chevronRight" size=${14} /></a>`)}</section>` : null}
    <section>
      <h3 class="h3">People · ${D.members.length}</h3>
      <div class="stattiles">${tiles.map(([k, n, l]) => html`<button class=${"stat" + (f === k ? " on" : "")} key=${k} onClick=${() => setF(f === k ? "all" : k)}><b class="tnum">${n}</b><span>${l}</span></button>`)}</div>
      <input id=${"people-q-" + courseId} class="input search" placeholder="Find a classmate" value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${groups.length ? groups.map(([g, ms]) => html`<div class="pgroup" key=${g}><div class="pgroup-h">${g.toUpperCase()} — ${ms.length}</div>
        ${ms.slice(0, shown).map((m) => html`<${PersonRow} key=${m.id} m=${m} courseId=${courseId} />`)}</div>`) : html`<p class="muted center">No classmates match. <button class="link" onClick=${() => { setQ(""); setF("all"); }}>Clear filters</button></p>`}
      ${list.length > shown ? html`<button class="btn ghost block" onClick=${() => setShown(shown + 80)}>Show more</button>` : null}
    </section>
    ${app.isOrganizer && Catalog.isCourse(courseId) ? html`<button class="card orgcta" onClick=${() => app.open("organizer", { courseId, tab: "results" })}><${Icon} name="chart" /><span class="grow"><b>Organizer tools${app.demo ? " (demo)" : ""}</b><small>Experiment results, recaps, dates, placement, export</small></span><${Icon} name="chevronRight" /></button>` : null}
    <p class="fine">Run by a student. Not affiliated with Harvard or course staff.</p>
  </div>`;
}
function PersonRow({ m, courseId, right }) {
  const app = useApp();
  const shared = Object.keys(m.courses || {}).filter((c) => Catalog.isCourse(c) && app.me && app.me.courses && app.me.courses[c]).length;
  const st = m.status && m.status.e && m.status.until > Clock.now() ? m.status : null;
  return html`<button class="prow" onClick=${() => app.open("profile", { uid: m.id, courseId })}>
    <${Avatar} uid=${m.id} size=${40} online=${app.online.has(m.id)} />
    <span class="grow prow-t"><b>${m.displayName || app.person(m.id).name}${m.id === app.uid ? html` <small>· you</small>` : null}</b>
      <small>${st ? st.e + " " + st.text : [m.year ? "'" + m.year.slice(1) : "", shortHouse(m.house || ""), m.concentration].filter(Boolean).join(" · ")}</small></span>
    ${right || (shared > 1 ? html`<span class="sharechip">${shared} shared</span>` : null)}
  </button>`;
}
function DueRow({ d, courseId, compact }) {
  const app = useApp();
  const lad = dueLadder(d.at);
  const c = calLinks(course(app, courseId).code + " · " + d.title, d.at, d.at + 30 * 60e3, d.where ? "On " + d.where : "");
  const has = app.tasks.some((t) => t.from === courseId + ":" + d.id);
  return html`<div class="duerow" style=${{ "--edge": courseLook(courseId).hue }}>
    <span class=${"flag " + lad.tone}><${Icon} name="flag" size=${14} /></span>
    <div class="grow"><b>${d.title}</b><small>${course(app, courseId).code}${d.where ? " · " + d.where : ""} · ${dueWhen(d.at)}</small></div>
    <span class=${"due-tone " + lad.tone}>${lad.text}</span>
    ${compact ? null : html`<div class="duerow-acts">
      <a class="btn sm soft" href=${c.google} target="_blank" rel="noopener noreferrer"><${Icon} name="calendar" size=${15} />Add</a>
      ${app.canWrite ? html`<button class="btn sm ghost" disabled=${has} onClick=${() => app.addTask({ title: "Start " + d.title, cid: courseId, due: d.at, from: courseId + ":" + d.id })}>${has ? "In your tasks" : "Add to tasks"}</button>` : null}
      ${app.canWrite && Catalog.isCourse(courseId) ? html`<button class="btn sm ghost" onClick=${() => app.sendDue(courseId, d)}>Send to chat</button>` : null}
    </div>`}
  </div>`;
}

const Q1 = ["Most days", "A few times", "Once or twice", "Never"];
const Q2 = ["GroupMe", "Ed", "ChatGPT", "A friend group chat", "Shared Google Doc", "Nothing"];
function SurveyCard({ courseId, hub }) {
  const app = useApp();
  const mine = useDocData(() => (app.uid ? app.db.doc("survey/" + app.uid) : null), [app.db, app.uid]);
  const c1 = hub && hub.cycles && hub.cycles[0];
  if (!c1 || Clock.now() < c1.end || app.isOrganizerReal || !app.canWrite || mine === null || mine) return null;
  return html`<div class="card pad survey-cta"><${Icon} name="poll" size=${22} /><div class="grow"><b>3 quick questions</b><small>From the organizer, about ${c1.label}. Takes 30 seconds.</small></div>
    <button class="btn sm primary" onClick=${() => app.open("survey", { courseId, label: c1.label })}>Answer</button></div>`;
}
