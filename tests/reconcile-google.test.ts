import assert from "node:assert/strict";
import test from "node:test";
import { createCorrectionCopies, createGoogleSheetsClient, GOOGLE_RECONCILE_SCOPES, type CopyJournal, type GoogleSheetsClient } from "../src/lib/reconcile-google";
import type { Cell, WorkbookSnapshot } from "../src/lib/reconcile-types";

function book(id = "source_one"): WorkbookSnapshot {
  return { id, name: "Donations", version: "7", tabs: [
    { id: 10, title: "Gifts", rows: [["Gift ID", "Name", "Amount", "Date"].map(value => ({ value })), ["gift-1", "Rosa", "12.00", "2026-10-10"].map(value => ({ value }))] },
    { id: 20, title: "Second tab", rows: [[{ value: "Quantity" }], [{ value: 2 }]] },
  ] };
}
function googleCell(cell: Cell) {
  const value = cell.value === null ? {} : { [typeof cell.value === "number" ? "numberValue" : typeof cell.value === "boolean" ? "boolValue" : "stringValue"]: cell.value };
  return { userEnteredValue: cell.formula ? { formulaValue: cell.formula } : value, effectiveValue: value, ...(cell.numberFormat ? { userEnteredFormat: { numberFormat: cell.numberFormat }, effectiveFormat: { numberFormat: cell.numberFormat } } : {}) };
}
function col(value: string) { return [...value].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1; }
function fakeGoogle(initial = [book()]) {
  const workbooks = new Map(initial.map(value => [value.id, structuredClone(value)]));
  const calls: { url: URL; method: string; body?: any; headers: Headers }[] = [];
  let created = 0, failCreate = false, failRead = false, failWriteAfter = false;
  let pages: { files: { id: string; name: string }[]; nextPageToken?: string; incompleteSearch?: boolean }[] | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); const method = init?.method ?? "GET"; const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body, headers: new Headers(init?.headers) });
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-google-token");
    if (url.hostname === "www.googleapis.com") {
      if (url.pathname === "/drive/v3/about") return Response.json({ user: { permissionId: "permission_user_fixture" } });
      const id = url.pathname.split("/")[4];
      if (!id) return Response.json(pages ? pages[Number(url.searchParams.get("pageToken") ?? "0")] : { files: initial.map(item => ({ id: item.id, name: item.name })) });
      const workbook = workbooks.get(id);
      return workbook ? Response.json({ id, name: workbook.name, version: workbook.version, mimeType: "application/vnd.google-apps.spreadsheet" }) : Response.json({}, { status: 404 });
    }
    assert.equal(url.hostname, "sheets.googleapis.com");
    if (method === "POST" && url.pathname === "/v4/spreadsheets") {
      const id = `copy_${++created}`;
      workbooks.set(id, { id, name: body.properties.title, version: "1", tabs: body.sheets.map((sheet: any) => ({ id: sheet.properties.sheetId, title: sheet.properties.title, rows: [] })) });
      if (failCreate) throw new Error("lost response");
      return Response.json({ spreadsheetId: id });
    }
    const id = url.pathname.split("/")[3].split(":")[0]; const workbook = workbooks.get(id);
    if (!workbook) return Response.json({}, { status: 404 });
    if (method === "POST") {
      assert.match(id, /^copy_/);
      for (const request of body.requests) {
        const update = request.updateCells;
        const tab = workbook.tabs.find(item => item.id === update.start.sheetId)!;
        tab.rows = update.rows.map((row: any) => row.values.map((value: any) => {
          const v = value.userEnteredValue ?? {};
          return { value: v.stringValue ?? v.numberValue ?? v.boolValue ?? null, ...(v.formulaValue ? { formula: v.formulaValue } : {}), ...(value.userEnteredFormat?.numberFormat ? { numberFormat: value.userEnteredFormat.numberFormat } : {}) };
        }));
      }
      if (failWriteAfter) throw new Error("write response lost");
      return Response.json({});
    }
    if (failRead && id.startsWith("copy_")) throw new Error("read unavailable");
    const metadata = !url.searchParams.get("fields")?.includes("rowData");
    const ranges = url.searchParams.getAll("ranges");
    return Response.json({ spreadsheetId: id, properties: { title: workbook.name }, sheets: workbook.tabs.flatMap(tab => {
      const applicable = ranges.filter(range => range.startsWith(`'${tab.title.replaceAll("'", "''")}'!`));
      if (ranges.length && !applicable.length) return [];
      const data = applicable.length ? applicable.map(range => {
        const parsed = /!([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range)!;
        const startColumn = col(parsed[1]), startRow = Number(parsed[2]) - 1, endColumn = col(parsed[3]), endRow = Number(parsed[4]);
        return { startColumn, startRow, rowData: tab.rows.slice(startRow, endRow).map(row => ({ values: row.slice(startColumn, endColumn + 1).map(googleCell) })) };
      }) : [{ rowData: tab.rows.map(row => ({ values: row.map(googleCell) })) }];
      return [{ properties: { sheetId: tab.id, title: tab.title, sheetType: "GRID", gridProperties: { rowCount: Math.max(1, tab.rows.length), columnCount: Math.max(1, ...tab.rows.map(row => row.length)) } }, ...(metadata ? {} : { data }) }];
    }) });
  };
  return { client: createGoogleSheetsClient({ accessToken: "test-google-token", fetchImpl }), workbooks, calls, setPages: (value: typeof pages) => { pages = value; }, loseCreateResponse: () => { failCreate = true; }, loseWriteResponse: () => { failWriteAfter = true; }, setReadFailure: (value: boolean) => { failRead = value; }, created: () => created };
}
function copyInput(snapshot = book()) {
  const checkpoints: CopyJournal[] = [];
  return { operationId: "operation_test_123", snapshots: [snapshot], sourceVersions: [{ id: snapshot.id, version: snapshot.version }], checkpoint: async (journal: CopyJournal) => { checkpoints.push(structuredClone(journal)); }, checkpoints };
}

