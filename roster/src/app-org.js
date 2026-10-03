// ---------------------------------------------------------------------------
// Organizer tools: experiment results (the 2a research question, measured
// from the log), AI recap drafting with Claude, hub/cycle editing, export.
// ---------------------------------------------------------------------------
const pct = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
const VERDICT = { success: "Success line met", revise: "Between the lines — revise", kill: "Below the kill line", pending: "Not measurable yet" };

function OrganizerModal({ courseId, initialTab, onClose }) {
  const app = useApp();
  const [tab, setTab] = useState(initialTab || "results");
  const c = Catalog.get(courseId, app.customCourses);
  return html`<${Modal} wide title=${"Organizer tools · " + c.code} icon="chart" onClose=${onClose}>
    <div class="seg-ctl" role="tablist" style=${{ justifySelf: "start", flexWrap: "wrap" }}>
      ${[["results", "Results"], ["recap", "Post a recap"], ["hub", "Dates & cycles"], ["export", "Export"]].map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${l}</button>`)}
    </div>
    ${app.demo ? html`<div class="banner" style=${{ borderRadius: "12px", border: "0" }}><span class="grow">Demo data: example classmates in a simulated ${c.code} chat, one pset cycle after placement. In the live class these numbers come from real activity.</span></div>` : null}
    ${tab === "results" ? html`<${Results} courseId=${courseId} />` : null}
    ${tab === "recap" ? html`<${RecapComposer} courseId=${courseId} onDone=${onClose} />` : null}
    ${tab === "hub" ? html`<${HubEditor} courseId=${courseId} />` : null}
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
      safe(app.db.collection("courses/" + courseId + "/messages").orderBy("ts", "asc").limit(1000).get()),
      safe(app.db.collection("courses/" + courseId + "/fixes").get()),
      safe(app.db.collection("courses/" + courseId + "/checks").limit(1000).get()),
      safe(app.db.collection("recaps/" + courseId + "/items").get()),
      safe(app.db.collection("members").get()),
      safe(app.db.collection("survey").get()),
      app.db.doc("hub/" + courseId).get().then((s) => (s.exists ? s.data() : {})).catch(() => ({})),
    ]).then(([messages, fixes, checks, recaps, members, surveys, hub]) => {
      if (alive) setData({ messages, fixes, checks, recaps, members, surveys: surveys.filter((s) => s.course === courseId), hub });
    });
    return () => { alive = false; };
  }, [courseId, n]);
  return [data, () => setN((x) => x + 1)];
}

function Thresh({ v, kill, ok, proj }) {
  const w = (x) => Math.max(0, Math.min(100, x * 100)) + "%";
  return html`<div class="thresh" aria-hidden="true">
    ${proj != null ? html`<div class="fill proj" style=${{ width: w(proj) }}></div>` : null}
    ${v != null ? html`<div class="fill" style=${{ width: w(v) }}></div>` : null}
    <div class="mark kill" style=${{ left: w(kill) }}><span>kill ${Math.round(kill * 100)}%</span></div>
    <div class="mark ok" style=${{ left: w(ok) }}><span>success ${Math.round(ok * 100)}%</span></div>
  </div>`;
}

