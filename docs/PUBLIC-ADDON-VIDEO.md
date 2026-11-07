# Tidepath OAuth verification video handoff

Prepared November 7, 2026. The publisher will record the real demonstration and upload it to YouTube as **Unlisted**; no recording automation is required. This is a recording plan, not a completed video or submitted verification request. The standard-report-only **version 2** passed its numeric-version native test against **https://tidepath.muntasersyed.com**, backend `51e9f39` / Netlify deployment `6aefb7c009d3e43c1de1f189`. Immutable version 2 was created on November 7 at 6:35 PM Eastern. The Marketplace draft references version 2 and contains its real standard-report screenshot. Earlier version-1 AI demonstrations are historical and do not prove this release. The prepared workflow is ready for the publisher's real recording; Google verification and public installation remain pending.

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

Use the verified immutable native version and its corresponding production backend, with fictional donation data. The numeric version-2 Editor test deployment is prepared, the release contains exactly four application files with no temporary publisher/diagnostic helper, and the canonical-host native test has passed. The publisher records that prepared workflow; selecting **Latest code** is not a substitute for version 2. Use native version **2** and backend **`51e9f39`** in the recording handoff. The saved app/script title is **Tidepath**, but the actual website Google account chooser currently displays **muntasersyed.com** while branding is unverified. Record the displayed name accurately. Recording after branding is verified/published is preferable for final-name consistency; a recording today can still demonstrate the real public app if its domain and client identities are clear. The separate branding gate blocks data-access submission, not the act of recording footage.

A read-only local inventory found **Microsoft.ScreenSketch 11.2608.41.0, Status Ok**. The current Windows Snipping Tool supports **Win+Shift+R**, or **Snipping Tool → Record → New**. Select a rectangle that includes the browser address bar, Sheets content and sidebar, then Start. Stop and save the actual recording; preview it before sharing. [Microsoft recording instructions](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots).

The publisher controls the browser and recording. Close unrelated windows and notifications, and keep passwords, tokens, Script Properties, environment files and developer secrets off screen. The agent should not operate other browser windows during the recording. No recording has been made by the preparation agent. If the installed tool cannot record, use another screen recorder; the deliverable remains real footage of the submitted app.

Google requires the complete consent flow in English and all integration flows. Voice or text narration is helpful; narration is not stated as a separate mandatory production requirement. The account should be able to show fresh consent. Acceptance is complete; use an authorized fresh test account, or remove only the public app's existing grant yourself before recording to display the real consent flow again. No Google grant has been revoked as part of this preparation. [Google video guidance](https://support.google.com/cloud/answer/13804565?hl=en).

Identify the public app by **Cloud project `tidepath-public-2026`, number `397160375233`**, the canonical website `https://tidepath.muntasersyed.com`, and these two exact client IDs:

- Native Apps Script: `397160375233-rdjvptver6ofn1gvqh9e7dagoqakir70.apps.googleusercontent.com`.
- Website sign-in: `397160375233-i6opfruas735p3gainimr8aigsf07jgg.apps.googleusercontent.com`.

In your Google Account's third-party connections, the public grant may appear as **muntasersyed.com** rather than Tidepath. Open the connection details and compare its domain, permissions and actual authorization client with the public identifiers above before removing it. A generic display name alone is not sufficient to identify the grant. If the details do not distinguish it from another app, leave it in place and use a fresh authorized test account. Do not revoke or change the separate hackathon demo's access. After removing the identified public grant, reopen the numeric version-2 session and separately start the website sign-in, recording both complete English authorization flows.

## Open the actual version-2 test session

