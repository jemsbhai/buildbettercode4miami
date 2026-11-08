import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request as rawRequest } from "node:http";
import { createLocalService, type LocalServiceOptions } from "../src/lib/reconcile-local";
import { LocalByok } from "../src/lib/reconcile-ai";
import { demoWorkbooks } from "../src/lib/reconcile-demo";
import type { ScanReport, WorkbookSnapshot } from "../src/lib/reconcile-types";

const extensionId = "abcdefghijklmnopabcdefghijklmnop", token = "local-test-pairing-token-123456789012345678";
async function fixture(overrides: Partial<LocalServiceOptions> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "tidepath-local-test-")), statePath = join(dir, "journal.json");
  const ai = new LocalByok(undefined, async () => { throw new Error("No provider transport may run in demo tests."); });
  const { server, shutdown } = await createLocalService({ extensionId, token, statePath, demo: true, ai, ...overrides });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  async function request(path: string, body?: unknown, method = body === undefined ? "GET" : "POST", overrides: Record<string, string> = {}) {
    const response = await fetch(url + path, { method, headers: { Authorization: `Bearer ${token}`, "X-Tidepath-Extension-Id": extensionId, Origin: `chrome-extension://${extensionId}`, "Content-Type": "application/json", ...overrides }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
  }
  const wrongHost = () => new Promise<number>(resolve => { const req = rawRequest(url + "/v1/status", { headers: { Host: "attacker.example", Authorization: `Bearer ${token}`, "X-Tidepath-Extension-Id": extensionId } }, res => { res.resume(); res.on("end", () => resolve(res.statusCode!)); }); req.end(); });
  return { request, wrongHost, statePath, ai, server, shutdown, url, cleanup: async () => { await shutdown(); await rm(dir, { recursive: true, force: true }); } };
}
test("local HTTP boundary enforces pairing, extension ID, origin and Host", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/v1/status")).status, 200);
    assert.equal((await f.request("/v1/status", undefined, "GET", { Authorization: "Bearer wrong" })).status, 401);
    assert.equal((await f.request("/v1/status", undefined, "GET", { "X-Tidepath-Extension-Id": "wrong" })).status, 401);
    assert.equal((await f.request("/v1/status", undefined, "GET", { Origin: "https://attacker.example" })).status, 403);
    assert.equal(await f.wrongHost(), 403);
    const preflight = await f.request("/v1/scans", undefined, "OPTIONS");
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("access-control-allow-origin"), `chrome-extension://${extensionId}`);
    assert.equal((await f.request("/v1/missing")).status, 404);
  } finally { await f.cleanup(); }
});
test("HTTP full multi-workbook flow requires scope, mapping review, approval; copies are retry-safe and private content absent", async () => {
  const f = await fixture();
  try {
    const files = (await f.request("/v1/workbooks")).body.files;
    const body = { workbookIds: files.map((file: { id: string }) => file.id), broadScan: false, confirmNonSensitive: true };
    assert.equal((await f.request("/v1/scans", body)).status, 400);
    body.broadScan = true;
    const initial = (await f.request("/v1/scans", body)).body as ScanReport;
    assert.equal(initial.scope.workbookIds.length, 2); assert.ok(initial.excluded.length);
    const options = { tabs: initial.mappings.map(({ workbookId, sheetId, mapping, requiredFields, amountUnit, currency }) => ({ workbookId, sheetId, mapping, requiredFields, amountUnit, currency })) };
    const scanResponse = await f.request("/v1/scans", { ...body, options });
    assert.equal(scanResponse.status, 200);
    const scan = scanResponse.body as ScanReport;
    const fixes = scan.findings.filter(finding => finding.proposedFix && finding.type === "normalization"); assert.ok(fixes.length);
    const planResponse = await f.request(`/v1/scans/${scan.id}/plan`, { findingIds: fixes.map(finding => finding.id) });
    assert.equal(planResponse.status, 200, JSON.stringify(planResponse.body));
    const plan = planResponse.body;
    assert.equal((await f.request(`/v1/plans/${plan.id}/apply`, { requestId: "test-request-0001", approved: false })).status, 400);
    const result = await f.request(`/v1/plans/${plan.id}/apply`, { requestId: "test-request-0001", approved: true });
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.status, "complete");
    assert.ok(result.body.entries.every((entry: { status: string }) => entry.status === "verified"));
    const replay = await f.request(`/v1/plans/${plan.id}/apply`, { requestId: "test-request-0001", approved: true });
    assert.deepEqual(replay.body, result.body);
    const freshId = await f.request(`/v1/plans/${plan.id}/apply`, { requestId: "test-request-0002", approved: true });
    assert.equal(freshId.body.id, result.body.id);
    const history = await f.request("/v1/history"); assert.equal(history.body.operations.length, 1);
    const persisted = await readFile(f.statePath, "utf8"); assert.doesNotMatch(persisted, /PRIVATE_FIXTURE_SENTINEL|local-test-pairing|sk-/);
    assert.deepEqual(plan.totals, scan.totals);
  } finally { await f.cleanup(); }
});
test("demo AI cannot call provider even with local key and explicit consent; key deletion works", async () => {
  const f = await fixture();
  try {
    f.ai.setKey("sk-test-user-key-123456789");
    const scan = (await f.request("/v1/scans", { workbookIds: ["demo-community"], broadScan: false, confirmNonSensitive: true })).body;
    const preview = (await f.request(`/v1/scans/${scan.id}/ai-preview`)).body;
    const result = await f.request(`/v1/scans/${scan.id}/ai`, { enabled: true, approvedPayloadHash: preview.payloadHash });
    assert.equal(result.status, 400); assert.equal(f.ai.runs.length, 0);
    await f.request("/v1/ai/key", undefined, "DELETE"); assert.equal(f.ai.status().keyPresent, false);
  } finally { await f.cleanup(); }
});

