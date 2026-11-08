# FE-01 second pass and FE-02 reconciliation

November 8, 2026. Branch: `codex/fe-01-shell-polish`. This records the comparison, small shell changes, and deferred deployment proposals.

## Delivery priorities

Liam's current target is a feature/code freeze around **3:30 p.m. America/New_York**, superseding the earlier proposed 3:15 buffer. Final submission remains 4:45 p.m. Prioritize feature delivery and usability over additional security hardening for the remaining hackathon work. Preserve existing domain checks and honest fictional/simulated labels.

## Verified branch comparison

Compared `stable` at `256241c` with `origin/feature/fe-02` at `f2aa7cf`; the latter matched the remote branch tip via `git ls-remote`. Liam supplied a teammate screenshot showing a standalone task launcher: italic serif heading, three outlined choices, and no overview metrics or sidebar.

| Area | Stable | Available FE-02 branch |
| --- | --- | --- |
| `/` | Workspace shell, overview cards, evidence, dashboard loading | Same page implementation; welcome view is not mounted |
| Welcome design | Absent | `WelcomeScreen`, three icon buttons, responsive welcome styles |
| Navigation | Working route links in shell | Welcome buttons have no callbacks or hrefs |
| Typography | Existing global fonts | Adds pinned Cormorant Garamond 400 italic through Fontsource and root-layout import |
| Component contract | New views default-exported and feature-organized | Welcome view is a named export at component root |

The available branch does not reproduce the screenshot by itself. The teammate may have additional local work; this has not been inspected. Do not merge it and report the launcher complete.

## Integration guidance

- Preserve the teammate's launcher direction for FE-02. Its remaining wiring is to mount the view at `/`, use real Next.js links to `/inbox`, `/grants`, `/counseling`, and use a page-level h1 and default-exported feature component.
- Confirm whether overview metrics are intentionally removed from `/`; the screenshot alone does not settle their new location or the original FE-02 acceptance scope.
- Keep FE-01's mobile navigation improvement on the feature-route shell. Use visible labels in a two-column grid beneath the brand at <=760px, with 44px minimum targets. Keep overrides scoped to the shell module.
- Replace the shell's hardcoded read-only/no-model-calls banner with `Fictional demo data`; individual features own accurate operation labels.
- Leave legacy workflow migration to FE-04–10. Keep unmounted references available. Existing route entrypoints, page-layer loading, resolved evidence props and ownership map are already present.
- Preserve the pre-existing generated `next-env.d.ts` modification outside this work.

## Merge rehearsal against updated FE-02

Later on November 8, verified remote `stable` remains `256241c` and fetched the newer `feature/fe-02` tip `040ee21` (`add waterfall animation`). This supersedes the earlier `f2aa7cf` comparison for merge readiness. The new launcher uses its own CSS module, adds cascading entrance animations, and respects reduced motion.

- Created a disposable checkout from stable and an unsigned temporary snapshot of the six intended FE-01 files (three source files and three documentation files). Excluded the pre-existing generated `next-env.d.ts` change.
- Merged FE-02 into that snapshot with `--no-commit --no-ff`: clean automatic merge, no unmerged paths. A reverse-order `git merge-tree` also completed without conflicts. No merge or commit was made in the working project.
- The changes touch disjoint files. FE-02 adds its welcome component/module, global display-font helper, root font import and pinned Fontsource dependency. FE-01 changes the shell/module, evidence focus handling and documentation. No package/runtime edits from FE-01 need reconciling.
- Installed the combined lockfile and ran `npm run verify` on native macOS ARM64 with Node 24.19.0 / npm 12.0.2: typecheck, 142 tests, production build and 65 disposable-state HTTP checks all passed. This combined-tree check did not revalidate container architectures or perform a combined browser rehearsal.
- **Functional gap remains:** `src/app/page.tsx` is unchanged on FE-02, `WelcomeScreen` is still unmounted, and its three buttons have no navigation handlers or hrefs. The current merge therefore retains the overview at `/`; a successful build is not proof that the pictured launcher is integrated. Unpushed teammate work remains unknown.

Recommendation: merge the bounded FE-01 changes into stable independently, then complete FE-02's route mounting and real navigation links on the launcher branch and validate that final combined UI before merging it. The screenshot's standalone launcher should replace the overview at `/` only as an explicit FE-02 change; retain the shell on feature routes. Repeat the rehearsal if either branch advances.

## Google sign-in assessment (proposal only)