Marketplace installation is not yet available. The publisher should enter through the existing standalone [Tidepath Apps Script project](https://script.google.com/home/projects/1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q/edit): **Deploy → Test deployments → select the Editor add-on test configured for version 2 → Execute**. Confirm the version selector shows the integer **2**, not **Latest code**, before executing. Use the prepared, verified test deployment; do not describe this as a Marketplace installation.

The current fictional acceptance workbook is [Tidepath public add-on acceptance](https://docs.google.com/spreadsheets/d/1KYAvskk7OpSFzgfqQmnKexjqnELz3MjM6MlqjslzSfw/edit). In that workbook:

- Select **Sheet1!A1:G5**, including the header row and all four donation rows.
- Use reporting dates **2026-10-01 through 2026-10-31**, amounts in **dollars**, currency **USD**.
- The initial fresh fixture totaled **$175.00**. The existing sheet has since been corrected and now totals **$180.00 over four gifts**. A fresh import of the current sheet must show $180.00.
- Review the contact-evidence match rather than matching on name alone. After the intended merge, expect **three donors**, still four gifts and $180.00.
- Create a standard report, review and approve those actual figures, then write and retry the same report. Do not reuse an earlier version-1 AI report or its screenshot as version-2 evidence.

These values passed the final version-2 test. An incorrect edited **$999** amount blocked approval; restoring **$180** allowed exact revision **3** to be approved and written to `Tidepath report 83473c954e2a r3` (sheet ID `137655242`). Retry returned **Already written** with that same ID. The real website sign-in returned to clean `/account` without query or fragment, and sign-out passed.

After acceptance, the native **Delete workbook data** action removed saved Tidepath records and the review/report panels. It preserved the corrected source cells and all three existing report tabs. The Sheet is left on **Sheet1!A1:G5** for recording, ready for a new preview/import. The old report tabs are evidence, not a current saved workspace; generate and approve a new standard report during the recording. The optional CSV in the separate reviewer package is a different fixture with different totals; do not mix it into this recording or quote its totals for this Sheet.

## Suggested 5–7 minute shot list

The duration is an operator planning suggestion, not a Google requirement. Do not shorten the consent sequence or conceal a required interaction merely to meet it.

| Segment | Actual screen actions | Suggested narration or caption |
| --- | --- | --- |
| Purpose | Open `https://tidepath.muntasersyed.com`, then its privacy, terms and support pages. Confirm the pages load normally before starting. | “Tidepath is a free donation reconciliation and reporting add-on operated by Muntaser Syed. These pages explain access, standard report preparation, retention and deletion.” |
| Native consent | From the fictional Sheet, open Extensions → Tidepath → Open Tidepath. Show Google's complete authorization screens in English, actual displayed app/domain name, requested permissions and native client ID. | “This is the public Apps Script client for Tidepath, project 397160375233. The current-document scope reads the selected table; per-file permission is granted separately through Picker.” |
| UI permission | Show the sidebar, open Picker and select the currently open workbook. Keep the identity displayed by the actual app visible. | “The container UI permission displays this sidebar and the file-selection dialog. The user selects the workbook to which Tidepath receives access.” |
| Hosted processing | Select the complete table, map columns, choose matching dates, preview and import. Show a contact-evidence merge decision. | “These buttons send commands from Apps Script to Tidepath's fixed HTTPS backend using the external-request permission. The service checks identity and file edit access, rereads the chosen range, and stores a private workspace.” |
| Review and output | Click **Create standard report**, show the verified figures, save a wording edit, approve the exact revision and write to a new tab. Retry the write to demonstrate the same report tab is reused. Show original donation cells and the new report. No AI option or consent should appear. | “The standard report uses a fixed template and no AI service. The user reviews and approves the exact report before the service writes a new tab. Original source cells stay in place.” |
| Web OAuth client | Open `https://tidepath.muntasersyed.com/account`, choose a Google account and show the separate real Google sign-in/consent flow. The chooser currently labels the app `muntasersyed.com`; show that actual label, the canonical policy links and the exact web client ID on Google's authorization URL. Then show clean `/account` and sign-out. Do not pause on transient authorization codes or tokens. | “The website uses a separate OAuth client in the same public project, requesting identity access for account management. Signing in here does not switch the Google account editing the Sheet.” |
| Deletion | Delete the fictional workbook's saved Tidepath data or the test account data through the real controls; show source/report tabs retained. | “Deletion removes saved Tidepath data. It does not remove the user's spreadsheet or exported report tabs. The published policy explains retained usage counters and provider backups.” |

Use the current test fixture or the reproducible one in [PUBLIC-ADDON-REVIEW.md](PUBLIC-ADDON-REVIEW.md). Do not quote expected totals for a different fixture. A successful test on latest code is not evidence of the frozen submitted version. Show both real OAuth clients even if website identity consent has fewer permissions than the native add-on. The native flow demonstrates all six manifest scopes; the web flow requests only `openid email`. A single flow or a screenshot of the Cloud settings does not demonstrate both clients.

## Hosting and final handoff

The initial Data Access submission guidance specifies a YouTube video, so an **unlisted YouTube link** is the least ambiguous choice. Google's video-remediation guidance also accepts an accessible Google Drive or other file link when replying to reviewers; use those alternatives only where the actual submission field or reviewer permits them. Confirm the reviewer can play the full video without requesting permission. Do not invent a URL or mark this requirement complete until that check succeeds. [Data Access submission](https://support.google.com/cloud/answer/15549135?hl=en), [video access remediation](https://support.google.com/cloud/answer/13804565?hl=en).

After recording, preview the full file and upload it to YouTube with **Unlisted** visibility. The OAuth review video does not need to be added as a public Marketplace promotional video. Open the resulting watch link without the publishing account to confirm that reviewers can play it without requesting access. Keep the local recording as evidence.

Record the following in the release handoff:

- Saved recording file and working reviewer URL.
- Recording date, exact native version, production commit and final app name.
- Timestamps for both OAuth clients, complete consent, `script.container.ui` usage and `script.external_request` functionality.
- Comparison of the six manifest scopes with recorded native consent, plus the SDK default-profile display discrepancy documented in PUBLIC-ADDON-REVIEW.md; do not silently expand runtime permissions to match a console default.
- Status of actual data-access submission and any reviewer correspondence; prepared materials alone are not submission evidence.

If no recording is produced, the accurate handoff is: **implementation and review materials prepared; sensitive-scope verification is pending the real demo video and Google review; public installation is not yet available.**
