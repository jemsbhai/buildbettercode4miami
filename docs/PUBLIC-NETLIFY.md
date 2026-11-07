# Public service migration to Netlify Free

Prepared on 2026-11-07. This is a migration procedure, not a claim that the new host is already live. The existing Vercel team is **Pro**, with metered usage and a $200 alert budget whose pause action is disabled. That deployment does not satisfy the owner's zero-charge requirement. Do not change the legacy demo or the existing team's plan.

## Required account evidence

The inspected Netlify browser session was signed out. Its sign-in screen explicitly accepts Netlify's agreement; login is on hold pending the owner's approval. No Netlify account, site, paid plan, trial, card, or add-on has been created by this migration work.

After approved sign-in, verify the actual destination team is on the **credit-based Free plan**, with no paid add-ons or upgrades. Do not substitute a legacy Starter plan or assume that a plan named Free has been selected. Save a safe screenshot of the actual plan and remaining credit allowance. If the existing account is paid, use a separate Free team only if the interface explicitly confirms that choice without a paid trial or purchase.

[Netlify's current credit-plan documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) specifies 300 monthly credits and a hard limit for Free, with no auto-recharge option. Its [billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/) states that Free sites pause at their limits and cannot buy add-on credits. This provides a stop-at-limit model, not unlimited availability. Production deployments also consume credits, so test draft deployments before publishing a final candidate. Do not purchase a domain, credits, extra capacity, or another paid feature.

The existing Neon `tidepath-public` resource was verified through its provider metadata as `free_v3`, cost `Free`, with no payment method required. Keep that resource and the existing restricted database login. [Neon's current plan documentation](https://neon.com/docs/introduction/plans) describes Free compute/network suspension and storage limits rather than automatic paid overages. No new database or integration is needed. Provider backup-history duration is still unverified; see `PUBLIC-DATABASE.md`.

## Site and build configuration

Reserve the available site name `tidepath-sheets` if possible. Its Netlify hostname is a deployment/DNS target; availability has not yet been verified. The intended final origin is **https://tidepath.muntasersyed.com**, under the owner's existing verified domain. Add only that subdomain's DNS record after the actual Netlify target is known. Leave the apex domain, other subdomains, and legacy demo unchanged. Do not use a Vercel reverse proxy, which would keep the metered hosting dependency.

`netlify.toml` supplies the public build flag, Node 24, `.next` output, and the scheduled-function directory. `next.config.ts` uses `.next` when Netlify or Vercel runs the build, while retaining `.next-public` for local public builds so the running local demo is preserved. Netlify [supports Next.js through its OpenNext adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/); use its automatic adapter rather than adding a static export or serving only the HTML output. This application needs server route handlers and PostgreSQL.

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
| `TIDEPATH_USAGE_SECRET` | Preserve the existing usage HMAC secret so current rate-limit identities remain stable |
| `AWS_LAMBDA_JS_RUNTIME` | `nodejs24.x` |

Do not copy a whole Vercel environment export. In particular, exclude `OPENAI_API_KEY`, Vercel/OIDC credentials, all owner database credentials, and provider-injected alternate database URLs/passwords. The public report implementation disables paid generation independently of environment variables. An existing external Neon connection is sufficient; attaching a new database integration could inject broader credentials again.

`CRON_SECRET` is not required by the Netlify schedule. Leave the bearer-protected `/api/public/retention` route closed when that value is unset; do not weaken its authorization. The scheduled function calls the restricted store directly.

## Cleanup and verification

`netlify/functions/public-retention.mts` runs at **05:15 UTC daily**. Netlify's [scheduled-function documentation](https://docs.netlify.com/build/functions/scheduled-functions/) says these functions execute on published deploys, cannot be invoked directly by URL, and can be run from the authenticated function dashboard. The handler refuses to run without public-service mode, deletes only expired data through the existing RLS-aware store, and logs a completion count without identities or connection errors.

After publishing, verify its Scheduled badge and next-run time, use **Run now** once, and inspect the `tidepath.retention.complete` log. Record the actual result in `PUBLIC-DATABASE.md`; configuration alone is not evidence of an invocation. If execution reaches the platform timeout, expired records remain inaccessible through the application's expiry checks, but physical cleanup needs a successful retry. A paused Free site may also delay cleanup. Do not describe a daily cleanup guarantee while service capacity is exhausted.

Before traffic cutover:

1. Verify HTTPS for the intended subdomain and set the final public origin. Confirm all deployed function environments have public mode enabled and the restricted DB URL.
2. Root coordinates the Google web OAuth callback, branding/home/privacy/support URLs, existing domain ownership, Apps Script origin and URL-fetch allowlist, Picker restrictions if applicable, and listing links. The callback is `/api/auth/google/callback` on the new origin. Existing Google users and stored tenant/workbook data are preserved; browser cookies require sign-in on the new domain.
3. Run `scripts/verify-public-hosted.mjs` and the restricted-DB `scripts/verify-public-session-hosted.ts` against `TIDEPATH_VERIFY_URL` set to the new origin. Re-run real Google web sign-in and native Sheets import, merge, report approval, export, and safe retry. Do not delete the publisher's real account.
4. Verify unauthorized cleanup requests fail, demo routes are disabled, public paid generation is unavailable, and no provider key appears in the deployed environment.
5. Observe one authenticated cleanup execution and record the Free plan evidence. Re-check public health and the application after DNS cutover.
6. Once the replacement is verified, retire every old dedicated-public Vercel deployment, including immutable URLs that retain old environment values. Use the saved deployment inventory and verify the old URLs no longer execute. Do not remove the separate legacy demo project or revoke its shared API key.

Local preparation verification: the full suite reports **183 tests: 182 passed, 1 skipped, 0 failed**. The skipped test requires an explicit real-database test URL; no database integration test was rerun for this hosting configuration change. All three new scheduled-handler tests pass, including the demo guard and credential-safe failure path. TypeScript checks, four isolated build-configuration cases (local public, Netlify, Vercel, demo), and Node 24 scheduled-function bundling pass. Hosted Netlify build, actual account plan, authenticated cleanup, DNS, and end-to-end tests remain pending until the approved account flow and deployment are completed.
