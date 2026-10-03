// ---------------------------------------------------------------------------
// Hub (course info, due cards, pinned rules, links, people, organizer entry,
// exit survey) and the PSet view.
// ---------------------------------------------------------------------------
function HubPanel({ courseId, hub, members, onClose }) {
  const app = useApp();
  useTick(30000);
  const c = Catalog.get(courseId, app.customCourses);
  const look = courseLook(courseId);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const due = ((hub && hub.due) || []).filter((d) => d.at > Clock.now() - 864e5).sort((a, b) => a.at - b.at);
  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = members.filter((m) => !s || (m.displayName || "").toLowerCase().includes(s) || (m.house || "").toLowerCase().includes(s) || (m.concentration || "").toLowerCase().includes(s));
    return list.sort((a, b) => (b.id === app.uid) - (a.id === app.uid) || app.online.has(b.id) - app.online.has(a.id) || (a.displayName || "").localeCompare(b.displayName || ""));
  }, [members, q, app.online]);
  const myHouse = app.me && app.me.house;
  const housemates = myHouse ? members.filter((m) => m.house === myHouse && m.id !== app.uid).length : 0;
  const shown = all ? people : people.slice(0, 30);

  return html`<div class="hub">
    ${onClose ? html`<div class="hub-h"><h3>Class hub</h3><button class="iconbtn" onClick=${onClose} aria-label="Close hub"><${Icon} name="x" /></button></div>` : null}
    <div class="card course-card">
      <div class="course-cover" style=${{ background: look.bg }}><span class="code">${c.code}</span><span class="emo">${look.emoji}</span></div>
      <div class="course-info">
        ${c.title ? html`<div class="ttl">${c.title}</div>` : null}
        ${c.who ? html`<div>${c.who}</div>` : null}
        ${c.meets || c.where ? html`<div>${[c.meets, c.where].filter(Boolean).join(" · ")}</div>` : null}
        <div>${members.length} ${members.length === 1 ? "classmate" : "classmates"} here${housemates ? " · " + housemates + " from " + shortHouse(myHouse) : ""}</div>
      </div>
    </div>

    <${SurveyCard} courseId=${courseId} hub=${hub} />

    <div class="card">
      <div class="side-h" style=${{ paddingTop: "12px" }}><span class="label">Coming up</span></div>
      ${due.length === 0 ? html`<div class="muted" style=${{ padding: "4px 14px 14px", fontSize: "13px" }}>No dates pinned yet.${app.isOrganizer ? " Add them in organizer tools." : ""}</div>` : null}
      ${due.map((d) => {
        const left = d.at - Clock.now();
        const cal = calLinks(c.code + " · " + d.title, d.at, 30, d.where ? "Where: " + d.where : "");
        return html`<div class="due-card" key=${d.id}>
          <div class="top"><div><div class="ttl">${d.title}</div><div class="when">${dueWhen(d.at)}${d.where ? " · " + d.where : ""}</div></div>
            ${left > 0 ? html`<div class="left"><small>${left < 864e5 ? "DUE IN" : "IN"}</small><b>${countdown(left)}</b></div>` : html`<div class="left"><small>PAST</small></div>`}</div>
          <div class="acts">
            <a class="btn btn-soft btn-sm" href=${cal.google} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar"><${Icon} name="calendar" size=${16} />Add</a>
            ${app.canWrite ? html`<button class="btn btn-ghost btn-sm" onClick=${() => app.sendDue(courseId, d)}><${Icon} name="send" size=${16} />Send to chat</button>` : null}
          </div>
        </div>`;
      })}
    </div>

    ${hub && ((hub.rules && hub.rules.length) || (hub.links && hub.links.length)) ? html`<div class="card">
      <div class="side-h" style=${{ paddingTop: "12px" }}><span class="label">Pinned</span></div>
      ${hub.rules && hub.rules.length ? html`<ol class="rules">${hub.rules.map((r) => html`<li>${r}</li>`)}</ol>` : null}
      ${(hub.links || []).map((l) => html`<a class="link-row" href=${l.url} target="_blank" rel="noopener noreferrer"><${Icon} name="link" size=${18} /><span>${l.title}</span><${Icon} name="chevronRight" size=${16} /></a>`)}
    </div>` : null}

    <div class="card">
      <div class="side-h" style=${{ paddingTop: "12px" }}><span class="label">In this class · ${members.length}</span>${app.online.size ? html`<span class="muted" style=${{ fontSize: "12px" }}><span style=${{ color: "var(--online)" }}>●</span> ${[...app.online].filter((id) => members.some((m) => m.id === id)).length} online</span>` : null}</div>
      <div class="people-search"><input id=${"people-q-" + courseId} class="input" style=${{ height: "38px", fontSize: "14px" }} placeholder="Search by name, house, concentration" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      ${shown.map((m) => html`<div class="person" key=${m.id}>
        <${Avatar} uid=${m.id} size=${34} online=${app.online.has(m.id)} />
        <div class="who"><div class="n">${m.displayName || app.person(m.id).name}${m.id === app.uid ? html` <span class="you">· you</span>` : null}</div>
          <div class="s">${[tagLine(m), m.concentration].filter(Boolean).join(" · ") || "Classmate"}</div></div>
      </div>`)}
      ${people.length > shown.length ? html`<button class="btn btn-ghost btn-sm" style=${{ margin: "6px 14px 14px" }} onClick=${() => setAll(true)}>Show all ${people.length}</button>` : html`<div style=${{ height: "8px" }}></div>`}
    </div>

    ${app.isOrganizer ? html`<button class="card org-cta" onClick=${() => app.openOrganizer("results")}>
      <${Icon} name="chart" /><span class="grow"><b>Organizer tools${app.demo ? " (demo)" : ""}</b><small>Experiment results, recaps, due dates, export</small></span><${Icon} name="chevronRight" />
    </button>` : null}
    <div class="ob-fine" style=${{ padding: "0 8px 8px" }}>Run by a student. Not affiliated with Harvard or course staff.</div>
  </div>`;
}

