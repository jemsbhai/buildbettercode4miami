import { createHash } from "node:crypto";
import { RECONCILE_FIELDS } from "./reconcile-types";
import type { Cell, CellFix, CorrectionPlan, FieldMapping, Finding, ReconcileField, ReconcileTotals, ResolvedMapping, ScanOptions, ScanReport, SourceRef, TabSnapshot, WorkbookSnapshot } from "./reconcile-types";

const LIMITS = { workbooks: 30, tabs: 200, cells: 200_000, rows: 20_000, findings: 10_000 };
const currencies = new Set(["USD", "EUR", "GBP", "CAD", "AUD"]);
const aliases: Record<ReconcileField, string[]> = {
  gift_id: ["gift id", "donation id", "transaction id", "gift identifier"],
  donor_id: ["donor id", "donor identifier", "contact id", "supporter id"],
  name: ["name", "donor name", "full name", "supporter name"],
  email: ["email", "email address", "donor email"], phone: ["phone", "phone number", "telephone"],
  amount: ["amount", "amount cents", "amount dollars", "gift amount", "donation amount", "amount usd"],
  date: ["date", "gift date", "donation date", "transaction date"],
  channel: ["channel", "giving channel", "payment method"], currency: ["currency", "currency code"],
  quantity: ["quantity", "count", "hours", "volunteer hours"],
};
const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const stringValue = (cell?: Cell) => cell?.value === null || cell?.value === undefined ? "" : String(cell.value);
const empty = (cell?: Cell) => !cell?.formula && stringValue(cell).trim() === "";
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** A conservative exclusion heuristic, not a promise to recognize all sensitive data. */
export function isSensitiveLabel(label: string): boolean {
  return /(?:counsel(?:ing|ling)?|therap(?:y|ist)|diagnos(?:is|es|tic)|clinical|case[\s_-]*notes?|session[\s_-]*notes?|private|confidential|psych(?:iatric|ological)?|social[\s_-]*security|\bssn\b|\bnotes?\b|medical|health|patient|password|secret|api[\s_-]*key)/i.test(label);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => lexical(a, b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
export function snapshotHash(workbooks: WorkbookSnapshot[]): string { return digest(workbooks); }

function a1(column: number, row: number): string {
  let letters = "";
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26)) letters = String.fromCharCode(65 + (value - 1) % 26) + letters;
  return `${letters}${row}`;
}
function reference(book: WorkbookSnapshot, tab: TabSnapshot, row: number, column: number): SourceRef {
  return { workbookId: book.id, sheetId: tab.id, sheetTitle: tab.title, row, column, a1: a1(column, row) };
}
function assertSnapshots(workbooks: WorkbookSnapshot[]) {
  if (!Array.isArray(workbooks) || !workbooks.length || workbooks.length > LIMITS.workbooks) throw new Error(`Select between 1 and ${LIMITS.workbooks} workbooks.`);
  let cellCount = 0, tabCount = 0, rowCount = 0;
  const ids = new Set<string>();
  for (const book of workbooks) {
    if (!book || typeof book.id !== "string" || !book.id || ids.has(book.id) || typeof book.name !== "string" || typeof book.version !== "string" || !book.version || !Array.isArray(book.tabs)) throw new Error("Workbook metadata is invalid or duplicated.");
    ids.add(book.id);
    const tabs = new Set<number>();
    for (const tab of book.tabs) {
      if (!tab || !Number.isSafeInteger(tab.id) || tab.id < 0 || tabs.has(tab.id) || typeof tab.title !== "string" || !Array.isArray(tab.rows)) throw new Error("Tab metadata is invalid or duplicated.");
      tabs.add(tab.id); tabCount++; rowCount += Math.max(0, tab.rows.length - 1);
      if (tab.excludedColumns && (!Array.isArray(tab.excludedColumns) || tab.excludedColumns.some(column => !Number.isSafeInteger(column) || column < 0))) throw new Error("Excluded column coordinates are invalid.");
      for (const row of tab.rows) {
        if (!Array.isArray(row) || row.length > 1000) throw new Error("A tab row exceeds the supported shape.");
        cellCount += row.length;
        for (const cell of row) {
          if (!cell || !["string", "number", "boolean"].includes(typeof cell.value) && cell.value !== null || typeof cell.value === "number" && !Number.isFinite(cell.value) || typeof cell.value === "string" && cell.value.length > 50_000 || cell.formula !== undefined && (typeof cell.formula !== "string" || cell.formula.length > 50_000)) throw new Error("A spreadsheet cell has an unsupported value.");
          if (cell.numberFormat !== undefined && (!cell.numberFormat || typeof cell.numberFormat !== "object" || typeof cell.numberFormat.type !== "string" || cell.numberFormat.type.length > 100 || cell.numberFormat.pattern !== undefined && (typeof cell.numberFormat.pattern !== "string" || cell.numberFormat.pattern.length > 1000))) throw new Error("A spreadsheet cell has invalid number format metadata.");
        }
      }
    }
  }
  if (tabCount > LIMITS.tabs || cellCount > LIMITS.cells || rowCount > LIMITS.rows) throw new Error(`Scan scope exceeds ${LIMITS.tabs} tabs, ${LIMITS.cells} cells, or ${LIMITS.rows} rows. Select a smaller scope.`);
}

