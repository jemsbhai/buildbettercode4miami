/** Browser UI fixture harness only. This is never included in the extension ZIP or used for Google. */
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createLocalService } from "../src/lib/reconcile-local";

async function main() {
const extensionId = "abcdefghijklmnopabcdefghijklmnop", token = randomBytes(32).toString("base64url");
const directory = await mkdtemp(join(tmpdir(), "tidepath-ui-fixture-"));
const { server: companion } = await createLocalService({ extensionId, token, statePath: join(directory, "journal.json"), demo: true });
try { await new Promise<void>((ok, fail) => { companion.once("error", fail); companion.listen(0, "127.0.0.1", ok); }); }
catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
const port = (companion.address() as { port: number }).port;
const files = new Set(["app.html", "app.mjs", "styles.css", "controller.mjs", "bridge.mjs"]);
const shim = `import { createBridge } from './bridge.mjs';
const memory = {};
globalThis.chrome = { runtime: {id:'${extensionId}',getManifest:()=>({}),getURL:p=>'chrome-extension://${extensionId}/'+p}, storage:{session:{setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,memory[key]])),set:async obj=>Object.assign(memory,obj),remove:async keys=>{for(const key of (Array.isArray(keys)?keys:[keys]))delete memory[key]},clear:async()=>{for(const key of Object.keys(memory))delete memory[key]}}},identity:{clearAllCachedAuthTokens:async()=>{}} };
const bridge=createBridge({chromeApi:chrome, fetchImpl:async (url,init)=>fetch('/fixture-api'+new URL(url).pathname,init)});
chrome.runtime.sendMessage=async message=>{try{return {ok:true,data:await bridge.handle(message,{id:'${extensionId}',url:'chrome-extension://${extensionId}/app.html'})}}catch(error){return {ok:false,error:error.message}}};
await import('./app.mjs');`;
const web = createServer(async (req, res) => {
  try {
    if (req.headers.host !== "127.0.0.1:4319" || req.headers.origin && req.headers.origin !== "http://127.0.0.1:4319") { res.writeHead(403).end(); return; }
    const path = new URL(req.url ?? "/", "http://127.0.0.1:4319").pathname;
    if (path.startsWith("/fixture-api/v1/")) {
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 128000) throw new Error("Too large"); chunks.push(chunk); }
      const result = await fetch(`http://127.0.0.1:${port}${path.slice("/fixture-api".length)}`, { method: req.method, headers: { Authorization: `Bearer ${token}`, "X-Tidepath-Extension-Id": extensionId, "Content-Type": "application/json", Prefer: String(req.headers.prefer ?? "") }, ...(["GET", "HEAD"].includes(req.method ?? "GET") ? {} : { body: Buffer.concat(chunks) }) });
      res.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(await result.text()); return;
    }
    if (path === "/fixture-shim.mjs") { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end(shim); return; }
    const name = path === "/" ? "app.html" : path.slice(1);
    if (!files.has(name)) { res.writeHead(404).end(); return; }
    let body = await readFile(resolve("extension", name), "utf8");
    if (name === "app.html") body = body.replace('src="app.mjs"', 'src="fixture-shim.mjs"').replace('<body>', '<body><p style="padding:12px;background:#fce7ad;color:#302000">BROWSER UI REHEARSAL — simulated Chrome APIs, fictional data only. Enter any 32-character pairing token. This does not verify Chrome loading or Google OAuth.</p>');
    res.writeHead(200, { "Content-Type": name.endsWith("html") ? "text/html" : name.endsWith("css") ? "text/css" : "text/javascript", "Cache-Control": "no-store" }); res.end(body);
  } catch { res.writeHead(500).end("Fixture harness failed."); }
});
try { await new Promise<void>((ok, fail) => { web.once("error", fail); web.listen(4319, "127.0.0.1", ok); }); }
catch (error) { companion.closeAllConnections(); await new Promise<void>(ok => companion.close(() => ok())); await rm(directory, { recursive: true, force: true }); throw error; }
console.log("Fictional UI rehearsal: http://127.0.0.1:4319 (simulated Chrome APIs; no Google/OAI network). Ctrl+C stops both servers and removes disposable data.");
const stop = async () => { web.closeAllConnections(); companion.closeAllConnections(); await Promise.all([new Promise<void>(ok => web.close(() => ok())), new Promise<void>(ok => companion.close(() => ok()))]); await rm(directory, { recursive: true, force: true }); process.exit(0); };
process.once("SIGINT", () => { void stop(); }); process.once("SIGTERM", () => { void stop(); });
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Fixture startup failed"); process.exitCode = 1; });
