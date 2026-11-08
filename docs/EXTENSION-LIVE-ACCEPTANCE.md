# Disposable Google Sheets acceptance

This checklist tests the installed Chrome extension, local companion, real Google OAuth, Google reads, reviewed correction copies, and retry behavior. The fixture data is entirely fictional. Run with AI off and billing disabled. This procedure does not deploy anything.

**Preparation status:** The JSON fixture has been checked against the current reconciliation engine, including exact finding counts, all twelve patches, preservation of source snapshots, partial identity-group rejection, and formula rejection before any Google client access. All three local XLSX files passed value/formula reimport checks and XML checks for native DATE, literal formula-like text, and formula placement. All five tabs were visually inspected. Blank empty-string cells may round-trip as empty cells.

## Live results, 2026-11-08

Chrome loaded the extension, and real Google OAuth connected the configured test account. After that actual extension authentication, the local HTTP interface exercised the companion's real Google read, review, and correction-copy flow on three disposable native workbooks. The main scan returned **23 findings**. Confirmed mappings and MDY produced **12 proposed corrections**, which created exactly **two correction copies** with **nine manual findings** remaining. Both sources and copies retain **12 gift rows and USD 40100 cents**.

Independent exports confirmed all **185 original cells unchanged** after the deliberate stale-test edit was restored. Both copies match the sanitized baseline plus exactly the twelve approved patches, including typed values, formulas, number formats, the native DATE, and literal `=1+1` text. Private tab and column data were excluded, and no private sentinel appeared in the correction copies or persisted run/state records. Partial identity approval, stale approval, and the formula workbook were rejected as expected. Repeating the completed operation reused the same two copy IDs.

The user subsequently completed the actual **extension UI scan → review → apply** flow for **Community only**. That separate run reviewed **17 findings**, approved **10 patches**, and created **one additional correction copy**. No MDY decision was selected, so `09/02/2026` remained unchanged and ambiguous. Independent source and copy exports verified all ten journal-approved changes, no other changes, preserved privacy exclusions, **six gift rows and USD 22000 cents**, and **five remaining manual findings**. All 96 Community source cells still match the original baseline, including types, formulas, and number formats, despite its later Drive version. This UI pass covers one workbook; the two-workbook, twelve-patch flow above was verified through local HTTP.

AI remained off with no configured key and **zero provider attempts** in every recorded status check. Google Cloud explicitly displayed **“This project has no billing account”** and showed the test project as unlinked. Nothing was deployed. Account details, private workbook identifiers, links, and full verification evidence remain in the ignored `.data/local-sheets/` run records.

Final repository verification passed after the shutdown change: `npm run verify` exited 0 with toolchain checks, typechecking, **244 tests with zero failures**, build, and **72 HTTP checks**. The targeted local-service suite passed **9/9**, including delayed-copy and queued-scan draining, a partial request body, and close-error handling. `git diff --check` was clean.

**Interrupted-process recovery passed:** the companion was interrupted, leaving a stale lock. After confirming that the old process had exited and the loopback port refused connections, the journal was backed up and its unchanged hash verified. Only the stale lock was manually removed. A new companion process started in real Google mode with AI off. The saved journal retained eleven original scans, four plans, four operations, and three correction-copy IDs. This earlier check verified recovery with a manual stale-lock step.

The new process rotated the pairing credential; the old credential returned 401. Before Google reconnect, status showed no connected Google account and no AI key or provider attempts, and saved history remained protected with 401. The user then reconnected and confirmed that previous history and copy links returned in the extension. Account binding remained unchanged. Both completed operations were replayed through local HTTP because the UI hides replay controls for completed entries. They returned the same three copy IDs and original verification timestamps without changing the journal. Separate fresh Google reads of all three copies matched the approved typed content exactly. Discovery of the disposable test set still showed three sources and three copies, with no new outputs. Post-reconnect status remained real Google mode, connected, with no AI key and zero provider attempts.

**Graceful idle shutdown passed:** the original connected Google session exited on direct-Node terminal Ctrl+C, closed the loopback port, and automatically removed its lock. The backed-up journal hash remained unchanged, preserving fourteen scans, four plans, four operations, and three correction-copy IDs. No manual lock removal was required for this idle stop.

Follow-up review found that an accepted asynchronous job could still be running when the previous shutdown path released the lock. The revised shutdown stops accepting new requests, drains accepted handlers and background work, then clears in-memory credentials and removes the lock. Repeated stop signals share one shutdown, and startup failure or interruption cleans up only its own lock. The targeted busy-shutdown regressions and final verification passed. A separate controlled CLI probe passed invalid-journal cleanup, preservation of an existing foreign lock, address-in-use cleanup, and repeated injected SIGINT events after lock opening and journal reading. Those startup-interruption cases use portable event injection, not operating-system signal-delivery evidence. No provider requests were made.

