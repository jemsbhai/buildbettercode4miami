import { createHash } from "node:crypto";
import { isSensitiveLabel } from "./reconcile";
import type { Cell, TabSnapshot, WorkbookSnapshot } from "./reconcile-types";

/** No ambient credentials, SDK retries, arbitrary URLs, or source-write operation. */
export const GOOGLE_RECONCILE_SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;
export const GOOGLE_RECONCILE_LIMITS = { workbooks: 20, discovery: 1000, tabs: 100, rows: 10000, columns: 256, cells: 250000, responseBytes: 8_000_000 } as const;
export class GoogleReconcileError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = "GoogleReconcileError"; }
}
export type DiscoveredWorkbook = { id: string; name: string; modifiedTime?: string };
export interface GoogleSheetsClient {
  getAccountIdentity(): Promise<string>;
  discoverWorkbooks(): Promise<{ workbooks: DiscoveredWorkbook[]; complete: true }>;
  readWorkbooks(ids: string[]): Promise<WorkbookSnapshot[]>;
  getVersion(id: string): Promise<string>;
  createWorkbook(snapshot: WorkbookSnapshot, title: string): Promise<string>;
  writeWorkbook(copyId: string, snapshot: WorkbookSnapshot): Promise<void>;
  readCreatedWorkbook(copyId: string): Promise<WorkbookSnapshot>;
}
type Json = Record<string, any>;
const sheetsBase = "https://sheets.googleapis.com/v4/spreadsheets";
const driveBase = "https://www.googleapis.com/drive/v3/files";
const valueFields = "sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,userEnteredFormat(numberFormat),effectiveFormat(numberFormat)))))";
const numberFormatTypes = new Set(["TEXT", "NUMBER", "PERCENT", "CURRENCY", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"]);
function validId(id: string) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new GoogleReconcileError("Invalid spreadsheet identifier.");
  return encodeURIComponent(id);
}
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
function quoteTab(title: string) { return `'${title.replaceAll("'", "''")}'`; }
function scalar(value: Json | undefined): Cell["value"] {
  if (!value) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.numberValue === "number" && Number.isFinite(value.numberValue)) return value.numberValue;
  if (typeof value.boolValue === "boolean") return value.boolValue;
  return null;
}
function cellFromGoogle(cell: Json): Cell {
  const formula = cell.userEnteredValue?.formulaValue;
  const format = cell.userEnteredFormat?.numberFormat ?? cell.effectiveFormat?.numberFormat;
  const numberFormat = format && numberFormatTypes.has(format.type) ? { type: String(format.type), ...(typeof format.pattern === "string" ? { pattern: format.pattern } : {}) } : undefined;
  return { value: scalar(cell.effectiveValue ?? cell.userEnteredValue), ...(typeof formula === "string" ? { formula } : {}), ...(numberFormat ? { numberFormat } : {}) };
}
function trimmedRows(rows: Cell[][]): Cell[][] {
  const result = rows.map(row => {
    const copy = row.map(cell => ({ ...cell }));
    while (copy.length && copy.at(-1)!.value === null && !copy.at(-1)!.formula) copy.pop();
    return copy;
  });
  while (result.length && result.at(-1)!.length === 0) result.pop();
  return result;
}
function rowsFromGoogle(sheet: Json): Cell[][] {
  const rows: Cell[][] = [];
  for (const block of sheet.data ?? []) {
    const rowOffset = block.startRow ?? 0, columnOffset = block.startColumn ?? 0;
    if (!Number.isInteger(rowOffset) || !Number.isInteger(columnOffset) || rowOffset < 0 || columnOffset < 0) throw new GoogleReconcileError("Invalid Google grid coordinates.", 502);
    for (const [r, row] of (block.rowData ?? []).entries()) {
      if (r + rowOffset >= GOOGLE_RECONCILE_LIMITS.rows) throw new GoogleReconcileError("Spreadsheet exceeds the supported row limit.", 413);
      const target = rows[r + rowOffset] ??= [];
      for (const [c, value] of (row.values ?? []).entries()) {
        if (c + columnOffset >= GOOGLE_RECONCILE_LIMITS.columns) throw new GoogleReconcileError("Spreadsheet exceeds the supported column limit.", 413);
        while (target.length < c + columnOffset) target.push({ value: null });
        target[c + columnOffset] = cellFromGoogle(value);
      }
    }
  }
  for (let i = 0; i < rows.length; i++) rows[i] ??= [];
  return trimmedRows(rows);
}
function sheetArray(result: Json): Json[] {
  if (!Array.isArray(result.sheets)) throw new GoogleReconcileError("Google returned no sheet metadata.", 502);
  if (result.sheets.length > GOOGLE_RECONCILE_LIMITS.tabs) throw new GoogleReconcileError("Workbook has too many tabs; no partial scan was returned.", 413);
  return result.sheets;
}
function safeTabs(snapshot: WorkbookSnapshot) { return snapshot.tabs.filter(tab => !tab.excluded); }

