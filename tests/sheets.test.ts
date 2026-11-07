import assert from "node:assert/strict";
import test from "node:test";
import { DraftGenerationError, prepareDraft } from "../src/lib/agent";
import { recordAttendance } from "../src/lib/domain";
import { digest } from "../src/lib/evidence";
import { AppError } from "../src/lib/service";
import { createSheetsWorkspace, executeSheetsCommand, sheetsDashboard } from "../src/lib/sheets";
import type { SheetsMapping, SheetsSelection, SheetsWorkspace } from "../src/lib/sheets-types";

const mapping: SheetsMapping = { gift_id: 0, donor_id: 1, name: 2, email: 3, phone: 4, amount: 5, date: 6, channel: 7 };
function selection(): SheetsSelection {
  const values = [
    ["Gift ID", "Donor ID", "Supporter", "Email", "Phone", "Gift USD", "Date", "Channel"],
    ["gift-a", "rosa-a", "Rosa Delgado", "rosa@example.test", "+1-305-555-0101", 125, "2026-07-10", "online"],
    ["gift-b", "rosa-b", "Rosa M. Delgado", "rosa@example.test", "+1-305-555-0102", 80, "2026-07-11", "tickets"],
    ["gift-c", "rosa-c", "R. Delgado", "rosa.work@example.test", "+1-305-555-0102", 200, "2026-08-10", "auction"],
    ["gift-d", "rosa-other", "Rosa Delgado", "another.rosa@example.test", "+1-305-555-0199", 50, "2026-08-11", "check"],
    ["gift-e", "jules", "Jules Pierre", "jules@example.test", "+1-305-555-0112", 180, "2026-09-12", "online"],
  ];
  return { workbookId: "workbook_demo", sheetId: 123, sheetName: "Donations", a1: "B4:I9", startRow: 4, startColumn: 2, values, formulas: values.map(row => row.map(() => "")) };
}
const status = (code: number, match?: RegExp) => (error: unknown) => error instanceof AppError && error.status === code && (!match || match.test(error.message));
const metric = (workspace: SheetsWorkspace, id: string) => sheetsDashboard(workspace).metrics.find(item => item.id === id)!.value;

async function imported(source = selection()) {
  const workspace = createSheetsWorkspace(source.workbookId);
  const preview = await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" });
  const result = await executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", previewHash: preview.preview!.previewHash });
  return { workspace, source, result };
}

async function report(workspace: SheetsWorkspace, source: SheetsSelection, requestId = "report-1") {
  return (await executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "demo", requestId })).draft!;
}

test("workbook fixtures isolate donations and omit counseling bodies while clearly labeling program seed", async () => {
  const workspace = createSheetsWorkspace("workbook_demo");
  assert.equal(workspace.state.donors.length, 0);
  assert.equal(workspace.state.gifts.length, 0);
  assert.equal(workspace.state.notes.length, 0);
  const { dashboard } = await executeSheetsCommand(workspace, { action: "status" });
  assert.equal(dashboard.programData, "fictional_demo");
  assert.equal(dashboard.giftCount, 0);
  assert.deepEqual(dashboard.metrics.map(item => item.value), [4, 0, 0, 50, 65]);
  assert(!JSON.stringify(dashboard).includes("PRIVATE_SENTINEL"));
  assert(!JSON.stringify(dashboard).includes('"notes"'));
  assert(!JSON.stringify(dashboard).includes('"state"'));
});

test("mapping preview validates the real import and predicts duplicates without mutating a workbook", async () => {
  const workspace = createSheetsWorkspace("workbook_demo");
  const before = structuredClone(workspace);
  const source = selection();
  const result = await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" });
  assert.deepEqual(workspace, before);
  assert.equal(result.preview!.inserted, 5);
  assert.equal(result.preview!.rows[0].amount_cents, 12500);
  assert.equal(result.preview!.snapshotHash, digest(source));
  assert.equal(result.preview!.candidates.length, 1);
  assert.equal(result.preview!.candidates[0].donorIds.length, 3);
  assert.equal(result.preview!.metrics.find(item => item.id === "giving")!.value, 635);
});

