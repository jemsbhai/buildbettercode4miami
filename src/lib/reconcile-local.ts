import { createServer, type IncomingMessage } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { applyCorrectionPlan, buildCorrectionPlan, scanWorkbooks, isSensitiveLabel } from "./reconcile";
import { createGoogleSheetsClient, createCorrectionCopies, type CopyJournal, type GoogleSheetsClient } from "./reconcile-google";
import { createAiPreview, LocalByok } from "./reconcile-ai";
import { demoWorkbooks } from "./reconcile-demo";
import { RECONCILE_FIELDS, type WorkbookSnapshot, type ScanReport, type CorrectionPlan } from "./reconcile-types";

type SavedScan = { report: ScanReport; workbooks: WorkbookSnapshot[]; createdAt: string };
type Operation = { id: string; planId: string; requestId: string; journal?: CopyJournal; createdAt: string };
type LocalState = { format: 1; demo: boolean; accountFingerprint?: string; scans: SavedScan[]; plans: CorrectionPlan[]; operations: Operation[] };
const field = z.enum(RECONCILE_FIELDS);
const optionsSchema = z.object({ tabs: z.array(z.object({ workbookId: z.string().min(1).max(200), sheetId: z.number().int().nonnegative(), mapping: z.partialRecord(field, z.number().int().min(0).max(255).nullable()).optional(), requiredFields: z.array(field).max(10).optional(), amountUnit: z.enum(["dollars", "cents"]).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), dateOrder: z.enum(["MDY", "DMY"]).optional() }).strict()).max(200).optional() }).strict();
const scanSchema = z.object({ workbookIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,200}$/)).min(1).max(20), broadScan: z.boolean(), confirmNonSensitive: z.literal(true), options: optionsSchema.optional() }).strict();
const applySchema = z.object({ approved: z.literal(true), requestId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/) }).strict();

