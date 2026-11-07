# Tidepath

**Less admin. More human.** One nonprofit workspace for records, timely follow-ups, grounded grant work, and counseling copies that disclose only approved fields.

Built for the [DevDay Exchange Miami nonprofit challenges](https://docs.google.com/document/d/1dTh6wVOAtDjGyCIVv28Pm94Yfz8Z4kGo8DFhRNDpgsw/edit), covering a bounded slice of **1 + 2 + 6 + 4**. All people, gifts, funders, and sessions in this app are fictional.

## Run locally

Requires **Node.js 22+** (24 recommended) and npm. The current OpenAI Agents SDK requires Node 22 even though Next.js itself accepts older versions.

```sh
npm ci
npm run dev
```

Open the local URL printed by Next.js. On this Windows workstation, the existing system Node is older; `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1` uses a compatible installed or Codex-bundled Node without modifying the system installation.

The demo starts with a deterministic fictional Q3 2026 dataset. The **Reset demo** control restores the same scenario. State is saved in `.data/state.json` and survives a server restart.

Demo drafting needs no credentials. For real model drafting, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` there or in the server environment, then choose **Live · OpenAI agent** in the workspace. The default is `gpt-5.4-mini`; `OPENAI_MODEL` can override it. Keys remain on the server. No real email, SMS, or funder submission is performed.

## What works

| Challenge | Working vertical slice |
| --- | --- |
| 1 — Programs | Thirteen weeks of signups, attendance, mentor assignments and volunteer hours; attendance capture/upsert; evidence-backed absence queue; drafted, reviewed follow-ups; simulated delivery receipts; source-derived quarterly report |
| 2 — Donors | Four gift channels; normalized CSV import with idempotency; Rosa's three identities proposed for approval; original gifts preserved; monthly lapse with explicit expired-card evidence and historical annual lapse |
| 6 — Grants | One funder's application question and word limit; editable, verified numeric claims; approval of the exact answer and fact sheet; July–June category ledger with overspending, near-limit, disallowed-category and fiscal-boundary examples |
| 4 — Counseling | Twenty-five sessions across a week; write/edit the internal note once; deterministic required-field copy; exact counselor preview and approval; nonpayable exclusion; metadata-only access log; private note bodies excluded from the general dashboard and agent context |

The initial quarter has **4 participants, 5 quarter donor identities, $635 in gifts, 50 attended sessions and 65 volunteer hours**. Approving Rosa changes the donor count to **3** and leaves $635 and every gift intact. The annual alert is explicitly a retrospective discovery of a missed December 2025 gift, using earlier history; it is not advertised as a timely first alert.

The grant example uses a **120-word answer limit**, counting narrative and rendered fact lines. It has a $500 personnel overrun, materials at 90% of budget, and a disallowed $45 expense. Fiscal-year evidence distinguishes June 30 from July 1.

## Collaborate

- [Build plan and acceptance gates](docs/BUILD-PLAN.md)
- [Teammate A: operations and counseling](docs/TEAMMATE-A.md)
- [Teammate B: reports and grants](docs/TEAMMATE-B.md)
- [Demo script](docs/DEMO.md)
- [Decisions and boundaries](docs/DECISIONS.md)

The frontend is a functioning base to extend. A owns `operations-workspace.tsx` and `disclosure-workspace.tsx`; B owns `report-workspace.tsx` and `grants-workspace.tsx`. The lead owns shared types, API routes, data logic, common shell and global styling. Coordinate shared-file edits.

## Architecture

One Next.js + TypeScript application; shared request/response types live in `src/lib/types.ts`.

- `seed.ts` / `programs.ts`: deterministic fictional data and row-level source references.
- `domain.ts`: exact-cent gift records, contact-based merge candidates, attendance/late-gift rules and metric validation.
- `agent.ts`: a bounded OpenAI Agents SDK run with a read-only evidence tool and structured draft output. It cannot approve, send, merge, or read counseling bodies.
- `service.ts`: revision-aware editing/approval, approved export and idempotent simulated delivery.
- `programs.ts`: funder-year ledgers, application limits, note access, allowlisted disclosure and payload-bound approvals.
- `store.ts`: atomic file replacement, with synchronous transactions inside one Node process.
- `src/app/api/[...path]/route.ts`: validated endpoints used by every workspace.

Live runs have a maximum of three turns, 1,600 output tokens per model turn and a 45-second timeout, with one generation in flight and twelve live attempts per reset session. These are request limits, not a hard dollar budget. The app records events and returned token usage; a failed request may still incur provider usage that is not available in the failed-run record. Hosted tracing is disabled; the local timeline exposes tool evidence and results. Inspecting a recorded run is not stochastic model regeneration.

Numeric facts are structured metric references and checked on the server. Unbound numbers in narrative are conservatively blocked. This is **not a general truth detector**: staff still review qualitative prose. Approval is invalidated by edits or a changed data revision. Counseling filtering is deterministic and does not ask a model to decide what to disclose.

## Import format

Use the file/CSV import control with [the sample](public/samples/gifts.csv). Headers are:

```csv
gift_id,donor_id,name,email,phone,amount_cents,date,channel
```

Amounts must be positive integer cents; dates must be ISO `YYYY-MM-DD`; channels are `online`, `tickets`, `auction`, or `check`. Exact transaction repeats are skipped. Conflicting IDs reject the entire import. This first slice accepts a normalized gift CSV; live donation-tool integrations and arbitrary spreadsheet column mapping are future work. Operations records begin seeded, and attendance can be entered or corrected in the app.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

With a local server on port 3210:

```sh
node scripts/smoke.mjs
node scripts/smoke.mjs --live
```

Set `TIDEPATH_URL` for a different local port. The smoke script **resets local demo state** at the beginning and end. `--live` makes a real, bounded API call using the configured key. The checks exercise source calculations, approval bypass attempts, word limits, disclosure leaks, replayed imports, simulated delivery, and stale records. Use only fictional data.

## Demo boundaries and submission

This is a local, single-operator hackathon app. It has no authentication, independent reviewer identity, multi-instance database or clinical security boundary. The counselor role in audit entries is a demo actor. Do not use it for real counseling records; a pilot needs authenticated roles, a transactional store, access controls, and a reviewed retention/deployment design. Approved funder copies are exported, not submitted. The follow-up outbox visibly simulates delivery and does not prove deliverability to a real recipient.

The [organizer page](https://luma.com/codexmiami) lists Codex, OpenAI API and OpenAI Agents SDK. It lists the event ending Sunday, November 8, at 9 PM Eastern; the actual submission cutoff and judging rubric still need confirmation. The challenge overview requires a public GitHub repository with MIT or Apache 2.0 licensing by submission. This folder is a local Git repository with an MIT license; public publication and submission remain separate steps.
