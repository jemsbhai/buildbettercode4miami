import { randomUUID } from "node:crypto";
import { getMetrics, getQueue, renderDraft, validateDraft } from "./domain";
import { getGrantLedgers, renderApplicationAnswer, validateApplication } from "./programs";
import type { Dashboard, DemoState, Draft, OutboxMessage, ValidationIssue } from "./types";

export class AppError extends Error {
  constructor(message: string, public status = 400, public issues?: ValidationIssue[]) { super(message); }
}

export function dashboard(state: DemoState): Dashboard {
  return {
    state: { ...state, notes: state.notes.map(({ id, familyCode, grantId, payable, date, counselor }) => ({ id, familyCode, grantId, payable, date, counselor })) },
    metrics: getMetrics(state), queue: getQueue(state),
    liveAvailable: Boolean(process.env.OPENAI_API_KEY), ledgers: getGrantLedgers(state),
  };
}

export function findDraft(state: DemoState, id: string) {
  const draft = state.drafts.find(item => item.id === id);
  if (!draft) throw new AppError("Draft not found.", 404);
  return draft;
}

export function checkDraft(state: DemoState, draft: Draft) {
  return [...validateDraft(state, draft), ...(draft.kind === "application" ? validateApplication(state, draft) : [])];
}

export function editDraft(state: DemoState, id: string, edit: { revision: number; narrative?: string; claims?: Draft["claims"] }) {
  const draft = findDraft(state, id);
  if (draft.revision !== edit.revision) throw new AppError("This draft changed. Refresh before editing.", 409);
  if (edit.narrative === undefined && edit.claims === undefined) return draft;
  if (edit.narrative !== undefined) draft.narrative = edit.narrative;
  if (edit.claims !== undefined) draft.claims = edit.claims;
  draft.revision += 1;
  draft.status = "pending";
  delete draft.approvedAt;
  // A data change requires regeneration so updated values cannot launder a stale evidence snapshot.
  state.audit.push({ id: randomUUID(), at: new Date().toISOString(), action: "draft_edited", detail: `${draft.title}; revision ${draft.revision}. Previous approval invalidated.`, sourceIds: draft.sourceIds });
  return draft;
}

export function approveDraft(state: DemoState, id: string, revision: number) {
  const draft = findDraft(state, id);
  if (draft.revision !== revision) throw new AppError("This draft changed. Review the current revision.", 409);
  const issues = checkDraft(state, draft);
  if (issues.length) throw new AppError("Approval blocked. Correct the flagged facts or regenerate a stale draft.", 422, issues);
  if (draft.status === "approved") return draft;
  draft.status = "approved";
  draft.approvedAt = new Date().toISOString();
  state.audit.push({ id: randomUUID(), at: draft.approvedAt, action: "draft_approved", detail: `Staff approved ${draft.title}, revision ${draft.revision}, with its exact fact sheet.`, sourceIds: draft.sourceIds });
  return draft;
}

export function exportDraft(state: DemoState, id: string) {
  const draft = findDraft(state, id);
  if (draft.status !== "approved") throw new AppError("Approve this exact draft before exporting.", 409);
  const issues = checkDraft(state, draft);
  if (issues.length) throw new AppError("Approved draft is no longer valid. Regenerate and review.", 422, issues);
  return draft.kind === "application" ? renderApplicationAnswer(state, draft) : renderDraft(state, draft);
}

export function simulateDelivery(state: DemoState, id: string, revision: number): OutboxMessage {
  const draft = findDraft(state, id);
  if (draft.kind !== "followup") throw new AppError("Only follow-up messages can enter the outbox.");
  if (draft.revision !== revision) throw new AppError("Review the current revision before delivery.", 409);
  const body = exportDraft(state, id);
  const prior = state.outbox.find(message => message.draftId === id && message.draftRevision === revision);
  if (prior) return prior;
  const task = getQueue(state).find(item => item.id === draft.queueItemId);
  if (!task) throw new AppError("The follow-up is no longer current.", 409);
  const message: OutboxMessage = { id: randomUUID(), draftId: id, draftRevision: revision, recipient: task.name, body, sentAt: new Date().toISOString(), transport: "simulation", status: "simulated_sent" };
  state.outbox.push(message);
  state.audit.push({ id: randomUUID(), at: message.sentAt, action: "simulated_delivery", detail: `Simulated delivery to ${task.name}. No external email or SMS was sent.`, sourceIds: draft.sourceIds });
  return message;
}
