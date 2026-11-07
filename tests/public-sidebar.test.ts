import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { handlePublicCommand, type PublicCommandDependencies } from "../src/lib/public/command";
import type { WorkspaceCheckpoint } from "../src/lib/public/storage";
import type { SheetsSelection, SheetsWorkspace } from "../src/lib/sheets-types";

const html = readFileSync("integrations/google-sheets-addon/Sidebar.html", "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/u)![1];
const nativeSource = readFileSync("integrations/google-sheets-addon/Code.gs", "utf8");
type Listener = (event: { preventDefault(): void }) => unknown;

/** DOM boundary only. The real sidebar, Apps Script adapter, route and engine run below. */
class Element {
  private identifier = ""; private ownText = "";
  children: Element[] = []; listeners: Record<string, Listener[]> = {}; attributes: Record<string, string> = {};
  value = ""; className = ""; hidden = false; disabled = false; checked = false; open = false; type = ""; step = ""; href = ""; target = ""; rel = "";
  constructor(public tag: string, private document: Document) {}
  get id() { return this.identifier; }
  set id(value: string) { this.identifier = value; this.document.ids.set(value, this); }
  get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join(""); }
  set textContent(value: string) { this.ownText = String(value); this.children = []; }
  set innerHTML(_: string) { throw new Error("UI must never parse untrusted cell markup"); }
  append(...items: Element[]) { this.children.push(...items); }
  replaceChildren(...items: Element[]) { this.ownText = ""; this.children = items; }
  setAttribute(key: string, value: string) { this.attributes[key] = value; }
  addEventListener(name: string, listener: Listener) { (this.listeners[name] ??= []).push(listener); }
  dispatch(name: string) { for (const listener of this.listeners[name] ?? []) listener({ preventDefault() {} }); }
  get classList() { return { toggle: (name: string, include: boolean) => { const classes = this.className.split(" ").filter(value => value && value !== name); if (include) classes.push(name); this.className = classes.join(" "); } }; }
}
class Document {
  ids = new Map<string, Element>(); elements: Element[] = [];
  constructor() {
    for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gu)) {
      const element = this.createElement(match[1]); element.id = match[3]; element.hidden = /\bhidden\b/u.test(match[2]);
    }
    this.getElementById("mode").value = "demo";
    this.getElementById("amount-unit").value = "cents";
  }
  createElement(tag: string) { const element = new Element(tag, this); this.elements.push(element); return element; }
  getElementById(id: string) { const element = this.ids.get(id); assert.ok(element, `Missing UI element ${id}`); return element; }
  querySelectorAll(selector: string) { const tags = selector.split(","); return this.elements.filter(element => tags.includes(element.tag)); }
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(): SheetsSelection {
  const values = [
    ["Gift ID", "Donor ID", "Donor name", "Email", "Phone", "Amount", "Gift date", "Channel"],
    ["g1", "r1", "Rosa Delgado", "rosa@example.test", "3055550101", 100, "2026-09-01", "online"],
    ["g2", "r2", "Rosa M. Delgado", "rosa@example.test", "3055550101", 50, "2026-09-02", "tickets"],
    ["g3", "other", "Rosa Delgado", "other@example.test", "3055550199", 25, "2026-09-03", "check"],
  ];
  return { workbookId: "public-sidebar-workbook", sheetId: 10, sheetName: "Donations", a1: "A1:H4", startRow: 1, startColumn: 1, values, formulas: values.map(row => row.map(() => "")) };
}

