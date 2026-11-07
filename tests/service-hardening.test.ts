import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/lib/seed";
import { decideMerge, getMetrics, getQueue, importGiftCsv, recordAttendance } from "../src/lib/domain";
import { draftApprovalDigest, draftIsCurrent, draftSourceFingerprint, stableJson } from "../src/lib/evidence";
import { saveNote } from "../src/lib/programs";
import { AppError, approveDraft, checkDraft, dashboard, editDraft, exportDraft, simulateDelivery } from "../src/lib/service";
import type { DemoState, Draft } from "../src/lib/types";

function scopedDraft(state: DemoState, queueItemId?: string): Draft {
  const metrics = getMetrics(state);
  const task = queueItemId ? getQueue(state).find((item) => item.id === queueItemId)! : undefined;
  const draft: Draft = {
    id: `scoped-${queueItemId ?? "report"}`, kind: task ? "followup" : "report", queueItemId,
    title: "Care and community", narrative: "Please let us know what support would help your family. Our team is available for a considerate conversation.",
    claims: task ? [] : metrics.map((metric) => ({ metricId: metric.id, value: metric.value })),
    sourceIds: task ? [...task.sourceIds] : [...new Set(metrics.flatMap((metric) => metric.sourceIds))],
    dataRevision: state.revision, originDataRevision: state.revision,
    revision: 1, status: "pending", mode: "demo", createdAt: "2026-09-30T10:00:00Z", runId: "scoped-run",
  };
  draft.sourceFingerprint = draftSourceFingerprint(state, draft);
  state.drafts.push(draft);
  return draft;
}

function unrelatedNoteEdit(state: DemoState) {
  const note = state.notes[0];
  saveNote(state, note.id, { goal: note.goal, progress: `${note.progress} Staff reviewed the care plan.`, privateDetail: note.privateDetail, durationMinutes: note.durationMinutes });
}

function errorStatus(status: number, code?: string) {
  return (error: unknown) => error instanceof AppError && error.status === status && (!code || Boolean(error.issues?.some((issue) => issue.code === code)));
}

test("unrelated private note edits preserve approved and pending report evidence", () => {
  const state = createSeed();
  const approved = scopedDraft(state);
  approveDraft(state, approved.id, approved.revision);
  const pending = { ...structuredClone(approved), id: "pending-report", status: "pending" as const, approvedAt: undefined, approvedDigest: undefined };
  state.drafts.push(pending);
  const fingerprint = approved.sourceFingerprint;
  const approvalDigest = approved.approvedDigest;
  const originalRevision = approved.dataRevision;
  unrelatedNoteEdit(state);
  assert.notEqual(state.revision, originalRevision);
  assert.equal(draftSourceFingerprint(state, approved), fingerprint);
  assert.equal(draftIsCurrent(state, approved), true);
  assert.deepEqual(checkDraft(state, approved), []);
  assert.match(exportDraft(state, approved.id), /Quarter giving: \$635\.00/);
  assert.equal(approved.approvedDigest, approvalDigest);
  assert.equal(approved.dataRevision, originalRevision, "presentation must not rewrite stored provenance");
  const view = dashboard(state).state.drafts.find((item) => item.id === approved.id)!;
  assert.equal(view.dataRevision, state.revision);
  assert.equal(view.originDataRevision, originalRevision);
  approveDraft(state, pending.id, pending.revision);
  assert.equal(pending.status, "approved");
  const serialized = JSON.stringify({ fingerprint, exported: exportDraft(state, approved.id), view });
  assert.ok(!serialized.includes(state.notes[0].privateDetail));
});

test("aggregate changes and relevant source edits invalidate scoped approvals independently of revision counters", () => {
  for (const mutate of [
    (state: DemoState) => recordAttendance(state, { participantId: "participant-lucia", date: "2026-09-25", status: "present" }),
    (state: DemoState) => decideMerge(state, state.candidates[0].id, "approve"),
    (state: DemoState) => { state.sources.find((source) => source.id === "src-gift-online-101")!.values.amount_cents = 9999; },
  ]) {
    const state = createSeed();
    const draft = scopedDraft(state);
    approveDraft(state, draft.id, draft.revision);
    mutate(state);
    assert.equal(draftIsCurrent(state, draft), false);
    assert.throws(() => exportDraft(state, draft.id), errorStatus(422, "stale"));
    const currentClaims = getMetrics(state).map((metric) => ({ metricId: metric.id, value: metric.value }));
    editDraft(state, draft.id, { revision: draft.revision, claims: currentClaims });
    assert.throws(() => approveDraft(state, draft.id, draft.revision), errorStatus(422, "stale"));
  }
});

test("follow-up approval remains shown after unrelated notes and closes when its evidence is resolved", () => {
  const state = createSeed();
  const draft = scopedDraft(state, "attendance:participant-lucia");
  approveDraft(state, draft.id, draft.revision);
  unrelatedNoteEdit(state);
  assert.equal(dashboard(state).queue.find((item) => item.id === draft.queueItemId)!.status, "approved");
  assert.deepEqual(checkDraft(state, draft), []);
  recordAttendance(state, { participantId: "participant-lucia", date: "2026-09-25", status: "present" });
  assert.ok(!dashboard(state).queue.some((item) => item.id === draft.queueItemId));
  assert.throws(() => simulateDelivery(state, draft.id, draft.revision), errorStatus(422, "stale"));
  assert.equal(state.outbox.length, 0);
});

