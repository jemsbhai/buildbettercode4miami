import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createLocalService } from "../src/lib/reconcile-local";
import { LocalByok } from "../src/lib/reconcile-ai";
import { createBridge, COMPANION_ORIGIN, GOOGLE_SCOPES, isAllowedRequest } from "../extension/bridge.mjs";
import { createController, toggleFindingSelection } from "../extension/controller.mjs";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const token = "p".repeat(48);
const sender = { id: extensionId, url: `chrome-extension://${extensionId}/app.html` };
const status = { service: "tidepath-local", googleConnected: true, demo: true, limits: { maxWorkbooks: 20 }, ai: { keyPresent: false, attempts: 0, maxAttempts: 12 } };
function harness(overrides: { fetchImpl?: typeof fetch; oauth?: boolean; grantedScopes?: string[]; maxPolls?: number } = {}) {
  const values: Record<string, unknown> = {};
  const calls: { url: string; init: RequestInit }[] = [];
  const storageCalls: unknown[] = [];
  let authCalls = 0, cleared = 0;
  const chromeApi = {
    runtime: { id: extensionId, getURL: (path: string) => `chrome-extension://${extensionId}/${path}`, getManifest: () => overrides.oauth ? { oauth2: { client_id: "user-client.apps.googleusercontent.com" } } : {} },
    storage: { session: {
      async setAccessLevel(value: unknown) { storageCalls.push(value); },
      async get(keys: string | string[]) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, values[key]])); },
      async set(data: object) { Object.assign(values, data); },
      async remove(key: string) { delete values[key]; },
      async clear() { for (const key of Object.keys(values)) delete values[key]; },
    } },
    identity: {
      async getAuthToken(details: unknown) { authCalls++; storageCalls.push(details); return { token: "google-secret-test", grantedScopes: overrides.grantedScopes ?? [...GOOGLE_SCOPES] }; },
      async clearAllCachedAuthTokens() { cleared++; }, async removeCachedAuthToken() { cleared++; },
    },
  };
  const fetchImpl = overrides.fetchImpl ?? (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return Response.json(status); }) as typeof fetch;
  const bridge = createBridge({ chromeApi, fetchImpl, wait: async () => {}, ...(overrides.maxPolls ? { maxPolls: overrides.maxPolls } : {}) });
  return { bridge, values, calls, storageCalls, authCalls: () => authCalls, cleared: () => cleared };
}

test("extension manifest grants only local companion host access and no page injection", async () => {
  const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage", "identity"]);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1/*"]);
  for (const field of ["content_scripts", "externally_connectable", "web_accessible_resources", "oauth2"]) assert.equal(manifest[field], undefined);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
  assert.doesNotMatch(manifest.content_security_policy.extension_pages, /unsafe-eval|unsafe-inline|https:\/\/api.openai.com/);
});

test("worker accepts only the exact extension page as caller", async () => {
  const { bridge, calls } = harness();
  for (const invalid of [{}, { ...sender, id: "other" }, { ...sender, url: "https://docs.google.com/spreadsheets/d/test" }, { ...sender, url: `${sender.url}?untrusted=1` }]) {
    await assert.rejects(bridge.handle({ type: "pair", token }, invalid), /only from Tidepath/);
  }
  assert.equal(calls.length, 0);
});

