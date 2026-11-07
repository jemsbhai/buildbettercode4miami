# Tidepath inside Google Sheets

The sidebar connects selected donation rows to Tidepath's existing import, identity-review, report and approval engine. It writes the exact approved report to a new worksheet. The original donation table is preserved.

This integration covers donation reconciliation and reporting. Program figures in the report are explicitly labeled fictional Q3 2026 demo activity. It is not automatic spreadsheet synchronization, and it does not read or expose the main application's counseling records.

**Verification:** the sidebar is installed in a bound Google Apps Script project and visible in Google Sheets, but the complete native workflow is not yet verified. Google rejected sidebar server calls with `PERMISSION_DENIED` in a Chrome session signed into multiple Google accounts; a single-account retry is pending.

- The final combined suite passed **138 automated tests**, including reset and Google permission-error handling. The production build and TypeScript passed under Node.js 24.
- A real HTTP backend walkthrough imported the seven-gift fixture, reconciled five donor identities to three with **$635 preserved**, and approved/exported a live report with source-cell references and matching source/approval hashes. The model completed after two attempts, including one repair. This verifies the backend connection and live generation, not a native worksheet write.
- Native setup completed: `Code.gs`, `Sidebar.html` and `appsscript.json` were installed with clasp; Google's consent flow completed; the Tidepath menu and sidebar appeared. Selected-range calls and an actual new-tab write still require the single-account browser retest below.

The existing app's earlier verification is recorded separately in [VERIFICATION.md](VERIFICATION.md).

## Start the protected backend connection

Use **Node.js 24** and the installed lockfile. The bridge script uses modern Node flags and the OpenAI Agents SDK; the older system Node 20 on the original Windows workstation is insufficient.

```sh
npm ci
npm run sheets:bridge
```

The bridge listens on `127.0.0.1:3220`. On first start it generates a connection token in `.data/sheets/bridge-token.txt`; the terminal prints the file location, not the token. The `.data` directory is ignored by Git. Read that file locally when configuring the sidebar; never put the token in spreadsheet cells, screenshots or the repository.

In a second terminal, run the installed Cloudflare CLI:

```sh
cloudflared tunnel --url http://127.0.0.1:3220
```

Copy the temporary **HTTPS origin** printed by Cloudflare. Keep both processes running during the demo. A restarted quick tunnel can produce a different address; update the sidebar connection when that happens. Apps Script runs on Google's servers, so its requests cannot use this workstation's `localhost` address directly.

The tunnel reaches only the narrow Sheets bridge. It does not expose the Next.js web app or its general API. `GET /health` returns a minimal availability response; every Sheets command requires the connection token. Do not tunnel the ordinary web-app port for this integration.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `TIDEPATH_SHEETS_PORT` | Local bridge port; default `3220`. Update the tunnel target too. |
| `TIDEPATH_SHEETS_DATA` | Bridge data directory; default `.data/sheets`. |
| `TIDEPATH_SHEETS_TOKEN` | Supply an existing strong URL-safe token instead of the generated file. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Enable live report generation. The bridge loads `.env.local`; the default model is `gpt-5.4-mini`. |

Rehearsal drafting requires no model key and is labeled as a deterministic template. Live mode uses the existing evidence tool, numeric validation and bounded repair logic.

## Install the bound sidebar

Use a separate demo spreadsheet. A copy of an existing workbook is also suitable when testing with fictional data.

1. Open the workbook, then **Extensions → Apps Script**.
2. Put the repository's [Code.gs](../integrations/google-sheets/Code.gs) into the project's `Code.gs` file.
3. Add an HTML file named `Sidebar` and paste [Sidebar.html](../integrations/google-sheets/Sidebar.html).
4. In Apps Script project settings, enable the manifest file in the editor. Replace `appsscript.json` with the repository's [manifest](../integrations/google-sheets/appsscript.json).
5. Save, then reload the spreadsheet. Open **Tidepath → Open sidebar**. Complete Google's authorization flow when requested.
6. Expand **Connect Tidepath**, enter the tunnel's HTTPS origin and the local bridge token, then select **Save connection**.

If the workbook already has an `onOpen` handler, add the Tidepath menu to that existing handler instead of defining a second one. The script is bound to the workbook; it is not deployed as a public Apps Script web app.

