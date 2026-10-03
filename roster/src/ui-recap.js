// ---------------------------------------------------------------------------
// AI lecture recap v2 (AI+data spec a): Collaborative Notes anatomy, Granola's
// grey-until-checked rule, guided fixes with a Docs-style diff, Community
// Notes consensus. Checks reset when a fix lands.
// ---------------------------------------------------------------------------
const FIX_REASONS = ["Wrong number or formula", "Missing a step", "Not said in lecture", "Unclear wording"];
function bulletState(recap, b, fixes, checks, uid) {
  const fx = fixes.filter((f) => f.recapId === recap.id && f.bulletId === b.id && f.status !== "dismissed");
  let applied = null;
  if (b.fixedBy) applied = fx.find((f) => f.id === b.fixedBy) || { id: b.fixedBy, text: b.fixedText, by: null, ts: recap.ts };
  const ckAll = checks.filter((c) => c.recapId === recap.id && c.bulletId === b.id);
  const checkedBefore = (t) => ckAll.filter((c) => c.ts < t).length >= 2;
  // A wording-only fix can't replace a line classmates already checked (Community Notes decider).
  const canApply = (f) => autoApplied(f) && !(f.reason === "Unclear wording" && checkedBefore(f.ts));
  if (!applied) applied = fx.filter(canApply).sort((a, c) => appliedAt(a) - appliedAt(c)).pop() || null;
  const open = fx.filter((f) => !canApply(f) && (!applied || f.id !== applied.id));
  // Checks made before a fix landed belong to the old text.
  const since = applied ? appliedAt(applied) || applied.ts : 0;
  const ck = ckAll.filter((c) => c.ts >= since);
  return {
    applied, open, checks: ck, mine: ck.some((c) => c.by === uid),
    text: applied ? applied.text || b.fixedText : b.text,
    state: applied ? "fixed" : open.length ? "open" : ck.length >= 2 ? "checked" : "ai",
  };
}

