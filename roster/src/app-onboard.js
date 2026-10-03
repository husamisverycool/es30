// ---------------------------------------------------------------------------
// Onboarding — Saturn's order (school → classes → year → arrive) and its
// arrival reveal ("Welcome, James! 🎉"), with Partiful's tilted tiles.
// ---------------------------------------------------------------------------
const PRIYA = { name: "Priya Raman", house: "Pforzheimer", year: "'29", concentration: "Neuroscience", courses: ["stat110", "lifesci1a", "expos20", "gened1079"] };

function useCourseCounts() {
  const app = useApp();
  return useMemo(() => {
    const counts = {}, faces = {};
    for (const m of app.members) for (const cid of Object.keys(m.courses || {})) {
      if (m.id === app.uid) continue;
      counts[cid] = (counts[cid] || 0) + 1;
      (faces[cid] = faces[cid] || []).length < 4 && faces[cid].push(m.id);
    }
    return { counts, faces };
  }, [app.members]);
}

function CoursePicker({ picked, setPicked }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const fileRef = useRef(null);
  const { counts, faces } = useCourseCounts();
  useEffect(() => { if (app.sample) app.sample.limits().then((l) => setCanScan(!!(l && l.images))).catch(() => {}); }, [app.sample]);
  const results = Catalog.search(q);
  const code = Catalog.normalizeCode(q);
  const customId = code ? Catalog.idFromCode(code) : null;
  const toggle = (id, extra) => {
    if (picked.some((p) => p.id === id)) setPicked(picked.filter((p) => p.id !== id));
    else setPicked([...picked, extra || { id }]);
  };
  const fromText = (text) => {
    const found = new Map();
    const re = /\b([A-Z]{2,10})\s?(\d{1,4}[A-Z]{0,2})\b/g;
    let m;
    while ((m = re.exec(String(text).toUpperCase()))) {
      const c = m[1] + " " + m[2];
      if (/^(FALL|SPRING|ROOM|HALL|TERM|CLASS)$/.test(m[1])) continue;
      found.set(Catalog.idFromCode(c), c);
    }
    return [...found].map(([id, c]) => (Catalog.byId[id] ? { id } : { id, code: c }));
  };
  const addMany = (list) => {
    const next = [...picked];
    for (const it of list) if (!next.some((p) => p.id === it.id)) next.push(it);
    setPicked(next);
    app.toast(list.length ? "Added " + list.length + (list.length === 1 ? " class" : " classes") : "No course codes found. Try typing them.");
  };
  const scan = async (file) => {
    if (!file) return;
    setScanBusy(true);
    try {
      const codes = await app.sample.json("This image is a screenshot of a Harvard student's class schedule (for example from my.harvard). List every course code you can read, like \"STAT 110\" or \"LIFESCI 1A\". Reply with only a JSON array of strings.", { images: file, modelTier: "quick" });
      addMany(fromText((Array.isArray(codes) ? codes : []).join(" ")));
    } catch (e) {
      app.toast(e && e.code === "not_granted" ? "Scanning needs your OK to use Claude. Type your classes instead." : "Couldn't read that screenshot. Type your classes instead.");
    }
    setScanBusy(false);
  };
  return html`<div style=${{ display: "grid", gap: "12px" }}>
    ${picked.length ? html`<div class="picked">${picked.map((p) => { const c = Catalog.get(p.id, { [p.id]: { id: p.id, code: p.code || p.id.toUpperCase() } }); return html`<span class="pill pill-soft" key=${p.id}><span class="emo">${courseLook(p.id).emoji}</span>${c.code}<button onClick=${() => toggle(p.id)} aria-label=${"Remove " + c.code}><${Icon} name="x" size=${14} /></button></span>`; })}</div>` : null}
    <label class="sr" for="course-q">Search courses</label>
    <input id="course-q" class="input" placeholder="Search STAT 110, Expos, Gen Ed…" value=${q} onInput=${(e) => setQ(e.target.value)} autocomplete="off" />
    <div class="results">
      ${customId && !Catalog.byId[customId] ? html`<button class=${"result" + (picked.some((p) => p.id === customId) ? " on" : "")} onClick=${() => toggle(customId, { id: customId, code })}>
        <${Tile} courseId=${customId} size=${40} /><span class="body"><span class="c">${code}</span><span class="tl" style=${{ display: "block" }}>Not in the starter list. Add it and a chat starts for it.</span></span>
        <span class="add"><${Icon} name=${picked.some((p) => p.id === customId) ? "check" : "plus"} size=${18} /></span></button>` : null}
      ${results.map((c) => {
        const on = picked.some((p) => p.id === c.id);
        return html`<button class=${"result" + (on ? " on" : "")} key=${c.id} onClick=${() => toggle(c.id)} aria-pressed=${on}>
          <${Tile} courseId=${c.id} size=${40} />
          <span class="body"><span class="c">${c.code}</span><span class="tl" style=${{ display: "block" }}>${c.short || c.title}${c.meets && c.meets.includes(":") ? " · " + c.meets : ""}</span></span>
          ${counts[c.id] ? html`<${AvatarStack} ids=${faces[c.id]} total=${counts[c.id]} size=${20} />` : null}
          <span class="add"><${Icon} name=${on ? "check" : "plus"} size=${18} /></span>
        </button>`;
      })}
    </div>
    <div class="ob-alt">
      <button class="btn btn-ghost btn-sm" onClick=${() => setPaste(paste == null ? "" : null)}><${Icon} name="paste" size=${16} />Paste from my.harvard</button>
      ${canScan ? html`<button class="btn btn-ghost btn-sm" disabled=${scanBusy} onClick=${() => fileRef.current && fileRef.current.click()}><${Icon} name="camera" size=${16} />${scanBusy ? "Reading…" : "Scan a schedule screenshot"}</button>
        <input type="file" accept="image/png,image/jpeg,image/webp" ref=${fileRef} hidden onChange=${(e) => scan(e.target.files && e.target.files[0])} />` : null}
    </div>
    ${paste != null ? html`<div class="field"><textarea id="paste-sched" class="input" rows="4" placeholder="Paste your schedule or enrollment cart. Roster pulls out the course codes." value=${paste} onInput=${(e) => setPaste(e.target.value)}></textarea>
      <button class="btn btn-ink btn-sm" style=${{ justifySelf: "start" }} onClick=${() => { addMany(fromText(paste)); setPaste(null); }}>Find my classes</button></div>` : null}
  </div>`;
}