test("pairing is verified, session-only, and never returned to the UI", async () => {
  const h = harness();
  await h.bridge.handle({ type: "pair", token }, sender);
  assert.equal(h.values.pairingToken, token);
  assert.deepEqual(h.storageCalls[0], { accessLevel: "TRUSTED_CONTEXTS" });
  assert.equal(h.calls[0].url, `${COMPANION_ORIGIN}/v1/status`);
  assert.deepEqual(h.calls[0].init.headers, { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tidepath-Extension-Id": extensionId, Prefer: "respond-async" });
  assert.equal(h.calls[0].init.redirect, "error");
  assert.equal(h.calls[0].init.credentials, "omit");
  const session = await h.bridge.handle({ type: "session" }, sender);
  assert.equal(session.paired, true);
  assert.doesNotMatch(JSON.stringify(session), new RegExp(token));
});

test("a wrong local service or failed pairing does not save the token", async () => {
  const h = harness({ fetchImpl: (async () => Response.json({ service: "other" })) as typeof fetch });
  await assert.rejects(h.bridge.handle({ type: "pair", token }, sender), /not Tidepath/);
  assert.deepEqual(h.values, {});
});

test("arbitrary URLs and provider endpoints cannot pass the worker request boundary", async () => {
  const h = harness(); h.values.pairingToken = token;
  for (const path of ["https://api.openai.com/v1/responses", "/v1/status/../secret", "/v1/google", "//evil.test", "/v1/ai/key?secret=1", "/v1/workbooks?pageToken=x&redirect=evil"]) {
    assert.equal(isAllowedRequest("GET", path), false);
    await assert.rejects(h.bridge.handle({ type: "request", method: "GET", path }, sender), /Unsupported/);
  }
  assert.equal(h.calls.length, 0);
});

test("no Google authorization occurs on startup, status, or unconfigured package", async () => {
  const h = harness(); await h.bridge.ready(); await h.bridge.handle({ type: "session" }, sender);
  h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "connectGoogle" }, sender), /not configured/);
  assert.equal(h.authCalls(), 0);
});

test("explicit Google connect sends token only to companion and never returns or stores it", async () => {
  const h = harness({ oauth: true }); h.values.pairingToken = token;
  assert.deepEqual(await h.bridge.handle({ type: "connectGoogle" }, sender), { connected: true });
  assert.equal(h.authCalls(), 1);
  assert.equal(h.calls[0].url, `${COMPANION_ORIGIN}/v1/google`);
  assert.deepEqual(JSON.parse(h.calls[0].init.body as string), { accessToken: "google-secret-test" });
  assert.doesNotMatch(JSON.stringify(h.values), /google-secret-test/);
});

test("partial Google grants are rejected before local connection", async () => {
  const h = harness({ oauth: true, grantedScopes: [GOOGLE_SCOPES[0]] }); h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "connectGoogle" }, sender), /incomplete/);
  assert.equal(h.cleared(), 1); assert.equal(h.calls.length, 0);
});

test("disconnect and unpair remove companion access and session state", async () => {
  const h = harness(); h.values.pairingToken = token; h.values.pendingApply = { planId: "plan", requestId: "request" };
  await h.bridge.handle({ type: "unpair" }, sender);
  assert.equal(h.calls[0].url, `${COMPANION_ORIGIN}/v1/google`);
  assert.equal(h.calls[0].init.method, "DELETE");
  assert.equal(h.cleared(), 1); assert.deepEqual(h.values, {});
});

test("worker gives actionable transport errors without echoing credentials", async () => {
  const h = harness({ fetchImpl: (async () => { throw new Error(`oops ${token}`); }) as typeof fetch }); h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "request", method: "GET", path: "/v1/status" }, sender), (error: Error) => /same request/.test(error.message) && !error.message.includes(token));
});

test("async worker requests poll short job endpoints without repeating the initial POST", async () => {
  const requests: { url: string; method: string; headers: HeadersInit | undefined }[] = [];
  const h = harness({ fetchImpl: (async (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? "GET", headers: init?.headers });
    if (requests.length === 1) return Response.json({ jobId: "job-123" }, { status: 202 });
    if (requests.length === 2) return Response.json({ status: "running" });
    return Response.json({ status: "completed", result: { id: "scan-result" } });
  }) as typeof fetch });
  h.values.pairingToken = token;
  const result = await h.bridge.handle({ type: "request", method: "POST", path: "/v1/scans", body: { workbookIds: ["a"] } }, sender);
  assert.deepEqual(result, { id: "scan-result" });
  assert.deepEqual(requests.map(item => item.method), ["POST", "GET", "GET"]);
  assert.ok(requests.slice(1).every(item => item.url === `${COMPANION_ORIGIN}/v1/jobs/job-123`));
  assert.ok(requests.every(item => (item.headers as Record<string, string>).Prefer === "respond-async"));
  assert.deepEqual(h.values.pendingJobs, []);
});

