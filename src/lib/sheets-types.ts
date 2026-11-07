import type { AgentRun, Claim, DemoState, Draft, MergeCandidate, Metric, ValidationIssue } from "./types";

export const SHEETS_FIELDS = ["gift_id", "donor_id", "name", "email", "phone", "amount", "date", "channel"] as const;
export type SheetsField = typeof SHEETS_FIELDS[number];
export type SheetsCell = string | number | boolean | null;
export type SheetsSelection = { workbookId: string; sheetId: number; sheetName: string; a1: string; startRow: number; startColumn: number; values: SheetsCell[][]; formulas: string[][] };
export type SheetsMapping = Record<SheetsField, number | null>;
export type SheetsAmountUnit = "cents" | "dollars";
export type SheetsGiftRow = { gift_id: string; donor_id: string; name: string; email: string; phone: string; amount_cents: number; date: string; channel: string };
export type SheetsBinding = Pick<SheetsSelection, "workbookId" | "sheetId" | "sheetName" | "a1" | "startRow" | "startColumn"> & { snapshotHash: string; mapping: SheetsMapping; amountUnit: SheetsAmountUnit; previewHash: string };
export type SheetsGenerationRequest = { requestId: string; mode: "demo" | "live"; fingerprint: string; status: "running" | "completed" | "failed"; startedAt: string; draftId?: string; runId?: string; error?: string };
export type SheetsWorkspace = { version: 1; workbookId: string; state: DemoState; selection?: SheetsBinding; generationRequests: SheetsGenerationRequest[] };
export type SheetsDashboard = {
  revision: number; asOf: string; period: DemoState["period"]; metrics: Metric[]; candidates: MergeCandidate[];
  donors: { id: string; name: string; emails: string[]; phone: string; mergedInto?: string }[];
  giftCount: number; drafts: (Draft & { issues: ValidationIssue[] })[]; runs: AgentRun[];
  selection?: SheetsBinding; liveAvailable: boolean; programData: "fictional_demo";
};
export type SheetsPreview = { previewHash: string; snapshotHash: string; inserted: number; skipped: number; rowCount: number; rows: SheetsGiftRow[]; metrics: Metric[]; candidates: MergeCandidate[] };
export type SheetsExport = { text: string; rows: string[][]; draftId: string; revision: number; approvalDigest: string; sourceHash: string };
export type SheetsResult = { dashboard: SheetsDashboard; preview?: SheetsPreview; importResult?: { inserted: number; skipped: number }; draft?: Draft; export?: SheetsExport; replayed?: boolean };
type Selected = { selection: SheetsSelection };
export type SheetsCommand =
  | { action: "status" }
  | { action: "reset" }
  | ({ action: "preview"; mapping: SheetsMapping; amountUnit: SheetsAmountUnit } & Selected)
  | ({ action: "import"; mapping: SheetsMapping; amountUnit: SheetsAmountUnit; previewHash: string } & Selected)
  | ({ action: "merge"; candidateId: string; decision: "approve" | "reject" } & Selected)
  | ({ action: "generate"; mode: "live" | "demo"; requestId: string } & Selected)
  | ({ action: "edit"; draftId: string; revision: number; narrative?: string; claims?: Claim[] } & Selected)
  | ({ action: "approve" | "export"; draftId: string; revision: number } & Selected);