The native manifest requests only the current spreadsheet, container UI and external-request scopes. Connection settings are stored in that Google user's Apps Script `UserProperties`, not in cells or returned dashboard data. Another Google user configures their own connection.

For CLI installation, the implementation was prepared with `@google/clasp` **3.4.1**. Enable the Google Apps Script API for the installing account, create or select the project bound to the intended spreadsheet, and push only `Code.gs`, `Sidebar.html` and `appsscript.json`. Local `.clasp.json` project bindings and `.clasprc.json` credentials are ignored by Git. The native script's runtime scopes above are separate from the installer account's permissions.

### Google account permission errors

If the sidebar opens but its server calls fail with `PERMISSION_DENIED`, first check the browser's Google sign-in state. Google documents that simultaneous sign-in to multiple accounts is unsupported for Apps Script, add-ons and web apps. Use a separate browser profile or private window signed into only the account that can edit this workbook, open the same spreadsheet, and authorize the bound script if prompted. This follows [Google's multi-account troubleshooting guidance](https://developers.google.com/apps-script/guides/support/troubleshooting).

Then reopen **Tidepath → Open sidebar**, configure the connection for that Google user, and repeat selection → preview/import → approval → write-back. A visible sidebar or completed consent screen alone does not prove those calls work. If the error persists with one account, inspect the bound project's executions and granted scopes before attributing it to the bridge token; a bridge-token rejection has its own explicit connection error.

## Rehearse the full flow

For a repeat rehearsal, open **Demo tools → Reset workbook demo** and confirm. This clears only the workbook's backend session, preserving its source cells and previously written report tabs. Creating another demo tab alone does not undo an earlier identity decision.

1. Select **Create fictional demo rows** in the sidebar, or **Tidepath → Create fictional demo data** in the menu. This creates a new tab containing the fixture from [demo-gifts.json](../integrations/google-sheets/demo-gifts.json). It has seven gifts, five donor identities and **$635** in giving.
2. Select the complete donation table including its header, then **Read selected rows**. Check the field mapping and choose **Dollars** for this fixture. Select **Preview import**, inspect the totals, then **Import reviewed rows**.
3. Review Rosa's matching contact evidence and choose **Same donor**. The donor count changes from **5 to 3**; giving remains **$635**, and all seven gifts remain recorded. A namesake with different contacts stays separate.
4. Select rehearsal or live drafting, then **Generate report**. Change a verified figure to an incorrect value, **Save edits**, and attempt **Approve exact draft**. Show the validation error; restore the recorded value, save and approve.
5. Select **Write approved report to new tab**. Open the returned worksheet link. It contains the reviewed narrative, figures, source references and exact approval details. Retrying that same export reuses the verified report tab rather than creating a duplicate.
6. Before the actual presentation, also test a source-cell edit after import. The sidebar must block continued work against its older snapshot. Re-read and preview the current range. A changed transaction under an existing gift ID is rejected; restore the original or use an explicit workbook-demo reset before importing corrected source records.

The first slice treats imported transactions as immutable. Resetting this workbook's backend session does not edit source cells, remove previously written report tabs, or reset the separate web-app demo. One workbook session has one complete source donation table; subsequent imports must still include every previously imported gift. This avoids keeping unseen, stale rows from an earlier range.

The strongest short demonstration is **spreadsheet rows → reviewed identity merge → blocked wrong figure → corrected approval → new report tab**. Show the recorded run only after that flow is clear.

## Data contract and ownership

The sidebar is a separate Apps Script HTML surface; the teammates' Next.js workspace components remain available in the main app. Shared integration types are in [sheets-types.ts](../src/lib/sheets-types.ts).

| File | Responsibility |
| --- | --- |
| [Code.gs](../integrations/google-sheets/Code.gs) | Read and pin a selected range, normalize dates using the workbook timezone, call the bridge, recheck source cells, and write literal approved output to a new tab. |
| [Sidebar.html](../integrations/google-sheets/Sidebar.html) | Column mapping, preview, identity decisions, report review, errors and run details. |
| [sheets.ts](../src/lib/sheets.ts) | Validate commands and reuse existing domain, agent and approval functions. |
| [sheets-bridge.ts](../src/lib/sheets-bridge.ts) | Authenticate requests, bound request size, serialize commands and persist workbook sessions. |
| [scripts/sheets-bridge.ts](../scripts/sheets-bridge.ts) | Start the local bridge and initialize its token. |

Apps Script sends `POST /v1/command` with a bearer token and a flat JSON body:

```json
{
  "workbookId": "the-current-spreadsheet-id",
  "action": "preview",
  "selection": {
    "workbookId": "the-current-spreadsheet-id",
    "sheetId": 123,
    "sheetName": "Donations",
    "a1": "A1:H2",
    "startRow": 1,
    "startColumn": 1,
    "values": [
      ["Gift ID", "Donor ID", "Name", "Email", "Phone", "Amount", "Date", "Channel"],
      ["gift-demo-1", "donor-demo-1", "Rosa Delgado", "rosa@example.test", "", 125, "2026-07-10", "online"]
    ],
    "formulas": [["", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""]]
  },
  "mapping": { "gift_id": 0, "donor_id": 1, "name": 2, "email": 3, "phone": 4, "amount": 5, "date": 6, "channel": 7 },
  "amountUnit": "dollars"
}
```

The example contains one donation row. Actual `values`, `formulas` and coordinates must describe the same rectangle. Selection limits are 1,000 donation rows plus a header, 32 columns and a one-megabyte request. Mapping indexes are zero-based and distinct; `email` and `phone` may be `null`. Gift and donor IDs are required stable identifiers. Amounts must convert exactly to positive integer cents. Channels are `online`, `tickets`, `auction` or `check`.

| Action | Additional fields | Result |
| --- | --- | --- |
| `status` / `reset` | No selection required | `dashboard` |
| `preview` | Fresh `selection`, `mapping`, `amountUnit` | `dashboard`, `preview` with preview hash, proposed rows, counts, metrics and candidates |
| `import` | Same fields plus reviewed `previewHash` | `dashboard`, `importResult: { inserted, skipped }` |
| `merge` | Fresh `selection`, `candidateId`, `decision: "approve"` or `"reject"` | `dashboard` |
| `generate` | Fresh `selection`, `mode: "demo"` or `"live"`, stable `requestId` | `dashboard`, `draft`, `replayed` |
| `edit` | Fresh `selection`, `draftId`, `revision`, optional `narrative` / `claims` | `dashboard`, `draft` |
| `approve` | Fresh `selection`, `draftId`, `revision` | `dashboard`, `draft` |
| `export` | Fresh `selection`, `draftId`, `revision` | `dashboard`, `export` |

The returned `dashboard` is a purpose-built view containing metrics, donor identities, merge candidates, drafts with validation issues, recorded runs and the pinned selection summary. It never contains the web app's complete state or counseling bodies. `programData: "fictional_demo"` identifies the seed-backed program metrics.

`export` contains `{ text, rows, draftId, revision, approvalDigest, sourceHash }`. Only Apps Script writes these rows. It verifies the source hash before and after the backend call and again around the write; output cells are literal text, and the written contents and absence of formulas are checked. A document lock and a report marker make successful retries safe. A conflicting or incomplete existing report tab is left for inspection rather than overwritten.

## Persistence and limits

Workbook sessions live in `.data/sheets/workspaces`, using hashed spreadsheet IDs as filenames. The main app's `.data/state.json` is not read or modified. Exact transaction retries do not duplicate gifts; repeated identical merge/approval decisions are no-ops. Report generation keys replay completed results and cannot silently start another model call.

Live attempts are limited to twelve per workbook-demo reset, including failures. Reservations are saved before a model request; abandoned reservations recover after 90 seconds. Report generation still uses the existing shared 45-second model deadline, three initial turns and one optional repair. Token usage is labeled partial/unknown when a complete provider total is unavailable.

This is a single-process, token-protected hackathon bridge. The tunnel is temporary, the token is a shared demo connection credential, and there is no organization-level identity system or continuous spreadsheet synchronization. Use the fictional fixture for the presentation. A durable hosted service and per-organization authorization are separate deployment work.

## Verify changes

```sh
npm run typecheck
npm test
npm run build
```

The test suites cover the backend command flow, narrow bridge boundary and Apps Script behavior using controlled host objects. They do not replace a native Sheets rehearsal with actual Google consent, the live HTTPS connection and a verified output tab. Keep those two kinds of evidence separate when reporting readiness.