function Results({ courseId }) {
  const app = useApp();
  const [data, refresh] = useCourseLog(courseId);
  if (!data) return html`<div class="muted">Reading the chat log…</div>`;
  const cycles = (data.hub && data.hub.cycles) || [];
  if (cycles.length < 2) return html`<div class="empty"><div class="big emo">🧪</div><h3>Set your two pset cycles first</h3><p>The research question compares cycle 1 with cycle 2. Add both under “Dates & cycles”.</p></div>`;
  const M = Metrics.compute({ courseId, members: data.members, messages: data.messages, fixes: data.fixes, checks: data.checks, recaps: data.recaps, cycles, organizerIds: app.organizerIds, now: Clock.now() });
  const [c1, c2] = M.cycles;
  const elapsed2 = c2.started ? Math.min(1, (Clock.now() - c2.start) / (c2.end - c2.start)) : 0;
  const pace = c2.started && !c2.finished && c1.studentMsgs && elapsed2 > 0.02 ? c2.studentMsgs / elapsed2 / c1.studentMsgs : null;

  // messages per day across both cycles
  const days = [];
  for (let t = c1.start; t < c2.end; t += 864e5) days.push({ t, n: 0, c2: t >= c2.start, future: t > Clock.now() });
  const org = new Set(app.organizerIds);
  for (const m of data.messages) {
    if (!m.by || org.has(m.by) || m.kind !== "text" || m.deleted) continue;
    const i = Math.floor((m.ts - c1.start) / 864e5);
    if (i >= 0 && i < days.length) days[i].n++;
  }
  const maxN = Math.max(1, ...days.map((d) => d.n));

  const tally = (key, opts) => opts.map((o) => [o, data.surveys.filter((s) => (Array.isArray(s[key]) ? s[key].includes(o) : s[key] === o)).length]);

  return html`<div class="dash">
    <div style=${{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
      <div style=${{ flex: 1, minWidth: "240px" }}><b>Do placed students talk, and keep talking?</b><div class="muted" style=${{ fontSize: "13px" }}>${M.placed} students placed in ${Catalog.get(courseId, app.customCourses).code}. ${c1.label}: ${F.md.format(c1.start)}–${F.md.format(c1.end)} · ${c2.label}: ${F.md.format(c2.start)}–${F.md.format(c2.end)}. Organizer activity excluded.</div></div>
      <button class="btn btn-ghost btn-sm" onClick=${refresh}><${Icon} name="history" size=${16} />Refresh</button>
    </div>
    <div class="dash-verdicts">
      <div class="card metric">
        <span class="k">Posted, replied or reacted in ${c1.label}</span>
        <span class="v">${pct(c1.rate)}<small>${c1.contributors} of ${c1.placed}</small></span>
        <${Thresh} v=${c1.rate} kill=${0.15} ok=${0.35} />
        <span class=${"verdict " + M.verdicts.contribution}>${c1.finished ? VERDICT[M.verdicts.contribution] : c1.started ? "In progress · " + VERDICT[M.verdicts.contribution].toLowerCase() : VERDICT.pending}</span>
      </div>
      <div class="card metric">
        <span class="k">${c2.label} messages as a share of ${c1.label}</span>
        <span class="v">${pct(M.retention)}<small>${c2.studentMsgs} vs ${c1.studentMsgs}</small></span>
        <${Thresh} v=${M.retention} proj=${pace} kill=${0.25} ok=${0.5} />
        <span class=${"verdict " + (c2.finished ? M.verdicts.retention : pace == null ? "pending" : pace >= 0.5 ? "success" : pace < 0.25 ? "kill" : "revise")}>${c2.finished ? VERDICT[M.verdicts.retention] : pace != null ? "On pace for " + pct(pace) + " · " + Math.round(elapsed2 * 100) + "% of the cycle gone" : VERDICT.pending}</span>
      </div>
      <div class="card metric">
        <span class="k">Fixes to AI recaps (side signal)</span>
        <span class="v">${M.recaps.length ? (M.recaps.reduce((a, r) => a + r.fixes, 0) / M.recaps.length).toFixed(1) : "—"}<small>per recap</small></span>
        <span class="note">Success: at least 1 per recap. ${M.recaps.filter((r) => r.fixes >= 1).length} of ${M.recaps.length} recaps got one.</span>
        <span class=${"verdict " + M.verdicts.corrections}>${VERDICT[M.verdicts.corrections]}</span>
      </div>
      <div class="card metric">
        <span class="k">Unprompted shares: notes, photos, links</span>
        <span class="v">${M.sharesPerWeek.toFixed(1)}<small>a week</small></span>
        <span class="note">Success: at least 3 a week.</span>
        <span class=${"verdict " + M.verdicts.shares}>${VERDICT[M.verdicts.shares]}</span>
      </div>
    </div>

    <div class="card card-pad" style=${{ display: "grid", gap: "10px" }}>
      <b>Who showed up</b>
      ${[c1, c2].map((c) => {
        const never = Math.max(0, c.placed - c.opened);
        const contrib = c.contributors, silent = c.lurkers;
        const tot = Math.max(1, c.placed);
        return html`<div style=${{ display: "grid", gap: "6px" }}>
          <div style=${{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><b>${c.label}</b><span class="muted">${c.started ? "" : "not started"}</span></div>
          <div class="split" role="img" aria-label=${c.label + ": " + contrib + " contributed, " + silent + " read only, " + never + " never opened"}>
            <i style=${{ width: (contrib / tot) * 100 + "%", background: "var(--accent)" }}></i>
            <i style=${{ width: (silent / tot) * 100 + "%", background: "var(--amber)" }}></i>
          </div>
          <div class="legend"><span><i style=${{ background: "var(--accent)" }}></i>Contributed ${contrib}</span><span><i style=${{ background: "var(--amber)" }}></i>Opened, never contributed ${silent}</span><span><i style=${{ background: "var(--line)" }}></i>Didn't open ${never}</span></div>
        </div>`;
      })}
      <div class="muted" style=${{ fontSize: "12.5px" }}>GroupMe can't show who read without posting. Roster logs one open per person per day, so lurkers show up here instead of only in the exit survey.</div>
    </div>

    <div class="card card-pad">
      <b>Student messages per day</b>
      <div class="bars" role="img" aria-label="Messages per day">${days.map((d) => html`<i class=${(d.c2 ? "c2" : "") + (d.future ? " future" : "")} title=${F.md.format(d.t) + ": " + d.n} style=${{ height: Math.max(2, (d.n / maxN) * 100) + "%" }}></i>`)}</div>
      <div class="bars-axis"><span>${F.md.format(c1.start)}</span><span>${c2.label} starts ${F.md.format(c2.start)}</span><span>${F.md.format(c2.end)}</span></div>
    </div>

    <div class="card table-wrap">
      <table>
        <thead><tr><th>Per cycle</th><th class="num">Placed</th><th class="num">Opened</th><th class="num">Contributed</th><th class="num">Posters</th><th class="num">Messages</th><th class="num">Reactions</th><th class="num">Fixes</th><th class="num">Top 3 share</th></tr></thead>
        <tbody>${[c1, c2].map((c) => html`<tr><td><b>${c.label}</b></td><td class="num">${c.placed}</td><td class="num">${c.readers}</td><td class="num">${c.contributors}</td><td class="num">${c.posters}</td><td class="num">${c.studentMsgs}</td><td class="num">${c.byType.react}</td><td class="num">${c.byType.fix}</td><td class="num">${pct(c.top3Share)}</td></tr>`)}</tbody>
      </table>
    </div>
    <div class="muted" style=${{ fontSize: "12.5px" }}>“Top 3 share” checks whether one loud group carries the chat: the share of messages written by the three most active students. Each student counts once per cycle toward the contribution rate. People who signed up through a form are more motivated than the average lurker, so treat these numbers as an upper bound.</div>

    ${M.recaps.length ? html`<div class="card table-wrap"><table>
      <thead><tr><th>Recap</th><th class="num">Fixes</th><th class="num">Agreements</th></tr></thead>
      <tbody>${M.recaps.sort((a, b) => a.lecture - b.lecture).map((r) => html`<tr><td>Lecture ${r.lecture} · ${r.title}</td><td class="num">${r.fixes}</td><td class="num">${r.agrees}</td></tr>`)}</tbody>
    </table></div>` : null}

    <div class="card card-pad" style=${{ display: "grid", gap: "8px" }}>
      <b>Exit survey · ${data.surveys.length} ${data.surveys.length === 1 ? "answer" : "answers"}</b>
      ${data.surveys.length ? html`
        <div class="legend">${tally("q1", Q1).map(([o, n]) => html`<span>${o}: <b>${n}</b></span>`)}</div>
        <div class="legend">Replaced: ${tally("q2", Q2).filter(([, n]) => n).map(([o, n]) => html`<span>${o}: <b>${n}</b></span>`)}</div>
        ${data.surveys.filter((s) => s.q3).slice(0, 12).map((s) => html`<div class="sysline" style=${{ alignSelf: "start", textAlign: "left", borderRadius: "12px" }}>“${s.q3}”</div>`)}`
      : html`<div class="muted" style=${{ fontSize: "13px" }}>The survey card appears in the hub for every student once ${c1.label} ends.</div>`}
    </div>
  </div>`;
}

function RecapComposer({ courseId, onDone }) {
  const app = useApp();
  const c = Catalog.get(courseId, app.customCourses);
  const [lecture, setLecture] = useState("");
  const [date, setDate] = useState(toLocalInput(Clock.now()));
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState("");
  const [notes, setNotes] = useState("");
  const [bullets, setBullets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState("");
  const ctl = useRef(null);
  useEffect(() => {
    app.db.collection("recaps/" + courseId + "/items").get().then((s) => {
      const n = s.docs.reduce((m, d) => Math.max(m, d.data().lecture || 0), 0);
      setLecture(String(n + 1));
    }).catch(() => setLecture("1"));
  }, [courseId]);

  const draft = async () => {
    if (!app.sample) return;
    ctl.current = new AbortController();
    setBusy(true); setStream("");
    const prompt = "You are drafting a lecture recap for a student-run class group chat for " + c.code + (c.title ? " (" + c.title + ")" : "") + " at Harvard.\n" +
      "Use ONLY the organizer's notes below. Do not add facts, examples or formulas that are not in the notes. Keep the course's own notation and conventions exactly as the notes write them (for example, how a distribution is parameterized), even if other textbooks differ.\n" +
      "Reply with only JSON: {\"title\": short lecture title, \"bullets\": [{\"text\": one plain sentence of at most 30 words, \"ref\": the slide, timestamp or section the notes tie it to, or \"\"}]} with 4 to 6 bullets.\n\nNotes:\n\"\"\"\n" + notes.slice(0, 20000) + "\n\"\"\"";
    try {
      const out = await app.sample.json(prompt, { signal: ctl.current.signal, onText: ({ text }) => setStream(text) });
      if (out && Array.isArray(out.bullets)) {
        setBullets(out.bullets.slice(0, 8).map((b, i) => ({ id: "b" + (i + 1), text: String(b.text || "").trim(), ref: String(b.ref || "").trim() })).filter((b) => b.text));
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
  const setB = (i, k, v) => setBullets(bullets.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const post = async () => {
    const clean = bullets.map((b, i) => ({ id: "b" + (i + 1), text: b.text.trim(), ref: (b.ref || "").trim() })).filter((b) => b.text);
    const ok = await app.postRecap(courseId, { lecture: Number(lecture) || 1, title: title.trim(), sections: sections.trim(), date: fromLocalInput(date) || Clock.now(), bullets: clean });
    if (ok) onDone();
  };
  return html`<div class="dash">
    <div class="grid2">
      <label class="field"><span>Lecture number</span><input id="rc-lecture" class="input" inputmode="numeric" value=${lecture} onInput=${(e) => setLecture(e.target.value)} /></label>
      <label class="field"><span>Lecture date</span><input id="rc-date" class="input" type="datetime-local" value=${date} onInput=${(e) => setDate(e.target.value)} /></label>
      <label class="field"><span>Title</span><input id="rc-title" class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Expectation & Linearity" /></label>
      <label class="field"><span>Textbook sections</span><input id="rc-sections" class="input" value=${sections} onInput=${(e) => setSections(e.target.value)} placeholder="§4.1–4.3" /></label>
    </div>
    <label class="field"><span>Your lecture notes, slide text or transcript</span>
      <textarea id="rc-notes" class="input" rows="7" value=${notes} onInput=${(e) => setNotes(e.target.value)} placeholder="Paste what you wrote down. Claude drafts only from this, so it can't invent what wasn't said."></textarea></label>
    <div style=${{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      ${app.sample ? html`<button class="btn btn-ink" disabled=${busy || notes.trim().length < 40} onClick=${draft}><${Icon} name="ai" size=${18} />${busy ? "Drafting…" : "Draft with Claude"}</button>` : html`<span class="muted" style=${{ fontSize: "13px" }}>Claude isn't available on this view. Write the lines yourself.</span>`}
      ${busy ? html`<button class="btn btn-ghost" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button><span class="shimmer">Claude is drafting from your notes</span>` : null}
      <button class="btn btn-ghost" onClick=${() => setBullets([...bullets, { id: "b" + (bullets.length + 1), text: "", ref: "" }])}><${Icon} name="plus" size=${18} />Add a line</button>
    </div>
    ${busy && stream ? html`<div class="stream">${stream}</div>` : null}
    ${bullets.length ? html`<div class="card card-pad" style=${{ display: "grid", gap: "8px" }}>
      <b>Check every line against your notes before posting</b>
      ${bullets.map((b, i) => html`<div class="draft-bullet" key=${i}>
        <textarea id=${"rc-b-" + i} class="input" rows="2" value=${b.text} onInput=${(e) => setB(i, "text", e.target.value)} aria-label=${"Line " + (i + 1)}></textarea>
        <input id=${"rc-r-" + i} class="input" value=${b.ref} onInput=${(e) => setB(i, "ref", e.target.value)} placeholder="Slide 14" aria-label=${"Reference for line " + (i + 1)} />
        <button class="iconbtn" onClick=${() => setBullets(bullets.filter((_, j) => j !== i))} aria-label=${"Remove line " + (i + 1)}><${Icon} name="x" /></button>
      </div>`)}
    </div>` : null}
    <div style=${{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
      <button class="btn btn-primary" disabled=${!title.trim() || !bullets.some((b) => b.text.trim())} onClick=${post}>Post recap to ${c.code}</button>
    </div>
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
  if (!form) return html`<div class="muted">Loading…</div>`;
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
    const ok = await app.write(() => app.db.doc("courses/" + courseId + "/threads/" + id).set({ title: newT.title.trim(), kind: "pset", due, problems: newT.problems.split(/[,\s]+/).map((s) => s.trim().toLowerCase().replace(/[()]/g, "")).filter(Boolean), ts: Clock.now(), by: app.uid }), "PSet topic added.");
    if (ok) setNewT({ title: "", due: "", problems: "" });
  };
  return html`<div class="dash">
    <div class="card card-pad" style=${{ display: "grid", gap: "10px" }}>
      <b>Pinned dates</b>
      ${form.due.map((d, i) => html`<div class="draft-bullet" style=${{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr) 34px" }} key=${i}>
        <input id=${"due-t-" + i} class="input" value=${d.title} placeholder="PSet 5" onInput=${(e) => upd("due", i, "title", e.target.value)} aria-label="Title" />
        <input id=${"due-a-" + i} class="input" type="datetime-local" value=${d.at} onInput=${(e) => upd("due", i, "at", e.target.value)} aria-label="Due" />
        <input id=${"due-w-" + i} class="input" value=${d.where || ""} placeholder="Gradescope" onInput=${(e) => upd("due", i, "where", e.target.value)} aria-label="Where" />
        <button class="iconbtn" onClick=${() => setForm({ ...form, due: form.due.filter((_, j) => j !== i) })} aria-label="Remove"><${Icon} name="x" /></button>
      </div>`)}
      <button class="btn btn-ghost btn-sm" style=${{ justifySelf: "start" }} onClick=${() => setForm({ ...form, due: [...form.due, { title: "", at: "", where: "" }] })}><${Icon} name="plus" size=${16} />Add a date</button>
    </div>
    <div class="card card-pad" style=${{ display: "grid", gap: "10px" }}>
      <b>Experiment cycles</b>
      <div class="muted" style=${{ fontSize: "13px" }}>Cycle 1 is the first full pset after placement; cycle 2 is the next one, run with no prompting. Avoid midterm week.</div>
      ${form.cycles.map((c, i) => html`<div class="draft-bullet" style=${{ gridTemplateColumns: "minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr)" }} key=${i}>
        <input id=${"cy-l-" + i} class="input" value=${c.label} onInput=${(e) => upd("cycles", i, "label", e.target.value)} aria-label=${"Cycle " + (i + 1) + " label"} />
        <input id=${"cy-s-" + i} class="input" type="datetime-local" value=${c.start} onInput=${(e) => upd("cycles", i, "start", e.target.value)} aria-label="Start" />
        <input id=${"cy-e-" + i} class="input" type="datetime-local" value=${c.end} onInput=${(e) => upd("cycles", i, "end", e.target.value)} aria-label="End" />
      </div>`)}
    </div>
    <div class="grid2">
      <label class="field"><span>Pinned rules, one per line</span><textarea id="hub-rules" class="input" rows="4" value=${form.rules} onInput=${(e) => setForm({ ...form, rules: e.target.value })}></textarea></label>
      <label class="field"><span>Links, one per line as “Title | https://…”</span><textarea id="hub-links" class="input" rows="4" value=${form.links} onInput=${(e) => setForm({ ...form, links: e.target.value })} placeholder="Course site | https://stat110.hsites.harvard.edu"></textarea></label>
    </div>
    <div style=${{ display: "flex", justifyContent: "flex-end" }}><button class="btn btn-primary" onClick=${save}>Save dates & cycles</button></div>
    <div class="card card-pad" style=${{ display: "grid", gap: "10px" }}>
      <b>PSet topics</b>
      ${(threads || []).sort((a, b) => (a.due || 0) - (b.due || 0)).map((t) => html`<div class="muted" style=${{ fontSize: "13.5px" }}><b style=${{ color: "var(--ink)" }}>${t.title}</b> · due ${t.due ? dueWhen(t.due) : "—"} · problems ${(t.problems || []).map(prettyProblem).join(", ")}</div>`)}
      <div class="draft-bullet" style=${{ gridTemplateColumns: "minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr) auto" }}>
        <input id="nt-title" class="input" value=${newT.title} placeholder="PSet 6" onInput=${(e) => setNewT({ ...newT, title: e.target.value })} aria-label="PSet title" />
        <input id="nt-due" class="input" type="datetime-local" value=${newT.due} onInput=${(e) => setNewT({ ...newT, due: e.target.value })} aria-label="Due" />
        <input id="nt-problems" class="input" value=${newT.problems} placeholder="1, 2, 3a, 3b, 4" onInput=${(e) => setNewT({ ...newT, problems: e.target.value })} aria-label="Problems" />
        <button class="btn btn-ink" disabled=${!newT.title.trim() || !newT.due} onClick=${addThread}>Add</button>
      </div>
    </div>
  </div>`;
}

function Exporter({ courseId }) {
  const app = useApp();
  const [data] = useCourseLog(courseId);
  if (!data) return html`<div class="muted">Reading the chat log…</div>`;
  const cycles = (data.hub && data.hub.cycles) || [];
  const csv = Metrics.csv({ courseId, members: data.members, messages: data.messages, fixes: data.fixes, cycles, organizerIds: app.organizerIds });
  const summary = Metrics.compute({ courseId, members: data.members, messages: data.messages, fixes: data.fixes, checks: data.checks, recaps: data.recaps, cycles, organizerIds: app.organizerIds, now: Clock.now() });
  const rows = csv.split("\n");
  const save = async (filename, body) => {
    if (!app.downloads) { app.toast("Downloads aren't available here. Copy the text below instead."); return; }
    try { await app.downloads.save({ filename, data: body }); }
    catch (e) { if (!e || e.code !== "declined") app.toast("The file couldn't be saved here."); }
  };
  const code = Catalog.get(courseId, app.customCourses).code.replace(/\s+/g, "").toLowerCase();
  return html`<div class="dash">
    <div class="muted" style=${{ fontSize: "13.5px" }}>The log has no names and no message text: every student is a stable alias (S001…), the organizer is ORGANIZER. That's enough to recompute every number in the write-up.</div>
    <div style=${{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <button class="btn btn-primary" onClick=${() => save("roster-" + code + "-log.csv", csv)}><${Icon} name="download" size=${18} />Chat log · CSV · ${rows.length - 1} events</button>
      <button class="btn btn-ghost" onClick=${() => save("roster-" + code + "-results.json", JSON.stringify(summary, null, 2))}><${Icon} name="download" size=${18} />Results · JSON</button>
    </div>
    <div class="card table-wrap"><table>
      <thead><tr>${rows[0].split(",").map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.slice(-8).map((r) => html`<tr>${r.split(",").map((v) => html`<td>${v}</td>`)}</tr>`)}</tbody>
    </table></div>
    <label class="field"><span>Or copy it</span><textarea id="export-csv" class="input" rows="5" readonly value=${csv}></textarea></label>
  </div>`;
}
