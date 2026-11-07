import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createSeed } from "../src/lib/seed";
import { approveDisclosure, createDisclosure, disclosureIsCurrent, exportDisclosure, getGrantLedgers, getNote, recordExpense, saveNote } from "../src/lib/programs";
import type { CounselingNote, DemoState } from "../src/lib/types";

function edit(note: CounselingNote) {
  return { goal: note.goal, progress: note.progress, privateDetail: note.privateDetail, durationMinutes: note.durationMinutes };
}

function entry(state: DemoState) {
  return { id: "expense-live-demo", date: state.asOf, category: "transport", amountCents: 60_000, description: "Fictional family transport services" };
}

test("new spending changes the live ledger once and warns at the budget threshold", () => {
  const state = createSeed();
  const grantId = state.grants[0].id;
  const revision = state.revision;
  const result = recordExpense(state, grantId, entry(state));
  assert.equal(result.inserted, true);
  assert.equal(state.revision, revision + 1);
  const category = getGrantLedgers(state)[0].categories.find((item) => item.name === "transport")!;
  assert.equal(category.spentCents, 95_000);
  assert.equal(category.remainingCents, 5_000);
  assert.equal(category.status, "near_limit");
  assert.ok(category.sourceIds.includes(result.expense.sourceIds[0]));
  const after = structuredClone(state);
  assert.equal(recordExpense(state, grantId, { ...entry(state), category: " Transport " }).inserted, false);
  assert.deepEqual(state, after);
  assert.throws(() => recordExpense(state, grantId, { ...entry(state), amountCents: 50 }), /already exists/);
  assert.deepEqual(state, after);
  result.expense.description = "Detached caller copy";
  assert.equal(state.expenses.at(-1)!.description, entry(state).description);
});

test("unknown expense categories stay visible as disallowed; future entries stay upcoming", () => {
  const state = createSeed();
  const grantId = state.grants[0].id;
  recordExpense(state, grantId, { ...entry(state), category: " Gala " });
  recordExpense(state, grantId, { ...entry(state), id: "future-gala", category: "gala", date: "2026-10-01" });
  const ledger = getGrantLedgers(state)[0];
  assert.ok(ledger.disallowed.some((expense) => expense.id === "expense-live-demo" && expense.category === "gala"));
  assert.ok(!ledger.disallowed.some((expense) => expense.id === "future-gala"));
  assert.deepEqual(ledger.upcoming?.map((expense) => expense.id), ["future-gala"]);
  state.asOf = "2026-10-01";
  assert.ok(getGrantLedgers(state)[0].disallowed.some((expense) => expense.id === "future-gala"));
});

test("expense input validation is atomic for invalid IDs, dates, amounts and unknown funders", () => {
  const state = createSeed();
  const before = structuredClone(state);
  for (const patch of [{ id: "" }, { id: "bad\nID" }, { date: "2026-02-30" }, { date: "September 30, 2026" }, { amountCents: 1.5 }, { amountCents: -1 }, { amountCents: 0 }, { amountCents: NaN }, { amountCents: Infinity }, { amountCents: Number.MAX_SAFE_INTEGER + 1 }, { category: " " }, { description: " " }]) {
    assert.throws(() => recordExpense(state, state.grants[0].id, { ...entry(state), ...patch }));
    assert.deepEqual(state, before);
  }
  assert.throws(() => recordExpense(state, "unknown", entry(state)), /Funder not found/);
  assert.deepEqual(state, before);
});

test("corrupted ledger data fails closed instead of creating credible but invalid totals", () => {
  const changes: ((state: DemoState) => void)[] = [
    (state) => { state.asOf = "2026-02-30"; },
    (state) => { state.grants[0].fiscalStart = "2027-07-01"; },
    (state) => { state.grants[0].fiscalEnd = "2027-02-30"; },
    (state) => { state.grants[0].categories[0].budgetCents = 0.5; },
    (state) => { state.grants[0].categories[0].budgetCents = -1; },
    (state) => { state.grants[0].categories.push({ name: " PERSONNEL ", budgetCents: 10 }); },
    (state) => { state.expenses[0].date = "2026-02-30"; },
    (state) => { state.expenses[0].amountCents = 1.5; },
    (state) => { state.expenses[0].amountCents = -1; },
    (state) => { state.expenses[0].amountCents = NaN; },
    (state) => { state.expenses[0].grantId = "unknown"; },
    (state) => { state.expenses.push(structuredClone(state.expenses[0])); },
    (state) => { state.grants.push(structuredClone(state.grants[0])); },
  ];
  for (const change of changes) {
    const state = createSeed();
    change(state);
    const before = structuredClone(state);
    assert.throws(() => getGrantLedgers(state));
    assert.deepEqual(state, before);
  }
});

