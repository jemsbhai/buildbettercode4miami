# Tidepath public add-on release runbook

This is the standalone public product, separate from the bound hackathon sidebar in `integrations/google-sheets`. The intended customer workflow is to install an Editor add-on and authorize their own Google account; they do not paste scripts, run a server, supply an AI key or configure a backend token.

## Release status

Record each gate separately. A hosted website is not evidence of a published add-on.

| Gate | Evidence / current status |
| --- | --- |
| Implementation | Standalone client in `integrations/google-sheets-addon`; production server under `src/lib/public` and `/api/public`. |
| Cloud project | `tidepath-public-2026`, project number `397160375233`; the standalone public script is linked to it. |
| Hosting | Vercel production at `https://tidepath-sheets.vercel.app` is `READY` on `89edd68`; 14 hosted checks passed against that release. See [the dated evidence](PUBLIC-RELEASE-2026-11-07.md) for deployment identity and remaining gates. |
| OAuth configuration and verification | Plain **Tidepath** branding, policy acceptance, six scopes and Production audience state are saved. Real website sign-in and native ID/access-token identity checks passed. Brand verification is blocked by Google's ownership-propagation message to wait 24 hours after Search Console verification; applicable OAuth verification is not complete. |
| Native installation / fresh workbook E2E | Core Editor test workflow passed: authorization/Picker, import, merge, incorrect-claim approval block, source-change rejection, correction/reimport and approved new-tab export with safe retry. Numeric **version 1** also passed authenticated reload, export retry, real live-AI approval/export after consent and confirmed workbook-data deletion with source/report tabs preserved. Second-account isolation, real-user website account deletion and remaining cases are not yet claimed complete. |
| Marketplace submission | App Configuration and Store Listing draft saved: public visibility, individual/admin installation, Sheets version 1, Muntaser Syed/non-trader/free, All Regions, Office Applications, required links/assets and a real 1280×800 native AI screenshot. Submit was not invoked; the listing is not submitted. |
| Marketplace approval / public install | Not approved or available. Do not offer an install link until the real listing is approved and tested. |
| Database and account boundary | Migrations, restricted runtime login, row-level isolation and hosted synthetic-session deletion checks are verified; see [database operations and evidence](PUBLIC-DATABASE.md). |
| Retention operations | 30-day content expiry is implemented and verified in tests. Daily cleanup is configured; an actual scheduled hosted invocation is not yet observed. Provider backup retention remains a launch prerequisite. |

## Architecture and scope