class HttpError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
async function writeState(path: string, state: LocalState) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, path);
}
async function readState(path: string, demo: boolean): Promise<LocalState> {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    if (state.format !== 1 || state.demo !== demo || !Array.isArray(state.scans) || !Array.isArray(state.plans) || !Array.isArray(state.operations)) throw new Error("Invalid or mismatched local journal. Choose a separate data file for demo and Google modes.");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { format: 1, demo, scans: [], plans: [], operations: [] };
    throw error;
  }
}
function sameSecret(a: string, b: string) { return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest()); }
async function jsonBody(request: IncomingMessage): Promise<unknown> {
  if (!(request.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError("Use application/json.", 415);
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > 128_000) throw new HttpError("Request exceeds 128 KB.", 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError("Invalid JSON."); }
}
function sanitize(workbooks: WorkbookSnapshot[]) {
  return workbooks.map(book => ({ ...book, tabs: book.tabs.map(tab => {
    if (isSensitiveLabel(book.name) || isSensitiveLabel(tab.title) || tab.excluded) return { ...tab, rows: [], excluded: "Private or counseling tab excluded." };
    const excludedColumns = tab.rows[0]?.flatMap((cell, i) => isSensitiveLabel(String(cell.value ?? "")) ? [i] : []) ?? [];
    const excluded = new Set([...(tab.excludedColumns ?? []), ...excludedColumns]);
    return { ...tab, excludedColumns: [...excluded], rows: tab.rows.map(row => row.map((cell, i) => excluded.has(i) ? { value: null } : cell)) };
  }) }));
}

export type LocalServiceOptions = { extensionId: string; token: string; statePath: string; demo?: boolean; ai?: LocalByok; googleFactory?: (token: string) => GoogleSheetsClient };
export async function createLocalService(config: LocalServiceOptions) {
  if (!/^[a-p]{32}$/.test(config.extensionId)) throw new Error("A valid Chrome extension ID is required.");
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(config.token)) throw new Error("A strong pairing token is required.");
  const demo = config.demo === true;
  const state = await readState(config.statePath, demo);
  const ai = config.ai ?? new LocalByok();
  let google: GoogleSheetsClient | undefined;
  let workQueue = Promise.resolve();
  const handlers = new Set<Promise<void>>();
  let stopping = false, httpClosed = false;
  let shutdownPromise: Promise<void> | undefined;
  const jobs = new Map<string, { jobId: string; status: "running" | "completed" | "failed"; result?: unknown; error?: string; httpStatus?: number }>();
  const checkpoint = () => writeState(config.statePath, state);
  const getGoogle = () => { if (!google) throw new HttpError("Connect Google first; expired access requires reconnecting.", 401); return google; };
  const getScan = (id: string) => { const scan = state.scans.find(s => s.report.id === id); if (!scan) throw new HttpError("Scan not found. Run a fresh scan.", 404); return scan; };
  const getPlan = (id: string) => { const plan = state.plans.find(p => p.id === id); if (!plan) throw new HttpError("Plan not found. Review findings again.", 404); return plan; };
  const presentOperation = (operation: Operation) => ({ ...operation.journal, id: operation.id, planId: operation.planId, requestId: operation.requestId, createdAt: operation.createdAt, status: operation.journal?.status ?? "pending", entries: operation.journal?.entries ?? [] });
  async function execute(operation: Operation) {
    const plan = getPlan(operation.planId), scan = getScan(plan.scanId);
    const all = applyCorrectionPlan(scan.workbooks, plan);
    const changed = all.filter(book => plan.workbookIds.includes(book.id));
    if (!changed.length) throw new HttpError("Select at least one proposed correction.");
    if (demo) {
      operation.journal = { operationId: operation.id, fingerprint: plan.id, status: "complete", entries: changed.map(book => ({ sourceId: book.id, sourceVersion: book.version, name: `DEMO correction: ${book.name}`, status: "verified", copyId: `demo-copy-${operation.id}-${book.id}`, message: "Verified in local fictional state. No Google file was created." })) };
      await checkpoint();
    } else {
      operation.journal = await createCorrectionCopies(getGoogle(), { operationId: operation.id, snapshots: changed, sourceVersions: scan.workbooks.map(book => ({ id: book.id, version: book.version })), journal: operation.journal, checkpoint: async journal => { operation.journal = journal; await checkpoint(); } });
      await checkpoint();
    }
    return presentOperation(operation);
  }
  async function route(method: string, url: URL, request: IncomingMessage, parsedBody?: unknown) {
    const path = url.pathname;
    const bodyJson = () => parsedBody === undefined ? jsonBody(request) : Promise.resolve(parsedBody);
    if (method === "GET" && path === "/v1/status") return { service: "tidepath-local", demo, googleConnected: demo || Boolean(google), ai: ai.status(), limits: { maxWorkbooks: 20 }, ownerCost: "none" };
    if (method === "POST" && path === "/v1/google") {
      const { accessToken } = z.object({ accessToken: z.string().min(10).max(4096).regex(/^[A-Za-z0-9._~+\/-]+=*$/) }).strict().parse(await bodyJson());
      if (!demo) {
        const next = (config.googleFactory ?? (token => createGoogleSheetsClient({ accessToken: token })))(accessToken);
        const identity = await next.getAccountIdentity();
        if (state.accountFingerprint && state.accountFingerprint !== identity) throw new HttpError("This journal belongs to a different Google account. Start the companion with a separate --data-file.", 409);
        if (!state.accountFingerprint && (state.scans.length || state.operations.length)) throw new HttpError("This legacy journal has no account binding. Use a new --data-file; old approvals cannot be reused.", 409);
        state.accountFingerprint = identity; await checkpoint(); google = next;
      }
      return { connected: true };
    }
    if (method === "DELETE" && path === "/v1/google") { google = undefined; return { connected: false }; }
    if (method === "DELETE" && path === "/v1/ai/key") { ai.removeKey(); return ai.status(); }
    // Saved snapshots and approvals remain private to the account that created the journal.
    if (!demo) getGoogle();
    if (method === "GET" && path === "/v1/workbooks") {
      if (demo) return { files: demoWorkbooks().map(({ id, name }) => ({ id, name })), complete: true };
      const result = await getGoogle().discoverWorkbooks(); return { files: result.workbooks, complete: result.complete };
    }
    if (method === "POST" && path === "/v1/scans") {
      const body = scanSchema.parse(await bodyJson());
      if (new Set(body.workbookIds).size !== body.workbookIds.length) throw new HttpError("Select each workbook once.");
      if (body.workbookIds.length > 1 && !body.broadScan) throw new HttpError("Explicit broad-scan opt-in is required for multiple workbooks.");
      if (state.scans.length >= 100) throw new HttpError("This local data file reached its 100-scan limit. Archive it and start a new local data file.", 429);
      let books: WorkbookSnapshot[];
      if (demo) {
        books = demoWorkbooks().filter(book => body.workbookIds.includes(book.id));
        if (books.length !== body.workbookIds.length) throw new HttpError("Unknown fictional workbook.");
      } else books = await getGoogle().readWorkbooks(body.workbookIds);
      books = sanitize(books);
      const report = scanWorkbooks(books, body.options);
      if (!state.scans.some(s => s.report.id === report.id)) state.scans.push({ report, workbooks: books, createdAt: new Date().toISOString() });
      await checkpoint(); return report;
    }
    const scanMatch = path.match(/^\/v1\/scans\/([A-Za-z0-9_-]+)(?:\/(plan|ai-preview|ai))?$/);
    if (scanMatch) {
      const scan = getScan(scanMatch[1]);
      if (method === "GET" && !scanMatch[2]) return scan.report;
      if (method === "POST" && scanMatch[2] === "plan") {
        const { findingIds } = z.object({ findingIds: z.array(z.string().max(150)).min(1).max(2000) }).strict().parse(await bodyJson());
        const plan = buildCorrectionPlan(scan.workbooks, scan.report, findingIds);
        if (!state.plans.some(p => p.id === plan.id)) state.plans.push(plan);
        await checkpoint(); return plan;
      }
      if (method === "GET" && scanMatch[2] === "ai-preview") return createAiPreview(scan.report, ai.model);
      if (method === "POST" && scanMatch[2] === "ai") {
        const body = z.object({ enabled: z.literal(true), approvedPayloadHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(await bodyJson());
        if (demo) throw new HttpError("AI calls are disabled in fixture rehearsal mode. No provider request was sent.");
        return ai.explain(scan.report, body);
      }
    }
    const applyMatch = path.match(/^\/v1\/plans\/([A-Za-z0-9_-]+)\/apply$/);
    if (method === "POST" && applyMatch) {
      const body = applySchema.parse(await bodyJson()); getPlan(applyMatch[1]);
      const prior = state.operations.find(o => o.requestId === body.requestId);
      if (prior && prior.planId !== applyMatch[1]) throw new HttpError("This request ID already belongs to another plan.", 409);
      if (prior) return presentOperation(prior); // Explicit retry endpoint handles interrupted operations.
      const samePlan = state.operations.find(o => o.planId === applyMatch[1]);
      if (samePlan) return presentOperation(samePlan); // Fresh IDs cannot duplicate an approved plan's copies.
      const operation: Operation = { id: randomUUID(), planId: applyMatch[1], requestId: body.requestId, createdAt: new Date().toISOString() };
      state.operations.push(operation); await checkpoint(); return execute(operation);
    }
    const retryMatch = path.match(/^\/v1\/operations\/([A-Za-z0-9_-]+)\/retry$/);
    if (method === "POST" && retryMatch) {
      const operation = state.operations.find(o => o.id === retryMatch[1]);
      if (!operation) throw new HttpError("Operation not found.", 404);
      return execute(operation);
    }
    if (method === "GET" && path === "/v1/history") return { operations: state.operations.map(presentOperation).reverse(), scans: state.scans.map(s => ({ id: s.report.id, createdAt: s.createdAt, scope: s.report.scope })).reverse(), aiRuns: structuredClone(ai.runs) };
    throw new HttpError("Endpoint not found.", 404);
  }
  const server = createServer((request, response) => {
    const send = (status: number, body: unknown) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(JSON.stringify(body)); };
    if (stopping) { send(503, { error: "Local companion is shutting down. Reconnect after restarting." }); return; }
    const run = async () => {
      try {
        const address = server.address();
        const host = typeof address === "object" && address ? `127.0.0.1:${address.port}` : "";
        const origin = `chrome-extension://${config.extensionId}`;
        if (request.headers.host !== host || (request.headers.origin !== undefined && request.headers.origin !== origin)) throw new HttpError("This host or origin is not authorized.", 403);
        if (request.headers.origin === origin) { response.setHeader("Access-Control-Allow-Origin", origin); response.setHeader("Vary", "Origin"); }
        if (request.method === "OPTIONS") {
          if (request.headers.origin !== origin) throw new HttpError("Origin required.", 403);
          response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
          response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tidepath-Extension-Id, Prefer");
          response.setHeader("Access-Control-Allow-Private-Network", "true");
          response.writeHead(204); response.end(); return;
        }
        if (request.headers["x-tidepath-extension-id"] !== config.extensionId || !sameSecret(request.headers.authorization ?? "", `Bearer ${config.token}`)) throw new HttpError("Pair the extension with this local session first.", 401);
        const url = new URL(request.url ?? "/", `http://${host}`);
        const jobMatch = url.pathname.match(/^\/v1\/jobs\/([a-f0-9-]+)$/);
        if (request.method === "GET" && jobMatch) {
          if (!demo) getGoogle();
          const job = jobs.get(jobMatch[1]); if (!job) throw new HttpError("Job not found. Check durable scan and operation history after a restart.", 404);
          send(200, job); return;
        }
        const method = request.method ?? "GET";
        if (method === "GET" && url.pathname !== "/v1/workbooks") {
          send(200, await route(method, url, request)); return;
        }
        const longOperation = method === "GET" && url.pathname === "/v1/workbooks" || method === "POST" && (url.pathname === "/v1/scans" || /^\/v1\/(plans\/[^/]+\/apply|operations\/[^/]+\/retry|scans\/[^/]+\/ai)$/.test(url.pathname));
        if (longOperation && request.headers.prefer === "respond-async") {
          if (!demo) getGoogle();
          if (jobs.size >= 100) throw new HttpError("This local process reached its 100-job limit. Check history, then restart the companion.", 429);
          const parsed = method === "POST" ? await jsonBody(request) : undefined;
          const job = { jobId: randomUUID(), status: "running" as "running" | "completed" | "failed" } as { jobId: string; status: "running" | "completed" | "failed"; result?: unknown; error?: string; httpStatus?: number };
          jobs.set(job.jobId, job);
          workQueue = workQueue.then(async () => {
            try { job.result = await route(method, url, request, parsed); job.status = "completed"; }
            catch (error) { job.status = "failed"; job.httpStatus = error instanceof HttpError ? error.status : 400; job.error = error instanceof z.ZodError ? "Invalid request fields. Review scope, mapping and approval." : error instanceof Error ? error.message.slice(0, 500) : "Local operation failed."; }
          });
          send(202, { jobId: job.jobId }); return;
        }
        const work = workQueue.then(() => route(method, url, request));
        workQueue = work.then(() => {}, () => {});
        send(200, await work);
      } catch (error) {
        if (error instanceof z.ZodError) send(400, { error: "Invalid request fields. Check the selected scope, mapping and explicit approval." });
        else if (error instanceof HttpError) send(error.status, { error: error.message });
        else {
          // Our domain errors contain no credentials. Never echo Google or provider error bodies.
          const message = error instanceof Error ? error.message : "Local operation failed.";
          send(400, { error: message.slice(0, 500) });
        }
      }
    };
    const handler = run();
    handlers.add(handler);
    void handler.then(() => handlers.delete(handler), () => handlers.delete(handler));
  });
  server.requestTimeout = 30_000; server.headersTimeout = 10_000;
  function shutdown(): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    shutdownPromise = (async () => {
      // HTTP close alone does not await jobs whose requests already returned 202.
      // Capture close failures immediately, but retain credentials until accepted
      // handlers (including body parsing) and their final queue have settled.
      const closed = httpClosed ? Promise.resolve<Error | undefined>(undefined) : new Promise<Error | undefined>(resolve => {
        try { server.close(error => resolve(error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? error : undefined)); }
        catch (error) { resolve(error instanceof Error ? error : new Error("Local HTTP shutdown failed.")); }
      });
      while (handlers.size) await Promise.allSettled([...handlers]);
      await workQueue;
      // Remaining sockets cannot own application work now. Do not let an idle
      // or slow-reading client hold the process and journal lock indefinitely.
      if (!httpClosed) server.closeAllConnections();
      const failure = await closed;
      if (failure) throw failure;
      ai.removeKey(); google = undefined;
    })();
    return shutdownPromise;
  }
  server.on("close", () => {
    httpClosed = true;
    // Preserve callers that close the HTTP server directly, without clearing
    // credentials under an accepted background operation.
    if (!shutdownPromise) void shutdown().catch(() => {});
  });
  return { server, ai, shutdown };
}