test("Google journals isolate accounts and do not disclose saved scans when disconnected", async () => {
  const f = await fixture({ demo: false, googleFactory: accessToken => ({
    getAccountIdentity: async () => accessToken === "test-token-account-a" ? "account-a-hash" : "account-b-hash",
    discoverWorkbooks: async () => ({ workbooks: [{ id: "demo-community", name: "Mock" }], complete: true }),
    readWorkbooks: async () => [demoWorkbooks()[0]], getVersion: async () => "1",
    createWorkbook: async () => { throw new Error("No writes in account test"); }, writeWorkbook: async () => { throw new Error("No writes in account test"); }, readCreatedWorkbook: async () => { throw new Error("No writes in account test"); },
  }) });
  try {
    assert.equal((await f.request("/v1/history")).status, 401);
    assert.equal((await f.request("/v1/google", { accessToken: "test-token-account-a" })).status, 200);
    const scanned = await f.request("/v1/scans", { workbookIds: ["demo-community"], broadScan: false, confirmNonSensitive: true });
    assert.equal(scanned.status, 200);
    await f.request("/v1/google", undefined, "DELETE");
    assert.equal((await f.request(`/v1/scans/${scanned.body.id}`)).status, 401);
    assert.equal((await f.request("/v1/history")).status, 401);
    const other = await f.request("/v1/google", { accessToken: "test-token-account-b" });
    assert.equal(other.status, 409);
    assert.equal((await f.request("/v1/status")).body.googleConnected, false);
    await f.request("/v1/google", { accessToken: "test-token-account-a" });
    assert.equal((await f.request("/v1/history")).body.scans.length, 1);
    const persisted = await readFile(f.statePath, "utf8"); assert.doesNotMatch(persisted, /test-token-account|PRIVATE_FIXTURE/); assert.match(persisted, /account-a-hash/);
  } finally { await f.cleanup(); }
});

test("Google connection accepts RFC6750 trailing token padding and preserves length/header-injection guards", async () => {
  const accepted: string[] = [];
  const f = await fixture({ demo: false, googleFactory: accessToken => {
    accepted.push(accessToken);
    return {
      getAccountIdentity: async () => "padded-token-fixture-account",
      discoverWorkbooks: async () => ({ workbooks: [], complete: true }),
      readWorkbooks: async () => [], getVersion: async () => "1",
      createWorkbook: async () => { throw new Error("No writes in token-format test"); },
      writeWorkbook: async () => { throw new Error("No writes in token-format test"); },
      readCreatedWorkbook: async () => { throw new Error("No writes in token-format test"); },
    };
  } });
  try {
    const valid = ["test-token-123456789=", "test-token-123456789==", "t".repeat(4095) + "="];
    for (const accessToken of valid) assert.equal((await f.request("/v1/google", { accessToken })).status, 200);
    assert.deepEqual(accepted, valid);
    for (const accessToken of ["test-token\r\nInjected: header", "test-token\n", "test=token-padding", "test-token with-space", "=".repeat(20), "t".repeat(9), "t".repeat(4097)]) {
      assert.equal((await f.request("/v1/google", { accessToken })).status, 400);
    }
    assert.deepEqual(accepted, valid, "Invalid tokens must be rejected before constructing Google clients");
    const persisted = await readFile(f.statePath, "utf8");
    for (const accessToken of valid) assert.ok(!persisted.includes(accessToken));
  } finally { await f.cleanup(); }
});

