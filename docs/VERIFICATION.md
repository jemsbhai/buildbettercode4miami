# Verification — November 7, 2026

## Current backend hardening

**The combined backend passed 94 automated tests, the production build including TypeScript, and 74 HTTP checks.** No new browser walkthrough was performed; the historical browser results below apply to the earlier build. Teammates' new frontend controls still need integration and rehearsal.

- **94/94 automated tests passed:** record and financial invariants; grant fiscal dates, as-of spending and upcoming entries; invalid dates/cents, duplicate IDs and overflow rejection; atomic/idempotent expense entry; scoped draft/disclosure approval; exact-content checks; private-text copy protection; no-op note saves and optimistic concurrency; application limits; generation reservations, retries, live-attempt limits across restart, evidence races, retained usage, lease recovery and recorded-run integrity.
- **Production `npm run build` passed**, including TypeScript validation.
- **74 HTTP checks passed** with `scripts/smoke.mjs --live` against an isolated production server on port **3211**, using **`.data/verification-state.json`**. The checks exercised the integrated APIs, including live report, application and follow-up generation. The final test-state reset succeeded; the presenter's **`.data/state.json`** was untouched.
- **Real OpenAI Agents SDK calls passed for all three draft types** using `gpt-5.4-mini`. Each invoked the evidence tool, passed approval and export, and returned verified provider usage:

| Live draft | Input tokens | Output tokens |
| --- | ---: | ---: |
| Report | 1,041 | 118 |
| Application | 1,056 | 147 |
| Follow-up | 999 | 76 |

These results verify the backend and production APIs. The frontend was left to the teammates and was not modified in this backend pass. New expense controls, request-key retry handling, recorded-run inspection, and partial/unknown token labels must be exercised in the UI after integration. See [BACKEND-HANDOFF.md](BACKEND-HANDOFF.md) for contracts and rehearsal steps.

The private-text guard compares the complete private detail after case/whitespace normalization; it does not provide semantic sensitive-content detection. Scoped disclosure tests demonstrate that unrelated edits preserve validity while note, policy or referenced provenance changes invalidate it. Legacy records retain conservative revision checks.

## Prior baseline verification

The previous build was verified on Windows using Node.js 24.22.1, Next.js 16.4.5, and the installed lockfile.

- **33 automated tests passed:** financial/identity invariants, completed-session absence rules, donor lapse evidence, atomic idempotent import, structured claims, application word limits, grant fiscal boundaries, disclosure policy/hash/revision checks, note privacy, simulated delivery, persisted restart, rollback and reset.
- **32 local HTTP checks passed:** UI-compatible Origin header, rejection of unrelated-origin writes, core CRUD, blocked wrong claims, correct approval/export, application export within its limit, repeat import, note edit invalidation, nonpayable exclusion and reset.
- **Live OpenAI Agents SDK verified:** `gpt-5.4-mini` called the evidence tool, returned a structured report and passed approval; the successful recorded test used 1,013 input and 115 output tokens. Demo mode was verified separately. A prior live output with numbers in its title was blocked; titles are now application-owned so a model cannot create an uneditable invalid title.
- **Browser verified:** donor count changes from five to three with giving unchanged; a wrong participant count is blocked and corrected before approval; grant-ledger exceptions render; application generation/approval works; a counseling preview excludes the planted private detail and receives exact-copy approval.
- **Production build and TypeScript passed.**

The browser walkthrough exposed and fixed an Origin check mismatch between Next's internal URL and the browser's actual Host. The HTTP test now sends the browser-equivalent Origin and checks rejection of a foreign Origin. Review also fixed application exports to contain only the word-counted answer; report provenance remains available in the workspace.

The visible default browser surface was approximately 600 pixels wide and rendered its compact navigation without horizontal overflow. A broader device matrix has not been run.

Limits: external delivery is simulated; no message was sent. Funder documents are exported, not submitted. This verifies fictional local workflows, not production authentication, clinical privacy compliance, or multi-instance persistence. The organizer's actual submission cutoff and rubric remain unverified.