async function harness() {
  const document = new Document(); const source = fixture(); const properties = new Map<string, string>();
  let saved: SheetsWorkspace | undefined;
  const calls: { action: string; requestId?: string; [key: string]: unknown }[] = [];
  const exports = new Map<string, { sheetName: string; url: string }>();
  let before: ((command: Record<string, unknown>) => boolean) | undefined;
  let after: ((command: Record<string, unknown>) => boolean) | undefined;
  let captured: { url: string; options: { payload: string; headers: Record<string, string> } } | undefined;
  let responseForNative: { status: number; body: unknown } | undefined;
  const range = () => ({ getNumRows: () => source.values.length, getNumColumns: () => source.values[0].length,
    getValues: () => source.values, getFormulas: () => source.formulas, getA1Notation: () => source.a1,
    getRow: () => source.startRow, getColumn: () => source.startColumn, getSheet: () => sheet() });
  const sheet = () => ({ getSheetId: () => source.sheetId, getName: () => source.sheetName, getRange: () => range() });
  const workbook = { getId: () => source.workbookId, getName: () => "My donations", getSpreadsheetTimeZone: () => "America/New_York",
    getActiveRangeList: () => ({ getRanges: () => [range()] }), getActiveRange: () => range(), getSheetById: (id: number) => id === source.sheetId ? sheet() : null };
  const native = createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => workbook },
    PropertiesService: { getUserProperties: () => ({ getProperty: (key: string) => properties.get(key) ?? null, setProperty: (key: string, value: string) => properties.set(key, value), deleteProperty: (key: string) => properties.delete(key) }) },
    ScriptApp: { getIdentityToken: () => "signed-test-identity", getOAuthToken: () => "test-google-access" },
    Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" }, computeDigest: (_algorithm: unknown, value: string) => [...createHash("sha256").update(value).digest()] },
    UrlFetchApp: { fetch: (url: string, options: { payload: string; headers: Record<string, string> }) => {
      captured = { url, options };
      if (!responseForNative) throw new Error("Pause synchronous Apps Script transport at the network boundary");
      return { getResponseCode: () => responseForNative!.status, getContentText: () => JSON.stringify(responseForNative!.body) };
    } },
  });
  runInContext(nativeSource, native);
  const dependencies: PublicCommandDependencies = {
    authenticate: async headers => {
      assert.equal(headers.get("authorization"), "Bearer signed-test-identity");
      assert.equal(headers.get("x-tidepath-google-access-token"), "test-google-access");
      return { sub: "sidebar-owner", email: "owner@example.test" };
    },
    store: {
      async consumeUsage() {},
      async deleteWorkbook() { saved = undefined; },
      async withWorkspace<T>(_identity: unknown, _workbookId: string, create: () => SheetsWorkspace, operation: (workspace: SheetsWorkspace, checkpoint: WorkspaceCheckpoint) => Promise<T>) {
        const workspace = structuredClone(saved ?? create());
        const checkpoint: WorkspaceCheckpoint = async current => { saved = structuredClone(current); };
        const result = await operation(workspace, checkpoint); await checkpoint(workspace); return result;
      },
    },
    gateway: () => ({
      async assertWorkbookAccess(workbookId) { assert.equal(workbookId, source.workbookId); },
      async readSelection(location) { assert.deepEqual(Object.keys(location).sort(), ["a1", "sheetId", "workbookId"]); return structuredClone(source); },
      async writeApprovedReport(_identity, _source, approved, fence) {
        await fence?.();
        const key = approved.approvalDigest;
        const prior = exports.get(key);
        const receipt = prior ?? { sheetName: "My approved donation report", url: `https://docs.google.com/spreadsheets/d/${source.workbookId}/edit#gid=77` };
        if (!prior) exports.set(key, receipt);
        return { ...receipt, replayed: Boolean(prior) };
      },
    }),
  };
  async function invoke(name: string, argument?: Record<string, unknown>) {
    if (name === "tidepathContext" || name === "tidepathReadSelection") return JSON.parse(JSON.stringify(native[name]()));
    assert.equal(name, "tidepathCommand");
    const input = JSON.parse(JSON.stringify(argument));
    if (before?.(input)) throw new Error("Simulated connection lost before sending");
    // Execute the actual synchronous adapter up to UrlFetch; no post-success side effects occur.
    captured = undefined; responseForNative = undefined;
    try { native.tidepathCommand(input); } catch (error) { if (!captured) throw error; }
    assert.ok(captured);
    const requestData = captured as { url: string; options: { payload: string; headers: Record<string, string> } };
    const payload = JSON.parse(requestData.options.payload);
    calls.push(payload);
    const response = await handlePublicCommand(new Request(requestData.url, { method: "POST", headers: { ...requestData.options.headers, "content-type": "application/json" }, body: requestData.options.payload }), dependencies);
    responseForNative = { status: response.status, body: await response.json() };
    if (after?.(payload)) { responseForNative = undefined; throw new Error("Simulated connection lost after server committed"); }
    // Resume the same adapter against the real response to exercise error translation and source checks.
    try { return JSON.parse(JSON.stringify(native.tidepathCommand(input))); }
    finally { responseForNative = undefined; }
  }
  const runner = () => {
    let success: (value: unknown) => void = () => {}; let failure: (error: unknown) => void = () => {}; let proxy: any;
    proxy = new Proxy({}, { get: (_, name) => {
      if (name === "withSuccessHandler") return (callback: typeof success) => { success = callback; return proxy; };
      if (name === "withFailureHandler") return (callback: typeof failure) => { failure = callback; return proxy; };
      return (argument: Record<string, unknown>) => { Promise.resolve().then(() => invoke(String(name), argument)).then(success, failure); };
    } }); return proxy;
  };
  runInContext(script, createContext({ document, google: { script: { get run() { return runner(); } } }, URL, Intl,
    crypto: { randomUUID: (() => { let id = 0; return () => `public-ui-${++id}`; })() }, setInterval, clearInterval }));
  await flush();
  const element = (id: string) => document.getElementById(id);
  const click = async (id: string) => { const target = element(id); assert.equal(target.disabled, false, `${id} must be available: ${element("error").textContent}`); target.dispatch("click"); await flush(); };
  const input = (target: Element, value: string, event = "input") => { target.value = value; target.dispatch(event); };
  const dates = () => { input(element("period-start"), "2026-09-01", "change"); input(element("period-end"), "2026-09-30", "change"); };
  const importRows = async () => { await click("read-selection"); dates(); await click("preview"); await click("import"); };
  return { source, document, element, click, input, dates, importRows, calls, exports, get workspace() { assert.ok(saved); return saved; },
    set before(value: typeof before) { before = value; }, set after(value: typeof after) { after = value; } };
}

