import { createHash, randomUUID } from "node:crypto";
import { getMetrics } from "./domain";
import type { CounselingNote, DemoState, Disclosure, Draft, Grant, GrantLedger, SourceRow, ValidationIssue } from "./types";

export const SAFE_NOTE_FIELDS = ["familyCode", "date", "service", "durationMinutes", "goal", "progress"] as const;
const safeFields = new Set<string>(SAFE_NOTE_FIELDS);
const seededAt = "2026-09-30T09:00:00.000Z";

/** Fictional, deterministic one-grant and one-week fixture. No private note text in provenance. */
export function addProgramSeed(state: DemoState): void {
  state.grants = [];
  state.expenses = [];
  state.notes = [];
  state.disclosures = [];
  state.outbox = [];
  const counts: Record<string, number> = {};
  function source(id: string, filename: string, values: SourceRow["values"]): string[] {
    counts[filename] = (counts[filename] ?? 1) + 1;
    state.sources.push({ id, source: filename, row: counts[filename], values, importedAt: seededAt });
    return [id];
  }
  const grant: Grant = {
    id: "grant-family-support", name: "Baylight Family Support Fund",
    fiscalStart: "2026-07-01", fiscalEnd: "2027-06-30",
    applicationQuestion: "Describe how your mentoring and family-support program meets local needs, using approved program facts.",
    wordLimit: 120,
    categories: [
      { name: "personnel", budgetCents: 1_000_000 },
      { name: "materials", budgetCents: 200_000 },
      { name: "transport", budgetCents: 100_000 },
    ],
    allowedNoteFields: [...SAFE_NOTE_FIELDS],
    sourceIds: source("src-grant-family-support", "funder-policy.csv", {
      grant_id: "grant-family-support", name: "Baylight Family Support Fund", fiscal_start: "2026-07-01", fiscal_end: "2027-06-30", word_limit: 120,
      permitted_categories: "personnel;materials;transport", required_note_fields: SAFE_NOTE_FIELDS.join(";"),
      personnel_budget_cents: 1_000_000, materials_budget_cents: 200_000, transport_budget_cents: 100_000,
    }),
  };
  state.grants.push(grant);
  const expenses = [
    { id: "expense-personnel-july", category: "personnel", amountCents: 500_000, date: "2026-07-01", description: "Fictional program staffing at the fiscal-year start" },
    { id: "expense-personnel-september", category: "personnel", amountCents: 550_000, date: "2026-09-20", description: "Fictional program staffing" },
    { id: "expense-materials", category: "materials", amountCents: 180_000, date: "2026-09-15", description: "Fictional family activity materials" },
    { id: "expense-transport", category: "transport", amountCents: 35_000, date: "2026-09-18", description: "Fictional participant transport" },
    { id: "expense-disallowed", category: "entertainment", amountCents: 4_500, date: "2026-09-19", description: "Flag for bookkeeper review: category not allowed by this funder" },
    { id: "expense-before-year", category: "materials", amountCents: 33_300, date: "2026-06-30", description: "Prior funder year; excluded from this ledger" },
    { id: "expense-after-year", category: "transport", amountCents: 44_400, date: "2027-07-01", description: "Next funder year; excluded from this ledger" },
  ];
  for (const expense of expenses) {
    state.expenses.push({ ...expense, grantId: grant.id, sourceIds: source(`src-${expense.id}`, "grant-expenses.csv", {
      expense_id: expense.id, grant_id: grant.id, category: expense.category, amount_cents: expense.amountCents, date: expense.date, description: expense.description,
    }) });
  }
  for (let day = 0; day < 5; day++) {
    for (let session = 0; session < 5; session++) {
      const index = day * 5 + session + 1;
      const id = `note-${String(index).padStart(2, "0")}`;
      const date = `2026-09-${21 + day}`;
      const familyCode = `FAM-${String(session + 1).padStart(3, "0")}`;
      const payable = index !== 25;
      state.notes.push({
        id, familyCode, grantId: grant.id, payable, date, counselor: "Reginald Martin",
        service: "Family support session", durationMinutes: 45,
        goal: "Practice a shared family check-in routine.",
        progress: "Family practiced the routine and identified a follow-up activity.",
        privateDetail: index === 1 ? "PRIVATE_SENTINEL: Fictional family member asked that a sensitive household concern stay in the internal note." : "Fictional confidential context retained only in the internal counseling note.",
        sourceIds: source(`src-${id}`, "counseling-session-index.csv", {
          note_id: id, family_code: familyCode, grant_id: grant.id, date, payable, counselor: "Reginald Martin",
        }),
      });
    }
  }
}

