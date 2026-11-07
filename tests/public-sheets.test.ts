import assert from "node:assert/strict";
import test from "node:test";
import { prepareDraft } from "../src/lib/agent";
import { AppError } from "../src/lib/service";
import { createPublicSheetsWorkspace, createSheetsWorkspace, executeSheetsCommand, sheetsDashboard } from "../src/lib/sheets";
import type { SheetsMapping, SheetsSelection, SheetsWorkspace } from "../src/lib/sheets-types";

const period = { start: "2026-01-01", end: "2026-12-31" };
const mapping: SheetsMapping = { gift_id: 0, donor_id: null, name: 1, email: 2, phone: null, amount: 3, date: 4, channel: null };
function selection(): SheetsSelection {
  const values = [
    ["Receipt ID", "Name", "Email", "USD", "Donation date"],
    ["g1", "Alex Lee", "alex@example.test", "12.31", "2026-02-03"],
    ["g2", "Alex L.", "alex@example.test", "0.29", "2026-03-04"],
    ["g3", "Alex Lee", "namesake@example.test", "10.00", "2026-04-05"],
  ];
  return { workbookId: "public_workbook", sheetId: 42, sheetName: "Gifts", a1: "A1:E4", startRow: 1, startColumn: 1, values, formulas: values.map(row => row.map(() => "")) };
}
async function preview(workspace: SheetsWorkspace, source: SheetsSelection, reportingPeriod = period) {
  return (await executeSheetsCommand(workspace, { action: "preview", selection: source, mapping, amountUnit: "dollars", period: reportingPeriod, currency: "USD" })).preview!;
}
async function imported(source = selection(), workspace = createPublicSheetsWorkspace(source.workbookId), reportingPeriod = period) {
  const reviewed = await preview(workspace, source, reportingPeriod);
  const result = await executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", period: reportingPeriod, currency: "USD", previewHash: reviewed.previewHash });
  return { workspace, source, reviewed, result };
}
async function generate(workspace: SheetsWorkspace, source: SheetsSelection, requestId = "public-report") {
  return (await executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "demo", requestId })).draft!;
}
const blocked = (status: number) => (error: unknown) => error instanceof AppError && error.status === status;

test("public workspaces contain no seed or program metrics and require explicit USD dates", async () => {
  const workspace = createPublicSheetsWorkspace("public_workbook", period);
  assert.equal(workspace.mode, "public");
  assert.equal(workspace.state.sources.length, 0);
  assert.equal(workspace.state.participants.length, 0);
  assert.equal(workspace.state.attendance.length, 0);
  assert.equal(workspace.state.volunteerHours.length, 0);
  assert.equal(workspace.state.grants.length, 0);
  const dashboard = sheetsDashboard(workspace);
  assert.deepEqual(dashboard.metrics.map(metric => metric.id), ["donors", "giving"]);
  assert.equal(dashboard.programData, "not_provided");
  assert.deepEqual(dashboard.period, { ...period, label: "2026-01-01 to 2026-12-31" });
  await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: selection(), mapping, amountUnit: "dollars" }), blocked(400));
  await assert.rejects(executeSheetsCommand(workspace, { action: "reset" }), blocked(403));
  assert.throws(() => createPublicSheetsWorkspace("public_workbook", { start: "2026-02-30", end: "2026-03-01" }), AppError);
});

test("missing donor identifiers remain separate stable identities until evidence review", async () => {
  const { workspace, source, reviewed } = await imported();
  assert.equal(reviewed.metrics.find(metric => metric.id === "giving")!.value, 22.60);
  assert.equal(workspace.state.donors.length, 3);
  assert(workspace.state.gifts.every(gift => gift.channel === "unspecified"));
  assert.equal(workspace.state.candidates.length, 1);
  assert.equal(workspace.state.candidates[0].donorIds.length, 2);
  const identities = workspace.state.donors.map(donor => donor.id).sort();
  await executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId: workspace.state.candidates[0].id, decision: "approve" });
  const metrics = sheetsDashboard(workspace).metrics;
  assert.equal(metrics.find(metric => metric.id === "donors")!.value, 2);
  assert.equal(metrics.find(metric => metric.id === "giving")!.value, 22.60);
  const before = structuredClone(workspace);
  const result = await executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", period, currency: "USD", previewHash: reviewed.previewHash });
  assert.equal(result.replayed, true);
  assert.deepEqual(workspace, before);
  assert.deepEqual(workspace.state.donors.map(donor => donor.id).sort(), identities);
});

test("reviewed replacement previews corrections/removals, clears merges and invalidates exact approvals", async () => {
  const { workspace, source } = await imported();
  await executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId: workspace.state.candidates[0].id, decision: "approve" });
  const report = await generate(workspace, source);
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: report.id, revision: report.revision });
  const output = await executeSheetsCommand(workspace, { action: "export", selection: source, draftId: report.id, revision: report.revision });
  assert(!JSON.stringify(output.export).includes("fictional"));
  assert(!JSON.stringify(output.export).includes("volunteer"));
  assert.equal(output.export!.rows.find(row => row[0] === "Giving in reporting period")![1], "$22.60");
  assert(output.export!.rows.every(row => row.length === 3));
  assert.equal(output.export!.rows.find(row => row[0] === "src-import-g1")![2], "https://docs.google.com/spreadsheets/d/public_workbook/edit#gid=42&range=A2%3AE2");
  source.values[1][3] = "20.00";
  source.values.pop(); source.formulas.pop(); source.a1 = "A1:E3";
  await assert.rejects(executeSheetsCommand(workspace, { action: "export", selection: source, draftId: report.id, revision: report.revision }), blocked(409));
  const before = structuredClone(workspace);
  const reviewed = await preview(workspace, source);
  assert.deepEqual(workspace, before);
  assert.equal(reviewed.updated, 1);
  assert.equal(reviewed.removed, 1);
  assert.equal(reviewed.skipped, 1);
  assert.equal(reviewed.replacesSnapshot, true);
  assert.equal(reviewed.metrics.find(metric => metric.id === "giving")!.value, 20.29);
  await imported(source, workspace);
  assert.equal(workspace.state.gifts.length, 2);
  assert.equal(workspace.state.donors.filter(donor => donor.mergedInto).length, 0);
  assert.equal(workspace.state.drafts[0].status, "pending");
  assert.equal(workspace.state.drafts[0].approvedDigest, undefined);
  await assert.rejects(executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: report.id, revision: report.revision }), blocked(422));
  const fresh = await generate(workspace, source, "corrected-report");
  assert.equal(fresh.claims.find(claim => claim.metricId === "giving")!.value, 20.29);
});

