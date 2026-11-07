/** Publisher-only release helper. Never enables account-wide Apps Script API access. */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "integrations", "google-sheets-addon");
const stage = join(root, ".data", "public-addon-release");
const bindingPath = join(stage, "binding.json");
const args = new Set(process.argv.slice(2));
const accepted = new Set(["--prepare", "--create", "--push", "--version"]);
if ([...args].some(arg => !accepted.has(arg))) throw new Error("Use --prepare, --create, --push or --version. No credentials are accepted on the command line.");
const title = "Tidepath for Google Sheets";
const names = ["Code.gs", "Sidebar.html", "Picker.html", "appsscript.json"];
const types = { ".gs": "SERVER_JS", ".html": "HTML", ".json": "JSON" };
let binding;
try { binding = JSON.parse(await readFile(bindingPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("The isolated public add-on binding is invalid; inspect it before proceeding."); }
await mkdir(stage, { recursive: true });
for (const name of names) await copyFile(join(source, name), join(stage, name));

async function publisherFile() {
  let config;
  try { config = JSON.parse(await readFile(join(root, ".data", "public-addon-publisher.json"), "utf8")); }
  catch { throw new Error("Publisher config is missing. Save the restricted Picker key and Cloud project number in .data/public-addon-publisher.json; do not put them in Git or command arguments."); }
  if (!config.TIDEPATH_PICKER_API_KEY || config.TIDEPATH_CLOUD_PROJECT_NUMBER !== "397160375233"
    || config.TIDEPATH_BACKEND_URL !== "https://tidepath-sheets.vercel.app") throw new Error("Publisher config does not match the intended Cloud project and HTTPS origin.");
  const content = `// Generated publisher setup. This file is kept in ignored local staging.\nfunction initializeTidepathPublisher_() {\n  if (ScriptApp.getScriptId() !== ${JSON.stringify(binding?.scriptId ?? "CREATE_PROJECT_FIRST")}) throw new Error('Wrong Apps Script project. Stop and use the isolated Tidepath public project.');\n  PropertiesService.getScriptProperties().setProperties(${JSON.stringify({ TIDEPATH_PICKER_API_KEY: config.TIDEPATH_PICKER_API_KEY, TIDEPATH_CLOUD_PROJECT_NUMBER: config.TIDEPATH_CLOUD_PROJECT_NUMBER })}, false);\n}\n`;
  await writeFile(join(stage, "Publisher.gs"), content, { mode: 0o600 });
}

let accessToken;
async function authorization() {
  if (accessToken) return accessToken;
  let credentials;
  try { credentials = JSON.parse(await readFile(join(homedir(), ".clasprc.json"), "utf8")).tokens?.default; }
  catch { throw new Error("Existing clasp authentication was not found. Sign in using clasp in a private terminal before publishing."); }
  if (!credentials?.refresh_token || !credentials.client_id || !credentials.client_secret) throw new Error("Existing clasp credentials cannot refresh. Sign in again in a private terminal.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, redirect: "error", signal: AbortSignal.timeout(20_000),
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credentials.refresh_token, client_id: credentials.client_id, client_secret: credentials.client_secret }) });
  if (!response.ok) throw new Error(`Clasp authorization could not be refreshed (HTTP ${response.status}). Sign in again privately; no credentials were changed.`);
  const data = await response.json();
  if (typeof data.access_token !== "string") throw new Error("Google did not return a valid publisher token.");
  accessToken = data.access_token;
  return accessToken;
}

async function api(path, method = "GET", body) {
  const token = await authorization();
  let response;
  try { response = await fetch(`https://script.googleapis.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(25_000) }); }
  catch { throw new Error("Google did not confirm the publisher action. Check the Apps Script dashboard before retrying project creation; no automatic retry was made."); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = String(data.error?.message || "");
    if (response.status === 403 && /Apps Script API|script.*API|has not.*enabled|disabled/i.test(reason)) {
      throw new Error("Google blocked project management because Apps Script API access is disabled. This helper will not enable that account-wide setting. The account owner must approve enabling it at https://script.google.com/home/usersettings, or use the Apps Script editor to create and upload this isolated prepared project. Re-disable API access after the authorized upload if that is the owner's preference.");
    }
    throw new Error(`Google rejected the publisher action (HTTP ${response.status}, ${String(data.error?.status ?? "UNKNOWN").replace(/[^A-Z_]/g, "")}). Check publisher permissions in the Cloud/Apps Script console. No credential values are logged.`);
  }
  return response.json();
}

try {
  if (args.has("--create") && !binding) {
    const project = await api("projects", "POST", { title }); // No parentId: standalone only.
    if (!project.scriptId || project.parentId || project.title !== title) throw new Error("The new project did not match the standalone public add-on. Stop before uploading.");
    binding = { scriptId: project.scriptId, title, projectNumber: "397160375233", createdAt: new Date().toISOString() };
    await writeFile(bindingPath, JSON.stringify(binding, null, 2), { flag: "wx", mode: 0o600 });
  }
  await publisherFile();
  if (args.has("--push") || args.has("--version")) {
    if (!binding?.scriptId || binding.title !== title || binding.projectNumber !== "397160375233") throw new Error("Create the isolated public project first using --create. This helper never reuses the demo's clasp binding.");
    const project = await api(`projects/${encodeURIComponent(binding.scriptId)}`);
    if (project.parentId || project.title !== title) throw new Error("Refusing to update a bound or renamed project. Confirm the isolated public binding manually.");
    if (args.has("--push")) {
      const files = [];
      for (const file of [...names, "Publisher.gs"]) {
        const extension = file.slice(file.lastIndexOf("."));
        files.push({ name: file.slice(0, -extension.length), type: types[extension], source: await readFile(join(stage, file), "utf8") });
      }
      await api(`projects/${encodeURIComponent(binding.scriptId)}/content`, "PUT", { files });
      console.log("Uploaded five allowlisted public add-on files. Existing demo project and account API settings were not changed.");
    }
    if (args.has("--version")) {
      const version = await api(`projects/${encodeURIComponent(binding.scriptId)}/versions`, "POST", { description: "Tidepath public Editor add-on release candidate" });
      console.log(`Created immutable script version ${version.versionNumber}. This is not Marketplace submission or approval.`);
    }
  }
  console.log(`Prepared public add-on files in ${stage}. Publisher values were not printed.`);
  if (binding?.scriptId) console.log(`Editor: https://script.google.com/home/projects/${binding.scriptId}/edit\nNext: link standard Cloud project 397160375233, run initializeTidepathPublisher_ in the editor, and create a fresh-workbook Editor add-on test deployment.`);
  else console.log("No Apps Script project created. Use --create --push when account API access is authorized, or create the standalone project in the editor.");
} catch (error) {
  // Avoid stack traces containing request bodies or token-bearing provider objects.
  console.error(error instanceof Error ? error.message : "The publisher action failed.");
  process.exitCode = 1;
}
