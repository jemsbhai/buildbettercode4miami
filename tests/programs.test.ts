import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getMetrics } from "../src/lib/domain";
import { createSeed } from "../src/lib/seed";
import { addProgramSeed, applicationWordCount, approveDisclosure, createDisclosure, exportDisclosure, getGrantLedgers, getNote, renderApplicationAnswer, SAFE_NOTE_FIELDS, saveNote, validateApplication } from "../src/lib/programs";
import type { DemoState, Draft } from "../src/lib/types";

function fixture(): DemoState {
  const state = createSeed();
  if (!state.grants.length) addProgramSeed(state);
  return state;
}

function application(state: DemoState): Draft {
  const metric = getMetrics(state)[0];
  return { id: "draft-application-test", kind: "application", grantId: state.grants[0].id,
    title: "Family support application", narrative: "We help families connect with reliable mentoring and practical support.",
    claims: [{ metricId: metric.id, value: metric.value }], sourceIds: [...state.grants[0].sourceIds, ...metric.sourceIds],
    dataRevision: state.revision, revision: 1, status: "pending", mode: "demo", createdAt: "2026-09-30T09:00:00.000Z", runId: "run-application-test" };
}

test("one-week seed contains twenty-five notes and exposes no private text in source metadata", () => {
  const state = fixture();
  assert.equal(state.notes.length, 25);
  assert.equal(new Set(state.notes.map((note) => note.date)).size, 5);
  assert.equal(state.notes.filter((note) => !note.payable).length, 1);
  assert.match(state.notes[0].privateDetail, /PRIVATE_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(state.sources), /PRIVATE_SENTINEL|sensitive household concern|confidential context/);
  assert.deepEqual(fixture(), state);
});

test("grant ledger uses inclusive funder-year boundaries and separates disallowed/outside expenses", () => {
  const state = fixture();
  const ledger = getGrantLedgers(state)[0];
  assert.equal(ledger.fiscalStart, "2026-07-01");
  assert.equal(ledger.fiscalEnd, "2027-06-30");
  const personnel = ledger.categories.find((category) => category.name === "personnel")!;
  assert.equal(personnel.spentCents, 1_050_000);
  assert.equal(personnel.remainingCents, -50_000);
  assert.equal(personnel.status, "over_budget");
  const materials = ledger.categories.find((category) => category.name === "materials")!;
  assert.equal(materials.spentCents, 180_000);
  assert.equal(materials.status, "near_limit");
  assert.equal(ledger.categories.find((category) => category.name === "transport")!.status, "within_budget");
  assert.deepEqual(ledger.disallowed.map((expense) => expense.id), ["expense-disallowed"]);
  assert.deepEqual(ledger.outsidePeriod.map((expense) => expense.id), ["expense-before-year", "expense-after-year"]);
  state.expenses.push({ id: "end-boundary", grantId: state.grants[0].id, category: "transport", amountCents: 100, date: "2027-06-30", description: "Inclusive fiscal end", sourceIds: [] });
  assert.equal(getGrantLedgers(state)[0].categories.find((category) => category.name === "transport")!.spentCents, 35_000);
  assert.deepEqual(getGrantLedgers(state)[0].upcoming?.map((expense) => expense.id), ["end-boundary"]);
  state.asOf = "2027-06-30";
  assert.equal(getGrantLedgers(state)[0].categories.find((category) => category.name === "transport")!.spentCents, 35_100);
});

test("funder preview includes only required safe fields and never private note details", () => {
  const state = fixture();
  const preview = createDisclosure(state, state.notes[0].id, state.grants[0].id);
  assert.deepEqual(Object.keys(preview.payload).sort(), [...SAFE_NOTE_FIELDS].sort());
  assert.equal(preview.payload.durationMinutes, 45);
  assert.ok(preview.excludedFields.includes("privateDetail"));
  assert.ok(preview.excludedFields.includes("counselor"));
  assert.doesNotMatch(JSON.stringify(preview), /PRIVATE_SENTINEL|sensitive household concern/);
  assert.equal(preview.status, "pending");
  assert.match(preview.payloadHash, /^[a-f0-9]{64}$/);
});

test("nonpayable sessions, wrong funders and unsafe policies cannot produce disclosures", () => {
  const state = fixture();
  assert.throws(() => createDisclosure(state, state.notes.find((note) => !note.payable)!.id, state.grants[0].id), /not funder-payable/);
  state.grants.push({ ...structuredClone(state.grants[0]), id: "another-funder" });
  assert.throws(() => createDisclosure(state, state.notes[0].id, "another-funder"), /does not belong/);
  state.grants[0].allowedNoteFields.push("privateDetail");
  assert.throws(() => createDisclosure(state, state.notes[0].id, state.grants[0].id), /private fields cannot be disclosed/);
  assert.equal(state.disclosures.length, 0);
});

test("approval binds to the exact preview hash; export requires approval", () => {
  const state = fixture();
  const preview = createDisclosure(state, state.notes[0].id, state.grants[0].id);
  assert.throws(() => exportDisclosure(state, preview.id), /approval is required/);
  assert.throws(() => approveDisclosure(state, preview.id, "wrong-hash"), /hash does not match/);
  assert.equal(state.disclosures[0].status, "pending");
  const approved = approveDisclosure(state, preview.id, preview.payloadHash);
  assert.equal(approved.status, "approved");
  assert.deepEqual(exportDisclosure(state, preview.id), preview.payload);
  assert.doesNotMatch(JSON.stringify(exportDisclosure(state, preview.id)), /PRIVATE_SENTINEL/);
  const auditCount = state.audit.length;
  assert.deepEqual(approveDisclosure(state, preview.id, preview.payloadHash), approved);
  assert.equal(state.audit.length, auditCount, "approval retries must not duplicate audit actions");
});

