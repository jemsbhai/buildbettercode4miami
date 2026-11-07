import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const source = readFileSync("integrations/google-sheets-addon/Code.gs", "utf8");

function adapter() {
  const userProperties = new Map<string, string>();
  const requests: { url: string; options: { payload: string; headers: Record<string, string> } }[] = [];
  let workbookId = "workbook-owned-12345";
  const properties = { getProperty: (key: string) => userProperties.get(key) ?? null, setProperty: (key: string, value: string) => userProperties.set(key, value), deleteProperty: (key: string) => userProperties.delete(key) };
  const context = createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => workbookId, getName: () => "My donations" }) },
    PropertiesService: { getUserProperties: () => properties, getScriptProperties: () => ({ getProperty: (key: string) => key === "TIDEPATH_PICKER_API_KEY" ? "restricted-picker-key" : "397160375233" }) },
    ScriptApp: { getIdentityToken: () => "signed-identity-token", getOAuthToken: () => "short-lived-google-token" },
    UrlFetchApp: { fetch: (url: string, options: { payload: string; headers: Record<string, string> }) => { requests.push({ url, options }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ identity: { email: "test@example.test" }, dashboard: {} }) }; } },
  });
  runInContext(source, context);
  return { context, requests, userProperties, switchWorkbook: (id: string) => { workbookId = id; } };
}

test("public add-on menu works before authorization without reading identity, properties or cells", () => {
  const app = adapter();
  let shown = false;
  const menu = { addItem: () => menu, addToUi: () => { shown = true; } };
  app.context.SpreadsheetApp = { getUi: () => ({ createAddonMenu: () => menu }), getActiveSpreadsheet: () => { throw new Error("not authorized"); } };
  app.context.PropertiesService = new Proxy({}, { get: () => { throw new Error("not authorized"); } });
  app.context.ScriptApp = new Proxy({}, { get: () => { throw new Error("not authorized"); } });
  app.context.onOpen({ authMode: "NONE" });
  assert.equal(shown, true);
  assert.equal(app.requests.length, 0);
});

test("public command derives workbook and selection, discarding browser identity and cell claims", () => {
  const app = adapter();
  const trusted = { workbookId: "workbook-owned-12345", sheetId: 7, a1: "A1:D2" };
  app.context.tidepathPinnedSelection_ = () => trusted;
  app.context.tidepathAssertUnchanged_ = () => undefined;
  app.context.tidepathCommand({ action: "approve", draftId: "draft", revision: 1, workbookId: "victim-workbook", selection: { values: [[999]] }, tenantId: "victim", userId: "victim", email: "victim@example.test", identity: "forged", accessToken: "forged" });
  const body = JSON.parse(app.requests[0].options.payload);
  assert.equal(body.workbookId, trusted.workbookId);
  assert.deepEqual(body.selection, trusted);
  for (const key of ["tenantId", "userId", "email", "identity", "accessToken"]) assert.equal(body[key], undefined);
  assert.equal(app.requests[0].options.headers.Authorization, "Bearer signed-identity-token");
  assert.equal(app.requests[0].options.headers["X-Tidepath-Google-Access-Token"], "short-lived-google-token");
  assert.equal(app.requests[0].url, "https://tidepath-sheets.vercel.app/api/public/command");
});

test("public add-on rejects demo reset and does not contact backend", () => {
  const app = adapter();
  assert.throws(() => app.context.tidepathCommand({ action: "reset" }), /Unknown/);
  assert.equal(app.requests.length, 0);
});

test("Picker callback cannot authorize a different workbook", () => {
  const app = adapter();
  assert.throws(() => app.context.tidepathConfirmWorkbook("someone-elses-file"), /currently open/);
  assert.equal(app.requests.length, 0);
  app.context.tidepathConfirmWorkbook("workbook-owned-12345");
  assert.equal(JSON.parse(app.requests[0].options.payload).workbookId, "workbook-owned-12345");
});

test("context never exposes tokens; Picker gets only the OAuth token required by Google", () => {
  const app = adapter();
  assert.doesNotMatch(JSON.stringify(app.context.tidepathContext()), /token|picker-key/i);
  const config = app.context.tidepathPickerConfiguration();
  assert.equal(config.oauthToken, "short-lived-google-token");
  assert.doesNotMatch(JSON.stringify(config), /signed-identity-token/);
  assert.equal(app.requests.length, 0);
});

test("source selections are separated per workbook, and deleting one preserves another", () => {
  const app = adapter();
  app.userProperties.set("tidepath.public.selection.v1.workbook-owned-12345", JSON.stringify({ sheetId: 7 }));
  app.userProperties.set("tidepath.public.selection.v1.workbook-owned-67890", JSON.stringify({ sheetId: 8 }));
  assert.equal(app.context.tidepathStoredSource_().sheetId, 7);
  app.context.tidepathCommand({ action: "delete", confirmation: "DELETE" });
  assert.equal(app.context.tidepathStoredSource_(), null);
  app.switchWorkbook("workbook-owned-67890");
  assert.equal(app.context.tidepathStoredSource_().sheetId, 8);
});

test("changed pinned source blocks an export before network or sheet mutation", () => {
  const app = adapter();
  app.context.tidepathStoredSource_ = () => ({ hash: "reviewed" });
  app.context.tidepathReadPinnedRange_ = () => ({ changed: true });
  app.context.tidepathHash_ = () => "new-cells";
  assert.throws(() => app.context.tidepathCommand({ action: "write", draftId: "draft", revision: 1 }), /source changed/);
  assert.equal(app.requests.length, 0);
});