**Current decision:** Liam deferred deployed authentication to prioritize the feature demo. Do not implement Google sign-in, an administrator access form, or the proposed storage migration in this FE-01 pass. Hosting remains undecided: Vercel and Liam's personal AWS resources are options. A hosting-level password gate may be evaluated later; its availability and coverage have not been verified here. The proposals below are retained for future deployment planning only.

Google OpenID Connect sign-in through a maintained authentication library can gate the app. No auth package, credentials or deployment configuration was added in this pass. Library compatibility with the pinned Next.js/React versions still needs verification.

- Recommended access policy: explicit allowlist of verified Google email addresses for team/judges. Google account ownership alone does not limit access to this group.
- Gate protected page requests and independently check sessions/access in every application API handler before reading or mutating state. Keep login/callback and required static assets public. API denial should return JSON 401/403 rather than login HTML.
- Use library-managed sessions, HTTP-only cookies, HTTPS in deployment, server-only credentials, and a stable session secret. Missing production configuration must fail closed.
- Register exact localhost and deployment callback URLs using separate development/production Google clients. Exercise allowed and denied accounts, direct API access, logout, expired sessions and production configuration failure.
- Preserve credential-free local feature development only through an explicit local-only demo mode. Do not use a deployment-default bypass. Existing production-build smoke checks need an isolated auth-aware verification strategy; tests must not silently weaken deployed behavior.
- Current state storage is one local JSON file serialized within one Node process. Prefer a single Node process with a persistent writable volume for this deadline; Google sign-in alone does not make the store suitable for multi-instance/serverless deployment or create per-user data isolation.

### Liam's follow-up requirements

- Admit explicitly allowed team/judge email addresses, with users addable on the fly.
- All admitted identities may share one Demo Account workspace. Keep each Google identity distinct for admission and administrator privileges; sharing application data does not require sharing login credentials.
- Anticipated host: Vercel. No domain chosen and no Google OAuth web client configured yet. Liam can configure the Google developer account; secrets must stay in local/deployment environment settings.

### Vercel implication and proposed minimum

Vercel Functions have a read-only filesystem except temporary scratch space. The current `.data/state.json` store cannot serve as durable shared deployed storage. Moving it to `/tmp` would not solve persistence or cross-instance consistency. This is a deployment requirement independent of Google sign-in.

For Vercel, propose managed Postgres (for example Neon through the Vercel Marketplace), a single shared demo-state JSON record updated transactionally, and a separate email access table. Preserve domain functions; adapt the storage boundary and callers to asynchronous transactions. Never hold a state transaction open during a model request. Keep admission records outside the demo reset operation.

Use a bootstrap administrator email configured server-side. A minimal administrator-only form adds/removes normalized exact email addresses without redeployment; ordinary admitted users share demo data but cannot grant access. Recheck admission on protected requests so removal affects existing sessions. A project `*.vercel.app` production URL can be chosen before a custom domain; register its exact callback and a separate localhost callback for development. Avoid requiring OAuth registration for every ephemeral preview URL.

This expands beyond the small FE-01 shell pass into authentication plus deployment persistence. It is a proposal, not an implemented migration. Confirm that this larger slice belongs in the remaining deadline before implementation; otherwise keep the existing app on a single persistent Node host or present locally.

Sources: [Vercel runtime filesystem](https://vercel.com/docs/functions/runtimes), [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage).

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Auth.js Google provider](https://authjs.dev/reference/core/providers/google), [Auth.js deployment](https://authjs.dev/getting-started/deployment), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication).

## Validation status

Implemented the scoped mobile navigation, fictional-data banner, and evidence-drawer focus restoration. The drawer now returns keyboard focus to its opener on dismissal.

`npm run verify` passed after the final code change in the native Linux ARM64 devcontainer (Node 24.19.0 / npm 12.0.2): typecheck, 142 tests, production build, 65 disposable-state HTTP checks. No live model credentials were used. No toolchain changes or new architecture claims.

Chrome checks on an isolated production preview confirmed all four routes, active navigation, refresh and back/forward, visible mobile labels and 44px targets at 390px, and no horizontal overflow on all four pages. Desktop rendering had no horizontal overflow. Keyboard evidence opening/Escape dismissal and restored button focus passed; the skip link focused main content. A deliberately invalid disposable state file produced the error/retry UI, and restoring that file then selecting Try again recovered the overview. No browser errors/warnings were captured before the intentional failure check. Loading and empty-state browser fixtures were not separately exercised in this pass.

The bounded FE-01 shell pass is complete; legacy workflow migration remains assigned to FE-04–10, and integrated rehearsal remains FE-11. No FE-02 merge, board update, authentication, deployment, commit or push was performed.
