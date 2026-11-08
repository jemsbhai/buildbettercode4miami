# Tidepath Chrome extension: local installation and use

This Manifest V3 extension reviews explicitly selected Google Sheets through a companion running on your own computer. It does not use the deployed website, the frozen Apps Script, an owner API key, or a hosted inference proxy. The source package is load-unpacked software; it is not a Chrome Web Store release.

The extension retains the name **Tidepath**, as requested after an unrelated store product named LaserFocus was found. There is no public install URL for this extension. See [distribution readiness](EXTENSION-RELEASE-READINESS.md) for listing evidence and the remaining store, OAuth and companion requirements. Existing folder and protocol names are unchanged.

Store preparation is now authorized and underway. The draft item is `bdojcligphldnmdchmlhgibhlldgflcd`; a separate OAuth client is bound to that item. Draft upload, configured packaging, OAuth verification and public store publication are separate milestones. See the [release record](CHROME-RELEASE-2026-11-08.md) for the verified status. Public users of a future configured store release will not need to create their own OAuth client; the personal source-installation instructions below remain available for local development.

The no-key mode performs deterministic schema checks, identity/duplicate review, date/number/currency validation and exact-money checks. Optional OpenAI advice uses a key supplied by the user to the local terminal and requires approval of an exact outgoing request. OpenAI usage is billed to that user's account; BYOK does not mean free inference.

## Build and load

Use the repository's pinned **Node 24.19.0 and npm 12.0.2**. If dependencies are not already installed, run `npm ci` in the root application folder. Do not change package managers or use an older system Node.

```sh
npm run extension:package
```

This produces `out/tidepath-extension/` and `out/tidepath-extension.zip`. The ZIP contains only extension assets, a manifest and loading instructions. It contains no secrets, private spreadsheet data, environment file or `node_modules`. Default packaging omits OAuth configuration; packaging with `--oauth-client-id` embeds that public client ID and the required scopes. A SHA-256 digest is printed.

For an already configured local installation, rerun packaging with the same `--oauth-client-id` value. Running without that option removes OAuth configuration from the output manifest. Keep the unpacked folder in place when updating; reload it in Chrome and confirm the same extension ID. Reloading clears the session pairing token, so reconnect to a running companion before use.

Prepare a separate release without replacing an existing local installation:

```sh
npm run extension:package -- --output-name tidepath-extension-store-release --oauth-client-id YOUR_STORE_CLIENT_ID.apps.googleusercontent.com
```

This writes `out/tidepath-extension-store-release/` and its ZIP. The client must match the actual store item ID. A configured ZIP does not establish Google approval or public availability. Release packages include Tidepath icons and setup/privacy links; the companion remains a separate source installation.

1. Extract the ZIP into a fixed folder, or use `out/tidepath-extension/` directly.
2. In Chrome open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder.
3. Copy the extension ID shown by Chrome. The folder must remain in place; moving it can change an unpacked extension's ID.
4. Open Tidepath using its toolbar action, or **Details → Extension options**. It opens a full extension tab, with keyboard-accessible controls and no injected Google Sheets code.
5. From the root source folder, start the fictional rehearsal below or configure real Google authorization.

No publication, Chrome Web Store registration fee, deployment, shared server or paid backend is needed for this local installation. The extension assets alone are not a backend: each user runs the companion on their own machine.

## Full fictional rehearsal without credentials