export function getGrantLedgers(state: DemoState): GrantLedger[] {
  return state.grants.map((grant) => {
    const expenses = state.expenses.filter((expense) => expense.grantId === grant.id);
    const inside = expenses.filter((expense) => expense.date >= grant.fiscalStart && expense.date <= grant.fiscalEnd);
    const names = new Set(grant.categories.map((category) => category.name));
    return {
      grantId: grant.id, fiscalStart: grant.fiscalStart, fiscalEnd: grant.fiscalEnd,
      categories: grant.categories.map((category) => {
        const matching = inside.filter((expense) => expense.category === category.name);
        const spentCents = matching.reduce((sum, expense) => sum + expense.amountCents, 0);
        return { ...category, spentCents, remainingCents: category.budgetCents - spentCents,
          status: spentCents > category.budgetCents ? "over_budget" as const : spentCents >= category.budgetCents * 0.9 ? "near_limit" as const : "within_budget" as const,
          sourceIds: [...new Set([...grant.sourceIds, ...matching.flatMap((expense) => expense.sourceIds)])],
        };
      }),
      disallowed: inside.filter((expense) => !names.has(expense.category)),
      outsidePeriod: expenses.filter((expense) => expense.date < grant.fiscalStart || expense.date > grant.fiscalEnd),
    };
  });
}

function audit(state: DemoState, action: string, detail: string, sourceIds: string[]): void {
  state.audit.push({ id: `audit-${randomUUID()}`, at: new Date().toISOString(), action, detail, sourceIds: [...new Set(sourceIds)] });
}

function findNote(state: DemoState, id: string): CounselingNote {
  const note = state.notes.find((item) => item.id === id);
  if (!note) throw new Error("Counseling note not found");
  return note;
}

function noteAccess(state: DemoState, note: CounselingNote, purpose: string): void {
  audit(state, "note.accessed", `${note.id} opened for ${purpose}. Demo actor: counselor.`, note.sourceIds);
}

export function getNote(state: DemoState, id: string): CounselingNote {
  const note = findNote(state, id);
  noteAccess(state, note, "internal review");
  return structuredClone(note);
}

export function saveNote(state: DemoState, id: string, patch: { goal: string; progress: string; privateDetail: string; durationMinutes: number }): CounselingNote {
  const note = findNote(state, id);
  if (!patch || typeof patch !== "object") throw new Error("A complete note edit is required");
  for (const [field, limit] of [["goal", 2000], ["progress", 4000], ["privateDetail", 8000]] as const) {
    const value = patch[field];
    if (typeof value !== "string" || value.length > limit || (field !== "privateDetail" && !value.trim())) throw new Error(`${field} must be text within ${limit} characters${field === "privateDetail" ? "" : " and cannot be empty"}`);
  }
  if (!Number.isSafeInteger(patch.durationMinutes) || patch.durationMinutes <= 0 || patch.durationMinutes > 480) throw new Error("Session duration must be a whole number from 1 to 480 minutes");
  note.goal = patch.goal.trim();
  note.progress = patch.progress.trim();
  note.privateDetail = patch.privateDetail.trim();
  note.durationMinutes = patch.durationMinutes;
  state.revision++;
  const sourceId = `src-note-edit-${randomUUID()}`;
  const filename = "counseling-note-edits.csv";
  state.sources.push({ id: sourceId, source: filename, row: state.sources.filter((source) => source.source === filename).length + 2,
    values: { note_id: note.id, family_code: note.familyCode, changed_fields: "goal;progress;privateDetail;durationMinutes", record_revision: state.revision }, importedAt: new Date().toISOString() });
  note.sourceIds = [...note.sourceIds, sourceId];
  noteAccess(state, note, "internal editing");
  audit(state, "note.saved", `${note.id}: internal note saved once; prior previews require regeneration. Private text remains in the internal record.`, note.sourceIds);
  return structuredClone(note);
}

function disclosureParts(state: DemoState, noteId: string, grantId: string) {
  const note = findNote(state, noteId);
  const grant = state.grants.find((item) => item.id === grantId);
  if (!grant) throw new Error("Funder not found");
  if (note.grantId !== grant.id) throw new Error("This session does not belong to the selected funder");
  if (!note.payable) throw new Error("This session is not funder-payable and cannot enter a funder copy");
  if (note.date < grant.fiscalStart || note.date > grant.fiscalEnd) throw new Error("Session falls outside the selected funder's fiscal year");
  if (!grant.allowedNoteFields.length || grant.allowedNoteFields.some((field) => !safeFields.has(field)) || new Set(grant.allowedNoteFields).size !== grant.allowedNoteFields.length) {
    throw new Error("Funder policy contains unsupported or duplicate note fields; private fields cannot be disclosed");
  }
  const payload: Record<string, string | number> = {};
  for (const field of [...grant.allowedNoteFields].sort()) {
    const value = note[field as keyof CounselingNote];
    if (typeof value !== "string" && typeof value !== "number") throw new Error("Required funder field is missing or has an invalid type");
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Required funder field has an invalid number");
    payload[field] = value;
  }
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { note, grant, payload, payloadHash, excludedFields: Object.keys(note).filter((field) => !grant.allowedNoteFields.includes(field)).sort() };
}

