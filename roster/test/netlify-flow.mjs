// End to end on the Netlify build: organizer setup, placement links, two placed students on
// separate devices chatting through the real API (local Netlify Blobs), photo upload, identity
// restore from a placement link, organizer link, results + CSV export, and the demo fallbacks.
// Usage: PW_MODULE=… node roster/test/netlify-flow.mjs <outDir>
// BUNDLED=1 runs the deployable one-file function (netlify/functions/api.mjs) instead of the source;
// it has no API key, so the Claude drafting steps are skipped.
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { start } from "./netlify-local.mjs";

const BUNDLED = process.env.BUNDLED === "1";
const out = (process.argv[2] || "/tmp") + "/netlify" + (BUNDLED ? "-bundled" : "");
mkdirSync(out, { recursive: true });
// Stand-in for the Claude call (the real one runs in netlify/functions/api.mjs with ANTHROPIC_API_KEY).
let draftPrompt = "";
const server = await start({ bundled: BUNDLED, apiKey: "test-key", draft: async (prompt) => { draftPrompt = prompt; return { text: "```json\n" + JSON.stringify({ title: "Indicators & the Fundamental Bridge", bullets: [{ text: "The fundamental bridge: $E[I_A] = P(A)$.", ref: "Slide 2" }, { text: "Expected matches in the matching problem is 1 for every n.", ref: "Slide 6" }] }) + "\n```" }; } });
const base = server.url;
const browser = await chromium.launch();
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { if (!cond) errors.push("CHECK FAILED: " + msg); else console.log("✓ " + msg); };
const shot = (p, n) => p.screenshot({ path: join(out, n + ".png") });
async function device(name, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base.replace(/\/$/, "") });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(name + " pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::ERR|Failed to load resource/.test(m.text())) errors.push(name + " console: " + m.text()); });
  return p;
}
async function onboard(p, { name, pick, year, house, organizer }) {
  if (!organizer) { await p.waitForSelector(".step-welcome"); await p.click("text=Get started"); }
  await p.waitForSelector(".cres");
  if (pick) { await p.fill("#course-q", pick); await p.locator(".cres", { hasText: "STAT 110" }).click(); }
  await p.click(".ob-cta button.primary");
  await p.waitForSelector(".verify");
  await p.click(".ob-cta button.primary");
  await p.waitForSelector("#ob-name");
  if (name) await p.fill("#ob-name", name);
  await p.click(".ob-cta button.primary");
  await p.click(".seg.wide >> text=20" + year.slice(1));
  await p.click(".housechip >> text=" + house);
  await p.click(".ob-cta button.primary");
  await p.click(".concpick .chip >> text=Undeclared");
  await p.click(".ob-cta button.primary");
  await p.click(".ob-cta button.primary");
  await p.click(".ob-cta button.primary");
  await p.click("text=Agree and continue");
  await p.waitForSelector(".step-friends");
  await p.click(".ob-cta button.primary");
  await p.waitForSelector(".step-arrive", { timeout: 20000 });
  await wait(600);
}
const until = async (p, fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(300); } return false; };

