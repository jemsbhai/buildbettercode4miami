# Tidepath OAuth verification video handoff

Prepared November 7, 2026. This is a recording plan, not a completed video or submitted verification request. Record the replacement standard-report-only release after the final backend deployment and immutable native version are verified. Earlier version-1 AI demonstrations are historical and do not prove this release.

## Requirement for the current scope set

The publisher observed two scopes classified as sensitive and unverified in Google's current configuration: `script.container.ui` and `script.external_request`. Google's Data Access guidance requires a justification and demonstration video for any sensitive scope, covering every OAuth client assigned to the project. No scope-specific video waiver was found for these two Apps Script scopes. Plan to provide the video before submitting data-access verification. [Google Data Access requirements](https://support.google.com/cloud/answer/15549135?hl=en).

The personal-use, development/testing and internal-organization exceptions do not establish the requested public Marketplace release. A free, noncommercial or non-trader declaration is not a listed OAuth-verification exemption. Leaving the app in Testing does not complete public publication. [Google verification exceptions](https://support.google.com/cloud/answer/13464323?hl=en).

Branding and Marketplace drafts can be prepared before the recording. Do not replace the video with screenshots, a slide animation, a generated imitation of the interface, or a claim that automated tests show the consent flow. Marketplace listing screenshots and the OAuth verification video are separate artifacts.

## Copy-ready scope justifications

**`https://www.googleapis.com/auth/script.container.ui`**

Tidepath displays an HTML sidebar inside Google Sheets so the user can map their selected donation table, preview an import, review donor matches, edit a report, approve its exact contents and request a new report tab. It also opens the modal dialog containing Google Picker so the user can grant access to the active workbook. These user interfaces require `showSidebar` and `showModalDialog`; spreadsheet data permissions alone do not authorize them. The permission does not replace the separately requested current-document and per-file access scopes. [Google Ui reference](https://developers.google.com/apps-script/reference/base/ui).

**`https://www.googleapis.com/auth/script.external_request`**

Tidepath uses Apps Script `UrlFetchApp` to send user-initiated commands to its fixed HTTPS endpoint, `https://tidepath.muntasersyed.com/api/public/command`. The hosted service verifies the user's Google identity and edit access to the chosen workbook, rereads the selected source range, stores that user's imported workspace, checks report figures and approvals, and writes only an approved report to a new tab. The same endpoint supports data deletion. This scope is required for Apps Script to contact that service; current-document and per-file scopes do not permit the outbound request. [Google UrlFetchApp reference](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app).

The submitted public release provides standard reports from fixed templates only. It does not offer AI drafting, call an AI provider or send user data to one. The server rejects live-generation requests independently of the sidebar. Record this release, not the historical version-1 AI workflow.

## Recording setup

Use the final immutable native version and its corresponding production backend, with fictional donation data. Record the exact version and commit in the release record. Use the plain app name **Tidepath**, which is saved in Google branding and the script; compatibility text can say **for Google Sheets™** with the existing attribution.

A read-only local inventory found **Microsoft.ScreenSketch 11.2608.41.0, Status Ok**. The current Windows Snipping Tool supports **Win+Shift+R**, or **Snipping Tool → Record → New**. Select a rectangle that includes the browser address bar, Sheets content and sidebar, then Start. Stop and save the actual recording; preview it before sharing. [Microsoft recording instructions](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots).

Only the operator controlling the browser should start recording. Close unrelated windows and notifications, and keep passwords, tokens, Script Properties, environment files and developer secrets off screen. No recording has been made by the preparation agent. If the installed tool cannot record, the operator can use another screen recorder; the deliverable remains real footage of the submitted app.

Google requires the complete consent flow in English and all integration flows. Voice or text narration is helpful; narration is not stated as a separate mandatory production requirement. The account should be able to show fresh consent. Finish the current acceptance test first; then use an authorized fresh test account, or revoke only the public Tidepath app's grant before recording. Do not revoke or change the separate hackathon demo's access. [Google video guidance](https://support.google.com/cloud/answer/13804565?hl=en).

## Suggested 5–7 minute shot list

The duration is an operator planning suggestion, not a Google requirement. Do not shorten the consent sequence or conceal a required interaction merely to meet it.

| Segment | Actual screen actions | Suggested narration or caption |
| --- | --- | --- |
| Purpose | Open the deployed homepage, privacy, terms and support pages. | “Tidepath is a free donation reconciliation and reporting add-on operated by Muntaser Syed. These pages explain access, standard report preparation, retention and deletion.” |
| Native consent | From the fictional Sheet, open Extensions → Tidepath → Open Tidepath. Show Google's complete authorization screens in English, app name, requested permissions and native client ID. | “This is the Apps Script client for Tidepath. The current-document scope reads the selected table; per-file permission is granted separately through Picker.” |
| UI permission | Show the sidebar, open Picker and select the currently open workbook. Keep the identity displayed by the actual app visible. | “The container UI permission displays this sidebar and the file-selection dialog. The user selects the workbook to which Tidepath receives access.” |
| Hosted processing | Select the complete table, map columns, choose matching dates, preview and import. Show a contact-evidence merge decision. | “These buttons send commands from Apps Script to Tidepath's fixed HTTPS backend using the external-request permission. The service checks identity and file edit access, rereads the chosen range, and stores a private workspace.” |
| Review and output | Generate a standard report, show verified figures, save an edit, approve the exact revision and write to a new tab. Show original donation cells and the new report. | “A standard report uses no AI. The user reviews and approves the exact report before the service writes a new tab. Original source cells stay in place.” |
| Web OAuth client | Open the website account flow and show its Google sign-in/account selection, consent if presented, account page and sign-out. | “The website uses a separate OAuth client in the same project, requesting identity access for account management. Signing in here does not switch the Google account editing the Sheet.” |
| Deletion | Delete the fictional workbook's saved Tidepath data or the test account data through the real controls; show source/report tabs retained. | “Deletion removes saved Tidepath data. It does not remove the user's spreadsheet or exported report tabs. The published policy explains retained usage counters and provider backups.” |

Use the current test fixture or the reproducible one in [PUBLIC-ADDON-REVIEW.md](PUBLIC-ADDON-REVIEW.md). Do not quote expected totals for a different fixture. A successful test on latest code is not evidence of the frozen submitted version.

## Hosting and final handoff

The initial Data Access submission guidance specifies a YouTube video, so an **unlisted YouTube link** is the least ambiguous choice. Google's video-remediation guidance also accepts an accessible Google Drive or other file link when replying to reviewers; use those alternatives only where the actual submission field or reviewer permits them. Confirm the reviewer can play the full video without requesting permission. Do not invent a URL or mark this requirement complete until that check succeeds. [Data Access submission](https://support.google.com/cloud/answer/15549135?hl=en), [video access remediation](https://support.google.com/cloud/answer/13804565?hl=en).

Deliver the following to the publisher:

- Saved recording file and working reviewer URL.
- Recording date, exact native version, production commit and final app name.
- Timestamps for both OAuth clients, complete consent, `script.container.ui` usage and `script.external_request` functionality.
- Confirmation that all six declared scopes match the recorded consent and submission configuration.
- Status of actual data-access submission and any reviewer correspondence; prepared materials alone are not submission evidence.

If no recording is produced, the accurate handoff is: **implementation and review materials prepared; sensitive-scope verification is pending the real demo video and Google review; public installation is not yet available.**
