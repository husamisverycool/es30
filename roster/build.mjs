// Builds the single-file artifact: roster/dist/roster.html
// Usage: node roster/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, "src", f), "utf8");

const scripts = ["store.js", "metrics.js", "runtime.js", "catalog.js", "demo.js", "icons.js", "app.js"].map(src).join("\n\n");
const html = src("shell.html")
  .replace("/*__STYLES__*/", () => src("styles.css"))
  .replace("/*__SCRIPTS__*/", () => scripts);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "roster.html"), html);
console.log("built roster/dist/roster.html", (html.length / 1024).toFixed(1) + " KB");