type ParsedNumber = { canonical: string; integer: bigint; scale: number };
function parseDecimal(input: string, scaleLimit: number): ParsedNumber | null {
  const text = input.trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;
  const plain = text.replaceAll(",", "").replace(/^\+/, "");
  const negative = plain.startsWith("-");
  const [whole, fraction = ""] = plain.replace(/^-/, "").split(".");
  if (fraction.length > scaleLimit || whole.length + fraction.length > 30) return null;
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const integer = BigInt(`${negative ? "-" : ""}${whole}${fraction}`);
  return { canonical: `${negative && integer !== 0n ? "-" : ""}${normalizedWhole}${fraction ? `.${fraction}` : ""}`, integer, scale: fraction.length };
}
function parseMoney(cell: Cell | undefined, unit: "dollars" | "cents", currency: string): { cents: bigint; canonical: string } | null {
  if (!cell || typeof cell.value === "boolean" || empty(cell)) return null;
  if (typeof cell.value === "number" && (Math.abs(cell.value) > Number.MAX_SAFE_INTEGER / (unit === "cents" ? 1 : 100))) return null;
  let raw = stringValue(cell).trim();
  const symbol = raw.match(/^([€£$])\s*/)?.[1];
  if (symbol) {
    if (symbol === "€" && currency !== "EUR" || symbol === "£" && currency !== "GBP" || symbol === "$" && !["USD", "CAD", "AUD"].includes(currency) || unit === "cents") return null;
    raw = raw.replace(/^[€£$]\s*/, "");
  }
  const code = raw.match(/^([A-Za-z]{3})\s+/)?.[1];
  if (code) { if (code.toUpperCase() !== currency || unit === "cents") return null; raw = raw.slice(code.length).trim(); }
  const parsed = parseDecimal(raw, unit === "cents" ? 0 : 2);
  if (!parsed || parsed.integer <= 0n) return null;
  const cents = parsed.integer * 10n ** BigInt((unit === "cents" ? 0 : 2) - parsed.scale);
  return { cents, canonical: unit === "cents" ? cents.toString() : `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}` };
}
function validDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  const max = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= max;
}
function parseDate(cell: Cell | undefined, order?: "MDY" | "DMY"): { value?: string; ambiguous?: boolean } {
  // Sheets represents native dates as serial days. Trust only explicit DATE
  // metadata and integral days; DATE_TIME and unformatted numbers stay manual.
  // UTC is arithmetic here, not conversion of a spreadsheet's local timezone.
  if (cell && typeof cell.value === "number") {
    if (cell.numberFormat?.type !== "DATE" || !Number.isSafeInteger(cell.value)) return {};
    const epoch = Date.UTC(1899, 11, 30), milliseconds = epoch + cell.value * 86_400_000;
    if (milliseconds < Date.UTC(1900, 0, 1) || milliseconds > Date.UTC(2200, 11, 31)) return {};
    return { value: new Date(milliseconds).toISOString().slice(0, 10) };
  }
  if (!cell || typeof cell.value !== "string") return {};
  const text = cell.value.trim();
  let year: number, month: number, day: number;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) [, year, month, day] = iso.map(Number);
  else {
    const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!local) return {};
    const first = Number(local[1]), second = Number(local[2]); year = Number(local[3]);
    if (!order && first <= 12 && second <= 12 && first !== second) return { ambiguous: true };
    const resolvedOrder = order ?? (first > 12 ? "DMY" : "MDY");
    month = resolvedOrder === "MDY" ? first : second; day = resolvedOrder === "MDY" ? second : first;
  }
  return validDate(year, month, day) ? { value: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}` } : {};
}
function compareTotals(a: ReconcileTotals, b: ReconcileTotals) { return canonical(a) === canonical(b); }
type RecordRow = { ref: SourceRef; donorRef: SourceRef; donorCell?: Cell; giftId: string; donorId: string; name: string; email: string; phone: string; transactionSignature: string };

export function scanWorkbooks(workbooks: WorkbookSnapshot[], options: ScanOptions = {}): ScanReport {
  assertSnapshots(workbooks);
  if (!options || typeof options !== "object" || options.tabs !== undefined && !Array.isArray(options.tabs)) throw new Error("Scan options are invalid.");
  const tabOptions = new Map<string, NonNullable<ScanOptions["tabs"]>[number]>();
  for (const option of options.tabs ?? []) {
    if (!option || typeof option.workbookId !== "string" || !Number.isSafeInteger(option.sheetId)) throw new Error("Tab options require workbook and tab identifiers.");
    const key = `${option.workbookId}:${option.sheetId}`;
    if (tabOptions.has(key) || !workbooks.some(book => book.id === option.workbookId && book.tabs.some(tab => tab.id === option.sheetId))) throw new Error("Tab options are duplicated or outside the selected scope.");
    if (option.amountUnit !== undefined && !["dollars", "cents"].includes(option.amountUnit) || option.dateOrder !== undefined && !["DMY", "MDY"].includes(option.dateOrder) || option.currency !== undefined && !currencies.has(option.currency)) throw new Error("Amount unit, currency, or date order is unsupported.");
    if (option.requiredFields && (!Array.isArray(option.requiredFields) || option.requiredFields.some(field => !RECONCILE_FIELDS.includes(field)))) throw new Error("Required fields are unsupported.");
    tabOptions.set(key, option);
  }
  const findings: Finding[] = [], findingIds = new Set<string>(), mappings: ResolvedMapping[] = [], excluded: ScanReport["excluded"] = [], records: RecordRow[] = [];
  const totals: ReconcileTotals = { giftCount: 0, validAmountCount: 0, invalidAmountCount: 0, amountCentsByCurrency: {} };
  let rowCount = 0, tabCount = 0;
  const add = (finding: Omit<Finding, "id">) => {
    const id = digest(finding);
    if (!findingIds.has(id)) { findingIds.add(id); findings.push({ id, ...finding }); }
    if (findings.length > LIMITS.findings) throw new Error("Too many findings. Select a smaller scan scope.");
  };
  for (const book of workbooks) for (const tab of book.tabs) {
    if (tab.excluded || isSensitiveLabel(tab.title)) { excluded.push({ workbookId: book.id, sheetId: tab.id, reason: "Private or counseling tab excluded from general reconciliation." }); continue; }
    tabCount++;
    const originalHeaders = (tab.rows[0] ?? []).map(stringValue);
    const privateColumns = new Set([...(tab.excludedColumns ?? []), ...originalHeaders.flatMap((header, index) => isSensitiveLabel(header) ? [index] : [])]);
    if (privateColumns.size) excluded.push({ workbookId: book.id, sheetId: tab.id, columns: [...privateColumns].sort((a, b) => a - b), reason: "Private columns excluded from general reconciliation." });
    const headers = originalHeaders.map((header, column) => privateColumns.has(column) ? "[excluded private column]" : header);
    const option = tabOptions.get(`${book.id}:${tab.id}`);
    const mapping: FieldMapping = {};
    for (const field of RECONCILE_FIELDS) {
      const candidates = originalHeaders.flatMap((header, index) => !privateColumns.has(index) && aliases[field].includes(normalizeHeader(header)) ? [index] : []);
      mapping[field] = candidates.length === 1 ? candidates[0] : null;
      if (candidates.length > 1 && option?.mapping?.[field] === undefined) add({ type: "schema", severity: "warning", message: `Multiple headers match ${field}. Confirm one column in the mapping.`, refs: candidates.map(column => reference(book, tab, 1, column + 1)) });
    }
    if (option?.mapping) {
      if (typeof option.mapping !== "object" || Array.isArray(option.mapping)) throw new Error("Column mapping must be an object.");
      for (const [field, column] of Object.entries(option.mapping)) {
        if (!RECONCILE_FIELDS.includes(field as ReconcileField) || column !== null && (!Number.isSafeInteger(column) || column < 0 || column >= headers.length || privateColumns.has(column))) throw new Error("Column mapping is outside the public header range or uses a private column.");
        mapping[field as ReconcileField] = column;
      }
    }
    const columns = Object.values(mapping).filter((column): column is number => column !== null && column !== undefined);
    if (new Set(columns).size !== columns.length) throw new Error("Each mapped field must use a distinct column.");
    const kind = mapping.amount !== null && mapping.amount !== undefined ? "gifts" : mapping.donor_id !== null || mapping.email !== null ? "donors" : "generic";
    const requiredFields: ReconcileField[] = option?.requiredFields ?? (kind === "gifts" ? ["gift_id", "donor_id", "amount", "date"] : kind === "donors" ? ["donor_id", "name"] : []);
    const amountHeader = mapping.amount == null ? "" : normalizeHeader(originalHeaders[mapping.amount]);
    const resolved: ResolvedMapping = { workbookId: book.id, sheetId: tab.id, sheetTitle: tab.title, mapping, headers, confirmed: !!option?.mapping, kind, requiredFields, amountUnit: option?.amountUnit ?? (amountHeader === "amount cents" ? "cents" : "dollars"), currency: option?.currency ?? "USD", ...(option?.dateOrder ? { dateOrder: option.dateOrder } : {}) };
    mappings.push(resolved);
    if (!columns.length && tab.rows.length) add({ type: "schema", severity: "warning", message: "No supported headers recognized. Map fields before validating this tab.", refs: [reference(book, tab, 1, 1)] });
    for (const field of requiredFields) if (mapping[field] == null) add({ type: "schema", severity: "error", message: `Required ${field} column is not mapped.`, refs: [reference(book, tab, 1, 1)] });
    for (let index = 1; index < tab.rows.length; index++) {
      const row = tab.rows[index];
      if (!columns.some(column => !empty(row[column]))) continue;
      rowCount++;
      const cell = (field: ReconcileField) => mapping[field] == null ? undefined : row[mapping[field]!];
      const ref = (field: ReconcileField) => reference(book, tab, index + 1, (mapping[field] ?? columns[0] ?? 0) + 1);
      const value = (field: ReconcileField) => stringValue(cell(field)).trim();
      const normalize = (field: ReconcileField, normalized: string, reason: string) => {
        const before = cell(field);
        if (!before || before.formula || typeof before.value !== "string" || before.value === normalized) return;
        const fix: CellFix = { ref: ref(field), before: structuredClone(before), after: { ...structuredClone(before), value: normalized }, reason };
        add({ type: "normalization", severity: "info", message: reason, refs: [fix.ref], proposedFix: fix });
      };
      for (const field of requiredFields) if (mapping[field] != null && empty(cell(field))) add({ type: "missing_required", severity: "error", message: `Required ${field} is missing. Enter a verified value manually.`, refs: [ref(field)] });
      for (const field of RECONCILE_FIELDS) if (cell(field)?.formula) add({ type: "formula_review", severity: "info", message: `The ${field} value is calculated by a formula. Formulas are preserved; automatic fixes are unavailable.`, refs: [ref(field)] });
      for (const field of ["name", "email", "phone", "channel"] as const) if (value(field)) normalize(field, value(field), `Remove surrounding whitespace from ${field}; preserve the content.`);
      const currency = mapping.currency != null ? value("currency").toUpperCase() : resolved.currency;
      const validCurrency = currencies.has(currency);
      if (mapping.currency != null && !validCurrency) add({ type: "invalid_currency", severity: "error", message: "Currency must be an explicit supported code (USD, EUR, GBP, CAD, AUD). No exchange conversion is performed.", refs: [ref("currency")] });
      else if (mapping.currency != null) normalize("currency", currency, "Use the canonical uppercase currency code without changing currency.");
      const money = validCurrency ? parseMoney(cell("amount"), resolved.amountUnit, currency) : null;
      if (kind === "gifts") {
        totals.giftCount++;
        if (money) { totals.validAmountCount++; totals.amountCentsByCurrency[currency] = (BigInt(totals.amountCentsByCurrency[currency] ?? "0") + money.cents).toString(); normalize("amount", money.canonical, "Normalize the amount's text representation; exact currency and cents remain unchanged."); }
        else { totals.invalidAmountCount++; if (!empty(cell("amount"))) add({ type: "invalid_amount", severity: "error", message: "Amount must be positive, exact, and consistent with the selected currency and unit. Decimal-comma, excess precision, negative/refund and ambiguous values need manual review.", refs: [ref("amount")] }); }
      }
      const parsedDate = parseDate(cell("date"), resolved.dateOrder);
      if (mapping.date != null && !empty(cell("date"))) {
        if (parsedDate.ambiguous) add({ type: "ambiguous_date", severity: "warning", message: "Date order is ambiguous. Confirm MDY or DMY for this tab before proposing a fix.", refs: [ref("date")] });
        else if (!parsedDate.value) add({ type: "invalid_date", severity: "error", message: "Date must be a real calendar day from 1900 through 2200. Only integral native DATE serials are supported; unformatted numbers, timestamps, and unsupported date text need manual review.", refs: [ref("date")] });
        else normalize("date", parsedDate.value, "Normalize the unambiguous calendar date to YYYY-MM-DD.");
      }
      if (mapping.quantity != null && !empty(cell("quantity"))) {
        const quantity = cell("quantity")?.value;
        const parsed = typeof quantity === "boolean" || typeof quantity === "number" && Math.abs(quantity) > Number.MAX_SAFE_INTEGER ? null : parseDecimal(value("quantity"), 6);
        if (!parsed) add({ type: "invalid_number", severity: "error", message: "Quantity must use an exact decimal number with at most six decimal places; locale-ambiguous values need manual review.", refs: [ref("quantity")] });
        else normalize("quantity", parsed.canonical, "Normalize numeric formatting without changing the exact value.");
      }
      if (kind !== "generic") records.push({ ref: ref(kind === "gifts" ? "gift_id" : "donor_id"), donorRef: ref("donor_id"), donorCell: cell("donor_id"), giftId: kind === "gifts" ? value("gift_id") : "", donorId: value("donor_id"), name: value("name").toLocaleLowerCase("en-US"), email: value("email").toLocaleLowerCase("en-US"), phone: value("phone").replace(/\D/g, ""), transactionSignature: canonical({ donorId: value("donor_id"), amount: money?.cents.toString() ?? cell("amount") ?? null, currency, date: parsedDate.value ?? cell("date") ?? null, channel: value("channel").toLowerCase(), formulas: Object.fromEntries((["gift_id", "donor_id", "amount", "currency", "date", "channel"] as const).map(field => [field, cell(field)?.formula ?? ""])) }) });
    }
  }
  function groups(key: (row: RecordRow) => string): RecordRow[][] {
    const map = new Map<string, RecordRow[]>();
    for (const row of records) { const value = key(row); if (value) { const group = map.get(value); if (group) group.push(row); else map.set(value, [row]); } }
    return [...map.values()].filter(rows => rows.length > 1);
  }
  const conflictingDonorIds = new Set<string>();
  for (const rows of groups(row => row.giftId)) {
    const signatures = new Set(rows.map(row => row.transactionSignature));
    if (signatures.size > 1) rows.forEach(row => conflictingDonorIds.add(row.donorId));
    add({ type: signatures.size === 1 ? "duplicate_gift" : "conflicting_record", severity: signatures.size === 1 ? "warning" : "error", message: signatures.size === 1 ? "The same gift identifier occurs more than once. Review provenance; every gift row and all cents are retained." : "The same gift identifier has conflicting record values. Resolve from source evidence; no merge or deletion is proposed.", refs: rows.map(row => row.ref) });
  }
  for (const rows of groups(row => row.donorId)) {
    const conflictFields = (["email", "phone", "name"] as const).filter(field => new Set(rows.map(row => row[field]).filter(Boolean)).size > 1);
    if (conflictFields.length) { conflictingDonorIds.add(rows[0].donorId); add({ type: "identity_conflict", severity: "warning", message: `One donor identifier has different ${conflictFields.join(", ")} values. Confirm identity manually; original records are preserved.`, refs: rows.map(row => row.ref) }); }
  }
  const donorRecords = new Map<string, RecordRow[]>();
  for (const row of records) { const related = donorRecords.get(row.donorId); if (related) related.push(row); else donorRecords.set(row.donorId, [row]); }
  const identityLinks = new Map<string, Set<string>>();
  for (const field of ["email", "phone"] as const) for (const rows of groups(row => field === "phone" && row.phone.length < 7 ? "" : row[field])) {
    const donorIds = [...new Set(rows.map(row => row.donorId).filter(Boolean))].sort();
    if (donorIds.length <= 1) continue;
    add({ type: "duplicate_identity", severity: "warning", message: `Different donor identifiers share a normalized ${field}. Review the original records before deciding whether these represent the same donor. Gift rows are never deleted.`, refs: rows.map(row => row.ref) });
    for (const id of donorIds) {
      const links = identityLinks.get(id) ?? new Set<string>();
      links.add(donorIds[0]); identityLinks.set(id, links);
      const firstLinks = identityLinks.get(donorIds[0]) ?? new Set<string>();
      firstLinks.add(id); identityLinks.set(donorIds[0], firstLinks);
    }
  }
  const visited = new Set<string>();
  for (const id of [...identityLinks.keys()].sort()) {
    if (visited.has(id)) continue;
    const donorIds: string[] = [], queue = [id];
    while (queue.length) {
      const next = queue.pop()!;
      if (visited.has(next)) continue;
      visited.add(next); donorIds.push(next);
      for (const link of identityLinks.get(next) ?? []) if (!visited.has(link)) queue.push(link);
    }
    donorIds.sort();
    const related = donorIds.flatMap(id => donorRecords.get(id) ?? []);
    const names = new Set(related.map(row => row.name));
    const compatible = names.size === 1 && !names.has("") && donorIds.every(id => !conflictingDonorIds.has(id)) && (["email", "phone"] as const).every(contact => new Set(related.map(row => row[contact]).filter(Boolean)).size <= 1);
    if (!compatible) continue;
    const canonicalId = donorIds[0];
    // An alias is a coherent decision: every occurrence must be editable, otherwise
    // the copy could split one original donor ID into old and new identities.
    if (related.some(row => row.donorId !== canonicalId && (!row.donorCell || row.donorCell.formula || typeof row.donorCell.value !== "string"))) continue;
    const canonicalRef = related.find(row => row.donorId === canonicalId)!.donorRef;
    for (const row of related) {
      if (row.donorId === canonicalId) continue;
      const reason = "After reviewing shared contact evidence, identical normalized names, and compatible contacts, explicitly approve this donor identifier change in the correction copy. Every occurrence of this alias must be reviewed together. All gift rows and cents remain.";
      const groupId = digest({ alias: row.donorId, canonical: canonicalId });
      add({ type: "duplicate_identity", severity: "warning", message: reason, refs: [row.donorRef, canonicalRef], proposedFix: { ref: row.donorRef, before: structuredClone(row.donorCell!), after: { ...structuredClone(row.donorCell!), value: canonicalId }, reason, groupId } });
    }
  }
  const hash = snapshotHash(workbooks);
  const report = { snapshotHash: hash, options: structuredClone(options), findings, mappings, totals, excluded, scope: { workbookIds: workbooks.map(book => book.id), tabCount, rowCount }, limits: ["Supports mapped donation/contact tables; the first row is the header. It does not detect every spreadsheet problem.", "Money uses exact decimal arithmetic and separate currency totals. No exchange conversion, refunds, formula rewrites, row deletion, or unreviewed identity merge.", "Private-label tabs and columns are excluded by a conservative heuristic. Review scope because unlabeled sensitive data cannot be recognized reliably.", "US-style numeric separators only. Ambiguous day/month dates need an explicit per-tab order. Only integral native DATE serials are supported; DATE_TIME and unformatted numbers need manual review.", "All proposed edits require confirmed mappings and explicit review, and apply only to correction copies. Source records and formulas are retained."] };
  return { id: digest(report), ...report };
}

/** Only deterministic safe proposals can become an approved correction-copy plan. */
export function buildCorrectionPlan(workbooks: WorkbookSnapshot[], report: ScanReport, selectedFindingIds: string[]): CorrectionPlan {
  if (!report || report.snapshotHash !== snapshotHash(workbooks)) throw new Error("Source snapshot changed. Scan and review again.");
  const fresh = scanWorkbooks(workbooks, report.options);
  if (fresh.id !== report.id) throw new Error("Scan report or mapping changed. Scan and review again.");
  if (!Array.isArray(selectedFindingIds) || !selectedFindingIds.length || new Set(selectedFindingIds).size !== selectedFindingIds.length) throw new Error("Select at least one distinct safe fix.");
  const patches = selectedFindingIds.map(id => {
    const finding = fresh.findings.find(item => item.id === id);
    if (!finding?.proposedFix) throw new Error("A selected finding requires manual review and has no safe automatic fix.");
    if (!fresh.mappings.some(mapping => mapping.workbookId === finding.proposedFix!.ref.workbookId && mapping.sheetId === finding.proposedFix!.ref.sheetId && mapping.confirmed)) throw new Error("Confirm the column mapping for each edited tab before approving fixes.");
    return structuredClone(finding.proposedFix);
  });
  assertCompleteIdentityGroups(fresh, selectedFindingIds);
  const keys = patches.map(patch => `${patch.ref.workbookId}:${patch.ref.sheetId}:${patch.ref.row}:${patch.ref.column}`);
  if (new Set(keys).size !== keys.length) throw new Error("Multiple proposals target the same cell. Review a single proposal per cell.");
  const plan = { scanId: fresh.id, snapshotHash: fresh.snapshotHash, options: structuredClone(fresh.options), findingIds: [...selectedFindingIds].sort(), patches: patches.sort((a, b) => lexical(canonical(a.ref), canonical(b.ref))), totals: structuredClone(fresh.totals), workbookIds: [...new Set(patches.map(patch => patch.ref.workbookId))].sort(), mode: "correction_copy" as const };
  const result = { id: digest(plan), ...plan };
  applyCorrectionPlan(workbooks, result);
  return result;
}

export function applyCorrectionPlan(workbooks: WorkbookSnapshot[], plan: CorrectionPlan): WorkbookSnapshot[] {
  assertSnapshots(workbooks);
  if (!plan || plan.mode !== "correction_copy" || plan.snapshotHash !== snapshotHash(workbooks)) throw new Error("Source snapshot changed. Scan and review again.");
  const { id, ...body } = plan;
  if (digest(body) !== id) throw new Error("Correction plan was modified after review.");
  const before = scanWorkbooks(workbooks, plan.options);
  if (before.id !== plan.scanId || !compareTotals(before.totals, plan.totals)) throw new Error("Correction plan does not match its scan.");
  const allowed = new Map(before.findings.filter(finding => finding.proposedFix).map(finding => [finding.id, finding.proposedFix!]));
  const approved = plan.findingIds.map(findingId => allowed.get(findingId));
  if (approved.some(patch => !patch) || !approved.length || new Set(plan.findingIds).size !== plan.findingIds.length || canonical([...approved].sort((a, b) => lexical(canonical(a!.ref), canonical(b!.ref)))) !== canonical(plan.patches)) throw new Error("Correction plan contains an unapproved or unsafe patch.");
  assertCompleteIdentityGroups(before, plan.findingIds);
  if (canonical([...new Set(plan.patches.map(patch => patch.ref.workbookId))].sort()) !== canonical(plan.workbookIds)) throw new Error("Correction plan workbook scope was modified.");
  const copies = structuredClone(workbooks);
  for (const patch of plan.patches) {
    if (!before.mappings.some(mapping => mapping.workbookId === patch.ref.workbookId && mapping.sheetId === patch.ref.sheetId && mapping.confirmed)) throw new Error("Confirm the column mapping for each edited tab before approving fixes.");
    const tab = copies.find(book => book.id === patch.ref.workbookId)?.tabs.find(item => item.id === patch.ref.sheetId);
    const current = tab?.rows[patch.ref.row - 1]?.[patch.ref.column - 1];
    if (!tab || !current || current.formula || patch.after.formula || canonical(current) !== canonical(patch.before)) throw new Error("A correction target changed or contains a formula.");
    tab.rows[patch.ref.row - 1][patch.ref.column - 1] = structuredClone(patch.after);
  }
  const after = scanWorkbooks(copies, plan.options);
  if (!compareTotals(before.totals, after.totals)) throw new Error("Correction would change gift counts or exact monetary totals.");
  return copies;
}

function assertCompleteIdentityGroups(report: ScanReport, ids: string[]) {
  const selected = new Set(ids);
  const groups = new Set(report.findings.filter(finding => selected.has(finding.id)).map(finding => finding.proposedFix?.groupId).filter(Boolean));
  if (report.findings.some(finding => finding.proposedFix?.groupId && groups.has(finding.proposedFix.groupId) && !selected.has(finding.id))) throw new Error("Select every row in this identity decision together; partial donor identity changes are blocked.");
}