// ---- organizer -------------------------------------------------------------------
const A = await device("organizer");
await A.goto(base);
await A.waitForSelector(".step-welcome");
check((await A.locator(".modebar", { hasText: "Demo class" }).count()) === 0, "Netlify build with the function opens the live class");
check((await A.locator("h1", { hasText: "You're the first one here" }).count()) === 1, "a fresh site greets its first visitor with class setup");
await shot(A, "a0-setup");
await A.click("text=I'm running this class");
await A.waitForSelector(".toast >> text=You're the organizer");
check(true, "first visitor can claim the organizer role");
check((await A.locator(".pickchip", { hasText: "STAT 110" }).count()) === 1, "STAT 110 is preselected for the organizer");
await onboard(A, { name: "Org Anizer", year: "'28", house: "Lowell", organizer: true });
await shot(A, "a1-arrive");
await A.click("text=Say hi in STAT 110");
await A.waitForSelector(".classview");
check(await until(A, async () => (await A.locator(".tab", { hasText: "This week's pset" }).count()) > 0), "STAT 110 is seeded with a PSet board for this week");
await A.click(".side-nav >> text=Now");
check(await until(A, async () => (await A.locator(".orgcheck", { hasText: "Invite your students" }).count()) > 0), "the organizer's home shows the setup checklist");
await shot(A, "a1b-checklist");
await A.locator(".side-c", { hasText: "STAT 110" }).click();
await A.waitForSelector(".classview");
const orgBtn = A.locator('button[aria-label="Organizer tools"]');
check(await until(A, async () => (await orgBtn.count()) > 0), "organizer tools appear for the organizer");
await orgBtn.click();
await A.click(".tabs.inset >> text=Dates");
await A.waitForSelector(".dcard .erow input");
check((await A.locator(".dcard").first().locator(".erow").first().locator("input").first().inputValue()) === "This week's pset" && (await A.locator(".erow.three").count()) === 2, "pset due dates and both experiment cycles are filled in");
await A.click("text=Add a date");
const due = A.locator(".dcard").first().locator(".erow").first().locator("input");
await due.nth(0).fill("PSet 6"); await due.nth(1).fill("2026-10-23T17:00"); await due.nth(2).fill("Gradescope");
await A.click("text=Save dates & cycles");
await wait(400);
const nt = A.locator(".dcard").last().locator(".erow").last().locator("input");
await nt.nth(0).fill("PSet 6"); await nt.nth(1).fill("2026-10-23T17:00"); await nt.nth(2).fill("1, 2, 3a, 3b, 4");
await A.locator(".dcard").last().locator("button", { hasText: /^Add$/ }).click();
await wait(400);
if (!BUNDLED) {
await A.click(".tabs.inset >> text=Recap");
await A.fill(".dash textarea", "Lecture 10. Indicator random variables again. The fundamental bridge says E[I_A] = P(A) for any event A. Matching problem: n people, n hats, the expected number of matches is 1 no matter n. Slides 2 and 6.");
await A.click("text=Draft with Claude");
check(await until(A, async () => (await A.locator(".dl").count()) === 2), "recap drafting works through the site's function");
check(/Use ONLY the organizer's notes/.test(draftPrompt), "the drafting prompt limits Claude to the organizer's notes");
for (let i = 0; i < 2; i++) await A.locator(".dl").nth(i).locator("button", { hasText: "Keep" }).click();
await A.click("text=Post recap to STAT 110");
await A.waitForSelector(".recap");
await A.click('button[aria-label="Organizer tools"]');
}
await A.click(".tabs.inset >> text=Placement");
await A.fill(".dash textarea", "Sam Student, sam@college.harvard.edu\nRia Rao");
await A.click("text=Create 2 links");
check(await until(A, async () => (await A.locator(".plrow").count()) === 2), "organizer creates 2 placement links");
await A.locator(".plrow", { hasText: "Sam Student" }).locator(".iconbtn").click();
const samLink = await A.evaluate(() => navigator.clipboard.readText());
await A.locator(".plrow", { hasText: "Ria Rao" }).locator(".iconbtn").click();
const riaLink = await A.evaluate(() => navigator.clipboard.readText());
check(/\?p=[A-Za-z0-9]{20}$/.test(samLink) && samLink !== riaLink, "each student gets their own link");
await A.locator(".plrow", { hasText: "Sam Student" }).locator("text=Copy message").click();
const msg = await A.evaluate(() => navigator.clipboard.readText());
check(msg.startsWith("Hi Sam!") && msg.includes(samLink), "copy message includes the student's link");
await A.click("text=Show my organizer link");
const olink = await A.locator(".olink code").innerText();
check(/\?o=[A-Za-z0-9]{32}$/.test(olink), "organizer link is available");
await shot(A, "a2-placement");
await A.keyboard.press("Escape");
await wait(300);

// ---- student 1 (desktop) ------------------------------------------------------------
const B = await device("sam");
await B.goto(samLink);
await B.waitForSelector(".step-welcome");
check(!/\?p=/.test(B.url()), "placement token is removed from the address bar");
await B.click("text=Get started");
await B.waitForSelector(".ob-banner");
check((await B.locator(".pickchip", { hasText: "STAT 110" }).count()) === 1, "Sam's link preselects STAT 110");
await B.reload();
await onboard(B, { year: "'29", house: "Pforzheimer" });
check((await B.locator(".arrive-row", { hasText: "STAT 110" }).locator("small").innerText()).includes("1 classmate"), "Sam's arrival shows the organizer already in STAT 110");
await B.click("text=Say hi in STAT 110");
await B.waitForSelector(".classview");
const bBox = B.locator("textarea[id^='composer-stat110-main']");
check((await bBox.inputValue()).startsWith("Hi! I'm Sam"), "Sam's name came from the placement link");
await bBox.press("Enter");
check(await until(A, async () => (await A.locator(".bub", { hasText: "Hi! I'm Sam" }).count()) > 0), "organizer sees Sam's message without reloading");
await A.locator(".run:not(.mine) .bub", { hasText: "Hi! I'm Sam" }).hover();
await A.locator(".run:not(.mine) .msg", { hasText: "Hi! I'm Sam" }).locator(".hover-tools button").first().click();
await A.click(".tray-e >> nth=1");
check(await until(B, async () => (await B.locator(".react", { hasText: "1" }).count()) > 0 || (await B.locator(".run.mine .reacts .react").count()) > 0), "Sam sees the organizer's reaction");
// photo upload
await B.setInputFiles(".composer input[type=file]", { name: "board.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMCJx/jMwAABSBQH/fn7pvQAAAABJRU5ErkJggg==", "base64") });
await B.waitForSelector(".sendprev");
await B.fill(".sheet-f input", "board from section");
await B.click(".sheet-f .send");
check(await until(A, async () => (await A.locator(".ph img").count()) > 0), "organizer sees Sam's photo");
const src = await A.locator(".ph img").last().getAttribute("src");
check(/^api\/img\/[A-Za-z0-9]{24}$/.test(src || ""), "photos are stored on the server, not inside messages");
await shot(B, "b1-sam-chat");

