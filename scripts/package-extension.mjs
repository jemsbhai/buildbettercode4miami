import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "extension"), output = join(root, "out", "tidepath-extension");
const args = process.argv.slice(2);
let clientId;
if (args.length) {
  if (args.length !== 2 || args[0] !== "--oauth-client-id" || !/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(args[1])) throw new Error("Usage: npm run extension:package -- [--oauth-client-id YOUR_CLIENT_ID.apps.googleusercontent.com]");
  clientId = args[1];
}
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
if (clientId) manifest.oauth2 = { client_id: clientId, scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.file"] };
const files = ["app.html", "app.mjs", "styles.css", "service-worker.mjs", "bridge.mjs", "controller.mjs"];
await mkdir(output, { recursive: true });
const entries = [{ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n") }];
for (const name of files) entries.push({ name, data: await readFile(join(source, name)) });
entries.push({ name: "README.txt", data: Buffer.from("Tidepath local Sheets extension\n\nExtract this ZIP into a fixed folder. Open chrome://extensions, enable Developer mode, choose Load unpacked and select this folder. Copy its extension ID.\n\nFrom the Tidepath repository with pinned Node/npm and npm ci completed:\nnpm run sheets:local -- --extension-id YOUR_EXTENSION_ID --demo\n\nOpen Tidepath and pair with the local terminal token. Demo uses fictional local data only.\n\nFor Google data, configure your own Chrome OAuth client and package using --oauth-client-id (see docs/EXTENSION.md). Restart companion without --demo. No deployment, owner key, shared paid account or hosting is needed. Optional --ask-openai-key prompts locally without echo; requests require separate approval and are billed to your OpenAI account.\n\nSources are never edited. Verified correction copies omit private data and general styling; number formats are retained. Formula-bearing copies are blocked. Review docs/LOCAL-SHEETS.md and docs/EXTENSION.md for limits, privacy and recovery.\n") });
entries.sort((a, b) => a.name.localeCompare(b.name));
for (const entry of entries) await writeFile(join(output, entry.name), entry.data);
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
const archive = Buffer.concat([...local, directory, end]), zip = join(root, "out", "tidepath-extension.zip");
await writeFile(zip, archive);
console.log(`Unpacked extension: ${output}\nZIP: ${zip}\nSHA-256: ${createHash("sha256").update(archive).digest("hex")}\nOAuth: ${clientId ? "user-configured" : "not configured; local demo works"}`);
