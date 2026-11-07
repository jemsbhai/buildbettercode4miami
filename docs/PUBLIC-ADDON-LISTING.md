# Tidepath Marketplace submission materials

This is prepared standard-report-only listing copy and a review checklist. The earlier version-1 AI offering and screenshots are superseded; replace the saved Marketplace draft after the matching backend and native version are verified. It is not a submitted or approved listing. Publish only after OAuth configuration, hosted native verification and applicable Google reviews are complete. [The dated release record](PUBLIC-RELEASE-2026-11-07.md) distinguishes the deployed backend from these outstanding installation and review gates. [The reviewer package](PUBLIC-ADDON-REVIEW.md) contains the exact project configuration, scope justifications, test fixture, recording outline and submission evidence checklist.

## Listing fields

**Application name:** Tidepath

Use the plain application title consistently in consent, Marketplace and the native script. Descriptive compatibility text may say **for Google Sheets™**. Google Sheets™ is a trademark of Google LLC. This follows the [Marketplace branding exception for compatibility wording](https://developers.google.com/workspace/marketplace/terms/branding); the longer consent title was rejected during setup.

**Short description:** Reconcile donation records and create evidence-backed nonprofit reports in Google Sheets™.

**Detailed description:**

Tidepath helps nonprofit staff turn donation spreadsheets into reports they can review with confidence.

Select your donation table, map its columns and choose the reporting dates. Preview the totals and proposed changes before importing. Review possible donor matches using contact evidence; Tidepath never merges people based on a name alone.

Create a standard report from verified donation totals using a fixed template. Tidepath checks numeric claims against the imported evidence. You review the wording and approve the exact report before it is written to a new tab. Source changes require fresh review, and safe retries avoid duplicate report tabs.

Your original donation table stays in place. Correct it whenever needed, then preview and reimport the updated snapshot. Each Google account has its own private Tidepath workspace. You can delete your saved workbook data from the sidebar or manage account data on the Tidepath website.

Tidepath uses a hosted service to store imported records and verify reports. Standard reports do not call an AI provider or send your data to one. No program dataset is assumed or invented.

The first release supports positive USD donations, one table per workbook workspace, up to 1,000 donation rows, 32 columns and 1 MB of selected data. A table may total up to $1 billion; source cells are limited to 2,000 characters. Stable transaction IDs, donor names, amounts and dates are required. Donor IDs, contact columns and channels are optional. Refunds, negative amounts, multiple currencies, automatic synchronization and shared team workspaces are not supported in this release.

Google Sheets™ is a trademark of Google LLC.

**Application integration:** Sheets Editor add-on.

**Intended audience:** Nonprofit operations and fundraising staff.

**Public support and privacy contact:** [jemsbhai@gmail.com](mailto:jemsbhai@gmail.com), explicitly approved by the publisher. The support, privacy and terms pages link to this address.

**Developer name:** Muntaser Syed, individual developer.

**Trader status:** Non-trader; the publisher has declared this a personal, noncommercial project. No trader mailing address is collected for this declaration. The developer website is `https://tidepath.muntasersyed.com/terms`, which identifies the operator.

**Installation:** Individual Google accounts where allowed by their organization; admin installation policy remains under Google Workspace controls. No domain-wide delegation is used.

**Pricing field:** Select **Free of charge**, with documented service limits; explicitly approved by the publisher. Current service limits are ten stored workbooks per account, fifty saved report attempts per workbook and 120 actions per account per UTC hour. Failed attempts count; replaying a saved generation request does not spend another generation allowance. The public service provides standard reports only and rejects AI-generation requests. See [the release runbook](PUBLIC-ADDON-RELEASE.md) and [database operations](PUBLIC-DATABASE.md) for the exact storage/retention limits and deletion behavior.

| Link field | Intended canonical URL |
| --- | --- |
| Website | `https://tidepath.muntasersyed.com/` |
| Privacy | `https://tidepath.muntasersyed.com/privacy` |
| Terms | `https://tidepath.muntasersyed.com/terms` |
| Support | `https://tidepath.muntasersyed.com/support` |
| Setup/help | `https://tidepath.muntasersyed.com/support` |
| Account management | `https://tidepath.muntasersyed.com/account` |

Verify all URLs are publicly reachable and contain the final policy text before submitting. The publisher has supplied the developer identity, non-trader declaration, pricing and public support/privacy contact above. These are owner declarations, not an independent legal classification. Confirm that they match the saved Google configuration and deployed pages.

## Scope justification for review

Tidepath uses current-document access to capture the user-selected range inside the editor. The selected file is separately granted through Google Picker using `drive.file`, enabling the hosted service to verify edit permission, reread the selected range and write the approved report. It does not request all-Drive or all-spreadsheet scopes. Google identity and email scopes authenticate the current user and display the account. The remaining Apps Script scopes display the sidebar and connect to the fixed HTTPS backend. The exact manifest is `integrations/google-sheets-addon/appsscript.json`.

The browser does not receive the Google ID token. Only the Picker receives the short-lived OAuth token required by Google's supported Picker flow. Tidepath does not persist Google access tokens. All financial calculations and approval checks execute deterministically on the server. The public service uses fixed templates for report preparation and makes no AI provider requests.

## Graphics and screenshots

Original Tidepath vector sources and PNG exports are in `integrations/google-sheets-addon/listing/`. The icons use Tidepath's own mark and do not reproduce Google branding. Prepare real screenshots from the tested native add-on, not mockups presented as verification. Google's [listing asset requirements](https://developers.google.com/workspace/marketplace/create-listing) currently call for 32×32 and 128×128 icons, a 220×140 card banner, and at least one integration screenshot; 1280×800 is the recommended screenshot size.

Capture these screens with fictional test data:

1. Sidebar open inside Sheets, showing the account and a selected table with column mapping.
2. Reviewed import totals and a contact-evidence donor match.
3. Report with numeric checks, explicit approval and the new output tab.

Do not include personal email addresses, browser profile details, developer credentials, the demo tunnel, or unsupported claims such as program metrics. Capture only features confirmed on the submitted code version. Follow Google's [review criteria](https://developers.google.com/workspace/marketplace/about-app-review), including accurate account/sign-out behavior and consistent app naming.

## Reviewer walkthrough

Provide Google reviewers the verified test-install details or access required by the submission form. Do not send credentials through repository files. A reviewer-owned Sheet is supported; suggested test columns are Gift ID, Name, Email, Amount, Date and Channel. Use fictional data and choose dates matching those rows.

After installation, open Extensions → Tidepath → Open Tidepath. Complete Google authorization, choose the currently open spreadsheet in the file picker and verify the displayed account. Select its donation table with headers; read the selection, map columns and choose dates. Preview and import. Review identity proposals, generate a standard report, edit and approve it, then write to a new tab. Source edits must invalidate export until fresh review. Use Data & privacy to delete imported server records.

## Submission gates

- [x] Publish the owner-approved support/privacy contact: `jemsbhai@gmail.com`.
- [x] Receive publisher identity, non-trader declaration and free pricing with service limits.
- [ ] Confirm name availability and copy the approved publisher fields into the Google listing.
- [ ] Verify final publisher-approved privacy, terms and support content on the authorized domain. Hosted page availability is already recorded separately in the release evidence.
- [ ] Observe a scheduled hosted cleanup invocation and confirm provider backup retention for the privacy disclosure.
- [ ] Record the exact tested backend commit, Apps Script version, Cloud project and trusted OAuth client IDs.
- [ ] Complete the fresh-workbook acceptance record in `PUBLIC-ADDON-RELEASE.md`.
- [ ] Finish applicable Google OAuth verification and update consent publishing status appropriately.
- [ ] Replace the historical version-1 AI screenshot with real native screenshots of the verified standard-only release, and confirm reviewer instructions.
- [ ] Configure Marketplace SDK visibility as public and installation options deliberately; Google documents that public/private visibility cannot be changed after saving App Configuration. Use the Sheets Editor add-on integration with the tested script ID and integer version, as detailed in the reviewer package.
- [ ] Submit for Marketplace review and record the submission ID/status.
- [ ] After approval, verify the public install link with a fresh account and record organizational restrictions observed.

Google's [publishing process](https://developers.google.com/workspace/marketplace/how-to-publish) determines the external approval sequence. A successful code deployment does not complete these gates.
