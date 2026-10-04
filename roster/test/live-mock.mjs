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
    me: async () => ({ id: UID, name: NAME, avatarUrl: "", color: "#555", email: q.get("email") || null, isOwner: OWNER, canEdit: OWNER }),
    id: async () => UID, isOwner: async () => OWNER, canEdit: async () => OWNER, can: async () => WRITE,
    search: async (qq) => [{ id: "u_s1", name: "Sam Student", avatarUrl: "", color: "#444", email: null, isMe: false, guest: false }].filter((p) => qq && p.name.toLowerCase().includes(qq.toLowerCase())),
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
await ctx.route("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", (r) => r.fulfill({ path: process.env.KATEX_JS, contentType: "text/javascript" }));
await ctx.route("https://cdn.jsdelivr.net/npm/htm@3.1.1/**", (r) => r.fulfill({ path: VENDOR, contentType: "text/javascript" }));
await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
await ctx.addInitScript(MOCK);
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(qs, file) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push("console: " + m.text()); });
  await p.goto("file://" + join(out, file || "index.html") + "?" + qs);
  return p;
}
const shot = (p, n) => p.screenshot({ path: join(out, n + ".png") });
const check = (cond, msg) => { if (!cond) errors.push("CHECK FAILED: " + msg); else console.log("✓ " + msg); };
const dbDump = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("mock-live-db") || "[]"));
const demoBar = (p) => p.locator(".modebar", { hasText: "Demo class" }).count();

// Live onboarding: nothing is prefilled except what the account provides.
async function onboard(p, { pick, year, house, placed }) {
  await p.waitForSelector(".step-welcome");
  await p.click("text=Get started");
  await p.waitForSelector(".cres");
  if (!placed) { await p.fill("#course-q", pick); await p.locator(".cres", { hasText: "STAT 110" }).click(); }
  await p.click(".ob-cta button.primary"); // classes
  await p.waitForSelector(".verify");
  await p.click(".ob-cta button.primary"); // verify
  await p.waitForSelector("#ob-name");
  await p.click(".ob-cta button.primary"); // name
  await p.click(".seg.wide >> text=20" + year.slice(1));
  await p.click(".housechip >> text=" + house);
  await p.click(".ob-cta button.primary"); // house
  await p.click(".concpick .chip >> text=Undeclared");
  await p.click(".ob-cta button.primary"); // conc
  await p.click(".ob-cta button.primary"); // sections
  await p.click(".ob-cta button.primary"); // prompts (skip)
  await p.click("text=Agree and continue");
  await p.waitForSelector(".step-friends");
  await p.click(".ob-cta button.primary"); // friends
}