export function createDisclosure(state: DemoState, noteId: string, grantId: string): Disclosure {
  const parts = disclosureParts(state, noteId, grantId);
  const disclosure: Disclosure = {
    id: `disclosure-${randomUUID()}`, noteId, grantId, payload: parts.payload, payloadHash: parts.payloadHash,
    excludedFields: parts.excludedFields, status: "pending", createdAt: new Date().toISOString(), dataRevision: state.revision,
  };
  noteAccess(state, parts.note, "funder preview");
  state.disclosures.push(disclosure);
  audit(state, "disclosure.previewed", `${disclosure.id}: required-field payload prepared; private text was not copied.`, [...parts.note.sourceIds, ...parts.grant.sourceIds]);
  return structuredClone(disclosure);
}

function verifyDisclosure(state: DemoState, id: string) {
  const disclosure = state.disclosures.find((item) => item.id === id);
  if (!disclosure) throw new Error("Disclosure not found");
  if (disclosure.dataRevision !== state.revision) throw new Error("Records changed after this preview; create and review a fresh disclosure");
  const parts = disclosureParts(state, disclosure.noteId, disclosure.grantId);
  const storedPayload = Object.fromEntries(Object.entries(disclosure.payload).sort(([a], [b]) => a.localeCompare(b)));
  const storedHash = createHash("sha256").update(JSON.stringify(storedPayload)).digest("hex");
  if (parts.payloadHash !== disclosure.payloadHash || storedHash !== disclosure.payloadHash) throw new Error("Note, policy or preview changed; create and review a fresh disclosure");
  return { disclosure, parts };
}

export function approveDisclosure(state: DemoState, id: string, payloadHash: string): Disclosure {
  const { disclosure, parts } = verifyDisclosure(state, id);
  if (payloadHash !== disclosure.payloadHash) throw new Error("Preview hash does not match; approve the exact payload shown to the counselor");
  if (disclosure.status !== "pending") throw new Error("Disclosure has already been approved");
  disclosure.status = "approved";
  disclosure.approvedAt = new Date().toISOString();
  noteAccess(state, parts.note, "funder-copy approval");
  audit(state, "disclosure.approved", `${disclosure.id}: counselor approved payload ${disclosure.payloadHash}. No external delivery occurred.`, [...parts.note.sourceIds, ...parts.grant.sourceIds]);
  return structuredClone(disclosure);
}

/** Call inside mutateState so the access/export audit is durably saved. */
export function exportDisclosure(state: DemoState, id: string): Record<string, string | number> {
  const { disclosure, parts } = verifyDisclosure(state, id);
  if (disclosure.status !== "approved") throw new Error("Counselor approval is required before export");
  noteAccess(state, parts.note, "approved funder-copy export");
  audit(state, "disclosure.exported", `${disclosure.id}: approved payload exported. No external delivery occurred.`, [...parts.note.sourceIds, ...parts.grant.sourceIds]);
  return structuredClone(parts.payload);
}

/** Only the submitted answer: narrative plus rendered claim lines, excluding UI/source metadata. */
export function renderApplicationAnswer(state: DemoState, draft: Draft): string {
  const metrics = getMetrics(state);
  const claims = draft.claims.map((claim) => {
    const metric = metrics.find((item) => item.id === claim.metricId);
    const value = metric?.unit === "USD"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(claim.value)
      : `${claim.value} ${metric?.unit ?? ""}`.trim();
    return `${metric?.label ?? claim.metricId}: ${value}`;
  });
  return [draft.narrative.trim(), ...claims].filter(Boolean).join("\n");
}

export function applicationWordCount(state: DemoState, draft: Draft): number {
  const answer = renderApplicationAnswer(state, draft).trim();
  return answer ? answer.split(/\s+/u).length : 0;
}

/** Compose with validateDraft: this validator owns grant rules, not metric correctness. */
export function validateApplication(state: DemoState, draft: Draft): ValidationIssue[] {
  if (draft.kind !== "application") return [];
  const grant = state.grants.find((item) => item.id === draft.grantId);
  if (!grant) return [{ code: "grant", message: "Select a valid funder before reviewing the application." }];
  const issues: ValidationIssue[] = [];
  const count = applicationWordCount(state, draft);
  if (count > grant.wordLimit) issues.push({ code: "application_word_limit", message: `Full application answer is ${count} words; ${grant.name} allows ${grant.wordLimit}. The count includes rendered verified figures.` });
  if (!draft.claims.length) issues.push({ code: "application_facts", message: "Include at least one source-backed program figure in the application." });
  if (grant.sourceIds.some((id) => !draft.sourceIds.includes(id))) issues.push({ code: "application_policy", message: "Include the funder's question and policy source in the application's evidence." });
  return issues;
}
