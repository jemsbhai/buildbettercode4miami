/** Local-only reconciliation contracts. Coordinates are 1-based; mapping indexes are 0-based. */
export type Cell = { value: string | number | boolean | null; formula?: string; numberFormat?: { type: string; pattern?: string } };
export type TabSnapshot = { id: number; title: string; rows: Cell[][]; excluded?: string; excludedColumns?: number[] };
export type WorkbookSnapshot = { id: string; name: string; version: string; tabs: TabSnapshot[] };
export const RECONCILE_FIELDS = ["gift_id", "donor_id", "name", "email", "phone", "amount", "date", "channel", "currency", "quantity"] as const;
export type ReconcileField = typeof RECONCILE_FIELDS[number];
export type FieldMapping = Partial<Record<ReconcileField, number | null>>;
export type TabScanOptions = { workbookId: string; sheetId: number; mapping?: FieldMapping; requiredFields?: ReconcileField[]; amountUnit?: "dollars" | "cents"; currency?: string; dateOrder?: "MDY" | "DMY" };
export type ScanOptions = { tabs?: TabScanOptions[] };
export type SourceRef = { workbookId: string; sheetId: number; sheetTitle: string; row: number; column: number; a1: string };
export type CellFix = { ref: SourceRef; before: Cell; after: Cell; reason: string; groupId?: string };
export type IssueType = "schema" | "missing_required" | "duplicate_gift" | "conflicting_record" | "duplicate_identity" | "identity_conflict" | "invalid_date" | "ambiguous_date" | "invalid_amount" | "invalid_number" | "invalid_currency" | "normalization" | "formula_review";
export type Finding = { id: string; type: IssueType; severity: "info" | "warning" | "error"; message: string; refs: SourceRef[]; proposedFix?: CellFix };
export type ResolvedMapping = { workbookId: string; sheetId: number; sheetTitle: string; mapping: FieldMapping; headers: string[]; confirmed: boolean; kind: "gifts" | "donors" | "generic"; requiredFields: ReconcileField[]; amountUnit: "dollars" | "cents"; currency: string; dateOrder?: "MDY" | "DMY" };
export type ReconcileTotals = { giftCount: number; validAmountCount: number; invalidAmountCount: number; amountCentsByCurrency: Record<string, string> };
export type ExcludedScope = { workbookId: string; sheetId: number; columns?: number[]; reason: string };
export type ScanReport = { id: string; snapshotHash: string; options: ScanOptions; findings: Finding[]; mappings: ResolvedMapping[]; totals: ReconcileTotals; excluded: ExcludedScope[]; scope: { workbookIds: string[]; tabCount: number; rowCount: number }; limits: string[] };
export type CorrectionPlan = { id: string; scanId: string; snapshotHash: string; options: ScanOptions; findingIds: string[]; patches: CellFix[]; totals: ReconcileTotals; workbookIds: string[]; mode: "correction_copy" };
