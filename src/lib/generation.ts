import { randomUUID } from "node:crypto";
import { DraftGenerationError, prepareDraft, type DraftRequest } from "./agent";
import { getQueue } from "./domain";
import { digest, draftIsCurrent } from "./evidence";
import { AppError, checkDraft, dashboard, presentDraft } from "./service";
import { mutateState } from "./store";
import type { AgentRun, DemoState, GenerationJob } from "./types";

const LIVE_LIMIT = 12;
const LEASE_MS = 90_000; // The model's shared deadline is 45 seconds.
type Prepare = typeof prepareDraft;

function validateTarget(state: DemoState, input: DraftRequest) {
  if (!["live", "demo"].includes(input.mode) || !["report", "followup", "application"].includes(input.kind)) throw new AppError("Invalid draft request.");
  if (input.kind === "followup" && (!input.queueItemId || !getQueue(state).some(task => task.id === input.queueItemId))) throw new AppError("Select a current follow-up task.", 404);
  if (input.kind === "application" && (!input.grantId || !state.grants.some(grant => grant.id === input.grantId))) throw new AppError("Select a valid funder.", 404);
  if ((input.kind !== "followup" && input.queueItemId) || (input.kind !== "application" && input.grantId)) throw new AppError("This draft type does not accept that target.");
}

function stampRun(run: AgentRun): AgentRun {
  return { ...run, inputHash: run.inputSnapshot === undefined ? undefined : digest(run.inputSnapshot), outputHash: run.outputSnapshot === undefined ? undefined : digest(run.outputSnapshot) };
}

function interruptedRun(job: GenerationJob, expired = false): AgentRun {
  return { id: randomUUID(), mode: job.mode, status: "failed", model: job.mode === "live" ? process.env.OPENAI_MODEL || "gpt-5.4-mini" : "deterministic-template",
    events: [{ id: randomUUID(), at: new Date().toISOString(), action: "run_interrupted", detail: expired ? "The saved generation lease expired before a result was committed. Provider usage is unknown. No draft was saved." : "Generation stopped before a result was returned. Provider usage is unknown. No draft was saved.", sourceIds: [] }],
    inputTokens: 0, outputTokens: 0, usageKnown: false, maxTurns: 3, durationMs: Math.max(0, Date.now() - Date.parse(job.startedAt)) };
}

function expireJobs(state: DemoState) {
  for (const job of state.generationJobs ?? []) {
    if (job.status === "running" && Date.parse(job.leaseExpiresAt) <= Date.now()) {
      const run = interruptedRun(job, true);
      job.status = "failed"; job.error = "The earlier attempt was interrupted. Use a new request key to retry."; job.runId = run.id;
      state.runs.unshift(run);
    }
  }
}

export function assertResetAllowed(state: DemoState) {
  if (state.generationJobs?.some(job => job.status === "running" && Date.parse(job.leaseExpiresAt) > Date.now())) throw new AppError("Wait for the active draft before resetting.", 409);
}