// ---- student 2 (phone) ---------------------------------------------------------------
const C = await device("ria", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await C.goto(riaLink);
await onboard(C, { year: "'29", house: "Cabot" });
await C.click("text=Say hi in STAT 110");
await C.waitForSelector(".classview");
check(await until(C, async () => (await C.locator(".bub", { hasText: "Hi! I'm Sam" }).count()) > 0), "Ria sees Sam's message from before she joined");
if (!BUNDLED) {
  check((await C.locator(".recap .line").count()) === 2, "Ria sees the organizer's recap");
  await C.locator(".line-acts button", { hasText: "Looks right" }).first().click();
}
await C.locator("textarea[id^='composer-stat110-main']").fill("is anyone starting pset 6 tonight?");
await C.locator(".composer .send").click();
await C.click(".tab >> text=This week's pset");
await C.locator(".prob-main").nth(2).click();
const cBox = C.locator("textarea[id^='composer-stat110-pset-a']");
await cBox.fill("for 3 is a closed form expected?");
await C.locator(".composer .send").click();
await C.click(".tab >> text=Chat");
await C.click(".cbtn");
await C.click(".attach-o >> text=Study session");
await C.fill(".sheet input.lg", "PSet 6 at Cabot");
await C.click(".sheet .chip >> text=Cabot Library");
await C.click("text=Post to STAT 110");
check(await until(B, async () => (await B.locator(".event-t", { hasText: "PSet 6 at Cabot" }).count()) > 0), "Sam sees Ria's study session");
await B.locator(".event", { hasText: "PSet 6 at Cabot" }).locator(".rsvp button", { hasText: "Going" }).click();
check(await until(C, async () => (await C.locator(".event", { hasText: "PSet 6 at Cabot" }).locator(".event-who", { hasText: "2 " }).count()) > 0 || (await C.locator(".event", { hasText: "PSet 6 at Cabot" }).locator(".event-who").innerText()).includes("Sam")), "Ria sees Sam's RSVP");
await shot(C, "c1-ria-phone");

// ---- Sam on a second device: the same link restores Sam ---------------------------------
const B2 = await device("sam-phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await B2.goto(samLink);
check(await until(B2, async () => (await B2.locator(".tabbar, .classview").count()) > 0, 20000), "Sam's link on a new device skips onboarding (same identity)");
await B2.click(".tabbar >> text=Classes");
await B2.locator(".crow", { hasText: "STAT 110" }).click();
check(await until(B2, async () => (await B2.locator(".run.mine .bub", { hasText: "Hi! I'm Sam" }).count()) > 0), "Sam's own messages show as his on the new device");

// ---- privacy and permissions -------------------------------------------------------------------
check((await B.locator('button[aria-label="Organizer tools"]').count()) === 0, "students don't get organizer tools");
const denied = await B.evaluate(async () => {
  const id = JSON.parse(localStorage.getItem("roster:web:id"));
  const r = await fetch("api/write", { method: "POST", headers: { "content-type": "application/json", "x-roster-uid": id.uid, "x-roster-key": id.key }, body: JSON.stringify({ ops: [{ o: "set", p: "hub/stat110", d: { due: [] } }] }) });
  return r.status;
});
check(denied === 403, "server refuses a student editing organizer-only data");
const sneaky = await B.evaluate(async () => {
  const r = await fetch("api/sync?since=0");
  const j = await r.json();
  return [...j.docs.map(([p]) => p), ...j.ops.filter((o) => !o.skip).map((o) => o.p)].filter((p) => /^(placements|survey|reports|data)\//.test(p)).length;
});
check(sneaky === 0, "an anonymous request sees no placements, surveys, reports or private tasks");

// ---- organizer results + export -------------------------------------------------------------------
await A.click('button[aria-label="Organizer tools"]');
await A.waitForSelector(".kpis");
await A.click(".dash-q >> text=Placed by you");
const res = await A.locator(".dash").innerText();
check(/2 students placed by you in STAT 110/.test(res), "results count the 2 placed students (organizer excluded)");
check(/100%/.test(await A.locator(".kpi").first().innerText()), "both placed students contributed in cycle 1");
await shot(A, "a3-results");
await A.click(".tabs.inset >> text=Export");
const [dl] = await Promise.all([A.waitForEvent("download"), A.click("text=Event log · CSV")]);
const csv = readFileSync(await dl.path(), "utf8");
check(/^timestamp_iso,cycle,member,event/.test(csv) && !/Sam|Ria/.test(csv) && /,post,/.test(csv) && /,open,/.test(csv), "CSV downloads, pseudonymous, with posts and opens");
await A.keyboard.press("Escape");

// ---- organizer on a new device via the organizer link -------------------------------------------
const A2 = await device("organizer-laptop");
await A2.goto(olink);
check(await until(A2, async () => (await A2.locator(".side-c, .tabbar").count()) > 0, 20000), "organizer link restores the organizer on a new device");
await A2.locator(".side-c", { hasText: "STAT 110" }).click();
check(await until(A2, async () => (await A2.locator('button[aria-label="Organizer tools"]').count()) > 0), "…with organizer tools");

// ---- fallbacks ------------------------------------------------------------------------------------
const D = await device("tf-demo");
await D.goto(base + "?demo");
await D.waitForSelector(".step-welcome");
check((await D.locator(".modebar", { hasText: "Demo class" }).count()) === 1, "?demo opens the demo class on the same site");
const st = await start({ static: "static-only" });
const E = await device("static");
await E.goto(st.url);
await E.waitForSelector(".step-welcome");
check((await E.locator(".modebar", { hasText: "Demo class" }).count()) === 1, "a static-only deploy (no function) falls back to the demo class");
await E.click(".staticnote");
await E.waitForSelector("#status");
check(await until(E, async () => /server is off/.test(await E.locator("#status").innerText())), "…and links to setup steps that say the class server is off");
await shot(E, "e1-setup-off");
const S = await device("setup-on");
await S.goto(base + "setup.html");
check(await until(S, async () => /server is on/.test(await S.locator("#status").innerText())), "setup page confirms the class server is on for a full deploy");
await st.stop();

await browser.close();
await server.stop();
writeFileSync(join(out, "errors.txt"), errors.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors, all checks passed", "| api calls:", server.stats.api);
