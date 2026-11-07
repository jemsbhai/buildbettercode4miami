# Public service migration to Netlify Free

Deployed on 2026-11-07 at **https://tidepath.muntasersyed.com** on Netlify's verified credit-based **Free** plan. Source commit `51e9f39` is published as deployment `6aefb7c009d3e43c1de1f189`. The previous dedicated-public Vercel project is paused with Git deployments and cron disabled because its existing **Pro** team does not meet the owner's zero-charge requirement. The legacy demo and the existing team's plan remain unchanged.

## Required account evidence

After the owner's explicit approval of Netlify's terms and Google sign-in, the account was created with `jemsbhai@gmail.com`. The actual `muntaser-syed` team billing page on 2026-11-07 shows **Free**, **$0.00**, **300 credits/month**, no saved credit card, and no paid add-ons. Safe evidence is saved locally as `.data/public-addon-release/netlify-free-plan-2026-11-07.jpg`. No trial, card, or paid feature was selected.

Keep the site on this verified **credit-based Free plan**, with no paid add-ons or upgrades. Do not substitute a legacy Starter plan or assume that another destination team has the same billing controls. The owner separately approved the official CLI's temporary project-management authorization. After all acceptance checks, that grant was revoked in Netlify; the former token then returned HTTP 401. Windows and Linux temporary token copies and the Windows CLI's cached user credential were removed, and Linux had no persisted user credential. The application remained healthy afterward. Evidence is `.data/public-addon-release/netlify-cli-revoked-2026-11-07.jpg`. Future deployments require a new operator authorization; the deployed site does not require this grant.

