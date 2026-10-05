// ---------------------------------------------------------------------------
// Organizer tools (AI + data spec): the research question measured from the
// log (verdict strip with icon + words, zoned meters, pace with a dashed
// projection, lurkers, light vs written contributions), recap drafting that
// streams line by line for Keep / Edit / Remove, dates & cycles, placement
// by email, a reports queue, announcements, and a pseudonymous export.
// ---------------------------------------------------------------------------
const pct = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
const VERDICT = { success: ["check", "Success line met"], revise: ["warning", "Between the lines"], kill: ["x", "Below the kill line"], pending: ["clock", "Not measurable yet"] };
function Verdict({ v, text }) {
  const [ic, t] = VERDICT[v] || VERDICT.pending;
  return html`<span class=${"verdict " + v}><${Icon} name=${ic} size=${13} />${text || t}</span>`;
}

function OrganizerSheet({ courseId, tab: tab0, onClose }) {
  const app = useApp();
  const [tab, setTab] = useState(tab0 || "results");
  const c = course(app, courseId);
  const TABS = [["results", "Results"], ["recap", "Recap"], ["dates", "Dates"], ["place", "Placement"], ["mod", "Reports"], ["announce", "Announce"], ["export", "Export"]];
  return html`<${Sheet} title=${"Organizer · " + c.code} icon="chart" onClose=${onClose} size="wide">
    <nav class="tabs inset" role="tablist">${TABS.map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${"tab" + (tab === k ? " on" : "")} onClick=${() => setTab(k)}>${l}</button>`)}</nav>
    ${app.demo ? html`<div class="org-demo"><${Icon} name="info" size=${16} />Demo data: example classmates in a simulated ${c.code} chat, one pset cycle after placement. In the live class these numbers come from real activity.</div>` : null}
    ${tab === "results" ? html`<${Results} courseId=${courseId} />` : null}
    ${tab === "recap" ? html`<${RecapComposer} courseId=${courseId} onDone=${onClose} />` : null}
    ${tab === "dates" ? html`<${HubEditor} courseId=${courseId} />` : null}
    ${tab === "place" ? html`<${Placement} courseId=${courseId} />` : null}
    ${tab === "mod" ? html`<${Moderation} courseId=${courseId} />` : null}
    ${tab === "announce" ? html`<${Announcer} courseId=${courseId} />` : null}
    ${tab === "export" ? html`<${Exporter} courseId=${courseId} />` : null}
  <//>`;
}

function useCourseLog(courseId) {
  const app = useApp();
  const [data, setData] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const safe = (p) => p.then(rows).catch(() => []);
    Promise.all([
      safe(app.db.collection("courses/" + courseId + "/messages").orderBy("ts", "asc").limit(2000).get()),
      safe(app.db.collection("courses/" + courseId + "/fixes").get()),
      safe(app.db.collection("courses/" + courseId + "/checks").limit(2000).get()),
      safe(app.db.collection("recaps/" + courseId + "/items").get()),
      safe(app.db.collection("members").get()),
      safe(app.db.collection("survey").get()),
      safe(app.db.collection("courses/" + courseId + "/stuck").get()),
      safe(app.db.collection("courses/" + courseId + "/notes").get()),
      app.db.doc("hub/" + courseId).get().then((s) => (s.exists ? s.data() : {})).catch(() => ({})),
    ]).then(([messages, fixes, checks, recaps, members, surveys, stuck, notes, hub]) => {
      if (alive) setData({ messages, fixes, checks, recaps, members, surveys: surveys.filter((s) => s.course === courseId), stuck, notes, hub });
    });
    return () => { alive = false; };
  }, [courseId, n]);
  return [data, () => setN((x) => x + 1)];
}

// Zoned meter: red below kill, amber between, green above success (Stripe Radar's risk bar).
function Meter({ v, kill, ok, proj }) {
  const w = (x) => Math.max(0, Math.min(100, x * 100)) + "%";
  return html`<div class="meter" aria-hidden="true">
    <span class="zone kill" style=${{ width: w(kill) }}></span><span class="zone mid" style=${{ left: w(kill), width: "calc(" + w(ok) + " - " + w(kill) + ")" }}></span><span class="zone ok" style=${{ left: w(ok), right: 0 }}></span>
    ${proj != null ? html`<span class="m-proj" style=${{ left: w(proj) }}></span>` : null}
    ${v != null ? html`<span class="m-val" style=${{ left: w(v) }}></span>` : null}
    <span class="m-tick" style=${{ left: w(kill) }}><small>${Math.round(kill * 100)}</small></span><span class="m-tick" style=${{ left: w(ok) }}><small>${Math.round(ok * 100)}</small></span>
  </div>`;
}

