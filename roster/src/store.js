// ---------------------------------------------------------------------------
// LocalDB — an in-page store with the same surface as the artifact `db`
// capability (doc / collection / where / orderBy / limit / get / set /
// update / delete / add / onSnapshot). Demo mode runs on it, so the demo and
// the live class chat share one code path. Nothing here leaves the browser.
// ---------------------------------------------------------------------------
const LocalDB = (() => {
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const freeze = (v) => {
    if (v && typeof v === "object") {
      Object.freeze(v);
      for (const k of Object.keys(v)) freeze(v[k]);
    }
    return v;
  };
  function merge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      out[k] = isObj(v) ? merge(isObj(out[k]) ? out[k] : {}, v) : clone(v);
    }
    return out;
  }
  const segs = (p) => p.split("/");
  function cmp(a, b) {
    if (a === b) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return a < b ? -1 : 1;
  }
  function test(v, op, x) {
    switch (op) {
      case "==": return v === x;
      case "!=": return v !== x;
      case "<": return v < x;
      case "<=": return v <= x;
      case ">": return v > x;
      case ">=": return v >= x;
      case "in": return x.includes(v);
      case "not-in": return !x.includes(v);
      case "array-contains": return Array.isArray(v) && v.includes(x);
      default: throw new TypeError("unsupported operator " + op);
    }
  }
  let idSeq = 0;
  const newId = () =>
    Date.now().toString(36) + (idSeq++).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 7);

  function create({ persistKey } = {}) {
    const docs = new Map(); // path -> frozen body
    const snaps = new Map(); // path -> cached snapshot for the current body
    const listeners = new Set();
    let flushQueued = false;

    if (persistKey) {
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw) for (const [p, d] of JSON.parse(raw)) docs.set(p, freeze(d));
      } catch (_) { /* storage unavailable: start fresh */ }
    }
    let saveTimer = null;
    function persist() {
      if (!persistKey) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { localStorage.setItem(persistKey, JSON.stringify([...docs])); } catch (_) { /* ignore */ }
      }, 250);
    }

    function snapOf(path) {
      const body = docs.get(path);
      const cached = snaps.get(path);
      if (cached && cached.__body === body) return cached;
      const id = segs(path).pop();
      const s = {
        id,
        exists: body !== undefined,
        data: () => body,
        metadata: { fromCache: false, hasPendingWrites: false },
      };
      Object.defineProperty(s, "__body", { value: body });
      snaps.set(path, s);
      return s;
    }

    function rowsFor(q) {
      const prefix = q.path + "/";
      const depth = segs(q.path).length + 1;
      let rows = [];
      for (const [p, d] of docs) {
        if (p.startsWith(prefix) && segs(p).length === depth) rows.push({ p, d });
      }
      rows = rows.filter(({ d }) => q.filters.every((f) => test(d[f.field], f.op, f.value)));
      if (q.order) {
        const dir = q.order.dir === "desc" ? -1 : 1;
        rows.sort((a, b) => {
          const av = a.d[q.order.field], bv = b.d[q.order.field];
          if (av === undefined || bv === undefined) return cmp(av, bv);
          return cmp(av, bv) * dir;
        });
      } else rows.sort((a, b) => cmp(a.p, b.p));
      if (q.lim) rows = rows.slice(0, q.lim);
      return rows.map((r) => snapOf(r.p));
    }

    function querySnap(list, prev) {
      const changes = [];
      const prevIdx = new Map((prev || []).map((s, i) => [s.id, i]));
      const nextIds = new Set(list.map((s) => s.id));
      list.forEach((s, i) => {
        if (!prevIdx.has(s.id)) changes.push({ type: "added", doc: s, oldIndex: -1, newIndex: i });
        else if (prev[prevIdx.get(s.id)] !== s) changes.push({ type: "modified", doc: s, oldIndex: prevIdx.get(s.id), newIndex: i });
      });
      (prev || []).forEach((s, i) => {
        if (!nextIds.has(s.id)) changes.push({ type: "removed", doc: s, oldIndex: i, newIndex: -1 });
      });
      return {
        docs: list,
        size: list.length,
        empty: list.length === 0,
        docChanges: () => changes,
        metadata: { fromCache: false, hasPendingWrites: false },
      };
    }

    function flush() {
      flushQueued = false;
      for (const l of listeners) {
        if (l.dead) continue;
        try {
          if (l.kind === "doc") {
            const s = snapOf(l.path);
            if (s !== l.last) { l.last = s; l.next(s); }
          } else {
            const list = rowsFor(l.q);
            const same = l.last && l.last.length === list.length && list.every((s, i) => s === l.last[i]);
            if (!same) { const prev = l.last; l.last = list; l.next(querySnap(list, prev)); }
          }
        } catch (e) { console.error(e); }
      }
    }
    function schedule() {
      if (!flushQueued) { flushQueued = true; setTimeout(flush, 0); }
    }
    function write(path, body) {
      if (body === undefined) docs.delete(path);
      else docs.set(path, freeze(clone(body)));
      persist();
      schedule();
    }

    function checkDoc(path) {
      if (segs(path).length % 2 !== 0) throw new TypeError("document path needs an even number of segments: " + path);
    }
    function checkCol(path) {
      if (segs(path).length % 2 !== 1) throw new TypeError("collection path needs an odd number of segments: " + path);
    }

    function docRef(path) {
      checkDoc(path);
      return {
        id: segs(path).pop(),
        path,
        async get() { return snapOf(path); },
        async set(data) { write(path, data); },
        async update(data) {
          if (!docs.has(path)) throw { code: "invalid_argument", message: "update needs an existing document" };
          write(path, merge(docs.get(path), data));
        },
        async delete() { write(path, undefined); },
        async acquire() { return { acquired: true }; },
        onSnapshot(next) {
          const l = { kind: "doc", path, next, last: null };
          listeners.add(l);
          schedule();
          return () => { l.dead = true; listeners.delete(l); };
        },
        collection(sub) { return colRef(path + "/" + sub); },
      };
    }

    function query(path, filters, order, lim) {
      const q = { path, filters, order, lim };
      return {
        where: (field, op, value) => query(path, [...filters, { field, op, value }], order, lim),
        orderBy: (field, dir) => query(path, filters, { field, dir: dir || "asc" }, lim),
        limit: (n) => query(path, filters, order, n),
        async get() { return querySnap(rowsFor(q), null); },
        onSnapshot(next) {
          const l = { kind: "query", q, next, last: null };
          listeners.add(l);
          schedule();
          return () => { l.dead = true; listeners.delete(l); };
        },
      };
    }

    function colRef(path) {
      checkCol(path);
      const base = query(path, [], null, 0);
      return {
        ...base,
        path,
        doc: (id) => docRef(path + "/" + (id || newId())),
        async add(data) { const r = docRef(path + "/" + newId()); await r.set(data); return r; },
      };
    }

    return {
      doc: docRef,
      collection: colRef,
      // Demo-only helpers (not part of the capability surface).
      _seed(entries) { for (const [p, d] of entries) docs.set(p, freeze(clone(d))); schedule(); },
      _isEmpty: () => docs.size === 0,
      _reset() { docs.clear(); snaps.clear(); try { localStorage.removeItem(persistKey); } catch (_) {} schedule(); },
      _dump: () => [...docs],
    };
  }
  return { create, newId };
})();