The client is a **standalone Apps Script Editor add-on**, not a Workspace card add-on and not a script attached to a customer's workbook. `onOpen` only creates the add-on menu, including in `AuthMode.NONE`; identity, properties and cell reads wait for a user action. This follows Google's [Editor add-on model](https://developers.google.com/workspace/add-ons/how-tos/building-editor-addons) and [authorization lifecycle](https://developers.google.com/workspace/add-ons/concepts/editor-auth-lifecycle).

The add-on obtains a Google-signed ID token and an OAuth access token. Only Apps Script sends these to Tidepath's HTTPS API. The backend validates signature, audience, issuer, expiry and subject, binds the access token to that same subject, and asks Google for permission to edit the workbook on each command. The first release creates a private workspace per Google subject. Email addresses, caller-supplied tenant IDs and spreadsheet IDs are never authorization proofs. Sharing a Sheet does not share the Tidepath workspace.

Use `spreadsheets.currentonly` for selection capture inside the current file and `drive.file` for server-side access to files explicitly chosen through Google Picker. The current-document scope cannot authorize Sheets REST requests. Picker and Apps Script must use the same standard Cloud project. These choices follow Google's [Editor scope guidance](https://developers.google.com/workspace/add-ons/concepts/editor-scopes) and [Apps Script Picker integration](https://developers.google.com/apps-script/guides/dialogs#file-open_dialogs).

The Picker receives a short-lived OAuth token as required by Google's integration. It never receives the ID token. Tokens are never placed in sheet cells, local storage, logs, customer settings or the database. The customer selects the active workbook; both the dialog and server adapter check that its ID matches. The backend then independently confirms Google's actual permission. Browser-selected file metadata is not accepted as proof.

| Manifest scope | Purpose |
| --- | --- |
| `openid` | Signed Google subject, verified by the backend. |
| `userinfo.email` | Display the verified account and match Google identity evidence. |
| `spreadsheets.currentonly` | Capture the current selection and source freshness in the open spreadsheet. |
| `drive.file` | Grant access to the chosen file for server reads and approved new-tab writes. |
| `script.container.ui` | Display the sidebar and Picker dialog. |
| `script.external_request` | Call the fixed Tidepath HTTPS origin. |

The backend rereads the selected range from Google. Exact source values/formulas, mapping, dates and currency are bound to the preview. Corrections replace the reviewed snapshot rather than accumulating duplicate imports. Reports use donation evidence only. Optional AI receives reporting dates, donation totals and donor count; a bounded repair may also receive the rejected draft and validation messages. Donor contacts and raw rows are excluded from public report model input. Each live request requires the explicit AI checkbox.

Exports require exact approved content and unchanged source evidence. A single Google batch creates the report tab, literal text and its provenance marker. A deterministic identity-bound export key plus readback makes retries safe. Sheets does not provide a transaction that locks arbitrary source cells against other editors: source changes during write cause an error requiring inspection of the newly created tab, never a false success or an overwrite of an existing tab.

## Publisher configuration

1. Use Cloud project `tidepath-public-2026` and the existing standalone public script `1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q`, already linked to standard Cloud project number `397160375233`. The Sheets, Drive, Picker, Apps Script and Marketplace APIs are enabled at the Cloud-project level. Do not create a duplicate project or use the demo's binding.
2. Google Auth Platform accepted the plain brand **Tidepath**; the owner-approved policy agreement, six scopes and Production audience publishing state are saved. Public-site ownership is verified in Google Search Console, but the brand verification UI requires waiting 24 hours for ownership propagation before retrying. Production audience state does not establish OAuth verification. Do not publish temporary tunnel addresses.
3. The web OAuth client and production `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `GOOGLE_ADDON_CLIENT_ID` are configured and deployed. Real website sign-in passed with callback `https://tidepath-sheets.vercel.app/api/auth/google/callback`; the website requests identity scopes only. Native verification confirmed the configured add-on audience against the actual `aud` from `ScriptApp.getIdentityToken()`. Google's [audience guidance](https://developers.google.com/apps-script/guides/services/cloud-run) explains how to inspect that claim. Log only the audience, never the token. Never accept arbitrary Google client IDs.
4. Create a browser API key for Google Picker in the same project. Restrict it to Google Picker API and to the Apps Script referrers `*.google.com` and `*.googleusercontent.com` as documented by Google. Set Apps Script **publisher Script Properties** `TIDEPATH_PICKER_API_KEY` and `TIDEPATH_CLOUD_PROJECT_NUMBER=397160375233`. These are release settings, not customer onboarding steps.
5. Prepare the isolated publisher bundle with `node scripts/publish-addon.mjs --prepare`. This release used manual editor upload under the verified publisher account; initialization and native authorization passed. Immutable **version 1** was created November 7 at 17:11 Eastern with only the four release files; temporary publisher helpers were removed. Its numeric-version test passed authenticated workspace reload, existing-export retry and the consent-gated live-AI approval/export path. The private initializer checks the exact script ID and must not expose tokens or keys. Keep the account-wide Apps Script API setting disabled. Any later API upload must use isolated, verified publisher credentials and the existing public binding, never global clasp/demo credentials. Update the fixed canonical origin in `Code.gs` and `appsscript.json` together if it changes.
6. Apply the production database migrations to the intended isolated database, configure the server's required environment variables, and deploy the tested commit. Confirm production denies the old hackathon API and does not use local JSON state. Record the commit and deployment URL in the release evidence.
7. Execute a native Editor add-on test deployment on a fresh owner-controlled test workbook. Google's [test deployment guide](https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons) describes testing installed/enabled authorization states. Capture real evidence for the cases below before submission.
8. Complete any required OAuth verification, then submit the Marketplace listing using `PUBLIC-ADDON-LISTING.md`. Google's [publication process](https://developers.google.com/workspace/marketplace/how-to-publish) separates OAuth review, Marketplace review and organization installation policies. Approval cannot be inferred from successful test deployment.

## Verified publisher gate on November 7, 2026

The preparation command succeeded, using the restricted Picker key already saved in ignored `.data/public-addon-publisher.json`. Initial API creation attempts using pre-existing clasp authentication were rejected. Identity inspection established that those global credentials belonged to a different Google account, so they must not be used for this public project. No project was created with them and their account settings/credentials were not changed. The publisher helper now requires isolated credentials and verifies `jemsbhai@gmail.com` before any project operation. The prepared bundle is in ignored `.data/public-addon-release`.

The owner approved the Google policy agreement, OAuth setup, temporary Apps Script API access and public support/privacy contact `jemsbhai@gmail.com`. Google accepted the plain brand **Tidepath**; policy acceptance, six scopes and Production audience state are saved. Public-site ownership is verified in Google Search Console; brand verification is waiting on the UI's 24-hour propagation requirement. Marketplace App Configuration is saved with public visibility, individual/admin installation and Sheets script version 1, using the owner-supplied Muntaser Syed/individual/non-trader/free details. The Store Listing draft is also saved with all required fields, All Regions, Office Applications, public links and uploaded icons/banner/real native AI screenshot. It remains **unsubmitted**; saving the draft did not invoke Submit or establish approval.

The standalone script was created through the verified publisher browser and linked to standard Cloud project `397160375233`. Publisher initialization, native Google identity/access checks, Picker and the core fresh-workbook workflow passed. The correction changed $175 to $180, invalidated the earlier approval and required renewed review; export retries reused sheet ID `46207189`. Numeric **version 1** authenticated and reloaded that workspace, reused the same export and generated a real live-AI report only after explicit consent. The approved AI report preserved three donors/$180 and exported to new sheet ID `104509958`. Its explicit workbook-data deletion then cleared the saved review/report workspace while preserving `Sheet1` and both report tabs. See [the dated release evidence](PUBLIC-RELEASE-2026-11-07.md) for deployment identity, source hashes, private screenshot paths and exact coverage.

The publisher account's Apps Script API setting was temporarily enabled and then restored to **OFF**, with the disabled state verified. Keep it disabled during the editor-only upload. The local initializer is guarded for the exact public script ID. Google documents that the account-wide setting permits authorized applications to manage script projects across the account; it is distinct from enabling an API on a Cloud project. See [Apps Script API access](https://developers.google.com/apps-script/api/how-tos/enable).

The web OAuth client and production environment are active. Real website Google sign-in passed on commit `118a4f0`; the native workflow passed against backend `3a87c5d`. Current production is `89edd68`, deployment `dpl_3hFA3Q1Qu1RkAKse5ktkJ3YLRPik` (`READY`), with UI/publisher-page updates and unchanged native backend behavior; its 14 hosted checks passed. Earlier synthetic-session checks remain separate evidence. OAuth verification and Marketplace submission/approval have not been completed.

The public Google Picker API key has been configured to allow only `picker.googleapis.com`, with `https://*.google.com/*` and `https://*.googleusercontent.com/*` referrers. These are public browser-key restrictions; its value is not committed or printed.

## First-release service limits

Each private account supports ten stored workbook workspaces. Each table is bounded to 1,000 donation rows, 32 columns, 2,000 characters per source cell and one megabyte of selected data. Positive USD gifts may total at most $1 billion per table. Each saved workspace is limited to five megabytes and fifty saved report attempts in total, including standard and AI-assisted attempts.

Server usage limits are 120 actions per account per UTC hour, 12 live attempts per account per UTC day and 100 live attempts across the launch service per UTC day. Failed model attempts count; retries of the same saved generation request do not consume another generation allowance. Deleting workbook data clears its fifty-attempt storage capacity but does not reset the account/service usage counters. The demo's twelve-live-attempts-per-workbook limit does not apply to public workspaces.

Saved workbook content expires after 30 days without a successful checkpoint, and reads reject expired workspaces before cleanup. Daily cleanup is configured, but an actual scheduled hosted invocation has not yet been observed. Hashed usage counters expire 30 days after creation and are removed by the next successful cleanup, including after account or workbook-data deletion. Confirm the configured provider backup retention before public launch; application deletion does not promise immediate removal from backups. [PUBLIC-DATABASE.md](PUBLIC-DATABASE.md) documents the runtime credential, migrations, expiry and deletion mechanisms.

## Fresh-workbook acceptance record

Use fictional records in a new workbook owned by the testing account. Never reuse or mutate the working hackathon demo Sheet. Record test date, deployment commit, script version, masked test account, workbook identifier in a private release log, and screenshot paths. Do not capture tokens or donation contacts in public screenshots.

The dated release evidence records the native core workflow already passed. The list below remains the complete acceptance checklist; its presence does not mean every item has been exercised natively.

- Open a workbook with the add-on installed but not enabled; the Extensions menu appears without calling protected services. Authorize and open the sidebar.
- Grant only the requested permissions. Cancel Picker and verify recovery; select a different workbook and verify the mismatch message; select the active workbook and verify the displayed account.
- Use another Google account with no edit permission and a forged workbook ID: confirm denial. Grant edit permission but not file access: confirm Picker is still required. Verify user A's imported workspace is not visible to user B.
- Import a header and four positive USD gifts with stable IDs, native date cells, blank rows, missing optional channel/donor IDs and distinct real reporting dates. Verify exact cents and donor count in the preview before importing.
- Verify invalid dates, duplicate conflicting gift IDs, negative/refund amounts, currency mismatch, spreadsheet errors and oversized selections fail with useful row-specific feedback.
- Review a contact-based identity proposal, confirm amounts and gifts are preserved, and keep a namesake separate. Reimport unchanged data and verify no duplicate gifts. Preview a corrected amount and a removed gift; confirm the change counts before replacing the snapshot and re-reviewing affected merges.
- Generate a standard report without AI. Verify no program data or fictional metrics appear. Generate AI-assisted narrative only after consent; inspect the saved run and checked numeric facts.
- Change a figure to an incorrect value, save and verify approval is blocked. Restore it, save and approve the exact revision.
- Change a source cell after approval and verify write is rejected. Restore or reimport as appropriate, approve a fresh report, write a new tab and retry the same export. Exactly one report tab is created and its contents match the approved export as literal strings.
- Simulate a lost response and retry generation/export with the same request identity. Verify running/failed lease behavior and that quota attempts cannot be reset by deleting data.
- Delete this workbook's Tidepath data and confirm only that user's server records disappear. Source and report tabs remain. Separately test account deletion and sign-out from the website.
- Test with a Workspace account subject to admin restrictions and a browser profile signed into one Google account. A blocked administrator policy must be presented as an external restriction, not silently bypassed.

## Operations and recovery

The sidebar never stores backend credentials. A fresh token is obtained for each request. For a wrong account, open the Sheet in a browser profile signed into the intended editor account; Google's Apps Script runtime does not reliably support simultaneous multi-account sessions. The website account chooser only changes the website session. See [Google's troubleshooting guidance](https://developers.google.com/apps-script/guides/support/troubleshooting).

A source-change error means read the selected table again, preview corrections and reimport. A report write error after creation means inspect the new tab before generating a fresh report; Tidepath will not overwrite a conflicting or edited tab. For a connection error, retry the saved request rather than repeatedly starting generation. A failed or expired generation may require a new request ID after the old reservation is reconciled; attempts remain counted.

Data deletion is available in the sidebar for the current user's workbook and on `/account` for account data. It does not delete the user's original Sheet or report tabs. Uninstall through Google Sheets' add-on manager and revoke Tidepath under the Google account's third-party connections to remove Google authorization. The public privacy page discloses implemented content expiry and the remaining scheduled-cleanup verification. Observe the hosted scheduled job and confirm the provider backup retention before public launch.