test("async job timeout retains a secret-free recovery ID and resumes without resubmission", async () => {
  let requests = 0, completed = false;
  const h = harness({ maxPolls: 2, fetchImpl: (async () => {
    requests++;
    if (requests === 1) return Response.json({ jobId: "job-pending" }, { status: 202 });
    return Response.json(completed ? { status: "completed", result: { status: "complete" } } : { status: "running" });
  }) as typeof fetch });
  h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "request", method: "POST", path: "/v1/plans/plan-1/apply", body: { approved: true, requestId: "stable-id" } }, sender), /Recover background request/);
  assert.deepEqual(h.values.pendingJobs, [{ jobId: "job-pending", method: "POST", path: "/v1/plans/plan-1/apply" }]);
  const ui = await h.bridge.handle({ type: "session" }, sender);
  assert.doesNotMatch(JSON.stringify(ui), new RegExp(token));
  completed = true;
  const recovered = await h.bridge.handle({ type: "resumeJob", jobId: "job-pending" }, sender);
  assert.deepEqual(recovered.result, { status: "complete" }); assert.equal(requests, 4);
  assert.deepEqual(h.values.pendingJobs, []);
});

test("failed background jobs propagate failure and never automatically repeat a model request", async () => {
  let requests = 0;
  const h = harness({ fetchImpl: (async () => ++requests === 1 ? Response.json({ jobId: "ai-job" }, { status: 202 }) : Response.json({ status: "failed", httpStatus: 502, error: "Provider outcome is unknown." })) as typeof fetch });
  h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "request", method: "POST", path: "/v1/scans/scan-1/ai", body: { enabled: true, approvedPayloadHash: "approved" } }, sender), /outcome is unknown/);
  assert.equal(requests, 2); assert.deepEqual(h.values.pendingJobs, []);
});

test("background recovery rejects IDs not recorded in the trusted session", async () => {
  const h = harness(); h.values.pairingToken = token;
  await assert.rejects(h.bridge.handle({ type: "resumeJob", jobId: "unsaved" }, sender), /No matching/);
  assert.equal(h.calls.length, 0);
});

function controllerHarness(responder?: (message: any) => any) {
  const messages: any[] = [];
  let pending: any = null;
  const send = async (message: any) => {
    messages.push(structuredClone(message));
    if (message.type === "session") return { paired: true, extensionId, pendingApply: pending, oauthConfigured: false };
    if (message.type === "pendingApply") { pending = message.value; return {}; }
    if (message.path === "/v1/status") return structuredClone(status);
    return responder?.(message) ?? {};
  };
  const controller = createController(send, () => "stable-request-id") as any;
  return { controller, messages, pending: () => pending };
}
const report = { id: "scan-1", scope: { workbookIds: ["book-a", "book-b"], tabCount: 3, rowCount: 7 }, findings: [{ id: "fix-1", proposedFix: { before: { value: " A " }, after: { value: "A" } } }, { id: "manual-1", type: "duplicate_gift" }] };

test("discovery follows pages and never selects or scans a workbook implicitly", async () => {
  const h = controllerHarness(message => message.path.includes("pageToken") ? { files: [{ id: "book-b", name: "B" }] } : { files: [{ id: "book-a", name: "A" }], nextPageToken: "page two" });
  await h.controller.discover();
  assert.deepEqual(h.controller.state.workbooks.map((file: any) => file.id), ["book-a", "book-b"]);
  assert.equal(h.controller.state.selected.size, 0);
  assert.equal(h.messages.length, 2);
  assert.equal(h.messages[1].path, "/v1/workbooks?pageToken=page%20two");
});

