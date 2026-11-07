# Verification — November 7, 2026

Verified on Windows using Node.js 24.22.1, Next.js 16.4.5, and the installed lockfile.

- **33 automated tests passed:** financial/identity invariants, completed-session absence rules, donor lapse evidence, atomic idempotent import, structured claims, application word limits, grant fiscal boundaries, disclosure policy/hash/revision checks, note privacy, simulated delivery, persisted restart, rollback and reset.
- **32 local HTTP checks passed:** UI-compatible Origin header, rejection of unrelated-origin writes, core CRUD, blocked wrong claims, correct approval/export, application export within its limit, repeat import, note edit invalidation, nonpayable exclusion and reset.
- **Live OpenAI Agents SDK verified:** `gpt-5.4-mini` called the evidence tool, returned a structured report and passed approval; the successful recorded test used 1,013 input and 115 output tokens. Demo mode was verified separately. A prior live output with numbers in its title was blocked; titles are now application-owned so a model cannot create an uneditable invalid title.
- **Browser verified:** donor count changes from five to three with giving unchanged; a wrong participant count is blocked and corrected before approval; grant-ledger exceptions render; application generation/approval works; a counseling preview excludes the planted private detail and receives exact-copy approval.
- **Production build and TypeScript passed.**

The browser walkthrough exposed and fixed an Origin check mismatch between Next's internal URL and the browser's actual Host. The HTTP test now sends the browser-equivalent Origin and checks rejection of a foreign Origin. Review also fixed application exports to contain only the word-counted answer; report provenance remains available in the workspace.

The visible default browser surface was approximately 600 pixels wide and rendered its compact navigation without horizontal overflow. A broader device matrix has not been run.

Limits: external delivery is simulated; no message was sent. Funder documents are exported, not submitted. This verifies fictional local workflows, not production authentication, clinical privacy compliance, or multi-instance persistence. The organizer's actual submission cutoff and rubric remain unverified.
