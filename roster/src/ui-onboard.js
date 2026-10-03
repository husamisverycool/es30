// ---------------------------------------------------------------------------
// Onboarding (onboarding blueprint): Saturn's order — classes first, then
// school identity — with Hinge's prompts, Airbnb's community commitment,
// Instagram's "people you may know", a truthful build checklist (no fake
// progress: each line ticks when its write lands), and Saturn's arrival.
// Nothing is written until the build step, so backing out leaves no trace.
// ---------------------------------------------------------------------------
const PRIYA = { name: "Priya Raman", house: "Pforzheimer", year: "'29", concentration: "Neuroscience", courses: ["stat110", "lifesci1a", "expos20", "gened1079"], sections: { stat110: "w1630", lifesci1a: "r1500" }, color: "#2F7CC2", prompts: [{ q: "I usually start the pset…", a: "Wednesday after section, then I hit a wall on problem 3" }] };

function useCourseCounts() {
  const app = useApp();
  return useMemo(() => {
    const counts = {}, faces = {};
    for (const m of app.members) for (const cid of Object.keys(m.courses || {})) {
      if (m.id === app.uid) continue;
      counts[cid] = (counts[cid] || 0) + 1;
      (faces[cid] = faces[cid] || []).length < 3 && faces[cid].push(m.id);
    }
    return { counts, faces };
  }, [app.members]);
}

