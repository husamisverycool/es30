// ---------------------------------------------------------------------------
// Web build: talks to the Netlify Function at /api. The browser keeps a full
// replica of the class database (a LocalDB with the same API the app already
// uses) and applies the server's ordered change log to it every few seconds.
// Writes go to the server first, then into the replica; when the log comes
// back, every op is re-applied in log order so all browsers converge.
// No logins: a random id + key lives in this browser; a placement link or the
// organizer's link restores that identity on another device.
// ---------------------------------------------------------------------------
const Remote = (() => {
  const API = "api";
  const ID_KEY = "roster:web:id", PL_KEY = "roster:web:placement";
  const rnd = (n) => { const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => abc[b % abc.length]).join(""); };
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } };
  let ident = null;
  const identity = () => ident || (ident = load(ID_KEY)) || (ident = { uid: "w_" + rnd(22), key: rnd(40) }, save(ID_KEY, ident), ident);
  const adopt = (id) => { ident = { uid: id.uid, key: id.key }; save(ID_KEY, ident); };

  async function call(method, path, body, opts) {
    const id = identity();
    const headers = { "x-roster-uid": id.uid, "x-roster-key": id.key };
    let payload;
    if (body instanceof Blob) { payload = body; headers["content-type"] = body.type; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
    let res;
    try { res = await fetch(API + "/" + path, { method, headers, body: payload, cache: "no-store", signal: opts && opts.signal }); }
    catch (e) { if (e && e.name === "AbortError") throw { code: "cancelled", message: "Stopped" }; throw { code: "unavailable", message: "Can't reach the class server." }; }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { code: (data && data.error && data.error.code) || (res.status === 403 ? "invalid_argument" : "unavailable"), message: (data && data.error && data.error.message) || "Request failed", status: res.status };
    return data;
  }
  async function probe() {
    try {
      const res = await fetch(API + "/hello", { cache: "no-store", headers: ident || load(ID_KEY) ? { "x-roster-uid": identity().uid, "x-roster-key": identity().key } : {} });
      if (!res.ok || !/json/.test(res.headers.get("content-type") || "")) return null;
      const j = await res.json();
      return j && j.roster ? j : null;
    } catch (_) { return null; }
  }

  function createDB() {
    const rep = LocalDB.create();
    let cursor = 0, gapPolls = 0, timer = null, inflight = null, stopped = false;
    const ready = (async () => { await pull(); })();
    function applyAll(ops) {
      ops.sort((a, b) => a.s - b.s);
      for (const op of ops) {
        if (op.s <= cursor) continue;
        if (op.s > cursor + 1) {
          if (++gapPolls < 3) break; // an op still being written; wait for it
          gapPolls = 0;
        }
        if (!op.skip && !op.missing) rep._apply(op);
        cursor = op.s;
      }
    }
    async function pull() {
      if (inflight) return inflight;
      inflight = (async () => {
        try {
          const r = await call("GET", "sync?since=" + cursor);
          if (r.full) { rep._replace(r.docs); cursor = r.seq; gapPolls = 0; }
          applyAll(r.ops || []);
        } finally { inflight = null; }
      })();
      return inflight;
    }
    // Poll fast while someone is active or the chat is moving, slower when idle, not when hidden
    // (keeps a two-week class well inside Netlify's free function allowance).
    let lastActive = Date.now(), lastChange = Date.now();
    for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) window.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true });
    const interval = () => { const idle = Date.now() - Math.max(lastActive, lastChange); return idle < 60e3 ? 3000 : idle < 300e3 ? 8000 : 20000; };
    function loop() {
      clearTimeout(timer);
      if (stopped) return;
      timer = setTimeout(async () => {
        if (!document.hidden) { const before = cursor; try { await pull(); } catch (_) { /* offline; try again */ } if (cursor !== before) lastChange = Date.now(); }
        loop();
      }, document.hidden ? 30000 : interval());
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pull().catch(() => {}); loop(); });
    window.addEventListener("focus", () => pull().catch(() => {}));
    ready.then(loop, loop);

    async function send(op) {
      await call("POST", "write", { ops: [op] });
      rep._apply(op); // show it now; the log re-applies it in order
      setTimeout(() => pull().catch(() => {}), 250);
    }
    function wrapDoc(path) {
      const r = rep.doc(path);
      return {
        id: r.id, path,
        get: () => r.get(),
        onSnapshot: (next, err) => r.onSnapshot(next, err),
        collection: (sub) => wrapCol(path + "/" + sub),
        set: (d) => send({ o: "set", p: path, d }),
        update: async (d) => {
          const s = await r.get();
          if (!s.exists) throw { code: "invalid_argument", message: "update needs an existing document" };
          return send({ o: "update", p: path, d });
        },
        delete: () => send({ o: "delete", p: path }),
      };
    }
    function wrapCol(path) {
      const c = rep.collection(path);
      return {
        where: c.where, orderBy: c.orderBy, limit: c.limit, get: c.get, onSnapshot: c.onSnapshot, path,
        doc: (id) => wrapDoc(path + "/" + (id || LocalDB.newId())),
        async add(d) { const ref = wrapDoc(path + "/" + LocalDB.newId()); await ref.set(d); return ref; },
      };
    }
    return {
      doc: wrapDoc, collection: wrapCol, ready,
      sync: () => pull(),
      stop: () => { stopped = true; clearTimeout(timer); },
      // Photos go to the server's photo store; documents keep a short URL.
      async _upload(dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        const r = await call("POST", "img", blob);
        return r.src.replace(/^\//, "");
      },
      _dump: () => rep._dump(),
    };
  }

  // Claude drafting through the server (only when the site has an API key).
  const sample = {
    async json(input, opts) {
      const r = await call("POST", "draft", { prompt: String(input) }, opts).catch((e) => { throw e.code === "not_granted" || e.status === 501 ? { code: "not_granted", message: e.message } : e; });
      const text = r.text || "";
      if (opts && opts.onText) opts.onText({ text, delta: text });
      const m = text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
      try { return JSON.parse(m ? m[0] : text); } catch (_) { return null; }
    },
    limits: async () => ({ images: false }),
  };
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv" : "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };

  // Boot for the web build: null when there is no /api (a static-only deploy).
  async function connect(params) {
    if (location.protocol === "file:") return null;
    let hello = await probe();
    if (!hello) return null;
    const strip = (k) => { try { const u = new URL(location.href); u.searchParams.delete(k); history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (_) { /* ignore */ } };
    // ?o=<token>: the organizer's own link, on a new device.
    const o = params.get("o");
    if (o) { try { adopt(await call("POST", "restore", { token: o, kind: "o" })); } catch (_) { /* bad link: continue as a visitor */ } strip("o"); }
    // ?p=<token>: a student's placement link. If that student already joined, this device becomes them.
    let placement = load(PL_KEY);
    const p = params.get("p");
    if (p) {
      try {
        const r = await call("POST", "open-placement", { token: p });
        if (r.restore) adopt(r.restore);
        placement = { token: p, name: r.name, courses: r.courses };
        save(PL_KEY, placement);
      } catch (_) { /* invalid link */ }
      strip("p");
    }
    identity();
    hello = (await probe()) || hello;
    const db = createDB();
    try { await db.ready; } catch (_) { /* first sync failed; the loop retries */ }
    return {
      hello, db, placement, uid: identity().uid,
      remote: {
        claimOrganizer: () => call("POST", "claim-organizer"),
        organizerLink: async () => { const r = await call("GET", "organizer-link"); return r.token ? location.origin + location.pathname + "?o=" + r.token : null; },
        createPlacements: (people, courses) => call("POST", "placements", { people, courses }),
        claimPlacement: async (token) => { const r = await call("POST", "claim-placement", { token }); if (r.restore) { adopt(r.restore); return { switched: true }; } return { ok: true }; },
        placementLink: (token) => location.origin + location.pathname + "?p=" + token,
        resync: () => db.sync(),
      },
    };
  }
  return { connect, probe, sample, downloads, identity };
})();