test("import captures actual spreadsheet cells and exact retries preserve totals, revision and audit", async () => {
  const { workspace, source, result } = await imported();
  assert.deepEqual(result.importResult, { inserted: 5, skipped: 0 });
  const first = workspace.state.sources.find(item => item.id === "src-import-gift-a")!;
  assert.equal(first.row, 5);
  assert.equal(first.values.spreadsheet_id, source.workbookId);
  assert.equal(first.values.source_range, "B5:I5");
  assert.equal(JSON.parse(String(first.values.source_cells)).amount, "G5");
  assert.equal(first.values.selection_hash, digest(source));
  assert.equal(metric(workspace, "giving"), 635);
  const before = structuredClone(workspace);
  const retried = await executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", previewHash: workspace.selection!.previewHash });
  assert.deepEqual(retried.importResult, { inserted: 0, skipped: 5 });
  assert.deepEqual(workspace, before);
});

test("a changed selection or mapping cannot reuse its old preview approval", async () => {
  const workspace = createSheetsWorkspace("workbook_demo");
  const source = selection();
  const { preview } = await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" });
  source.values[1][5] = 126;
  await assert.rejects(executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", previewHash: preview!.previewHash }), status(409, /changed after preview/));
  assert.equal(workspace.state.gifts.length, 0);
});

test("malformed selection geometry, ambiguous columns and untrusted extra command keys are rejected atomically", async () => {
  const workspace = createSheetsWorkspace("workbook_demo");
  const initial = structuredClone(workspace);
  for (const source of [
    { ...selection(), a1: "A1:H6" },
    { ...selection(), formulas: [] },
    { ...selection(), values: [...selection().values, ["partial"]] },
  ]) await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" }), status(400));
  await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: selection(), mapping: { ...mapping, donor_id: 0 }, amountUnit: "dollars" }), status(400, /distinct column/));
  await assert.rejects(executeSheetsCommand(workspace, { action: "status", arbitraryPath: "/api/notes/note-1" }), status(400));
  await assert.rejects(executeSheetsCommand(workspace, { action: "notes" }), status(400));
  await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: { ...selection(), workbookId: "another_workbook" }, mapping, amountUnit: "dollars" }), status(403));
  assert.deepEqual(workspace, initial);
});

test("money conversion uses exact cents and rejects extra precision and ambiguous values", async () => {
  for (const [amount, expected] of [["$1,234.56", 123456], [0.29, 29], ["001.20", 120]] as const) {
    const workspace = createSheetsWorkspace("workbook_demo"); const source = selection(); source.values[1][5] = amount;
    const { preview } = await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" });
    assert.equal(preview!.rows[0].amount_cents, expected);
  }
  for (const amount of [0, -1, 0.001, "1.234,56", "NaN", "1e2", true, "9007199254740991.00"]) {
    const workspace = createSheetsWorkspace("workbook_demo"); const source = selection(); source.values[1][5] = amount;
    await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" }));
    assert.equal(workspace.state.gifts.length, 0);
  }
  const workspace = createSheetsWorkspace("workbook_demo"); const source = selection();
  source.values[1][5] = "12500";
  assert.equal((await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "cents" })).preview!.rows[0].amount_cents, 12500);
});

test("all donation rows validate before import and stable identity fields cannot be replaced by names", async () => {
  for (const [column, value] of [[0, ""], [1, ""], [6, "09/12/2026"], [6, "2026-02-30"], [7, "unrecognized"]] as const) {
    const workspace = createSheetsWorkspace("workbook_demo"); const before = structuredClone(workspace); const source = selection(); source.values[5][column] = value;
    await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars" }));
    assert.deepEqual(workspace, before);
  }
});

