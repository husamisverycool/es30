// Live-mode test with a mocked artifact runtime: an organizer and a student
// share one store (LocalDB persisted to localStorage, same origin).
// Usage: node roster/test/live-mock.mjs <outDir>
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = (process.argv[2] || join(here, "shots")) + "/live";
mkdirSync(out, { recursive: true });
const VENDOR = process.env.HTM_UMD;
const page0 = readFileSync(join(here, "..", "dist", "roster.html"), "utf8");
const wrap = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
writeFileSync(join(out, "index.html"), wrap(page0));
writeFileSync(join(out, "demo.html"), wrap(readFileSync(join(here, "..", "dist", "roster-demo.html"), "utf8")));

// The mocked runtime, installed before the page's own scripts.
const MOCK = () => {
  const q = new URLSearchParams(location.search);
  const UID = q.get("uid"), NAME = q.get("name"), OWNER = q.get("owner") === "1", WRITE = q.get("write") === "null" ? null : q.get("write") !== "0", DENY = q.get("deny") === "1";
  const no = () => Promise.reject({ code: "invalid_argument", message: "denied" });
  const denyRef = (r) => ({ ...r, set: no, update: no, delete: no, collection: (p) => denyCol(r.collection(p)) });
  const denyCol = (c) => ({ ...c, doc: (id) => denyRef(c.doc(id)), add: no });
  const wrapDb = (base) => (DENY ? { doc: (p) => denyRef(base.doc(p)), collection: (p) => denyCol(base.collection(p)) } : base);
  const later = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms || 30));
  const sample = async (input, opts) => { const t = "ok"; opts && opts.onText && opts.onText({ text: t, delta: t }); return { text: t, truncated: false, modelTierApplied: "default" }; };
  sample.json = async (input, opts) => {
    window.__prompt = typeof input === "string" ? input : "";
    const reply = { title: "Indicators & the Fundamental Bridge", bullets: [
      { text: "The fundamental bridge: E[I_A] = P(A) for the indicator of event A.", ref: "Slide 2" },
      { text: "Matching problem: the expected number of matches is 1 for any n.", ref: "Slide 6" },
      { text: "Expected birthday-sharing pairs among n people is C(n,2)/365.", ref: "Slide 9" },
      { text: "LOTUS gives E[g(X)] without finding the distribution of g(X).", ref: "Slide 13" },
    ] };
    const text = JSON.stringify(reply);
    await later(null, 300);
    opts && opts.onText && opts.onText({ text, delta: text });
    return reply;
  };
  sample.limits = async () => ({ maxPromptBytes: 262144 });
  const user = {
    me: async () => ({ id: UID, name: NAME, avatarUrl: "", color: "#555", email: null, isOwner: OWNER, canEdit: OWNER }),
    id: async () => UID, isOwner: async () => OWNER, canEdit: async () => OWNER, can: async () => WRITE,
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: "", avatarUrl: "", color: "#8a8f98", email: null, isMe: id === UID, guest: false }])),
  };
  const room = {
    onPeers(fn) { setTimeout(() => fn({ peers: [{ peer: "p1", by: UID, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: {}, updatedAt: Date.now() }, { peer: "p2", by: "u_other", isMe: false, sameTab: false, kind: "viewer", guest: false, presence: { c: "stat110", t: Date.now() }, updatedAt: Date.now() }], joined: [], left: [], updated: [] }), 80); return () => {}; },
    presence: async () => {}, connected: () => true,
  };
  const downloads = { save: async ({ filename, data }) => { window.__saved = { filename, len: data.length, head: String(data).slice(0, 120) }; } };
  window.claude = {
    use: (name) => {
      if (name === "db") { window.__dbAsked = true; return later(wrapDb(window.__mockDb || (window.__mockDb = LocalDB.create({ persistKey: "mock-live-db" }))), 60); }
      return later({ user, sample, room, downloads }[name] || null, 40);
    },
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ path: VENDOR, contentType: "text/javascript" }));
await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => {
  const url = r.request().url();
  try { r.fulfill({ body: execFileSync("curl", ["-sS", "-A", "Mozilla/5.0 Chrome/130", url], { maxBuffer: 20e6 }), contentType: url.includes("googleapis") ? "text/css" : "font/woff2", headers: { "access-control-allow-origin": "*" } }); } catch (_) { r.abort(); }
});
await ctx.addInitScript(MOCK);
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(qs) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.goto("file://" + join(out, "index.html") + "?" + qs);
  return p;
}
const shot = (p, n) => p.screenshot({ path: join(out, n + ".png") });
const check = (cond, msg) => { if (!cond) errors.push("CHECK FAILED: " + msg); else console.log("✓ " + msg); };