Replace `YOUR_EXTENSION_ID` with the ID Chrome actually displays:

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID --demo
```

Leave that terminal open. The companion listens only at `127.0.0.1:4318`, generates a session pairing token and prints it locally. Paste that token into **Local connection token** in Tidepath. The input is cleared immediately after submission. The extension stores the pairing credential only in Chrome session memory. Reloading the extension, updating/disabling it or restarting Chrome clears that storage; restarting the companion generates a different token.

The visible **Fictional fixture mode** label means Google and model transports are mocked. Do not describe this rehearsal as actual Google authorization or actual spreadsheet integration.

1. Choose **Find accessible spreadsheets**. Discovery does not automatically select or scan any workbook.
2. Select the fictional workbooks you want. For more than one workbook, enable the explicit multiple-workbook opt-in. Confirm the non-sensitive scope declaration.
3. Choose **Scan selected workbooks**. Inspect the totals, supported limits, exclusions and findings.
4. Expand **Required before correction: confirm column mappings**. Review fields, required fields, amount units, currency and date order. Choose **Confirm mappings and rescan**; every tab receiving a correction needs a confirmed mapping.
5. Select proposed corrections. An identity decision with multiple donor rows selects its full group; all rows are shown for review. Findings with no deterministic proposal remain manual review items.
6. Choose **Review selected corrections**, inspect exact original/new values and source references, then explicitly approve creating copies.
7. Choose **Create and verify correction copies**. Inspect each recorded status. In fixture mode these are local fixture copies, not Google files.
8. Refresh history, reopen a recorded scan, and retry the same approved operation. A retry preserves its request identity; it does not blindly create a replacement file after an uncertain result.

The no-key tools stay usable without enabling AI. Demo mode rejects API key entry entirely.

## Real Google Sheets setup

The code and package support Chrome's `identity.getAuthToken`; real authorization requires the user's own external Google configuration. No OAuth client or credentials are invented by the package. Packaging itself does not create a Cloud project, enable APIs or billing, change consent settings, register a store listing, or submit an OAuth verification request. A configured local test project and unpacked installation were exercised in [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md); no production deployment or public OAuth verification occurred.

For a personal local installation, the user must supply a Google OAuth client of the appropriate Chrome extension application type, associated with the unpacked extension ID, with the Google Sheets API and Drive API available in that user's project and account allowed by its consent/test-user configuration. Google organizational policies and OAuth app restrictions can prevent authorization. Consult [Chrome's OAuth tutorial](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) and [Google's OAuth application setup](https://developers.google.com/identity/protocols/oauth2).

Package using the public OAuth **client ID** (not a client secret and not an OpenAI key):

```sh
npm run extension:package -- --oauth-client-id YOUR_CLIENT_ID.apps.googleusercontent.com
```

Use the complete numeric-prefixed client ID issued by Google. Reload the extension from the same output folder; verify its ID still matches the Google configuration. Stop the fixture companion and start the real local mode:

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID
```

Pair with its new token. Choose **Connect Google account** only after reading the scope explanation. Authorize the Google account whose spreadsheets you intend to review. Discovery supports accessible Sheets files, including shared-drive metadata where Google returns them; permission-denied, incomplete, quota and size-limit results fail visibly rather than silently returning a partial scan. Expired authorization requires reconnecting; retry a pending copy operation with its existing ID.

The requested scopes are:

| Scope | Reason |
| --- | --- |
| `drive.metadata.readonly` | Discover spreadsheet IDs/names and check source versions. It is not permission to read arbitrary file contents. |
| `spreadsheets.readonly` | Read explicitly included source workbooks and their eligible tabs. |
| `drive.file` | Create and access the new correction workbooks created by this app. |

The source transport has no source-write operation. The extension has only the `identity` and `storage` Chrome permissions plus the loopback host permission. It has no content scripts, page DOM access, external messaging endpoint, remote executable code, browser-sync storage, analytics, or OpenAI host permission. Google access tokens stay in Chrome's identity cache and companion memory; they are never sent to the options page. The companion permits only the configured extension ID, authenticated with its pairing token.

Public use of the current sensitive/restricted scope set requires Google verification unless an applicable exception is confirmed. That has not been completed or promised to be free; see [the release readiness report](EXTENSION-RELEASE-READINESS.md) for assessment uncertainties and official sources. The delivered zero-owner-cost path is source/local distribution with a user-run companion and user-owned authorization, not an owner-hosted public OAuth service.

## Review, copy and recovery boundaries

- **Scope:** only selected workbooks, up to the server's supported bounds. Eligible tabs are included. Selecting all listed workbooks requires a separate broad-scan opt-in. Discovery and scanning are separate actions.
- **Privacy:** known sensitive tab/header labels are filtered before general body reads; labels cannot identify every private cell. Users must exclude inappropriate workbooks or reorganize private data before scanning. This extension is not an authorization path for private counseling notes and does not replace the app's bounded counseling disclosure workflow.
- **Values:** findings retain workbook/tab/cell references and show exact before/after values. Cell text is treated as data and rendered with text nodes. Spreadsheet instructions are never executed. All gift rows and exact cents are retained; duplicate gift flags do not authorize deletion. Conflicting identities remain manual review.
- **Mappings:** inferred mappings are visible. A correction requires a fresh scan with explicitly confirmed mappings for each affected tab. Ambiguous dates require the user's declared date order.
- **Copies:** approved deterministic corrections create independent data workbooks and preserve number formats, including native dates. These are not full-fidelity Drive copies: excluded private columns/tabs, general styling, charts, permissions and other features are not reproduced. Formula-bearing source content is blocked from correction-copy creation rather than silently converted or broken. The originals are preserved.
- **Concurrency:** source versions are checked around reading and copying. Changed sources require rescan and fresh review. Google provides no cross-workbook atomic transaction, so a multi-workbook operation can be partial; every known copy and its verification status is recorded.
- **Retries:** the extension saves the plan/request identity in session memory before application. The companion persists its local operation journal. Network failure leaves a recoverable pending request. History retries inspect the same operation. Unknown creation outcomes are not automatically repeated; inspect Drive for the recorded copy name. Known copy IDs can be rechecked without rewriting source data.
- **Long requests:** the extension asks the companion for asynchronous jobs, then polls short status requests to avoid Chrome service-worker fetch timeouts. It never repeats the original POST while polling. After a lost connection or polling limit, **Recover background request** resumes the saved job ID. Job IDs are session-only; after a full extension/browser restart, re-pair and recover durable scans/copy operations through companion history instead. A companion restart loses unfinished background job results; an uncertain AI request must not be assumed free or automatically retried.
- **Recovery:** use the untouched originals. Inspect incomplete copies and, if desired, manually remove only those copies in Google Drive. This extension does not delete Google files. A verified status records the earlier readback; it does not claim nobody edited that copy later.
- **Local data:** the companion journal may contain selected source data and findings. It is separate from the web app's state, under the ignored local data directory. It is not an encrypted vault. Protect the user account/device and remove the appropriate local journal when retention is no longer needed, after stopping the companion. Report downloads contain reviewed values and source references; store them appropriately.

