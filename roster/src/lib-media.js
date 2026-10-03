// ---------------------------------------------------------------------------
// Photos and math.
// Photos ride inside message documents (a db document holds up to 256 KiB),
// so they're downscaled and re-encoded on the sender's device first.
// Demo "photos of the board" are drawn on a canvas at runtime and referenced
// as "gen:<key>" so the demo store stays small.
// Math between $…$ renders as native MathML through KaTeX (no fonts or CSS).
// ---------------------------------------------------------------------------
const Media = (() => {
  const MAX_BYTES = 170 * 1024;
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function compress(file, opts) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      let side = (opts && opts.max) || 1280, q = 0.78, out = null, w = 0, h = 0;
      for (let pass = 0; pass < 7; pass++) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        w = Math.max(1, Math.round(img.naturalWidth * k)); h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        out = c.toDataURL("image/jpeg", q);
        if (out.length * 0.75 <= MAX_BYTES) break;
        if (q > 0.55) q -= 0.1; else side = Math.round(side * 0.8);
      }
      return { src: out, w, h };
    } finally { URL.revokeObjectURL(url); }
  }

  // ---- demo chalkboard photos ----
  const BOARDS = {
    chicks: { lines: ["100 chicks in a circle", "each pecks L or R  (p = 1/2)", "I_j = 1 if chick j unpecked", "P(I_j = 1) = 1/2 · 1/2 = 1/4", "E[# unpecked] = 100 · 1/4 = 25"], tilt: -1.4 },
    geom: { lines: ["Geom(p): # failures before 1st success", "P(X = k) = q^k p ,  k = 0,1,2,…", "E[X] = q/p", "FS(p) = Geom(p) + 1  →  E = 1/p"], tilt: 1.1 },
    lotus: { lines: ["LOTUS", "E[g(X)] = Σ g(x) P(X = x)", "Var(X) = E[X²] − (EX)²", "Bin(n,p):  Var = npq"], tilt: -0.6 },
    folding: { lines: ["Protein folding", "ΔG = ΔH − TΔS", "hydrophobic effect → entropy of water", "α-helix: i → i+4 H-bonds"], tilt: 0.8, green: false },
  };
  const cache = {};
  function board(key) {
    if (cache[key]) return cache[key];
    const spec = BOARDS[key];
    if (!spec || typeof document === "undefined") return null;
    const W = 960, H = 720, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // room + board
    g.fillStyle = "#2c2a27"; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate((spec.tilt * Math.PI) / 180); g.translate(-W / 2, -H / 2);
    const grad = g.createLinearGradient(0, 0, W, H);
    if (spec.green === false) { grad.addColorStop(0, "#f4f4f1"); grad.addColorStop(1, "#dfe0dc"); } else { grad.addColorStop(0, "#2f4a3c"); grad.addColorStop(1, "#22362c"); }
    g.fillStyle = grad; g.fillRect(40, 50, W - 80, H - 110);
    // eraser haze
    for (let i = 0; i < 26; i++) {
      g.fillStyle = spec.green === false ? "rgba(120,130,140,.05)" : "rgba(255,255,255,.035)";
      g.beginPath(); g.ellipse(80 + rnd() * (W - 160), 90 + rnd() * (H - 200), 60 + rnd() * 140, 18 + rnd() * 30, rnd(), 0, 7); g.fill();
    }
    g.fillStyle = "#8a6a43"; g.fillRect(40, H - 64, W - 80, 14);
    // chalk / marker text
    g.textBaseline = "top";
    spec.lines.forEach((ln, i) => {
      const y = 100 + i * 108, size = i === 0 ? 50 : 40;
      g.font = (i === 0 ? "600 " : "500 ") + size + "px 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive";
      for (let pass = 0; pass < 3; pass++) {
        g.fillStyle = spec.green === false ? "rgba(23,56,140," + (0.55 + pass * 0.15) + ")" : "rgba(245,245,235," + (0.35 + pass * 0.2) + ")";
        g.fillText(ln, 90 + rnd() * 3 + (i ? 26 : 0), y + rnd() * 3);
      }
    });
    g.restore();
    // phone-photo vignette
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return (cache[key] = c.toDataURL("image/jpeg", 0.8));
  }
  const resolve = (src) => (typeof src === "string" && src.startsWith("gen:") ? board(src.slice(4)) : src);

  // ---- math ----
  const MATH = /\$([^$\n]{1,200})\$/g;
  function mathHtml(tex) {
    if (!window.katex) return null;
    try { return window.katex.renderToString(tex, { output: "mathml", throwOnError: false, strict: "ignore" }); } catch (_) { return null; }
  }
  return { compress, board, resolve, MATH, mathHtml };
})();
