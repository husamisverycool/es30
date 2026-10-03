// Builds the single-file artifact: roster/dist/roster.html
// Usage: node roster/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, "src", f), "utf8");

// Plain modules first; the UI modules run only once Preact + htm is present.
const plain = ["store.js", "metrics.js", "runtime.js", "catalog.js", "demo.js", "icons.js"].map(src).join("\n\n");
const ui = ["app-util.js", "app-chat.js", "app-recap.js", "app-hub.js", "app-org.js", "app-onboard.js", "app-main.js"].map(src).join("\n\n");
const loader = `
(function () {
  function fail() { var el = document.querySelector(".boot-sub"); if (el) el.textContent = "Roster couldn't load. Check your connection and reload."; }
  function go() { if (window.htmPreact) __rosterApp(); else fail(); }
  if (window.htmPreact) return go();
  var s = document.createElement("script");
  s.src = "https://unpkg.com/htm@3.1.1/preact/standalone.umd.js";
  s.onload = go; s.onerror = fail;
  document.head.appendChild(s);
})();`;
const scripts = plain + "\n\nfunction __rosterApp() {\n" + ui + "\n}\n" + loader;
const html = src("shell.html")
  .replace("/*__STYLES__*/", () => src("styles.css"))
  .replace("/*__SCRIPTS__*/", () => scripts);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "roster.html"), html);
console.log("built roster/dist/roster.html", (html.length / 1024).toFixed(1) + " KB");