test("public sidebar, native adapter and real route complete date-mapped donation reconciliation and exact approval", async () => {
  const app = await harness();
  assert.match(app.element("account-email").textContent, /owner@example.test/);
  await app.click("read-selection");
  assert.equal(app.element("amount-unit").value, "dollars");
  await app.click("preview"); assert.match(app.element("error").textContent, /reporting start and end/);
  assert.equal(app.calls.filter(call => call.action === "preview").length, 0);
  app.dates(); await app.click("preview");
  assert.equal(app.workspace.state.gifts.length, 0);
  assert.match(app.element("preview-metrics").textContent, /\$175\.00/);
  await app.click("import");
  assert.equal(app.workspace.state.gifts.length, 3);
  assert.equal(app.workspace.state.participants.length, 0);
  assert.equal(app.workspace.state.period.start, "2026-09-01");
  const merge = app.element("candidates").children[0].children.at(-1)!.children[0];
  merge.dispatch("click"); await flush();
  assert.equal(app.workspace.state.donors.filter(donor => !donor.mergedInto).length, 2);
  await app.click("generate");
  assert.equal(app.workspace.state.drafts.length, 1, app.element("error").textContent);
  assert.deepEqual(app.workspace.state.drafts[0].claims.map(claim => claim.metricId).sort(), ["donors", "giving"]);
  assert.equal(app.element("write-report").disabled, true);
  const givingField = () => app.element("claims").children.find(group => group.textContent.includes("$175.00"))!.children[0].children[0];
  app.input(givingField(), "999"); await app.click("save-draft"); await app.click("approve");
  assert.match(app.element("error").textContent, /Approval blocked/);
  assert.equal(app.workspace.state.drafts[0].status, "pending");
  app.input(givingField(), "175"); await app.click("save-draft"); await app.click("approve");
  assert.equal(app.workspace.state.drafts[0].status, "approved"); assert.equal(app.exports.size, 0);
  app.source.values[1][5] = 101;
  await app.click("write-report"); assert.match(app.element("error").textContent, /source changed/);
  assert.equal(app.exports.size, 0);
  app.source.values[1][5] = 100;
  await app.click("write-report"); assert.equal(app.exports.size, 1);
  await app.click("write-report"); assert.equal(app.exports.size, 1);
  assert.match(app.element("write-result").textContent, /Already written/);
  assert(app.calls.filter(call => call.selection).every(call => !JSON.stringify(call.selection).includes("values")));
});