function Results({ courseId }) {
  const app = useApp();
  const [data, refresh] = useCourseLog(courseId);
  const [scope, setScope] = useState("placed");
  if (!data) return html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span><span class="muted sm">Reading the chat log…</span></div>`;
  const cycles = (data.hub && data.hub.cycles) || [];
  if (cycles.length < 2) return html`<${Empty} icon="chart" title="Set your two pset cycles first">The research question compares cycle 1 with cycle 2. Add both under Dates.<//>`;
  const now = Clock.now();
  const placedOnly = scope === "placed" && data.members.some((m) => m.placement);
  const members = placedOnly ? data.members.filter((m) => m.placement || app.organizerIds.includes(m.id)) : data.members;
  const inScope = new Set(members.map((m) => m.id));
  const M = Metrics.compute({ courseId, members, messages: data.messages, fixes: data.fixes, checks: data.checks, recaps: data.recaps, cycles, organizerIds: app.organizerIds, now, stuck: data.stuck, notes: data.notes });
  const [c1, c2] = M.cycles;
  const elapsed2 = c2.started ? Math.min(1, (now - c2.start) / (c2.end - c2.start)) : 0;
  const pace = c2.started && !c2.finished && c1.studentMsgs && elapsed2 > 0.02 ? c2.studentMsgs / elapsed2 / c1.studentMsgs : null;
  const org = new Set(app.organizerIds);
  const days = [];
  for (let t = Sched.startOfDay(c1.start); t < c2.end; t = Sched.addDays(t, 1)) days.push({ t, n: 0, c2: t >= Sched.startOfDay(c2.start), future: t > now });
  for (const m of data.messages) {
    if (!m.by || org.has(m.by) || !inScope.has(m.by) || m.deleted || !["text", "photo", "poll", "event"].includes(m.kind)) continue;
    const i = days.findIndex((d, j) => m.ts >= d.t && (j === days.length - 1 || m.ts < days[j + 1].t));
    if (i >= 0) days[i].n++;
  }
  const maxN = Math.max(1, ...days.map((d) => d.n));
  const tally = (key, opts) => opts.map((o) => [o, data.surveys.filter((s) => (Array.isArray(s[key]) ? s[key].includes(o) : s[key] === o)).length]);
  const fixesPer = M.recaps.length ? M.recaps.reduce((a, r) => a + r.fixes, 0) / M.recaps.length : null;
  const LIGHT = [["react", "Reactions"], ["vote", "Poll votes"], ["rsvp", "RSVPs"], ["check", "Recap checks"], ["stuck", "“Stuck too”"], ["agree", "Fix votes"]];
  const WRITE = [["post", "Posts"], ["reply", "Replies"], ["fix", "Fixes"], ["note", "Notes"]];
  return html`<div class="dash">
    <div class="dash-q"><div class="grow"><b>Do placed students talk, and keep talking?</b>
      <small>${plural(M.placed, "student")} ${placedOnly ? "placed by you in" : "in"} ${course(app, courseId).code} · ${c1.label} ${F.md.format(c1.start)}–${F.md.format(c1.end)} · ${c2.label} ${F.md.format(c2.start)}–${F.md.format(c2.end)} · organizer excluded</small></div>
      ${data.members.some((m) => m.placement) ? html`<${Seg} value=${placedOnly ? "placed" : "all"} onChange=${setScope} label="Who counts" options=${[["placed", "Placed by you"], ["all", "Everyone who joined"]]} />` : null}
      <button class="btn sm ghost" onClick=${refresh}><${Icon} name="history" size=${15} />Refresh</button></div>

    <div class="kpis">
      <div class="kpi">
        <span class="kpi-k">Posted, replied or reacted in ${c1.label}</span>
        <span class="kpi-v tnum">${pct(c1.rate)}<small>${c1.contributors} of ${c1.placed}</small></span>
        <${Meter} v=${c1.rate} kill=${0.15} ok=${0.35} />
        <${Verdict} v=${c1.started ? M.verdicts.contribution : "pending"} text=${!c1.finished && c1.started ? "In progress" : null} />
        <span class="kpi-n">Counting only people who wrote something: <b>${pct(c1.writerRate)}</b> (${c1.writers}).</span>
      </div>
      <div class="kpi">
        <span class="kpi-k">${c2.label} messages as a share of ${c1.label}</span>
        <span class="kpi-v tnum">${pct(M.retention)}<small>${c2.studentMsgs} vs ${c1.studentMsgs}</small></span>
        <${Meter} v=${M.retention} proj=${pace} kill=${0.25} ok=${0.5} />
        <${Verdict} v=${c2.finished ? M.verdicts.retention : pace == null ? "pending" : pace >= 0.5 ? "success" : pace < 0.25 ? "kill" : "revise"} text=${c2.finished ? null : pace != null ? "On pace for " + pct(pace) : null} />
        <span class="kpi-n">${c2.finished ? "Final." : c2.started ? Math.round(elapsed2 * 100) + "% of " + c2.label + " has passed. Dashed mark = projection at this pace." : "Starts " + dueWhen(c2.start) + "."}</span>
      </div>
      <div class="kpi sm">
        <span class="kpi-k">Fixes per AI recap</span>
        <span class="kpi-v tnum">${fixesPer == null ? "—" : fixesPer.toFixed(1)}</span>
        <${Verdict} v=${M.verdicts.corrections} />
        <span class="kpi-n">Success: 1+ per recap. ${M.recaps.filter((r) => r.fixes >= 1).length} of ${M.recaps.length} got one.</span>
      </div>
      <div class="kpi sm">
        <span class="kpi-k">Unprompted shares a week</span>
        <span class="kpi-v tnum">${M.sharesPerWeek.toFixed(1)}</span>
        <${Verdict} v=${M.verdicts.shares} />
        <span class="kpi-n">Photos, links, files and notes. Success: 3+.</span>
      </div>
    </div>

    <section class="dcard"><div class="dcard-h"><b>Student messages per day</b><span class="legend"><span><i class="lgd c1"></i>${c1.label}</span><span><i class="lgd c2"></i>${c2.label}</span></span></div>
      <div class="bars" role="img" aria-label="Messages per day">${days.map((d) => html`<span class="bar-w" key=${d.t} title=${F.wmd.format(d.t) + ": " + d.n}><i class=${(d.c2 ? "c2" : "c1") + (d.future ? " future" : "")} style=${{ height: d.future ? "100%" : Math.max(2, (d.n / maxN) * 100) + "%" }}></i></span>`)}</div>
      <div class="bars-axis"><span>${F.md.format(c1.start)}</span><span>${c2.label} starts ${F.md.format(c2.start)}</span><span>${F.md.format(c2.end)}</span></div></section>

    <section class="dcard"><div class="dcard-h"><b>Who showed up</b></div>
      ${[c1, c2].map((c) => {
        const never = Math.max(0, c.placed - c.opened), tot = Math.max(1, c.placed);
        return html`<div class="split-row" key=${c.id}><span class="split-l">${c.label}${c.started ? "" : html` <small class="muted">not started</small>`}</span>
          <div class="split" role="img" aria-label=${c.label + ": " + c.contributors + " contributed, " + c.lurkers + " read only, " + never + " didn't open"}>
            <i class="s-c" style=${{ width: (c.contributors / tot) * 100 + "%" }}></i><i class="s-r" style=${{ width: (c.lurkers / tot) * 100 + "%" }}></i></div>
          <span class="legend"><span><i class="lgd s-c"></i>Contributed ${c.contributors}</span><span><i class="lgd s-r"></i>Read only ${c.lurkers}</span><span><i class="lgd s-n"></i>Didn't open ${never}</span></span></div>`;
      })}
      <p class="muted sm">GroupMe can't show who read without posting. Roster logs one open per person per day, so readers show up here instead of only in the exit survey.</p></section>

    <section class="dcard"><div class="dcard-h"><b>What “contributed” is made of</b><span class="muted sm">One-tap responses are counted, and shown apart from writing.</span></div>
      <table class="tbl"><thead><tr><th></th>${[c1, c2].map((c) => html`<th class="num">${c.label}</th>`)}</tr></thead><tbody>
        ${WRITE.map(([k, l]) => html`<tr key=${k}><td>${l}</td>${[c1, c2].map((c) => html`<td class="num">${c.byType[k]}</td>`)}</tr>`)}
        <tr class="sub"><td>Light responses</td>${[c1, c2].map((c) => html`<td class="num">${c.light}</td>`)}</tr>
        ${LIGHT.map(([k, l]) => html`<tr key=${k} class="indent"><td>${l}</td>${[c1, c2].map((c) => html`<td class="num">${c.byType[k]}</td>`)}</tr>`)}
        <tr class="sub"><td>Top 3 posters' share</td>${[c1, c2].map((c) => html`<td class="num">${pct(c.top3Share)}</td>`)}</tr>
      </tbody></table>
      <p class="muted sm">If one loud group carries the chat, the top 3 share runs high. People who signed up through a form are more motivated than the average lurker, so treat these numbers as an upper bound.</p></section>

    ${M.recaps.length ? html`<section class="dcard"><div class="dcard-h"><b>Recaps</b></div><table class="tbl"><thead><tr><th>Lecture</th><th class="num">Fixes</th><th class="num">Agreements</th></tr></thead>
      <tbody>${[...M.recaps].sort((a, b) => a.lecture - b.lecture).map((r) => html`<tr key=${r.id}><td>${r.lecture} · ${r.title}</td><td class="num">${r.fixes}</td><td class="num">${r.agrees}</td></tr>`)}</tbody></table></section>` : null}

    <section class="dcard"><div class="dcard-h"><b>Exit survey · ${plural(data.surveys.length, "answer")}</b></div>
      ${data.surveys.length ? html`
        <div class="hbars">${tally("q1", Q1).map(([o, n]) => html`<div class="hbar" key=${o}><span>${o}</span><i style=${{ width: (n / Math.max(1, data.surveys.length)) * 100 + "%" }}></i><b class="tnum">${n}</b></div>`)}</div>
        <p class="muted sm">Replaced: ${tally("q2", Q2).filter(([, n]) => n).map(([o, n]) => o + " " + n).join(" · ") || "nothing yet"}</p>
        ${data.surveys.filter((s) => s.q3).slice(0, 12).map((s, i) => html`<blockquote class="quote-s" key=${i}>${s.q3}</blockquote>`)}`
      : html`<p class="muted sm">The survey card appears on every student's class page once ${c1.label} ends.</p>`}</section>
  </div>`;
}

// ---- recap drafting: stream, then Keep / Edit / Remove per line ----------------------------------
// Demo only: raw notes an organizer might paste, so the drafting flow can be tried end to end.
const EXAMPLE_NOTES = "L10 (example notes)\nIndicator r.v.s again. I_A = 1 if A occurs else 0. E[I_A] = P(A), the fundamental bridge. Slide 4.\nMatching problem: n people, n hats, shuffled. I_j = 1 if person j gets own hat. E[# matches] = n * (1/n) = 1, no matter n. Slide 6.\nLOTUS: E[g(X)] = sum over x of g(x) P(X = x). You don't need the PMF of g(X). Slide 11.\nVariance: Var(X) = E[(X - EX)^2] = E[X^2] - (EX)^2. Slide 14.\nVar(X + c) = Var(X), Var(cX) = c^2 Var(X). Variance is NOT linear in general.\nPoisson preview at the very end, more next time.";
function RecapComposer({ courseId, onDone }) {
  const app = useApp();
  const c = course(app, courseId);
  const [lecture, setLecture] = useState("");
  const [date, setDate] = useState(toLocalInput(Clock.now()));
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [streamN, setStreamN] = useState(0);
  const ctl = useRef(null);
  useEffect(() => {
    app.db.collection("recaps/" + courseId + "/items").get().then((s) => setLecture(String(s.docs.reduce((m, d) => Math.max(m, d.data().lecture || 0), 0) + 1))).catch(() => setLecture("1"));
  }, [courseId]);
  const words = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const draft = async () => {
    if (!app.sample) return;
    ctl.current = new AbortController();
    setBusy(true); setStreamN(0); setLines([]);
    const prompt = "You are drafting a lecture recap for a student-run class group chat for " + c.code + (c.title ? " (" + c.title + ")" : "") + " at Harvard.\n" +
      "Use ONLY the organizer's notes below. Do not add facts, examples or formulas that are not in the notes. Keep the course's own notation exactly as the notes write it, even if other textbooks differ. Write math between $ signs in LaTeX.\n" +
      "Reply with only JSON: {\"title\": short lecture title, \"bullets\": [{\"text\": one plain sentence of at most 30 words, \"ref\": the slide, timestamp or section the notes tie it to, or \"\"}]} with 4 to 6 bullets.\n\nNotes:\n\"\"\"\n" + notes.slice(0, 20000) + "\n\"\"\"";
    try {
      const out = await app.sample.json(prompt, { signal: ctl.current.signal, onText: ({ text }) => setStreamN((text.match(/"text"\s*:/g) || []).length) });
      if (out && Array.isArray(out.bullets)) {
        setLines(out.bullets.slice(0, 8).map((b, i) => ({ id: "b" + (i + 1), text: String(b.text || "").trim(), ref: String(b.ref || "").trim(), st: "new" })).filter((b) => b.text));
        if (!title && out.title) setTitle(String(out.title));
      } else app.toast("Claude's draft didn't come back as a list. Try again or write the lines yourself.");
    } catch (e) {
      if (e && e.code === "cancelled") { /* stopped */ }
      else if (e && (e.code === "not_granted" || e.code === "sampling_disabled")) app.toast("Claude isn't available on this view. Write the lines yourself below.");
      else if (e && e.code === "rate_limited") app.toast("Too many requests right now. Try again in a minute.");
      else app.toast("The draft didn't finish. Try again, or write the lines yourself.");
    }
    setBusy(false);
  };
  const setL = (i, patch) => setLines(lines.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const kept = lines.filter((b) => b.st !== "removed" && b.text.trim());
  const unreviewed = lines.filter((b) => b.st === "new").length;
  const post = async () => {
    const clean = kept.map((b, i) => ({ id: "b" + (i + 1), text: b.text.trim(), ref: (b.ref || "").trim() }));
    const ok = await app.postRecap(courseId, { lecture: Number(lecture) || 1, title: title.trim(), sections: sections.trim(), date: fromLocalInput(date) || Clock.now(), bullets: clean });
    if (ok) onDone();
  };
  const status = busy ? (streamN ? "Drafting line " + (streamN + 1) + "…" : "Reading your notes (" + plural(words, "word") + ")…") : "";
  return html`<div class="dash">
    <div class="field-row four">
      <label class="field"><span>Lecture</span><input class="input" inputmode="numeric" value=${lecture} onInput=${(e) => setLecture(e.target.value)} /></label>
      <label class="field"><span>Date</span><input class="input" type="datetime-local" value=${date} onInput=${(e) => setDate(e.target.value)} /></label>
      <label class="field"><span>Title</span><input class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Expectation & Linearity" /></label>
      <label class="field"><span>Textbook sections</span><input class="input" value=${sections} onInput=${(e) => setSections(e.target.value)} placeholder="§4.1–4.3" /></label>
    </div>
    ${app.demo && !notes ? html`<div class="org-demo"><${Icon} name="note" size=${16} /><span class="grow">Try it with an organizer's raw notes from a lecture.</span><button class="btn sm soft" onClick=${() => setNotes(EXAMPLE_NOTES)}>Use example notes</button></div>` : null}
    <label class="field"><span>Your lecture notes, slide text or transcript <small>${words ? plural(words, "word") : ""}</small></span>
      <textarea class="input" rows="7" value=${notes} onInput=${(e) => setNotes(e.target.value)} placeholder="Paste what you wrote down. Claude drafts only from this, so it can't invent what wasn't said."></textarea></label>
    <div class="row-gap">
      ${app.sample ? html`<button class="btn primary" disabled=${busy || words < 20} onClick=${draft}><${Icon} name="ai" size=${17} />${lines.length ? "Draft again" : "Draft with Claude"}</button>` : html`<span class="muted sm">Claude isn't available on this view. Write the lines yourself.</span>`}
      ${busy ? html`<button class="btn ghost" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button><span class="shimmer">${status}</span>` : null}
      <button class="btn ghost" onClick=${() => setLines([...lines, { id: "b" + (lines.length + 1), text: "", ref: "", st: "edit" }])}><${Icon} name="plus" size=${17} />Add a line</button>
    </div>
    ${lines.length ? html`<section class="dcard"><div class="dcard-h"><b>Check every line against your notes</b><span class="muted sm">${unreviewed ? unreviewed + " to review" : "All reviewed"}</span></div>
      <ol class="draftlist">${lines.map((b, i) => html`<li key=${b.id + i} class=${"dl " + b.st}>
        ${b.st === "edit" ? html`<div class="dl-edit"><textarea class="input" rows="2" value=${b.text} onInput=${(e) => setL(i, { text: e.target.value })} aria-label=${"Line " + (i + 1)} autofocus></textarea>
            <input class="input" value=${b.ref} onInput=${(e) => setL(i, { ref: e.target.value })} placeholder="Slide 14" aria-label="Reference" /></div>`
          : html`<div class="dl-t"><span class="recap-text"><${RichText} text=${b.text} /></span>${b.ref ? html`<span class="srcchip">${b.ref}</span>` : null}</div>`}
        <div class="dl-acts">
          ${b.st === "edit" ? html`<button class="yn on" onClick=${() => setL(i, { st: "kept" })}>Done</button>`
            : b.st === "removed" ? html`<button class="yn" onClick=${() => setL(i, { st: "new" })}>Undo</button>`
            : html`<button class=${"yn" + (b.st === "kept" ? " on" : "")} onClick=${() => setL(i, { st: "kept" })}><${Icon} name="check" size=${14} />Keep</button><button class="yn" onClick=${() => setL(i, { st: "edit" })}><${Icon} name="edit" size=${14} />Edit</button><button class="yn" onClick=${() => setL(i, { st: "removed" })}><${Icon} name="x" size=${14} />Remove</button>`}
        </div></li>`)}</ol></section>` : null}
    <div class="row-end"><span class="muted sm grow">${kept.length ? plural(kept.length, "line") + " will post, marked as an AI draft." : ""}</span>
      <button class="btn primary" disabled=${!title.trim() || !kept.length || unreviewed > 0} onClick=${post}>${unreviewed ? "Review " + plural(unreviewed, "line") + " first" : "Post recap to " + c.code}</button></div>
  </div>`;
}

function HubEditor({ courseId }) {
  const app = useApp();
  const hub = useDocData(() => app.db.doc("hub/" + courseId), [courseId]);
  const threads = useCollection(() => app.db.collection("courses/" + courseId + "/threads"), [courseId]);
  const [form, setForm] = useState(null);
  const [newT, setNewT] = useState({ title: "", due: "", problems: "" });
  useEffect(() => {
    if (hub === null || form) return;
    const h = hub || {};
    const def = Clock.now();
    setForm({
      due: (h.due || []).map((d) => ({ ...d, at: toLocalInput(d.at) })),
      cycles: (h.cycles && h.cycles.length ? h.cycles : [{ id: "c1", label: "PSet 1", start: def, end: def + 7 * 864e5 }, { id: "c2", label: "PSet 2", start: def + 7 * 864e5, end: def + 14 * 864e5 }]).map((c) => ({ ...c, start: toLocalInput(c.start), end: toLocalInput(c.end) })),
      rules: (h.rules || ["Collaboration follows the course syllabus: talk through ideas, write up your own solutions.", "No posting solutions or answers to graded problems.", "This chat is run by a student. Course staff are not in it."]).join("\n"),
      links: (h.links || []).map((l) => l.title + " | " + l.url).join("\n"),
    });
  }, [hub]);
  if (!form) return html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>`;
  const upd = (k, i, f, v) => setForm({ ...form, [k]: form[k].map((x, j) => (j === i ? { ...x, [f]: v } : x)) });
  const save = async () => {
    const data = {
      ...(hub || {}),
      due: form.due.filter((d) => d.title.trim() && d.at).map((d, i) => ({ id: d.id || "d" + Date.now().toString(36) + i, title: d.title.trim(), at: fromLocalInput(d.at), where: (d.where || "").trim() })),
      cycles: form.cycles.map((c, i) => ({ id: "c" + (i + 1), label: c.label.trim() || "Cycle " + (i + 1), start: fromLocalInput(c.start), end: fromLocalInput(c.end) })),
      rules: form.rules.split("\n").map((s) => s.trim()).filter(Boolean),
      links: form.links.split("\n").map((s) => s.split("|")).filter((p) => p.length >= 2 && /^https?:\/\//.test(p.slice(1).join("|").trim())).map((p, i) => ({ id: "l" + i, title: p[0].trim(), url: p.slice(1).join("|").trim() })),
    };
    delete data.id;
    await app.write(() => app.db.doc("hub/" + courseId).set(data), "Saved. Everyone in the class sees the new dates.");
  };
  const addThread = async () => {
    const due = fromLocalInput(newT.due);
    const id = (newT.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || "pset") + "-" + Date.now().toString(36).slice(-4);
    const ok = await app.write(() => app.db.doc("courses/" + courseId + "/threads/" + id).set({ title: newT.title.trim(), kind: "pset", due, problems: newT.problems.split(/[,\s]+/).map((s) => s.trim().toLowerCase().replace(/[()]/g, "")).filter(Boolean), ts: Clock.now(), by: app.uid }), "PSet board added.");
    if (ok) setNewT({ title: "", due: "", problems: "" });
  };
  return html`<div class="dash">
    <section class="dcard"><div class="dcard-h"><b>Pinned due dates</b></div>
      ${form.due.map((d, i) => html`<div class="erow" key=${i}>
        <input class="input" value=${d.title} placeholder="PSet 5" onInput=${(e) => upd("due", i, "title", e.target.value)} aria-label="Title" />
        <input class="input" type="datetime-local" value=${d.at} onInput=${(e) => upd("due", i, "at", e.target.value)} aria-label="Due" />
        <input class="input" value=${d.where || ""} placeholder="Gradescope" onInput=${(e) => upd("due", i, "where", e.target.value)} aria-label="Where" />
        <button class="iconbtn sm" onClick=${() => setForm({ ...form, due: form.due.filter((_, j) => j !== i) })} aria-label="Remove"><${Icon} name="x" size=${16} /></button></div>`)}
      <button class="btn sm ghost" onClick=${() => setForm({ ...form, due: [...form.due, { title: "", at: "", where: "" }] })}><${Icon} name="plus" size=${15} />Add a date</button></section>
    <section class="dcard"><div class="dcard-h"><b>Experiment cycles</b><span class="muted sm">Cycle 1 = the first full pset after placement; cycle 2 = the next, with no prompting. Avoid midterm week.</span></div>
      ${form.cycles.map((c, i) => html`<div class="erow three" key=${i}>
        <input class="input" value=${c.label} onInput=${(e) => upd("cycles", i, "label", e.target.value)} aria-label=${"Cycle " + (i + 1) + " label"} />
        <input class="input" type="datetime-local" value=${c.start} onInput=${(e) => upd("cycles", i, "start", e.target.value)} aria-label="Start" />
        <input class="input" type="datetime-local" value=${c.end} onInput=${(e) => upd("cycles", i, "end", e.target.value)} aria-label="End" /></div>`)}</section>
    <div class="field-row">
      <label class="field"><span>Pinned rules, one per line</span><textarea class="input" rows="4" value=${form.rules} onInput=${(e) => setForm({ ...form, rules: e.target.value })}></textarea></label>
      <label class="field"><span>Links: “Title | https://…”</span><textarea class="input" rows="4" value=${form.links} onInput=${(e) => setForm({ ...form, links: e.target.value })} placeholder="Course site | https://stat110.hsites.harvard.edu"></textarea></label>
    </div>
    <div class="row-end"><button class="btn primary" onClick=${save}>Save dates & cycles</button></div>
    <section class="dcard"><div class="dcard-h"><b>PSet boards</b></div>
      ${(threads || []).sort((a, b) => (a.due || 0) - (b.due || 0)).map((t) => html`<div class="setrow static" key=${t.id}><span class="grow"><b>${t.title}</b><small> · due ${t.due ? dueWhen(t.due) : "—"} · ${(t.problems || []).map(prettyProblem).join(", ")}</small></span></div>`)}
      <div class="erow">
        <input class="input" value=${newT.title} placeholder="PSet 6" onInput=${(e) => setNewT({ ...newT, title: e.target.value })} aria-label="PSet title" />
        <input class="input" type="datetime-local" value=${newT.due} onInput=${(e) => setNewT({ ...newT, due: e.target.value })} aria-label="Due" />
        <input class="input" value=${newT.problems} placeholder="1, 2, 3a, 3b, 4" onInput=${(e) => setNewT({ ...newT, problems: e.target.value })} aria-label="Problems" />
        <button class="btn sm primary" disabled=${!newT.title.trim() || !newT.due} onClick=${addThread}>Add</button></div></section>
  </div>`;
}

