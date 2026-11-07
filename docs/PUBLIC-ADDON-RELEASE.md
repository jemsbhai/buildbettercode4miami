# Tidepath public add-on release runbook

This is the standalone public product, separate from the bound hackathon sidebar in `integrations/google-sheets`. The intended customer workflow is to install an Editor add-on and authorize their own Google account; they do not paste scripts, run a server, supply an AI key or configure a backend token.

## Release status

Record each gate separately. A hosted website is not evidence of a published add-on.

| Gate | Evidence / current status |
| --- | --- |
| Implementation | Standalone client in `integrations/google-sheets-addon`; production server under `src/lib/public` and `/api/public`. |
| Cloud project | `tidepath-public-2026`, project number `397160375233`; the standalone public script is linked to it. |
| Hosting | Vercel production at `https://tidepath-sheets.vercel.app` is deployed and verified. See [the dated release evidence](PUBLIC-RELEASE-2026-11-07.md) for the exact tested commit, hosted checks and remaining gates. |
| OAuth configuration and verification | Owner approval received; branding and policy acceptance saved, six scopes saved, publisher test account added. Web OAuth client created; production web client ID/secret and add-on audience configured. New deployment and actual Google sign-in are pending; applicable Google verification is not complete. Never put client secrets here. |
| Native installation / fresh workbook E2E | Pending. Standalone script `1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q` was created through the verified publisher browser and linked to the standard Cloud project; native source upload and publisher initialization are in progress. Automated tests and hosted synthetic-session checks do not establish native installation. |
| Marketplace submission | Not submitted. Listing copy/assets are prepared; native verification and Google/publisher prerequisites remain. |
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
2. Google Auth Platform branding is saved as **Tidepath for Google Sheets**; the owner-approved policy agreement is accepted, all six manifest scopes are saved, and `jemsbhai@gmail.com` is a test user. Keep the consent app in external testing during native verification. Confirm all required site domains are owned and verified before submission. Do not publish temporary tunnel addresses.
3. The web OAuth client and production `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `GOOGLE_ADDON_CLIENT_ID` are configured. Verify the registered callback is exactly `https://tidepath-sheets.vercel.app/api/auth/google/callback`, deploy the updated environment, then test explicit account selection. The website requests identity scopes only. Confirm the configured add-on audience matches the actual `aud` from `ScriptApp.getIdentityToken()`; Google's [audience guidance](https://developers.google.com/apps-script/guides/services/cloud-run) explains how to decode that claim. Log only the audience, never the token. Never accept arbitrary Google client IDs.
4. Create a browser API key for Google Picker in the same project. Restrict it to Google Picker API and to the Apps Script referrers `*.google.com` and `*.googleusercontent.com` as documented by Google. Set Apps Script **publisher Script Properties** `TIDEPATH_PICKER_API_KEY` and `TIDEPATH_CLOUD_PROJECT_NUMBER=397160375233`. These are release settings, not customer onboarding steps.
5. Prepare the isolated publisher bundle with `node scripts/publish-addon.mjs --prepare`. The current release uses manual editor upload under the verified publisher account; finish uploading the four add-on files and the generated private `Publisher.gs`, then run its publisher setup wrapper to save the provisioned properties. The initializer checks the exact public script ID; its diagnostic output is limited to the validated audience and must not expose tokens or keys. Keep the account-wide Apps Script API setting disabled. Any later API upload must use isolated, verified publisher credentials and the existing public binding, never global clasp/demo credentials. `Code.gs` and `appsscript.json` use the fixed canonical origin; update both together if that origin changes.
6. Apply the production database migrations to the intended isolated database, configure the server's required environment variables, and deploy the tested commit. Confirm production denies the old hackathon API and does not use local JSON state. Record the commit and deployment URL in the release evidence.
7. Execute a native Editor add-on test deployment on a fresh owner-controlled test workbook. Google's [test deployment guide](https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons) describes testing installed/enabled authorization states. Capture real evidence for the cases below before submission.
8. Complete any required OAuth verification, then submit the Marketplace listing using `PUBLIC-ADDON-LISTING.md`. Google's [publication process](https://developers.google.com/workspace/marketplace/how-to-publish) separates OAuth review, Marketplace review and organization installation policies. Approval cannot be inferred from successful test deployment.

## Verified publisher gate on November 7, 2026

The preparation command succeeded, using the restricted Picker key already saved in ignored `.data/public-addon-publisher.json`. Initial API creation attempts using pre-existing clasp authentication were rejected. Identity inspection established that those global credentials belonged to a different Google account, so they must not be used for this public project. No project was created with them and their account settings/credentials were not changed. The publisher helper now requires isolated credentials and verifies `jemsbhai@gmail.com` before any project operation. The prepared bundle is in ignored `.data/public-addon-release`.

The owner approved the Google policy agreement, OAuth setup, temporary Apps Script API access and public support/privacy contact `jemsbhai@gmail.com`. Branding is saved, the policy agreement is accepted, all six scopes are saved, and that publisher account is included as a test user. The standalone public script above was created through the verified `jemsbhai@gmail.com` browser account and linked to standard Cloud project `397160375233`. Manual source upload and publisher initialization are in progress; no native installation or fresh-workbook acceptance test is claimed complete.

The publisher account's Apps Script API setting was temporarily enabled and then restored to **OFF**, with the disabled state verified. Keep it disabled during the editor-only upload. The local initializer is guarded for the exact public script ID. Google documents that the account-wide setting permits authorized applications to manage script projects across the account; it is distinct from enabling an API on a Cloud project. See [Apps Script API access](https://developers.google.com/apps-script/api/how-tos/enable).

The web OAuth client has been created and the three production OAuth environment variables are saved in Vercel. A new deployment to activate them, real web sign-in, native add-on authorization and fresh-workbook verification remain pending. Earlier hosted synthetic-session tests establish only the website-to-database boundary and do not satisfy those Google gates.

The public Google Picker API key has been configured to allow only `picker.googleapis.com`, with `https://*.google.com/*` and `https://*.googleusercontent.com/*` referrers. These are public browser-key restrictions; its value is not committed or printed.

## First-release service limits

Each private account supports ten stored workbook workspaces. Each table is bounded to 1,000 donation rows, 32 columns, 2,000 characters per source cell and one megabyte of selected data. Positive USD gifts may total at most $1 billion per table. Each saved workspace is limited to five megabytes and fifty saved report attempts in total, including standard and AI-assisted attempts.

Server usage limits are 120 actions per account per UTC hour, 12 live attempts per account per UTC day and 100 live attempts across the launch service per UTC day. Failed model attempts count; retries of the same saved generation request do not consume another generation allowance. Deleting workbook data clears its fifty-attempt storage capacity but does not reset the account/service usage counters. The demo's twelve-live-attempts-per-workbook limit does not apply to public workspaces.

Saved workbook content expires after 30 days without a successful checkpoint, and reads reject expired workspaces before cleanup. Daily cleanup is configured, but an actual scheduled hosted invocation has not yet been observed. Hashed usage counters persist for up to 30 days even after data deletion. Confirm the configured provider backup retention before public launch; application deletion does not promise immediate removal from backups. [PUBLIC-DATABASE.md](PUBLIC-DATABASE.md) documents the runtime credential, migrations, expiry and deletion mechanisms.

## Fresh-workbook acceptance record

Use fictional records in a new workbook owned by the testing account. Never reuse or mutate the working hackathon demo Sheet. Record test date, deployment commit, script version, masked test account, workbook identifier in a private release log, and screenshot paths. Do not capture tokens or donation contacts in public screenshots.

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