export function createGoogleSheetsClient(options: { accessToken: string; fetchImpl?: typeof fetch }): GoogleSheetsClient {
  if (typeof options.accessToken !== "string" || !options.accessToken || /[\r\n]/.test(options.accessToken)) throw new GoogleReconcileError("Connect Google before continuing.", 401);
  const fetchImpl = options.fetchImpl ?? fetch;
  const createdHere = new Set<string>();
  async function request(url: string, init: RequestInit = {}): Promise<Json> {
    // URL bases and path construction are internal; never forward tokens to redirects.
    const response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30000), headers: { "Authorization": `Bearer ${options.accessToken}`, "Content-Type": "application/json" } });
    if (!response.ok) throw new GoogleReconcileError(response.status === 401 ? "Google authorization expired. Reconnect and retry the same operation." : response.status === 403 ? "Google denied access. Check granted scopes and file access." : response.status === 429 ? "Google quota limit reached. Try again later; source files were not changed." : `Google request failed (${response.status}).`, response.status);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > GOOGLE_RECONCILE_LIMITS.responseBytes) throw new GoogleReconcileError("Google response exceeds the local safety limit.", 413);
    if (!response.body) return {};
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > GOOGLE_RECONCILE_LIMITS.responseBytes) throw new GoogleReconcileError("Google response exceeds the local safety limit.", 413); chunks.push(value); }
    } finally { await reader.cancel().catch(() => {}); }
    const text = Buffer.concat(chunks).toString("utf8");
    try { return text ? JSON.parse(text) : {}; } catch { throw new GoogleReconcileError("Google returned an invalid response.", 502); }
  }
  async function metadata(id: string) {
    return request(`${driveBase}/${validId(id)}?fields=id,name,version,mimeType,trashed&supportsAllDrives=true`);
  }
  async function getVersion(id: string) {
    const value = await metadata(id);
    if (value.mimeType !== "application/vnd.google-apps.spreadsheet" || value.trashed || typeof value.version !== "string" || !/^\d{1,20}$/.test(value.version)) throw new GoogleReconcileError("The selected file is unavailable, has no valid source version, or is not a Google spreadsheet.", 409);
    return value.version as string;
  }
  async function getGrids(id: string, ranges: string[], fields = valueFields): Promise<Json> {
    const query = new URLSearchParams({ fields });
    for (const range of ranges) query.append("ranges", range);
    return request(`${sheetsBase}/${validId(id)}?${query}`);
  }
  async function readOne(id: string): Promise<WorkbookSnapshot> {
    const before = await metadata(id);
    if (before.mimeType !== "application/vnd.google-apps.spreadsheet" || before.trashed || typeof before.version !== "string" || !/^\d{1,20}$/.test(before.version)) throw new GoogleReconcileError("The selected file is unavailable, has no valid source version, or is not a Google spreadsheet.", 409);
    const info = await getGrids(id, [], "spreadsheetId,properties(title),sheets(properties(sheetId,title,sheetType,gridProperties(rowCount,columnCount)))");
    const tabs: TabSnapshot[] = [];
    const privateWorkbook = isSensitiveLabel(String(before.name ?? "")) || isSensitiveLabel(String(info.properties?.title ?? ""));
    let allocation = 0;
    for (const sheet of sheetArray(info)) {
      const props = sheet.properties;
      if (!Number.isInteger(props?.sheetId) || typeof props.title !== "string") throw new GoogleReconcileError("Google returned invalid tab metadata.", 502);
      const tab: TabSnapshot = { id: props.sheetId, title: props.title, rows: [] };
      tabs.push(tab);
      if (privateWorkbook || isSensitiveLabel(props.title)) { tab.excluded = "Private or counseling workbook/tab excluded before reading its cells."; continue; }
      if (props.sheetType && props.sheetType !== "GRID") { tab.excluded = "Non-grid sheet cannot be scanned."; continue; }
      const { rowCount, columnCount } = props.gridProperties ?? {};
      allocation += rowCount * columnCount;
      if (!Number.isInteger(rowCount) || !Number.isInteger(columnCount) || rowCount < 1 || columnCount < 1 || rowCount > GOOGLE_RECONCILE_LIMITS.rows || columnCount > GOOGLE_RECONCILE_LIMITS.columns || allocation > GOOGLE_RECONCILE_LIMITS.cells) throw new GoogleReconcileError("Workbook exceeds the local grid limits; no truncated scan was returned. Use smaller workbooks.", 413);
      // Fetch headers only first, then omit sensitive body columns at Google's range boundary.
      const headerData = await getGrids(id, [`${quoteTab(props.title)}!A1:${columnName(columnCount - 1)}1`]);
      const headerSheet = sheetArray(headerData).find(item => item.properties.sheetId === tab.id);
      if (!headerSheet) throw new GoogleReconcileError("Tab disappeared during reading.", 409);
      const headers = rowsFromGoogle(headerSheet)[0] ?? [];
      tab.excludedColumns = headers.flatMap((cell, index) => isSensitiveLabel(String(cell.value ?? "")) ? [index] : []);
      const excluded = new Set(tab.excludedColumns);
      const ranges: string[] = [];
      for (let start = 0; start < columnCount;) {
        if (excluded.has(start)) { start++; continue; }
        let end = start; while (end + 1 < columnCount && !excluded.has(end + 1)) end++;
        ranges.push(`${quoteTab(props.title)}!${columnName(start)}1:${columnName(end)}${rowCount}`); start = end + 1;
      }
      if (ranges.length) {
        const grid = sheetArray(await getGrids(id, ranges)).find(item => item.properties.sheetId === tab.id);
        if (!grid) throw new GoogleReconcileError("Tab disappeared during reading.", 409);
        tab.rows = rowsFromGoogle(grid);
      }
      // Keep a redacted header marker, never the private body or a private header formula.
      if (excluded.size) {
        tab.rows[0] ??= [];
        for (const index of excluded) { while (tab.rows[0].length <= index) tab.rows[0].push({ value: null }); tab.rows[0][index] = { value: "[Excluded private column]" }; }
        for (const row of tab.rows.slice(1)) for (const index of excluded) if (index < row.length) row[index] = { value: null };
      }
    }
    if (await getVersion(id) !== before.version) throw new GoogleReconcileError("Spreadsheet changed while reading. Scan it again.", 409);
    return { id, name: String(info.properties?.title ?? before.name ?? id), version: before.version, tabs };
  }
  return {
    async getAccountIdentity() {
      const result = await request("https://www.googleapis.com/drive/v3/about?fields=user(permissionId)");
      const permissionId = result.user?.permissionId;
      if (typeof permissionId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(permissionId)) throw new GoogleReconcileError("Google did not return an account identity. Reconnect before using this journal.", 401);
      return createHash("sha256").update(`google-drive-user:${permissionId}`).digest("hex");
    },
    async discoverWorkbooks() {
      const workbooks: DiscoveredWorkbook[] = []; const seen = new Set<string>(); const pages = new Set<string>(); let pageToken = "";
      do {
        if (pages.has(pageToken)) throw new GoogleReconcileError("Google repeated a discovery page; refresh discovery.", 502);
        pages.add(pageToken);
        const query = new URLSearchParams({ q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false", fields: "nextPageToken,incompleteSearch,files(id,name,modifiedTime)", pageSize: "100", spaces: "drive", corpora: "user", includeItemsFromAllDrives: "true", supportsAllDrives: "true" });
        if (pageToken) query.set("pageToken", pageToken);
        const result = await request(`${driveBase}?${query}`);
        if (result.incompleteSearch) throw new GoogleReconcileError("Google reports incomplete discovery. No claim to all workbooks can be made; try again.", 409);
        for (const file of result.files ?? []) {
          if (typeof file.id !== "string" || typeof file.name !== "string") throw new GoogleReconcileError("Google returned invalid file metadata.", 502);
          if (!seen.has(file.id)) { seen.add(file.id); workbooks.push({ id: file.id, name: file.name, ...(typeof file.modifiedTime === "string" ? { modifiedTime: file.modifiedTime } : {}) }); }
        }
        if (workbooks.length > GOOGLE_RECONCILE_LIMITS.discovery) throw new GoogleReconcileError("More than 1,000 spreadsheets are accessible. Discovery is not complete; use a Google account with a smaller authorized collection.", 413);
        pageToken = result.nextPageToken ?? "";
      } while (pageToken);
      return { workbooks, complete: true };
    },
    async readWorkbooks(ids) {
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > GOOGLE_RECONCILE_LIMITS.workbooks || new Set(ids).size !== ids.length) throw new GoogleReconcileError("Explicitly select 1–20 different workbooks.");
      ids.forEach(validId);
      const snapshots: WorkbookSnapshot[] = [];
      for (const id of ids) snapshots.push(await readOne(id));
      return snapshots;
    },
    getVersion,
    async createWorkbook(snapshot, title) {
      const tabs = safeTabs(snapshot);
      const body = { properties: { title }, sheets: tabs.map(tab => ({ properties: { sheetId: tab.id, title: tab.title, gridProperties: { rowCount: Math.max(1, tab.rows.length), columnCount: Math.max(1, ...tab.rows.map(row => row.length)) } } })) };
      const result = await request(sheetsBase, { method: "POST", body: JSON.stringify(body) });
      if (typeof result.spreadsheetId !== "string") throw new GoogleReconcileError("Google did not return the created copy ID; do not retry creation.", 502);
      validId(result.spreadsheetId); createdHere.add(result.spreadsheetId);
      return result.spreadsheetId;
    },
    async writeWorkbook(copyId, snapshot) {
      if (!createdHere.has(copyId) || copyId === snapshot.id) throw new GoogleReconcileError("Writing is restricted to a new copy created in this operation.", 403);
      const requests = safeTabs(snapshot).filter(tab => tab.rows.length).map(tab => ({ updateCells: { start: { sheetId: tab.id, rowIndex: 0, columnIndex: 0 }, fields: "userEnteredValue,userEnteredFormat.numberFormat", rows: tab.rows.map(row => ({ values: row.map(cell => {
        if (cell.formula) throw new GoogleReconcileError("Formula-bearing workbooks require manual correction; formulas are never executed in a correction copy.", 409);
        return { ...(cell.value === null ? {} : { userEnteredValue: { [typeof cell.value === "number" ? "numberValue" : typeof cell.value === "boolean" ? "boolValue" : "stringValue"]: cell.value } }), ...(cell.numberFormat ? { userEnteredFormat: { numberFormat: cell.numberFormat } } : {}) };
      }) })) } }));
      if (requests.length) await request(`${sheetsBase}/${validId(copyId)}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
    },
    async readCreatedWorkbook(copyId) {
      const data = await getGrids(copyId, [], `spreadsheetId,properties(title),${valueFields}`);
      return { id: copyId, name: String(data.properties?.title ?? ""), version: "copy-verification", tabs: sheetArray(data).map(sheet => ({ id: sheet.properties.sheetId, title: sheet.properties.title, rows: rowsFromGoogle(sheet) })) };
    },
  };
}

export type CopyEntry = { sourceId: string; sourceVersion: string; name: string; status: "pending" | "creating" | "created" | "writing" | "verified" | "uncertain" | "conflict"; copyId?: string; url?: string; message?: string; verifiedAt?: string };
export type CopyJournal = { operationId: string; fingerprint: string; status: "pending" | "complete" | "partial" | "blocked"; entries: CopyEntry[]; message?: string };
export type CorrectionCopyInput = { operationId: string; snapshots: WorkbookSnapshot[]; sourceVersions: { id: string; version: string }[]; journal?: CopyJournal; checkpoint: (journal: CopyJournal) => Promise<void> };
function content(snapshot: WorkbookSnapshot) {
  return safeTabs(snapshot).map(tab => ({ id: tab.id, title: tab.title, rows: trimmedRows(tab.rows) })).sort((a, b) => a.id - b.id);
}
function matches(actual: WorkbookSnapshot, expected: WorkbookSnapshot) { return JSON.stringify(content(actual)) === JSON.stringify(content(expected)); }

/** Caller serializes operations and atomically persists every checkpoint before any Google mutation. */
export async function createCorrectionCopies(client: GoogleSheetsClient, input: CorrectionCopyInput): Promise<CopyJournal> {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.operationId)) throw new GoogleReconcileError("Invalid correction operation ID.");
  if (!input.snapshots.length || input.snapshots.length > GOOGLE_RECONCILE_LIMITS.workbooks) throw new GoogleReconcileError("No supported correction workbooks were selected.");
  if (new Set(input.snapshots.map(item => item.id)).size !== input.snapshots.length || new Set(input.sourceVersions.map(item => item.id)).size !== input.sourceVersions.length) throw new GoogleReconcileError("Repeated workbook identifiers are not allowed.");
  for (const book of input.snapshots) {
    if (isSensitiveLabel(book.name)) throw new GoogleReconcileError("Private workbooks must be excluded before copying.", 409);
    if (!input.sourceVersions.some(source => source.id === book.id && source.version === book.version)) throw new GoogleReconcileError("Correction lacks its reviewed source version.", 409);
    if (!safeTabs(book).length) throw new GoogleReconcileError("No non-private tabs are available for a correction copy.", 409);
    if (safeTabs(book).some(tab => tab.rows.some(row => row.some(cell => cell.formula)))) throw new GoogleReconcileError("This workbook contains formulas. Use its reviewed findings for manual correction; creating a data copy would not preserve formula behavior.", 409);
    for (const tab of safeTabs(book)) {
      if (isSensitiveLabel(tab.title)) throw new GoogleReconcileError("Private tabs must be excluded before copying.", 409);
      const excluded = new Set([...(tab.excludedColumns ?? []), ...(tab.rows[0] ?? []).flatMap((cell, index) => isSensitiveLabel(String(cell.value ?? "")) ? [index] : [])]);
      if (tab.rows.slice(1).some(row => [...excluded].some(column => row[column]?.value !== undefined && row[column]?.value !== null && row[column]?.value !== ""))) throw new GoogleReconcileError("Private column data must be removed before copying.", 409);
    }
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({ snapshots: input.snapshots, sourceVersions: input.sourceVersions })).digest("hex");
  const journal: CopyJournal = input.journal ?? { operationId: input.operationId, fingerprint, status: "pending", entries: input.snapshots.map(book => ({ sourceId: book.id, sourceVersion: book.version, name: `Tidepath corrected ${input.operationId.slice(0, 12)} — ${book.name}`.slice(0, 200), status: "pending" })) };
  if (journal.operationId !== input.operationId || journal.fingerprint !== fingerprint) throw new GoogleReconcileError("Operation ID belongs to different reviewed corrections.", 409);
  if (journal.entries.length !== input.snapshots.length || new Set(journal.entries.map(entry => entry.sourceId)).size !== journal.entries.length || journal.entries.some(entry => !input.snapshots.some(book => book.id === entry.sourceId && book.version === entry.sourceVersion) || (entry.copyId && input.sourceVersions.some(source => source.id === entry.copyId)))) throw new GoogleReconcileError("Correction journal does not match the reviewed source files.", 409);
  if (journal.status === "complete") return journal;
  const save = async () => input.checkpoint(structuredClone(journal));
  const finish = async (message?: string) => {
    journal.status = journal.entries.every(entry => entry.status === "verified") ? "complete" : journal.entries.some(entry => entry.copyId) ? "partial" : "blocked";
    if (message) journal.message = message;
    await save(); return journal;
  };
  await save();
  // A lost create response might have created a file. Never issue another create for it.
  if (journal.entries.some(entry => !entry.copyId && entry.status !== "pending")) return finish("A copy creation had an uncertain outcome. Check Drive for its recorded name; this operation will not create another file.");
  for (const source of input.sourceVersions) {
    if (await client.getVersion(source.id) !== source.version) {
      for (const entry of journal.entries) if (entry.status === "pending") { entry.status = "conflict"; entry.message = "Source changed since review."; }
      return finish("A source workbook changed after review. Scan and review again; existing correction files remain separate.");
    }
  }
  for (const entry of journal.entries) {
    if (entry.status === "verified") continue;
    const snapshot = input.snapshots.find(book => book.id === entry.sourceId)!;
    if (entry.copyId) {
      // Recovery is read-only. Incomplete output is retained for manual inspection, never overwritten.
      try {
        if (matches(await client.readCreatedWorkbook(entry.copyId), snapshot)) { entry.status = "verified"; entry.verifiedAt = new Date().toISOString(); delete entry.message; await save(); continue; }
        entry.status = "conflict"; entry.message = "Copy content does not match reviewed corrections. Inspect this separate file; source is unchanged.";
      } catch { entry.status = "uncertain"; entry.message = "Copy verification failed. Reconnect and retry this same operation to verify the known file."; }
      return finish(entry.message);
    }
    entry.status = "creating"; await save();
    try {
      const copyId = await client.createWorkbook(snapshot, entry.name);
      if (input.sourceVersions.some(source => source.id === copyId)) throw new GoogleReconcileError("Google returned a source identifier for a new copy.", 409);
      entry.copyId = copyId;
      entry.url = `https://docs.google.com/spreadsheets/d/${entry.copyId}/edit`;
      entry.status = "created"; await save();
    } catch {
      entry.status = "uncertain"; entry.message = "Copy creation outcome is uncertain. Check Drive for the recorded name. No automatic create retry is permitted.";
      return finish(entry.message);
    }
    entry.status = "writing"; await save();
    try { await client.writeWorkbook(entry.copyId, snapshot); }
    catch {
      entry.status = "uncertain"; entry.message = "Copy write outcome is uncertain. Retry this operation to verify the known copy; no source was changed.";
      await save();
    }
    try {
      if (!matches(await client.readCreatedWorkbook(entry.copyId), snapshot)) { entry.status = "conflict"; entry.message = "Copy readback did not match. Inspect this separate file; it is not a verified result."; return finish(entry.message); }
      entry.status = "verified"; entry.verifiedAt = new Date().toISOString(); delete entry.message; await save();
    } catch { entry.status = "uncertain"; entry.message = "Copy exists but readback failed. Retry the same operation for verification only."; return finish(entry.message); }
  }
  // No atomic cross-file transaction exists. A late source edit makes these copies historical, not current.
  for (const source of input.sourceVersions) if (await client.getVersion(source.id) !== source.version) {
    for (const entry of journal.entries) { entry.status = "conflict"; entry.message = "Source changed during creation; this copy is a historical snapshot."; }
    return finish("Source changed during copy creation. Copies preserve the reviewed snapshot but require a new scan before use.");
  }
  return finish();
}
