// A local stand-in for Netlify: serves roster/netlify as static files and routes /api/* to the
// same handler the Netlify Function uses, backed by @netlify/blobs' own local BlobsServer
// (strong consistency, conditional writes). Usage: node roster/test/netlify-local.mjs [port]
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "..", "netlify");
const req = (m) => import(pathToFileURL(join(site, "node_modules", m)).href);

// bundled: run the deployable netlify/functions/api.mjs (one self-contained file) instead of the
// source handler; it finds Blobs through the same context Netlify gives every function.
export async function start({ port = 0, static: serveStatic = true, draft, apiKey = "", bundled = false } = {}) {
  const { getStore } = await req("@netlify/blobs/dist/main.js");
  const { BlobsServer } = await req("@netlify/blobs/dist/server.js");
  const { makeHandler } = await import(pathToFileURL(join(site, "lib", "api-core.mjs")).href);
  const token = "local-token";
  const blobs = new BlobsServer({ directory: await mkdtemp(join(tmpdir(), "roster-blobs-")), token });
  const { port: bport } = await blobs.start();
  const edge = "http://127.0.0.1:" + bport;
  // The local BlobsServer checks-then-writes; hosted Netlify Blobs applies conditional writes
  // atomically. Serialize conditional requests here so tests see the hosted behaviour.
  let chain = Promise.resolve();
  const atomicFetch = (url, init = {}) => {
    const h = new Headers(init.headers || {});
    const f = globalThis.__rosterFetch || fetch;
    if (process.env.NO_ATOMIC || (!h.has("if-none-match") && !h.has("if-match"))) return f(url, init);
    const run = chain.then(() => f(url, init));
    chain = run.then(() => {}, () => {});
    return run;
  };
  let handler;
  if (bundled) {
    const ctx = { siteID: "local", token, edgeURL: edge, uncachedEdgeURL: edge, deployID: "local" };
    globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(ctx)).toString("base64");
    if (!globalThis.__rosterFetch) { globalThis.__rosterFetch = globalThis.fetch; globalThis.fetch = (url, init) => (String(url).startsWith(edge) ? atomicFetch : globalThis.__rosterFetch)(url, init); }
    handler = (await import(pathToFileURL(join(site, "netlify", "functions", "api.mjs")).href + "?t=" + Date.now())).default;
  } else {
    handler = makeHandler({
      store: (name) => getStore({ name, siteID: "local", token, edgeURL: edge, uncachedEdgeURL: edge, consistency: "strong", fetch: atomicFetch }),
      env: { ANTHROPIC_API_KEY: apiKey },
      draft,
    });
  }
  const stats = { api: 0 };
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mjs": "text/javascript", ".toml": "text/plain" };
  const server = createServer(async (nreq, nres) => {
    const url = new URL(nreq.url, "http://localhost");
    if (url.pathname.startsWith("/api/") && serveStatic !== "static-only") {
      stats.api++;
      const chunks = [];
      for await (const c of nreq) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request("http://localhost" + nreq.url, { method: nreq.method, headers: nreq.headers, body: ["GET", "HEAD"].includes(nreq.method) ? undefined : body });
      const res = await handler(request);
      nres.writeHead(res.status, Object.fromEntries(res.headers));
      nres.end(Buffer.from(await res.arrayBuffer()));
      return;
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    try {
      const buf = await readFile(join(site, file));
      nres.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
      nres.end(buf);
    } catch (_) { nres.writeHead(404, { "content-type": "text/html" }); nres.end("<h1>Not found</h1>"); }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  return { url, stats, stop: async () => { server.close(); await blobs.stop(); } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await start({ port: +(process.argv[2] || 8888), bundled: process.argv.includes("--bundled") });
  console.log("Roster (Netlify build) at " + s.url);
}