test("public sidebar replacement preview shows corrections/removals and invalidates earlier approval", async () => {
  const app = await harness(); await app.importRows(); await app.click("generate"); await app.click("approve");
  app.source.values[1][5] = 130;
  app.source.values.pop(); app.source.formulas.pop(); app.source.a1 = "A1:H3";
  await app.click("read-selection"); await app.click("preview");
  assert.match(app.element("preview-count").textContent, /1 corrected.*1 removed/);
  assert.match(app.element("preview-metrics").textContent, /\$180\.00/);
  assert.equal(app.workspace.state.gifts.length, 3, "correction preview remains a dry run");
  await app.click("import");
  assert.equal(app.workspace.state.gifts.length, 2);
  assert.equal(app.element("write-report").disabled, true, "old approval cannot export changed evidence");
  await app.click("generate"); await app.click("approve"); await app.click("write-report");
  assert.equal(app.exports.size, 1);
});

test("public sidebar lost generation/write replies retry saved work and failed edits preserve local text", async () => {
  const app = await harness(); await app.importRows();
  let lostGeneration = true;
  app.after = command => command.action === "generate" && lostGeneration ? (lostGeneration = false, true) : false;
  await app.click("generate");
  assert.equal(app.workspace.state.drafts.length, 1);
  assert.equal(app.element("generate").textContent, "Retry saved request");
  await app.click("generate");
  const requests = app.calls.filter(call => call.action === "generate");
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(app.workspace.state.drafts.length, 1);
  app.input(app.element("narrative"), "Staff reviewed the donation records for this reporting period.");
  app.before = command => command.action === "edit";
  await app.click("save-draft");
  assert.equal(app.element("narrative").value, "Staff reviewed the donation records for this reporting period.");
  assert.equal(app.element("approve").disabled, true);
  app.before = undefined; await app.click("save-draft"); await app.click("approve");
  let lostWrite = true;
  app.after = command => command.action === "write" && lostWrite ? (lostWrite = false, true) : false;
  await app.click("write-report"); assert.equal(app.exports.size, 1);
  await app.click("write-report"); assert.equal(app.exports.size, 1);
  assert.match(app.element("write-result").textContent, /Already written/);
});

test("public sidebar invalidates preview on date/mapping changes and keeps selected markup literal", async () => {
  const app = await harness(); app.source.values[1][2] = '<img src=x onerror="steal()">';
  await app.click("read-selection"); app.dates(); await app.click("preview");
  assert.equal(app.element("import").disabled, false);
  app.input(app.element("period-end"), "2026-09-29", "change");
  assert.equal(app.element("import").disabled, true);
  await app.click("preview");
  app.input(app.element("map-donor_id"), "", "change");
  assert.equal(app.element("import").disabled, true);
  await app.click("preview"); await app.click("import");
  assert.equal(app.workspace.state.gifts.length, 3);
  assert.match(app.element("selection-sample").textContent, /<img src=x/);
  assert.equal(app.document.elements.some(element => element.tag === "img"), false);
});