test("full sidebar workflow reconciles Rosa without changing money and exports only exact approved reports", async () => {
  const { workspace, source } = await imported();
  const candidateId = workspace.state.candidates[0].id;
  await executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId, decision: "approve" });
  assert.equal(metric(workspace, "donors"), 3);
  assert.equal(metric(workspace, "giving"), 635);
  const reviewed = structuredClone(workspace);
  await executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId, decision: "approve" });
  assert.deepEqual(workspace, reviewed);
  let draft = await report(workspace, source);
  await assert.rejects(executeSheetsCommand(workspace, { action: "export", selection: source, draftId: draft.id, revision: draft.revision }), status(409));
  const wrong = draft.claims.map(claim => ({ ...claim, value: claim.metricId === "giving" ? 9999 : claim.value }));
  draft = (await executeSheetsCommand(workspace, { action: "edit", selection: source, draftId: draft.id, revision: draft.revision, claims: wrong })).draft!;
  await assert.rejects(executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: draft.id, revision: draft.revision }), status(422));
  draft = (await executeSheetsCommand(workspace, { action: "edit", selection: source, draftId: draft.id, revision: draft.revision, claims: sheetsDashboard(workspace).metrics.map(({ id, value }) => ({ metricId: id, value })) })).draft!;
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: draft.id, revision: draft.revision });
  const approved = structuredClone(workspace);
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: draft.id, revision: draft.revision });
  assert.deepEqual(workspace, approved);
  const result = await executeSheetsCommand(workspace, { action: "export", selection: source, draftId: draft.id, revision: draft.revision });
  assert.match(result.export!.text, /Quarter giving: \$635\.00/u);
  assert.equal(result.export!.sourceHash, digest(source));
  assert(result.export!.rows.every(row => row.length === 2 && row.every(cell => typeof cell === "string")));
  assert(result.export!.rows.some(row => row[1].includes("fictional Q3 2026 program activity")));
  assert(!JSON.stringify(result).includes("PRIVATE_SENTINEL"));
});

test("changed source values, formulas or location block all post-import actions including export", async () => {
  const { workspace, source } = await imported();
  const draft = await report(workspace, source);
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: draft.id, revision: draft.revision });
  const changedSources = [structuredClone(source), structuredClone(source), structuredClone(source)];
  changedSources[0].values[1][5] = 999;
  changedSources[1].formulas[1][5] = "=SUM(A1:A3)";
  changedSources[2].sheetName = "Renamed donations";
  for (const changed of changedSources) for (const command of [
    { action: "merge", candidateId: workspace.state.candidates[0].id, decision: "approve" },
    { action: "generate", mode: "demo", requestId: "stale-attempt" },
    { action: "edit", draftId: draft.id, revision: 1, narrative: "Changed text" },
    { action: "approve", draftId: draft.id, revision: 1 },
    { action: "export", draftId: draft.id, revision: 1 },
  ]) await assert.rejects(executeSheetsCommand(workspace, { ...command, selection: changed }), status(409, /source cells/));
});

test("reimporting moved source cells refreshes provenance and invalidates an earlier report approval", async () => {
  const { workspace, source } = await imported();
  const draft = await report(workspace, source);
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: draft.id, revision: 1 });
  const moved = { ...source, startRow: 5, a1: "B5:I10" };
  const { preview } = await executeSheetsCommand(workspace, { action: "preview", selection: moved, mapping, amountUnit: "dollars" });
  await executeSheetsCommand(workspace, { action: "import", selection: moved, mapping, amountUnit: "dollars", previewHash: preview!.previewHash });
  assert.equal(workspace.state.gifts.length, 5);
  assert.equal(workspace.state.sources.find(item => item.id === "src-import-gift-a")!.row, 6);
  await assert.rejects(executeSheetsCommand(workspace, { action: "export", selection: moved, draftId: draft.id, revision: 1 }), status(422));
});

test("one workbook cannot leave earlier imports outside the currently verified source table", async () => {
  const { workspace, source } = await imported();
  const subset = { ...source, values: source.values.slice(0, 3), formulas: source.formulas.slice(0, 3), a1: "B4:I6" };
  await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: subset, mapping, amountUnit: "dollars" }), status(409, /every previously imported gift/));
});

test("replayed generation keys do not make another model call and reservations are checkpointed before work", async () => {
  const { workspace, source } = await imported();
  let calls = 0;
  const checkpoints: string[] = [];
  const dependencies = { checkpoint: () => { checkpoints.push(workspace.generationRequests[0]?.status ?? "none"); }, prepareDraft: (async (state, input) => { calls++; assert.equal(checkpoints[0], "running"); return prepareDraft(state, { ...input, mode: "demo" }); }) as typeof prepareDraft };
  const input = { action: "generate", selection: source, mode: "demo", requestId: "same-key" };
  const first = await executeSheetsCommand(workspace, input, dependencies);
  const second = await executeSheetsCommand(workspace, input, dependencies);
  assert.equal(calls, 1); assert.equal(second.replayed, true); assert.equal(second.draft!.id, first.draft!.id);
  assert.deepEqual(checkpoints, ["running", "completed"]);
  assert.equal(workspace.state.runs[0].inputHash, digest(workspace.state.runs[0].inputSnapshot));
  await assert.rejects(executeSheetsCommand(workspace, { ...input, mode: "live" }, dependencies), status(409, /different generation request/));
});

