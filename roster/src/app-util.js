// ---------------------------------------------------------------------------
// Shared utilities, data hooks and small components.
// ---------------------------------------------------------------------------
const { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, createContext, useContext } = window.htmPreact;

// ---- time: everything shown in Cambridge time ------------------------------
const TZ = "America/New_York";
const mkFmt = (o) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
const F = {
  time: mkFmt({ hour: "numeric", minute: "2-digit" }),
  wd: mkFmt({ weekday: "long" }),
  wds: mkFmt({ weekday: "short" }),
  md: mkFmt({ month: "short", day: "numeric" }),
  wmd: mkFmt({ weekday: "short", month: "short", day: "numeric" }),
  wlmd: mkFmt({ weekday: "long", month: "short", day: "numeric" }),
  mon: mkFmt({ month: "short" }),
  dnum: mkFmt({ day: "numeric" }),
  parts: mkFmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
};
const Clock = { offset: 0, now: () => Date.now() + Clock.offset };
function etParts(ts) {
  const p = {};
  for (const { type, value } of F.parts.formatToParts(ts)) p[type] = value;
  return p;
}
const dayKey = (ts) => { const p = etParts(ts); return p.year + "-" + p.month + "-" + p.day; };
const daysBetween = (a, b) => Math.round((Date.parse(dayKey(b) + "T12:00:00Z") - Date.parse(dayKey(a) + "T12:00:00Z")) / 864e5);
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
  if (days > 1 && days < 7) return F.wd.format(ts);
  return F.wmd.format(ts);
}
function countdown(ms) {
  if (ms <= 0) return "due";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  if (d >= 1) return d + "d " + h + "h";
  if (h >= 1) return h + "h " + String(m).padStart(2, "0") + "m";
  return m + ":" + String(s).padStart(2, "0"); // Saturn's ticking "24:59"
}
const dueWhen = (ts) => F.wmd.format(ts) + " · " + F.time.format(ts);
// datetime-local <-> epoch, in Cambridge time
function toLocalInput(ts) { const p = etParts(ts); return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute; }
function fromLocalInput(v) {
  if (!v) return null;
  const guess = Date.parse(v + ":00Z");
  const p = etParts(guess);
  const asUTC = Date.parse(p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":00Z");
  return guess - (asUTC - guess);
}
function useTick(ms) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

// ---- identity helpers ------------------------------------------------------
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const nameColor = (uid) => "var(--n" + (1 + (hash(uid || "") % 7)) + ")"; // Telegram's 7 sender hues
const initials = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const firstName = (n) => (n || "").split(/\s+/)[0] || n;
const shortHouse = (h) => Catalog.houseShort[h] || h;
const tagLine = (m) => [m && m.house ? shortHouse(m.house) : "", m && m.year ? m.year : ""].filter(Boolean).join(" ");

// Course identity: Saturn's emoji per class + Sidechat's verified gradient pairs.
const GRADS = [["#8483FF", "#5857FF"], ["#00EE6E", "#0C75E6"], ["#FF7B51", "#B2431F"], ["#FA81FF", "#722DFF"], ["#FFD305", "#F4B320"], ["#74DEEE", "#239EAB"], ["#00CBFE", "#0D13D5"], ["#15FF46", "#3FC0FF"], ["#FF47CC", "#69004C"], ["#0968E5", "#091970"], ["#FC40FF", "#0DD5B2"], ["#FF1885", "#FA81FF"], ["#D8DC44", "#228B3F"], ["#3E973C", "#0F430E"], ["#D9FB8A", "#B1FD00"]];
const COURSE_LOOK = {
  stat110: ["🎲", 0], lifesci1a: ["🧬", 1], expos20: ["✍️", 2], gened1079: ["🩺", 3], compsci50: ["💻", 4], econ10a: ["📈", 5],
  math21a: ["📐", 14], math21b: ["🧮", 6], gened1093: ["🌍", 7], physics15a: ["🍎", 8], compsci61: ["🖥️", 9],
};
function courseLook(id) {
  const f = COURSE_LOOK[id];
  const [emoji, gi] = f || [["📘", "📗", "📙", "📕", "📓"][hash(id) % 5], hash(id) % GRADS.length];
  const g = GRADS[gi];
  return { emoji, g, bg: "linear-gradient(145deg," + g[0] + "," + g[1] + ")" };
}
const prettyProblem = (p) => (/^(\d+)([a-z])$/i.test(p) ? p.replace(/^(\d+)([a-z])$/i, "$1($2)") : p);

