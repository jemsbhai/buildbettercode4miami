# Tidepath Google review package

Prepared November 7, 2026. This is the submission checklist and reviewer material, not evidence of approval. Use [the release record](PUBLIC-RELEASE-2026-11-07.md) for verified deployment/test results, [the release runbook](PUBLIC-ADDON-RELEASE.md) for native acceptance and [the listing draft](PUBLIC-ADDON-LISTING.md) for store copy.

Historical version-1 evidence includes native authorization, Google Picker, imports and approved standard/AI report writes in a fresh test workbook after the transport-header fix. That AI-capable release is superseded by the standard-report-only release now being prepared. Domain ownership has been verified. An immutable version 1 and Marketplace listing draft are saved; the final replacement version, backend deployment and native tests must be recorded before submission. See the release record for the precise acceptance coverage. OAuth verification, submission and public installation remain separate gates; a successful development test does not establish public availability.

## Approved publisher fields

| Field | Value |
| --- | --- |
| App name | Tidepath |
| Developer | Muntaser Syed, individual developer |
| Publisher declaration | Non-trader; personal, noncommercial project |
| Pricing | Free, with the published service limits |
| Public support/privacy contact | `jemsbhai@gmail.com` |
| Developer website | `https://tidepath-sheets.vercel.app/terms` — identifies the operator |
| App website | `https://tidepath-sheets.vercel.app/` |
| Cloud project | `tidepath-public-2026` / `397160375233` |
| Script ID | `1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q` |
| Native ID-token audience | `397160375233-rdjvptver6ofn1gvqh9e7dagoqakir70.apps.googleusercontent.com` |
| Web callback | `https://tidepath-sheets.vercel.app/api/auth/google/callback` |
| Draft-configured script version | 1 (historical); update the saved SDK draft to the verified standard-only replacement before submission |

Use **Tidepath** as the app title; the longer compatibility title was rejected by Google's consent configuration. Descriptive text can say **for Google Sheets™**, with the attribution **Google Sheets™ is a trademark of Google LLC.** Keep the consent title, script title and Marketplace title identical. [Google compatibility-branding guidance](https://developers.google.com/workspace/marketplace/terms/branding).