test("async operations return immediately, expose authenticated progress and retain the final result", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const f = await fixture({ demo: false, googleFactory: () => ({
    getAccountIdentity: async () => "account-a", discoverWorkbooks: async () => ({ workbooks: [], complete: true }),
    readWorkbooks: async () => { reads++; await gate; return [demoWorkbooks()[0]]; }, getVersion: async () => "1",
    createWorkbook: async () => { throw new Error("No writes"); }, writeWorkbook: async () => {}, readCreatedWorkbook: async () => { throw new Error("No writes"); },
  }) });
  try {
    await f.request("/v1/google", { accessToken: "test-token-account-a" });
    const accepted = await f.request("/v1/scans", { workbookIds: ["demo-community"], broadScan: false, confirmNonSensitive: true }, "POST", { Prefer: "respond-async" });
    assert.equal(accepted.status, 202);
    const path = `/v1/jobs/${accepted.body.jobId}`;
    const concurrentStatus = await Promise.race([f.request("/v1/status"), new Promise<never>((_, reject) => { const timeout = setTimeout(() => reject(new Error("Status blocked behind a background scan")), 2000); timeout.unref(); })]);
    assert.equal(concurrentStatus.body.googleConnected, true);
    assert.equal((await f.request("/v1/history")).body.scans.length, 0);
    assert.equal((await f.request(path)).body.status, "running");
    assert.equal((await f.request(path, undefined, "GET", { Authorization: "wrong" })).status, 401);
    release();
    let result;
    for (let i = 0; i < 20; i++) { result = await f.request(path); if (result.body.status !== "running") break; }
    assert.equal(result?.body.status, "completed"); assert.equal(result?.body.result.scope.workbookIds.length, 1); assert.equal(reads, 1);
    assert.equal((await f.request("/v1/history")).body.scans.length, 1);
    const failure = await f.request("/v1/scans", { invalid: true }, "POST", { Prefer: "respond-async" });
    const failed = await f.request(`/v1/jobs/${failure.body.jobId}`);
    assert.equal(failed.body.status, "failed"); assert.equal(failed.body.httpStatus, 400);
  } finally { release(); await f.cleanup(); }
});

test("shutdown drains accepted background copy and queued Google work before clearing credentials", async () => {
  let releaseWrite!: () => void, writeStarted!: () => void;
  const writeGate = new Promise<void>(resolve => { releaseWrite = resolve; });
  const writing = new Promise<void>(resolve => { writeStarted = resolve; });
  const source: WorkbookSnapshot = { id: "source-gifts", name: "Public gifts", version: "1", tabs: [{ id: 0, title: "Gifts", rows: [
    ["Gift ID", "Donor ID", "Name", "Amount", "Date"].map(value => ({ value })),
    ["g-1", "d-1", " Rosa ", "10.0", "2026-09-01"].map(value => ({ value })),
  ] }] };
  let written: WorkbookSnapshot | undefined, creates = 0, reads = 0;
  const f = await fixture({ demo: false, googleFactory: () => ({
    getAccountIdentity: async () => "shutdown-fixture-account",
    discoverWorkbooks: async () => ({ workbooks: [], complete: true }),
    readWorkbooks: async () => { reads++; return [structuredClone(source)]; },
    getVersion: async () => "1",
    createWorkbook: async () => { creates++; return "copy-shutdown-test"; },
    writeWorkbook: async (_id, snapshot) => { writeStarted(); await writeGate; written = structuredClone(snapshot); },
    readCreatedWorkbook: async () => { assert.ok(written); return { ...structuredClone(written), id: "copy-shutdown-test" }; },
  }) });
  try {
    f.ai.setKey("sk-shutdown-fixture-no-provider-call");
    await f.request("/v1/google", { accessToken: "shutdown-fixture-token" });
    const scanBody = { workbookIds: [source.id], broadScan: false, confirmNonSensitive: true };
    const initial = (await f.request("/v1/scans", scanBody)).body as ScanReport;
    const options = { tabs: initial.mappings.map(({ workbookId, sheetId, mapping, requiredFields, amountUnit, currency }) => ({ workbookId, sheetId, mapping, requiredFields, amountUnit, currency })) };
    const reviewed = (await f.request("/v1/scans", { ...scanBody, options })).body as ScanReport;
    const plan = (await f.request(`/v1/scans/${reviewed.id}/plan`, { findingIds: reviewed.findings.filter(item => item.proposedFix).map(item => item.id) })).body;
    const accepted = await f.request(`/v1/plans/${plan.id}/apply`, { approved: true, requestId: "shutdown-copy-request" }, "POST", { Prefer: "respond-async" });
    assert.equal(accepted.status, 202); await writing;
    const queued = await f.request("/v1/scans", { ...scanBody, options }, "POST", { Prefer: "respond-async" });
    assert.equal(queued.status, 202);
    let settled = false;
    const stopping = f.shutdown(); void stopping.then(() => { settled = true; });
    assert.equal(f.shutdown(), stopping, "Repeated shutdown must share the same completion promise");
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(settled, false); assert.equal(f.ai.status().keyPresent, true, "Credentials must remain available during accepted work");
    assert.equal(reads, 2, "Queued Google work should still wait behind the copy");
    const during = JSON.parse(await readFile(f.statePath, "utf8"));
    assert.equal(during.operations[0].journal.entries[0].status, "writing");
    await assert.rejects(f.request("/v1/status"), "Listener must stop accepting new connections");
    releaseWrite(); await stopping;
    const final = JSON.parse(await readFile(f.statePath, "utf8"));
    assert.equal(final.operations.length, 1); assert.equal(final.operations[0].journal.status, "complete");
    assert.equal(final.operations[0].journal.entries[0].copyId, "copy-shutdown-test");
    assert.equal(final.operations[0].journal.entries[0].status, "verified");
    assert.ok(final.operations[0].journal.entries[0].verifiedAt);
    assert.equal(creates, 1); assert.equal(reads, 3, "Queued Google work must retain its connection and finish before shutdown");
    assert.equal(f.ai.status().keyPresent, false); assert.equal(f.ai.status().attempts, 0);
  } finally { releaseWrite(); await f.cleanup(); }
});

