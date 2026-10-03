// ---------------------------------------------------------------------------
// Core: time formats, ids, local storage, context, data hooks, primitives.
// ---------------------------------------------------------------------------
const { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, createContext, useContext } = window.htmPreact;

// ---- time (Cambridge) ------------------------------------------------------
const TZ = "America/New_York";
const mkFmt = (o) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
const F = {
  time: mkFmt({ hour: "numeric", minute: "2-digit" }),
  wd: mkFmt({ weekday: "long" }),
  wds: mkFmt({ weekday: "short" }),
  md: mkFmt({ month: "short", day: "numeric" }),
  wmd: mkFmt({ weekday: "short", month: "short", day: "numeric" }),
  wlmd: mkFmt({ weekday: "long", month: "short", day: "numeric" }),
  wlml: mkFmt({ weekday: "long", month: "long", day: "numeric" }),
  mon: mkFmt({ month: "short" }),
  dnum: mkFmt({ day: "numeric" }),
};
const Clock = { offset: 0, now: () => Date.now() + Clock.offset };
const dayKey = (ts) => Sched.et(ts).key;
const daysBetween = (a, b) => Math.round((Sched.startOfDay(b) - Sched.startOfDay(a)) / 864e5);
const tShort = (ts) => F.time.format(ts).replace(":00 ", " ");
function relShort(ts) {
  const now = Clock.now(), d = now - ts;
  if (d < 45e3) return "now";
  if (d < 3600e3) return Math.max(1, Math.round(d / 60e3)) + "m";
  const days = daysBetween(ts, now);
  if (days === 0) return Math.round(d / 3600e3) + "h";
  if (days === 1) return "Yesterday";
  if (days < 7) return F.wds.format(ts);
  return F.md.format(ts);
}
function dayLabel(ts) {
  const days = daysBetween(ts, Clock.now());
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  if (days > 1 && days < 7) return F.wd.format(ts);
  return F.wmd.format(ts);
}
// The deadline ladder (time spec c): Things 3 flags, Todoist's tomorrow-orange, Flighty minutes.
function dueLadder(at) {
  const now = Clock.now(), ms = at - now, days = daysBetween(now, at);
  if (ms <= 0) {
    const ago = now - at;
    return { tone: "late", text: ago < 864e5 ? "Due " + (ago < 3600e3 ? Math.max(1, Math.round(ago / 60e3)) + " min" : Math.round(ago / 3600e3) + "h") + " ago" : Math.round(ago / 864e5) + (ago < 2 * 864e5 ? " day ago" : " days ago") };
  }
  if (ms < 3600e3) return { tone: "now", text: "in " + Math.max(1, Math.ceil(ms / 60e3)) + " min" };
  if (days === 0 && ms < 3 * 3600e3) { const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3); return { tone: "today", text: "in " + h + "h " + m + "m" }; }
  if (days === 0) return { tone: "today", text: (Sched.et(at).h >= 18 ? "Tonight " : "Today ") + tShort(at) };
  if (days === 1) return { tone: "tomorrow", text: "Tomorrow " + tShort(at) };
  if (days < 7) return { tone: "soon", text: F.wds.format(at) + " " + tShort(at), sub: "in " + days + " days" };
  return { tone: "calm", text: F.wmd.format(at) };
}
function countdown(ms) {
  if (ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}
function inWords(ms) {
  if (ms < 3600e3) return Math.max(1, Math.round(ms / 60e3)) + " min";
  if (ms < 864e5) { const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3); return h + "h" + (m ? " " + m + "m" : ""); }
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3600e3); return d + "d" + (h ? " " + h + "h" : "");
}
const dueWhen = (ts) => F.wmd.format(ts) + " · " + tShort(ts);
function toLocalInput(ts) { const p = Sched.et(ts); const z = (n) => String(n).padStart(2, "0"); return p.y + "-" + z(p.mo) + "-" + z(p.d) + "T" + z(p.h) + ":" + z(p.mi); }
function fromLocalInput(v) {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? Sched.at(+m[1], +m[2], +m[3], +m[4] * 60 + +m[5]) : null;
}
function useTick(ms) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) set((x) => x + 1); }, ms);
    return () => clearInterval(t);
  }, [ms]);
}
function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}