test("multi-workbook scanning requires explicit broad and privacy consent", async () => {
  const h = controllerHarness(() => report);
  h.controller.state.selected = new Set(["book-a", "book-b"]);
  await assert.rejects(h.controller.scan(), /multiple/);
  await assert.rejects(h.controller.scan({ broadScan: true }), /appropriate/);
  assert.equal(h.messages.length, 0);
  await h.controller.scan({ broadScan: true, confirmNonSensitive: true, tabs: [{ workbookId: "book-a", sheetId: 1, mapping: { amount: 4 }, amountUnit: "cents" }] });
  assert.equal(h.messages[0].path, "/v1/scans");
  assert.deepEqual(h.messages[0].body.workbookIds, ["book-a", "book-b"]);
  assert.equal(h.messages[0].body.options.tabs[0].amountUnit, "cents");
  assert.equal(h.controller.state.report.scope.tabCount, 3);
  assert.equal(h.messages.some(message => /\/ai/.test(message.path ?? "")), false);
});

test("manual duplicate findings cannot become an automatic correction plan", async () => {
  const h = controllerHarness(() => ({ id: "plan-1", patches: [] })); h.controller.state.report = report;
  await assert.rejects(h.controller.plan(["manual-1"]), /cannot be applied/);
  assert.equal(h.messages.length, 0);
  await h.controller.plan(["fix-1"]);
  assert.deepEqual(h.messages[0].body.findingIds, ["fix-1"]);
});

test("apply requires review and preserves one idempotency ID across failures and reload recovery", async () => {
  let attempts = 0;
  const h = controllerHarness(message => { if (message.path?.endsWith("/apply")) { attempts++; if (attempts === 1) throw new Error("lost reply"); return { operationId: "stable-request-id", status: "complete" }; } });
  h.controller.state.plan = { id: "plan-1" };
  await assert.rejects(h.controller.apply(false), /approve/); assert.equal(h.messages.length, 0);
  await assert.rejects(h.controller.apply(true), /lost reply/);
  assert.deepEqual(h.pending(), { planId: "plan-1", requestId: "stable-request-id" });
  await h.controller.refresh();
  const recovered = await h.controller.retryPending();
  assert.equal(recovered.status, "complete");
  const applies = h.messages.filter(message => message.path?.endsWith("/apply"));
  assert.equal(applies.length, 2); assert.deepEqual(applies[0], applies[1]);
});

test("new plan clears previous approval and retry identity", async () => {
  const h = controllerHarness(() => ({ id: "plan-new" })); h.controller.state.report = report;
  h.controller.state.pendingApply = { planId: "plan-old", requestId: "old" };
  await h.controller.plan(["fix-1"]);
  assert.equal(h.controller.state.pendingApply, null); assert.equal(h.pending(), null);
});

test("a proposed identity decision selects and deselects the complete donor group", () => {
  const findings = [{ id: "a", proposedFix: { groupId: "donor-1" } }, { id: "b", proposedFix: { groupId: "donor-1" } }, { id: "c", proposedFix: {} }];
  const selected = new Set<string>();
  toggleFindingSelection(selected, findings, "a", true);
  assert.deepEqual([...selected], ["a", "b"]);
  toggleFindingSelection(selected, findings, "c", true);
  toggleFindingSelection(selected, findings, "b", false);
  assert.deepEqual([...selected], ["c"]);
});

test("correction planning requires reviewed mapping on each edited tab", async () => {
  const h = controllerHarness(() => ({ id: "plan-1" }));
  h.controller.state.report = { ...report, mappings: [{ workbookId: "book-a", sheetId: 1, confirmed: false }], findings: [{ id: "fix-1", proposedFix: { ref: { workbookId: "book-a", sheetId: 1 } } }] };
  await assert.rejects(h.controller.plan(["fix-1"]), /Confirm mappings and rescan/);
  assert.equal(h.messages.length, 0);
  h.controller.state.report.mappings[0].confirmed = true;
  await h.controller.plan(["fix-1"]);
  assert.equal(h.messages[0].path, "/v1/scans/scan-1/plan");
});

