# Tidepath local Sheets product

This is a user-run companion and Manifest V3 extension in the existing single-root repository. It does not use the deployed Next.js service, frozen Apps Script, a tunnel, a shared owner account, or hosted inference. Existing web APIs, including draft review, remain separate and unchanged by this integration.

## Completion checklist and verification boundaries

| Milestone | Observable completion condition | Evidence |
| --- | --- | --- |
| Deterministic reconciliation | Selected workbooks/all eligible tabs produce traceable findings, exact cents, mappings and reviewable proposals | Engine fixture tests; HTTP tests |
| Authorized Google transport | Paginated discovery; selected reads; private-label exclusions; account and source-version checks | Mocked Google API tests and [live disposable acceptance](EXTENSION-LIVE-ACCEPTANCE.md) with the configured test account |
| Safe application | Explicit reviewed plan produces new verified data copies; sources never written; uncertain failures retained | Mocked copy/readback/concurrency/crash tests |
| Local security and cost boundary | Loopback-only authenticated companion; exact extension origin; no owner credential; no provider call without user key plus payload consent | HTTP/BYOK tests and source inspection |
| Extension onboarding and operation | Pair, connect, discover/select, confirm mappings, review, approve, history/recovery and outgoing-AI preview | Extension message/controller tests and separately recorded browser fixture rehearsal |
| Packaging | Repeatable ZIP and load-unpacked directory without credentials or paid registration | `npm run extension:package`; checksum/ZIP checks |
| Real browser integration | Unpacked extension installed and authenticated against disposable Google spreadsheets | Passed for the local test project and unpacked installation; see [live acceptance and recovery results](EXTENSION-LIVE-ACCEPTANCE.md) |

Automated and fixture-browser success does not establish real Chrome identity, OAuth consent, Google quota/permissions, or shared-drive behavior. See [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md) for the observed local OAuth, disposable copy, and recovery status, and [verification](VERIFICATION.md) for historical automated results. The live checks used a local test project and unpacked extension; no production deployment or public OAuth verification occurred. This product supports the bounded issue classes in [reconciliation rules](RECONCILIATION-RULES.md); it cannot detect or repair every possible spreadsheet issue.

## Run locally without a key or paid account

Use Node **24.19.0** and npm **12.0.2**, as described in [development](DEVELOPMENT.md). The installed dependency lockfile is unchanged.

```sh
npm ci
npm run extension:package
```

Load `out/tidepath-extension` with Chrome's **Load unpacked** control and copy its displayed extension ID. Detailed steps and OAuth setup are in [the extension guide](EXTENSION.md).

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID --demo
```

Open Tidepath, enter the pairing token printed by that terminal, discover the two fictional workbooks, explicitly enable multi-workbook scanning, select them, and confirm the privacy/scope statement. Scan, review the inferred columns, select the intended date order, and choose **Confirm mappings and rescan**. Select proposed fixes, review the exact plan, then approve the fictional correction copies. History identifies this as demo output; no Google file is created. Invalid amounts and conflicting records remain manual findings.

For actual Google data, use your own Chrome OAuth client ID when packaging and restart without `--demo`. The companion binds **127.0.0.1:4318** only. It never exposes the Next.js app or a public port. It requires a random per-process pairing token, the configured extension ID and an allowed Origin when supplied. It rejects alternate Host headers and redirects. The extension can reach only loopback; the companion contacts fixed Google API hosts and, after per-call approval, `api.openai.com`.

`npm run sheets:local` intentionally does **not** load `.env.local` or read `OPENAI_API_KEY`, `OPENAI_MODEL`, owner tokens or shared service accounts. Do not substitute the older `sheets:bridge` command, which is a separate integration with different credential behavior.

## Optional user-funded AI

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID --ask-openai-key
```

Enter your own key at the local hidden terminal prompt. Escape cancels. It is kept only in process memory; it never enters the extension, browser DOM, content script, synced storage, logs, journal or export. The extension can remove the key with **Remove local API key**; stopping the process also clears it. Re-enter through the terminal on a later start. Never paste a key into chat, a shell argument, spreadsheet cell or source file. A fully compromised local OS can read process memory; this is not a hardware-backed vault.