function Onboarding({ onDone, onJoining }) {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(app.demo ? PRIYA.courses.map((id) => ({ id })) : []);
  const [name, setName] = useState(app.demo ? PRIYA.name : app.viewerName || "");
  const [year, setYear] = useState(app.demo ? PRIYA.year : "'29");
  const [house, setHouse] = useState(app.demo ? PRIYA.house : "");
  const [conc, setConc] = useState(app.demo ? PRIYA.concentration : "");
  const [busy, setBusy] = useState(false);
  const { counts, faces } = useCourseCounts();
  const join = async () => {
    setBusy(true);
    onJoining(true);
    const ok = await app.joinCourses({ displayName: name.trim(), year, house, concentration: conc.trim(), picked });
    setBusy(false);
    if (ok) setStep(3);
    else onJoining(false);
  };
  const first = firstName(name.trim()) || "there";
  const heroTiles = ["stat110", "lifesci1a", "expos20"];

  const hero = step === 3
    ? html`<div class="in"><div class="ob-pin" style=${{ transform: "rotate(-4deg)" }}><span class="emo">🎓</span></div>
        <h1>Welcome, ${first} <span class="emo">🎉</span></h1><p>Harvard College · Fall 2026</p></div>`
    : html`<div class="in">
        <div style=${{ display: "flex", gap: "10px", marginBottom: "4px" }} aria-hidden="true">
          ${heroTiles.map((id, i) => html`<span style=${{ transform: "rotate(" + [-10, 4, 12][i] + "deg) translateY(" + [6, 0, 8][i] + "px)", boxShadow: "0 12px 30px rgba(0,0,0,.25)", borderRadius: "18px", display: "inline-flex" }}><${Tile} courseId=${id} size=${60} /></span>`)}
        </div>
        <h1>Your classes already have a group chat.</h1>
        <p>Add your courses and you're in, with everyone taking them. No link to find.</p>
      </div>`;

  return html`<div class="ob">
    ${app.banner}
    <div class="ob-hero">${hero}</div>
    <div class="ob-card">
      ${step < 3 ? html`<div class="ob-steps" aria-label=${"Step " + (step + 1) + " of 3"}>${[0, 1, 2].map((i) => html`<i class=${i <= step ? "on" : ""}></i>`)}</div>` : null}
      ${step === 0 ? html`
        <h2>One chat for every class you take.</h2>
        <ul class="ob-points">
          <li><span class="emo">👥</span><div><b>Placed on day one</b><span>Everyone in STAT 110 lands in the same chat. Nobody has to find a link.</span></div></li>
          <li><span class="emo">📌</span><div><b>Due dates stay pinned</b><span>PSet deadlines and the notes folder don't scroll away.</span></div></li>
          <li><span class="emo">📝</span><div><b>Lecture recaps your class checks</b><span>An AI draft after each lecture. Classmates fix what it gets wrong.</span></div></li>
          <li><span class="emo">🙈</span><div><b>No professors</b><span>Run by a student. Course staff aren't in it.</span></div></li>
        </ul>
        <div class="ob-who"><${Avatar} uid=${app.uid} size=${40} name=${name || undefined} /><div class="grow"><b>${app.demo ? "You're trying it as " + PRIYA.name : name ? "Signed in as " + name : "Signed in"}</b><small>${app.demo ? "Demo · Pforzheimer '29 · nothing you post leaves this browser" : "Classmates see your name and house next to your messages."}</small></div></div>
        <button class="btn btn-primary btn-block" onClick=${() => setStep(1)}>Add my classes</button>
        <div class="ob-fine">Run by a student. Not affiliated with Harvard or course staff.</div>` : null}
      ${step === 1 ? html`
        <h2>What are you taking?</h2>
        <p class="lead">Fall 2026. Pick every class you want a chat for.</p>
        <${CoursePicker} picked=${picked} setPicked=${setPicked} />
        <div style=${{ display: "flex", gap: "10px" }}><button class="btn btn-ghost" onClick=${() => setStep(0)}>Back</button><button class="btn btn-primary" style=${{ flex: 1 }} disabled=${!picked.length} onClick=${() => setStep(2)}>Continue with ${picked.length || "no"} ${picked.length === 1 ? "class" : "classes"}</button></div>` : null}
      ${step === 2 ? html`
        <h2>Last thing: who are you?</h2>
        <p class="lead">Classmates see this next to your name, so people from your house can find you.</p>
        <label class="field"><span>Name</span><input id="ob-name" class="input" value=${name} onInput=${(e) => setName(e.target.value)} autocomplete="name" /></label>
        <div class="grid2">
          <label class="field"><span>Class year</span><select id="ob-year" class="input" value=${year} onChange=${(e) => setYear(e.target.value)}>${Catalog.years.map((y) => html`<option value=${y}>${"Class of 20" + y.slice(1)}</option>`)}</select></label>
          <label class="field"><span>House</span><select id="ob-house" class="input" value=${house} onChange=${(e) => setHouse(e.target.value)}><option value="">Choose…</option>${Catalog.houses.map((h) => html`<option value=${h}>${h}</option>`)}</select></label>
        </div>
        <label class="field"><span>Concentration (optional)</span><input id="ob-conc" class="input" value=${conc} onInput=${(e) => setConc(e.target.value)} placeholder="Neuroscience" /></label>
        <div style=${{ display: "flex", gap: "10px" }}><button class="btn btn-ghost" onClick=${() => setStep(1)}>Back</button><button class="btn btn-primary" style=${{ flex: 1 }} disabled=${!name.trim() || busy} onClick=${join}>${busy ? "Placing you…" : "Join my class chats"}</button></div>` : null}
      ${step === 3 ? html`
        <h2>You're in ${picked.length} class ${picked.length === 1 ? "chat" : "chats"}.</h2>
        <div class="arrive">${picked.map((p, i) => {
          const c = Catalog.get(p.id, { [p.id]: { id: p.id, code: p.code || p.id.toUpperCase(), title: "" } });
          const n = counts[p.id] || 0;
          return html`<div class="arrive-row" style=${{ animationDelay: 120 + i * 140 + "ms" }} key=${p.id}>
            <${Tile} courseId=${p.id} size=${44} />
            <div class="body"><div class="c">${c.code}</div><div class="n">${n ? n + (n === 1 ? " classmate" : " classmates") + " already here" : "You're the first one here"}</div></div>
            ${n ? html`<${AvatarStack} ids=${faces[p.id] || []} size=${24} />` : null}
          </div>`;
        })}</div>
        <button class="btn btn-primary btn-block" onClick=${() => onDone(picked[0] && picked[0].id)}>Open ${Catalog.get(picked[0].id, { [picked[0].id]: { code: picked[0].code || picked[0].id.toUpperCase() } }).code}</button>` : null}
    </div>
  </div>`;
}
