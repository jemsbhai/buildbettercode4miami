import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { authenticateAddon, verifyGoogleIdentity } from "../src/lib/public/auth";
import { GoogleWorkbookGateway, parseSelectionLocation } from "../src/lib/public/google";
import { digest } from "../src/lib/evidence";
import type { SheetsExport, SheetsSelection } from "../src/lib/sheets-types";

const audience = "test-addon.apps.googleusercontent.com";
const principal = { sub: "google-user-1", email: "owner@example.test" };
const workbookId = "public-workbook-123";
const keys = generateKeyPair("RS256");

async function signed(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = await keys;
  const token = await new SignJWT({ email: principal.email, email_verified: true, nonce: "expected-nonce", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer(String(overrides.iss ?? "https://accounts.google.com"))
    .setSubject(String(overrides.sub ?? principal.sub)).setAudience(String(overrides.aud ?? audience)).setIssuedAt()
    .setExpirationTime(overrides.exp === undefined ? "5m" : Number(overrides.exp)).sign(privateKey);
  const key = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] });
  return { token, key };
}

test("public identity verifies cryptographic signature and nonce", async () => {
  const { token, key } = await signed();
  assert.deepEqual(await verifyGoogleIdentity(token, [audience], { key, nonce: "expected-nonce" }), principal);
  await assert.rejects(() => verifyGoogleIdentity(token, [audience], { key, nonce: "wrong" }), /did not match/);
  const parts = token.split("."); parts[1] = Buffer.from(JSON.stringify({ sub: "attacker", email: principal.email })).toString("base64url");
  await assert.rejects(() => verifyGoogleIdentity(parts.join("."), [audience], { key }), /could not be verified/);
});

test("public identity rejects other clients, issuers, expired and unverified accounts", async () => {
  for (const claims of [{ aud: "attacker.apps.googleusercontent.com" }, { iss: "https://attacker.example" }, { exp: 1 }, { email_verified: false }, { azp: "other.apps.googleusercontent.com" }]) {
    const { token, key } = await signed(claims);
    await assert.rejects(() => verifyGoogleIdentity(token, [audience], { key }));
  }
  const { token, key } = await signed();
  await assert.rejects(() => verifyGoogleIdentity(token, [], { key }), /not configured/);
});

test("addon binds access token to the verified Google subject", async () => {
  const headers = new Headers({ authorization: "Bearer signed-token", "x-tidepath-google-access-token": "google-access-token" });
  let requestCount = 0;
  const fakeFetch: typeof fetch = async (url, init) => {
    requestCount++;
    assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer google-access-token");
    return Response.json({ sub: principal.sub });
  };
  assert.deepEqual(await authenticateAddon(headers, { verify: async () => principal, fetch: fakeFetch }), principal);
  assert.equal(requestCount, 1);
  await assert.rejects(() => authenticateAddon(headers, { verify: async () => principal, fetch: async () => Response.json({ sub: "other-user" }) }), /accounts do not match/);
  await assert.rejects(() => authenticateAddon(new Headers(), { verify: async () => principal, fetch: fakeFetch }), /sign in again/);
  assert.equal(requestCount, 1);
});

test("addon accepts only its own access-token header and still verifies the signed identity", async () => {
  const { token, key } = await signed();
  let verificationCount = 0;
  let userinfoCount = 0;
  const dependencies = {
    audiences: [audience],
    verify: async (value: string, audiences: string[]) => {
      verificationCount++;
      return verifyGoogleIdentity(value, audiences, { key });
    },
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      userinfoCount++;
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer google-access-token");
      return Response.json({ sub: principal.sub });
    }) as typeof fetch,
  };
  const reserved = new Headers({ authorization: `Bearer ${token}`, "x-google-access-token": "google-access-token" });
  await assert.rejects(() => authenticateAddon(reserved, dependencies), /Open Tidepath from Google Sheets/);
  assert.equal(verificationCount, 0);
  assert.equal(userinfoCount, 0);

  const supported = new Headers({ authorization: `Bearer ${token}`, "x-tidepath-google-access-token": "google-access-token" });
  assert.deepEqual(await authenticateAddon(supported, dependencies), principal);
  assert.equal(verificationCount, 1);
  assert.equal(userinfoCount, 1);

  supported.set("authorization", "Bearer forged");
  await assert.rejects(() => authenticateAddon(supported, dependencies), /could not be verified/);
  assert.equal(verificationCount, 2);
  assert.equal(userinfoCount, 1);
});

test("workbook authorization rejects unreadable, noneditable and non-sheet files", async () => {
  for (const response of [new Response(null, { status: 404 }), Response.json({ id: workbookId, mimeType: "text/plain", capabilities: { canEdit: true } }), Response.json({ id: workbookId, mimeType: "application/vnd.google-apps.spreadsheet", capabilities: { canEdit: false } })]) {
    const google = new GoogleWorkbookGateway("access", async () => response);
    await assert.rejects(() => google.assertWorkbookAccess(workbookId));
  }
  const google = new GoogleWorkbookGateway("access", async () => Response.json({ id: workbookId, mimeType: "application/vnd.google-apps.spreadsheet", capabilities: { canEdit: true } }));
  await google.assertWorkbookAccess(workbookId);
});