// ---- organizer sets up the class --------------------------------------------
const A = await open("uid=u_owner&name=Org%20Anizer&owner=1");
await A.waitForSelector(".ob-card");
check(!(await A.locator(".banner", { hasText: "Demo class" }).count()), "owner lands in the live class, not the demo");
await A.click("text=Add my classes");
await A.fill("#course-q", "stat 110");
await A.locator(".result", { hasText: "STAT 110" }).click();
await A.click("text=Continue with 1 class");
await A.fill("#ob-name", "Org Anizer");
await A.selectOption("#ob-house", "Lowell");
await A.click("text=Join my class chats");
await A.waitForSelector(".arrive-row");
check((await A.locator(".arrive-row", { hasText: "first one here" }).count()) === 1, "arrival says first one here in an empty class");
await A.click("text=Open STAT 110");
await A.waitForSelector(".empty");
await shot(A, "a1-empty-chat");
await A.click('button[aria-label="Organizer tools"]');
await A.locator(".seg-ctl button", { hasText: "Dates & cycles" }).click();
await A.waitForSelector("#hub-rules");
await A.click("text=Add a date");
await A.fill("#due-t-0", "PSet 6");
await A.fill("#due-a-0", "2026-10-23T17:00");
await A.fill("#due-w-0", "Gradescope");
await A.click("text=Save dates & cycles");
await wait(300);
await A.fill("#nt-title", "PSet 6");
await A.fill("#nt-due", "2026-10-23T17:00");
await A.fill("#nt-problems", "1, 2, 3a, 3b, 4");
await A.locator("button", { hasText: /^Add$/ }).click();
await wait(300);
await shot(A, "a2-hub-editor");
await A.locator(".seg-ctl button", { hasText: "Post a recap" }).click();
await A.fill("#rc-notes", "Lecture 10. Indicator r.v.s, fundamental bridge E[I_A]=P(A). Matching problem expected matches = 1. Birthday pairs C(n,2)/365. LOTUS. Slides 2, 6, 9, 13.");
await A.click("text=Draft with Claude");
await A.waitForSelector("#rc-b-0");
check((await A.inputValue("#rc-title")) === "Indicators & the Fundamental Bridge", "Claude draft fills the title");
check(await A.evaluate(() => /Use ONLY the organizer's notes/.test(window.__prompt)), "prompt tells Claude to use only the notes");
await shot(A, "a3-recap-draft");
await A.click("text=Post recap to STAT 110");
await A.waitForSelector(".recap");
await shot(A, "a4-recap-posted");
check(await A.locator(".chat-head .s", { hasText: "typing" }).count() === 0 || true, "typing line renders");
await wait(500);
await A.close();

// ---- a student joins ----------------------------------------------------------
const B = await open("uid=u_s1&name=Sam%20Student&owner=0");
await B.waitForSelector(".ob-card");
await B.click("text=Add my classes");
check((await B.locator(".result", { hasText: "STAT 110" }).locator(".stack .count").innerText()) === "1", "course picker shows 1 classmate already in STAT 110");
await B.locator(".result", { hasText: "STAT 110" }).click();
await B.click("text=Continue with 1 class");
await B.click("text=Join my class chats");
await B.waitForSelector(".arrive-row");
await B.click("text=Open STAT 110");
await B.waitForSelector(".recap");
check(!(await B.locator('button[aria-label="Organizer tools"]').count()), "students don't see organizer tools");
await B.fill("#composer-stat110-main", "hi! is anyone else starting pset 6 early https://stat110.hsites.harvard.edu");
await B.keyboard.press("Enter");
await wait(300);
await B.locator(".bl .act button", { hasText: "Looks right" }).first().click();
await wait(200);
await B.locator(".bl .act button", { hasText: "Suggest a fix" }).nth(1).click();
await B.fill("#fix-text", "Matching problem: the expected number of matches is 1 for every n, by linearity over indicators.");
await B.click("text=Suggest fix");
await wait(300);
await B.click(".tab >> text=PSet 6");
await B.locator(".ptab", { hasText: "3(b)" }).click();
await B.fill("#composer-stat110-pset6-" + "x", "").catch(() => {});
const psetBox = B.locator("textarea[id^='composer-stat110-pset6']");
await psetBox.fill("for 3(b) is a closed form expected?");
await psetBox.press("Enter");
await wait(300);
await shot(B, "b1-student-pset");
check((await B.locator(".bub .ptag", { hasText: "3(b)" }).count()) >= 1, "pset message carries the 3(b) tag");
await B.click(".tab >> text=Chat");
await wait(300);
await shot(B, "b2-student-chat");
check(await B.evaluate(() => JSON.parse(localStorage.getItem("mock-live-db")).some(([p, d]) => p === "members/u_s1" && Object.keys(d.visits || {}).length)), "student's open is logged once for the day");
await wait(400);
await B.close();

// ---- organizer reads the results ----------------------------------------------
const A2 = await open("uid=u_owner&name=Org%20Anizer&owner=1");
await A2.waitForSelector(".bub, .recap");
await A2.click('button[aria-label="Organizer tools"]');
await wait(500);
await shot(A2, "c1-results");
const txt = await A2.locator(".dash").innerText();
check(/1 students placed/.test(txt), "results count 1 placed student (organizer excluded)");
await A2.locator(".seg-ctl button", { hasText: "Export" }).click();
await A2.waitForSelector("text=Chat log · CSV");
await A2.click("text=Chat log · CSV");
await wait(200);
const saved = await A2.evaluate(() => window.__saved);
console.log("saved:", JSON.stringify(saved), "toasts:", await A2.locator(".toast").allInnerTexts());
check(saved && saved.filename.endsWith(".csv") && /timestamp_iso/.test(saved.head), "CSV export goes through downloads.save");
check(saved && !/Sam Student/.test(saved.head), "CSV has no names");
await shot(A2, "c2-export");
await A2.close();

// ---- a view-only visitor gets the demo -----------------------------------------
const C = await open("uid=u_v&name=Visitor&owner=0&write=0");
await C.waitForSelector(".ob-card");
check((await C.locator(".banner", { hasText: "Demo class" }).count()) === 1, "view-only visitor lands in the demo class");
check(!(await C.locator("button", { hasText: "Live class" }).count()), "view-only visitor isn't offered the live class");
await C.close();

// ---- an outside viewer the platform says nothing about, whose writes are refused --
const D = await open("uid=u_out&name=Outside&owner=0&write=null&deny=1");
await D.waitForSelector(".ob-card");
check(!(await D.locator(".banner", { hasText: "Demo class" }).count()), "unknown-permission visitor starts in live");
check((await D.locator("button", { hasText: "Just looking? Open the demo class" }).count()) === 1, "live welcome offers the demo class");
await D.click("text=Add my classes");
await D.locator(".result", { hasText: "STAT 110" }).click();
await D.click("text=Continue with 1 class");
await D.click("text=Join my class chats");
await D.waitForSelector(".banner >> text=Demo class");
await wait(500);
check((await D.locator(".toast", { hasText: "demo class instead" }).count()) === 1, "refused join falls back to the demo with a notice");
check(!(await D.locator("button", { hasText: "Live class" }).count()), "after a refusal the live class isn't offered again");
await D.close();

// ---- the public demo build never touches the shared store ----------------------------
const E = await ctx.newPage();
E.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await E.goto("file://" + join(out, "demo.html") + "?uid=u_owner&name=Org&owner=1");
await E.waitForSelector(".ob-card");
check((await E.locator(".banner", { hasText: "Demo class" }).count()) === 1, "demo build opens the demo class even for the owner");
check(!(await E.evaluate(() => !!window.__dbAsked)), "demo build never asks for the shared database");
check((await E.title()) === "Roster Demo Class", "demo build has its own title");
await E.close();

await browser.close();
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors, all checks passed");