An actual terminal Ctrl+C test also passed after the fix. The companion started in real Google mode with no Google connection, no AI key, and zero provider attempts, then printed **Stopping** followed by **Stopped cleanly**. The exit observer recorded exit code 0, lock absence at exit, and an unchanged journal containing fourteen scans, four plans, four operations, and three copy IDs. The process was gone and the port closed. The companion is now **stopped cleanly**; it was not automatically restarted, and no user reconnect is required to finish this test. Billing remains disabled and nothing was deployed.

Forced termination can still leave a lock, which must be removed manually only after confirming that its process has stopped. There is no automatic PID-based lock deletion.

## Fixture files and creation

The authoritative fixture is `integrations/chrome-extension/acceptance-fixtures.json`. It contains three `WorkbookSnapshot` objects, assertions, and exact expected patches. The logical workbook IDs and version `1` are local test identifiers. After native Google import, record actual spreadsheet IDs, sheet IDs by title, and Drive versions. An XLSX import can assign different sheet IDs.

| Logical workbook | Native title suffix | Tabs | Purpose |
| --- | --- | --- | --- |
| `acceptance-a` | Community | Donations, Tickets, Private counseling | Dirty values, native date, literal formula-like text, private tab and column |
| `acceptance-b` | Outreach | Outreach | Cross-workbook duplicates, aliases, namesakes, conflicts, invalid currency |
| `acceptance-formula` | Formula guard | Formula gifts | Formula copy rejection before any new file is created |

Use unique titles beginning `Tidepath disposable acceptance 2026-11-08`. Create only disposable files in the account used by the extension. Never substitute real donor files. Keep copies private to that account.

Local XLSX artifacts are prepared in `outputs/tidepath-live-acceptance-20261108/`. Import them as native Google Sheets. Preserve the values exactly: amount strings, date strings, whitespace, the blank gift ID, and malformed values are deliberate test inputs. Do not auto-clean them during import. There is no extra summary tab because headers must stay in row 1 and gift records must stay in the specified cells.

Before scanning, inspect native cell types. Community Donations `G2` must contain numeric serial **46266** with a DATE number format `yyyy-mm-dd` (2026-09-01). Community Donations `K2` must contain the literal string **`=1+1`**, with no formula. Formula guard `D2` must contain formula **`=5+5`**, effective value **10**. If import changes a fixture value or type, correct only the disposable fixture and capture a fresh baseline before testing. For a typed API write, use `stringValue`, `numberValue`, and `formulaValue` deliberately rather than `USER_ENTERED` parsing.

The fixture's allocated-grid recommendation is 20 rows by 12 columns per tab. Confirm native import does not introduce a grid exceeding the reader's bounded limits. Do not add blank decorative sheets or ranges.

## Connect and establish the baseline

1. Load the built unpacked extension in Chrome and record its actual extension ID. Open its options and confirm the companion URL is `http://127.0.0.1:4318`.
2. Complete Google OAuth for the matching extension ID and the selected test account. Inspect the granted scopes and account in the real flow. Use the local OAuth test app. Keep billing disabled and the deployed production app unchanged.
3. Start the companion without an AI API key. Confirm status reports AI off, no key configured, and zero live provider calls. Leave every AI consent control off throughout the run.
4. Connect the Google account and list spreadsheets. The three fixture titles should be selectable as native Sheets. Select only Community and Outreach for the main scan. Formula guard is tested separately.
5. Capture the source baseline as typed values, formula presence, number formats, tab titles, actual IDs, and current versions. Store the run record locally outside Git with no access tokens, pairing tokens, or credentials. Review source URLs and cell values to establish that the selected files are the disposable fixtures.

## Main scan and review

Expected main totals both before and after correction:

| Measure | Expected |
| --- | ---: |
| Selected workbooks | 2 |
| Eligible tabs | 3 |
| Gift rows | 12 |
| Valid amounts | 10 |
| Invalid amounts | 2 |
| Exact USD cents | 40100 |

The duplicate gift remains in the row and cents totals. Amount `12.345` and the row with currency `ZZZ` are invalid and do not contribute to valid cents.