test("failed live runs preserve known usage, consume bounded budget and do not save drafts", async () => {
  const { workspace, source } = await imported();
  const fail: typeof prepareDraft = async () => { throw new DraftGenerationError("Synthetic provider failure.", { id: crypto.randomUUID(), mode: "live", model: "test", status: "failed", events: [], inputTokens: 91, outputTokens: 12, usageKnown: false, maxTurns: 3, durationMs: 1 }); };
  for (let index = 0; index < 12; index++) await assert.rejects(executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "live", requestId: `failed-${index}` }, { prepareDraft: fail }), status(502));
  assert.equal(workspace.state.drafts.length, 0);
  assert.equal(workspace.state.runs.length, 12);
  assert.equal(workspace.state.runs[0].inputTokens, 91);
  assert.equal(workspace.state.runs[0].usageKnown, false);
  await assert.rejects(executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "live", requestId: "over-limit" }, { prepareDraft: fail }), status(429));
  assert((await report(workspace, source, "rehearsal-after-limit")).id);
});

test("a relevant backend edit during generation rejects stale output while preserving its run", async () => {
  const { workspace, source } = await imported();
  const racing: typeof prepareDraft = async (state, input) => {
    const prepared = await prepareDraft(state, { ...input, mode: "demo" });
    recordAttendance(workspace.state, { participantId: "participant-lucia", date: "2026-09-25", status: "present" });
    prepared.run.inputTokens = 123;
    return prepared;
  };
  await assert.rejects(executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "demo", requestId: "racing" }, { prepareDraft: racing }), status(409));
  assert.equal(workspace.state.drafts.length, 0);
  assert.equal(workspace.state.runs[0].inputTokens, 123);
  assert.equal(workspace.state.runs[0].status, "failed");
});

test("reset is workbook-local and restart recovery preserves unknown usage of abandoned attempts", async () => {
  const { workspace, source } = await imported();
  workspace.generationRequests.push({ requestId: "in-flight", mode: "live", fingerprint: "old", status: "running", startedAt: new Date().toISOString() });
  await assert.rejects(executeSheetsCommand(workspace, { action: "reset" }), status(409));
  workspace.generationRequests[0].startedAt = "2020-01-01T00:00:00.000Z";
  const statusResult = await executeSheetsCommand(workspace, { action: "status" });
  assert.equal(workspace.generationRequests[0].status, "failed");
  assert.equal(statusResult.dashboard.runs[0].usageKnown, false);
  await executeSheetsCommand(workspace, { action: "reset" });
  assert.deepEqual(workspace, createSheetsWorkspace(source.workbookId));
});

test("expired request recovery is durably checkpointed even when its same-key retry is rejected", async () => {
  const { workspace, source } = await imported();
  workspace.generationRequests.push({ requestId: "expired-key", mode: "live", fingerprint: digest({ mode: "live", snapshotHash: workspace.selection!.snapshotHash }), status: "running", startedAt: "2020-01-01T00:00:00.000Z" });
  const saved: SheetsWorkspace[] = [];
  await assert.rejects(executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "live", requestId: "expired-key" }, { checkpoint: value => { saved.push(structuredClone(value)); } }), status(409, /interrupted/));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].generationRequests[0].status, "failed");
  assert.equal(saved[0].state.runs[0].usageKnown, false);
});

test("known import and merge validation errors remain actionable client errors", async () => {
  const { workspace, source } = await imported();
  await assert.rejects(executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId: "missing-candidate", decision: "approve" }), status(400, /not found/));
  const invalid = selection(); invalid.values[5][6] = "2026-02-30";
  await assert.rejects(executeSheetsCommand(createSheetsWorkspace(invalid.workbookId), { action: "preview", selection: invalid, mapping, amountUnit: "dollars" }), status(400, /date/));
});