// ---- identity -----------------------------------------------------------------
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const nameColor = (uid) => "var(--n" + (1 + (hash(uid || "") % 7)) + ")";
const initials = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const firstName = (n) => (n || "").split(/\s+/)[0] || n;
const shortHouse = (h) => Catalog.houseShort[h] || h;
const tagLine = (m) => [m && m.house ? shortHouse(m.house) : "", m && m.year ? m.year : ""].filter(Boolean).join(" ");
const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
const prettyProblem = (p) => (/^(\d+)([a-z])$/i.test(p) ? p.replace(/^(\d+)([a-z])$/i, "$1($2)") : p);

// Course identity (visual system v2): 12 hues at equal perceived lightness, each with
// solid / tint / text roles; a typographic tile ("STAT / 110") instead of emoji squares.
const COURSE_HUE = { stat110: 2, lifesci1a: 6, expos20: 10, gened1079: 8, compsci50: 5, econ10a: 3, math21a: 9, math21b: 7, gened1093: 4, physics15a: 12, compsci61: 11 };
function courseLook(id) {
  const n = COURSE_HUE[id] || 1 + (hash(id || "") % 12);
  const c = Catalog.get(id || "");
  let top = "", bottom = "";
  if (id && id.startsWith("house-")) { top = "HOUSE"; bottom = c.code; }
  else if (id && id.startsWith("year-")) { top = "CLASS"; bottom = "'" + id.slice(5); }
  else { const m = (c.code || "").match(/^(\S+)\s+(.+)$/); top = m ? m[1] : c.code; bottom = m ? m[2] : ""; }
  const year = id && id.startsWith("year-");
  return { n, top, bottom, solid: year ? "var(--school-fill)" : "var(--c" + n + "-solid)", tint: year ? "var(--school-tint)" : "var(--c" + n + "-tint)", text: year ? "var(--school-text)" : "var(--c" + n + "-text)", hue: year ? "var(--school-fill)" : "var(--c" + n + "-solid)" };
}

// ---- local, per-viewer conveniences ----------------------------------------------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } },
};

// ---- context + snapshot hooks -------------------------------------------------------
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);
function useSnapshot(makeRef, deps) {
  const [snap, setSnap] = useState(null);
  useEffect(() => {
    let ref = null;
    try { ref = makeRef(); } catch (e) { console.error(e); }
    if (!ref) { setSnap(null); return; }
    let alive = true;
    const unsub = ref.onSnapshot((s) => alive && setSnap(s), (e) => console.warn("Roster: subscription ended", e && e.code));
    return () => { alive = false; unsub(); };
  }, deps);
  return snap;
}
function useCollection(makeRef, deps) {
  const snap = useSnapshot(makeRef, deps);
  return useMemo(() => (snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : null), [snap]);
}
function useDocData(makeRef, deps) {
  const snap = useSnapshot(makeRef, deps);
  return useMemo(() => (snap ? (snap.exists ? { id: snap.id, ...snap.data() } : false) : null), [snap]);
}