// ---- links & mentions in message text --------------------------------------
const URL_SPLIT = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function richText(text, mentionNames) {
  const out = [];
  String(text || "").split(URL_SPLIT).forEach((part, i) => {
    if (i % 2 === 1) { out.push(html`<a href=${part} target="_blank" rel="noopener noreferrer">${part.replace(/^https?:\/\//, "")}</a>`); return; }
    if (!mentionNames || !mentionNames.length) { out.push(part); return; }
    const re = new RegExp("(@(?:" + mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "))", "g");
    part.split(re).forEach((p, j) => out.push(j % 2 === 1 ? html`<span class="mention">${p}</span>` : p));
  });
  return out;
}

// ---- local, per-viewer conveniences ----------------------------------------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } },
};

// ---- app context -------------------------------------------------------------
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

// ---- snapshot hooks ----------------------------------------------------------
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

// ---- small components ----------------------------------------------------------
function Icon({ name, size }) {
  return html`<span class="ic" dangerouslySetInnerHTML=${{ __html: iconSvg(name, size) }}></span>`;
}
function Avatar({ uid, size, online, name }) {
  const app = useApp();
  const p = name ? { ...app.person(uid), name, avatarUrl: "" } : app.person(uid);
  const s = size || 32;
  return html`<span class="av" style=${{ width: s + "px", height: s + "px", fontSize: Math.round(s * 0.38) + "px", background: p.color }} title=${p.name}>
    ${p.avatarUrl ? html`<img src=${p.avatarUrl} alt="" />` : initials(p.name)}
    ${online ? html`<span class="av-dot"></span>` : null}
  </span>`;
}
function AvatarStack({ ids, total, size }) {
  const shown = ids.slice(0, 4);
  return html`<span class="stack">${shown.map((id) => html`<${Avatar} key=${id} uid=${id} size=${size || 22} />`)}${total != null ? html`<span class="count">${total}</span>` : null}</span>`;
}
function Tile({ courseId, size }) {
  const look = courseLook(courseId);
  const s = size || 40;
  return html`<span class="tile" style=${{ width: s + "px", height: s + "px", background: look.bg, borderRadius: Math.round(s * 0.3) + "px" }}><span class="emo" style=${{ fontSize: Math.round(s * 0.52) + "px" }}>${look.emoji}</span></span>`;
}
function Modal({ title, onClose, children, footer, wide, icon }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="modal-h">${icon ? html`<${Icon} name=${icon} />` : null}<h2>${title}</h2><button class="iconbtn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></div>
      <div class="modal-b">${children}</div>
      ${footer ? html`<div class="modal-f">${footer}</div>` : null}
    </div>
  </div>`;
}
function Popover({ anchor, onClose, children, align }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect(), me = ref.current.getBoundingClientRect();
    let left = align === "right" ? r.right - me.width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - me.width - 8));
    let top = r.top - me.height - 6;
    if (top < 8) top = Math.min(r.bottom + 6, window.innerHeight - me.height - 8);
    setPos({ left, top });
  }, [anchor]);
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains(e.target))) onClose(); };
    const key = (e) => e.key === "Escape" && onClose();
    setTimeout(() => document.addEventListener("pointerdown", down), 0);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [anchor, onClose]);
  return html`<div class="pop" ref=${ref} style=${pos ? { left: pos.left + "px", top: pos.top + "px" } : { left: "-9999px", top: "0" }}>${children}</div>`;
}
const QUICK = ["👍", "❤️", "😂", "😭", "🙏", "💯"]; // WhatsApp/iMessage-size tray, chosen for a pset chat
const MORE_EMOJI = ["🔥", "👀", "🤯", "😮", "😅", "🫡", "✅", "❌", "✋", "🐣", "🎲", "📌", "🧠", "💀", "🫶", "👏", "🙌", "🤝", "😴", "☕", "📚", "✍️", "🎉", "🤔"];
function EmojiPicker({ anchor, onPick, onClose }) {
  const [more, setMore] = useState(false);
  return html`<${Popover} anchor=${anchor} onClose=${onClose}>
    <div class="emoji-tray">
      ${QUICK.map((e) => html`<button class="emo" onClick=${() => onPick(e)} aria-label=${"React " + e}>${e}</button>`)}
      <button onClick=${() => setMore(!more)} aria-label="More emoji"><${Icon} name="plus" /></button>
    </div>
    ${more ? html`<div class="emoji-grid">${MORE_EMOJI.map((e) => html`<button class="emo" onClick=${() => onPick(e)}>${e}</button>`)}</div>` : null}
  <//>`;
}
function calLinks(title, start, minutes, details) {
  const end = start + (minutes || 30) * 60e3;
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + z(start) + "/" + z(end) + "&details=" + encodeURIComponent(details || "");
  const o = "https://outlook.office.com/calendar/0/deeplink/compose?subject=" + encodeURIComponent(title) + "&startdt=" + encodeURIComponent(new Date(start).toISOString()) + "&enddt=" + encodeURIComponent(new Date(end).toISOString()) + "&body=" + encodeURIComponent(details || "");
  return { google: g, outlook: o };
}
