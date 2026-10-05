// ---------------------------------------------------------------------------
// Roster web API: one shared class database for the Netlify build.
//
// Storage is Netlify Blobs. Every write is an operation in a strictly ordered
// log (ops/<bucket>/<seq>), numbered by a compare-and-swap counter, so every
// classmate applies the same changes in the same order and no message is
// lost. A compacted snapshot keeps first loads fast. No logins: each browser
// holds a random id + key; a placement link (?p=…) is that student's way in,
// on any device; the organizer's link (?o=…) does the same for the organizer.
//
// makeHandler() takes the store factory, so tests can run it against a local
// Blobs server and the Netlify function passes the real getStore().
// ---------------------------------------------------------------------------
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const UID = /^w_[A-Za-z0-9]{16,40}$/;
const KEY = /^[A-Za-z0-9]{24,64}$/;
const TOKEN = /^[A-Za-z0-9]{12,48}$/;
const MAX_DOC = 150 * 1024;
const MAX_IMG = 450 * 1024;
const COMPACT_AFTER = 150;
const OWN_ONLY = new Set(["survey"]);
const OWN_OR_ORG = new Set(["reports"]);
const ORG_ONLY = new Set(["hub", "recaps", "config", "placements"]);
const OPEN = new Set(["courses", "board"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function merge(base, patch) {
  const out = isObj(base) ? { ...base } : {};
  for (const k of Object.keys(patch)) out[k] = isObj(patch[k]) ? merge(isObj(out[k]) ? out[k] : {}, patch[k]) : patch[k];
  return out;
}
export function applyOp(docs, op) {
  if (op.o === "set") docs[op.p] = op.d;
  else if (op.o === "update") { if (docs[op.p] !== undefined) docs[op.p] = merge(docs[op.p], op.d); }
  else if (op.o === "delete") delete docs[op.p];
}
const segs = (p) => (typeof p === "string" ? p.split("/") : []);
const validPath = (p) => { const s = segs(p); return s.length >= 2 && s.length <= 14 && s.length % 2 === 0 && s.every((x) => SEG.test(x)); };
export function canRead(path, uid, org) {
  const s = segs(path);
  if (s[0] === "data") return s[1] === "users" && !!uid && s[2] === uid;
  if (OWN_ONLY.has(s[0]) || OWN_OR_ORG.has(s[0])) return org || (!!uid && s[1] === uid);
  if (s[0] === "placements") return org;
  return true;
}
export function canWrite(path, uid, org) {
  if (!validPath(path)) return false;
  const s = segs(path);
  if (ORG_ONLY.has(s[0])) return org;
  if (s[0] === "members") return s.length === 2 && (s[1] === uid || org);
  if (OWN_ONLY.has(s[0])) return s.length === 2 && s[1] === uid;
  if (OWN_OR_ORG.has(s[0])) return s.length === 2 && (s[1] === uid || org);
  if (s[0] === "data") return s[1] === "users" && s[2] === uid;
  return OPEN.has(s[0]);
}

const pad = (n, w) => String(n).padStart(w, "0");
const opKey = (seq) => "ops/" + pad(Math.floor(seq / 1000), 6) + "/" + pad(seq, 10);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const fail = (status, code, message) => json({ error: { code, message } }, status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randomId(n) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export function makeHandler({ store, env = {}, draft }) {
  // Stores are opened per request (as Netlify's examples do): the Blobs context belongs to the
  // invocation. A function instance serves one request at a time, so these are safe to reuse.
  let data, auth, imgs;
  const open = () => { data = store("roster-data"); auth = store("roster-auth"); imgs = store("roster-img"); };

  // ---- identity ----
  async function identify(req, register) {
    const uid = req.headers.get("x-roster-uid"), key = req.headers.get("x-roster-key");
    if (!uid || !key || !UID.test(uid) || !KEY.test(key)) return null;
    const h = await sha256(key);
    const rec = await auth.get("u/" + uid, { type: "json" });
    if (rec) return rec.h === h ? uid : null;
    if (!register) return null;
    const r = await auth.setJSON("u/" + uid, { h, ts: Date.now() }, { onlyIfNew: true });
    if (r.modified) return uid;
    const again = await auth.get("u/" + uid, { type: "json" });
    return again && again.h === h ? uid : null;
  }
  async function organizers() { const o = await auth.get("organizers", { type: "json" }); return (o && o.uids) || []; }

  // ---- the log ----
  // Each op claims its slot by creating ops/<seq> with onlyIfNew: the first writer to create
  // slot N owns it, so slots fill contiguously with no overwrites and no read-modify-write.
  // "head" is only a hint (it may lag); readers probe forward past it until a slot is empty.
  async function hint() { const h = await data.get("head", { type: "json" }); return (h && h.seq) || 0; }
  async function append(ops, by) {
    let n = await hint();
    const t = Date.now(), seqs = [];
    for (const op of ops) {
      const k = randomId(10);
      for (let tries = 0; ; tries++) {
        n++;
        const r = await data.setJSON(opKey(n), { s: n, t, u: by, k, o: op.o, p: op.p, d: op.d }, { onlyIfNew: true });
        // Read the slot back: if another write landed in it, take the next one.
        if (r.modified) { const back = await data.get(opKey(n), { type: "json" }); if (back && back.k === k) { seqs.push(n); break; } }
        if (tries > 2000) throw Object.assign(new Error("busy"), { status: 503 });
      }
    }
    await data.setJSON("head", { seq: n });
    return seqs;
  }
  // Every op after `since`, in order, up to the true end of the log.
  async function tail(since) {
    const h = await hint();
    const ops = [];
    if (h > since) {
      const seqs = Array.from({ length: Math.min(h - since, 2000) }, (_, i) => since + 1 + i);
      const got = await pool(seqs, 24, (s) => data.get(opKey(s), { type: "json" }));
      got.forEach((op, i) => ops.push(op || { s: seqs[i], missing: true }));
    }
    let last = ops.length ? ops[ops.length - 1].s : since;
    for (let i = 0; i < 500 && ops.length < 2000; i++) {
      const op = await data.get(opKey(last + 1), { type: "json" });
      if (!op) break;
      ops.push(op); last = op.s;
    }
    return { ops, top: last };
  }
  async function snapshot() {
    const snap = (await data.get("snap", { type: "json" })) || { seq: 0, docs: {} };
    const { ops, top } = await tail(snap.seq);
    if (ops.length < COMPACT_AFTER) return { snap, ops, top };
    const docs = { ...snap.docs };
    for (const op of ops) if (!op.missing) applyOp(docs, op);
    const next = { seq: top, docs, ts: Date.now() };
    const latest = await data.get("snap", { type: "json" });
    if (!latest || latest.seq < next.seq) await data.setJSON("snap", next);
    return { snap: next, ops: [], top };
  }
  const visibleOp = (op, uid, org) => (op.missing || !canRead(op.p, uid, org) ? { s: op.s, skip: true } : op);

  // ---- routes ----
  async function route(req, path, url) {
    const method = req.method;
    if (path === "hello" && method === "GET") {
      const uid = await identify(req, false);
      const orgs = await organizers();
      return json({ roster: 1, ai: !!env.ANTHROPIC_API_KEY, hasOrganizer: orgs.length > 0, isOrganizer: !!uid && orgs.includes(uid) });
    }
    if (path === "sync" && method === "GET") {
      const uid = await identify(req, false);
      const org = !!uid && (await organizers()).includes(uid);
      const since = Math.max(0, parseInt(url.searchParams.get("since") || "0", 10) || 0);
      if (since > 0) {
        const { ops, top } = await tail(since);
        // A client far behind (or ahead of a reset log) gets a fresh snapshot instead.
        if (ops.length < 600 && !(top === since && since > (await hint()) + 5)) return json({ full: false, head: top, ops: ops.map((op) => visibleOp(op, uid, org)) });
      }
      const { snap, ops, top } = await snapshot();
      const docs = Object.entries(snap.docs).filter(([p]) => canRead(p, uid, org));
      return json({ full: true, seq: snap.seq, head: top, docs, ops: ops.map((op) => visibleOp(op, uid, org)) });
    }
    if (path === "write" && method === "POST") {
      const uid = await identify(req, true);
      if (!uid) return fail(401, "unauthenticated", "Unknown browser identity.");
      const org = (await organizers()).includes(uid);
      const body = await req.json().catch(() => null);
      const ops = body && Array.isArray(body.ops) ? body.ops : null;
      if (!ops || !ops.length || ops.length > 25) return fail(400, "invalid_argument", "Send 1 to 25 operations.");
      for (const op of ops) {
        if (!["set", "update", "delete"].includes(op.o)) return fail(400, "invalid_argument", "Unknown operation.");
        if (!canWrite(op.p, uid, org)) return fail(403, "invalid_argument", "You can't change " + op.p + ".");
        if (op.o !== "delete" && !isObj(op.d)) return fail(400, "invalid_argument", "Documents are objects.");
        if (op.o !== "delete" && JSON.stringify(op.d).length > MAX_DOC) return fail(413, "quota_exceeded", "That document is too large.");
      }
      const seqs = await append(ops.map((op) => ({ o: op.o, p: op.p, d: op.o === "delete" ? undefined : op.d })), uid);
      return json({ seqs });
    }
    if (path === "img" && method === "POST") {
      const uid = await identify(req, true);
      if (!uid) return fail(401, "unauthenticated", "Unknown browser identity.");
      const type = (req.headers.get("content-type") || "").split(";")[0];
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return fail(400, "invalid_argument", "Photos only.");
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > MAX_IMG) return fail(413, "quota_exceeded", "That photo is too large.");
      const id = randomId(24);
      await imgs.set(id, buf, { metadata: { type, by: uid, ts: Date.now() } });
      return json({ src: "/api/img/" + id });
    }
    if (path.startsWith("img/") && method === "GET") {
      const id = path.slice(4);
      if (!/^[A-Za-z0-9]{24}$/.test(id)) return fail(404, "not_found", "No such photo.");
      const got = await imgs.getWithMetadata(id, { type: "arrayBuffer" });
      if (!got) return fail(404, "not_found", "No such photo.");
      return new Response(got.data, { headers: { "content-type": (got.metadata && got.metadata.type) || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (path === "claim-organizer" && method === "POST") {
      const uid = await identify(req, true);
      if (!uid) return fail(401, "unauthenticated", "Unknown browser identity.");
      if ((await organizers()).length) return fail(409, "already_exists", "This class already has an organizer.");
      const r = await auth.setJSON("organizers", { uids: [uid], ts: Date.now() }, { onlyIfNew: true });
      if (!r.modified) return fail(409, "already_exists", "This class already has an organizer.");
      const token = randomId(32);
      await auth.setJSON("olink/" + token, { uid, key: req.headers.get("x-roster-key") });
      await auth.setJSON("olinkOf/" + uid, { token });
      await append([{ o: "set", p: "config/app", d: { organizers: [uid], ts: Date.now() } }], "system");
      return json({ ok: true, token });
    }
    if (path === "organizer-link" && method === "GET") {
      const uid = await identify(req, false);
      if (!uid || !(await organizers()).includes(uid)) return fail(403, "invalid_argument", "Organizer only.");
      const rec = await auth.get("olinkOf/" + uid, { type: "json" });
      return json({ token: rec ? rec.token : null });
    }
    if (path === "restore" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body || !TOKEN.test(body.token || "")) return fail(400, "invalid_argument", "Bad link.");
      const rec = await auth.get((body.kind === "o" ? "olink/" : "claim/") + body.token, { type: "json" });
      if (!rec) return fail(404, "not_found", "That link isn't valid.");
      return json({ uid: rec.uid, key: rec.key });
    }
    if (path === "placements" && method === "POST") {
      const uid = await identify(req, false);
      if (!uid || !(await organizers()).includes(uid)) return fail(403, "invalid_argument", "Organizer only.");
      const body = await req.json().catch(() => ({}));
      const list = Array.isArray(body.people) ? body.people.slice(0, 300) : [];
      const courses = Array.isArray(body.courses) ? body.courses.filter((c) => SEG.test(c)).slice(0, 10) : [];
      if (!list.length || !courses.length) return fail(400, "invalid_argument", "Add at least one person and one class.");
      const made = [];
      for (const p of list) {
        const name = String(p.name || "").trim().slice(0, 80);
        if (!name) continue;
        const token = randomId(20);
        await auth.setJSON("pl/" + token, { name, courses, ts: Date.now() });
        made.push({ token, name, contact: String(p.contact || "").slice(0, 120) });
      }
      for (let i = 0; i < made.length; i += 25) {
        await append(made.slice(i, i + 25).map((m) => ({ o: "set", p: "placements/" + m.token, d: { name: m.name, contact: m.contact, courses, ts: Date.now(), by: uid } })), uid);
      }
      return json({ placements: made.map(({ token, name }) => ({ token, name })) });
    }
    if (path === "open-placement" && method === "POST") {
      const uid = await identify(req, false);
      const body = await req.json().catch(() => ({}));
      if (!TOKEN.test(body.token || "")) return fail(400, "invalid_argument", "Bad link.");
      const pl = await auth.get("pl/" + body.token, { type: "json" });
      if (!pl) return fail(404, "not_found", "That placement link isn't valid.");
      const claim = await auth.get("claim/" + body.token, { type: "json" });
      if (claim && claim.uid !== uid) return json({ name: pl.name, courses: pl.courses, restore: { uid: claim.uid, key: claim.key } });
      return json({ name: pl.name, courses: pl.courses, claimed: !!claim });
    }
    if (path === "claim-placement" && method === "POST") {
      const uid = await identify(req, true);
      if (!uid) return fail(401, "unauthenticated", "Unknown browser identity.");
      const body = await req.json().catch(() => ({}));
      if (!TOKEN.test(body.token || "")) return fail(400, "invalid_argument", "Bad link.");
      if (!(await auth.get("pl/" + body.token, { type: "json" }))) return fail(404, "not_found", "That placement link isn't valid.");
      const r = await auth.setJSON("claim/" + body.token, { uid, key: req.headers.get("x-roster-key"), ts: Date.now() }, { onlyIfNew: true });
      if (!r.modified) {
        const claim = await auth.get("claim/" + body.token, { type: "json" });
        if (claim && claim.uid !== uid) return json({ restore: { uid: claim.uid, key: claim.key } });
        return json({ ok: true });
      }
      await append([{ o: "update", p: "placements/" + body.token, d: { claimedBy: uid, claimedAt: Date.now() } }], "system");
      return json({ ok: true });
    }
    if (path === "draft" && method === "POST") {
      const uid = await identify(req, false);
      if (!uid || !(await organizers()).includes(uid)) return fail(403, "invalid_argument", "Organizer only.");
      if (!env.ANTHROPIC_API_KEY || !draft) return fail(501, "not_granted", "Add ANTHROPIC_API_KEY in Netlify to draft recaps with Claude.");
      const body = await req.json().catch(() => ({}));
      const prompt = String(body.prompt || "").slice(0, 60000);
      if (prompt.length < 40) return fail(400, "invalid_argument", "Paste your notes first.");
      return json(await draft(prompt));
    }
    return fail(404, "not_found", "No such endpoint.");
  }

  return async function handler(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
    try { open(); return await route(req, path, url); }
    catch (e) { console.error(e); return fail(e.status || 500, e.code || (e.status === 503 ? "unavailable" : "internal"), e.code === "refused" ? "Claude declined to draft this. Write the lines yourself." : "Something went wrong. Try again."); }
  };
}