test("Google discovery follows pagination and returns metadata only with exact limited scopes", async () => {
  const fake = fakeGoogle();
  fake.setPages([{ files: [{ id: "one", name: "First" }], nextPageToken: "1" }, { files: [{ id: "two", name: "Second" }] }]);
  assert.deepEqual(await fake.client.discoverWorkbooks(), { complete: true, workbooks: [{ id: "one", name: "First" }, { id: "two", name: "Second" }] });
  assert.equal(fake.calls.length, 2);
  assert.ok(fake.calls.every(call => call.url.searchParams.get("q")?.includes("spreadsheet")));
  assert.deepEqual(GOOGLE_RECONCILE_SCOPES, ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.file"]);
});

test("Google discovery refuses incomplete or looping results instead of claiming all files", async () => {
  const fake = fakeGoogle(); fake.setPages([{ files: [], incompleteSearch: true }]);
  await assert.rejects(fake.client.discoverWorkbooks(), /incomplete/);
  fake.setPages([{ files: [], nextPageToken: "0" }]);
  await assert.rejects(fake.client.discoverWorkbooks(), /repeated/);
});

test("Explicit multi-workbook scan reads every allowed tab, raw values and formulas", async () => {
  const first = book(), second = book("source_two"); second.tabs[1].rows.push([{ value: 5, formula: "=SUM(2,3)" }]);
  const fake = fakeGoogle([first, second]); const result = await fake.client.readWorkbooks([first.id, second.id]);
  assert.equal(result.length, 2); assert.equal(result[0].tabs.length, 2);
  assert.deepEqual(result[1].tabs[1].rows[2][0], { value: 5, formula: "=SUM(2,3)" });
  assert.ok(fake.calls.every(call => call.method === "GET"));
  await assert.rejects(fake.client.readWorkbooks([]), /Explicitly/);
  await assert.rejects(fake.client.readWorkbooks([first.id, first.id]), /Explicitly/);
  await assert.rejects(fake.client.readWorkbooks(["../credential"]), /Invalid/);
});

test("Private tabs are never read; private column bodies are excluded at Google range boundary", async () => {
  const value = book();
  value.tabs.push({ id: 30, title: "Counseling notes", rows: [[{ value: "SENTINEL_PRIVATE_TAB" }]] });
  value.tabs[0].rows[0].push({ value: "Private notes" }); value.tabs[0].rows[1].push({ value: "SENTINEL_PRIVATE_CELL" });
  const fake = fakeGoogle([value]); const [result] = await fake.client.readWorkbooks([value.id]);
  assert.equal(result.tabs[2].rows.length, 0); assert.match(result.tabs[2].excluded!, /Private/);
  assert.deepEqual(result.tabs[0].excludedColumns, [4]);
  assert.ok(!JSON.stringify(result).includes("SENTINEL"));
  const ranges = fake.calls.flatMap(call => call.url.searchParams.getAll("ranges"));
  assert.ok(!ranges.some(range => range.includes("Counseling")));
  assert.ok(!ranges.some(range => /E2|E\d{2,}/.test(range)));
});

test("Concurrent edit during snapshot aborts without a partial result", async () => {
  const fake = fakeGoogle(); let seen = false;
  const base = fake.client.getVersion;
  // Real client's internal getVersion is tested through a transport version change on header/body fetch.
  const values = book(); let calls = 0;
  const client = createGoogleSheetsClient({ accessToken: "x", fetchImpl: async input => {
    const url = new URL(String(input));
    if (url.hostname === "www.googleapis.com") return Response.json({ name: values.name, version: String(++calls), mimeType: "application/vnd.google-apps.spreadsheet" });
    seen = true;
    return Response.json({ properties: { title: "Empty" }, sheets: [] });
  } });
  await assert.rejects(client.readWorkbooks([values.id]), /changed while reading/); assert.ok(seen); assert.equal(await base(values.id), "7");
});

test("Correction copies require checkpoint before creation, verify readback and never modify source", async () => {
  const fake = fakeGoogle(); const input = copyInput(); const original = structuredClone(fake.workbooks.get("source_one"));
  input.snapshots[0].tabs[0].rows[1][1].value = "Rosa Delgado";
  const journal = await createCorrectionCopies(fake.client, input);
  assert.equal(journal.status, "complete"); assert.equal(journal.entries[0].status, "verified");
  assert.equal(journal.entries[0].copyId, "copy_1"); assert.match(journal.entries[0].url!, /docs.google.com/);
  assert.equal(input.checkpoints[1].entries[0].status, "creating");
  assert.deepEqual(fake.workbooks.get("source_one"), original);
  const count = fake.calls.length;
  assert.equal((await createCorrectionCopies(fake.client, { ...input, journal })).status, "complete");
  assert.equal(fake.calls.length, count); assert.equal(fake.created(), 1);
});

test("Source version conflict prevents all creation including cross-workbook evidence", async () => {
  const fake = fakeGoogle([book(), book("other_source")]); const input = copyInput();
  input.sourceVersions.push({ id: "other_source", version: "6" });
  const result = await createCorrectionCopies(fake.client, input);
  assert.equal(result.status, "blocked"); assert.equal(fake.created(), 0); assert.match(result.message!, /changed/);
});

test("Unknown create outcome is recorded and retry never creates an additional copy", async () => {
  const fake = fakeGoogle(); fake.loseCreateResponse(); const input = copyInput();
  const journal = await createCorrectionCopies(fake.client, input);
  assert.equal(journal.entries[0].status, "uncertain"); assert.equal(journal.entries[0].copyId, undefined);
  assert.equal(fake.created(), 1);
  await createCorrectionCopies(fake.client, { ...input, journal }); assert.equal(fake.created(), 1);
});

test("Lost write response recovers through exact readback without another write", async () => {
  const fake = fakeGoogle(); fake.loseWriteResponse(); const input = copyInput();
  const journal = await createCorrectionCopies(fake.client, input);
  assert.equal(journal.status, "complete");
  assert.equal(fake.calls.filter(call => call.url.pathname.endsWith(":batchUpdate")).length, 1);
});

test("Interrupted readback retry verifies only the known copy and mismatches remain unverified", async () => {
  const fake = fakeGoogle(); fake.setReadFailure(true); const input = copyInput();
  const journal = await createCorrectionCopies(fake.client, input);
  assert.equal(journal.status, "partial"); assert.equal(journal.entries[0].copyId, "copy_1");
  fake.setReadFailure(false);
  fake.workbooks.get("copy_1")!.tabs[0].rows[1][1].value = "Concurrent copy edit";
  const resumed = await createCorrectionCopies(fake.client, { ...input, journal });
  assert.equal(resumed.status, "partial"); assert.equal(resumed.entries[0].status, "conflict");
  assert.equal(fake.created(), 1);
  assert.equal(fake.calls.filter(call => call.url.pathname.endsWith(":batchUpdate")).length, 1);
});

test("Known copy recovery succeeds after read failure with no extra creation", async () => {
  const fake = fakeGoogle(); fake.setReadFailure(true); const input = copyInput();
  const journal = await createCorrectionCopies(fake.client, input); fake.setReadFailure(false);
  assert.equal((await createCorrectionCopies(fake.client, { ...input, journal })).status, "complete"); assert.equal(fake.created(), 1);
});

test("Formula workbooks fail before creating or executing anything", async () => {
  const fake = fakeGoogle(); const input = copyInput(); input.snapshots[0].tabs[0].rows[1][1] = { value: "x", formula: '=IMPORTDATA("https://attacker.invalid")' };
  await assert.rejects(createCorrectionCopies(fake.client, input), /contains formulas/);
  assert.equal(fake.calls.length, 0); assert.equal(input.checkpoints.length, 0);
});

test("Only new same-process copy IDs can be written and string formulas remain literal", async () => {
  const fake = fakeGoogle(); await assert.rejects(fake.client.writeWorkbook("source_one", book()), /restricted/);
  const input = copyInput(); input.snapshots[0].tabs[0].rows[1][1].value = '=IMPORTDATA("https://example.invalid")';
  await createCorrectionCopies(fake.client, input);
  const write = fake.calls.find(call => call.url.pathname.endsWith(":batchUpdate"))!;
  assert.deepEqual(write.body.requests[0].updateCells.rows[1].values[1], { userEnteredValue: { stringValue: '=IMPORTDATA("https://example.invalid")' } });
});

test("Reusing operation ID with changed approved input is rejected", async () => {
  const fake = fakeGoogle(); const input = copyInput(); const journal = await createCorrectionCopies(fake.client, input);
  input.snapshots[0].tabs[0].rows[1][1].value = "Changed";
  await assert.rejects(createCorrectionCopies(fake.client, { ...input, journal }), /different reviewed/);
});

test("A failed durable checkpoint cannot reach a Google mutation", async () => {
  const fake = fakeGoogle(); const input = copyInput();
  await assert.rejects(createCorrectionCopies(fake.client, { ...input, checkpoint: async () => { throw new Error("disk full"); } }), /disk full/);
  assert.equal(fake.calls.length, 0);
});

test("A late source edit marks copies historical rather than complete", async () => {
  const fake = fakeGoogle(); const input = copyInput(); let checks = 0;
  const client: GoogleSheetsClient = { ...fake.client, getVersion: async () => ++checks > 1 ? "8" : "7" };
  const journal = await createCorrectionCopies(client, input);
  assert.equal(journal.status, "partial"); assert.equal(journal.entries[0].status, "conflict"); assert.match(journal.message!, /Source changed during/);
});

test("Partial multi-workbook failure retains verified first copy and never retries unknown creation", async () => {
  const first = book(), second = book("source_two"), fake = fakeGoogle([first, second]);
  const input = copyInput(); input.snapshots.push(second); input.sourceVersions.push({ id: second.id, version: second.version });
  let creations = 0;
  const client: GoogleSheetsClient = { ...fake.client, createWorkbook: async (snapshot, title) => { if (++creations === 2) throw new Error("lost"); return fake.client.createWorkbook(snapshot, title); } };
  const journal = await createCorrectionCopies(client, input);
  assert.equal(journal.status, "partial"); assert.equal(journal.entries[0].status, "verified"); assert.equal(journal.entries[1].status, "uncertain");
  assert.ok(journal.entries[0].verifiedAt);
  await createCorrectionCopies(client, { ...input, journal }); assert.equal(creations, 2);
});

test("Creation response cannot authorize source writing or source verification as a copy", async () => {
  const fake = fakeGoogle(), input = copyInput();
  const client: GoogleSheetsClient = { ...fake.client, createWorkbook: async () => "source_one" };
  const journal = await createCorrectionCopies(client, input);
  assert.equal(journal.status, "blocked"); assert.equal(journal.entries[0].copyId, undefined);
  assert.equal(fake.calls.filter(call => call.method === "POST").length, 0);
});

test("Copy creation independently rejects unsanitized private body columns", async () => {
  const fake = fakeGoogle(), input = copyInput();
  input.snapshots[0].tabs[0].rows[0].push({ value: "Private notes" });
  input.snapshots[0].tabs[0].rows[1].push({ value: "SENTINEL" });
  await assert.rejects(createCorrectionCopies(fake.client, input), /Private column/);
  assert.equal(fake.calls.length, 0);
});

test("Crash after creation retains empty known copy and recovery does not silently overwrite it", async () => {
  const fake = fakeGoogle(), input = copyInput();
  let journal: CopyJournal | undefined;
  await assert.rejects(createCorrectionCopies(fake.client, { ...input, checkpoint: async current => {
    if (current.entries[0].status === "writing") { journal = structuredClone(current); throw new Error("process stopped"); }
  } }), /process stopped/);
  assert.ok(journal?.entries[0].copyId);
  const result = await createCorrectionCopies(fake.client, { ...input, journal });
  assert.equal(result.entries[0].status, "conflict"); assert.equal(fake.created(), 1);
  assert.equal(fake.calls.filter(call => call.url.pathname.endsWith(":batchUpdate")).length, 0);
});

test("Google failures do not return response bodies or credentials in errors", async () => {
  const client = createGoogleSheetsClient({ accessToken: "secret-token", fetchImpl: async () => Response.json({ error: "SENTINEL_USER_DATA" }, { status: 403 }) });
  await assert.rejects(client.discoverWorkbooks(), error => error instanceof Error && /denied/.test(error.message) && !/SENTINEL|secret-token/.test(error.message));
});

test("Account identity is stable, hashed and uses only the existing Drive metadata permission", async () => {
  const fake = fakeGoogle(); const identity = await fake.client.getAccountIdentity();
  assert.match(identity, /^[a-f0-9]{64}$/); assert.equal(identity, await fake.client.getAccountIdentity());
  assert.equal(fake.calls[0].url.searchParams.get("fields"), "user(permissionId)");
  assert.ok(!identity.includes("permission_user_fixture"));
  const missing = createGoogleSheetsClient({ accessToken: "x", fetchImpl: async () => Response.json({ user: {} }) });
  await assert.rejects(missing.getAccountIdentity(), /account identity/);
});

test("Private workbook names exclude every tab before any cell request", async () => {
  const source = book(); source.name = "Counseling cases";
  const fake = fakeGoogle([source]); const [snapshot] = await fake.client.readWorkbooks([source.id]);
  assert.ok(snapshot.tabs.every(tab => tab.excluded && tab.rows.length === 0));
  assert.ok(fake.calls.every(call => !call.url.searchParams.has("ranges")));
});

test("Native date serial and its number format survive read, correction copy and readback", async () => {
  const source = book(); source.tabs[0].rows[1][3] = { value: 46305, numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } };
  source.tabs[0].rows[1][2] = { value: 12, numberFormat: { type: "CURRENCY", pattern: '"$"#,##0.00' } };
  const fake = fakeGoogle([source]);
  const [snapshot] = await fake.client.readWorkbooks([source.id]);
  assert.deepEqual(snapshot.tabs[0].rows[1][3], source.tabs[0].rows[1][3]);
  const input = copyInput(snapshot);
  assert.equal((await createCorrectionCopies(fake.client, input)).status, "complete");
  const output = await fake.client.readCreatedWorkbook("copy_1");
  assert.deepEqual(output.tabs[0].rows[1][3], source.tabs[0].rows[1][3]);
  assert.deepEqual(output.tabs[0].rows[1][2], source.tabs[0].rows[1][2]);
  const update = fake.calls.find(call => call.url.pathname.endsWith(":batchUpdate"))!.body.requests[0].updateCells;
  assert.equal(update.fields, "userEnteredValue,userEnteredFormat.numberFormat");
  assert.deepEqual(update.rows[1].values[3], { userEnteredValue: { numberValue: 46305 }, userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } });
});

