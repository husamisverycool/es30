// ---------------------------------------------------------------------------
// AI lecture recap + classmate corrections (DESIGN.md §4): X Collaborative
// Notes card anatomy, Granola's grey-until-checked AI text, Google Docs
// suggesting-mode strike/underline, Community Notes consensus to apply.
// ---------------------------------------------------------------------------
const APPLY_AT = 3;
const agreeN = (f) => Object.values(f.votes || {}).filter(Boolean).length;
const nayN = (f) => Object.values(f.nays || {}).filter(Boolean).length;
const autoApplied = (f) => f.status === "applied" || (f.status !== "dismissed" && agreeN(f) >= APPLY_AT && agreeN(f) >= 2 * nayN(f));

function bulletState(recap, b, fixes, checks, uid) {
  const fx = fixes.filter((f) => f.recapId === recap.id && f.bulletId === b.id && f.status !== "dismissed");
  let applied = null;
  if (b.fixedBy) applied = fx.find((f) => f.id === b.fixedBy) || { id: b.fixedBy, text: b.fixedText, by: null, ts: recap.ts };
  if (!applied) applied = fx.filter(autoApplied).sort((a, c) => a.ts - c.ts).pop() || null;
  const open = fx.filter((f) => !autoApplied(f) && (!applied || f.id !== applied.id));
  const ck = checks.filter((c) => c.recapId === recap.id && c.bulletId === b.id);
  return {
    applied, open, checks: ck,
    mine: ck.some((c) => c.by === uid),
    text: applied ? applied.text || b.fixedText : b.text,
    state: applied ? "fixed" : open.length ? "open" : ck.length >= 2 ? "checked" : "ai",
  };
}

function RecapCard({ recap, courseId, fixes, checks }) {
  const app = useApp();
  const [fixFor, setFixFor] = useState(null);
  const [history, setHistory] = useState(false);
  const states = recap.bullets.map((b) => bulletState(recap, b, fixes, checks, app.uid));
  const openN = states.reduce((n, s) => n + s.open.length, 0);
  const done = states.every((s) => s.state === "fixed" || s.state === "checked");
  const fixesHere = fixes.filter((f) => f.recapId === recap.id);
  const status = openN
    ? { dot: "warn", t: "Needs more checks", sub: openN + (openN === 1 ? " open fix" : " open fixes") }
    : done ? { dot: "ok", t: "Checked by classmates", sub: fixesHere.length ? fixesHere.length + (fixesHere.length === 1 ? " fix applied" : " fixes applied") : "" }
    : { dot: "", t: "Needs more checks", sub: "" };

  return html`<article class="recap" aria-label=${"Lecture " + recap.lecture + " recap"}>
    <div class="recap-status"><span class=${"dot " + status.dot}></span><span>${status.t}</span><span class="sub">${status.sub ? "· " + status.sub + " " : ""}· ${relShort(recap.ts)}</span></div>
    <div class="recap-label"><${Icon} name="ai" size=${16} /><span>Lecture recap</span><span>·</span><span>AI-drafted, updates with class corrections</span><span>·</span><button onClick=${() => setHistory(true)}>Revision history</button></div>
    <div class="recap-title"><h4>Lecture ${recap.lecture} · ${recap.title}</h4><p>${F.wmd.format(recap.date || recap.ts)}${recap.sections ? " · " + recap.sections : ""}</p></div>
    <ol class="bullets">
      ${recap.bullets.map((b, i) => {
        const s = states[i];
        return html`<li class=${"bl " + s.state} key=${b.id}>
          <span class="mk" aria-hidden="true"></span>
          <span class="t">${s.text}</span>
          ${s.applied ? html`<span class="orig" aria-label="Original AI text">${b.text}</span>` : null}
          <span class="row2">
            ${b.ref ? html`<span class="chip-ref">${b.ref}</span>` : null}
            ${s.applied ? html`<span class="fixed-by"><${Icon} name="checkCircle" size=${14} />${s.applied.by ? "Fixed by " + app.person(s.applied.by).name : "Fixed"}</span>`
              : s.state === "checked" ? html`<span>${s.checks.length} classmates say this matches</span>`
              : s.state === "ai" ? html`<span>${s.checks.length ? s.checks.length + " check so far" : "Not checked yet"}</span>` : null}
            ${app.canWrite && !s.applied ? html`<span class="act">
              <button class=${s.mine ? "on" : ""} onClick=${() => app.toggleCheck(courseId, recap.id, b.id, s.mine)} aria-pressed=${s.mine}><${Icon} name="check" size=${14} />Looks right</button>
              <button onClick=${() => setFixFor({ b, i, text: s.text })}><${Icon} name="edit" size=${14} />Suggest a fix</button>
            </span>` : null}
          </span>
          ${s.open.map((f) => html`<${Suggestion} key=${f.id} f=${f} b=${b} courseId=${courseId} />`)}
        </li>`;
      })}
    </ol>
    <div class="recap-panel">
      <div class="h">Spot something off?</div>
      <div class="muted" style=${{ fontSize: "13px" }}>Use “Suggest a fix” on the line. When ${APPLY_AT} classmates agree, the fix replaces the AI's version for everyone.</div>
    </div>
    <div class="recap-foot"><${Icon} name="ai" size=${14} />Drafted by AI from the organizer's lecture notes. May contain errors.</div>
    ${fixFor ? html`<${FixSheet} recap=${recap} courseId=${courseId} target=${fixFor} onClose=${() => setFixFor(null)} />` : null}
    ${history ? html`<${RevisionHistory} recap=${recap} fixes=${fixesHere} onClose=${() => setHistory(false)} />` : null}
  </article>`;
}