/** Durable reservations protect double clicks, retries and restarts in the single-process demo. */
export async function generateDraft(input: DraftRequest, requestId?: string, prepare: Prepare = prepareDraft) {
  if (requestId !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/u.test(requestId)) throw new AppError("Idempotency-Key must contain 1–128 letters, digits, dots, underscores, colons or hyphens.");
  // Recovery must persist even when the new request is rejected or reuses the expired key.
  mutateState(expireJobs);
  const reservation = mutateState(state => {
    const jobs = state.generationJobs ??= [];
    const fingerprint = digest(input);
    const previous = requestId ? jobs.find(job => job.requestId === requestId) : undefined;
    if (previous) {
      if (previous.requestFingerprint !== fingerprint) throw new AppError("This request key belongs to a different draft request.", 409);
      if (previous.status === "running") throw new AppError("This draft is still running. Retry with the same key shortly.", 409);
      if (previous.status === "failed") throw new AppError(previous.error || "This attempt failed. Use a new request key to retry.", 409);
      const draft = state.drafts.find(draft => draft.id === previous.draftId);
      if (!draft) throw new AppError("The saved result is unavailable. Use a new request key.", 409);
      return { cached: { draft: presentDraft(state, draft), dashboard: dashboard(state), replayed: true } };
    }
    validateTarget(state, input);
    if (jobs.some(job => job.status === "running")) throw new AppError("A draft is already running. Please wait.", 409);
    const represented = new Set(jobs.map(job => job.runId).filter(Boolean));
    const liveAttempts = jobs.filter(job => job.mode === "live").length + state.runs.filter(run => run.mode === "live" && !represented.has(run.id)).length;
    if (input.mode === "live" && liveAttempts >= LIVE_LIMIT) throw new AppError("This demo session has reached its twelve live-run limit. Use demo mode.", 429);
    const now = Date.now();
    const job: GenerationJob = { id: randomUUID(), requestId, requestFingerprint: fingerprint, mode: input.mode, status: "running", startedAt: new Date(now).toISOString(), leaseExpiresAt: new Date(now + LEASE_MS).toISOString() };
    jobs.push(job);
    return { jobId: job.id, snapshot: structuredClone(state) };
  });
  if (reservation.cached) return reservation.cached;
  const { jobId, snapshot } = reservation;
  let completedRun: AgentRun | undefined;
  try {
    const prepared = await prepare(snapshot!, input);
    completedRun = prepared.run;
    return mutateState(state => {
      const job = state.generationJobs?.find(job => job.id === jobId);
      if (!job || job.status !== "running" || Date.parse(job.leaseExpiresAt) <= Date.now()) throw new AppError("This draft reservation expired. Generate a fresh draft.", 409);
      if (!draftIsCurrent(state, prepared.draft)) throw new AppError("The evidence changed during drafting. Generate a fresh draft.", 409);
      const issues = checkDraft(state, prepared.draft);
      if (issues.length) throw new AppError("The generated draft did not pass the final evidence check.", 422, issues);
      state.drafts.unshift(prepared.draft);
      state.runs.unshift(stampRun(prepared.run));
      job.status = "completed"; job.draftId = prepared.draft.id; job.runId = prepared.run.id;
      return { draft: presentDraft(state, prepared.draft), dashboard: dashboard(state), replayed: false };
    });
  } catch (error) {
    const failed = error instanceof DraftGenerationError ? error.run : completedRun;
    const safeError = error instanceof AppError ? error : new AppError(error instanceof DraftGenerationError ? error.message : "Draft generation could not finish. Retry or use demo mode. No draft was approved.", 502, error instanceof DraftGenerationError ? error.issues : undefined);
    mutateState(state => {
      const job = state.generationJobs?.find(job => job.id === jobId);
      if (!job || job.status !== "running") return;
      const run = failed ? structuredClone(failed) : interruptedRun(job);
      run.status = "failed";
      run.events.push({ id: randomUUID(), at: new Date().toISOString(), action: "draft_not_saved", detail: safeError.message, sourceIds: [] });
      state.runs.unshift(stampRun(run));
      job.status = "failed"; job.error = safeError.message; job.runId = run.id;
    });
    throw safeError;
  }
}

/** Read the recorded inputs/output without another model request or side effect. */
export function replayRun(state: DemoState, id: string) {
  const run = state.runs.find(run => run.id === id);
  if (!run) throw new AppError("Run not found.", 404);
  if ((run.inputHash && run.inputHash !== digest(run.inputSnapshot)) || (run.outputHash && run.outputHash !== digest(run.outputSnapshot))) throw new AppError("The saved run content no longer matches its recorded digest.", 409);
  const draft = state.drafts.find(draft => draft.runId === id);
  return { run, replay: "recorded" as const, integrity: { input: run.inputHash ? "verified" : "unavailable", output: run.outputHash ? "verified" : "unavailable" }, draftId: draft?.id ?? null, evidenceCurrent: draft ? draftIsCurrent(state, draft) : null };
}