| Finding type | Initial inferred mapping | Confirmed mappings, MDY | After all proposed fixes |
| --- | ---: | ---: | ---: |
| normalization | 8 | 9 | 0 |
| ambiguous_date | 1 | 0 | 0 |
| invalid_number | 1 | 1 | 1 |
| invalid_amount | 2 | 2 | 2 |
| invalid_date | 1 | 1 | 1 |
| missing_required | 1 | 1 | 1 |
| invalid_currency | 1 | 1 | 1 |
| duplicate_gift | 1 | 1 | 1 |
| conflicting_record | 1 | 1 | 1 |
| identity_conflict | 1 | 1 | 1 |
| duplicate_identity | 5 | 5 | 0 |
| **Total findings** | **23** | **23** | **9** |

Confirm the mappings for Donations, Tickets, and Outreach. They all map A gift ID, B donor ID, C name, D email, E phone, F amount, G date, H currency, I quantity, J channel. Amount unit is major currency units, currency is USD, and required fields are gift ID, donor ID, amount, and date. Choose **MDY** explicitly and rescan. `09/02/2026` then proposes `2026-09-02`; the native date in `G2` never needs a patch.

Check that these remain manual: malformed money and calendar date, quantity `two`, missing gift ID, currency `ZZZ`, conflicting `g-conflict` records, and contradictory contacts for `d-conflict`. The two Alex Gray records have different contacts and must remain separate donor IDs. The `g-001` duplicate is reported but neither gift row is deleted.

Review all twelve proposed cell changes:

| Workbook | Tab | Cell | Expected string after correction |
| --- | --- | --- | --- |
| Community | Donations | C2 | `Rosa Delgado` |
| Community | Donations | J2 | `online` |
| Community | Donations | H2 | `USD` |
| Community | Donations | F2 | `125.00` |
| Community | Donations | I2 | `1000.000000` |
| Community | Donations | F3 | `20.00` |
| Community | Donations | G3 | `2026-09-02` |
| Community | Donations | F6 | `25.00` |
| Community | Tickets | F2 | `40.00` |
| Community | Donations | B3 | `d-001` |
| Community | Tickets | B2 | `d-001` |
| Outreach | Outreach | B4 | `d-001` |

The last three changes form one donor identity group. Shared contact evidence and compatible normalized names link `d-002` to canonical `d-001`. Verify that approving only part of this group cannot create a plan or copy. Review all three together for the successful operation. Five duplicate-identity findings include two evidence findings and these three proposed changes; they are not five patchable cells.

## Privacy and untrusted cells

The private tab is `Private counseling`. The private header is Community Donations `L1`, `Private counseling notes`. Verify exclusion notices and that neither sentinel reaches scan findings, persisted scan data, generated CSV, correction copies, or any AI request:

- `PRIVATE_TAB_SENTINEL_TIDEPATH_20261108`
- `PRIVATE_COLUMN_SENTINEL_TIDEPATH_20261108`

The raw fixture and original disposable source naturally contain these sentinels. Restrict the absence check to sanitized outputs and application persistence, excluding the authored source fixture and its local XLSX build artifacts. A public copy may preserve column positions with blanks in the excluded column; no private values may be copied.

Community Donations `K3` contains a deliberately adversarial instruction-like memo. Treat it only as data. It must not change the selected files, trigger data export, enable AI, or alter permissions. Community Donations `K2` must remain literal `=1+1` text in the correction copy. Confirm a typed readback shows no `formulaValue` there.

## Stale source rejection

Before the successful copy operation, build and review the twelve-patch plan. Edit only the disposable Community Donations `F5` from string `10.00` to string `11.00`, then wait until the source reports a new version. Attempt the previously reviewed approval. Expect a stale-source rejection and **zero new correction files**. Record the status and bounded error message.

Restore `F5` to string `10.00`. Restoration advances the version again. Capture a new source baseline, rescan, reconfirm mappings and MDY, and build a new plan. Do not reuse the stale plan or pretend restoring a value restores its old Drive version.

## Successful copies, readback, and retry

