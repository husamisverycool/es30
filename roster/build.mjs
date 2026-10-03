// Builds the single-file artifact: roster/dist/roster.html
// Usage: node roster/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  s.src = "https://unpkg.com/htm@3.1.1/preact/standalone.umd.js"; // jsDelivr fallback
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
