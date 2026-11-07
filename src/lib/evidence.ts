import { createHash } from "node:crypto";
import { canonicalDonorId, getMetrics, getQueue } from "./domain";
import type { DemoState, Draft } from "./types";

/** Canonical object-key order. Array order is meaningful, and must not be sorted. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
export const digest = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex");
type DraftTarget = Pick<Draft, "kind" | "queueItemId" | "grantId">;

/** Only relevant record dependencies. Counseling bodies never enter report evidence. */
export function draftSourceFingerprint(state: DemoState, target: DraftTarget): string {
  const task = target.kind === "followup" ? getQueue(state).find(item => item.id === target.queueItemId) : undefined;
  const metrics = target.kind === "followup" ? [] : getMetrics(state);
  const grant = target.kind === "application" ? state.grants.find(item => item.id === target.grantId) : undefined;
  const sourceIds = [...new Set(task ? task.sourceIds : [...metrics.flatMap(metric => metric.sourceIds), ...(grant?.sourceIds ?? [])])].sort();
  let recipient: unknown;
  if (task?.kind === "attendance") {
    const person = state.participants.find(person => person.id === task.entityId);
    recipient = person && { id: person.id, name: person.name, guardian: person.guardian, mentor: person.mentor };
  } else if (task) {
    const person = state.donors.find(person => person.id === canonicalDonorId(state, task.entityId));
    recipient = person && { id: person.id, name: person.name, emails: person.emails, phone: person.phone, cadence: person.cadence, expectedAt: person.expectedAt };
  }
  return digest({
    kind: target.kind,
    asOf: state.asOf,
    period: target.kind === "followup" ? undefined : state.period,
    metrics,
    task: task ? { id: task.id, entityId: task.entityId, kind: task.kind, name: task.name, reason: task.reason, suggestedAction: task.suggestedAction, sourceIds: task.sourceIds } : null,
    recipient,
    grant: grant ? { id: grant.id, name: grant.name, applicationQuestion: grant.applicationQuestion, wordLimit: grant.wordLimit, sourceIds: grant.sourceIds } : null,
    sources: sourceIds.map(id => state.sources.find(source => source.id === id) ?? { id, missing: true }),
  });
}

export function draftIsCurrent(state: DemoState, draft: Draft): boolean {
  return draft.sourceFingerprint ? draftSourceFingerprint(state, draft) === draft.sourceFingerprint : draft.dataRevision === state.revision;
}

/** Binds an approval to exact content, evidence, kind and revision, not just a boolean. */
export function draftApprovalDigest(draft: Draft): string {
  return digest({ id: draft.id, kind: draft.kind, queueItemId: draft.queueItemId, grantId: draft.grantId, title: draft.title, narrative: draft.narrative,
    claims: draft.claims, sourceIds: draft.sourceIds, sourceFingerprint: draft.sourceFingerprint, dataRevision: draft.sourceFingerprint ? undefined : draft.dataRevision, revision: draft.revision });
}
