// Walks the v2 demo class end to end (onboarding → every screen) and saves screenshots.
// Usage: PW_MODULE=… HTM_UMD=… KATEX_JS=… node roster/test/demo-flow.mjs <outDir>
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "shots");
mkdirSync(out, { recursive: true });
const page0 = readFileSync(join(here, "..", "dist", process.env.BUILD || "roster.html"), "utf8");
// Same skeleton the artifact host wraps around the page.
const wrapped = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
writeFileSync(join(out, "index.html"), wrapped);

const browser = await chromium.launch();
const errors = [];
async function newPage(opts, name) {
  const ctx = await browser.newContext(opts);
  await ctx.route("https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js", (r) => r.fulfill({ path: process.env.HTM_UMD, contentType: "text/javascript" }));
  await ctx.route("https://unpkg.com/**", (r) => r.fulfill({ path: process.env.HTM_UMD, contentType: "text/javascript" }));
  await ctx.route("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", (r) => r.fulfill({ path: process.env.KATEX_JS, contentType: "text/javascript" }));
  // Fonts through curl, which trusts the sandbox proxy's CA (headless Chromium here does not).
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => {
    const url = r.request().url();
    try {
      const body = execFileSync("curl", ["-sS", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", url], { maxBuffer: 20e6 });
      r.fulfill({ body, contentType: url.includes("googleapis") ? "text/css" : "font/woff2", headers: { "access-control-allow-origin": "*" } });
    } catch (_) { r.abort(); }
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(name + " pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(name + " console." + m.type() + ": " + m.text()); });
  await p.goto("file://" + join(out, "index.html"));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (p, name) => { await wait(350); await p.screenshot({ path: join(out, String(++n).padStart(2, "0") + "-" + name + ".png") }); };
const step = async (label, fn) => { try { await fn(); } catch (e) { errors.push("STEP FAILED " + label + ": " + e.message.split("\n")[0]); } };

async function onboard(p, prefix, shots) {
  await p.waitForSelector(".ob-welcome");
  await wait(900);
  if (shots) await shot(p, prefix + "ob-welcome");
  await p.click("text=Get started");
  await p.waitForSelector(".cres");
  if (shots) { await p.fill("#course-q", "stat"); await shot(p, prefix + "ob-classes-search"); await p.fill("#course-q", ""); }
  await p.click("text=Continue with 4 classes");
  await p.waitForSelector(".verify");
  if (shots) await shot(p, prefix + "ob-verify");
  await p.click(".ob-cta >> text=Continue");
  await p.waitForSelector("#ob-name");
  if (shots) await shot(p, prefix + "ob-name");
  await p.click(".ob-cta >> text=Continue");
  await p.waitForSelector(".housegrid");
  if (shots) await shot(p, prefix + "ob-house");
  await p.click(".ob-cta >> text=Continue");
  await p.waitForSelector(".concpick");
  if (shots) await shot(p, prefix + "ob-conc");
  await p.click(".ob-cta >> text=Continue");
  await p.waitForSelector(".slotgrid");
  if (shots) await shot(p, prefix + "ob-sections");
  await p.click(".ob-cta >> text=Continue");
  await p.waitForSelector(".promptslots");
  if (shots) await shot(p, prefix + "ob-prompts");
  await p.click(".ob-cta button.primary");
  await p.waitForSelector(".pledge");
  if (shots) await shot(p, prefix + "ob-pledge");
  await p.click("text=Agree and continue");
  await p.waitForSelector(".step-friends");
  await p.click(".step-friends .group >> text=Add back");
  if (shots) await shot(p, prefix + "ob-friends");
  await p.click(".ob-cta button.primary");
  await p.waitForSelector(".buildlist");
  await wait(700);
  if (shots) await shot(p, prefix + "ob-build");
  await p.waitForSelector(".ob-arrive", { timeout: 15000 });
  await wait(1300);
  if (shots) await shot(p, prefix + "ob-arrive");
  await p.click("text=Say hi in STAT 110");
  await p.waitForSelector(".bub");
  await wait(800);
}

// ---- desktop, light ---------------------------------------------------------
{
  const p = await newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" }, "desktop");
  await step("onboarding", () => onboard(p, "d-", true));
  await shot(p, "d-chat");
  await step("send", async () => {
    await p.click("textarea[id^=composer-stat110]");
    await p.keyboard.press("Enter");
    await p.waitForSelector(".run.mine");
    await shot(p, "d-chat-sent");
  });
  await step("hover react", async () => {
    const b = p.locator(".run:not(.mine) .bub").last();
    await b.hover();
    await p.locator(".run:not(.mine) .msg").last().locator(".hover-tools button").first().click();
    await p.waitForSelector(".tray");
    await shot(p, "d-react-tray");
    await p.click(".tray-e >> nth=1");
  });
  await step("pinned + catch-up", async () => { const cu = await p.$(".cu-bar"); if (cu) { await cu.click(); await shot(p, "d-catchup"); } });
  await step("poll", async () => { await p.locator(".poll").first().scrollIntoViewIfNeeded(); await shot(p, "d-poll"); });
  await step("event sheet", async () => { await p.locator(".event-main").first().click(); await p.waitForSelector(".evsheet"); await shot(p, "d-event-sheet"); await p.keyboard.press("Escape"); await wait(300); });
  await step("attach", async () => { await p.click(".cbtn"); await p.waitForSelector(".attach-grid"); await shot(p, "d-attach"); await p.click(".attach-o >> text=Poll"); await p.waitForSelector(".optin"); await p.fill(".sheet input.lg", "Which problem is hardest?"); await p.fill(".optin >> nth=0 >> input", "3"); await p.fill(".optin >> nth=1 >> input", "4"); await shot(p, "d-poll-new"); await p.click("text=Post poll"); await wait(500); });
  await step("pset tab", async () => { await p.click(".tab >> text=PSet 5"); await p.waitForSelector(".probs"); await shot(p, "d-pset"); await p.click(".prob-main >> nth=2"); await p.waitForSelector(".probhead"); await shot(p, "d-pset-problem"); });
  await step("recaps tab", async () => { await p.click(".tab >> text=Recaps"); await p.waitForSelector(".recap"); await shot(p, "d-recaps"); await p.locator(".line-acts button >> text=Fix").first().click(); await p.waitForSelector("#fix-text"); await shot(p, "d-fix-sheet"); await p.keyboard.press("Escape"); await wait(300); });
  await step("notes tab", async () => { await p.click(".tab >> text=Notes"); await p.waitForSelector(".lecgroup"); await shot(p, "d-notes"); });
  await step("section tab", async () => { await p.click(".tab >> text=Section"); await wait(400); await shot(p, "d-section"); });
  await step("people tab", async () => { await p.click(".tab >> text=People"); await p.waitForSelector(".coverc"); await shot(p, "d-class-people"); });
  await step("profile", async () => { await p.locator(".prow").first().click(); await p.waitForSelector(".prof"); await shot(p, "d-profile"); await p.keyboard.press("Escape"); await wait(300); });
  await step("palette", async () => { await p.keyboard.press("Meta+k"); await p.waitForSelector(".pal-in"); await p.keyboard.type("geom"); await wait(300); await shot(p, "d-palette"); await p.keyboard.press("Escape"); await wait(300); });
  await step("now", async () => { await p.click(".nav-i >> text=Now"); await p.waitForSelector(".hero"); await shot(p, "d-now"); });
  await step("story", async () => { await p.click(".storyentry"); await p.waitForSelector(".story"); await wait(600); await shot(p, "d-story"); await p.click(".st-tap.r"); await wait(500); await shot(p, "d-story-2"); await p.keyboard.press("Escape"); await wait(400); });
  await step("calendar", async () => { await p.click(".nav-i >> text=Calendar"); await p.waitForSelector(".tgrid"); await shot(p, "d-calendar-week"); await p.click(".seg >> text=List"); await p.waitForSelector(".agenda"); await shot(p, "d-calendar-list"); await p.click(".seg >> text=Week"); });
  await step("meetings", async () => { await p.click("text=Class times"); await p.waitForSelector(".mtrow"); await shot(p, "d-class-times"); await p.locator(".mtrow >> text=Add").first().click(); await p.waitForSelector(".daypick"); await p.click(".daychip >> text=M"); await p.click(".daychip >> text=W"); await p.click(".daychip >> text=F"); await shot(p, "d-class-times-edit"); await p.click(".sheet-f >> text=Save"); await wait(400); await p.keyboard.press("Escape"); await wait(400); await shot(p, "d-calendar-after-edit"); });
  await step("board", async () => { await p.click(".nav-i >> text=Board"); await p.waitForSelector(".bcard"); await shot(p, "d-board"); await p.click(".fchip >> text=Marketplace"); await wait(300); await shot(p, "d-board-market"); await p.click(".fchip >> text=All"); await p.locator(".bcard-b").first().click(); await p.waitForSelector(".sheet .bcard.full"); await shot(p, "d-board-post"); await p.keyboard.press("Escape"); await wait(300); await p.click(".pagehead >> text=Post"); await p.waitForSelector(".catpick"); await shot(p, "d-board-new"); await p.keyboard.press("Escape"); await wait(300); });
  await step("people", async () => { await p.click(".nav-i >> text=People"); await p.waitForSelector(".statusrow"); await shot(p, "d-people"); await p.click(".statusrow"); await p.waitForSelector(".status-in"); await shot(p, "d-status"); await p.click(".statusopt >> nth=0"); await p.click(".sheet-f >> text=Save"); await wait(400); });
  await step("friend profile compare", async () => { const fr = p.locator(".friendrow").first(); if (await fr.count()) { await fr.click(); await p.waitForSelector(".prof"); await p.locator(".cmp").scrollIntoViewIfNeeded().catch(() => {}); await shot(p, "d-friend-profile"); await p.keyboard.press("Escape"); await wait(300); } });
  await step("activity", async () => { await p.click(".nav-i >> text=Activity"); await wait(500); await shot(p, "d-activity"); });
  await step("tasks", async () => { await p.click(".nav-i >> text=Tasks"); await p.waitForSelector(".quickadd"); await p.fill(".quickadd input", "Read section 4.5"); await p.keyboard.press("Enter"); await wait(300); await shot(p, "d-tasks"); });
  await step("saved", async () => { await p.click(".nav-i >> text=Saved"); await wait(300); await shot(p, "d-saved"); });
  await step("you", async () => { await p.click(".me-island"); await p.waitForSelector(".youcard"); await shot(p, "d-you"); });
  await step("organizer", async () => { await p.click(".setrow >> text=Experiment results"); await p.waitForSelector(".kpis"); await wait(400); await shot(p, "d-org-results"); await p.locator(".sheet-b").evaluate((el) => el.scrollTo(0, 900)); await shot(p, "d-org-results-2"); await p.click(".tabs.inset >> text=Recap"); await shot(p, "d-org-recap"); await p.click(".tabs.inset >> text=Placement"); await shot(p, "d-org-place"); await p.click(".tabs.inset >> text=Export"); await wait(400); await shot(p, "d-org-export"); await p.keyboard.press("Escape"); await wait(300); });
  await step("dark", async () => { await p.click(".seg >> text=Dark"); await wait(300); await p.click(".side-c >> nth=0"); await p.waitForSelector(".bub"); await shot(p, "d-dark-chat"); await p.click(".nav-i >> text=Now"); await shot(p, "d-dark-now"); await p.click(".nav-i >> text=Calendar"); await shot(p, "d-dark-calendar"); });
  await p.context().close();
}

// ---- phone, light then dark ---------------------------------------------------
for (const scheme of ["light", "dark"]) {
  const pre = scheme === "light" ? "p-" : "pd-";
  const p = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme }, "phone-" + scheme);
  await step(pre + "onboarding", () => onboard(p, pre, scheme === "light"));
  await shot(p, pre + "chat");
  await step(pre + "tabs", async () => { await p.click(".classhead .back"); await p.waitForSelector(".tabbar"); await shot(p, pre + "classes"); });
  await step(pre + "now", async () => { await p.click(".tabbar >> text=Now"); await p.waitForSelector(".hero"); await shot(p, pre + "now"); });
  await step(pre + "calendar", async () => { await p.click(".tabbar >> text=Calendar"); await p.waitForSelector(".weekstrip"); await p.click(".ws-d >> nth=1"); await wait(300); await shot(p, pre + "calendar-day"); });
  await step(pre + "board", async () => { await p.click(".tabbar >> text=Board"); await p.waitForSelector(".bcard"); await shot(p, pre + "board"); });
  await step(pre + "people", async () => { await p.click(".tabbar >> text=People"); await p.waitForSelector(".statusrow"); await shot(p, pre + "people"); });
  await step(pre + "profile", async () => { const r = p.locator(".friendrow, .prow").first(); await r.click(); await p.waitForSelector(".prof"); await wait(600); await shot(p, pre + "profile"); await p.click(".scrim", { position: { x: 20, y: 20 } }); await wait(500); });
  await step(pre + "activity", async () => { await p.click(".pagehead [aria-label^=Activity]"); await wait(400); await shot(p, pre + "activity"); });
  if (scheme === "light") await step("p-pset", async () => { await p.click(".tabbar >> text=Classes").catch(() => {}); await p.click(".tabbar >> text=Classes"); await p.locator(".crow").first().click(); await p.click(".tab >> text=PSet 5"); await p.waitForSelector(".probs"); await shot(p, "p-pset"); await p.click(".tab >> text=Recaps"); await p.waitForSelector(".recap"); await shot(p, "p-recaps"); });
  if (scheme === "light") await step("p-longpress", async () => { await p.click(".tab >> text=Chat"); await p.waitForSelector(".bub"); const b = p.locator(".run:not(.mine) .bub").last(); const box = await b.boundingBox(); await p.touchscreen.tap(box.x + 20, box.y + 10); await shot(p, "p-chat-2"); });
  await p.context().close();
}

await browser.close();
writeFileSync(join(out, "errors.txt"), errors.join("\n\n"));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n\n") : "no errors", "\nshots:", n);