function CoursePicker({ picked, setPicked, exclude }) {
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
  const has = (id) => picked.some((p) => p.id === id);
  const toggle = (id, extra) => setPicked(has(id) ? picked.filter((p) => p.id !== id) : [...picked, extra || { id }]);
  const fromText = (text) => {
    const found = new Map();
    const re = /\b([A-Z]{2,10})\s?(\d{1,4}[A-Z]{0,2})\b/g;
    let m;
    while ((m = re.exec(String(text).toUpperCase()))) {
      if (/^(FALL|SPRING|ROOM|HALL|TERM|CLASS|PM|AM|SEC)$/.test(m[1])) continue;
      const c = m[1] + " " + m[2];
      found.set(Catalog.idFromCode(c), c);
    }
    return [...found].map(([id, c]) => (Catalog.byId[id] ? { id } : { id, code: c }));
  };
  const addMany = (list) => {
    const next = [...picked];
    for (const it of list) if (!next.some((p) => p.id === it.id) && !(exclude || []).includes(it.id)) next.push(it);
    setPicked(next);
    app.toast(list.length ? "Found " + plural(list.length, "class", "classes") : "No course codes found. Try typing them.");
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
  const Row = (c, extra) => {
    const on = has(c.id), joined = (exclude || []).includes(c.id);
    return html`<button class=${"cres" + (on ? " on" : "")} key=${c.id} disabled=${joined} onClick=${() => toggle(c.id, extra)} aria-pressed=${on}>
      <${Tile} courseId=${c.id} size=${44} />
      <span class="grow cres-t"><b>${c.code}</b><small>${extra ? "Not in the starter list. Add it and a chat starts for it." : (c.short || c.title) + (c.meets && c.meets.includes(":") ? " · " + c.meets : "")}</small>
        ${counts[c.id] ? html`<span class="cres-who"><${Faces} ids=${faces[c.id]} size=${18} max=${3} /><span>${counts[c.id]} on Roster</span></span>` : null}</span>
      ${joined ? html`<span class="pill sm">Joined</span>` : html`<span class=${"addbtn" + (on ? " on" : "")}><${Icon} name=${on ? "check" : "plus"} size=${18} /></span>`}
    </button>`;
  };
  return html`<div class="picker">
    ${picked.length ? html`<div class="picked">${picked.map((p) => html`<span class="pickchip" key=${p.id}><${Tile} courseId=${p.id} size=${22} />${Catalog.get(p.id, { [p.id]: { code: p.code || p.id.toUpperCase() } }).code}<button onClick=${() => toggle(p.id)} aria-label=${"Remove " + (p.code || p.id)}><${Icon} name="x" size=${14} /></button></span>`)}</div>` : null}
    <div class="searchwrap"><${Icon} name="search" size=${18} /><input id="course-q" class="grow" placeholder="Search STAT 110, Expos, Gen Ed…" value=${q} onInput=${(e) => setQ(e.target.value)} autocomplete="off" aria-label="Search courses" />${q ? html`<button class="iconbtn sm" onClick=${() => setQ("")} aria-label="Clear"><${Icon} name="xCircle" size=${18} fill=${true} /></button>` : null}</div>
    <div class="altrow">
      <button class="chip" onClick=${() => setPaste(paste == null ? "" : null)}><${Icon} name="paste" size=${15} />Paste from my.harvard</button>
      ${canScan ? html`<button class="chip" disabled=${scanBusy} onClick=${() => fileRef.current && fileRef.current.click()}><${Icon} name="camera" size=${15} />${scanBusy ? "Reading…" : "Scan a screenshot"}</button>
        <input type="file" accept="image/png,image/jpeg,image/webp" ref=${fileRef} hidden onChange=${(e) => scan(e.target.files && e.target.files[0])} />` : null}
    </div>
    ${paste != null ? html`<div class="pastebox"><textarea id="paste-sched" class="input" rows="4" placeholder="Paste your schedule or shopping cart. Roster pulls out the course codes." value=${paste} onInput=${(e) => setPaste(e.target.value)}></textarea>
      <button class="btn sm primary" onClick=${() => { addMany(fromText(paste)); setPaste(null); }}>Find my classes</button></div>` : null}
    <div class="cresults">
      ${customId && !Catalog.byId[customId] ? Row({ id: customId, code }, { id: customId, code }) : null}
      ${results.map((c) => Row(c))}
    </div>
  </div>`;
}

const OB_STEPS = ["welcome", "classes", "verify", "name", "house", "conc", "sections", "prompts", "pledge", "friends", "build", "arrive"];
function Onboarding({ onDone }) {
  const app = useApp();
  const demo = app.demo;
  const placed = app.placement && app.placement.courses ? app.placement.courses.map((id) => ({ id })) : [];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [picked, setPicked] = useState(demo ? PRIYA.courses.map((id) => ({ id })) : placed);
  const [name, setName] = useState(demo ? PRIYA.name : app.viewerName || "");
  const [color, setColor] = useState(demo ? PRIYA.color : SWATCHES[hash(app.uid || "") % SWATCHES.length]);
  const [photo, setPhoto] = useState("");
  const [year, setYear] = useState(demo ? PRIYA.year : "");
  const [house, setHouse] = useState(demo ? PRIYA.house : "");
  const [conc, setConc] = useState(demo ? PRIYA.concentration : "");
  const [sections, setSections] = useState(demo ? PRIYA.sections : {});
  const [prompts, setPrompts] = useState(demo ? PRIYA.prompts : []);
  const [following, setFollowing] = useState({});
  const [built, setBuilt] = useState(0);
  const [failed, setFailed] = useState(false);
  const email = demo ? "priya_raman@college.harvard.edu" : app.viewerEmail || "";
  const verified = /(^|\.)harvard\.edu$/i.test(email.split("@")[1] || "");
  const key = OB_STEPS[step];
  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); };
  const next = () => go(step + 1), back = () => go(Math.max(0, step - 1));
  const courses = picked.filter((p) => Catalog.isCourse(p.id));
  const first = firstName(name.trim()) || "there";
  const skippable = ["conc", "sections", "prompts", "friends"].includes(key);

  const build = async () => {
    setFailed(false); setBuilt(0);
    app.setArriving(true);
    const tick = (n) => new Promise((r) => setTimeout(() => { setBuilt(n); r(); }, 380));
    await tick(1);
    const ok = await app.joinCourses({
      picked,
      sections,
      profile: { displayName: name.trim(), year, house, concentration: conc, color, photo, prompts: prompts.filter((p) => p.a && p.a.trim()), following, pledgeAt: Clock.now(), verified: verified ? "harvard.edu" : "" },
    });
    if (!ok) { setFailed(true); app.setArriving(false); return; }
    for (let n = 2; n <= buildLines.length; n++) await tick(n);
    setTimeout(() => go(OB_STEPS.indexOf("arrive")), 450);
  };
  useEffect(() => { if (key === "build") build(); }, [key]);
  const { counts, faces } = useCourseCounts();
  const houseSpace = Catalog.houseId(house), yearSpace = Catalog.yearId(year);
  const buildLines = [
    ...courses.map((p) => "Joining " + Catalog.get(p.id, { [p.id]: { code: p.code || p.id.toUpperCase() } }).code + (counts[p.id] ? " · " + plural(counts[p.id], "classmate") : "")),
    houseSpace ? "Joining your House chat · " + Catalog.space(houseSpace).code : null,
    yearSpace ? "Joining " + Catalog.space(yearSpace).code : null,
    "Putting your classes on your calendar",
    "Pinning what's due this week",
  ].filter(Boolean);

  // ---- steps ----
  let body, cta = null;
  if (key === "welcome") {
    body = html`<div class="ob-welcome">
      <div class="ob-tiles" aria-hidden="true">${["stat110", "lifesci1a", "expos20", "gened1079"].map((id, i) => html`<span key=${id} class="ob-tile" style=${{ "--r": [-12, 5, -4, 11][i] + "deg", "--y": [10, -6, 14, 0][i] + "px", "--d": i * 90 + "ms" }}><${Tile} courseId=${id} size=${72} /></span>`)}</div>
      <h1 class="ob-h1">Your classes already have a group chat.</h1>
      <p class="ob-sub">Add your courses and you're in, with everyone taking them. No link to find.</p>
      <ul class="ob-points">
        <li><span class="ob-pi" style=${{ background: "var(--c2-solid)" }}><${Icon} name="users" size=${18} fill=${true} /></span><div><b>Placed on day one</b><span>Everyone in STAT 110 lands in the same chat.</span></div></li>
        <li><span class="ob-pi" style=${{ background: "var(--c7-solid)" }}><${Icon} name="calendar" size=${18} fill=${true} /></span><div><b>Your week in one place</b><span>Classes, due dates, study sessions, friends who are free.</span></div></li>
        <li><span class="ob-pi" style=${{ background: "var(--c10-solid)" }}><${Icon} name="ai" size=${18} /></span><div><b>Lecture recaps your class checks</b><span>An AI draft after each lecture. Classmates fix what's wrong.</span></div></li>
      </ul>
    </div>`;
    cta = html`<button class="btn primary lg block" onClick=${next}>Get started</button>
      ${app.live ? html`<button class="btn ghost block" onClick=${() => app.switchMode("demo")}>Just looking? Open the demo class</button>` : null}
      <p class="fine">Run by a student for ES30. Not affiliated with Harvard or course staff.</p>`;
  } else if (key === "classes") {
    body = html`<h1 class="ob-h">What are you taking?</h1><p class="ob-sub">Fall 2026. Pick every class you want a chat for.</p>
      ${placed.length ? html`<div class="ob-banner"><${Icon} name="checkCircle" size=${18} fill=${true} />The organizer added you to ${placed.map((p) => course(app, p.id).code).join(", ")}.</div>` : null}
      <${CoursePicker} picked=${picked} setPicked=${setPicked} />`;
    cta = html`<button class="btn primary lg block" disabled=${!picked.length} onClick=${next}>${picked.length ? "Continue with " + plural(picked.length, "class", "classes") : "Pick at least one class"}</button>`;
  } else if (key === "verify") {
    body = html`<h1 class="ob-h">${verified ? "You're verified." : "Check your school email"}</h1>
      <p class="ob-sub">${verified ? "Classmates see a check next to your name, so they know you're really at Harvard." : "Roster uses the email on your account to confirm you're at Harvard."}</p>
      <div class=${"verify" + (verified ? " ok" : "")}><span class="verify-ic"><${Icon} name=${verified ? "checkCircle" : "envelope"} size=${28} fill=${verified} /></span>
        <div class="grow"><b>${email || "No email shared"}</b><small>${verified ? "Harvard email confirmed" : email ? "Not a harvard.edu address" : "Your account didn't share an email with this page"}</small></div></div>
      ${verified ? null : html`<p class="muted sm">You can still join. Your profile won't show the check, and the organizer may remove accounts they can't place.</p>`}
      <p class="muted sm">Your email is never shown to classmates.</p>`;
    cta = html`<button class="btn primary lg block" onClick=${next}>Continue</button>`;
  } else if (key === "name") {
    const ref = { current: null };
    body = html`<h1 class="ob-h">What should classmates call you?</h1><p class="ob-sub">Your name shows next to your messages.</p>
      <div class="ob-avatar"><span class="av" style=${{ width: "96px", height: "96px", fontSize: "36px", "--av": color }}>${photo ? html`<img src=${photo} alt="" />` : html`<span class="av-in">${initials(name)}</span>`}</span>
        <label class="btn sm soft"><${Icon} name="camera" size=${16} />${photo ? "Change photo" : "Add a photo"}<input type="file" accept="image/*" hidden onChange=${async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setPhoto((await Media.compress(f, { max: 320 })).src); } catch (_) { app.toast("That file isn't an image Roster can read."); } }} /></label></div>
      <div class="swatches center" role="radiogroup" aria-label="Colour">${SWATCHES.map((s) => html`<button key=${s} role="radio" aria-checked=${color === s} class=${"sw" + (color === s ? " on" : "")} style=${{ background: s }} onClick=${() => setColor(s)} aria-label=${"Colour " + s}></button>`)}</div>
      <label class="field"><span>Name</span><input id="ob-name" class="input lg" value=${name} onInput=${(e) => setName(e.target.value)} autocomplete="name" placeholder="First and last name" /></label>`;
    cta = html`<button class="btn primary lg block" disabled=${name.trim().length < 2} onClick=${next}>Continue</button>`;
  } else if (key === "house") {
    body = html`<h1 class="ob-h">Year and House</h1><p class="ob-sub">You'll join your House and class-year chats too.</p>
      <div class="field"><span>Class of</span><div class="seg wide">${Catalog.years.map((y) => html`<button key=${y} class=${year === y ? "on" : ""} onClick=${() => { setYear(y); if (y === "'30" && !house) setHouse("First-year (Yard)"); }}>20${y.slice(1)}</button>`)}</div></div>
      <div class="field"><span>House</span><div class="housegrid">${Catalog.houses.map((h) => html`<button key=${h} class=${"housechip" + (house === h ? " on" : "")} aria-pressed=${house === h} onClick=${() => setHouse(h)}>${h === "First-year (Yard)" ? "Yard" : shortHouse(h)}${h === "Pforzheimer" ? html`<small>Pforzheimer</small>` : h === "First-year (Yard)" ? html`<small>First-years</small>` : null}</button>`)}</div></div>`;
    cta = html`<button class="btn primary lg block" disabled=${!year || !house} onClick=${next}>Continue</button>`;
  } else if (key === "conc") {
    body = html`<h1 class="ob-h">Concentration</h1><p class="ob-sub">Undeclared is fine. You can change it anytime.</p><${ConcPicker} value=${conc} onPick=${(c) => { setConc(c); }} />`;
    cta = html`<button class="btn primary lg block" disabled=${!conc} onClick=${next}>Continue</button>`;
  } else if (key === "sections") {
    body = html`<h1 class="ob-h">Your sections</h1><p class="ob-sub">Each section gets its own room inside the class chat.</p>
      ${courses.filter((p) => Catalog.byId[p.id] && Catalog.byId[p.id].size > 30).map((p) => {
        const cnt = {};
        for (const m of app.members) { const s = m.sections && m.sections[p.id]; if (s) cnt[s] = (cnt[s] || 0) + 1; }
        return html`<div class="field" key=${p.id}><span class="sec-lab"><${Tile} courseId=${p.id} size=${22} />${course(app, p.id).code}</span>
          <div class="slotgrid">${Catalog.SLOTS.map((s) => html`<button key=${s.id} class=${"slotchip" + (sections[p.id] === s.id ? " on" : "")} aria-pressed=${sections[p.id] === s.id} onClick=${() => setSections({ ...sections, [p.id]: sections[p.id] === s.id ? "" : s.id })}><b>${s.label}</b><small>${cnt[s.id] ? cnt[s.id] + " here" : "No one yet"}</small></button>`)}
            <button class=${"slotchip" + (!sections[p.id] ? " on" : "")} onClick=${() => setSections({ ...sections, [p.id]: "" })}><b>Not sure yet</b><small>Pick later</small></button></div></div>`;
      })}
      ${!courses.some((p) => Catalog.byId[p.id] && Catalog.byId[p.id].size > 30) ? html`<p class="muted">None of your classes have sections listed. You can add one later from the class.</p>` : null}`;
    cta = html`<button class="btn primary lg block" onClick=${next}>Continue</button>`;
  } else if (key === "prompts") {
    body = html`<h1 class="ob-h">Give people something to say hi about</h1><p class="ob-sub">Pick up to three. They show on your profile.</p>
      <${PromptPicker} prompts=${prompts} setPrompts=${setPrompts} />`;
    cta = html`<button class="btn primary lg block" onClick=${next}>${prompts.some((p) => p.a && p.a.trim()) ? "Continue" : "Skip for now"}</button>`;
  } else if (key === "pledge") {
    body = html`<h1 class="ob-h">One promise before you post</h1><p class="ob-sub">Everyone in your classes agrees to the same four things.</p>
      <ol class="pledge">${PLEDGE.map(([ic, t, s]) => html`<li key=${t}><span class="pledge-ic"><${Icon} name=${ic} size=${20} /></span><div><b>${t}</b><p>${s}</p></div></li>`)}</ol>`;
    cta = html`<button class="btn primary lg block" onClick=${next}>Agree and continue</button><p class="fine">If you don't agree, you can still read, but you won't be able to post. <button class="link" onClick=${() => app.switchMode("demo")}>${app.live ? "Try the demo instead" : ""}</button></p>`;
  } else if (key === "friends") {
    const draft = { courses: Object.fromEntries(picked.map((p) => [p.id, 1])), house, following };
    const all = Derive.suggestions(draft, app.members, app.uid);
    const addedYou = app.members.filter((m) => m.following && m.following[app.uid]);
    const list = [...addedYou.map((m) => ({ m, addedYou: true, shared: Object.keys(m.courses || {}).filter((c) => draft.courses[c] && Catalog.isCourse(c)), house: m.house === house })), ...all.filter((x) => !x.addedYou)].slice(0, 14);
    body = html`<h1 class="ob-h">People you may know</h1><p class="ob-sub">From your classes and ${house ? shortHouse(house) : "your House"}. When you add each other, you'll see when you're both free.</p>
      <div class="group">${list.map((x) => {
        const on = !!following[x.m.id];
        return html`<div class="prow static" key=${x.m.id}><${Avatar} uid=${x.m.id} size=${44} />
          <span class="grow prow-t"><b>${x.m.displayName}</b><small>${x.addedYou ? "Added you · " : ""}${[...x.shared.slice(0, 2).map((c) => course(app, c).code), x.house ? shortHouse(x.m.house) : ""].filter(Boolean).join(" · ")}</small></span>
          <button class=${"btn sm " + (on ? "ghost" : "primary")} onClick=${() => setFollowing({ ...following, [x.m.id]: on ? 0 : Clock.now() })}>${on ? html`<${Icon} name="check" size=${15} />Added` : x.addedYou ? "Add back" : "Add"}</button></div>`;
      })}${!list.length ? html`<div class="rowempty">No one from your classes is here yet. You'll see people as they join.</div>` : null}</div>`;
    const n = Object.values(following).filter(Boolean).length;
    cta = html`<button class="btn primary lg block" onClick=${next}>${n ? "Continue with " + plural(n, "friend") : "Skip for now"}</button>`;
  } else if (key === "build") {
    body = html`<div class="ob-build"><h1 class="ob-h">Setting up your semester</h1>
      <ul class="buildlist">${buildLines.map((l, i) => html`<li key=${l} class=${i < built ? "done" : i === built ? "now" : ""}><span class="bl-ic">${i < built ? html`<${Icon} name="check" size=${14} />` : i === built && !failed ? html`<span class="spin"></span>` : null}</span>${l}</li>`)}</ul>
      ${failed ? html`<div class="ob-banner warn"><${Icon} name="warning" size=${18} />That didn't go through. Check your connection.</div>` : null}</div>`;
    cta = failed ? html`<button class="btn primary lg block" onClick=${build}>Try again</button>` : null;
  } else if (key === "arrive") {
    const firstCourse = courses[0] || picked[0];
    body = html`<div class="ob-arrive">
      <span class="ob-avatar-big"><span class="av" style=${{ width: "88px", height: "88px", fontSize: "32px", "--av": color }}>${photo ? html`<img src=${photo} alt="" />` : html`<span class="av-in">${initials(name)}</span>`}</span><span class="confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => html`<i key=${i} style=${{ "--a": i * 26 + "deg", "--c": "var(--c" + ((i % 12) + 1) + "-solid)", "--d": (i % 5) * 40 + "ms" }}></i>`)}</span></span>
      <h1 class="ob-h1">You're in, ${first}.</h1><p class="ob-sub">Your semester is ready.</p>
      <div class="arrive">${[...picked.map((p) => p.id), houseSpace, yearSpace].filter(Boolean).map((id, i) => {
        const n = counts[id] || 0;
        return html`<div class="arrive-row" style=${{ animationDelay: 120 + i * 110 + "ms" }} key=${id}><${Tile} courseId=${id} size=${40} />
          <div class="grow"><b>${course(app, id).code || Catalog.get(id, { [id]: { code: (picked.find((p) => p.id === id) || {}).code } }).code}</b><small>${n ? plural(n, "classmate") + " already here" : "You're the first one here"}</small></div>
          ${n ? html`<${Faces} ids=${faces[id] || []} size=${22} max=${3} />` : null}</div>`;
      })}</div></div>`;
    const intro = "Hi! I'm " + first + (house ? ", " + shortHouse(house) + (year ? " " + year : "") : "") + " 👋";
    cta = html`<button class="btn primary lg block" onClick=${() => { LS.set("roster:draft:" + firstCourse.id + ":main", intro); onDone(firstCourse.id); }}>Say hi in ${course(app, firstCourse.id).code}</button>
      <button class="btn ghost block" onClick=${() => onDone(null)}>Look around first</button>`;
  }

  const progress = Math.min(1, step / (OB_STEPS.length - 2));
  return html`<div class=${"ob step-" + key}>
    ${app.banner}
    ${key !== "welcome" && key !== "build" && key !== "arrive" ? html`<header class="ob-top">
      <button class="iconbtn" onClick=${back} aria-label="Back"><${Icon} name="chevronLeft" /></button>
      <div class="ob-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(progress * 100)}><i style=${{ width: progress * 100 + "%" }}></i></div>
      ${skippable ? html`<button class="ob-skip" onClick=${next}>Skip</button>` : html`<span class="ob-skip-sp"></span>`}
    </header>` : null}
    <div class="ob-scroll"><div class=${"ob-body " + (dir > 0 ? "fwd" : "bwd")} key=${key}>${body}</div></div>
    ${cta ? html`<footer class="ob-cta">${cta}</footer>` : null}
  </div>`;
}