function RecapCard({ recap, courseId, fixes, checks, compact }) {
  const app = useApp();
  const [history, setHistory] = useState(false);
  const states = recap.bullets.map((b) => bulletState(recap, b, fixes, checks, app.uid));
  const openN = states.reduce((n, s) => n + s.open.length, 0);
  const needs = states.filter((s) => s.state === "ai").length;
  const fixesHere = fixes.filter((f) => f.recapId === recap.id);
  const appliedN = states.filter((s) => s.state === "fixed").length;
  const done = !openN && !needs;
  const status = done
    ? { dot: "ok", t: "Checked by classmates", sub: [appliedN ? plural(appliedN, "fix", "fixes") + " applied" : "", "Matches the slides"].filter(Boolean).join(" · ") }
    : openN ? { dot: "warn", t: "Has a fix waiting", sub: plural(openN, "fix", "fixes") + " waiting" + (needs ? " · " + needs + " to check" : "") }
    : { dot: "", t: "Needs " + needs + " more " + (needs === 1 ? "check" : "checks"), sub: "" };
  return html`<article class="recap" aria-label=${"Lecture " + recap.lecture + " recap"} data-mid=${"rm-" + recap.id}>
    <div class="recap-status"><span class=${"dot " + status.dot}></span><b>${status.t}</b>${status.sub ? html`<span class="sub">· ${status.sub}</span>` : null}<span class="sub">· ${relShort(recap.ts)}</span></div>
    <div class="recap-label"><${Icon} name="ai" size=${14} /><span>Lecture recap · AI-drafted from the organizer's notes · updates with class fixes ·</span><button onClick=${() => setHistory(true)}>History</button></div>
    <h4 class="recap-title">Lecture ${recap.lecture} · ${recap.title}</h4>
    <p class="recap-sub">${F.wmd.format(recap.date || recap.ts)}${recap.sections ? " · " + recap.sections : ""}</p>
    <ol class="lines">${recap.bullets.map((b, i) => html`<${RecapLine} key=${b.id} recap=${recap} b=${b} i=${i} s=${states[i]} courseId=${courseId} />`)}</ol>
    <div class="recap-foot"><${Icon} name="ai" size=${14} /><span>Drafted by AI from the organizer's notes. It can be wrong, so check it against the slides.</span></div>
    ${history ? html`<${RecapHistory} recap=${recap} fixes=${fixesHere} onClose=${() => setHistory(false)} />` : null}
  </article>`;
}
function RecapLine({ recap, b, i, s, courseId }) {
  const app = useApp();
  const [src, setSrc] = useState(null);
  return html`<li class=${"line " + s.state}>
    <span class="line-mk" aria-hidden="true"></span>
    <div class="line-body">
      <p class="line-t"><${RichText} text=${s.text} /></p>
      ${s.applied ? html`<p class="line-orig" aria-label="Original AI text"><${RichText} text=${b.text} /></p>` : null}
      <div class="line-meta">
        ${b.ref || b.quote ? html`<button class=${"srcchip" + (b.quote === "" ? " miss" : "")} onClick=${(e) => b.quote && setSrc(e.currentTarget)}>${b.ref || "Source"}</button>` : null}
        ${s.applied ? html`<span class="fixedby"><${Icon} name="checkCircle" size=${14} />${s.applied.by ? "Fixed by " + firstName(app.person(s.applied.by).name) : "Fixed"}${s.checks.length ? "" : " · checks reset"}</span>`
          : s.state === "checked" ? html`<span class="ok-t">${s.checks.length} classmates checked</span>`
          : s.state === "ai" ? html`<span>${s.checks.length ? s.checks.length + " of 2 checks" : "Not checked yet"}</span>` : null}
        ${app.canWrite ? html`<span class="line-acts">
          <button class=${s.mine ? "on" : ""} aria-pressed=${s.mine} onClick=${() => app.toggleCheck(courseId, recap.id, b.id, s.mine)}><${Icon} name="check" size=${14} />Looks right</button>
          <button onClick=${() => app.open("fix", { recap, b, i, text: s.text, courseId })}><${Icon} name="edit" size=${14} />Fix</button>
        </span>` : null}
      </div>
      ${s.open.map((f) => html`<${Suggestion} key=${f.id} f=${f} b=${b} current=${s.text} courseId=${courseId} />`)}
    </div>
    ${src ? html`<${Popover} anchor=${src} onClose=${() => setSrc(null)}><div class="srcpop"><span class="eyebrow">From the organizer's notes</span><p>“${b.quote}”</p></div><//>` : null}
  </li>`;
}
function Suggestion({ f, b, current, courseId }) {
  const app = useApp();
  const yes = !!(f.votes || {})[app.uid], no = !!(f.nays || {})[app.uid];
  const mineFix = f.by === app.uid;
  const n = agreeN(f);
  return html`<div class="sugg">
    <p class="sugg-old"><${RichText} text=${current} /></p>
    <p class="sugg-new"><${RichText} text=${f.text} /></p>
    <div class="sugg-by"><${Avatar} uid=${f.by} size=${18} /><span>Suggested by <b>${mineFix ? "you" : firstName(app.person(f.by).name)}</b>${f.reason ? " · " + f.reason : ""} · ${relShort(f.ts)}</span></div>
    <div class="sugg-q">
      <span>Is this right?</span>
      <span class="dots3" aria-label=${n + " of " + APPLY_AT + " agree"}>${[0, 1, 2].map((k) => html`<i class=${k < n ? "on" : ""}></i>`)}</span><span class="muted">${n} of ${APPLY_AT}</span>
      <span class="grow"></span>
      ${app.canWrite && !mineFix ? html`
        <button class=${"yn" + (yes ? " on" : "")} aria-pressed=${yes} onClick=${() => app.voteFix(courseId, f, yes ? null : "yes")}>Yes</button>
        <button class=${"yn" + (no ? " on" : "")} aria-pressed=${no} onClick=${() => app.voteFix(courseId, f, no ? null : "no")}>No</button>` : mineFix ? html`<span class="muted">Waiting on classmates</span>` : null}
      ${app.isOrganizer ? html`<button class="yn" onClick=${() => app.resolveFix(courseId, f, "applied")}>Apply</button><button class="yn" onClick=${() => app.resolveFix(courseId, f, "dismissed")}>Dismiss</button>` : null}
    </div>
  </div>`;
}
function FixSheet({ recap, b, i, text, courseId, onClose }) {
  const app = useApp();
  const [val, setVal] = useState(text);
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const changed = val.trim() && val.trim() !== text.trim();
  const submit = async () => {
    setBusy(true);
    const ok = await app.suggestFix(courseId, { recapId: recap.id, bulletId: b.id, text: val.trim(), reason });
    setBusy(false);
    if (ok) onClose();
  };
  return html`<${Sheet} title="Fix this line" icon="edit" onClose=${onClose} footer=${html`
      <span class="muted sm">Your name shows on the fix.</span><span class="grow"></span>
      <button class="btn ghost" onClick=${onClose}>Cancel</button>
      <button class="btn primary" disabled=${!changed || !reason || busy} onClick=${submit}>${busy ? "Sending…" : "Suggest fix"}</button>`}>
    <div class="muted sm">Lecture ${recap.lecture} · line ${i + 1}${b.ref ? " · " + b.ref : ""}</div>
    <div class="field"><span class="field-l">What's off?</span><div class="chips">${FIX_REASONS.map((r) => html`<button class=${"chip" + (r === reason ? " on" : "")} aria-pressed=${r === reason} onClick=${() => setReason(r)}>${r}</button>`)}</div></div>
    <label class="field"><span class="field-l">What should it say?</span><textarea id="fix-text" class="input" rows="4" value=${val} onInput=${(e) => setVal(e.target.value)}></textarea></label>
    ${changed ? html`<div class="sugg preview"><span class="eyebrow">Preview</span><p class="sugg-old"><${RichText} text=${text} /></p><p class="sugg-new"><${RichText} text=${val} /></p></div>` : null}
    <p class="muted sm">When ${APPLY_AT} classmates agree, and agreement outnumbers disagreement 2 to 1, the fix replaces the AI's line for everyone.${reason === "Unclear wording" ? " Wording fixes don't replace a line classmates already checked; they show as an alternative." : ""}</p>
  <//>`;
}
function RecapHistory({ recap, fixes, onClose }) {
  const app = useApp();
  const rows = [...fixes].sort((a, b) => b.ts - a.ts);
  return html`<${Sheet} title=${"Lecture " + recap.lecture + " · history"} icon="history" onClose=${onClose}>
    <div class="hist">
      <div class="hist-row"><${Icon} name="ai" /><div class="grow"><b>AI draft posted</b><small>${dueWhen(recap.ts)} · ${plural(recap.bullets.length, "line")} from the organizer's notes</small></div></div>
      ${rows.map((f) => {
        const line = recap.bullets.findIndex((x) => x.id === f.bulletId) + 1;
        const st = autoApplied(f) || recap.bullets.some((x) => x.fixedBy === f.id) ? "applied" : f.status === "dismissed" ? "dismissed" : "open";
        return html`<div class="hist-row" key=${f.id}><${Avatar} uid=${f.by} size=${26} />
          <div class="grow"><b>Line ${line} · ${firstName(app.person(f.by).name)} · ${f.reason || "Fix"}</b><p><${RichText} text=${f.text} /></p>
            <small>${dueWhen(f.ts)} · ${agreeN(f)} agreed${nayN(f) ? " · " + nayN(f) + " disagreed" : ""}</small></div>
          <span class=${"stat " + st}>${st === "applied" ? "Applied" : st === "dismissed" ? "Not applied" : "Open"}</span></div>`;
      })}
    </div>
  <//>`;
}
function RecapInChat({ m, courseId, ctx }) {
  const recap = ctx && ctx.recaps[m.recapId];
  if (!recap) return html`<div class="sysline">${m.text}</div>`;
  return html`<${RecapCard} recap=${recap} courseId=${courseId} fixes=${ctx.fixes} checks=${ctx.checks} />`;
}
