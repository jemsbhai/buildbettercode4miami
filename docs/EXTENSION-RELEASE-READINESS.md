# Tidepath distribution readiness

**Release-work update, November 8:** the user reports paying the Chrome developer registration fee and has now explicitly authorized the remaining store/OAuth publishing steps. The user uploaded a draft for item `bdojcligphldnmdchmlhgibhlldgflcd`; its ownership was independently verified by Google Cloud while creating a separate store OAuth client. Version 0.1.1 has been packaged with that client, icons and policy/setup links. Public OAuth verification and store review/publication remain incomplete. See [the current release record](CHROME-RELEASE-2026-11-08.md) and [submission materials](CHROME-WEB-STORE-SUBMISSION.md). The original readiness assessment below is historical; its earlier authorization limits and missing-assets inventory are superseded where this update says so.

Checked November 8, 2026. **This project's Tidepath extension is not a published Chrome Web Store product. There is no verified public install URL for it.** The available delivery is a local ZIP and a Developer mode **Load unpacked** folder. The tested Google configuration is External **Testing**, restricted to its authorized test account. A working local test is not a public release.

The original readiness review did not authorize publication, deployment, pushing, paid developer registration, billing, or AI calls. A later explicit user request on November 8 authorizes pushing the extension and companion source to GitHub only. Store publication, deployment, billing and AI calls remain outside that authorization. The companion was subsequently started for the user's demo with Google connected, AI off and zero AI attempts.

## GitHub source handoff

The source handoff targets `codex/tidepath-mvp` in `jemsbhai/buildbettercode4miami`: extension assets, the local reconciliation companion, fictional fixtures, tests, packaging and onboarding. The separately developed draft-review endpoint and its mixed handoff updates remain local and are not required by this extension. The earlier combined-workspace result of 244 tests and 72 HTTP checks includes those draft-review changes; it must not be attributed to the narrower source handoff.

Before pushing, the remote MVP branch matched the local baseline, Netlify's authenticated dashboard showed **Builds are stopped**, Vercel returned no project linked to this repository, and the checked-in GitHub workflow had no push trigger for this branch. Private `.data/`, configured output packages, environment files and disposable live workbook IDs are excluded. A GitHub source push is not a Chrome Web Store release or a hosted deployment.

The isolated source snapshot passed the pinned Node 24.19.0/npm 12.0.2 toolchain check, typecheck, **232 tests with zero failures**, production build and **61 deterministic HTTP checks**. The initial temporary build rejected a dependency junction outside its root; copying the same installed dependencies into the temporary snapshot resolved that verification-environment issue, after which build and HTTP checks passed. Source packaging also passed with OAuth unconfigured. The live demo companion and private journal were not restarted or modified by these checks.

## Name and public listing evidence

