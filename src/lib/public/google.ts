import { digest } from "../evidence";
import { AppError } from "../service";
import type { SheetsCell, SheetsExport, SheetsSelection } from "../sheets-types";
import type { GoogleIdentity } from "./auth";

export type SelectionLocation = { workbookId: string; sheetId: number; a1: string };
export type WrittenReport = { sheetName: string; url: string; replayed: boolean };
type CellData = { effectiveValue?: { stringValue?: string; numberValue?: number; boolValue?: boolean; errorValue?: unknown }; userEnteredValue?: { formulaValue?: string }; effectiveFormat?: { numberFormat?: { type?: string } } };
type SheetData = { properties: { sheetId: number; title: string; gridProperties?: { rowCount: number; columnCount: number } }; developerMetadata?: { metadataId: number; metadataKey: string; metadataValue: string }[]; data?: { startRow?: number; startColumn?: number; rowData?: { values?: CellData[] }[] }[] };
type SpreadsheetData = { spreadsheetId: string; sheets?: SheetData[] };
const MARKER = "tidepath.public.export.v1";

export function parseSelectionLocation(location: SelectionLocation) {
  if (!location || typeof location.workbookId !== "string" || !/^[A-Za-z0-9_-]{10,200}$/u.test(location.workbookId)
    || !Number.isSafeInteger(location.sheetId) || location.sheetId < 0 || location.sheetId > 2_147_483_647 || typeof location.a1 !== "string") throw new AppError("Select a valid Google spreadsheet range.");
  const match = /^([A-Z]{1,3})([1-9]\d*):([A-Z]{1,3})([1-9]\d*)$/u.exec(location.a1);
  if (!match) throw new AppError("Select one rectangular table including its header.");
  const col = (letters: string) => [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
  const startColumn = col(match[1]); const endColumn = col(match[3]);
  const startRow = Number(match[2]); const endRow = Number(match[4]);
  const rows = endRow - startRow + 1; const columns = endColumn - startColumn + 1;
  if (rows < 2 || rows > 1001 || columns < 1 || columns > 32 || endRow > 10_000_000 || endColumn > 18_278) {
    throw new AppError("Choose a header and 1–1,000 rows, with at most 32 columns.");
  }
  return { startRow, startColumn, rows, columns, gridRange: { sheetId: location.sheetId, startRowIndex: startRow - 1, endRowIndex: endRow, startColumnIndex: startColumn - 1, endColumnIndex: endColumn } };
}

function effectiveCell(cell: CellData, row: number): SheetsCell {
  const value = cell.effectiveValue;
  if (value?.errorValue) throw new AppError(`Row ${row}: a selected cell contains a spreadsheet error. Correct it before importing.`);
  if (typeof value?.numberValue === "number") {
    if (!Number.isFinite(value.numberValue)) throw new AppError(`Row ${row}: a selected number is not finite.`);
    if (["DATE", "DATE_TIME"].includes(cell.effectiveFormat?.numberFormat?.type ?? "")) {
      // Sheets serials are civil dates, so no host/browser timezone conversion is involved.
      const time = Date.UTC(1899, 11, 30) + Math.floor(value.numberValue) * 86_400_000;
      if (!Number.isFinite(time) || Math.abs(time) > 8.64e15) throw new AppError(`Row ${row}: invalid spreadsheet date.`);
      return new Date(time).toISOString().slice(0, 10);
    }
    return value.numberValue;
  }
  if (typeof value?.boolValue === "boolean") return value.boolValue;
  const text = value?.stringValue ?? "";
  if (text.length > 2000) throw new AppError(`Row ${row}: selected text exceeds 2,000 characters.`);
  return text;
}

/** Access tokens are supplied afresh by Apps Script; never persisted or logged. */
export class GoogleWorkbookGateway {
  constructor(private readonly accessToken: string, private readonly request: typeof fetch = fetch) {
    if (!accessToken || accessToken.length > 12_000 || /[\r\n]/u.test(accessToken)) throw new AppError("Authorize Google access again.", 401);
  }

  private async api<T>(url: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.request(url, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    } catch { throw new AppError("Google did not confirm the action. Retry safely; an export retry checks the existing tab before writing.", 503); }
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) throw new AppError("Google could not authorize this spreadsheet. Select this workbook in the Google file picker with the same account, and confirm you can edit it.", response.status === 401 ? 401 : 403);
      if (response.status === 429) throw new AppError("Google's request limit was reached. Wait briefly and retry.", 429);
      throw new AppError("Google could not complete this spreadsheet action. Refresh the selected range and retry.", response.status >= 500 ? 503 : 409);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AppError("Google returned an empty response.", 503);
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > 5_000_000) { await reader.cancel(); throw new AppError("The selected table is too large. Select a smaller table with less text.", 413); }
        chunks.push(chunk.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError("Google returned an invalid spreadsheet response.", 503); }
  }

  async assertWorkbookAccess(workbookId: string) {
    if (!/^[A-Za-z0-9_-]{10,200}$/u.test(workbookId)) throw new AppError("Invalid spreadsheet identifier.");
    const file = await this.api<{ id: string; mimeType: string; trashed?: boolean; capabilities?: { canEdit?: boolean } }>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(workbookId)}?fields=id,mimeType,trashed,capabilities(canEdit)&supportsAllDrives=true`);
    if (file.id !== workbookId || file.mimeType !== "application/vnd.google-apps.spreadsheet" || file.trashed || file.capabilities?.canEdit !== true) {
      throw new AppError("Choose a Google spreadsheet you can edit. View-only or deleted files are not supported.", 403);
    }
  }

  async readSelection(location: SelectionLocation): Promise<SheetsSelection> {
    const bounds = parseSelectionLocation(location);
    const fields = "spreadsheetId,sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(effectiveValue,userEnteredValue,effectiveFormat(numberFormat)))))";
    const result = await this.api<SpreadsheetData>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(location.workbookId)}:getByDataFilter?fields=${encodeURIComponent(fields)}`,
      { dataFilters: [{ gridRange: bounds.gridRange }], includeGridData: true });
    const sheet = result.sheets?.find(sheet => sheet.properties.sheetId === location.sheetId);
    if (result.spreadsheetId !== location.workbookId || !sheet) throw new AppError("The selected worksheet no longer exists. Select your table again.", 409);
    const grid = sheet.data?.find(data => (data.startRow ?? 0) === bounds.startRow - 1 && (data.startColumn ?? 0) === bounds.startColumn - 1);
    const values: SheetsCell[][] = []; const formulas: string[][] = [];
    for (let row = 0; row < bounds.rows; row++) {
      const cells = grid?.rowData?.[row]?.values ?? [];
      values.push(Array.from({ length: bounds.columns }, (_, column) => effectiveCell(cells[column] ?? {}, bounds.startRow + row)));
      formulas.push(Array.from({ length: bounds.columns }, (_, column) => cells[column]?.userEnteredValue?.formulaValue ?? ""));
    }
    const selection = { workbookId: location.workbookId, sheetId: location.sheetId, sheetName: sheet.properties.title, a1: location.a1,
      startRow: bounds.startRow, startColumn: bounds.startColumn, values, formulas };
    if (Buffer.byteLength(JSON.stringify(selection), "utf8") > 1_000_000) throw new AppError("Selected cells exceed the one-megabyte limit. Choose a smaller table.", 413);
    return selection;
  }

  private async metadata(workbookId: string) {
    return this.api<SpreadsheetData>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(workbookId)}?fields=${encodeURIComponent("spreadsheetId,sheets(properties(sheetId,title,gridProperties),developerMetadata)")}`);
  }

  async writeApprovedReport(identity: GoogleIdentity, source: SheetsSelection, exported: SheetsExport, beforeMutation?: () => Promise<void>): Promise<WrittenReport> {
    if (digest(source) !== exported.sourceHash || !/^[a-f0-9]{64}$/u.test(exported.approvalDigest)) throw new AppError("This export does not match the approved source.", 409);
    const rows = exported.rows;
    const width = rows[0]?.length ?? 0;
    if (!rows.length || rows.length > 2000 || !width || width > 16 || rows.some(row => row.length !== width || row.some(value => typeof value !== "string" || value.length > 20_000))) throw new AppError("The approved report is too large to export.");
    const exportKey = digest({ sub: identity.sub, workbookId: source.workbookId, draftId: exported.draftId, revision: exported.revision, approvalDigest: exported.approvalDigest });
    const sheetId = parseInt(exportKey.slice(0, 7), 16) + 1;
    const sheetName = `Tidepath report ${exportKey.slice(0, 12)} r${exported.revision}`;
    const marker = JSON.stringify({ key: exportKey, contentHash: digest(rows), sourceHash: exported.sourceHash });
    const spreadsheet = await this.metadata(source.workbookId);
    const prior = spreadsheet.sheets?.find(sheet => sheet.properties.sheetId === sheetId || sheet.properties.title === sheetName);
    if (digest(await this.readSelection(source)) !== exported.sourceHash) throw new AppError("Source cells changed after approval. Preview, import and approve a fresh report.", 409);
    if (prior) {
      if (prior.properties.sheetId !== sheetId || prior.properties.title !== sheetName || prior.developerMetadata?.filter(item => item.metadataKey === MARKER && item.metadataValue === marker).length !== 1) {
        throw new AppError("An existing tab conflicts with this export. Tidepath will not overwrite it.", 409);
      }
      await this.verifyExport(source.workbookId, sheetId, rows);
      return { sheetName, url: `https://docs.google.com/spreadsheets/d/${source.workbookId}/edit#gid=${sheetId}`, replayed: true };
    }
    // addSheet, literal text, and provenance marker commit together or not at all.
    await beforeMutation?.();
    await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(source.workbookId)}:batchUpdate`, { requests: [
      { addSheet: { properties: { sheetId, title: sheetName, gridProperties: { rowCount: Math.max(rows.length, 2), columnCount: width, frozenRowCount: 1 } } } },
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: rows.map(row => ({ values: row.map(text => ({ userEnteredValue: { stringValue: text }, userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP", numberFormat: { type: "TEXT" } } })) })), fields: "userEnteredValue,userEnteredFormat" } },
      { createDeveloperMetadata: { developerMetadata: { metadataKey: MARKER, metadataValue: marker, location: { sheetId }, visibility: "DOCUMENT" } } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.07, green: 0.25, blue: 0.22 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: width }, properties: { pixelSize: width === 1 ? 640 : 360 }, fields: "pixelSize" } },
    ] });
    // Sheets has no compare-and-swap with arbitrary source cells. Never report success if a concurrent editor changed the source.
    if (digest(await this.readSelection(source)) !== exported.sourceHash) throw new AppError("Source cells changed during export. The new report tab needs inspection; it has not been confirmed as current. Reimport and review a fresh report.", 409);
    await this.verifyExport(source.workbookId, sheetId, rows);
    return { sheetName, url: `https://docs.google.com/spreadsheets/d/${source.workbookId}/edit#gid=${sheetId}`, replayed: false };
  }

  private async verifyExport(workbookId: string, sheetId: number, rows: string[][]) {
    const result = await this.api<SpreadsheetData>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(workbookId)}:getByDataFilter?fields=${encodeURIComponent("spreadsheetId,sheets(properties(sheetId),data(startRow,startColumn,rowData(values(effectiveValue,userEnteredValue))))")}`,
      { dataFilters: [{ gridRange: { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: rows[0].length } }], includeGridData: true });
    const grid = result.sheets?.find(sheet => sheet.properties.sheetId === sheetId)?.data?.[0];
    for (let row = 0; row < rows.length; row++) for (let column = 0; column < rows[row].length; column++) {
      const cell = grid?.rowData?.[row]?.values?.[column];
      if (cell?.userEnteredValue?.formulaValue || (cell?.effectiveValue?.stringValue ?? "") !== rows[row][column]) throw new AppError("The report tab differs from the approved content. Tidepath will not overwrite it; inspect that tab before continuing.", 409);
    }
  }
}
