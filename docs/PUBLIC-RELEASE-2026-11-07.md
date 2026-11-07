# Public add-on release evidence — November 7, 2026

The public backend is deployed at [tidepath-sheets.vercel.app](https://tidepath-sheets.vercel.app). Real Google website sign-in and the native Sheets workflow have passed: authorization, import, donor review, report approval, changed-source rejection, correction/reimport, new-tab export and duplicate-safe retry. Immutable Apps Script **version 1** also passed real live-AI generation/approval/export after consent and explicit workbook-data deletion while preserving source/report tabs. The Marketplace Store Listing draft is saved. **The add-on is not yet available for public installation.** OAuth verification and Marketplace submission/approval remain outstanding.

## Deployed implementation

- Repository: `jemsbhai/buildbettercode4miami`, branch `codex/tidepath-public-addon`.
- Current production commit: `89edd686c36040d5dc01c17b8e5318165499188e`.
- Current production deployment: `dpl_3hFA3Q1Qu1RkAKse5ktkJ3YLRPik`, state `READY`. Fourteen hosted checks passed against this release. It updates UI/publisher pages; the native backend behavior verified on `3a87c5d701d1fab666613551652c3266b4e07c54` is unchanged.
- Vercel project: `tidepath-sheets`, production branch pinned to the public add-on branch; other branches are excluded by the build command.
- Runtime: Node.js 24, hosted Next.js API, persistent Neon PostgreSQL in US East, migrations 001–003 applied.
- Runtime database access uses a restricted login and transactional role without superuser, role-administration or RLS-bypass privilege. Alternate provider-injected connection settings also use the restricted login.
- Public hosting rejects the old hackathon API. Existing local demo processes, bound demo add-on, demo data and demo workbook remain separate.

The add-on rereads the selected table through the authenticated user's Google token. It binds preview and approval to actual source evidence, performs exact-cent calculations and requires human decisions for donor merges. Corrections replace a reviewed snapshot. Approved exports create new tabs with literal text and source-cell links; deterministic identifiers and readback make retries safe. Optional AI receives aggregate donation evidence, excluding donor contacts and raw rows.

## Verification actually completed

| Layer | Result | Scope and limitation |
| --- | --- | --- |
| Final automated suite | **178 passed, 1 skipped, 0 failed**; 179 total | Run once after the latest token-header and UI changes. Includes demo regression, public auth, quotas, corrections, approvals, retries and Sidebar → Apps Script → route → engine tests. External Google/model calls use controlled adapters. |
| TypeScript | Passed | Previously recorded `tsc --noEmit` verification. |
| Production build | Passed on Vercel | Current deployment is `READY`; hosted runtime packaging errors were fixed before the verified releases. |
| Real PostgreSQL suite | 9 checks passed | Previously completed against an isolated temporary schema; tenant isolation, concurrency, fencing, sessions, deletion and retained quotas. Not rerun for the final UI/header test pass. |
| Restricted database login | Passed | Privilege checks, private workspaces and fail-closed row-level security. |
| Hosted public HTTP checks | **14 passed on `89edd68`** | Public pages, disabled demo routes, unauthenticated account/command/retention rejection, cross-origin rejection and health. Final canonical-origin rerun passed after the latest deployment. |
| Hosted session/database checks | 8 passed | Synthetic session authenticated through the deployed account endpoint; forged cookies and cross-origin deletion failed; explicit deletion removed account/session and prevented replay. Synthetic account cleaned up. |
| Real website Google OAuth | **Passed** on commit `118a4f0` | Actual Google sign-in through the hosted website, distinct from the synthetic-session test. |
| Native Google authorization and Picker | **Passed** against backend `3a87c5d` | Actual Apps Script ID-token audience, matching access-token user identity, Picker-selected workbook and server-side workbook permission checks. That backend behavior is unchanged in `89edd68`. |
| Native donation/report/export workflow | **Passed for the cases below** | Fresh fictional-data workbook, standard reports, correction/freshness checks and safe export retries; numeric version 1 reloaded the same authenticated workspace. This does not claim Marketplace installation. |
| Native version 1 live AI | **Passed on `89edd68`** | Generate remained disabled until the AI consent checkbox was checked. A real OpenAI report preserved three donors/$180, was approved and exported to a new tab. |
| Native version 1 workbook-data deletion | **Passed** | Explicit confirmation deleted saved workbook records and reset the sidebar to an empty workspace; the source tab and both exported report tabs remained. This is distinct from website account deletion. |

The default suite skips the dedicated database test when its test connection is absent; that suite was run separately against the real database. The synthetic hosted-session test establishes the website-to-database boundary, while the real OAuth and native tests above supply separate Google evidence. No test used or altered the working demo workbook.

## Native fresh-workbook evidence

The standalone Editor add-on ran against a fresh workbook containing four fictional October 2026 gifts. The native checks used the hosted backend, not the loopback demo bridge.

1. Google authorization and Picker connection succeeded. Preview/import showed **four gifts, $175 and four donor identities**. Approving the contact-evidence match reduced identities to **three**, preserving every gift and the total; the namesake stayed separate.
2. A standard donation report was generated. Editing the giving claim to **999**, saving and attempting approval was blocked. Restoring **175**, saving and reviewing allowed approval of the exact **revision 3**.
3. After that approval, source cell **E2** changed from **75.25 to 80.25**. Export was rejected because the source had changed.
4. A new preview showed **0 added, 1 corrected, 0 removed and 3 unchanged** gifts, totaling **$180** with **four identities** before renewed merge review. Reimport invalidated the earlier approval. A fresh human merge decision restored **three donors**.
5. A new standard **$180** report was generated, approved and exported to the new tab **`Tidepath report 2c110d41764b r1`**, sheet ID **`46207189`**. Retrying returned **Already written** and the same sheet ID rather than creating another tab.
6. The saved test was explicitly changed to numeric Apps Script **version 1** and executed. It authenticated, connected and loaded the existing **$180** workspace. Retrying the approved standard export again returned **Already written** with sheet ID **`46207189`**.
7. In native version 1 against backend **`89edd68`**, selecting live AI left Generate disabled until the consent checkbox was checked. After consent for the fictional aggregate data, a real **Live OpenAI** draft succeeded with donation-only wording and the verified **three donors/$180**. The exact draft was approved and exported to **`Tidepath report 63ab205ebc55 r1`**, sheet ID **`104509958`**. A private local screenshot is retained at `.data/public-native-version1-ai-1280x800.png`.
8. In native version 1, **Data & privacy → Delete workbook data** required the explicit **Delete my saved data** confirmation. Deletion succeeded and the sidebar returned to the empty **Choose donation rows** state without its previous review/report data. Source tab **`Sheet1`**, standard report tab **`46207189`** and AI report tab **`104509958`** were all still present. The private screenshot is `.data/public-native-version1-deleted.png`.

These observations establish the main authorized-user path, consent-gated live AI, workbook-data deletion and the specific approval/freshness/retry protections above. A second Google account's permission/isolation cases, real-user website account deletion, interrupted generation and administrator-restricted installation are not claimed complete here. The full acceptance checklist remains in [PUBLIC-ADDON-RELEASE.md](PUBLIC-ADDON-RELEASE.md).

The production header fix is included in the current release: Apps Script transport stripped the reserved `X-Google-*` access-token header. An app-specific header restored the real verified-token path; automated regression coverage now checks that transport contract.

## Immutable Apps Script release

Version **1** was created on **November 7, 2026 at 17:11 Eastern** with deployment ID `AKfycbx5cnyPZwl7JnVRAevEJL1BszWSw8JqCLJEvtVZmHPnb5pebnU0-ldlPGt7xl45FPvoIg`. It contains exactly `Code.gs`, `Sidebar.html`, `Picker.html` and `appsscript.json`; temporary publisher helpers were removed before version creation. The saved test was explicitly selected and executed against numeric version **1**. Authentication, connected workspace reload, existing-export retry, consent-gated live-AI approval/export and workbook-data deletion passed on that version, as recorded above.

The following SHA-256 values identify the four local publisher inputs at repository commit `89edd686c36040d5dc01c17b8e5318165499188e`. These are source-file hashes, not an assertion that a remote version was downloaded and compared byte for byte.

| Publisher input | SHA-256 |
| --- | --- |
| `Code.gs` | `d7e6d232ecd95e86025db49cee3b4a064b80a349453870e40c4c58a141aaa2be` |
| `Sidebar.html` | `2183d7939d1234dfd7bb61e5f392e446d7c27be743ff1adb5b7ec91f10dad047` |
| `Picker.html` | `3ce2d59f73b51268aad94ba161828ae57ec51361eadf93ae5178e950344baa70` |
| `appsscript.json` | `77d7d39ba202d8249817a40614f5a9aa0faf688aa1e5b84837082b3ffc709c5a` |

## Google publisher state

- Dedicated Cloud project: `tidepath-public-2026`, number **`397160375233`**. Sheets, Drive, Picker, Apps Script and Marketplace APIs are enabled at the project level.
- Standalone public script: **`1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q`**, created through the correct publisher browser account and linked to that standard Cloud project. Publisher initialization, native authorization and the workflow above succeeded. Immutable version **1** is recorded above.
- Google accepted the plain application brand **Tidepath**. The policy agreement and six scopes are saved. The OAuth audience publishing state is now **Production**; this is not OAuth verification or Marketplace approval.
- The owner approved public support/privacy contact **`jemsbhai@gmail.com`** and supplied **Muntaser Syed**, individual developer, non-trader, free product. Marketplace App Configuration is saved for **public visibility**, **individual and administrator installation**, the **Sheets integration at script version 1**, and the supplied Muntaser Syed/non-trader details.
- The Marketplace **Store Listing draft is saved**, with the required fields populated: Tidepath name, English descriptions, free-of-charge pricing, **Office Applications**, **All Regions**, publisher information and public policy/support/setup links. The 32/128-pixel icons, 220×140 banner and actual **1280×800 native version 1 AI screenshot** were uploaded. The UI confirmed the draft was saved; local proof is `.data/public-marketplace-draft-saved.png`. **Submit was not invoked and the listing is not submitted or approved.**
- The public site's ownership is verified in Google Search Console. Google's brand verification action is presently blocked by ownership propagation; the UI instructs waiting **24 hours after Search Console verification** before retrying. Verification is not claimed complete.
- The web OAuth client and production `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `GOOGLE_ADDON_CLIENT_ID` are configured and active in the hosted service. Secrets remain outside source control.
- The restricted Picker key and publisher properties are configured. Existing global clasp credentials belong to another account and were left untouched.
- The publisher account's Apps Script API access was temporarily enabled, then restored to **OFF** and verified. Native editor work continues with that setting disabled; Cloud-project API enablement is a separate setting.

## Remaining release gates

1. Preserve numeric Apps Script **version 1** and its recorded backend/source identities for review; repeat relevant acceptance checks if release code changes.
2. Complete the remaining native acceptance cases listed above, especially a second account's Google access/isolation and real-user website account deletion. Workbook-data deletion has passed. Keep the remaining results separate from the checks already recorded.
3. Retry Google brand verification after the stated ownership-propagation window. Review the saved Marketplace App Configuration, Store Listing draft, assets and required declarations before submission. **No public submission or Google approval is recorded.** Complete applicable OAuth verification and Marketplace review, then verify an actual public install link with a fresh account.
4. Observe a scheduled retention invocation and confirm the database provider's actual backup-retention period. Expired content is rejected on read and daily cleanup is configured, but those operational launch checks remain open.

Repeatable database and hosted checks are documented in [PUBLIC-DATABASE.md](PUBLIC-DATABASE.md), `scripts/verify-public-hosted.mjs` and `scripts/verify-public-session-hosted.ts`. The listing/review materials are preparation, not evidence of submission.

## Known operational limits

The first release supports positive USD gifts only: 1,000 rows, 32 columns, 2,000 characters per cell, a one-megabyte selected range and at most $1 billion per table. Each account supports ten workbooks; each saved workspace is limited to five megabytes and fifty report attempts. Usage limits are 120 commands per UTC hour per account, twelve live generation attempts per UTC day per account and 100 across the service. Failed attempts count; deletion does not reset usage limits.

Google Sheets cannot atomically compare arbitrary source cells and create a report tab against concurrent human edits. Tidepath checks before and after writing; a race can leave a new, unconfirmed tab requiring inspection. Existing tabs are never overwritten. Deletion cannot retract a Google write already sent. The successful native tests do not remove those limits.