function ConcPicker({ value, onPick }) {
  const [q, setQ] = useState("");
  const list = Catalog.CONCENTRATIONS.filter((c) => !q.trim() || c.toLowerCase().includes(q.trim().toLowerCase()));
  const popular = ["Undeclared", "Economics", "Computer Science", "Government", "Neuroscience", "Molecular and Cellular Biology", "Applied Mathematics", "Statistics"];
  return html`<div class="concpick">
    <div class="searchwrap"><${Icon} name="search" size=${18} /><input class="grow" placeholder="Search concentrations" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search concentrations" /></div>
    ${!q.trim() ? html`<div class="chips">${popular.map((c) => html`<button key=${c} class=${"chip" + (value === c ? " on" : "")} onClick=${() => onPick(c)}>${c}</button>`)}</div>` : null}
    <div class="group conclist">${list.map((c) => html`<button key=${c} class=${"radrow" + (value === c ? " on" : "")} onClick=${() => onPick(c)} aria-pressed=${value === c}><span class="grow">${c}</span><span class="radio"></span></button>`)}</div>
  </div>`;
}

// Hinge: pick a prompt, answer it, three slots; empty slots read "Select a prompt".
function PromptPicker({ prompts, setPrompts }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ q: "", a: "" });
  const slots = [0, 1, 2].map((i) => prompts[i] || null);
  const used = prompts.map((p) => p.q);
  const open = (i) => { setEditing(i); setDraft(prompts[i] || { q: "", a: "" }); };
  const save = () => { const n = [...prompts]; n[editing] = { q: draft.q, a: draft.a.trim() }; setPrompts(n.filter((p) => p && p.q && p.a)); setEditing(null); };
  if (editing != null) {
    return html`<div class="promptedit-ob">
      ${!draft.q ? html`<div class="group">${Catalog.PROMPTS.filter((q) => !used.includes(q) || (prompts[editing] && prompts[editing].q === q)).map((q) => html`<button key=${q} class="setrow" onClick=${() => setDraft({ ...draft, q })}><span class="grow">${q}</span><${Icon} name="chevronRight" size=${16} /></button>`)}</div>`
        : html`<div class="promptcard edit"><button class="pc-q" onClick=${() => setDraft({ ...draft, q: "" })}>${draft.q} <${Icon} name="edit" size=${14} /></button>
          <textarea class="input" rows="3" maxlength="150" placeholder="Your answer" value=${draft.a} onInput=${(e) => setDraft({ ...draft, a: e.target.value })} autofocus></textarea><small class="muted">${150 - draft.a.length}</small></div>`}
      <div class="row-gap"><button class="btn ghost" onClick=${() => setEditing(null)}>Cancel</button>${draft.q ? html`<button class="btn primary" disabled=${!draft.a.trim()} onClick=${save}>Done</button>` : null}</div>
    </div>`;
  }
  return html`<div class="promptslots">${slots.map((p, i) => p ? html`<div class="promptcard" key=${i}><small>${p.q}</small><p>${p.a}</p><span class="pc-acts"><button class="iconbtn sm" onClick=${() => open(i)} aria-label="Edit prompt"><${Icon} name="edit" size=${16} /></button><button class="iconbtn sm" onClick=${() => setPrompts(prompts.filter((_, j) => j !== i))} aria-label="Remove prompt"><${Icon} name="x" size=${16} /></button></span></div>`
    : html`<button class="promptcard empty" key=${i} onClick=${() => open(prompts.length)}><small>Select a prompt</small><p>And write your own answer</p><span class="pc-plus"><${Icon} name="plus" size=${18} /></span></button>`)}</div>`;
}