test("integer-safe totals reject overflow before a new expense mutates state", () => {
  const state = createSeed();
  const before = structuredClone(state);
  assert.throws(() => recordExpense(state, state.grants[0].id, { ...entry(state), amountCents: Number.MAX_SAFE_INTEGER }), /precision/);
  assert.throws(() => recordExpense(state, state.grants[0].id, { ...entry(state), date: "2026-10-01", amountCents: Number.MAX_SAFE_INTEGER }), /precision/);
  assert.deepEqual(state, before);
  state.grants[0].categories[0].budgetCents = Number.MAX_SAFE_INTEGER;
  assert.throws(() => getGrantLedgers(state), /precision/);
});

test("no-op note edits preserve approval and cause no new audit, source or revision", () => {
  const state = createSeed();
  const note = state.notes[0];
  const preview = createDisclosure(state, note.id, note.grantId);
  approveDisclosure(state, preview.id, preview.payloadHash);
  const before = structuredClone(state);
  const result = saveNote(state, note.id, { ...edit(note), goal: ` ${note.goal} ` });
  assert.match(result.contentHash!, /^[a-f0-9]{64}$/);
  assert.deepEqual(state, before);
  assert.deepEqual(exportDisclosure(state, preview.id), preview.payload);
});

test("optimistic note hashes reject lost updates without leaking note text", () => {
  const state = createSeed();
  const firstEditor = getNote(state, state.notes[0].id);
  const saved = saveNote(state, firstEditor.id, { ...edit(firstEditor), goal: "Revised routine", expectedNoteHash: firstEditor.contentHash });
  assert.notEqual(saved.contentHash, firstEditor.contentHash);
  const before = structuredClone(state);
  assert.throws(() => saveNote(state, firstEditor.id, { ...edit(firstEditor), progress: "Second editor changes", expectedNoteHash: firstEditor.contentHash }), /avoid overwriting/);
  assert.deepEqual(state, before);
  assert.doesNotMatch(JSON.stringify(state.audit), /PRIVATE_SENTINEL|Revised routine|Second editor changes/);
});

test("verbatim private details pasted into allowed fields block disclosure even with changed case and whitespace", () => {
  for (const field of ["goal", "progress"] as const) {
    const state = createSeed();
    const note = state.notes[0];
    saveNote(state, note.id, { ...edit(note), [field]: `Session summary: ${note.privateDetail.toUpperCase().replaceAll(" ", "\n  ")}` });
    const before = structuredClone(state);
    assert.throws(() => createDisclosure(state, note.id, note.grantId), /private note detail was copied/);
    assert.deepEqual(state, before);
    assert.doesNotMatch(JSON.stringify(state.audit), /PRIVATE_SENTINEL|SENSITIVE HOUSEHOLD/);
  }
});

test("scoped disclosure approval survives another note and donor revisions", () => {
  const state = createSeed();
  const note = state.notes[0];
  const preview = createDisclosure(state, note.id, note.grantId);
  approveDisclosure(state, preview.id, preview.payloadHash);
  saveNote(state, state.notes[1].id, { ...edit(state.notes[1]), progress: "Another session was updated" });
  state.revision++;
  state.sources[0].values.extra = "Unrelated donor correction";
  assert.equal(disclosureIsCurrent(state, preview), true);
  assert.deepEqual(exportDisclosure(state, preview.id), preview.payload);
});

test("private detail, policy and provenance changes invalidate review even when public payload is unchanged", () => {
  for (const change of ["private", "funder", "fiscal", "source", "missing-source"] as const) {
    const state = createSeed();
    const note = state.notes[0];
    const preview = createDisclosure(state, note.id, note.grantId);
    approveDisclosure(state, preview.id, preview.payloadHash);
    if (change === "private") note.privateDetail = "Different internal context";
    if (change === "funder") state.grants[0].name = "Another policy name";
    if (change === "fiscal") state.grants[0].fiscalEnd = "2027-06-29";
    if (change === "source") state.sources.find((source) => source.id === note.sourceIds[0])!.row++;
    if (change === "missing-source") state.sources = state.sources.filter((source) => source.id !== note.sourceIds[0]);
    assert.equal(disclosureIsCurrent(state, preview), false);
    assert.throws(() => exportDisclosure(state, preview.id), /changed|missing/);
    assert.throws(() => approveDisclosure(state, preview.id, preview.payloadHash), /changed|missing/);
  }
});

test("invalid or future counseling sessions cannot produce a funder copy", () => {
  for (const patch of [{ date: "2026-02-30" }, { date: "2026-10-01" }, { durationMinutes: 1.5 }, { durationMinutes: 0 }, { durationMinutes: Infinity }, { durationMinutes: 481 }, { progress: " " }]) {
    const state = createSeed();
    Object.assign(state.notes[0], patch);
    const before = structuredClone(state);
    assert.throws(() => createDisclosure(state, state.notes[0].id, state.grants[0].id));
    assert.deepEqual(state, before);
  }
});