[Netlify's current credit-plan documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) specifies 300 monthly credits and a hard limit for Free, with no auto-recharge option. Its [billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/) states that Free sites pause at their limits and cannot buy add-on credits. This provides a stop-at-limit model, not unlimited availability. Production deployments also consume credits, so test draft deployments before publishing a final candidate. Do not purchase a domain, credits, extra capacity, or another paid feature.

The existing Neon `tidepath-public` resource was verified through its provider metadata as `free_v3`, cost `Free`, with no payment method required. Keep that resource and the existing restricted database login. [Neon's current plan documentation](https://neon.com/docs/introduction/plans) describes Free compute/network suspension and storage limits rather than automatic paid overages. No new database or integration is needed. The bounded Free-plan retention review, including the unobserved project slider, is recorded in `PUBLIC-DATABASE.md`.

## Site and build configuration

The dedicated `tidepath-sheets` site is reserved in the verified Free team, site ID `c5b62d90-5666-4c70-9da6-11ac0cfef6fe`. Its assigned Netlify hostname is `tidepath-sheets.netlify.app`. The final origin **https://tidepath.muntasersyed.com** is assigned as its primary custom domain, under the owner's existing domain. The authorized DNS changes add the provider's ownership TXT record and the `tidepath` CNAME; apex addresses, other subdomains, and the legacy demo remain unchanged. No Vercel reverse proxy is used.

`netlify.toml` supplies the public build flag, Node 24, `.next` output, and the scheduled-function directory. `next.config.ts` uses `.next` when Netlify or Vercel runs the build, while retaining `.next-public` for local public builds so the running local demo is preserved. Netlify [supports Next.js through its OpenNext adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/); use its automatic adapter rather than adding a static export or serving only the HTML output. This application needs server route handlers and PostgreSQL.

The verified release used Linux Node `24.22.2`, Netlify CLI `27.16.2`, Next `16.4.5`, and OpenNext `5.16.6`. Windows packaging produced invalid Linux path literals in the server handler, so release artifacts must be built on Linux. Use a persistent isolated directory with its own Git boundary, explicit `NETLIFY=true`, the approved public environment, and fail-fast working-directory assertions. WSL's `/tmp` was cleared when that distribution restarted; use a private persistent home-cache directory instead.

For the verified two-step local workflow, run `netlify build --context production`, then deploy with `netlify deploy --prod --no-build --dir .netlify/static --site c5b62d90-5666-4c70-9da6-11ac0cfef6fe`. OpenNext temporarily swaps its static publish directory during the build and restores `.next` at completion; uploading `.next` afterward omits the browser assets' required paths. Inspect both generated functions, scan artifacts for private credential values, and verify actual CSS/JavaScript requests and browser hydration after deployment. The corrected release has 18 static files and two functions. Remote Git builds remain stopped (`stop_builds: true`); do not enable automatic production deployments without considering the Free credit allowance.

Use Node 24 for builds and set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` through the Netlify UI, CLI, or API. The runtime selector cannot be set in `netlify.toml`. [Function configuration documentation](https://docs.netlify.com/build/functions/configuration/) specifies a 60-second synchronous limit and 30-second scheduled limit. The application must keep its existing bounded requests, durable leases, and retry behavior.

## Server environment

Set these values on this site only, with availability in **Functions** and **Builds** as needed. Values declared only under `[build.environment]` do not replace runtime configuration. Never put credentials in `NEXT_PUBLIC_*`, browser code, logs, screenshots, or tracked files.

| Variable | Value/source |
| --- | --- |
| `TIDEPATH_PUBLIC_SERVICE` | `1`, including function runtime |
| `TIDEPATH_PUBLIC_ORIGIN` | Final verified HTTPS origin, with no trailing slash |
| `DATABASE_URL` | Existing restricted `tidepath_public_app` connection from ignored `.env.public.runtime.local`; never the migration/admin URL |
| `GOOGLE_WEB_CLIENT_ID` | Existing public web OAuth client |
| `GOOGLE_WEB_CLIENT_SECRET` | Existing web client secret, transferred without terminal output |
| `GOOGLE_ADDON_CLIENT_ID` | Existing standalone Editor add-on audience |
| `TIDEPATH_SESSION_SECRET` | Existing protected session-flow secret or a securely generated replacement; replacement invalidates in-flight OAuth flows |
| `TIDEPATH_USAGE_SECRET` | Keep the approved replacement stable; see the documented one-time migration below |
| `AWS_LAMBDA_JS_RUNTIME` | `nodejs24.x` |

Do not copy a whole Vercel environment export. In particular, exclude `OPENAI_API_KEY`, Vercel/OIDC credentials, all owner database credentials, and provider-injected alternate database URLs/passwords. The public report implementation disables paid generation independently of environment variables. An existing external Neon connection is sufficient; attaching a new database integration could inject broader credentials again.

The deployed environment was checked against an exact nine-key allowlist. The old sensitive Vercel session/usage secrets were unrecoverable; the owner-approved replacement uses cryptographic randomness and cut over after 23:00 UTC on 2026-11-07, after the only current old hourly command bucket expired. All old counter rows remain. The restricted database URL and Google client credentials were preserved. No model-provider key or migration-owner credential was transferred.

`CRON_SECRET` is not required by the Netlify schedule. Leave the bearer-protected `/api/public/retention` route closed when that value is unset; do not weaken its authorization. The scheduled function calls the restricted store directly.

## Cleanup and verification

`netlify/functions/public-retention.mts` runs at **05:15 UTC daily**. Netlify's [scheduled-function documentation](https://docs.netlify.com/build/functions/scheduled-functions/) says these functions execute on published deploys, cannot be invoked directly by URL, and can be run from the authenticated function dashboard. The handler refuses to run without public-service mode, deletes only expired data through the existing RLS-aware store, and logs a completion count without identities or connection errors.

The deployed Scheduled badge and next-run time were verified. An authenticated **Run now** invocation physically removed one uniquely synthetic expired workspace and preserved an active control; restricted SQL confirmed both effects and the synthetic account/control were then deleted. The real-time dashboard log at 23:39:24 UTC recorded `tidepath.retention.complete`, `deletedWorkbooks: 1`, and a 550.5 ms duration; safe evidence is `.data/public-addon-release/netlify-retention-verified-2026-11-07.jpg`. This verifies a manually triggered hosted execution, not a naturally occurring daily firing. If execution reaches the platform timeout, expired records remain inaccessible through the application's expiry checks, but physical cleanup needs a successful retry. A paused Free site may also delay cleanup. Do not describe a daily cleanup guarantee while service capacity is exhausted.

Before traffic cutover:

1. Verify HTTPS for the intended subdomain and set the final public origin. Confirm all deployed function environments have public mode enabled and the restricted DB URL.
2. Root coordinates the Google web OAuth callback, branding/home/privacy/support URLs, existing domain ownership, Apps Script origin and URL-fetch allowlist, Picker restrictions if applicable, and listing links. The callback is `/api/auth/google/callback` on the new origin. Existing Google users and stored tenant/workbook data are preserved; browser cookies require sign-in on the new domain.
3. Run `scripts/verify-public-hosted.mjs` and the restricted-DB `scripts/verify-public-session-hosted.ts` against `TIDEPATH_VERIFY_URL` set to the new origin. Re-run real Google web sign-in and native Sheets import, merge, report approval, export, and safe retry. Do not delete the publisher's real account.
4. Verify unauthorized cleanup requests fail, demo routes are disabled, public paid generation is unavailable, and no provider key appears in the deployed environment.
5. Observe one authenticated cleanup execution and record the Free plan evidence. Re-check public health and the application after DNS cutover.
6. Once the replacement is verified, retire every old dedicated-public Vercel deployment, including immutable URLs that retain old environment values. Use the saved deployment inventory and verify the old URLs no longer execute. Do not remove the separate legacy demo project or revoke its shared API key.

Local preparation verification: the full suite reports **188 tests: 187 passed, 1 skipped, 0 failed**. The skipped test requires an explicit real-database test URL. All three scheduled-handler tests pass, including the demo guard and credential-safe failure path. TypeScript checks, four isolated build-configuration cases, and Node 24 bundling pass. Independent hosted checks passed all 14 HTTP checks, all ten account-page CSS/JavaScript assets with correct MIME types, the actual restricted-database privilege/isolation check, and eight synthetic-session/deletion/replay checks. Normal TLS validation passes. Real Google/native verification is recorded separately in the release evidence.

The actual billing page after deployment still showed Free, $0.00, no saved credit card, no invoices, zero AI inference, and 224.6 of 300 credits remaining at that observation. Its meter warned that usage can take several minutes to appear. Do not treat that snapshot as a permanent balance; Free exhaustion pauses service rather than charging overages. Safe evidence is `.data/public-addon-release/netlify-final-free-billing-2026-11-07.jpg`.

Final process hygiene found no active Netlify deployment workers. The canonical health endpoint, the existing local demo on port 3210, and its bridge on port 3220 all returned 200 after credential cleanup. Package manifests and the lockfile were unchanged by the dependency repair. Approved ignored application environment files and inert source/build artifacts were preserved; ephemeral CLI credentials were removed. The safe machine-readable record is `.data/public-addon-release/netlify-deployment-evidence.json`.
