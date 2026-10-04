// Builds the single-file artifact: roster/dist/roster.html
// Usage: node roster/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, "src", f), "utf8");

// Plain modules first; the UI modules run only once Preact + htm is present.
const plain = ["store.js", "metrics.js", "runtime.js", "catalog.js", "lib-time.js", "lib-media.js", "lib-derive.js", "demo.js", "icons.js"].map(src).join("\n\n");
// app-session.js goes last: it mounts the app once every component exists.
const ui = ["ui-core.js", "ui-text.js", "ui-chat.js", "ui-recap.js", "ui-class.js", "ui-now.js", "ui-calendar.js", "ui-board.js", "ui-people.js", "ui-activity.js", "ui-sheets.js", "ui-onboard.js", "ui-org.js", "ui-shell.js", "app-session.js"].map(src).join("\n\n");
const loader = `
(function () {
  function fail() { var el = document.querySelector(".boot-sub"); if (el) el.textContent = "Roster couldn't load. Check your connection and reload."; }
  function go() { if (window.htmPreact) __rosterApp(); else fail(); }
  if (window.htmPreact) return go();
  var s = document.createElement("script");
  s.src = "https://unpkg.com/htm@3.1.1/preact/standalone.umd.js"; // fallback copy
  s.onload = go; s.onerror = fail;
  document.head.appendChild(s);
})();`;
const scripts = plain + "\n\nfunction __rosterApp() {\n" + ui + "\n}\n" + loader;
const page = (flags, title) => src("shell.html")
  .replace("<title>Roster</title>", "<title>" + title + "</title>")
  .replace("/*__STYLES__*/", () => src("styles.css"))
  .replace("/*__FLAGS__*/", () => flags)
  .replace("/*__SCRIPTS__*/", () => scripts);

mkdirSync(join(root, "dist"), { recursive: true });
// Live build: the real class chat (shared db) plus the demo class.
const live = page("", "Roster");
writeFileSync(join(root, "dist", "roster.html"), live);
// Demo build: demo class only, safe to share with anyone (TF, podcast listeners).
const demo = page("window.ROSTER_FORCE_DEMO = true;", "Roster Demo Class");
writeFileSync(join(root, "dist", "roster-demo.html"), demo);
console.log("built dist/roster.html", (live.length / 1024).toFixed(1) + " KB", "and dist/roster-demo.html", (demo.length / 1024).toFixed(1) + " KB");

// Web build for static hosting (Netlify etc.): a full HTML document with the libraries
// served next to it. No Claude runtime there, so it runs as the demo class.
const web = join(root, "dist", "web");
rmSync(web, { recursive: true, force: true });
mkdirSync(join(web, "vendor"), { recursive: true });
const cut = demo.indexOf('<div id="app"');
const headPart = demo.slice(0, cut), bodyPart = demo.slice(cut)
  .replace("https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.umd.js", "vendor/htm-preact-standalone.umd.js")
  .replace("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", "vendor/katex.min.js");
const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="description" content="Roster: every class you take already has a group chat. A demo class with example classmates; nothing you post leaves your browser.">\n' +
  headPart + "</head>\n<body>\n" + bodyPart + "\n</body>\n</html>\n";
writeFileSync(join(web, "index.html"), doc);
for (const f of ["htm-preact-standalone.umd.js", "katex.min.js", "LICENSE-htm", "LICENSE-katex"]) copyFileSync(join(root, "vendor", f), join(web, "vendor", f));
console.log("built dist/web/index.html", (doc.length / 1024).toFixed(1) + " KB (static hosting, demo class)");