function Suggestion({ f, b, courseId }) {
  const app = useApp();
  const yes = !!(f.votes || {})[app.uid], no = !!(f.nays || {})[app.uid];
  const mineFix = f.by === app.uid;
  const n = agreeN(f);
  return html`<div class="sugg">
    <span class="strike">${b.text}</span>
    <span class="new">${f.text}</span>
    <span class="by"><${Avatar} uid=${f.by} size=${18} /><span>Suggested by <b>${mineFix ? "you" : app.person(f.by).name}</b>${f.reason ? " · " + f.reason : ""} · ${relShort(f.ts)}</span></span>
    <span class="q">
      <span>Is this right?</span>
      <span class="muted" style=${{ fontWeight: 600 }}>${n} of ${APPLY_AT} agree</span>
      <span class="grow"></span>
      ${app.canWrite && !mineFix ? html`
        <button class=${"yn" + (yes ? " on" : "")} aria-pressed=${yes} onClick=${() => app.voteFix(courseId, f, yes ? null : "yes")}>Yes</button>
        <button class=${"yn" + (no ? " on" : "")} aria-pressed=${no} onClick=${() => app.voteFix(courseId, f, no ? null : "no")}>No</button>` : null}
      ${app.isOrganizer ? html`<button class="yn" onClick=${() => app.resolveFix(courseId, f, "applied")}>Apply</button><button class="yn" onClick=${() => app.resolveFix(courseId, f, "dismissed")}>Dismiss</button>` : null}
    </span>
  </div>`;
}