// ---- placement: pick people from the organization's directory (user.search) -------------------
function Placement({ courseId }) {
  const app = useApp();
  return app.web ? html`<${WebPlacement} courseId=${courseId} />` : html`<${DirectoryPlacement} courseId=${courseId} />`;
}
function DirectoryPlacement({ courseId }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [picked, setPicked] = useState([]);
  const [also, setAlso] = useState([]);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const existing = useCollection(() => app.db.collection("placements"), [app.db]) || [];
  const placedHere = existing.filter((p) => (p.courses || []).includes(courseId));
  const others = app.myCourses.filter((c) => Catalog.isCourse(c) && c !== courseId);
  const search = async (v) => {
    setQ(v); setDone(null);
    if (app.demo) { const t = v.trim().toLowerCase(); setHits(t ? Object.entries(Demo.people).filter(([, p]) => p.name.toLowerCase().includes(t)).slice(0, 8).map(([id, p]) => ({ id, name: p.name, avatarUrl: "" })) : []); return; }
    if (!app.rt.user) return;
    const r = await app.rt.user.search(v);
    setHits((r || []).filter((p) => !p.isMe));
  };
  const toggle = (p) => setPicked(picked.some((x) => x.id === p.id) ? picked.filter((x) => x.id !== p.id) : [...picked, p]);
  const go = async () => {
    setBusy(true);
    const n = await app.placePeople(picked.map((p) => p.id), [courseId, ...also]);
    setBusy(false); setDone(n);
    if (n) setPicked([]);
  };
  return html`<div class="dash">
    <p class="lead">Pick the students who signed up. The next time they open Roster, they start already placed in ${course(app, courseId).code}${also.length ? " and " + also.map((c) => course(app, c).code).join(", ") : ""}: no link to find.</p>
    <div class="searchwrap"><${Icon} name="search" size=${18} /><input class="grow" placeholder="Search people by name" value=${q} onInput=${(e) => search(e.target.value)} onFocus=${() => !q && search("")} aria-label="Search people" /></div>
    ${hits.length ? html`<div class="group">${hits.map((p) => {
      const on = picked.some((x) => x.id === p.id), already = placedHere.some((x) => x.id === p.id);
      return html`<div class="prow static" key=${p.id}>${p.avatarUrl ? html`<img class="av" style=${{ width: "36px", height: "36px" }} src=${p.avatarUrl} alt="" />` : html`<${Avatar} uid=${p.id} size=${36} name=${p.name} />`}
        <span class="grow prow-t"><b>${p.name}</b>${p.guest ? html`<small>Guest</small>` : already ? html`<small>Already placed here</small>` : null}</span>
        <button class=${"btn sm " + (on ? "ghost" : "primary")} disabled=${already} onClick=${() => toggle(p)}>${on ? html`<${Icon} name="check" size=${15} />Picked` : "Pick"}</button></div>`;
    })}</div>` : q.trim() ? html`<p class="muted sm">No one in your organization matches “${q.trim()}”.</p>` : null}
    ${picked.length ? html`<div class="picked">${picked.map((p) => html`<span class="pickchip" key=${p.id}><${Avatar} uid=${p.id} size=${22} name=${p.name} />${p.name}<button onClick=${() => toggle(p)} aria-label=${"Remove " + p.name}><${Icon} name="x" size=${14} /></button></span>`)}</div>` : null}
    ${others.length ? html`<div class="field"><span>Also place them in</span><div class="chips">${others.map((c) => html`<button key=${c} class=${"chip" + (also.includes(c) ? " on" : "")} onClick=${() => setAlso(also.includes(c) ? also.filter((x) => x !== c) : [...also, c])}>${course(app, c).code}</button>`)}</div></div>` : null}
    <div class="row-end"><span class="muted sm grow">${placedHere.length ? plural(placedHere.length, "person", "people") + " placed in " + course(app, courseId).code + " so far." : "No one placed yet."}${app.demo ? " Demo: nothing leaves this browser." : ""}</span>
      <button class="btn primary" disabled=${!picked.length || busy} onClick=${go}>${busy ? "Placing…" : "Place " + plural(picked.length, "person", "people")}</button></div>
    ${done != null ? html`<div class=${"ob-banner" + (done ? "" : " warn")}><${Icon} name=${done ? "checkCircle" : "warning"} size=${18} />${done ? "Placed " + plural(done, "person", "people") + "." : "Nothing was placed."}</div>` : null}
    <p class="muted sm">Placing someone doesn't share the class with them. Share this page with them too (as a contributor) so they can open it.</p>
  </div>`;
}


