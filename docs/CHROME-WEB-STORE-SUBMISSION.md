# Tidepath Chrome Web Store submission package

Prepared November 8, 2026 against extension/companion source commit `ee829e37a01c054d794204890a7d2a1e28a66980`. The user has authorized the remaining Chrome Web Store publishing work and reports completing publisher registration. This document supplies reviewable listing and disclosure text; current draft milestones are recorded below, without claiming Google approval or public installation. Main-app deployment, billing changes and paid AI calls are separate from store preparation.

## Current store draft and target release

The Chrome Web Store draft item ID is **`bdojcligphldnmdchmlhgibhlldgflcd`**. Google ownership has been verified and a matching Chrome-extension OAuth client has been created. The planned configured release is **version 0.1.1**. These are preparation milestones, not proof of approval, public installation, public OAuth eligibility or a successful configured-package test.

The owner has now confirmed the Package tab displays **0.1.1** after the configured replacement upload. Its SHA-256 is recorded in [the release record](CHROME-RELEASE-2026-11-08.md). Listing, review and OAuth milestones remain separate.

The intended public pages are:

- Homepage and setup: https://tidepath.muntasersyed.com/extension
- Privacy: https://tidepath.muntasersyed.com/extension/privacy
- Terms: https://tidepath.muntasersyed.com/extension/terms

Their static HTML is prepared under `outputs/chrome-web-store/site/extension/`; these URLs are **planned, not yet verified live**. Deploy and check each before using it as a completed submission prerequisite. No public store install URL is claimed while the item is unapproved.

Store-package users run the source companion with the store ID above; they do not create their own OAuth client or modify the installed manifest. Use `--data-file .data/local-sheets/store-google-journal.json` for real Google testing, or `--demo --data-file .data/local-sheets/store-demo-journal.json` for fictional rehearsal. Public Google access remains pending verification; an eligible test account is still required for real Google acceptance. The existing guide's user-owned OAuth setup applies only to locally built unpacked installations.

## Listing fields