// ---- primitives -------------------------------------------------------------------------
function Icon({ name, size, fill }) {
  return html`<span class="ic" dangerouslySetInnerHTML=${{ __html: iconSvg(name, size, fill) }}></span>`;
}
function Avatar({ uid, size, online, name, ring }) {
  const app = useApp();
  const p = name ? { ...app.person(uid), name, avatarUrl: "" } : app.person(uid);
  const s = size || 32;
  return html`<span class=${"av" + (ring ? " ring" : "")} style=${{ width: s + "px", height: s + "px", fontSize: Math.round(s * 0.38) + "px", "--av": p.color }} title=${p.name}>
    ${p.avatarUrl ? html`<img src=${p.avatarUrl} alt="" />` : html`<span class="av-in">${initials(p.name)}</span>`}
    ${online ? html`<span class="av-dot"></span>` : null}
  </span>`;
}
function Faces({ ids, total, size, max }) {
  const shown = ids.slice(0, max || 4);
  return html`<span class="faces" style=${{ "--fs": (size || 22) + "px" }}>${shown.map((id) => html`<${Avatar} key=${id} uid=${id} size=${size || 22} />`)}${total != null && total > shown.length ? html`<span class="faces-more">+${total - shown.length}</span>` : null}</span>`;
}
function Tile({ courseId, size }) {
  const L = courseLook(courseId);
  const s = size || 40;
  const long = (L.bottom || "").length > 4 || (L.top || "").length > 6;
  return html`<span class="tile" style=${{ width: s + "px", height: s + "px", background: L.tint, color: L.text, borderRadius: Math.round(s * 0.32) + "px", fontSize: Math.round(s * (long ? 0.2 : 0.24)) + "px" }} aria-hidden="true">
    <span class="tile-top">${L.top}</span><span class="tile-bot" style=${{ fontSize: Math.round(s * (long ? 0.26 : 0.34)) + "px" }}>${L.bottom}</span>
  </span>`;
}
function Pill({ tone, children, icon }) {
  return html`<span class=${"pill " + (tone || "")}>${icon ? html`<${Icon} name=${icon} size=${14} />` : null}${children}</span>`;
}
function Empty({ icon, title, children, action }) {
  return html`<div class="empty">${icon ? html`<div class="empty-art"><${Icon} name=${icon} size=${26} /></div>` : null}<h3>${title}</h3>${children ? html`<p>${children}</p>` : null}${action || null}</div>`;
}