1. Approve the new twelve-patch plan. Expect exactly **two** correction workbooks, one for each selected source workbook. Record the operation ID, source IDs, copy IDs, and URLs.
2. Read both copies from Google. Verify every public row and typed cell against the sanitized source baseline plus only the twelve approved patches. Preserve all 12 gift rows, exact cents, malformed values requiring manual review, and duplicates.
3. Verify Community Donations `G2` remains numeric **46266** with its DATE format and `K2` remains string **`=1+1`** without a formula. General styling and charts are outside the copy contract; source data and number formats are the required checks.
4. Read the original Google sources again. All original values, formulas, number formats, tab titles, and private sentinel cells must match the post-restoration baseline. The application must never write corrections into the originals. Source versions must remain unchanged during the successful copy operation.
5. Rescan the copies with confirmed mappings and MDY. Expect the same 12 rows, 10 valid amounts, 2 invalid amounts, USD 40100 cents, and the nine remaining manual findings in the table above.
6. Retry the **same approved operation**, retaining its stored approval/operation identity. Expect existing copy IDs and no extra files. A completed journal returns its previously verified result without a new provider readback; read the copies independently after replay and compare them with the expected corrected snapshots. Confirm the operation history contains the completed copy outcomes. If the UI cannot replay an operation, record that limitation rather than treating a new plan as a retry.
7. Restart the local companion, reconnect the same Google account, and inspect durable history. Verify completed copy IDs are retained. Replaying a completed operation must reuse those IDs without creating more. Recovery of a partial operation that already has a copy ID performs read-only verification; it does not overwrite that copy. Never induce an ambiguous create failure by repeatedly submitting a fresh operation.

## Formula guard

Select only the Formula guard workbook. Expected totals are one gift, one valid amount, zero invalid amounts, and USD **1000** cents. Expected findings are one `formula_review` at `D2` and one normalization proposal at `C2`.

Confirm its mapping and review the `C2` whitespace fix. Attempt a correction copy. Expect the workbook to be rejected because it contains a formula, **before any new file is created**. Read the source again: `D2` must still be `=5+5`, value 10, and `C2` must still be ` Morgan Chen ` with surrounding spaces. Record the clear rejection and zero copy count.

## Completion evidence

Observed status as of 2026-11-08:

| Evidence | Live status |
| --- | --- |
| Installed extension ID and real OAuth account/scopes | Passed: loaded in Chrome, configured scopes, real account connected |
| Companion reachable and AI off, zero provider calls | Passed: real Google mode, no AI key, zero attempts |
| Three disposable native workbook IDs and typed baseline | Passed: recorded privately; native exports verified |
| Initial 23 findings and confirmed MDY 23 findings | Passed through local HTTP after extension authentication |
| Privacy exclusions and sentinels absent from sanitized outputs | Passed: copies and persisted run/state records checked |
| Partial donor-ID group rejected | Passed: HTTP 400 |
| Stale approval rejected, no copies | Passed: blocked operation, zero copy IDs |
| Twelve approved patches, exactly two copies | Passed: both copies independently verified |
| Exact readback, 40100 cents, 12 rows, native DATE and literal text | Passed: nine manual findings and zero proposals remain |
| Originals unchanged | Passed: all 185 cells match the baseline after stale-test restoration |
| Same-operation retry reuses copy IDs | Passed: same two IDs, independent export verification afterward |
| Complete extension UI scan → review → apply | Passed by user for Community only: 17 findings, ten approved patches, one additional copy, no MDY selection |
| Community-only UI copy and original readback | Passed: six rows, 22000 cents, five manual findings; all 96 original cells unchanged |
| Interrupted companion and stale-lock recovery | Passed with manual stale-lock removal after old-process exit was verified |
| Reconnect and authenticated history | Passed: user confirmed previous history/copy links returned; account binding and saved records retained |
| Completed-operation replay after reconnect | Passed through local HTTP: same three copy IDs and original verification timestamps, unchanged journal, no new outputs |
| Fresh copy readback after reconnect | Passed: all three copies exactly match approved typed content; AI key absent and attempts zero |
| Graceful idle Ctrl+C shutdown | Passed before and after the fix; post-fix exit code 0, lock absent at exit, port closed, journal unchanged |
| Busy shutdown drains accepted work before unlocking | Passed: 9/9 targeted service tests, including delayed copy/queued scan, partial body, and close errors |
| Startup failure/interruption lock ownership | Passed controlled CLI probe: own locks cleaned, foreign lock preserved; repeated SIGINT events injected at startup checkpoints |
| Final companion state | Stopped cleanly; no automatic restart or reconnect requested |
| Formula workbook rejected before creation | Passed: formula error, no copy journal or copy IDs |
| Billing disabled, AI off, nothing deployed | Passed: Cloud shows no billing account; zero AI attempts; no deployment |
| Repository verification | Passed after shutdown changes: `npm run verify` exit 0, 244 tests/zero failures, typecheck/build, 72 HTTP checks; `git diff --check` clean |

Leave disposable source and correction links available for review unless cleanup is requested. Any cleanup must target only the recorded test IDs. Do not delete or modify unrelated Drive files.
