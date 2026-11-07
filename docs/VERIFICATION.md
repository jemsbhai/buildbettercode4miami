# Verification — November 7, 2026

Verified on Windows using Node.js 24.22.1, Next.js 16.4.5, and the installed lockfile.

- **33 automated tests passed:** financial/identity invariants, completed-session absence rules, donor lapse evidence, atomic idempotent import, structured claims, application word limits, grant fiscal boundaries, disclosure policy/hash/revision checks, note privacy, simulated delivery, persisted restart, rollback and reset.
- **32 local HTTP checks passed:** UI-compatible Origin header, rejection of unrelated-origin writes, core CRUD, blocked wrong claims, correct approval/export, application export within its limit, repeat import, note edit invalidation, nonpayable exclusion and reset.
- **Live OpenAI Agents SDK verified:** `gpt-5.4-mini` called the evidence tool, returned a structured report and passed approval; the successful recorded test used 1,013 input and 115 output tokens. Demo mode was verified separately. A prior live output with numbers in its title was blocked; titles are now application-owned so a model cannot create an uneditable invalid title.
- **Browser verified:** donor count changes from five to three with giving unchanged; a wrong participant count is blocked and corrected before approval; grant-ledger exceptions render; application generation/approval works; a counseling preview excludes the planted private detail and receives exact-copy approval.
- **Production build and TypeScript passed.**

The browser walkthrough exposed and fixed an Origin check mismatch between Next's internal URL and the browser's actual Host. The HTTP test now sends the browser-equivalent Origin and checks rejection of a foreign Origin. Review also fixed application exports to contain only the word-counted answer; report provenance remains available in the workspace.

The visible default browser surface was approximately 600 pixels wide and rendered its compact navigation without horizontal overflow. A broader device matrix has not been run.

Limits: external delivery is simulated; no message was sent. Funder documents are exported, not submitted. This verifies fictional local workflows, not production authentication, clinical privacy compliance, or multi-instance persistence. The judging rubric remains unverified.

Documentation update, November 7: Liam supplied a final submission cutoff of **November 8, 2026, 4:45 PM Eastern**. Shared ARM64/x86-64 dev-container requirements are recorded in [project memory](PROJECT-CONTEXT.md); container implementation and cross-platform validation remain pending. This update did not rerun the application checks recorded above.

## Shared development baseline — November 7, 2026

The subsequent `feature/frontend-base` implementation uses Node **24.19.0**, npm **12.0.2**, Dev Container CLI **0.90.0**, and exact direct dependency versions from the existing lockfile. The multi-architecture Node Bookworm image is pinned by index digest. No transitive lockfile entry changed.

| Environment exercised | Installation | Typecheck / 33 tests / production build | 32 deterministic HTTP checks |
| --- | --- | --- | --- |
| macOS ARM64, native Node/npm | Passed, including clean offline `npm ci` | Passed | Passed |
| Linux ARM64, Docker Desktop on macOS ARM64 | Passed through the checked-in devcontainer | Passed | Passed |
| Linux x86-64, emulated on the same ARM64 host | Passed using the image built from the checked-in configuration and matching runtime settings | Passed | Passed |

Additional checks:

- Both container architectures run as non-root `node`, have writable workspace/dependency/build directories, can access the Git checkout, and provide Git, Bash, curl, ripgrep and less.
- ARM64 container recreation reused its isolated volumes and completed `npm ci`; typecheck still passed after recreation. Host and container dependency/build directories remained separate.
- A temporary bind-mounted route was served, edited, and served with its changed content by the ARM64 development server. The probe and temporary state were removed afterward. This verifies source watching/recompilation, not browser HMR behavior.
- The toolchain checker rejected incorrect npm and non-npm installer user agents. npm rejected incompatible runtime/package-manager declarations in isolated failure fixtures before running their scripts.
- The image's bundled npm **11.17.0** successfully bootstrapped to **12.0.2** from a read-only checkout containing the strict declarations, matching the documented native/CI upgrade path.
- An occupied port 3210 caused `npm run verify` to fail without sending requests to the existing server. Successful checks used disposable state, made no live calls, and left no `.data/state.json` in the checkout.
- A SHA-256 snapshot of all 58 tracked/unignored source/configuration files was unchanged by the final validation runs. `git diff --check`, JavaScript syntax checks, and **actionlint 1.7.9** passed.
- Final review moved TypeScript's incremental cache under `.next/cache` to isolate it between workflows. Typecheck and production build were repeated successfully in all three environments, and the cache file was confirmed in each build directory.

Not yet verified: hosted GitHub Actions runs, native x86-64 hardware, Windows/WSL2, the updated PowerShell launcher, and interactive VS Code reopen/forwarding/browser HMR. The Dev Containers extension is installed locally, but Computer Use could not start its native automation pipe, preventing the interactive checks. The workflow is configured for native Linux ARM64 and x86-64 runners; configuration and local checks do not establish a hosted result. No commit, push or live model test was performed for this baseline.

## Devcontainer CLI port publishing — November 7, 2026

`feature/frontend-base` additionally declares `appPort: [3000]` and adds the `npm run dev:container` script (`next dev --hostname 0.0.0.0 --port 3000`). The Dev Container CLI maps a numeric `appPort` to Docker publishing on host loopback only (`-p 127.0.0.1:3000:3000`), giving editors that cannot run the Dev Containers extension (such as VSCodium) the same container, dependencies and port access without any temporary configuration. `npm run dev` remains loopback-bound for native and VS Code workflows. The mapping was confirmed in the CLI's source, the standalone installer's `--version` option in its script, the `appPort` shape against the devcontainer schema, and both flags against the pinned Next.js 16.4.5 CLI.

After the change, in a hosted Linux x86-64 sandbox using the exact pinned toolchain (Node 24.19.0, npm 12.0.2, `engine-strict` install), `npm run verify` passed end to end: toolchain check, typecheck, 33 tests, production build, and the 32 deterministic HTTP checks (exit 0). The scripts-only `package.json` edit left `package-lock.json` unchanged, and no tracked or untracked file changed beyond the four intended ones.

Not yet verified: Docker-driven behavior of the new `appPort` — this sandbox has no container engine. Pending: interactive CLI-driven development on the planned Debian host (`devcontainer up` creation, the published port in `docker ps`, browser reachability of `dev:container`, host-editor edits recompiling through the bind mount, `devcontainer exec npm run verify`); a hosted GitHub Actions run on both architectures with `appPort` present; and interactive VS Code reopen/forwarding with the extended configuration.