const Q1 = ["Most days", "A few times", "Once or twice", "Never"];
const Q2 = ["GroupMe", "Ed", "ChatGPT", "A friend group chat", "Shared Google Doc", "Nothing"];
function SurveyCard({ courseId, hub }) {
  const app = useApp();
  const mine = useDocData(() => (app.uid ? app.db.doc("survey/" + app.uid) : null), [app.db, app.uid]);
  const [q1, setQ1] = useState(null), [q2, setQ2] = useState([]), [q3, setQ3] = useState("");
  const [open, setOpen] = useState(false);
  const c1 = hub && hub.cycles && hub.cycles[0];
  if (!c1 || Clock.now() < c1.end || app.isOrganizerReal || !app.canWrite || mine === null || mine) return null;
  const submit = async () => {
    const ok = await app.write(() => app.db.doc("survey/" + app.uid).set({ course: courseId, q1, q2, q3: q3.trim(), ts: Clock.now() }), "Thanks. Only the organizer sees your answers.");
    if (ok) setOpen(false);
  };
  return html`<div class="card card-pad" style=${{ borderColor: "var(--accent)" }}>
    <div style=${{ display: "flex", gap: "10px", alignItems: "center" }}><span class="emo" style=${{ fontSize: "22px" }}>🗳️</span>
      <div style=${{ flex: 1 }}><b style=${{ display: "block" }}>3 quick questions</b><span class="muted" style=${{ fontSize: "13px" }}>From the organizer, about ${c1.label}. Takes 30 seconds.</span></div>
      <button class="btn btn-primary btn-sm" onClick=${() => setOpen(true)}>Answer</button></div>
    ${open ? html`<${Modal} title="3 quick questions" icon="info" onClose=${() => setOpen(false)} footer=${html`<button class="btn btn-ghost" onClick=${() => setOpen(false)}>Later</button><button class="btn btn-primary" disabled=${!q1} onClick=${submit}>Send answers</button>`}>
      <div class="survey">
        <div class="field"><span>During ${c1.label}, how often did you open this chat?</span><div class="choices">${Q1.map((o) => html`<button class=${"choice" + (q1 === o ? " on" : "")} onClick=${() => setQ1(o)}>${o}</button>`)}</div></div>
        <div class="field"><span>Did it replace anything you used before? Pick any.</span><div class="choices">${Q2.map((o) => html`<button class=${"choice" + (q2.includes(o) ? " on" : "")} onClick=${() => setQ2(q2.includes(o) ? q2.filter((x) => x !== o) : [...q2, o])}>${o}</button>`)}</div></div>
        <label class="field"><span>What would make it worth opening?</span><textarea id="survey-q3" class="input" rows="3" value=${q3} onInput=${(e) => setQ3(e.target.value)} placeholder="Be blunt. This decides what gets built."></textarea></label>
      </div>
    <//>` : null}
  </div>`;
}

function PsetView({ courseId, thread, messages, byId, ctx, members }) {
  const app = useApp();
  useTick(1000);
  const [problem, setProblem] = useState("all");
  const lrKey = "roster:lr:" + app.mode + ":" + courseId + ":" + thread.id;
  const [lastRead] = useState(() => LS.get(lrKey, Clock.now() - 3 * 3600e3));
  useEffect(() => () => LS.set(lrKey, Clock.now()), [lrKey]);
  const inThread = messages.filter((m) => m.thread === thread.id);
  const counts = {};
  for (const m of inThread) if (m.ts > lastRead && m.by !== app.uid) for (const t of m.tags || []) counts[t] = (counts[t] || 0) + 1;
  const shown = problem === "all" ? inThread : inThread.filter((m) => (m.tags || []).includes(problem));
  const left = thread.due ? thread.due - Clock.now() : 0;
  return html`<div class="pane" style=${{ flex: 1 }}>
    <div class="ptabs" role="tablist" aria-label="Problems">
      <button class=${"ptab" + (problem === "all" ? " on" : "")} onClick=${() => setProblem("all")} role="tab" aria-selected=${problem === "all"}>All</button>
      ${(thread.problems || []).map((p) => html`<button class=${"ptab" + (problem === p ? " on" : "")} onClick=${() => setProblem(p)} role="tab" aria-selected=${problem === p}>${prettyProblem(p)}${counts[p] ? html`<span class="n">+${counts[p]}</span>` : null}</button>`)}
    </div>
    <${MessageList} courseId=${courseId} messages=${shown} byId=${byId} lastRead=${lastRead} recapCtx=${ctx}
      header=${html`<div class="pset-hero" style=${{ margin: "0 0 4px" }}>
        <div class="grow"><h3>${thread.title}${problem !== "all" ? " · problem " + prettyProblem(problem) : ""}</h3><p>${thread.due ? "Due " + dueWhen(thread.due) + ". " : ""}Talk through ideas here. Don't post answers.</p></div>
        ${left > 0 ? html`<div class="cd"><small>DUE IN</small><b>${countdown(left)}</b></div>` : null}
      </div>`}
      empty=${html`<div class="empty" style=${{ paddingTop: "8px" }}><div class="big emo">🧩</div><h3>${problem === "all" ? "Nothing here yet" : "No one's asked about " + prettyProblem(problem) + " yet"}</h3><p>Ask the class. Tag the problem so people stuck on the same part find it.</p></div>`} />
    <${Composer} courseId=${courseId} thread=${thread.id} members=${members} problems=${thread.problems || []} problem=${problem} onProblem=${setProblem}
      placeholder=${problem === "all" ? "Ask about " + thread.title : "Ask about " + prettyProblem(problem)} />
  </div>`;
}