const FIX_REASONS = ["Matches the slides", "Matches what was said", "Clearer wording", "Missing a key point"]; // after Community Notes' helpful-reason tags
function FixSheet({ recap, courseId, target, onClose }) {
  const app = useApp();
  const [text, setText] = useState(target.text);
  const [reason, setReason] = useState(FIX_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const changed = text.trim() && text.trim() !== target.text.trim();
  const submit = async () => {
    setBusy(true);
    const ok = await app.suggestFix(courseId, { recapId: recap.id, bulletId: target.b.id, text: text.trim(), reason });
    setBusy(false);
    if (ok) onClose();
  };
  return html`<${Modal} title="Suggest a fix" icon="edit" onClose=${onClose} footer=${html`
      <button class="btn btn-ghost" onClick=${onClose}>Cancel</button>
      <button class="btn btn-primary" disabled=${!changed || busy} onClick=${submit}>${busy ? "Sending…" : "Suggest fix"}</button>`}>
    <div class="muted" style=${{ fontSize: "13px" }}>Lecture ${recap.lecture} · line ${target.i + 1}${target.b.ref ? " · " + target.b.ref : ""}</div>
    <div class="sugg" style=${{ marginTop: 0, background: "var(--surface-2)", borderColor: "var(--line)" }}><span class="strike" style=${{ textDecoration: "none", background: "none" }}>${target.text}</span></div>
    <label class="field"><span>What should it say?</span>
      <textarea id="fix-text" class="input" value=${text} onInput=${(e) => setText(e.target.value)} rows="4"></textarea></label>
    <div class="field"><span>Why</span><div class="choices">${FIX_REASONS.map((r) => html`<button class=${"choice" + (r === reason ? " on" : "")} onClick=${() => setReason(r)} aria-pressed=${r === reason}>${r}</button>`)}</div></div>
    <div class="muted" style=${{ fontSize: "12.5px" }}>Your name shows on the fix. When ${APPLY_AT} classmates agree, it replaces the AI's line for everyone.</div>
  <//>`;
}

function RevisionHistory({ recap, fixes, onClose }) {
  const app = useApp();
  const rows = [...fixes].sort((a, b) => b.ts - a.ts);
  return html`<${Modal} title=${"Lecture " + recap.lecture + " · revision history"} icon="history" onClose=${onClose}>
    <div class="card">
      <div class="person"><${Icon} name="ai" /><div class="who"><div class="n">AI draft posted</div><div class="s">${dueWhen(recap.ts)} · ${recap.bullets.length} lines from the organizer's notes</div></div></div>
      ${rows.map((f) => {
        const line = recap.bullets.findIndex((b) => b.id === f.bulletId) + 1;
        const st = autoApplied(f) || recap.bullets.some((b) => b.fixedBy === f.id) ? "applied" : f.status === "dismissed" ? "dismissed" : "open";
        return html`<div class="person" style=${{ alignItems: "flex-start", borderTop: "1px solid var(--line-2)" }}>
          <${Avatar} uid=${f.by} size=${28} />
          <div class="who"><div class="n">${app.person(f.by).name} · line ${line}</div>
            <div class="s" style=${{ whiteSpace: "normal" }}>${f.text}</div>
            <div class="s">${dueWhen(f.ts)} · ${agreeN(f)} agree${nayN(f) ? " · " + nayN(f) + " disagree" : ""}</div></div>
          <span class=${"verdict " + (st === "applied" ? "success" : st === "dismissed" ? "kill" : "pending")}>${st === "applied" ? "Applied" : st === "dismissed" ? "Dismissed" : "Open"}</span>
        </div>`;
      })}
    </div>
  <//>`;
}

function RecapInChat({ m, courseId, ctx }) {
  const recap = ctx && ctx.recaps[m.recapId];
  if (!recap) return html`<div class="sysline">${m.text}</div>`;
  return html`<${RecapCard} recap=${recap} courseId=${courseId} fixes=${ctx.fixes} checks=${ctx.checks} />`;
}

function RecapsView({ courseId, ctx }) {
  const app = useApp();
  const list = Object.values(ctx.recaps).sort((a, b) => b.ts - a.ts);
  return html`<div class="scroller"><div class="recaps-wrap">
    ${app.isOrganizer ? html`<div style=${{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}><button class="btn btn-soft btn-sm" onClick=${() => app.openOrganizer("recap")}><${Icon} name="ai" size=${16} />Draft a recap</button></div>` : null}
    ${list.length === 0 ? html`<div class="empty"><div class="big emo">📝</div><h3>No recaps yet</h3><p>After each lecture the organizer posts a short AI draft here. You check it against what was actually said and fix what's wrong.</p></div>` : null}
    ${list.map((r) => html`<${RecapCard} key=${r.id} recap=${r} courseId=${courseId} fixes=${ctx.fixes} checks=${ctx.checks} />`)}
  </div></div>`;
}