// Web build: one personal link per student (?p=…). Opening it lands them in the class chat,
// already placed; the same link works on their other devices.
function WebPlacement({ courseId }) {
  const app = useApp();
  const code = course(app, courseId).code;
  const [text, setText] = useState("");
  const [also, setAlso] = useState([]);
  const [busy, setBusy] = useState(false);
  const [olink, setOlink] = useState(null);
  const list = (useCollection(() => app.db.collection("placements"), [app.db]) || []).filter((p) => (p.courses || []).includes(courseId)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const others = app.myCourses.filter((c) => Catalog.isCourse(c) && c !== courseId);
  const people = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [n, ...rest] = l.split(/[,\t]/); return { name: n.trim(), contact: rest.join(",").trim() }; }).filter((p) => p.name);
  const link = (t) => app.rt.remote.placementLink(t);
  const copy = (txt, msg) => navigator.clipboard.writeText(txt).then(() => app.toast(msg || "Copied"), () => app.toast("Copy isn't available here. Select the text instead."));
  const message = (p) => "Hi " + firstName(p.name) + "! You're in the " + code + " class chat on Roster. Open your link and you're in, no group link to find: " + link(p.id);
  const joined = list.filter((p) => p.claimedBy).length;
  const create = async () => {
    setBusy(true);
    const r = await app.createPlacements(people, [courseId, ...also]);
    setBusy(false);
    if (r) { setText(""); app.toast(plural(r.length, "link") + " created. Send each student their own."); }
  };
  return html`<div class="dash">
    <p class="lead">This is the placement in your research question. Each student gets a personal link that opens straight into ${code}${also.length ? " and " + also.map((c) => course(app, c).code).join(", ") : ""}. No group link to find, no account to make.</p>
    <label class="field"><span>Students, one per line <small>Name, or Name, email</small></span>
      <textarea class="input mono" rows="5" value=${text} onInput=${(e) => setText(e.target.value)} placeholder=${"Priya Raman, priya_raman@college.harvard.edu\nDev Patel"}></textarea></label>
    ${others.length ? html`<div class="field"><span>Also place them in</span><div class="chips">${others.map((c) => html`<button key=${c} class=${"chip" + (also.includes(c) ? " on" : "")} onClick=${() => setAlso(also.includes(c) ? also.filter((x) => x !== c) : [...also, c])}>${course(app, c).code}</button>`)}</div></div>` : null}
    <div class="row-end"><span class="muted sm grow">Send each person their own link (email, text or DM). Don't post the links in a group.</span>
      <button class="btn primary" disabled=${!people.length || busy} onClick=${create}>${busy ? "Creating…" : "Create " + plural(people.length, "link")}</button></div>
    <section class="dcard"><div class="dcard-h"><b>Placement links · ${list.length}</b><span class="muted sm">${joined} of ${list.length} joined</span>
      ${list.length ? html`<button class="btn sm ghost" onClick=${() => copy(list.map((p) => [p.name, p.contact, link(p.id)].filter(Boolean).join("\t")).join("\n"), "All links copied (name, contact, link)")}><${Icon} name="copy" size=${15} />Copy all</button>` : null}</div>
      ${list.length ? list.map((p) => html`<div class="plrow" key=${p.id}>
        <span class="grow prow-t"><b>${p.name}</b><small>${p.contact || link(p.id).replace(/^https?:\/\//, "")}</small></span>
        <span class=${"pill sm " + (p.claimedBy ? "ok" : "")}>${p.claimedBy ? "Joined" : "Not yet"}</span>
        <button class="btn sm ghost" onClick=${() => copy(message(p), "Message with " + firstName(p.name) + "'s link copied")}>Copy message</button>
        <button class="iconbtn sm" onClick=${() => copy(link(p.id), "Link copied")} aria-label=${"Copy " + p.name + "'s link"}><${Icon} name="link" size=${16} /></button></div>`)
      : html`<p class="muted sm">No one placed in ${code} yet.</p>`}</section>
    <section class="dcard"><div class="dcard-h"><b>Your organizer link</b></div>
      <p class="muted sm">Open it on another device or browser to be the organizer there. Keep it private: anyone with it can run this class.</p>
      ${olink ? html`<div class="olink"><code>${olink}</code><button class="btn sm soft" onClick=${() => copy(olink, "Organizer link copied")}>Copy</button></div>`
        : html`<button class="btn sm ghost" onClick=${async () => { try { setOlink(await app.rt.remote.organizerLink()); } catch (e) { app.toast(errCopy(e)); } }}><${Icon} name="eye" size=${15} />Show my organizer link</button>`}</section>
  </div>`;
}

function Moderation({ courseId }) {
  const app = useApp();
  const all = useCollection(() => app.db.collection("reports"), [app.db]);
  const items = (all || []).flatMap((d) => Object.entries(d.items || {}).map(([id, r]) => ({ ...r, id, reporter: d.id }))).filter((r) => r.cid === courseId || r.cid === "board" || r.cid === "person").sort((a, b) => b.ts - a.ts);
  const open = items.filter((r) => r.status !== "closed" && r.status !== "removed");
  const hidden = (app.feeds[courseId] || []).filter((m) => m.hidden);
  const removeIt = async (r) => {
    if (r.cid === "board") await app.deleteBoard({ id: r.mid });
    else if (r.cid !== "person") { const m = (app.feeds[r.cid] || []).find((x) => x.id === r.mid); if (m && !m.hidden) await app.hideMsg(r.cid, m); }
    await app.resolveReport(r.reporter, r.id, "removed");
  };
  return html`<div class="dash">
    ${all === null ? html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>` : null}
    <section class="dcard"><div class="dcard-h"><b>Open reports · ${open.length}</b><span class="muted sm">Reporters are anonymous to the people they report.</span></div>
      ${open.length ? open.map((r) => html`<div class="report" key=${r.reporter + r.id}>
        <div class="report-h"><span class="pill warn sm">${r.reason}</span><span class="muted sm grow">${r.cid === "board" ? "Board post" : r.cid === "person" ? "Profile" : course(app, r.cid).code} · ${relShort(r.ts)}</span></div>
        <div class="report-who"><${Avatar} uid=${r.author} size=${24} /><b>${app.person(r.author).name}</b></div>
        ${r.text ? html`<blockquote class="rep-q">${r.text}</blockquote>` : null}${r.note ? html`<p class="muted sm">“${r.note}”</p>` : null}
        <div class="row-gap">${r.cid !== "person" ? html`<button class="btn sm danger" onClick=${() => removeIt(r)}>Remove for everyone</button>` : null}<button class="btn sm ghost" onClick=${() => app.resolveReport(r.reporter, r.id, "closed")}>Keep it up</button>
          ${r.cid !== "board" && r.cid !== "person" ? html`<button class="btn sm ghost" onClick=${() => app.openCourse(r.cid, "chat", r.mid)}>See in chat</button>` : null}</div>
      </div>`) : html`<p class="muted sm">No open reports.</p>`}</section>
    ${hidden.length ? html`<section class="dcard"><div class="dcard-h"><b>Removed messages · ${hidden.length}</b></div>${hidden.map((m) => html`<div class="setrow static" key=${m.id}><${Avatar} uid=${m.by} size=${24} /><span class="grow">${(m.text || "Photo").slice(0, 90)}</span><button class="btn sm ghost" onClick=${() => app.hideMsg(courseId, m)}>Restore</button></div>`)}</section>` : null}
  </div>`;
}

function Announcer({ courseId }) {
  const app = useApp();
  const [text, setText] = useState("");
  const past = (app.feeds[courseId] || []).filter((m) => m.kind === "announce").reverse();
  const post = async () => { const ok = await app.announce(courseId, text.trim()); if (ok) setText(""); };
  return html`<div class="dash">
    <p class="muted sm">Announcements are for logistics: a moved review session, a changed due date. They sit in the chat with a megaphone and show in everyone's Activity. Use them rarely; the research question is about what students do on their own.</p>
    <label class="field"><span>Announcement</span><textarea class="input" rows="3" maxlength="400" value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Midterm review moved to Science Center Hall C."></textarea></label>
    <div class="row-end"><button class="btn primary" disabled=${!text.trim()} onClick=${post}><${Icon} name="megaphone" size=${16} />Post to ${course(app, courseId).code}</button></div>
    ${past.length ? html`<section class="dcard"><div class="dcard-h"><b>Posted</b></div>${past.map((m) => html`<div class="setrow static" key=${m.id}><span class="grow">${m.text}</span><small class="muted">${relShort(m.ts)}</small></div>`)}</section>` : null}
  </div>`;
}

function Exporter({ courseId }) {
  const app = useApp();
  const [data] = useCourseLog(courseId);
  if (!data) return html`<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>`;
  const cycles = (data.hub && data.hub.cycles) || [];
  const csv = Metrics.csv({ courseId, members: data.members, messages: data.messages, fixes: data.fixes, cycles, organizerIds: app.organizerIds, checks: data.checks, stuck: data.stuck, notes: data.notes });
  const summary = Metrics.compute({ courseId, members: data.members, messages: data.messages, fixes: data.fixes, checks: data.checks, recaps: data.recaps, cycles, organizerIds: app.organizerIds, now: Clock.now(), stuck: data.stuck, notes: data.notes });
  const rows = csv.split("\n");
  const save = async (filename, body) => {
    if (!app.downloads) { app.toast("Downloads aren't available here. Copy the text below instead."); return; }
    try { await app.downloads.save({ filename, data: body }); }
    catch (e) { if (!e || e.code !== "declined") app.toast("The file couldn't be saved here."); }
  };
  const code = course(app, courseId).code.replace(/\s+/g, "").toLowerCase();
  return html`<div class="dash">
    <p class="muted sm">No names and no message text: every student is a stable alias (S001…), the organizer is ORGANIZER. Enough to recompute every number in the write-up.</p>
    <div class="row-gap">
      <button class="btn primary" onClick=${() => save("roster-" + code + "-log.csv", csv)}><${Icon} name="download" size=${17} />Event log · CSV · ${(rows.length - 1).toLocaleString()} rows</button>
      <button class="btn ghost" onClick=${() => save("roster-" + code + "-results.json", JSON.stringify(summary, null, 2))}><${Icon} name="download" size=${17} />Results · JSON</button>
    </div>
    <div class="tblwrap"><table class="tbl mono"><thead><tr>${rows[0].split(",").map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.slice(-8).map((r, i) => html`<tr key=${i}>${r.split(",").map((v) => html`<td>${v}</td>`)}</tr>`)}</tbody></table></div>
    <label class="field"><span>Or copy it</span><textarea class="input mono" rows="5" readonly value=${csv}></textarea></label>
  </div>`;
}