An unrelated [LaserFocus listing](https://chromewebstore.google.com/detail/laserfocus/edcnhlklckgoniimdjlckopmflhongnh), offered by Ashis Prakash Nayak, already exists for audio/video learning and quizzes. **That URL installs a different product, not this extension.** This confirms a name collision; it does not establish name exclusivity or legal availability. After this collision was found, the user instructed that the extension retain **Tidepath**. The final implementation keeps that name. Future listing text must comply with [Chrome's impersonation and metadata policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

Public searches for Tidepath and the recorded local extension ID found no matching listing. A direct lookup of that ID was inaccessible through the search tool, which alone is not proof of absence. The stronger evidence is the recorded local-only setup and absence of any publication in this delivery. No publisher-dashboard audit was performed.

## Preserved local identity and current package

- Chrome manifest name remains **Tidepath — local Sheets review**; toolbar action remains **Open Tidepath**.
- No implementation rename remains. Extension source, UI, package text, companion text and tests affected by the provisional rename were restored to their exact pre-task hashes. Existing uncommitted implementation work is preserved.
- The surrounding application remains **Tidepath**. Source module names, package name, service identity `tidepath-local`, `X-Tidepath-Extension-Id`, port `4318`, storage keys, journal paths, copy names, and the Google project/client association remain unchanged.
- Keep `out/tidepath-extension/` and `out/tidepath-extension.zip`. Moving an unpacked folder can change its ID and break OAuth. The recorded local ID is `fhgofdchfkpnlffnjcgpajokmggbcilo`; it is not evidence of a store item ID.

The configured local build is rebuilt in the same folder with the existing OAuth client ID and scopes preserved. The source manifest remains unconfigured. **Running `npm run extension:package` without `--oauth-client-id` replaces the output manifest with an unconfigured one.** Supply the same authorized public client ID for a configured rebuild. Do not put private evidence, credentials, or disposable workbook IDs into source or release assets.

Reloading or updating the unpacked extension clears session pairing state; start the companion and pair again only when local use is wanted. Confirm the displayed ID still matches the configured OAuth client. The automation restriction on Chrome's internal and extension pages was respected; no manual reload or new live Google test was performed during this readiness review.

## Distribution choices

| Delivery | What the user gets | Current status |
| --- | --- | --- |
| Local ZIP / Load unpacked | Extract files, enable Developer mode, select a fixed folder | Available locally; includes extension assets only |
| Unlisted store listing | Store installation through a direct URL; no normal search discovery | Not created; still requires review |
| Public store listing | Searchable store installation | Not created; still requires review |
| Private store listing | Restricted installation audience | Not created; still requires review |

These distinctions follow [Chrome distribution settings](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution). A ZIP link or deployed Tidepath website is not an extension installation URL. Ordinary external Windows/macOS installation depends on Web Store hosting; enterprise and Linux exceptions are separate ([installation methods](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)).

## Remaining Chrome Web Store work

1. Obtain an authorized publisher account, complete registration and its one-time fee, and enable required two-step verification. No registration or payment was performed; no fee amount is assumed ([registration](https://developer.chrome.com/docs/webstore/register), [account policies](https://developer.chrome.com/docs/webstore/program-policies/policies)).
2. Prepare a release ZIP with final metadata, version and icon assets, with `manifest.json` at its root. The current packager allowlists eight files; it has no icons and does not bundle the companion. Its ZIP is suitable for local testing, not a completed store submission. Keep credentials and private `.data/` evidence out ([package preparation](https://developer.chrome.com/docs/webstore/prepare)).
3. Author the description, category, language, 128×128 store icon and at least one 1280×800 screenshot. The current official requirements make the small and marquee promotional tiles optional. These assets and a final listing draft have not been prepared ([listing requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)).
4. Publish accurate homepage/support/privacy information and complete the store's single-purpose, permission, data-use and Limited Use declarations. Explain `identity`, session `storage`, loopback access, Google data, local journal retention and optional user-approved AI transfer. A public privacy-policy URL and store disclosures are still missing ([privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)).
5. Set visibility/regions, provide reviewer-accessible companion setup and test instructions, submit for review, resolve review findings, and publish only after separate authorization. Uploading a draft alone does not create a public installation ([publishing workflow](https://developer.chrome.com/docs/webstore/publish)).

## Remaining Google authorization work

| Existing scope | Google's classification | Current use |
| --- | --- | --- |
| `drive.metadata.readonly` | Restricted | Spreadsheet discovery and source-version checks |
| `spreadsheets.readonly` | Sensitive | Selected source workbook reads |
| `drive.file` | Non-sensitive | New correction workbooks created by the app |

Classifications: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes).

The current project remains External **Testing**, billing unlinked, with only the authorized test account. Testing allows up to 100 listed users and these scope authorizations expire after seven days. Moving to **In production** does not itself verify the app; unapproved sensitive/restricted scopes retain warning and user-cap restrictions ([audience settings](https://support.google.com/cloud/answer/15549945)). No audience, branding, consent, client or billing settings were changed during this readiness review.

A future production OAuth client must match the eventual store item ID. Do not assume a new store item will inherit today's unpacked ID. Chrome documents using the uploaded item's public key to align the development ID and creating the OAuth client for that item ID ([Chrome OAuth setup](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)). The current local client should be preserved until an authorized migration is planned.

Prepare production branding, verified domain ownership, public homepage/privacy URLs, support contacts, scope justifications, and a demonstration of consent and each scope's use. Public use of the current scope set requires sensitive/restricted verification unless Google confirms an applicable exception ([restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)).

**Security-assessment applicability and costs remain unresolved.** Google's developer guide ties annual assessment to restricted data accessible through third-party servers; Cloud Help describes assessment more broadly. Submit the actual local-companion and optional AI data flows for review. Local processing alone is not evidence of an approved exemption; do not promise free public verification ([security assessment](https://support.google.com/cloud/answer/13465431), [verification FAQ](https://support.google.com/cloud/answer/13463817)). AI stayed off during this work.

Google recommends `drive.file` with Picker where practical. Reducing the existing scopes would require redesigning discovery, source selection and version/read behavior, followed by verification; deleting scopes from the manifest alone would break the implemented flow ([Drive guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).

## Remaining companion onboarding work

Store installation would install only the extension. Today users need this repository, Node **24.19.0**, npm **12.0.2**, installed dependencies, and a terminal running `npm run sheets:local -- --extension-id YOUR_EXTENSION_ID`. The companion listens only at `127.0.0.1:4318`. They must pair the per-process token and authorize an eligible Google account. Optional AI is unnecessary for deterministic review.

Before broad release:

- Choose and document a supported companion delivery/update method, or explicitly retain source installation as a prerequisite disclosed before installation. No standalone installer, signing or update channel is provided yet.
- Verify fresh-machine installation and operation on each claimed OS, including runtime setup, port conflicts, pairing, reconnect, shutdown, updates and uninstall. Earlier platform tests for the main app do not prove companion onboarding.
- Provide clear journal location/retention/deletion, recovery, support and reviewer instructions. Changing the extension ID requires matching companion and OAuth configuration; updating/reloading loses session pairing. A stopped companion means scans cannot run.

Detailed current instructions are in [EXTENSION.md](EXTENSION.md), including fictional rehearsal, local authorization, Ctrl+C shutdown, and recovery. No hosted backend deployment is necessary for this architecture. Public availability still requires store, OAuth and companion readiness together.

## Evidence and limits

The earlier [live acceptance](EXTENSION-LIVE-ACCEPTANCE.md) covers local test-project OAuth, two-workbook HTTP copying, a one-workbook extension UI flow, source preservation and restart recovery. It does not cover store review, production OAuth or fresh public-user onboarding. Current restoration and package checks are recorded in [VERIFICATION.md](VERIFICATION.md). Private source/copy IDs and full evidence remain in ignored local storage.
