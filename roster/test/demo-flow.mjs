// Walks the demo class end to end and saves screenshots.
// Usage: node roster/test/demo-flow.mjs <outDir>
const { chromium } = await import(process.env.PW_MODULE || "playwright");
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "shots");
mkdirSync(out, { recursive: true });
const VENDOR = process.env.HTM_UMD;
const page0 = readFileSync(join(here, "..", "dist", "roster.html"), "utf8");
// Same skeleton the artifact host wraps around the page.
const wrapped = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
writeFileSync(join(out, "index.html"), wrapped);

const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const errors = [];
async function newPage(opts) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: false });
  await ctx.route("https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js", (r) => r.fulfill({ path: VENDOR, contentType: "text/javascript" }));
  await ctx.route("https://unpkg.com/**", (r) => r.fulfill({ path: VENDOR, contentType: "text/javascript" }));
  // Fonts through curl, which trusts the sandbox proxy's CA (headless Chromium here does not).
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => {
    const url = r.request().url();
    try {
      const body = execFileSync("curl", ["-sS", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", url], { maxBuffer: 20e6 });
      r.fulfill({ body, contentType: url.includes("googleapis") ? "text/css" : "font/woff2", headers: { "access-control-allow-origin": "*" } });
    } catch (_) { r.abort(); }
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.goto("file://" + join(out, "index.html"));
  return p;
}
const shot = (p, name) => p.screenshot({ path: join(out, name + ".png") });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- desktop, light ---------------------------------------------------------
{
  const p = await newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  await p.waitForSelector(".ob-card");
  await wait(400);
  await shot(p, "01-welcome");
  await p.click("text=Add my classes");
  await p.fill("#course-q", "stat");
  await wait(200);
  await shot(p, "02-pick");
  await p.fill("#course-q", "");
  await p.click("text=Continue with 4 classes");
  await shot(p, "03-about");
  await p.click("text=Join my class chats");
  await p.waitForSelector(".arrive-row");
  await wait(1200);
  await shot(p, "04-arrive");
  await p.click("text=Open STAT 110");
  await p.waitForSelector(".bub");
  await wait(600);
  await shot(p, "05-chat");
  // send a message, react, reply
  await p.fill("#composer-stat110-main", "did anyone get 3(b)? i keep getting something with 1/e");
  await p.keyboard.press("Enter");
  await wait(400);
  await p.hover('[data-mid="m-st4"] .bub');
  await p.click('[data-mid="m-st4"] .hover-tools button[aria-label="React 👍"]');
  await wait(300);
  await shot(p, "06-chat-sent");
  await p.click(".tab >> text=PSet 5");
  await wait(400);
  await shot(p, "07-pset");
  await p.click(".ptab >> text=3(b)");
  await wait(300);
  await shot(p, "08-pset-3b");
  await p.click(".tab >> text=Recaps");
  await wait(400);
  await shot(p, "09-recaps");
  // third "yes" applies Nora's fix
  const yes = p.locator(".sugg", { hasText: "First Success" }).locator("button.yn", { hasText: "Yes" });
  await yes.click();
  await wait(500);
  await shot(p, "10-fix-applied");
  // suggest a fix
  await p.locator(".bl .act button", { hasText: "Suggest a fix" }).first().click();
  await wait(300);
  await shot(p, "11-fix-sheet");
  await p.keyboard.press("Escape");
  // organizer tools
  await p.click('button[aria-label="Organizer tools"]');
  await wait(700);
  await shot(p, "12-org-results");
  await p.locator(".seg-ctl button", { hasText: "Post a recap" }).click();
  await wait(300);
  await shot(p, "13-org-recap");
  await p.locator(".seg-ctl button", { hasText: "Dates & cycles" }).click();
  await wait(300);
  await shot(p, "14-org-hub");
  await p.locator(".seg-ctl button", { hasText: "Export" }).click();
  await wait(400);
  await shot(p, "15-org-export");
  await p.keyboard.press("Escape");
  // survey from hub
  const ans = p.locator(".hub button", { hasText: "Answer" });
  if (await ans.count()) { await ans.click(); await wait(300); await shot(p, "16-survey"); await p.keyboard.press("Escape"); }
  await p.context().close();
}

// ---- desktop, dark ------------------------------------------------------------
{
  const p = await newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await p.waitForSelector(".ob-card");
  await shot(p, "20-dark-welcome");
  await p.click("text=Add my classes");
  await p.click("text=Continue with 4 classes");
  await p.click("text=Join my class chats");
  await p.waitForSelector(".arrive-row");
  await p.click("text=Open STAT 110");
  await p.waitForSelector(".bub");
  await wait(600);
  await shot(p, "21-dark-chat");
  await p.click(".tab >> text=Recaps");
  await wait(400);
  await shot(p, "22-dark-recaps");
  await p.context().close();
}

// ---- tablet ----------------------------------------------------------------------
{
  const p = await newPage({ viewport: { width: 900, height: 1000 }, colorScheme: "light" });
  await p.waitForSelector(".ob-card");
  await p.click("text=Add my classes");
  await p.click("text=Continue with 4 classes");
  await p.click("text=Join my class chats");
  await p.waitForSelector(".arrive-row");
  await p.click("text=Open STAT 110");
  await p.waitForSelector(".bub");
  await wait(500);
  await shot(p, "30-tablet-chat");
  await p.click(".tab >> text=Hub");
  await wait(300);
  await shot(p, "31-tablet-hub");
  await p.context().close();
}

// ---- phone ---------------------------------------------------------------------------
for (const scheme of ["light", "dark"]) {
  const p = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  await p.waitForSelector(".ob-card");
  await shot(p, "40-phone-" + scheme + "-welcome");
  await p.click("text=Add my classes");
  await shot(p, "41-phone-" + scheme + "-pick");
  await p.click("text=Continue with 4 classes");
  await p.click("text=Join my class chats");
  await p.waitForSelector(".arrive-row");
  await wait(1200);
  await shot(p, "42-phone-" + scheme + "-arrive");
  await p.click("text=Open STAT 110");
  await p.waitForSelector(".bub");
  await wait(600);
  await shot(p, "43-phone-" + scheme + "-chat");
  await p.click('button[aria-label="Back to classes"]');
  await wait(300);
  await shot(p, "44-phone-" + scheme + "-list");
  await p.locator(".class-row", { hasText: "STAT 110" }).click();
  await p.click(".tab >> text=Recaps");
  await wait(400);
  await shot(p, "45-phone-" + scheme + "-recaps");
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push("phone " + scheme + ": horizontal overflow " + sw + "px");
  await p.context().close();
}

await browser.close();
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors");