test("Adapter never guesses date formatting from an unformatted numeric value", async () => {
  const source = book(); source.tabs[0].rows[1][3] = { value: 46305 };
  const fake = fakeGoogle([source]); const [snapshot] = await fake.client.readWorkbooks([source.id]);
  assert.deepEqual(snapshot.tabs[0].rows[1][3], { value: 46305 });
  const fields = fake.calls.filter(call => call.url.searchParams.getAll("ranges").length).map(call => call.url.searchParams.get("fields")!);
  assert.ok(fields.every(field => field.includes("numberFormat") && !field.includes("note") && !field.includes("textFormat") && !field.includes("hyperlink")));
});

test("Effective native date format is captured when no user-entered format is returned", async () => {
  let metadataCalls = 0;
  const client = createGoogleSheetsClient({ accessToken: "x", fetchImpl: async input => {
    const url = new URL(String(input));
    if (url.hostname === "www.googleapis.com") return Response.json({ name: "Native dates", version: "7", mimeType: "application/vnd.google-apps.spreadsheet" });
    metadataCalls++;
    const props = { sheetId: 1, title: "Gifts", sheetType: "GRID", gridProperties: { rowCount: 2, columnCount: 1 } };
    return Response.json({ properties: { title: "Native dates" }, sheets: [{ properties: props, ...(metadataCalls === 1 ? {} : { data: [{ rowData: [{ values: [{ userEnteredValue: { stringValue: "Date" } }] }, ...(metadataCalls === 2 ? [] : [{ values: [{ userEnteredValue: { numberValue: 46305 }, effectiveFormat: { numberFormat: { type: "DATE", pattern: "m/d/yyyy" } } }] }])] }] }) }] });
  } });
  const [snapshot] = await client.readWorkbooks(["native_dates"]);
  assert.deepEqual(snapshot.tabs[0].rows[1][0], { value: 46305, numberFormat: { type: "DATE", pattern: "m/d/yyyy" } });
});

test("Missing or empty Google source versions fail closed before any cell read", async () => {
  for (const version of [undefined, "", "invalid", 7]) {
    let calls = 0;
    const client = createGoogleSheetsClient({ accessToken: "x", fetchImpl: async input => {
      calls++; assert.equal(new URL(String(input)).hostname, "www.googleapis.com");
      return Response.json({ name: "Gifts", version, mimeType: "application/vnd.google-apps.spreadsheet" });
    } });
    await assert.rejects(client.readWorkbooks(["source_one"]), /valid source version/);
    assert.equal(calls, 1);
    await assert.rejects(client.getVersion("source_one"), /valid source version/);
  }
});