test("reporting period is bound to preview and source evidence, including empty periods", async () => {
  const { workspace, source } = await imported();
  const reviewed = await preview(workspace, source);
  const february = { start: "2026-02-01", end: "2026-02-28" };
  await assert.rejects(executeSheetsCommand(workspace, { action: "import", selection: source, mapping, amountUnit: "dollars", period: february, currency: "USD", previewHash: reviewed.previewHash }), blocked(409));
  const result = await imported(source, workspace, february);
  assert.equal(result.reviewed.metrics.find(metric => metric.id === "giving")!.value, 12.31);
  assert(result.reviewed.warnings!.some(message => message.includes("2 gifts fall outside")));
  const empty = { start: "2027-01-01", end: "2027-01-31" };
  await imported(source, workspace, empty);
  const report = await generate(workspace, source);
  await executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: report.id, revision: report.revision });
  source.values[1][3] = "12.32";
  await imported(source, workspace, empty);
  await assert.rejects(executeSheetsCommand(workspace, { action: "approve", selection: source, draftId: report.id, revision: report.revision }), blocked(422));
});

test("public validation rejects refunds, currency mismatch, duplicate IDs and unsafe precision without mutation", async () => {
  const workspace = createPublicSheetsWorkspace("public_workbook");
  for (const amount of ["-2.00", "EUR 5.00", "1.001", "90071992547409.92"]) {
    const source = selection(); source.values[1][3] = amount;
    await assert.rejects(preview(workspace, source), AppError);
    assert.equal(workspace.state.gifts.length, 0);
  }
  const source = selection(); source.values[2][0] = "g1";
  await assert.rejects(preview(workspace, source), /occurs more than once/);
  await assert.rejects(executeSheetsCommand(workspace, { action: "preview", selection: selection(), mapping, amountUnit: "dollars", period, currency: "EUR" }), blocked(400));
});

test("public live generation is blocked at engine and provider boundaries even with an API key", async () => {
  const { workspace, source } = await imported();
  const before = structuredClone(workspace);
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-that-must-never-be-used";
  let checkpoints = 0, quotaHooks = 0, preparations = 0, providerCalls = 0;
  try {
    assert.equal(sheetsDashboard(workspace).liveAvailable, false);
    assert.equal(sheetsDashboard(createSheetsWorkspace("legacy_demo_workbook")).liveAvailable, true, "legacy demo capability remains unchanged");
    await assert.rejects(executeSheetsCommand(workspace, { action: "generate", selection: source, mode: "live", requestId: "forged-live" }, {
      checkpoint: () => { checkpoints++; }, beforeGeneration: () => { quotaHooks++; },
      prepareDraft: async () => { preparations++; throw new Error("must not prepare paid work"); },
    }), blocked(403));
    await assert.rejects(prepareDraft(workspace.state, { kind: "report", mode: "live" }, {
      runModel: async () => { providerCalls++; throw new Error("must not contact a provider"); },
    }), /AI generation is disabled/u);
    assert.deepEqual(workspace, before);
    assert.deepEqual({ checkpoints, quotaHooks, preparations, providerCalls }, { checkpoints: 0, quotaHooks: 0, preparations: 0, providerCalls: 0 });
    const standard = await prepareDraft(workspace.state, { kind: "report", mode: "demo" }, {
      runModel: async () => { providerCalls++; throw new Error("standard reports must remain local"); },
    });
    assert.equal(standard.draft.title, "Donation reconciliation report");
    assert.equal(standard.draft.claims.length, 2);
    assert.equal(standard.run.model, "deterministic-template");
    assert.equal(standard.run.inputTokens + standard.run.outputTokens, 0);
    assert.equal(providerCalls, 0);
  } finally { if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
});

test("large matching groups have bounded review IDs and still need explicit approval", async () => {
  const source = selection();
  source.values = [source.values[0], ...Array.from({ length: 60 }, (_, index) => [`gift-${index}`, "Shared Contact", "office@example.test", "0.01", "2026-05-01"])];
  source.formulas = source.values.map(row => row.map(() => ""));
  source.a1 = "A1:E61";
  const { workspace } = await imported(source);
  const candidate = workspace.state.candidates[0];
  assert.equal(candidate.donorIds.length, 60);
  assert(candidate.id.length < 100);
  assert.equal(sheetsDashboard(workspace).metrics[0].value, 60);
  await executeSheetsCommand(workspace, { action: "merge", selection: source, candidateId: candidate.id, decision: "approve" });
  assert.equal(sheetsDashboard(workspace).metrics[0].value, 1);
  assert.equal(sheetsDashboard(workspace).metrics[1].value, 0.60);
});