// ---- organizer sets up the class --------------------------------------------
const A = await open("uid=u_owner&name=Org%20Anizer&owner=1");
await A.waitForSelector(".step-welcome");
check(!(await demoBar(A)), "owner lands in the live class, not the demo");
await onboard(A, { pick: "stat 110", year: "'28", house: "Lowell" });
await A.waitForSelector(".step-arrive", { timeout: 15000 });
check((await A.locator(".arrive-row", { hasText: "first one here" }).count()) >= 1, "arrival says first one here in an empty class");
check((await A.locator(".arrive-row", { hasText: "Lowell" }).count()) === 1, "organizer is placed in their House chat too");
await A.click("text=Say hi in STAT 110");
await A.waitForSelector(".classview");
await shot(A, "a1-first-chat");
await A.click('button[aria-label="Organizer tools"]');
await A.click(".tabs.inset >> text=Dates");
await A.click("text=Add a date");
const due = A.locator(".dcard").first().locator(".erow").first().locator("input");
await due.nth(0).fill("PSet 6"); await due.nth(1).fill("2026-10-23T17:00"); await due.nth(2).fill("Gradescope");
await A.click("text=Save dates & cycles");
await wait(300);
const nt = A.locator(".dcard").last().locator(".erow").last().locator("input");
await nt.nth(0).fill("PSet 6"); await nt.nth(1).fill("2026-10-23T17:00"); await nt.nth(2).fill("1, 2, 3a, 3b, 4");
await A.locator(".dcard").last().locator("button", { hasText: /^Add$/ }).click();
await wait(300);
check((await dbDump(A)).some(([p, d]) => p.startsWith("courses/stat110/threads/") && d.problems.length === 5), "PSet board saved with 5 problems");
await shot(A, "a2-dates");
await A.click(".tabs.inset >> text=Recap");
await A.fill(".dash textarea", "Lecture 10. Indicator r.v.s, fundamental bridge E[I_A]=P(A). Matching problem expected matches = 1. Birthday pairs C(n,2)/365. LOTUS. Slides 2, 6, 9, 13.");
await A.click("text=Draft with Claude");
await A.waitForSelector(".draftlist");
check((await A.locator(".field-row.four input").nth(2).inputValue()) === "Indicators & the Fundamental Bridge", "Claude draft fills the title");
check(await A.evaluate(() => /Use ONLY the organizer's notes/.test(window.__prompt)), "prompt tells Claude to use only the notes");
check(await A.locator("button", { hasText: /^Review 4 lines first$/ }).isDisabled(), "can't post until every drafted line is reviewed");
for (let i = 0; i < 3; i++) await A.locator(".dl").nth(i).locator("button", { hasText: "Keep" }).click();
await A.locator(".dl").nth(3).locator("button", { hasText: "Remove" }).click();
await shot(A, "a3-recap-review");
await A.click("text=Post recap to STAT 110");
await A.waitForSelector(".recap");
check((await A.locator(".recap .line").count()) === 3, "removed line isn't posted");
await A.click('button[aria-label="Organizer tools"]');
await A.click(".tabs.inset >> text=Placement");
await A.fill(".dash .searchwrap input", "sam");
await A.click(".dash .prow >> text=Pick");
await A.click("text=Place 1 person");
await wait(400);
check((await dbDump(A)).some(([p, d]) => p === "placements/u_s1" && d.courses.includes("stat110")), "organizer places a student by picking them from the directory");
await shot(A, "a4-recap-posted");
await A.close();

// ---- a placed student joins ------------------------------------------------------
const B = await open("uid=u_s1&name=Sam%20Student&owner=0");
await B.waitForSelector(".step-welcome");
await B.click("text=Get started");
await B.waitForSelector(".ob-banner");
check((await B.locator(".ob-banner", { hasText: "added you to STAT 110" }).count()) === 1, "placed student sees they were added to STAT 110");
check((await B.locator(".pickchip", { hasText: "STAT 110" }).count()) === 1, "STAT 110 is preselected from the placement");
check((await B.locator(".cres", { hasText: "STAT 110" }).locator(".cres-who").innerText()).includes("1 on Roster"), "course picker shows 1 classmate already in STAT 110");
await B.click("text=Back").catch(() => {});
await B.goto(B.url());
await onboard(B, { placed: true, year: "'29", house: "Pforzheimer" });
await B.waitForSelector(".step-arrive", { timeout: 15000 });
await B.click("text=Say hi in STAT 110");
await B.waitForSelector(".recap");
check(!(await B.locator('button[aria-label="Organizer tools"]').count()), "students don't see organizer tools");
const box = B.locator("textarea[id^='composer-stat110-main']");
check((await box.inputValue()).startsWith("Hi! I'm Sam"), "intro message is prefilled");
await box.fill("hi! is anyone else starting pset 6 early https://stat110.hsites.harvard.edu");
await box.press("Enter");
await wait(300);
await B.locator(".line-acts button", { hasText: "Looks right" }).first().click();
await wait(200);
await B.locator(".line-acts button", { hasText: "Fix" }).nth(1).click();
await B.click(".chip >> text=Missing a step");
await B.fill("#fix-text", "Matching problem: the expected number of matches is 1 for every n, by linearity over indicators.");
await B.click("text=Suggest fix");
await wait(300);
await B.click(".tab >> text=PSet 6");
await B.locator(".prob-main", { hasText: "3(b)" }).click();
const psetBox = B.locator("textarea[id^='composer-stat110-pset6']");
await psetBox.fill("for 3(b) is a closed form expected?");
await psetBox.press("Enter");
await wait(300);
await shot(B, "b1-student-pset");
check((await B.locator(".bub .pchip", { hasText: "3(b)" }).count()) >= 1, "pset message carries the 3(b) tag");
await B.click(".tab >> text=Chat");
await B.click(".cbtn");
await B.click(".attach-o >> text=Study session");
await B.fill(".sheet input.lg", "PSet 6 early start");
await B.click(".sheet .chip >> text=Cabot Library");
await B.click("text=Post to STAT 110");
await wait(400);
check((await dbDump(B)).some(([p, d]) => p.startsWith("courses/stat110/messages/") && d.kind === "event" && d.event.rsvps.u_s1.s === "going"), "study session posted with its host going");
await B.click(".nav-i >> text=Board");
await B.click(".pagehead >> text=Post");
await B.click(".catopt >> text=Marketplace");
await B.fill(".sheet input.lg", "Selling: Stat 110 textbook");
await B.fill(".sheet input[inputmode=decimal]", "20");
await B.click(".sheet-f >> text=Post");
await wait(400);
check((await dbDump(B)).some(([p, d]) => p.startsWith("board/") && d.price === "$20"), "board post saved with a price");
await shot(B, "b2-board");
check((await dbDump(B)).some(([p, d]) => p === "members/u_s1" && Object.keys(d.visits || {}).length && d.verified === "org" && d.pledgeAt), "student's open, verification and pledge are recorded");
await B.close();

// ---- organizer reads the results ----------------------------------------------
const A2 = await open("uid=u_owner&name=Org%20Anizer&owner=1");
await A2.waitForSelector(".classview, .page");
await A2.click(".side-c >> text=STAT 110");
await A2.click('button[aria-label="Organizer tools"]');
await A2.waitForSelector(".kpis");
await shot(A2, "c1-results");
const txt = await A2.locator(".dash").innerText();
check(/1 students placed/.test(txt), "results count 1 placed student (organizer excluded)");
await A2.click(".tabs.inset >> text=Export");
await A2.waitForSelector("text=Event log · CSV");
await A2.click("text=Event log · CSV");
await wait(200);
const saved = await A2.evaluate(() => window.__saved);
check(saved && saved.filename.endsWith(".csv") && /timestamp_iso/.test(saved.head), "CSV export goes through downloads.save");
check(saved && !/Sam Student/.test(saved.head), "CSV has no names");
await A2.keyboard.press("Escape");
await A2.click(".nav-i >> text=Activity");
await wait(300);
await shot(A2, "c2-activity");
await A2.close();

// ---- a view-only visitor gets the demo -----------------------------------------
const C = await open("uid=u_v&name=Visitor&owner=0&write=0");
await C.waitForSelector(".step-welcome");
check((await demoBar(C)) === 1, "view-only visitor lands in the demo class");
check(!(await C.locator(".modebar button", { hasText: "Join the live class" }).count()), "view-only visitor isn't offered the live class");
await C.close();

// ---- an outside viewer the platform says nothing about, whose writes are refused --
const D = await open("uid=u_out&name=Outside&owner=0&write=null&deny=1");
await D.waitForSelector(".step-welcome");
check(!(await demoBar(D)), "unknown-permission visitor starts in live");
check((await D.locator("button", { hasText: "Just looking? Open the demo class" }).count()) === 1, "live welcome offers the demo class");
await onboard(D, { pick: "stat 110", year: "'29", house: "Cabot" });
await D.waitForSelector(".modebar >> text=Demo class", { timeout: 15000 });
await wait(600);
check((await D.locator(".toast", { hasText: "demo class instead" }).count()) === 1, "refused join falls back to the demo with a notice");
check(!(await D.locator(".modebar button", { hasText: "Join the live class" }).count()), "after a refusal the live class isn't offered again");
await D.close();

// ---- the public demo build never touches the shared store ----------------------------
const E = await open("uid=u_owner&name=Org&owner=1", "demo.html");
await E.waitForSelector(".step-welcome");
check((await demoBar(E)) === 1, "demo build opens the demo class even for the owner");
check(!(await E.evaluate(() => !!window.__dbAsked)), "demo build never asks for the shared database");
check((await E.title()) === "Roster Demo Class", "demo build has its own title");
await E.close();

await browser.close();
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors, all checks passed");