test("selection bounds reject excessive ranges before Google data retrieval", () => {
  assert.throws(() => parseSelectionLocation({ workbookId, sheetId: 0, a1: "A1:AZ10000" }), /1,000 rows/);
  assert.throws(() => parseSelectionLocation({ workbookId, sheetId: 0, a1: "A1:A1" }));
  assert.throws(() => parseSelectionLocation({ workbookId: "x", sheetId: 0, a1: "A1:D4" }));
});

test("server selection uses actual numeric sheet ID, retains formulas and normalizes dates", async () => {
  const google = new GoogleWorkbookGateway("access", async (url, init) => {
    assert.match(String(url), /:getByDataFilter/);
    assert.deepEqual(JSON.parse(String(init?.body)).dataFilters[0].gridRange, { sheetId: 7, startRowIndex: 2, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 3 });
    return Response.json({ spreadsheetId: workbookId, sheets: [{ properties: { sheetId: 7, title: "Actual title" }, data: [{ startRow: 2, startColumn: 1, rowData: [
      { values: [{ effectiveValue: { stringValue: "Gift date" } }, { effectiveValue: { stringValue: "Amount" } }] },
      { values: [{ effectiveValue: { numberValue: 46333 }, effectiveFormat: { numberFormat: { type: "DATE" } } }, { effectiveValue: { numberValue: 12.34 }, userEnteredValue: { formulaValue: "=6.17*2" } }] },
    ] }] }] });
  });
  const result = await google.readSelection({ workbookId, sheetId: 7, a1: "B3:C4" });
  assert.equal(result.sheetName, "Actual title");
  assert.match(String(result.values[1][0]), /^2026-\d\d-\d\d$/);
  assert.equal(result.values[1][1], 12.34);
  assert.equal(result.formulas[1][1], "=6.17*2");
});

function source(): SheetsSelection { return { workbookId, sheetId: 7, sheetName: "Donations", a1: "A1:B2", startRow: 1, startColumn: 1, values: [["Gift", "Amount"], ["g-1", 5]], formulas: [["", ""], ["", ""]] }; }
function exported(selection: SheetsSelection): SheetsExport { return { draftId: "draft-1", revision: 1, approvalDigest: "a".repeat(64), sourceHash: digest(selection), text: "approved", rows: [["Report"], ["=Literal approved text"]] }; }

test("approved export creates one atomic literal-text tab and retries verify instead of overwrite", async () => {
  const selected = source(); const approved = exported(selected);
  let sheet: { properties: { sheetId: number; title: string }; developerMetadata: unknown[] } | undefined;
  let exportRows: { values: unknown[] }[] = []; let mutations = 0; let tamper = false; let changedSource = false; let changeDuringWrite = false;
  const fake: typeof fetch = async (url, init) => {
    const requestUrl = String(url); const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (requestUrl.includes(":batchUpdate")) {
      mutations++;
      const requests = body.requests;
      sheet = { properties: requests[0].addSheet.properties, developerMetadata: [requests[2].createDeveloperMetadata.developerMetadata] };
      exportRows = requests[1].updateCells.rows;
      if (changeDuringWrite) changedSource = true;
      assert.equal((exportRows[1].values[0] as { userEnteredValue: { stringValue: string } }).userEnteredValue.stringValue, "=Literal approved text");
      return Response.json({ spreadsheetId: workbookId });
    }
    if (!requestUrl.includes(":getByDataFilter")) return Response.json({ spreadsheetId: workbookId, sheets: sheet ? [sheet] : [] });
    const range = body.dataFilters[0].gridRange;
    if (range.sheetId === 7) return Response.json({ spreadsheetId: workbookId, sheets: [{ properties: { sheetId: 7, title: "Donations" }, data: [{ rowData: selected.values.map((row, index) => ({ values: row.map(value => ({ effectiveValue: typeof value === "number" ? { numberValue: changedSource && index === 1 ? 9 : value } : { stringValue: value } })) })) }] }] });
    return Response.json({ spreadsheetId: workbookId, sheets: [{ properties: sheet!.properties, data: [{ rowData: exportRows.map((row, index) => ({ values: row.values.map(cell => ({ effectiveValue: tamper && index === 1 ? { stringValue: "changed" } : (cell as { userEnteredValue: unknown }).userEnteredValue })) })) }] }] });
  };
  const google = new GoogleWorkbookGateway("access", fake);
  const first = await google.writeApprovedReport(principal, selected, approved);
  assert.equal(first.replayed, false); assert.equal(mutations, 1);
  const second = await google.writeApprovedReport(principal, selected, approved);
  assert.equal(second.replayed, true); assert.equal(second.url, first.url); assert.equal(mutations, 1);
  tamper = true;
  await assert.rejects(() => google.writeApprovedReport(principal, selected, approved), /differs from the approved/);
  assert.equal(mutations, 1);
  tamper = false; changedSource = true;
  await assert.rejects(() => google.writeApprovedReport(principal, selected, approved), /Source cells changed/);
  assert.equal(mutations, 1);
  sheet = undefined; changedSource = false; changeDuringWrite = true;
  await assert.rejects(() => google.writeApprovedReport(principal, selected, approved), /changed during export/);
  assert.equal(mutations, 2, "concurrent source change is never reported as a successful export");
  changedSource = false; changeDuringWrite = false;
  assert.equal((await google.writeApprovedReport(principal, selected, approved)).replayed, true);
  assert.equal(mutations, 2, "an interrupted response never produces a second output tab");
});