test("shutdown waits for an admitted partial request body before taking the final work queue", async () => {
  const f = await fixture();
  let pendingRequest: ReturnType<typeof rawRequest> | undefined;
  try {
    const body = JSON.stringify({ workbookIds: ["demo-community"], broadScan: false, confirmNonSensitive: true });
    const admitted = new Promise<void>(resolve => f.server.once("request", () => resolve()));
    const received = new Promise<number>((resolve, reject) => {
      pendingRequest = rawRequest(f.url + "/v1/scans", { method: "POST", headers: { Authorization: `Bearer ${token}`, "X-Tidepath-Extension-Id": extensionId, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Prefer: "respond-async" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode!)); });
      pendingRequest.on("error", reject); pendingRequest.write(body.slice(0, 15));
    });
    await admitted;
    const stopping = f.shutdown(); let settled = false; void stopping.then(() => { settled = true; });
    await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(settled, false);
    pendingRequest!.end(body.slice(15));
    assert.equal(await received, 202); await stopping;
    const final = JSON.parse(await readFile(f.statePath, "utf8"));
    assert.equal(final.scans.length, 1); assert.equal(final.scans[0].report.scope.workbookIds[0], "demo-community");
    assert.equal(f.ai.status().attempts, 0);
  } finally { pendingRequest?.destroy(); await f.cleanup(); }
});

test("shutdown supports never-listened and directly-closed servers and reports fatal close failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tidepath-shutdown-test-"));
  try {
    const unused = await createLocalService({ extensionId, token, statePath: join(dir, "unused.json"), demo: true });
    const first = unused.shutdown(); assert.equal(unused.shutdown(), first); await first;
    const closed = await createLocalService({ extensionId, token, statePath: join(dir, "closed.json"), demo: true });
    await new Promise<void>(resolve => closed.server.listen(0, "127.0.0.1", resolve));
    await new Promise<void>((resolve, reject) => closed.server.close(error => error ? reject(error) : resolve()));
    await closed.shutdown();
    const failed = await createLocalService({ extensionId, token, statePath: join(dir, "failed.json"), demo: true });
    failed.ai.setKey("sk-shutdown-failure-no-provider-call");
    const originalClose = failed.server.close;
    failed.server.close = (() => { throw new Error("fixture fatal close failure"); }) as typeof failed.server.close;
    const rejection = failed.shutdown(); assert.equal(failed.shutdown(), rejection);
    await assert.rejects(rejection, /fixture fatal close failure/);
    assert.equal(failed.ai.status().keyPresent, true, "A failed shutdown must not signal completed cleanup");
    failed.server.close = originalClose; failed.ai.removeKey();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