AI remains off until the user previews and approves one exact outgoing request. Only issue counts and standard mapped-field names are sent, without cells, contacts, workbook titles or identifiers. The model returns advisory text; it cannot call tools, modify plans, merge identities, change money or approve anything. Model output is rendered as text. Sheet content is never interpreted as instructions.

The default model is `gpt-5.4-mini`; the user may set `--model MODEL_ID` supported by their own account. There is one in-flight request, no automatic transport retries, a 30-second timeout, 16 KB maximum request, 800 maximum output tokens, and twelve attempts per local process. Identical scan/payload requests replay their recorded attempt within that process, including failures. Restarting resets this in-memory AI ledger and requires a fresh key and consent. These are operational bounds, **not an exact billing cap**. Missing or partial provider usage is labeled unknown; failed requests may still incur charges. The user's own OpenAI account pays for usage. Deterministic mode requires no OpenAI account.

This credential boundary follows [OpenAI authentication guidance](https://developers.openai.com/api/reference/overview). Chrome recommends session storage for sensitive extension state; the extension restricts it to trusted contexts and uses it only for pairing and recovery identifiers. See [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage) and [Chrome extension security](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure). Internet requests use HTTPS; the narrowly scoped loopback connection uses HTTP and a random bearer token.

## Google scope, privacy and copies

The scopes are `drive.metadata.readonly` for names/IDs/version metadata, `spreadsheets.readonly` for source cells, and `drive.file` for files created by this app. No full Drive-write scope is requested. Google can require consent/testing/verification for these scopes. The configured local test project and OAuth client used for [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md) remain in testing with billing unlinked; public OAuth verification was not performed. References: [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [create spreadsheet](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/create), [Drive list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

Discovery reads spreadsheet metadata, never automatically selects files and never sends Drive contents to AI. Scanning reads only selected workbooks. Multiple workbooks require a separate broad-scan checkbox. Private/counseling workbook/tab names are excluded before body reads; known sensitive headers cause those columns to be omitted. This is a conservative label heuristic, not a privacy classifier. The user must exclude or relocate confidential data that is not recognizable from those labels. This integration provides no opt-in to scan private counseling; the existing audited counseling workflow remains the only supported disclosure path.

Copies preserve every included gift row, exact per-currency cents and number formats; suspected duplicate gifts remain recorded. Native integral Google DATE cells retain their numeric values and format. Strong compatible donor evidence can propose a grouped donor-ID correction, requiring explicit review. Conflicting names/contacts and unsupported values are never automatically merged or guessed. Corrections affect new sanitized data tables, not original workbooks. Private data, charts, comments, permissions, scripts and general styling are not cloned. Formula-bearing workbooks can be scanned, but automatic correction copies are blocked because relocating formulas can change their meaning or execute external references. Original formulas remain untouched.

Source Drive versions are checked around reads and before/after copy creation. A source change invalidates the plan or marks produced copies historical/conflicted. Each new workbook is written with a single Sheets batch request and read back exactly. Multiple workbook copies cannot be one Google transaction; partial outcomes are explicit and originals remain intact. “Verified” means readback succeeded at the recorded time, not a guarantee that someone has not edited that copy later.

## Recovery and local retention

Journal defaults are `.data/local-sheets/demo-journal.json` and `.data/local-sheets/google-journal.json`. They contain selected non-private snapshots, original values/formulas, mappings, findings, plans and copy-operation history. They contain no API/OAuth/pairing tokens. Protect this directory using your OS account permissions; disk encryption/access control is the user's responsibility. Windows does not implement POSIX file modes. Exported findings may contain personal source values and references; store them accordingly.

A Google journal is bound to a hash of Google's account permission identity. Connect that same account after restarting to view saved data or use approvals. A different account must use a separate file:

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID --data-file PATH_TO_PRIVATE_JOURNAL.json
```

For a normal stop, press **Ctrl+C** and wait for **Stopped cleanly**. The companion stops accepting new requests, finishes accepted handlers and queued background work, then clears in-memory credentials and releases the journal lock before exiting. Repeated stop signals share the same shutdown; they do not release the lock early. A startup failure or interruption cleans up only the lock this process created; an existing foreign lock is preserved. Verified terminal idle stops, busy-shutdown regressions, and controlled startup-interruption checks are recorded in [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md).

The startup lock prevents two companion processes from using the same journal. Forced termination or a crash can leave it behind. First verify the old process has stopped; only then remove that specific `.lock` file to restart. There is no automatic lock deletion based on a recorded PID. Atomic file replacement and pre-write checkpoints protect normal recovery; a user-controlled local journal is not a tamper-proof audit store. Back it up before migrating machines. After finishing and stopping the companion, users may delete or archive their own journal to clear retained data; no server-side retention or analytics exists.

Long discovery/scans/copy/AI operations use `Prefer: respond-async`: a quick `202 {jobId}` response followed by authenticated `GET /v1/jobs/:id` polling. A lost browser reply never automatically repeats a mutation. Transient job status is in memory; completed scans and copy checkpoints are durable. After process restart or a lost job, inspect **History** and use the recorded approved operation's recovery action. Pending scans can be restarted because they are read-only.

The same request ID and plan return the same operation; even a new request ID cannot create a second set of copies for that exact plan. Before every Google create/write the journal is checkpointed. If create may have succeeded but its response was lost, Tidepath records the proposed filename and refuses another create: inspect Drive manually. If a copy ID is known, recovery performs readback only and never overwrites it. Incomplete copies remain available for inspection. To undo a reviewed copy, keep using the unchanged original and manually remove the separate output file if appropriate. There is no original-data rollback to perform.

## API and team integration

No changes are required to Liam's dashboard/inbox/counseling UI or Robby's grants/reports UI. The local service imports separate modules under `src/lib/reconcile*`; it does not read main app state or route through the deployed web APIs.

| Endpoint | Contract |
| --- | --- |
| `GET /v1/status` | Local mode, Google connected, user-key presence, model and attempt bounds |
| `POST /v1/google`, `DELETE /v1/google` | Session access token connect; account binding; clear token |
| `GET /v1/workbooks` | Complete bounded discovery `{files, complete:true}` or explicit error |
| `POST /v1/scans` | `{workbookIds,broadScan,confirmNonSensitive:true,options?:{tabs}}`; returns `ScanReport` |
| `GET /v1/scans/:id` | Recorded scan; requires same connected Google account outside demo |
| `POST /v1/scans/:id/plan` | `{findingIds}`; authoritative `CorrectionPlan` with exact before/after cells |
| `POST /v1/plans/:id/apply` | `{approved:true,requestId}`; durable operation with `entries` and statuses |
| `POST /v1/operations/:id/retry` | Recover existing approval; never silently create again after uncertain create |
| `GET /v1/history` | Recorded scans, copy operations and this process's AI runs |
| `GET /v1/scans/:id/ai-preview` | Exact provider payload, disclosure and approval hash |
| `POST /v1/scans/:id/ai` | `{enabled:true,approvedPayloadHash}`; advisory text and honest usage |
| `DELETE /v1/ai/key` | Remove local key |
| `GET /v1/jobs/:id` | Authenticated transient job status/result for asynchronous requests |

## Cost and distribution boundary

The project owner provides source and an unpacked package, not a paid hosted service, API proxy, trial key or Google project. All scanning is local and Google access uses the installing user's own OAuth configuration. No owner-billed computation exists in this path. Chrome Web Store publication/registration is not needed for local installation and was not performed. The local package works without a model key; optional user inference is billed to that user. Google quotas/account policies and the user's own machine/network costs remain outside Tidepath's control. No paid tier or automatic billable fallback is configured.

Frozen production runtime, Apps Script version 2, Netlify deployment and Vercel settings are untouched. The original implementation was delivered locally; the user's later explicit request authorizes a GitHub source push for the extension and companion. This does not authorize a deployment, store release, merge, registration or purchase. Deployment triggers were rechecked for that push; see [the source handoff](EXTENSION-RELEASE-READINESS.md#github-source-handoff).