test("recipient-specific evidence scopes follow-ups to the current guardian", () => {
  const state = createSeed();
  const followup = scopedDraft(state, "attendance:participant-lucia");
  const report = scopedDraft(state);
  approveDraft(state, followup.id, followup.revision);
  state.participants.find((person) => person.id === "participant-lucia")!.guardian = "Updated Guardian";
  assert.equal(draftIsCurrent(state, followup), false);
  assert.equal(draftIsCurrent(state, report), true);
  assert.throws(() => simulateDelivery(state, followup.id, followup.revision), errorStatus(422, "stale"));
});

test("simulated delivery uses only reviewed prose and the guardian, preserving its original receipt on retries", () => {
  const state = createSeed();
  const draft = scopedDraft(state, "attendance:participant-lucia");
  approveDraft(state, draft.id, draft.revision);
  const message = simulateDelivery(state, draft.id, draft.revision);
  assert.equal(message.recipient, "Elena Morales");
  assert.equal(message.body, draft.narrative);
  assert.equal(message.transport, "simulation");
  assert.equal(message.status, "simulated_sent");
  assert.doesNotMatch(message.body, /Source references|Record revision|src-|Fictional demonstration/);
  const receipt = structuredClone(message);
  const auditLength = state.audit.length;
  unrelatedNoteEdit(state);
  const afterUnrelatedAudit = state.audit.length;
  assert.ok(afterUnrelatedAudit > auditLength);
  assert.deepEqual(simulateDelivery(state, draft.id, draft.revision), receipt);
  assert.equal(state.outbox.length, 1);
  assert.equal(state.audit.length, afterUnrelatedAudit);
});

test("content and evidence-reference tampering cannot reuse an exact approval digest", () => {
  const mutations: ((draft: Draft) => void)[] = [
    (draft) => { draft.title = "A changed title"; },
    (draft) => { draft.narrative = "Different reviewed prose would require fresh staff approval."; },
    (draft) => { draft.claims.reverse(); },
    (draft) => { draft.sourceIds.reverse(); },
    (draft) => { draft.revision++; },
  ];
  for (const mutate of mutations) {
    const state = createSeed();
    const draft = scopedDraft(state);
    approveDraft(state, draft.id, draft.revision);
    const approvedDigest = draft.approvedDigest;
    mutate(draft);
    assert.notEqual(draftApprovalDigest(draft), approvedDigest);
    assert.throws(() => exportDraft(state, draft.id), errorStatus(409));
  }
  const state = createSeed();
  const draft = scopedDraft(state, "attendance:participant-lucia");
  approveDraft(state, draft.id, draft.revision);
  draft.narrative = "Tampered prose must not reach a recipient.";
  assert.throws(() => simulateDelivery(state, draft.id, draft.revision), errorStatus(409));
  assert.equal(state.outbox.length, 0);
});

test("empty and identical edits plus repeated approvals do not invalidate a reviewed draft or append audit noise", () => {
  const state = createSeed();
  const draft = scopedDraft(state);
  approveDraft(state, draft.id, draft.revision);
  const before = structuredClone(state);
  editDraft(state, draft.id, { revision: draft.revision });
  editDraft(state, draft.id, { revision: draft.revision, narrative: draft.narrative, claims: structuredClone(draft.claims) });
  approveDraft(state, draft.id, draft.revision);
  assert.deepEqual(state, before);
  assert.throws(() => editDraft(state, draft.id, { revision: 999, narrative: draft.narrative }), errorStatus(409));
  assert.deepEqual(state, before);
});

test("stable evidence ignores object-key order while exact approval preserves ordered claims", () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }));
  const state = createSeed();
  const draft = scopedDraft(state);
  const fingerprint = draftSourceFingerprint(state, draft);
  const source = state.sources.find((item) => item.id === "src-gift-online-101")!;
  source.values = Object.fromEntries(Object.entries(source.values).reverse());
  assert.equal(draftSourceFingerprint(state, draft), fingerprint);
  assert.notEqual(stableJson(["a", "b"]), stableJson(["b", "a"]));
});

test("a paid monthly follow-up cannot remain approved when the next monthly cycle opens", () => {
  const state = createSeed();
  const draft = scopedDraft(state, "monthly:donor-jules");
  approveDraft(state, draft.id, draft.revision);
  importGiftCsv(state, "gift_id,donor_id,name,email,phone,amount_cents,date,channel\nscoped-paid,donor-jules,Jules Pierre,jules@example.test,,5000,2026-09-29,online", "paid.csv");
  assert.ok(!dashboard(state).queue.some((item) => item.id === draft.queueItemId));
  state.asOf = "2026-10-28";
  state.revision++;
  const reopened = dashboard(state).queue.find((item) => item.id === draft.queueItemId)!;
  assert.equal(reopened.status, "open");
  assert.match(reopened.reason, /2026-10-28/);
  assert.equal(draftIsCurrent(state, draft), false);
  assert.throws(() => simulateDelivery(state, draft.id, draft.revision), errorStatus(422, "stale"));
});