test("AI cannot run without key, preview and per-request explicit approval", async () => {
  const h = controllerHarness(message => message.path?.endsWith("ai-preview") ? { payloadHash: "approved-hash", payload: { input: "counts only" } } : { status: "completed", text: "advice", usage: { known: false } });
  h.controller.state.report = report; h.controller.state.status = structuredClone(status);
  await assert.rejects(h.controller.requestAi(true), /Preview/);
  await h.controller.previewAi();
  await assert.rejects(h.controller.requestAi(false), /explicitly approve/);
  await assert.rejects(h.controller.requestAi(true), /terminal/);
  assert.equal(h.messages.filter(message => message.method === "POST").length, 0);
  h.controller.state.status.ai.keyPresent = true;
  await h.controller.requestAi(true);
  const aiCall = h.messages.find(message => message.path?.endsWith("/ai"));
  assert.deepEqual(aiCall.body, { enabled: true, approvedPayloadHash: "approved-hash" });
  assert.doesNotMatch(JSON.stringify(aiCall), /apiKey|OPENAI_API_KEY/);
});

test("recovery addresses the existing operation and never invents a replacement ID", async () => {
  const h = controllerHarness(() => ({ operationId: "existing", status: "partial" }));
  const result = await h.controller.retryOperation("existing");
  assert.equal(result.status, "partial");
  assert.deepEqual(h.messages[0], { type: "request", method: "POST", path: "/v1/operations/existing/retry", body: { approved: true } });
});

test("rendering uses text nodes and includes no key field or remote scripts", async () => {
  const app = await readFile("extension/app.mjs", "utf8");
  const html = await readFile("extension/app.html", "utf8");
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.doesNotMatch(html, /<script[^>]+https?:|id="[^"]*(?:api-key|openai-key)"/);
  assert.match(app, /textContent/);
});

test("extension bridge and controller complete the real local HTTP fixture flow together", async () => {
  const tempRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(tempRoot, "tidepath-extension-http-"));
  let providerCalls = 0;
  const ai = new LocalByok(undefined, async () => { providerCalls++; throw new Error("Provider requests prohibited in extension fixtures."); });
  const { server } = await createLocalService({ extensionId, token, statePath: join(directory, "journal.json"), demo: true, ai });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const endpoint = `http://127.0.0.1:${address.port}`;
  const h = harness({ fetchImpl: (async (url, init) => {
    assert.ok(String(url).startsWith(COMPANION_ORIGIN));
    return fetch(String(url).replace(COMPANION_ORIGIN, endpoint), { ...init, headers: { ...init?.headers, Origin: `chrome-extension://${extensionId}` } });
  }) as typeof fetch });
  const controller = createController((message: any) => h.bridge.handle(message, sender), () => "extension-fixture-request") as any;
  try {
    await controller.pair(token);
    assert.equal(controller.state.status.demo, true);
    await controller.discover();
    assert.equal(controller.state.workbooks.length, 2);
    controller.state.selected = new Set(controller.state.workbooks.map((book: any) => book.id));
    const first = await controller.scan({ broadScan: true, confirmNonSensitive: true });
    const tabs = first.mappings.map((mapping: any) => ({ workbookId: mapping.workbookId, sheetId: mapping.sheetId, mapping: mapping.mapping, requiredFields: mapping.requiredFields, amountUnit: mapping.amountUnit, currency: mapping.currency }));
    const scanned = await controller.scan({ broadScan: true, confirmNonSensitive: true, tabs });
    assert.ok(scanned.mappings.every((mapping: any) => mapping.confirmed));
    const selected = scanned.findings.filter((finding: any) => finding.type === "normalization" && finding.proposedFix).map((finding: any) => finding.id);
    assert.ok(selected.length);
    const plan = await controller.plan(selected);
    assert.deepEqual(plan.totals, scanned.totals);
    const applied = await controller.apply(true);
    assert.equal(applied.status, "complete");
    assert.ok(applied.entries.every((entry: any) => entry.status === "verified"));
    assert.deepEqual(await controller.retryPending(), applied);
    await controller.history();
    assert.equal(controller.state.operations.length, 1);
    await controller.previewAi();
    await assert.rejects(controller.requestAi(true), /terminal/);
    assert.equal(providerCalls, 0);
    assert.deepEqual(h.values.pendingJobs, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.ok(resolve(directory).startsWith(join(tempRoot, "tidepath-extension-http-")));
    await rm(directory, { recursive: true, force: true });
  }
});