// Bottom sheet on phones (Vaul: 500ms cubic-bezier(.32,.72,0,1), close past 25% or fast flick),
// centered dialog on wider screens.
function Sheet({ title, onClose, children, footer, size, icon, bare, label }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 220); }, [onClose]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", k);
    const prev = document.activeElement;
    const t0 = setTimeout(() => { const f = ref.current && ref.current.querySelector("[autofocus], input, textarea, button:not(.sheet-x)"); if (f && matchMedia("(pointer: fine)").matches) f.focus(); }, 0);
    return () => { clearTimeout(t0); window.removeEventListener("keydown", k); if (prev && prev.focus) prev.focus(); };
  }, [close]);
  const down = (e) => { if (matchMedia("(min-width: 760px)").matches) return; drag.current = { y: e.clientY, t: Date.now() }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)); };
  const up = (e) => {
    if (!drag.current) return;
    const h = ref.current ? ref.current.offsetHeight : 600, v = dy / Math.max(1, Date.now() - drag.current.t);
    drag.current = null;
    if (dy > h * 0.25 || v > 0.4) close(); else setDy(0);
  };
  return html`<div class=${"scrim" + (closing ? " out" : "")} onClick=${(e) => e.target === e.currentTarget && close()}>
    <div class=${"sheet " + (size || "") + (closing ? " out" : "")} ref=${ref} role="dialog" aria-modal="true" aria-label=${label || title}
      style=${dy ? { transform: "translateY(" + dy + "px)", transition: "none" } : null}>
      <div class="sheet-grab" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><i></i></div>
      ${bare ? null : html`<header class="sheet-h" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up}>
        ${icon ? html`<${Icon} name=${icon} />` : null}<h2>${title}</h2>
        <button class="sheet-x" onClick=${close} aria-label="Close"><${Icon} name="x" size=${18} /></button>
      </header>`}
      <div class="sheet-b">${children}</div>
      ${footer ? html`<footer class="sheet-f">${footer}</footer>` : null}
    </div>
  </div>`;
}
function Popover({ anchor, onClose, children, align, cls }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect(), me = ref.current.getBoundingClientRect();
    let left = align === "right" ? r.right - me.width : align === "center" ? r.left + r.width / 2 - me.width / 2 : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - me.width - 8));
    let top = r.top - me.height - 8;
    if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - me.height - 8);
    setPos({ left, top });
  }, [anchor]);
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains && anchor.contains(e.target))) onClose(); };
    const key = (e) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("pointerdown", down), 0);
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [anchor, onClose]);
  return html`<div class=${"pop " + (cls || "")} ref=${ref} style=${pos ? { left: pos.left + "px", top: pos.top + "px" } : { left: "-9999px", top: "0" }}>${children}</div>`;
}
function Menu({ items, onPick }) {
  return html`<div class="menu" role="menu">${items.map((g, gi) => html`<div class="menu-g" key=${gi}>${g.filter(Boolean).map((it) => html`<button role="menuitem" class=${it.danger ? "danger" : ""} onClick=${() => onPick(it)} key=${it.label}><${Icon} name=${it.icon} size=${18} /><span>${it.label}</span>${it.hint ? html`<kbd>${it.hint}</kbd>` : null}</button>`)}</div>`)}</div>`;
}
const QUICK = ["👍", "❤️", "😂", "😮", "🙏"]; // Bluesky's 5 + "+" ; ❤️/😂/🙏 carry most class reactions
const MORE_EMOJI = ["😭", "💯", "🔥", "👀", "🤯", "😅", "🫡", "✅", "❌", "✋", "🐣", "🎲", "📌", "🧠", "💀", "🫶", "👏", "🙌", "🤝", "😴", "☕", "📚", "✍️", "🎉", "🤔", "🥲", "😤", "🙃"];
function ReactionTray({ onPick, compact }) {
  const [more, setMore] = useState(false);
  return html`<div class=${"tray" + (compact ? " compact" : "")}>
    <div class="tray-row">${QUICK.map((e, i) => html`<button class="tray-e emo" style=${{ "--i": i }} onClick=${() => onPick(e)} aria-label=${"React " + e}>${e}</button>`)}
      <button class="tray-e more" style=${{ "--i": QUICK.length }} onClick=${() => setMore(!more)} aria-label="More reactions" aria-expanded=${more}><${Icon} name="plus" size=${20} /></button></div>
    ${more ? html`<div class="tray-grid">${MORE_EMOJI.map((e) => html`<button class="emo" onClick=${() => onPick(e)}>${e}</button>`)}</div>` : null}
  </div>`;
}
function Seg({ value, options, onChange, label }) {
  return html`<div class="seg" role="tablist" aria-label=${label}>${options.map(([k, l, n]) => html`<button role="tab" aria-selected=${value === k} class=${value === k ? "on" : ""} onClick=${() => onChange(k)}>${l}${n ? html`<span class="seg-n">${n}</span>` : null}</button>`)}</div>`;
}
function Toggle({ on, onChange, label, id }) {
  return html`<label class="toggle"><span>${label}</span><input id=${id} type="checkbox" checked=${on} onChange=${(e) => onChange(e.target.checked)} /><i aria-hidden="true"></i></label>`;
}
function calLinks(title, start, end, details) {
  const fin = end || start + 30 * 60e3;
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return {
    google: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + z(start) + "/" + z(fin) + "&details=" + encodeURIComponent(details || ""),
    outlook: "https://outlook.office.com/calendar/0/deeplink/compose?subject=" + encodeURIComponent(title) + "&startdt=" + encodeURIComponent(new Date(start).toISOString()) + "&enddt=" + encodeURIComponent(new Date(fin).toISOString()) + "&body=" + encodeURIComponent(details || ""),
  };
}
const course = (app, id) => Catalog.get(id, app.customCourses);