See [LOCAL-SHEETS.md](LOCAL-SHEETS.md) for backend persistence, exact limits, supported issue classes and detailed failure behavior.

## Optional bring-your-own-key advice

Stop the local companion, then start it with a hidden key prompt:

```sh
npm run sheets:local -- --extension-id YOUR_EXTENSION_ID --ask-openai-key
```

Enter the key only at that local terminal prompt. Never paste it into chat, a spreadsheet, the extension, a shell argument or an environment file. It is held only in process memory, never read from an ambient owner key, and disappears on process exit. The extension's **Remove local API key** action removes it while leaving deterministic features available.

After scanning, choose **Preview exactly what would leave this computer**. This is a local action. Inspect the exact JSON request and disclosure. The payload is deliberately limited to standard mapped field names and issue counts, with no contact values, raw sheet cells, source names or counseling text. It therefore produces general advisory explanations; it cannot infer a hidden identity or repair a specific unknown value. Only checking the one-request consent box and choosing **Send this request using my key** permits a model call. The model's returned text is untrusted advice and has no route to approving or applying a correction.

The companion bounds calls, concurrency, timeout and output tokens, disables automatic provider retries and reports known versus unknown token usage. These are operational limits, not a guarantee of a particular API bill. A failed or timed-out request can still incur charges on the user's OpenAI account. No automatic paid fallback exists.

The credential design follows [OpenAI authentication guidance](https://developers.openai.com/api/reference/overview), [Chrome session storage guidance](https://developer.chrome.com/docs/extensions/reference/api/storage), [Chrome identity guidance](https://developer.chrome.com/docs/extensions/reference/api/identity), and [Chrome extension security guidance](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure). Google permissions follow the [Sheets scope reference](https://developers.google.com/workspace/sheets/api/scopes) and [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Verification checklist

Automated tests exercise the service worker and real UI controller with mocked transports: permission/route boundaries, exact caller validation, session secret handling, partial OAuth grants, multi-page discovery, explicit scan scope, reviewed mappings, grouped identity choices, approval gating, retry identity preservation, interrupted request recovery and BYOK opt-in. Static checks also verify that spreadsheet content has no HTML rendering sink and the package contains no remote scripts or API-key input.

```sh
node --import tsx --test tests/extension.test.ts
npm run verify
npm run extension:package
```

Passing these tests is not proof of Chrome extension loading, real OAuth consent, Google authorization, or actual Google mutation. Observed local-project OAuth and disposable Google results are recorded separately in [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md), with historical automated evidence in [VERIFICATION.md](VERIFICATION.md). Each installation needs its own authorized Google configuration; public OAuth verification has not been completed. No live paid-model call is needed or permitted for baseline verification.

When finished, press **Ctrl+C** in the companion terminal and wait for **Stopped cleanly** before closing it and the Tidepath tab. Shutdown stops new requests and finishes accepted background work before clearing in-memory credentials and removing the journal lock. Repeated stop signals do not bypass that wait. Startup failure or interruption cleans up only the lock that process created. If forced termination leaves a lock, confirm the old process has stopped before manually removing only that journal's `.lock` file; no automatic PID-based deletion occurs. See [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md) for verified terminal idle stops, busy-shutdown regressions, and the controlled startup checks.

**Disconnect Google** removes the companion token and Chrome identity cache; revoke the app's OAuth grant through the Google account's third-party access settings if desired. **Forget connection** removes session pairing state. It cannot erase credentials held by a stopped/unreachable process; stop that process to clear its memory.
