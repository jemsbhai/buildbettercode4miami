import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "extension");
const args = process.argv.slice(2);
const usage = "Usage: npm run extension:package -- [--output-name NAME] [--oauth-client-id YOUR_CLIENT_ID.apps.googleusercontent.com]\nOutputs: out/NAME/ and out/NAME.zip (default NAME: tidepath-extension). Use a different name for store preparation to preserve your local unpacked installation.";
if (args.length === 1 && args[0] === "--help") { console.log(usage); process.exit(0); }
let clientId, outputName = "tidepath-extension";
const seen = new Set();
for (let i = 0; i < args.length; i += 2) {
  const option = args[i], value = args[i + 1];
  if (!value || seen.has(option)) throw new Error(usage);
  seen.add(option);
  if (option === "--oauth-client-id" && /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)) clientId = value;
  else if (option === "--output-name" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) outputName = value;
  else throw new Error(usage);
}
const output = join(root, "out", outputName);
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
if (clientId) manifest.oauth2 = { client_id: clientId, scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.file"] };
const files = ["app.html", "app.mjs", "styles.css", "service-worker.mjs", "bridge.mjs", "controller.mjs", "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"];
await mkdir(output, { recursive: true });
const entries = [{ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n") }];
for (const name of files) entries.push({ name, data: await readFile(join(source, name)) });
const companionSource = "https://github.com/jemsbhai/buildbettercode4miami/tree/codex/tidepath-mvp";
const companionGuide = "https://github.com/jemsbhai/buildbettercode4miami/blob/codex/tidepath-mvp/docs/EXTENSION.md";
const installation = clientId
  ? `GOOGLE AUTHORIZATION CONFIGURED\n\nOnce Tidepath's Chrome Web Store listing is published, install the extension from that listing. This ZIP is a package artifact, not a public installation URL, and configured OAuth does not itself mean Google or Chrome Web Store approval. Public users do not need to rebuild the extension or create their own OAuth client. Authorization is subject to the publisher's allowed audience and verification status.\n\nThe extension requires a separate local companion; the Store does not install it. Obtain the companion source and follow the setup guide below. Use Node 24.19.0 and npm 12.0.2, then run npm ci in the repository folder. Copy your installed Tidepath extension ID from chrome://extensions and start:\nnpm run sheets:local -- --extension-id YOUR_EXTENSION_ID\n\nKeep the terminal open. Open Tidepath, pair with the local terminal token, then choose Connect Google account. The installed extension ID must match the OAuth client configured in this package.\n`
  : `DRAFT / FICTIONAL FIXTURE ONLY\n\nGoogle authorization is not configured. This package is not ready to submit for Chrome Web Store review or public installation. A publisher may upload it as an unpublished draft to obtain the Store item ID, then prepare a configured release.\n\nFor local fictional testing, extract this ZIP into a fixed folder. Open chrome://extensions, enable Developer mode, choose Load unpacked and select this folder. Copy its extension ID. Obtain the companion source and follow the setup guide below. Use Node 24.19.0 and npm 12.0.2, then run npm ci in the repository folder and start:\nnpm run sheets:local -- --extension-id YOUR_EXTENSION_ID --demo\n\nKeep the terminal open. Open Tidepath and pair with the local terminal token. Demo uses fictional local data only; it does not authorize Google or create Google files.\n\nRelease preparers must configure a Chrome-extension OAuth client for the final Store item ID and rebuild an isolated package using --output-name and --oauth-client-id. Do not overwrite an existing local test installation.\n`;
const readme = `Tidepath local Sheets extension\n\n${installation}\nCompanion source:\n${companionSource}\nSetup, privacy, recovery and shutdown instructions:\n${companionGuide}\n\nThe companion listens only on 127.0.0.1:4318. No hosted backend or owner API key is needed. Deterministic review works without AI. Optional --ask-openai-key prompts locally without echo; requests require separate approval and are billed to your OpenAI account.\n\nSources are never edited. Verified correction copies omit private data and general styling; number formats are retained. Formula-bearing copies are blocked. Protect local journals and downloaded findings, which may contain source values. To stop the companion, press Ctrl+C and wait for Stopped cleanly.\n`;
entries.push({ name: "README.txt", data: Buffer.from(readme) });
entries.sort((a, b) => a.name.localeCompare(b.name));
for (const entry of entries) {
  const destination = join(output, entry.name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, entry.data);
}
// Deterministic ZIP (stored entries, fixed DOS date), requiring no additional dependency.
function crc32(data) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
const local = [], central = []; let offset = 0;
for (const entry of entries) {
  const name = Buffer.from(entry.name), crc = crc32(entry.data), header = Buffer.alloc(30), index = Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(entry.data.length, 18); header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(name.length, 26);
  index.writeUInt32LE(0x02014b50, 0); index.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6); index.writeUInt16LE(33, 14); index.writeUInt32LE(crc, 16); index.writeUInt32LE(entry.data.length, 20); index.writeUInt32LE(entry.data.length, 24); index.writeUInt16LE(name.length, 28); index.writeUInt32LE(offset, 42);
  local.push(header, name, entry.data); central.push(index, name); offset += header.length + name.length + entry.data.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...local, directory, end]), zip = join(root, "out", `${outputName}.zip`);
await writeFile(zip, archive);
console.log(`Unpacked extension: ${output}\nZIP: ${zip}\nSHA-256: ${createHash("sha256").update(archive).digest("hex")}\nOAuth: ${clientId ? "client ID configured; approval and publication are separate" : "not configured; draft/fictional fixture only"}`);
