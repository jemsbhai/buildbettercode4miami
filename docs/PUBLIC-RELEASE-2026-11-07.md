# Public add-on release evidence — November 7, 2026

The public backend and website are deployed at **https://tidepath-sheets.vercel.app**. The standalone Google Sheets add-on is implemented and packaged, but **is not yet available for public installation**. Google publisher and OAuth configuration has been saved; a new backend deployment to activate the updated environment, completion of the native script setup, Google sign-in and fresh-workbook testing, and applicable OAuth/Marketplace reviews remain unfinished gates.

## Deployed implementation

- Repository: `jemsbhai/buildbettercode4miami`, branch `codex/tidepath-public-addon`.
- Verified application commit: `71b9285c97b99c3769cfb065898de9382c7f96c2`.
- Verified production deployment: `dpl_66DJEeLgVZqXEiSofS9qvSLnmNRc`, state `READY`.
- Vercel project: `tidepath-sheets`, production branch pinned to the public add-on branch. Other branches are excluded by the project's build command.
- Runtime: Node.js 24, hosted Next.js API, persistent Neon PostgreSQL in the US East region, migrations 001–003 applied.
- Runtime database login has no superuser, role-administration or RLS-bypass privilege. The application assumes a restricted role inside transactions. Alternate provider-injected database credentials were also replaced with the restricted login.
- Public hosting rejects the old hackathon API. Existing local demo servers, bound demo add-on and demo workbook were not used as public-product state.

The implemented workflow reads the user's selected donation table through Google, validates dates and mappings, previews additions/corrections/removals, reviews evidence-based donor merges, drafts donation-only reports, validates edits, approves an exact revision and writes a new report tab with provenance. Exports verify current source evidence and use deterministic identifiers plus readback for safe retries. Optional AI requires explicit consent and receives aggregate donation evidence, not donor contacts or raw rows.

## Verification actually completed

| Layer | Result | Scope and limitation |
| --- | --- | --- |
| Full automated suite | 177 passed, 1 skipped, 0 failed | Includes demo regression, public authentication, mapping/corrections, approval, quotas, retries and four Sidebar → Apps Script → route → engine workflow tests. External Google/model calls are controlled test adapters. |
| TypeScript | Passed | `tsc --noEmit`. |
| Production build | Passed on Vercel | Includes hosted runtime chunk loading; early deployment packaging errors were fixed before the verified deployment. |
| Real PostgreSQL suite | 9 checks passed | Isolated temporary schema; includes tenant isolation, concurrency, fencing, sessions, deletion and retained quotas. |
| Actual restricted database login | Passed | Privileges, separate workspaces and fail-closed row-level security. |
| Hosted public HTTP checks | 14 passed | Six public pages, disabled demo routes, unauthenticated account/command/retention rejection, cross-origin rejection and health. |
| Hosted session/database checks | 8 passed | A unique short-lived synthetic session authenticated through the real deployed account endpoint; forged cookies and cross-origin deletion failed; explicit deletion removed the account/session; replay failed. The synthetic account was cleaned up. |
| Browser review | Passed for available pages before OAuth configuration | Homepage and account recovery rendered; the then-unconfigured Google sign-in path showed an explicit setup message. The newly saved OAuth environment still needs deployment and a real sign-in test. |

The hosted session test seeds its session through the database. It is **not** evidence of Google sign-in, an installed Editor add-on or a real fresh-workbook end-to-end run. The database test is skipped in the default suite when its dedicated test connection is absent; it was run separately against the real database. No test used or altered the working demo workbook.

Repeatable commands and database handling are documented in [PUBLIC-DATABASE.md](PUBLIC-DATABASE.md). Hosted checks are in `scripts/verify-public-hosted.mjs` and `scripts/verify-public-session-hosted.ts`; native acceptance cases are in [PUBLIC-ADDON-RELEASE.md](PUBLIC-ADDON-RELEASE.md).

## Google publisher state and remaining gates

The dedicated Cloud project is `tidepath-public-2026` (number `397160375233`). Sheets, Drive, Picker, Apps Script and Marketplace APIs are enabled at the Cloud-project level. A browser key restricted to Google Picker and the documented Google/Apps Script referrers is provisioned; its value remains outside source control.

The owner approved the Google policy agreement, OAuth setup, temporary publisher Apps Script API access and the public support/privacy contact `jemsbhai@gmail.com`. Google Auth Platform branding is saved for **Tidepath for Google Sheets**, the policy agreement is accepted, the six manifest scopes are saved, and `jemsbhai@gmail.com` is added as a test user while the app remains in external testing.

A standalone public Apps Script project was created through the verified publisher browser account: `1v01mOjaBs8PKYubESf1PSwcYWFfrmsc_9wuckpO8HPxXcTdtrmO_9s3Q`. It is linked to standard Cloud project `397160375233`. Manual source upload and publisher initialization are in progress in the native editor. Existing global clasp authentication belongs to a different account and was left unchanged; it is not being used for this project. The publisher account's Apps Script API access was temporarily enabled, then restored to **OFF** and verified. That account-wide setting is separate from enabling the Apps Script API in the Cloud project.

The web OAuth client has been created. `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `GOOGLE_ADDON_CLIENT_ID` are configured in the Vercel production environment. Their activation in a new deployment and real Google sign-in/add-on verification are **pending**. The verified deployment and hosted checks recorded above predate this OAuth configuration; they do not establish a successful Google authorization flow. The isolated upload bundle and exact-script-guarded publisher initializer remain in ignored local storage.

Before public release:

1. Finish the native editor upload and run the guarded publisher initializer in the existing standalone script. Confirm its Picker properties and actual identity-token audience; keep the publisher account Apps Script API setting disabled.
2. Deploy the tested backend with the saved production OAuth environment, verify the exact callback URL and explicit Google account selection, and record the new deployment/commit and observed result.
3. Run the complete native add-on acceptance checklist on a new fictional-data workbook, including permission denial, correction/reimport, approval freshness, lost-response retries and deletion. Test a second account for actual Google access and account separation.
4. Verify the owner-approved support/privacy contact on the deployed public pages, domain verification and final publisher/legal details. Listing assets and draft text are prepared; they do not establish a submitted listing.
5. Verify a scheduled retention invocation and the database provider's actual backup-retention period. Expired workspaces are already rejected on read; a daily purge is configured, but its scheduled execution has not yet been observed.
6. Complete required OAuth verification and Marketplace review; only then add and verify a genuine public install link.

## Known operational limits

The first release supports positive USD gifts only, 1,000 rows, 32 columns, a one-megabyte selected range, a five-megabyte saved workspace and ten saved workbooks per account. It allows 120 commands per UTC hour per account, twelve live generation attempts per UTC day per account and 100 across the service. Failed attempts count; deletion does not erase usage limits. Each workbook retains up to fifty report attempts.

Google Sheets cannot atomically compare arbitrary source cells and create a new report tab against concurrent human edits. Tidepath checks source data before and after writing; a race can leave a newly created, unconfirmed report tab requiring inspection. Existing tabs are never overwritten. Account deletion also cannot retract a Google write that was already sent. These limits are documented rather than treated as a completed atomic guarantee.
