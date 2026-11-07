# Public add-on release evidence — November 7, 2026

The public project at [tidepath-sheets.vercel.app](https://tidepath-sheets.vercel.app) is **intentionally paused** while the owner's no-payment requirement is resolved for hosting and storage. The retained release supports **standard calculated reports only** and hard-disables public live AI. All nine older Vercel deployments were removed after that release became ready and passed its hosted checks. Canonical and retained immutable URLs now return HTTP 503 `DEPLOYMENT_PAUSED`; deleted deployment URLs return 404. This record does **not** promise zero infrastructure cost or a currently available service.

Real Google website sign-in and the native Sheets workflow have passed: authorization, import, donor review, report approval, changed-source rejection, correction/reimport, new-tab export, duplicate-safe retry and explicit workbook-data deletion preserving source/report tabs. The prior native live-AI test is retained below as historical evidence; it is no longer an available public capability. Apps Script version 1 and the saved Marketplace draft still require standard-only release updates. **The add-on is not yet available for public installation.** OAuth verification and Marketplace submission/approval remain outstanding.

## Deployed implementation

- Repository: `jemsbhai/buildbettercode4miami`, branch `codex/tidepath-public-addon`.
- Retained standard-only release: `ac86c7285fe4d395c9932bd0be4a33e05a4aad96`, deployment `dpl_AGLimKvw9MPhXBHWYoSrwDuksx5d`, observed `READY` before intentional project pause. The canonical domain and its aliases identify this deployment. Fourteen hosted checks passed before and after removal of the older deployments; `/api/public/health` reported `standardReports: true` and `liveAi: false` before the pause.
- The public Vercel project was then paused through the authenticated project API. Both canonical and retained immutable deployment URLs were checked and returned HTTP 503 with `x-vercel-error: DEPLOYMENT_PAUSED`. No unpause was performed. Production environment inspection contains no `OPENAI_API_KEY` or `OPENAI_MODEL`. No paid model call was used for these checks.
- Before any further repository push, only this Vercel project's Git connection was disconnected with the CLI's exact project-ID command. The project API verified `paused: true` and `link: null`; repository pushes no longer trigger deployments for this project. GitHub permissions and other projects were not changed. The project's Cron Jobs setting was subsequently disabled through its dashboard confirmation. Independent API verification reports `crons.disabledAt: 1794091280043`, and `vercel crons ls` reports `enabled: false`. The retained cron definition is disabled; no cron invocation or actual scheduled-run test was performed. See [Vercel's pause documentation](https://vercel.com/docs/projects/managing-projects) and [persistent project-level cron disabling](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).
- Native acceptance release: `89edd686c36040d5dc01c17b8e5318165499188e`, deployment `dpl_3hFA3Q1Qu1RkAKse5ktkJ3YLRPik`, state `READY`. Fourteen hosted checks passed. It updates UI/publisher pages; the native backend behavior verified on `3a87c5d701d1fab666613551652c3266b4e07c54` is unchanged.
- Final disclosure release: `940e679992e11b69cc728ac2376c2159ffb537d7`, deployment `dpl_51f2Q1LmC2pxCR5CtaWM62fFJukj`, observed `READY`; all fourteen hosted checks passed again. This changes privacy/account wording to distinguish 30-day counter expiry from deletion at the next successful cleanup, plus release documentation. Native runtime behavior and Apps Script version 1 are unchanged. Subsequent documentation-only commits do not repeat native acceptance.
- The native acceptance/disclosure deployments above are historical and now deleted. All nine deployments preceding `ac86c72` in this public project were removed by exact deployment ID with Vercel's active-alias safeguard. Post-removal inventory contains only `dpl_AGLimKvw9MPhXBHWYoSrwDuksx5d`; every removed immutable URL returned HTTP 404. The private inventory and check results are `.data/public-deployment-hardoff-inventory.json`. No other project or demo key was changed by this removal.
- Vercel project: `tidepath-sheets`, production branch pinned to the public add-on branch; other branches are excluded by the build command.
- Runtime: Node.js 24, hosted Next.js API, persistent Neon PostgreSQL in US East, migrations 001–003 applied.
- Runtime database access uses a restricted login and transactional role without superuser, role-administration or RLS-bypass privilege. Alternate provider-injected connection settings also use the restricted login.
- Public hosting rejects the old hackathon API. Existing local demo processes, bound demo add-on, demo data and demo workbook remain separate.

The add-on rereads the selected table through the authenticated user's Google token. It binds preview and approval to actual source evidence, performs exact-cent calculations and requires human decisions for donor merges. Corrections replace a reviewed snapshot. Approved exports create new tabs with literal text and source-cell links; deterministic identifiers and readback make retries safe. Standard reports use checked donation facts without a model-provider call. Public live commands are denied at the HTTP boundary before workspace/quota operations, with additional denial in the public workspace engine and direct donation-only drafter, regardless of API key presence or consent.

## Verification actually completed

| Layer | Result | Scope and limitation |
| --- | --- | --- |
| Final automated suite | **179 passed, 1 skipped, 0 failed**; 180 total | Run after public AI hard-disable and standard-only Sidebar changes. Configured-key/forged-mode tests prove no provider call, quota work or workspace change; standard reports and legacy demo tests pass. Includes public auth, corrections, approvals, retries and Sidebar → Apps Script → route → engine tests. External Google/model calls use controlled adapters. |
| TypeScript | Passed | Previously recorded `tsc --noEmit` verification. |
| Production build | Passed on Vercel; project subsequently paused | Retained build reached `READY`; intentional project pause now blocks public requests with 503 `DEPLOYMENT_PAUSED`. |
| Real PostgreSQL suite | 9 checks passed | Previously completed against an isolated temporary schema; tenant isolation, concurrency, fencing, sessions, deletion and retained quotas. Not rerun for the final UI/header test pass. |
| Restricted database login | Passed | Privilege checks, private workspaces and fail-closed row-level security. |
| Hosted public HTTP checks | **14 passed on `ac86c72` before pause** | Public pages, disabled demo routes, unauthenticated account/command/retention rejection, cross-origin rejection and health. Passed before and after deleting old deployments. Health advertised live AI unavailable. No model call was made. |
| Old deployment removal and intentional pause | **Verified** | Inventory contains only the retained standard-only deployment; all nine deleted URLs return 404. Canonical and retained immutable URLs now return 503 `DEPLOYMENT_PAUSED`. |
| Hosted session/database checks | 8 passed | Synthetic session authenticated through the deployed account endpoint; forged cookies and cross-origin deletion failed; explicit deletion removed account/session and prevented replay. Synthetic account cleaned up. |
| Real website Google OAuth | **Passed** on commit `118a4f0` | Actual Google sign-in through the hosted website, distinct from the synthetic-session test. |
| Native Google authorization and Picker | **Passed** against backend `3a87c5d` | Actual Apps Script ID-token audience, matching access-token user identity, Picker-selected workbook and server-side workbook permission checks. That backend behavior is unchanged in `89edd68`. |
| Native donation/report/export workflow | **Passed for the cases below** | Fresh fictional-data workbook, standard reports, correction/freshness checks and safe export retries; numeric version 1 reloaded the same authenticated workspace. This does not claim Marketplace installation. |
| Historical native version 1 live AI | **Previously passed on `89edd68`; now disabled** | A consent-gated OpenAI report preserved three donors/$180 and was approved/exported before the no-provider-charge requirement. That backend was deleted and current public generation rejects live mode. |
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

These historical observations establish the main authorized-user path, workbook-data deletion and the specific approval/freshness/retry protections above. The earlier live-AI observation does not establish an available feature in the current standard-only release. A new standard-only numeric script version, a second Google account's permission/isolation cases, real-user website account deletion, interrupted generation and administrator-restricted installation are not claimed complete here. The full acceptance checklist remains in [PUBLIC-ADDON-RELEASE.md](PUBLIC-ADDON-RELEASE.md).

The production header fix is included in the current release: Apps Script transport stripped the reserved `X-Google-*` access-token header. An app-specific header restored the real verified-token path; automated regression coverage now checks that transport contract.

## Immutable Apps Script release

The following version 1 record is historical. Its UI still contains the old AI option, which the retained server code rejects. The standard-only Sidebar has since been uploaded and saved, but immutable version 2 remains pending the final hosting origin. A proposed Netlify migration has not yet been approved or verified. Publish and verify a new immutable standard-only script version and update the Marketplace configuration/assets before public submission.

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

The migration preparation now passes **182 tests**, with **one database-dependent skip** and **zero failures** (183 total), plus TypeScript, four hosted/local Next configuration checks and scheduled-function bundling. This is preparation, not evidence of a Netlify deployment. Netlify terms/login approval is pending. The publisher's existing Google Search Console **Domain property** `muntasersyed.com` is verified under `jemsbhai@gmail.com` and predates this release (September 20, 2026). Proposed final origin: `https://tidepath.muntasersyed.com`. GoDaddy's new `tidepath` CNAME form is prepared but unsaved; no DNS records were changed. The earlier 24-hour message applied to the old Vercel URL-prefix property and does not by itself settle final-domain verification. The real verification video remains unrecorded.

1. Preserve the historical version 1 evidence, publish a new numeric Apps Script version containing the standard-only sidebar, repeat relevant native acceptance, and update the Marketplace script version and screenshot. Do not restore the removed AI-capable backend builds.
2. Complete the remaining native acceptance cases listed above, especially a second account's Google access/isolation and real-user website account deletion. Workbook-data deletion has passed. Keep the remaining results separate from the checks already recorded.
3. Retry Google brand verification after the stated ownership-propagation window. Review the saved Marketplace App Configuration, Store Listing draft, assets and required declarations before submission. **No public submission or Google approval is recorded.** Complete applicable OAuth verification and Marketplace review, then verify an actual public install link with a fresh account.
4. Observe a scheduled retention invocation and confirm the database provider's actual backup-retention period. Expired content is rejected on read and daily cleanup is configured, but those operational launch checks remain open.
5. Resolve hosting/database billing plans and hard stop controls against the owner's no-payment requirement before public launch. Keep the Vercel project paused until an explicitly coordinated hosting decision. The hard-disabled AI path and removed old deployments establish the model-call safeguard, not a zero-cost infrastructure guarantee. If the origin changes, update the script allowlist, OAuth redirects, public policies and Marketplace links together before repeating hosted/native verification.

Repeatable database and hosted checks are documented in [PUBLIC-DATABASE.md](PUBLIC-DATABASE.md), `scripts/verify-public-hosted.mjs` and `scripts/verify-public-session-hosted.ts`. The listing/review materials are preparation, not evidence of submission.

## Known operational limits

The first release supports positive USD gifts only: 1,000 rows, 32 columns, 2,000 characters per cell, a one-megabyte selected range and at most $1 billion per table. Each account supports ten workbooks; each saved workspace is limited to five megabytes and fifty report attempts, including historical attempts. Usage is limited to 120 commands per UTC hour per account; deletion does not reset that counter. Public live generation is denied outright and cannot consume an earlier AI allowance. The separate legacy demo remains unchanged.

Google Sheets cannot atomically compare arbitrary source cells and create a report tab against concurrent human edits. Tidepath checks before and after writing; a race can leave a new, unconfirmed tab requiring inspection. Existing tabs are never overwritten. Deletion cannot retract a Google write already sent. The successful native tests do not remove those limits.
