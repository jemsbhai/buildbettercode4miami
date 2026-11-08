import { randomBytes } from "node:crypto";
import { mkdir, open, unlink, type FileHandle } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createLocalService } from "../src/lib/reconcile-local";
import { LocalByok } from "../src/lib/reconcile-ai";

function argumentsMap() {
  const args = process.argv.slice(2), values: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const [key, inline] = args[i].split("=", 2);
    if (!["--extension-id", "--data-file", "--demo", "--ask-openai-key", "--model"].includes(key)) throw new Error(`Unknown option ${key}.`);
    values[key] = key === "--demo" || key === "--ask-openai-key" ? true : inline ?? args[++i];
    if (!values[key]) throw new Error(`Missing value for ${key}.`);
  }
  return values;
}
async function hiddenKey(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Key entry requires an interactive local terminal. Do not put keys in command arguments or environment variables.");
  process.stdout.write("Your OpenAI API key (hidden; memory only, Escape cancels): ");
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
  return new Promise((resolveKey, reject) => {
    let value = "";
    const finish = (cancel = false) => {
      process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n");
      if (cancel) reject(new Error("Key entry canceled.")); else resolveKey(value);
      value = "";
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") { finish(); return; }
        if (char === "\u0003" || char === "\u001b") { finish(true); return; }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (/^[A-Za-z0-9_-]$/.test(char) && value.length < 510) value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}
async function main() {
  const args = argumentsMap();
  if (typeof args["--extension-id"] !== "string") throw new Error("Usage: npm run sheets:local -- --extension-id YOUR_CHROME_EXTENSION_ID [--demo] [--ask-openai-key]");
  if (!/^[a-p]{32}$/.test(args["--extension-id"])) throw new Error("Enter the exact 32-letter extension ID shown by Chrome.");
  const demo = args["--demo"] === true;
  if (demo && args["--ask-openai-key"]) throw new Error("Fixture rehearsal never accepts a model key or calls a provider.");
  const ai = new LocalByok(typeof args["--model"] === "string" ? args["--model"] : undefined);
  if (args["--ask-openai-key"]) ai.setKey(await hiddenKey());
  const statePath = resolve(typeof args["--data-file"] === "string" ? args["--data-file"] : `.data/local-sheets/${demo ? "demo" : "google"}-journal.json`);
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  const lockPath = `${statePath}.lock`;
  let lock: FileHandle | undefined;
  let ownsLock = false;
  let cleanupPromise: Promise<void> | undefined;
  const cleanup = () => {
    cleanupPromise ??= (async () => {
      ai.removeKey();
      if (!ownsLock) return;
      await lock?.close();
      try { await unlink(lockPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      ownsLock = false;
    })();
    return cleanupPromise;
  };
  let shutdown: (() => Promise<void>) | undefined;
  let stopRequested = false;
  let settleStartup!: () => void;
  const startupSettled = new Promise<void>(resolveStartup => { settleStartup = resolveStartup; });
  const stop = () => {
    if (stopRequested) return;
    stopRequested = true;
    console.log("Stopping: finishing accepted work before releasing the journal lock...");
    // A signal can arrive while opening the lock or reading the journal. Wait
    // until startup can no longer create a late listener before releasing it.
    void startupSettled.then(async () => {
      if (shutdown) await shutdown();
      await cleanup();
    }).then(() => {
      console.log("Stopped cleanly. Journal lock released; in-memory credentials cleared.");
      process.exit(0);
    }).catch(() => {
      console.error("Local shutdown failed; journal lock retained. Verify the process has stopped before manual recovery.");
      process.exit(1);
    });
  };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    try { lock = await open(lockPath, "wx", 0o600); ownsLock = true; }
    catch { throw new Error(`Another process may own this journal. Stop it before removing the lock: ${lockPath}`); }
    if (stopRequested) return;
    await lock.writeFile(String(process.pid)); await lock.close();
    if (stopRequested) return;
    const token = randomBytes(32).toString("base64url");
    const service = await createLocalService({ extensionId: args["--extension-id"], token, statePath, demo, ai });
    const { server } = service;
    shutdown = service.shutdown;
    if (stopRequested) return;
    await new Promise<void>((ok, fail) => { server.once("error", fail); server.listen(4318, "127.0.0.1", ok); });
    if (stopRequested) return;
    console.log(`Tidepath local companion: http://127.0.0.1:4318\nMode: ${demo ? "fictional fixtures; no Google or AI calls" : "your Google account; correction copies only"}\nLocal journal: ${statePath}\nPairing token (local session only; paste into extension): ${token}\nAI: ${ai.status().keyPresent ? "user key present; each request still needs approval" : "off; no key"}\nStop with Ctrl+C. No hosted service or owner account is used.`);
  } catch (error) {
    if (shutdown) await shutdown();
    await cleanup();
    if (!stopRequested) throw error;
  } finally {
    settleStartup();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Local startup failed."); process.exitCode = 1; });