| Field | Prepared value |
| --- | --- |
| Name | Tidepath — local Sheets review |
| Planned version | 0.1.1 |
| Store draft item ID | `bdojcligphldnmdchmlhgibhlldgflcd` |
| Short description | Review selected Google Sheets locally and create verified correction copies. Optional AI uses your own local API key. |
| Language | English |
| Category | Productivity, using the closest available dashboard category |
| Support contact | jemsbhai@gmail.com |
| Companion source and setup | [Extension guide](https://github.com/jemsbhai/buildbettercode4miami/blob/codex/tidepath-mvp/docs/EXTENSION.md) |
| Issues | [Repository issues](https://github.com/jemsbhai/buildbettercode4miami/issues) — fictional examples and redacted diagnostics only |
| Privacy policy content | [CHROME-EXTENSION-PRIVACY.md](CHROME-EXTENSION-PRIVACY.md); planned URL `https://tidepath.muntasersyed.com/extension/privacy`, not yet verified live |

### Detailed description — ready to paste after Google access is configured

Tidepath helps you review selected Google Sheets and create checked correction copies while keeping the originals intact.

**Requires a companion running on your computer.** Install the companion from the linked source repository using Node 24.19.0 and npm 12.0.2, then keep its terminal open while using the extension. Installing the extension alone does not start the companion. A Google account with access to the selected spreadsheets is required for real Google data. The publisher configures Google authorization for the store package; users do not need their own OAuth client. A fictional rehearsal works without Google authorization.

Choose the spreadsheets you want to review. Tidepath checks column mappings, duplicate gift and donor identifiers, conflicting records, dates, quantities, currencies and amounts. Findings show the affected source cells. You confirm mappings, inspect proposed changes and approve the exact plan before any correction workbook is created. Suspected duplicate gifts remain in the records; conflicting identities and unsupported values remain for human review.

Correction copies preserve eligible data rows and number formats. They are not full workbook clones: excluded private columns and tabs, general styling, charts, comments, scripts and sharing settings are not copied. Formula-bearing workbooks can be reviewed, but this version blocks correction-copy creation for them. Source-version checks and saved operation history help you recover after an interruption.

The companion processes selected data locally and saves a journal on your device. Google supplies the authorized source data and stores correction copies you approve. Known private labels are filtered, but labels cannot identify every confidential cell; exclude private counseling, health and other unsuitable confidential records before scanning. Tidepath does not monitor other websites or your browsing history.

Deterministic review needs no model key. Optional AI advice requires your own OpenAI API key entered in the local terminal and approval of an exact outgoing request. Only scan issue counts and standard field categories are sent for advice, not raw cells or contact values. OpenAI API use is billed to your account. Advice cannot approve or apply corrections.

See the setup guide for local installation, pairing, supported limits, journal deletion and recovery. This extension is independent of Tidepath's separate website and Google Workspace add-on.

## Privacy practices fields

Chrome requires disclosure even for information processed only on the user's device. The following selections describe the implemented extension and companion, not only data received by the publisher. See [Chrome's user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) and [dashboard guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

### Single purpose

Help users review the quality of explicitly selected Google Sheets and create human-approved correction copies, using a companion on their own computer. Optional explanations support that same review task.

### Permission justifications

| Permission | Ready-to-paste justification |
| --- | --- |
| `identity` | After the user chooses Connect Google account, use Chrome identity.getAuthToken to obtain consented Google authorization for spreadsheet discovery, selected reads and app-created correction workbooks. Tokens are passed only to the paired local companion for those Google API calls. No Google password is collected. |
| `storage` | Use chrome.storage.session, restricted to trusted extension contexts, for the per-process companion pairing token and pending job/plan/request identifiers. This allows recovery without blindly repeating a correction request. No Chrome sync storage, analytics history or persistent spreadsheet database is used by the extension. The companion journal is a separate local file. |
| `http://127.0.0.1/*` | Connect only to the user-run companion at http://127.0.0.1:4318. The companion performs the requested Google API operations and local checks. The extension's fixed origin and Content Security Policy restrict requests to port 4318; a random pairing token and exact extension identity authenticate the session. There is no remote Tidepath backend for this feature. |
| Remote code | No remote executable code. JavaScript and CSS are packaged with the extension. Google JSON and optional AI text are treated as data; spreadsheet content and model output are never executed. The separately installed companion's source is available in the repository. |

### Data categories

Select these categories in the dashboard and keep the published privacy policy consistent:

| Category | Handling to disclose |
| --- | --- |
| Personally identifiable information | Selected spreadsheet records may contain names, donor IDs, email addresses and phone numbers. Google account permission identity is hashed locally for account-bound history. |
| Financial and payment information | Selected donation records include amounts, dates, currencies and payment-channel labels. Tidepath does not process payments or request card numbers. |
| Authentication information | Google access tokens, a local pairing token and an optional user-provided OpenAI API key. Disclose their separate memory/session handling and destinations; do not claim the extension collects a Google password. |
| Website content | User-selected spreadsheet metadata and eligible cell content obtained through Google APIs, findings and approved correction data. This is not arbitrary-page scraping. |

Do not select browsing-history, location, personal-communications, health or general user-activity categories merely because those dashboard options exist: the implemented purpose does not collect them. The product excludes known private labels and asks users to exclude unsuitable confidential data; do not claim these heuristics can guarantee that arbitrary cells contain no sensitive information. If the publisher changes the supported data or behavior, reassess these declarations first.

Certifications supported by the reviewed behavior: data is not sold or transferred outside the disclosed permitted purposes; it is used only for the review-related single purpose; it is not used for creditworthiness or lending. These certifications do **not** mean data never leaves the device: approved copies go to Google, and an explicitly approved optional aggregate advice request goes to OpenAI. A provider's own handling is not a publisher guarantee of zero retention.

For the transport disclosure, [Chrome's User Data FAQ, question 16](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) explicitly excludes communication between an extension and a native program on the same computer from the transmission-encryption requirement. Applying that exception to this user-run Node companion follows from its fixed loopback binding. Google and optional OpenAI internet API requests use HTTPS. Do not describe the loopback link as TLS-encrypted or treat this narrow exception as general approval of the product.

### Google scopes and reviewer explanation

| Scope | Actual use |
| --- | --- |
| `drive.metadata.readonly` | Discover accessible spreadsheet names/IDs and modified times, read source Drive versions for freshness checks, and obtain the account permission identifier for a local journal fingerprint. No arbitrary file-content reads are performed through this scope. |
| `spreadsheets.readonly` | Read the user-selected source workbook metadata, eligible cells, formulas and number formats. Discovery and reading are separate explicit user actions. |
| `drive.file` | Create and access new correction workbooks created by Tidepath, write only those newly created IDs and read them back. The source adapter exposes no operation that writes source workbook data. |

Public OAuth eligibility and verification remain separate from Chrome Web Store review. The optional AI payload is derived Google data even though it omits raw values; include that transfer when explaining the data flow to Google's verification reviewers. [Google's API data policy](https://developers.google.com/terms/api-services-user-data-policy) covers derived data as well as raw data.

## Reviewer instructions

The reviewer must be able to reproduce the submitted package's advertised behavior. Do not present the mock browser harness as a real extension/OAuth test. No private developer credentials or existing disposable workbook IDs are required in these instructions.

### Companion setup and credential-free review

1. Install Node **24.19.0** and npm **12.0.2** and obtain the companion source from the public repository. The tested companion reference is commit `ee829e37a01c054d794204890a7d2a1e28a66980`; record a newer immutable commit if companion behavior changes in the submitted release.
2. In a separate source directory, run:

   ```sh
   git clone --branch codex/tidepath-mvp https://github.com/jemsbhai/buildbettercode4miami.git tidepath-companion
   cd tidepath-companion
   git checkout ee829e37a01c054d794204890a7d2a1e28a66980
   npm ci
   ```

3. Install the extension supplied for Chrome Web Store review and open its toolbar action or options page. Copy the extension ID displayed by **First-time setup**. Do not substitute the developer's unpacked ID.
4. Start the companion in fictional mode:

   ```sh
   npm run sheets:local -- --extension-id YOUR_INSTALLED_EXTENSION_ID --demo --data-file .data/local-sheets/reviewer-demo.json
   ```

5. Leave the terminal open. Paste its generated token into **Local connection token** and choose **Connect local companion**. Verify the fictional fixture label and AI-off state. Do not click Connect Google account in fictional mode.
6. Choose **Find accessible spreadsheets**. Nothing is selected automatically. Enable the multiple-workbook option, select the two fictional workbooks and confirm the scope statement. Scan. Expect seven gift rows, USD 345.00 valid amounts, an invalid amount and a private-tab exclusion.
7. Expand the required mappings, review amount units/currency and select MDY for the ambiguous date. Choose **Confirm mappings and rescan**. Select proposed corrections, review exact values and grouped identity changes, then approve correction copies. Outcomes explicitly say they are fictional and that no Google file was created. Invalid values and conflicting records remain review items.
8. Use **History and recovery** and **Download findings JSON**. **Preview exactly what would leave this computer** displays a local aggregate request; no AI key exists, no provider call is needed, and fictional mode rejects provider calls.
9. Stop with Ctrl+C and wait for **Stopped cleanly**. A subsequent start rotates the pairing token; reconnect to the same mode/journal to inspect saved history. Use a different file for Google mode.

### Real Google review — required before claiming public Google functionality

The submitted manifest must include a Chrome-extension OAuth client bound to **the store item's actual extension ID**. A Google reviewer/test account must be eligible for that client's audience and granted scopes. A local Testing project restricted to the developer's account does not provide reviewer access. Do not ask reviewers to alter the installed store manifest or borrow the developer's Google password. Record the final client/audience verification outcome in the submission; a public client ID is not a client secret.

1. Stop fictional mode cleanly, then start without `--demo`, using a new journal:

   ```sh
   npm run sheets:local -- --extension-id YOUR_INSTALLED_EXTENSION_ID --data-file .data/local-sheets/reviewer-google.json
   ```

2. Pair the new token, choose **Connect Google account**, and complete Google's actual consent flow with the eligible review account. Confirm AI is off. Create a disposable native Google spreadsheet owned by that account with this fictional table; include headers in row 1:

   ```csv
   Gift ID,Donor ID,Name,Email,Phone,Amount,Date,Currency,Quantity
   review-g1,review-d1, Rosa Delgado ,rosa@example.test,3055550101,125.00,2026-07-10,USD,1
   review-g2,review-d2,Rosa Delgado,ROSA@example.test,3055550101,20.00,2026-07-11,usd,1
   review-g3,review-d3,Jo Smith,jo@example.test,,40.00,2026-07-12,USD,1
   ```

3. Discover spreadsheets and select only that disposable workbook. Confirm the scope, scan, confirm mappings with dollar units and USD, and review proposed changes. Keep all three gift rows and USD 185.00. Approve the exact copy plan. Open the new Google workbook and compare it with the original. The original must remain unchanged; the new workbook records only the reviewed corrections. No live AI call is required.
4. Refresh history, disconnect and reconnect, and verify recovery links. Expired authorization must request reconnect. Do not create a new plan merely to retry an uncertain creation; inspect the existing operation first.
5. Optional formula guard: in a separate disposable workbook place a formula in a selected table. Review a normalization proposal, then attempt a copy. The product must reject copying the formula-bearing source before creating a file. This is a documented capability boundary, not a broken correction button.

## Support and uninstall text

If the companion is unreachable, verify its terminal is open, port 4318 is available and the extension ID matches its launch argument. After a restart, use the newly printed pairing token. If Google authorization fails, check the package's OAuth configuration, authorized account and granted scopes. A different Google account needs a different `--data-file`; do not delete another account's journal to resolve the mismatch.

Stop with Ctrl+C and wait for **Stopped cleanly**. After a forced stop, confirm the old process is gone before removing only the corresponding stale `.lock` file. Never remove a lock while a companion may still be running. A source change requires a fresh scan and renewed review. An uncertain copy creation requires history/Drive inspection, not repeated new requests.

Uninstalling the extension does not remove companion source, dependencies, local journals, downloaded findings or Google workbooks. Disconnect Google, forget the pairing connection, stop the companion, and remove the local files you no longer need. Revoke Google authorization through the Google account's third-party access settings. Delete unneeded correction workbooks in Google Drive separately. Contact **jemsbhai@gmail.com** using a fictional reproduction or redacted diagnostic; never send secrets or a real-data journal.

## Submission gates to record

- Confirm the actual publisher account/fee status in the portal and record the new store item ID, uploaded version and package digest. User-reported registration is not a store approval result.
- Supply the final icon/screenshots, public setup/support/privacy links and these completed declarations. Publish the privacy policy at a stable URL before submission; a local Markdown draft is not a live policy link.
- Bind an appropriate Google OAuth client to the store item ID; verify actual Google functionality and reviewer access on the submitted package. The unconfigured source manifest has no OAuth client and cannot perform real Google authorization by itself. Rebuilding a private unpacked package is not a solution for ordinary store users.
- Disclose source installation of the companion before installation. There is no bundled executable, signed installer, automatic companion update or automatic startup. Only claim platforms whose complete setup has been verified; current live extension acceptance is Windows x64.
- Review loopback HTTP and local journal protection honestly. Internet API requests use HTTPS, but the local bearer-token connection and on-disk journal are not encrypted by this implementation. Do not certify an unimplemented encryption guarantee.
- Record review submission, approval, publication and the resulting actual install URL separately. Chrome approval does not complete Google's sensitive/restricted-scope verification. No successful public-install or public-OAuth result is claimed by this document.