test("unrelated revision changes preserve scoped approval but legacy previews remain conservative", () => {
  const state = fixture();
  const preview = createDisclosure(state, state.notes[0].id, state.grants[0].id);
  approveDisclosure(state, preview.id, preview.payloadHash);
  state.revision++;
  assert.deepEqual(exportDisclosure(state, preview.id), preview.payload);
  assert.equal(approveDisclosure(state, preview.id, preview.payloadHash).status, "approved");
  delete state.disclosures[0].evidenceHash;
  assert.throws(() => exportDisclosure(state, preview.id), /changed/i);
  assert.throws(() => approveDisclosure(state, preview.id, preview.payloadHash), /Records changed/);
});

test("payload, note and policy changes are detected even if a caller forgets to bump revision", () => {
  for (const change of ["payload", "note", "policy"] as const) {
    const state = fixture();
    const preview = createDisclosure(state, state.notes[0].id, state.grants[0].id);
    approveDisclosure(state, preview.id, preview.payloadHash);
    if (change === "payload") state.disclosures[0].payload.privateDetail = "tampered";
    if (change === "note") state.notes[0].progress = "Updated progress";
    if (change === "policy") state.grants[0].allowedNoteFields.pop();
    assert.throws(() => exportDisclosure(state, preview.id), /changed/);
  }
});

test("note reads and disclosure actions are audited without copying private content into logs", () => {
  const state = fixture();
  const note = getNote(state, state.notes[0].id);
  assert.match(note.privateDetail, /PRIVATE_SENTINEL/);
  note.privateDetail = "Detached caller copy";
  assert.match(state.notes[0].privateDetail, /PRIVATE_SENTINEL/);
  const preview = createDisclosure(state, state.notes[0].id, state.grants[0].id);
  approveDisclosure(state, preview.id, preview.payloadHash);
  exportDisclosure(state, preview.id);
  assert.equal(state.audit.filter((event) => event.action === "note.accessed").length, 4);
  for (const action of ["disclosure.previewed", "disclosure.approved", "disclosure.exported"]) assert.ok(state.audit.some((event) => event.action === action));
  assert.doesNotMatch(JSON.stringify(state.audit), /PRIVATE_SENTINEL|sensitive household concern/);
});

test("saving a note writes once, preserves privacy and invalidates previous disclosure", () => {
  const state = fixture();
  const original = state.notes[0];
  const preview = createDisclosure(state, original.id, state.grants[0].id);
  approveDisclosure(state, preview.id, preview.payloadHash);
  const oldRevision = state.revision;
  const saved = saveNote(state, original.id, { goal: "Updated routine", progress: "Practiced together", privateDetail: "EDITED_PRIVATE_SENTINEL", durationMinutes: 50 });
  assert.equal(state.revision, oldRevision + 1);
  assert.equal(saved.durationMinutes, 50);
  assert.equal(saved.privateDetail, "EDITED_PRIVATE_SENTINEL");
  assert.doesNotMatch(JSON.stringify(state.sources), /EDITED_PRIVATE_SENTINEL|Updated routine|Practiced together/);
  assert.doesNotMatch(JSON.stringify(state.audit), /EDITED_PRIVATE_SENTINEL/);
  assert.ok(state.audit.some((event) => event.action === "note.saved"));
  assert.throws(() => exportDisclosure(state, preview.id), /changed/i);
  const fresh = createDisclosure(state, original.id, state.grants[0].id);
  assert.equal(fresh.payload.durationMinutes, 50);
});

test("invalid note edits are rejected before any note or revision mutation", () => {
  const state = fixture();
  const note = state.notes[0];
  const before = structuredClone(state);
  const valid = { goal: note.goal, progress: note.progress, privateDetail: note.privateDetail, durationMinutes: note.durationMinutes };
  assert.throws(() => saveNote(state, note.id, { ...valid, durationMinutes: 0 }), /duration/);
  assert.throws(() => saveNote(state, note.id, { ...valid, goal: " " }), /goal/);
  assert.throws(() => saveNote(state, note.id, { ...valid, privateDetail: "x".repeat(8001) }), /privateDetail/);
  assert.deepEqual(state, before);
});

test("application limit counts full submitted answer including bound figure lines", () => {
  const state = fixture();
  const draft = application(state);
  assert.deepEqual(validateApplication(state, draft), []);
  assert.equal(applicationWordCount(state, draft), renderApplicationAnswer(state, draft).split(/\s+/).length);
  const narrativeWords = draft.narrative.trim().split(/\s+/).length;
  assert.ok(applicationWordCount(state, draft) > narrativeWords);
  state.grants[0].wordLimit = narrativeWords;
  assert.ok(validateApplication(state, draft).some((issue) => issue.code === "application_word_limit"));
  state.grants[0].wordLimit = applicationWordCount(state, draft);
  assert.ok(!validateApplication(state, draft).some((issue) => issue.code === "application_word_limit"));
  draft.sourceIds.push(...state.sources.map((source) => source.id));
  assert.equal(applicationWordCount(state, draft), state.grants[0].wordLimit, "separate provenance appendix must not inflate answer word count");
});

test("application requires a real funder, at least one bound fact and funder-policy evidence", () => {
  const state = fixture();
  const draft = application(state);
  draft.grantId = "missing";
  assert.equal(validateApplication(state, draft)[0].code, "grant");
  draft.grantId = state.grants[0].id;
  draft.claims = [];
  assert.ok(validateApplication(state, draft).some((issue) => issue.code === "application_facts"));
  draft.sourceIds = [];
  assert.ok(validateApplication(state, draft).some((issue) => issue.code === "application_policy"));
  assert.deepEqual(validateApplication(state, { ...draft, kind: "report" }), []);
});
