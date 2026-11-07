import assert from "node:assert/strict";
import test from "node:test";
import { handlePublicCommand, type PublicCommandDependencies } from "../src/lib/public/command";
import { json, publicError, readJson, requireSameOrigin } from "../src/lib/public/http";
import { AppError } from "../src/lib/service";
import { prepareDraft } from "../src/lib/agent";
import type { GoogleIdentity } from "../src/lib/public/auth";
import type { WorkspaceCheckpoint } from "../src/lib/public/storage";
import type { SheetsMapping, SheetsSelection, SheetsWorkspace } from "../src/lib/sheets-types";

const workbookId = "public-route-workbook";
const mapping: SheetsMapping = { gift_id: 0, donor_id: null, name: 1, email: 2, phone: null, amount: 3, date: 4, channel: null };
const period = { start: "2026-01-01", end: "2026-12-31" };
function selected(): SheetsSelection {
  const values = [["ID", "Name", "Email", "Amount", "Date"], ["g1", "Private Name", "private@example.test", "20.12", "2026-02-01"]];
  return { workbookId, sheetId: 4, sheetName: "Actual source", a1: "A1:E2", startRow: 1, startColumn: 1, values, formulas: values.map(row => row.map(() => "")) };
}
const keyFor = (identity: GoogleIdentity, workbook: string) => `${identity.sub}|${workbook}`;
function harness() {
  const saved = new Map<string, { state: SheetsWorkspace; lease: symbol }>();
  const usage: { sub: string; kind: string }[] = [];
  let source = selected(); let reads = 0; let writes = 0; let modelCalls = 0; let deny = false;
  let beforeWrite: (() => Promise<void>) | undefined;
  const store = {
    async consumeUsage(identity: GoogleIdentity, kind: "command" | "generation") { usage.push({ sub: identity.sub, kind }); },
    async deleteWorkbook(identity: GoogleIdentity, workbook: string) { saved.delete(keyFor(identity, workbook)); },
    async withWorkspace<T>(identity: GoogleIdentity, workbook: string, create: () => SheetsWorkspace, operation: (workspace: SheetsWorkspace, checkpoint: WorkspaceCheckpoint) => Promise<T>): Promise<T> {
      const key = keyFor(identity, workbook);
      const entry = { state: structuredClone(saved.get(key)?.state ?? create()), lease: Symbol() };
      saved.set(key, entry);
      const workspace = structuredClone(entry.state);
      const checkpoint: WorkspaceCheckpoint = async current => {
        if (saved.get(key)?.lease !== entry.lease) throw new AppError("This workspace was deleted or replaced.", 409);
        entry.state = structuredClone(current);
      };
      const result = await operation(workspace, checkpoint);
      await checkpoint(workspace);
      return result;
    },
  };
  const dependencies: PublicCommandDependencies = {
    authenticate: async headers => {
      const sub = headers.get("authorization")?.replace(/^Bearer /u, "");
      if (!sub) throw new AppError("Sign in.", 401);
      return { sub, email: `${sub}@example.test` };
    }, store,
    gateway: () => ({
      async assertWorkbookAccess(workbook) { if (deny || workbook !== workbookId) throw new AppError("No workbook access.", 403); },
      async readSelection(location) { reads++; assert.equal(location.workbookId, workbookId); return structuredClone(source); },
      async writeApprovedReport(_identity, _source, exported, fence) {
        await beforeWrite?.(); await fence?.(); writes++;
        assert(exported.rows.some(row => row[1] === "$20.12"));
        return { sheetName: "Verified report", url: "https://docs.google.com/spreadsheets/d/test/edit#gid=9", replayed: writes > 1 };
      },
    }),
    sheets: { prepareDraft: (state, request) => prepareDraft(state, request, { runModel: async call => {
      modelCalls++;
      const entry = saved.get(`user-a|${workbookId}`)!;
      assert(entry.state.generationRequests.some(item => item.status === "running"), "reservation is durable before AI");
      const evidence = call.readEvidence!();
      assert(!JSON.stringify(evidence).includes("private@example.test"));
      assert(!JSON.stringify(evidence).includes("Private Name"));
      return { output: { narrative: "The reviewed records summarize giving for the reporting period.", claims: evidence.metrics.map(metric => ({ metricId: metric.id, value: metric.value })) }, usage: { inputTokens: 1, outputTokens: 1, known: true } };
    } }) },
  };
  const request = (input: Record<string, unknown>, user = "user-a", headers: Record<string, string> = {}) => new Request("https://tidepath.example/api/public/command", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${user}`, "x-tidepath-google-access-token": "access", ...headers }, body: JSON.stringify({ workbookId, ...input }),
  });
  const command = async (input: Record<string, unknown>, user?: string) => { const response = await handlePublicCommand(request(input, user), dependencies); return { status: response.status, body: await response.json() }; };
  const importRows = async () => {
    const input = { selection: source, mapping, period, currency: "USD", amountUnit: "dollars" };
    const preview = await command({ action: "preview", ...input }); assert.equal(preview.status, 200);
    const imported = await command({ action: "import", ...input, previewHash: preview.body.preview.previewHash }); assert.equal(imported.status, 200);
  };
  return { dependencies, request, command, importRows, saved, usage, store,
    get source() { return source; }, set source(value: SheetsSelection) { source = value; },
    get reads() { return reads; }, get writes() { return writes; }, get modelCalls() { return modelCalls; },
    set deny(value: boolean) { deny = value; }, set beforeWrite(value: () => Promise<void>) { beforeWrite = value; } };
}

test("public command rejects browser origins and cookies alone before reading account records", async () => {
  const h = harness();
  const origin = await handlePublicCommand(h.request({ action: "status" }, "user-a", { origin: "https://tidepath.example" }), h.dependencies);
  assert.equal(origin.status, 403); assert.equal(h.saved.size, 0); assert.equal(h.usage.length, 0);
  const cookieOnly = new Request("https://tidepath.example/api/public/command", { method: "POST", headers: { cookie: "__Host-tidepath-session=" + "a".repeat(43), "content-type": "application/json" }, body: JSON.stringify({ workbookId, action: "status" }) });
  const rejected = await handlePublicCommand(cookieOnly, { ...h.dependencies, authenticate: undefined });
  assert.equal(rejected.status, 401); assert.equal(h.saved.size, 0);
});

test("every command requires current Google workbook access, and server reads defeat spoofed cells", async () => {
  const h = harness(); h.deny = true;
  assert.equal((await h.command({ action: "status" })).status, 403);
  assert.equal(h.saved.size, 0); h.deny = false;
  const forged = structuredClone(h.source); forged.values[1][3] = "999999"; forged.sheetName = "Forged";
  const response = await h.command({ action: "preview", selection: forged, mapping, period, currency: "USD", amountUnit: "dollars" });
  assert.equal(response.status, 200);
  assert.equal(response.body.preview.metrics.find((metric: { id: string }) => metric.id === "giving").value, 20.12);
  assert.equal(h.reads, 1);
  assert.equal((await h.command({ action: "status", organizationId: "another-tenant" })).status, 400);
  assert.equal((await h.command({ action: "status", aiConsent: "yes" })).status, 400);
  assert.equal((await h.command({ action: "delete", confirmation: "DELETE", identity: { sub: "other" } })).status, 400);
});

test("same workbook ID isolates records by verified subject and deletion cannot choose another identity", async () => {
  const h = harness(); await h.importRows();
  assert.equal((await h.command({ action: "status" }, "user-a")).body.dashboard.giftCount, 1);
  assert.equal((await h.command({ action: "status" }, "user-b")).body.dashboard.giftCount, 0);
  assert.equal((await h.command({ action: "delete", confirmation: "DELETE" }, "user-b")).status, 200);
  assert.equal((await h.command({ action: "status" }, "user-a")).body.dashboard.giftCount, 1);
});

test("live consent and generation validation precede billing, while completed retries reuse one reservation", async () => {
  const h = harness(); await h.importRows();
  const input = { action: "generate", selection: h.source, mode: "live", requestId: "live-1", aiConsent: true };
  assert.equal((await h.command({ ...input, aiConsent: false })).status, 400);
  assert.equal((await h.command({ ...input, aiConsent: "true" })).status, 400);
  assert.equal((await h.command({ ...input, requestId: "invalid key!" })).status, 400);
  assert.equal(h.usage.filter(item => item.kind === "generation").length, 0);
  const first = await h.command(input); assert.equal(first.status, 200);
  const retry = await h.command(input); assert.equal(retry.status, 200); assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.draft.id, first.body.draft.id);
  assert.equal(h.modelCalls, 1); assert.equal(h.usage.filter(item => item.kind === "generation").length, 1);
  h.source.values[1][3] = "21.12";
  assert.equal((await h.command({ ...input, requestId: "stale-source" })).status, 409);
  assert.equal(h.modelCalls, 1); assert.equal(h.usage.filter(item => item.kind === "generation").length, 1);
});

test("deleted workspaces are fenced immediately before external export mutation", async () => {
  const h = harness(); await h.importRows();
  const generated = await h.command({ action: "generate", selection: h.source, mode: "demo", requestId: "local-1" });
  assert.equal(generated.status, 200);
  const draft = generated.body.draft;
  const action = { selection: h.source, draftId: draft.id, revision: draft.revision };
  assert.equal((await h.command({ action: "approve", ...action })).status, 200);
  h.beforeWrite = async () => h.store.deleteWorkbook({ sub: "user-a", email: "user-a@example.test" }, workbookId);
  const result = await h.command({ action: "write", ...action });
  assert.equal(result.status, 409); assert.equal(h.writes, 0); assert.equal(h.saved.size, 0);
});

test("failed live attempts retain their reservation and same-key retries cannot spend again", async () => {
  const h = harness(); await h.importRows();
  h.dependencies.sheets = { prepareDraft: async () => { throw new Error("private provider exception"); } };
  const input = { action: "generate", selection: h.source, mode: "live", requestId: "failed-live", aiConsent: true };
  const first = await h.command(input); assert.equal(first.status, 502);
  assert(!JSON.stringify(first.body).includes("private provider exception"));
  const retry = await h.command(input); assert.equal(retry.status, 409);
  assert.equal(h.usage.filter(item => item.kind === "generation").length, 1);
  assert.equal(h.saved.get(`user-a|${workbookId}`)!.state.generationRequests[0].status, "failed");
});

test("a running report cannot resurrect a concurrently deleted workspace or return unsaved output", async () => {
  const h = harness(); await h.importRows();
  const prepare = h.dependencies.sheets!.prepareDraft!;
  h.dependencies.sheets = { prepareDraft: async (state, request) => {
    const prepared = await prepare(state, request);
    await h.store.deleteWorkbook({ sub: "user-a", email: "user-a@example.test" }, workbookId);
    return prepared;
  } };
  const result = await h.command({ action: "generate", selection: h.source, mode: "live", requestId: "deleted-live", aiConsent: true });
  assert.equal(result.status, 503); assert.equal(result.body.draft, undefined);
  assert.equal(h.saved.size, 0); assert.equal(h.modelCalls, 1);
  assert.equal(h.usage.filter(item => item.kind === "generation").length, 1);
});

test("public workspace history is bounded while the daily AI budget remains in persistent storage", async () => {
  const h = harness(); await h.importRows();
  const entry = h.saved.get(`user-a|${workbookId}`)!;
  entry.state.generationRequests = Array.from({ length: 12 }, (_, index) => ({ requestId: `old-${index}`, mode: "live" as const, fingerprint: "old", status: "failed" as const, startedAt: "2026-01-01T00:00:00.000Z" }));
  const generated = await h.command({ action: "generate", selection: h.source, mode: "live", requestId: "new-day", aiConsent: true });
  assert.equal(generated.status, 200); assert.equal(h.modelCalls, 1);
  const current = h.saved.get(`user-a|${workbookId}`)!;
  current.state.generationRequests.push(...Array.from({ length: 37 }, (_, index) => ({ requestId: `history-${index}`, mode: "demo" as const, fingerprint: "old", status: "failed" as const, startedAt: "2026-01-01T00:00:00.000Z" })));
  assert.equal(current.state.generationRequests.length, 50);
  const bounded = await h.command({ action: "generate", selection: h.source, mode: "demo", requestId: "over-cap" });
  assert.equal(bounded.status, 429); assert.equal(h.modelCalls, 1);
  const replay = await h.command({ action: "generate", selection: h.source, mode: "live", requestId: "new-day", aiConsent: true });
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
});

test("public HTTP errors conceal provider secrets and enforce JSON size/content-type and CSRF", async () => {
  const sanitized = await publicError(new Error("secret access_token and private@example.test")).text();
  assert(!sanitized.includes("access_token")); assert(!sanitized.includes("private@example.test"));
  assert.equal(json({ ok: true }).headers.get("cache-control"), "no-store");
  await assert.rejects(readJson(new Request("https://example.test", { method: "POST", headers: { "content-type": "application/jsonp" }, body: "{}" })), (error: unknown) => error instanceof AppError && error.status === 415);
  await assert.rejects(readJson(new Request("https://example.test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: "x".repeat(100) }) }), 20), (error: unknown) => error instanceof AppError && error.status === 413);
  const prior = process.env.TIDEPATH_PUBLIC_ORIGIN; process.env.TIDEPATH_PUBLIC_ORIGIN = "https://tidepath.example";
  try {
    assert.throws(() => requireSameOrigin(new Request("https://tidepath.example", { headers: { origin: "https://attacker.example" } })), AppError);
    assert.throws(() => requireSameOrigin(new Request("https://tidepath.example")), AppError);
    requireSameOrigin(new Request("https://tidepath.example", { headers: { origin: "https://tidepath.example" } }));
  } finally { if (prior === undefined) delete process.env.TIDEPATH_PUBLIC_ORIGIN; else process.env.TIDEPATH_PUBLIC_ORIGIN = prior; }
});