These publisher declarations came from the owner. They are not inferred from the email address or GitHub profile. Google collects no mailing address for a non-trader declaration; if the declaration changes to trader, provide the trading/legal name and a valid contact mailing address. The SDK's developer contact email is for Google review correspondence; the approved support address is also intentionally public on Tidepath's own pages. See [Google's developer fields](https://developers.google.com/workspace/marketplace/enable-configure-sdk#provide_information_about_the_app_developer).

No additional legal identity or pricing input is currently missing. The owner must still check the final deployed terms, privacy disclosure, actual backup retention and any terms presented during submission. Name availability, review acceptance and provider settings cannot be asserted from the supplied identity.

## Freeze and test the submitted script version

1. Finish the fresh-workbook cases in the release runbook. Save the final `Code.gs`, `Sidebar.html`, `Picker.html` and `appsscript.json`, including the `X-Tidepath-Google-Access-Token` transport fix, donor-name display polish and standard-report-only action. Remove the AI option and consent; verify the backend rejects live-generation requests even when called directly. The manifest has no Editor add-on title field; its scopes and fixed origin remain unchanged. Final UI includes Google's Editor CSS package and one blue primary action for the current step. Check the native layout at sidebar width after these changes. [Google Editor CSS package](https://developers.google.com/workspace/add-ons/guides/css).
2. Delete temporary `Publisher.gs` and diagnostic/probe files from the native editor after setup; retain the configured Script Properties. The release contains the four application files. Keep the account-wide Apps Script API setting **OFF**.
3. In the standalone editor, choose **Deploy → New deployment → Select type gear → Add-on**. Enter a description identifying the tested backend commit and date, then deploy. This creates an immutable version. For a later update, use **Deploy → Manage deployments → Edit → Version → New version**. Record the integer version under Configuration and inspect it in Project History. [Google deployment instructions](https://developers.google.com/apps-script/concepts/deployments), [version behavior](https://developers.google.com/apps-script/guides/versions).
4. In **Deploy → Test deployments**, select **Editor add-on** and the recorded version instead of latest code. Test that version against the fictional workbook. Record the version alongside each result; a test of latest code does not prove the saved version. [Editor add-on testing](https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons).
5. Record the final backend commit/deployment, file hashes and version in the release record. A backend code change can alter behavior without changing the Apps Script version, so retain both identifiers.

## OAuth verification sequence

1. Select `tidepath-public-2026` in Google Auth Platform. Check Branding against the approved name, logo, email, homepage, `/privacy` and `/terms`. Keep the domain ownership evidence associated with an Owner or Editor of this Cloud project. Check every domain used by website links, callback and authorized origins; do not substitute a temporary tunnel.
2. In **Branding**, run **Verify Branding**, resolve actual findings, then **Publish branding** when ready. Published branding is required before requesting data-access verification. Brand changes during review require restarting that review. [Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
3. In **Data Access**, compare the six exact manifest scopes below with the consent configuration and Marketplace SDK. Record Google's displayed non-sensitive/sensitive/restricted classification. Do not assume the complete scope set is exempt because `drive.file` is narrow. Where verification is required, submit the justifications and video below through **Verification Center**, then track requests sent to the developer contact. Unverified sensitive/restricted scopes can block listing publication. [Marketplace OAuth configuration](https://developers.google.com/workspace/marketplace/configure-oauth-consent-screen).
4. When the tested release and required reviews are ready for public submission, change Audience from external **Testing** to the appropriate production publishing state. Confirm an actual consent flow for the submitted configuration. Marketplace review identifies remaining Testing status as a rejection reason. [Marketplace review criteria](https://developers.google.com/workspace/marketplace/about-app-review).
5. Record brand status, data-access review status, production audience status and their dates independently. Neither native authorization nor adding the publisher as a test user counts as verification approval.

### Exact scopes and Tidepath-specific justification

| Scope | Demonstrated purpose |
| --- | --- |
| `openid` | Authenticate each backend command as the Google subject in the signed native ID token. |
| `https://www.googleapis.com/auth/userinfo.email` | Display the verified Google account and bind identity evidence consistently. |
| `https://www.googleapis.com/auth/spreadsheets.currentonly` | Read the selected range and check source freshness inside the open workbook. |
| `https://www.googleapis.com/auth/drive.file` | Let Picker grant the explicitly chosen workbook; the server checks edit permission, rereads the selected range and writes the exact approved report to a new tab. |
| `https://www.googleapis.com/auth/script.container.ui` | Display the Sheets sidebar and file-selection dialog. |
| `https://www.googleapis.com/auth/script.external_request` | Send authenticated commands from Apps Script to the fixed Tidepath HTTPS backend. |

The current-document scope cannot authorize the server's Sheets REST operations; this is why per-file Picker permission is also required. All-Drive and all-spreadsheet scopes are unnecessary. The browser receives no ID token; only the supported Picker integration receives a short-lived OAuth token. Google tokens are not persisted or exposed in cells. The public service makes no AI provider requests. [Editor scope restrictions](https://developers.google.com/workspace/add-ons/concepts/editor-scopes), [Apps Script Picker requirements](https://developers.google.com/apps-script/guides/dialogs#file-open_dialogs).

**Observed SDK identity-scope discrepancy:** after the publisher entered the six scopes and saved App Configuration, the console displayed `userinfo.email`, `userinfo.profile` and the four functional scopes, while omitting `openid`. This is a recorded console result, not a verified equivalence between `openid` and `profile`. The six manifest/request scopes remain unchanged. Do not add profile access to the application solely to match the SDK display: Google explicitly requires `openid` for `ScriptApp.getIdentityToken()` and treats profile as additional information. Preserve the intended scope declaration and saved-console evidence for review/support clarification before claiming exact alignment. [ScriptApp identity-token requirements](https://developers.google.com/apps-script/reference/script/script-app#getIdentityToken()), [SDK scope alignment guidance](https://developers.google.com/workspace/marketplace/enable-configure-sdk#specify_the_level_of_access_that_your_app_requires).

### Verification video outline

The publisher has now observed `script.container.ui` and `script.external_request` classified as sensitive and unverified. A real demonstration video is required for this submission; no scope-specific waiver was found. [PUBLIC-ADDON-VIDEO.md](PUBLIC-ADDON-VIDEO.md) gives copy-ready justifications, the available local recording option and a precise operator handoff.

Record the real release in English, upload it as an unlisted YouTube video and provide the link privately in the review form. Show the consent app name and client ID in the address bar, authorization, both OAuth client flows, and the feature enabled by each requested scope. These are Google's [sensitive-scope video requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

Use a dedicated test account and fictional rows. Never record token values, developer secrets or real donor records. The following shot list is specific to Tidepath:

1. Open the public homepage, privacy, terms and support links; show the matching app name and declared operator.
2. Start from a fresh add-on authorization. Show the real Google consent flow, then the sidebar's verified account. Separately demonstrate website Google sign-in, explicit account choice and sign-out.
3. Open Picker, cancel once, then select the currently open workbook. Show that selecting a different file produces the intended recovery message.
4. Read the selected table, map columns, choose dates and preview/import. Explain that only this selected data is imported; show a donor proposal and the human decision.
5. Generate a standard report, edit it, approve the exact revision and write a new report tab. Show source cells still intact. Explain the fixed backend call and per-file Google access supporting this action.
6. Demonstrate deletion from the sidebar and account controls, then Google access revocation. Do not show temporary bypasses or developer configuration as customer onboarding.

## Marketplace SDK and store listing

Open the **Google Workspace Marketplace SDK**, not the similarly named licensing API, in the same Cloud project. Configure **Public**, **Individual + Admin Install**, and **Editor add-on → Sheets**. Supply the script ID above and tested integer version; a Workspace add-on deployment ID or web-app URL is not the Editor add-on identifier. Public/private visibility is permanent when App Configuration is saved. This consumer Gmail publisher can publish only publicly. Enter the six scopes and approved developer fields, then save the draft. [SDK configuration](https://developers.google.com/workspace/marketplace/enable-configure-sdk).

In **Store Listing**, use the approved [listing copy](PUBLIC-ADDON-LISTING.md), English language, the most relevant available category, **Free of charge** pricing, real support/privacy/terms links, icons and native screenshots. Choose intended distribution regions deliberately. Save the draft while review evidence is incomplete. After applicable OAuth approval and final acceptance, **Submit For Review**. Record the status and correspondence; the public listing is published after approval. Organization installation restrictions can still apply. [Store listing workflow](https://developers.google.com/workspace/marketplace/create-listing), [public publishing process](https://developers.google.com/workspace/marketplace/how-to-publish).

## Reproducible reviewer workbook

Historical version-1 Store Listing evidence: the draft was saved with the earlier AI-capable English copy, **Free of charge**, **Office Applications**, **All Regions**, canonical support/policy links, the post-install tip, 32/128 icons, 220×140 banner and the real version-1 AI report screenshot at 1280×800. The console confirmed **Draft saved** and disabled Save Draft after persistence. Local evidence is `.data/public-marketplace-draft-saved.png`; the uploaded native image is `.data/public-native-version1-ai-1280x800.png`. No review submission or new legal acceptance was performed. Optional web-app icons, admin configuration, draft testers and promotional video were left blank. This draft and screenshot are superseded. After the standard-only website and backend are deployed and the replacement native version is tested, update the draft with current listing copy and a real replacement-version screenshot; do not submit the old AI-capable materials.

The reviewer can create a new Sheet in their own account and paste this fictional table in A1. This is an optional reproducible fixture, not a claim that the publisher's separate native test used these exact rows. Format dates as dates, map the six headers, select A1:F5, use dollars, USD and reporting dates **2026-10-01 through 2026-10-31**. Leave donor ID and phone unmapped.

```csv
Gift ID,Name,Email,Amount,Date,Channel
TP-101,Avery Stone,avery@example.test,100.00,2026-10-03,online
TP-102,A. Stone,avery@example.test,75.00,2026-10-12,check
TP-103,Jordan Reed,jordan@example.test,50.00,2026-10-21,tickets
TP-104,Jordan Reed,other-jordan@example.test,25.00,2026-10-24,other
```

Expected checks, to record as passed only after executing them:

- Initial preview: four gifts, **$250.00**, four separate donor records because no donor IDs were supplied. The shared Avery email supports a proposed merge; the two Jordan names alone do not.
- Approve the Avery proposal: three donor identities, still four gifts and **$250.00**. Do not merge the two Jordans solely by name.
- Reimport unchanged rows: no duplicate gifts and no monetary change.
- Change TP-103 to **60.00** and remove TP-104. Reselect A1:F4. Preview one correction and one removal; resulting total **$235.00** over three gifts. Review the new snapshot and any affected identity decisions.
- Standard report uses those donation facts without invented program outcomes. An incorrect edited amount must block approval. A later source edit must block write until the source is freshly reviewed.
- Approve the valid revision and write: one new report tab containing the approved text. Retry the same write: same verified tab, no duplicate. Source table stays intact.
- Delete workbook data: the account's saved Tidepath workbook data disappears; source and output tabs remain in Google Drive.

Provide reviewers direct test-install/access instructions accepted by the submission form and any required reviewer access through a private channel. Do not put a Google password, reusable token, cookie or customer workbook in this repository. Free users require no separate Tidepath credentials. If a review-only access gate is introduced, explicitly provision it and document it before submission.

## Evidence index to complete before submission

| Evidence | Location or required record |
| --- | --- |
| Backend commit and deployed environment | Dated release record; update after final fixes and public-page changes |
| Native script version and four file hashes | Release record; verify the tested version matches SDK configuration |
| Native permission, preview, merge, report, approval, write/retry and deletion cases | Fresh-workbook acceptance record; distinguish passed, failed and untested cases |
| Actual second-account denial and isolation | Private acceptance log with masked accounts; synthetic tests remain separately labeled |
| Public support/pricing/operator/policies | Deployed page checks after the approved publisher-copy update |
| Domain ownership | Owner verification evidence in the correct Cloud project; no secret verification token in repository |
| Consent/Data Access/Marketplace scopes | Six-scope comparison plus actual console classifications |
| Branding/data-access review/production status | Dated screenshots or status records; no inferred approvals |
| Native listing screenshots | Real 1280×800 captures of mapping, evidence review and approved output; original brand assets already prepared |
| Required sensitive-scope video | Working review URL, recording date and tested script/backend identifiers; see PUBLIC-ADDON-VIDEO.md |
| Retention and backup disclosure | Observed scheduled hosted cleanup plus actual provider backup duration; see PUBLIC-DATABASE.md |
| Marketplace SDK draft | Sheets Editor integration, exact version, public visibility, installation settings, approved developer fields |
| Submitted listing | Submission date, status/reference and reviewer requests; pending until an actual submission |
| Public installation after approval | Genuine listing URL and a fresh external account installation; capture relevant admin-policy restrictions |

Do not describe a development test installation as Marketplace installation, a deployment as Google approval, or prepared screenshots/video as recorded evidence. Until the last gate is observed, the site should continue to state that public installation is pending Google review.
