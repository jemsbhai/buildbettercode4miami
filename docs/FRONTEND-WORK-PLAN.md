# Frontend work plan: pages, components and ownership

Agreed with Liam on November 7, 2026; updated November 8 with the partial FE-01 foundation below. This is a work plan, not a claim that every feature has shipped. Four real routes now render read-only summaries; the old tab workspace and its request-performing feature components remain unmounted migration references. The KanbanFlow board is [BBC World Service](https://kanbanflow.com/board/Xm6q3L7).

## Confirmed decisions

- **Liam = teammate A:** inbox/reconciliation and counseling.
- **Robby (Roberto Beltran) = teammate B:** quarterly reports, grant applications and grant spending.
- Four page routes: `/`, `/inbox`, `/grants`, `/counseling`. Quarterly reports belong **inside `/grants`**, alongside applications and the ledger. No separate `/reports` or `/outbox` route is planned.
- Pages own view data loading and asynchronous data operations. Display components consume typed props and callbacks and do not fetch data.
- Component files default-export their component, normally one component per file. A small private helper used only by its parent may remain together when justified; substantial editors/lists should be separate.
- Organize components by the feature they serve. Keep reusable layout and genuinely shared components separate from rendered page entrypoints.
- **FE-03 is Done:** pages supply backend interaction callbacks to components through props. Define feature-specific update states during implementation and consolidate duplication during integration; no further up-front architecture gate is required.
- Reporting pages provide downloadable documents; **no browser-based document editing**. Template-based PDF/DOCX generation is a stretch goal. DOCX re-upload/versioning is a possibility, not a committed feature.
- Reports require a donor or donor unique identifier. Connect that requirement to the existing domain/API when implementing the report flow; do not assume a grant ID is a donor ID or claim the current API already supports this association.
- Telemetry/analytics endpoint shape remains TBD. Development console errors are the minimum diagnostic fallback, without logging private note bodies. A telemetry integration is not a prerequisite for feature work.
- Storybook is a stretch goal. Components must be independently renderable even if Storybook is never installed.

This agreement supersedes the old file ownership/path guidance in TEAMMATE-A, TEAMMATE-B, TEAM-HANDOFF and BUILD-PLAN. Their product acceptance requirements remain relevant. The latest [backend handoff](BACKEND-HANDOFF.md), implemented API routes and shared types take precedence over older simplified request examples.

## Product mapping

| Route | Responsibility | Owner | Challenge coverage |
| --- | --- | --- | --- |
| `/` | Overview, period/as-of context, source-backed metrics and links to actionable work | Liam primary; Robby reviews grants/report summaries | Summarizes 1, 2, 6, 4 without exposing full counseling notes |
| `/inbox` | Incoming records, gift import, duplicate reconciliation, attendance, follow-up queue and response drafts | Liam | 1 + 2 |
| `/grants` | Quarterly reports, checked grant applications, funder-year ledger and recorded drafting history | Robby | 1 reporting + 6 |
| `/counseling` | Explicit note access/editing, exact limited funder preview, approval/export and audit | Liam | 4 |

Inbox/outbox is a useful work classification, not a literal rule about HTTP requests or every action's direction. A follow-up is a response to an inbox item and stays in `/inbox`, including review and its simulated receipt. Counseling remains its own bounded workflow despite producing a funder copy. “Outbox” cards cover reports and grants; they do not promise external sending.

## Proposed directory contract

```text
src/app/
  layout.tsx
  page.tsx                 # dashboard page; owns its view loading
  inbox/page.tsx
  grants/page.tsx
  counseling/page.tsx
  api/[...path]/route.ts    # preserve existing backend contract
src/components/
  layout/                  # navigation, header, shell
  dashboard/               # overview views
  inbox/
    records/
    import/
    duplicates/
    followups/
  grants/
    reports/
    applications/
    ledger/
    runs/
  counseling/
  shared/
    evidence/
    drafts/                # share review/status views only where actually useful
src/lib/                   # existing domain/types/server services
```

This is the target feature structure. The FE-01 foundation creates the route and summary-view directories; deeper feature folders remain future work. Move run views to `shared/runs/` only if both routes actually consume them. Do not create layers just to fill the tree. Keep feature CSS scoped; preserve the existing single root application, npm, pinned dependencies/runtime and devcontainer.

Pages orchestrate data, map authoritative domain values into focused view props and render components. The server continues to own arithmetic, identity rules, field filtering, claim validation and approvals; “page-only data fetching” does not move domain logic into pages. Keep transport helpers separate from display components while implementing page callbacks. Even asynchronous CSV file reads need a page-owned boundary rather than remaining inside a view.

Read the installed Next.js guides during implementation. The page-owned callback pattern must respect the Server/Client Component boundary; wire it where needed without reopening FE-03 or introducing a framework-selection task. Keep view components free of data requests.

Full counseling notes are loaded only after explicit open through the audited operation, never through dashboard loading or speculative link prefetch. Funder previews always render the server's returned payload. Components should be testable with fictional props and callbacks without a running backend or model key.

## Board work items

**Review status:** Liam reported FE-03 completed; the supplied `l_r_taskSnapshot.pdf` (November 7, 7:20 PM Eastern, pages 12–14) shows it in Done and records his review comment. This is decision completion, not evidence that callbacks or downloads are implemented. The snapshot also adds Templated Report Generation (explicitly stretch/fullstack) and Font Family Strategy; this index covers the original FE cards, not every later board addition.

**Superseded card wording:** older descriptions still say FE-03 blocks action wiring and require an in-browser shared document editor. Those requirements are superseded by the review above, especially for FE-07/08 and related FE-05/12 references. This documentation update does not edit the live board. Keep source validation, approval rules and exact exports; exercise invalid-claim/word-limit cases through fixtures or existing API checks rather than making a document editor a frontend prerequisite.

P0 means required for the integrated frontend demo, not a claim that every underlying backend feature is missing. Detailed scope, dependencies and acceptance checks are in the corresponding board descriptions. Existing dashboard card is retained as FE-02 with its two members; Liam is the primary owner.

| ID | Work item | Primary owner | Dependency |
| --- | --- | --- | --- |
| FE-01 | Establish routes, shell and component boundaries | Liam | None; use the completed FE-03 agreement |
| FE-02 | Implement dashboard page `/` (existing card) | Liam; Robby reviews | FE-01 |
| FE-03 | Page-owned backend callbacks; remaining states worked out during development | Robby, with Liam | **Done — reviewed November 7** |
| FE-04 | Import records and review donor duplicates | Liam | FE-01; FE-03 for actions |
| FE-05 | Follow-up queue, reviewed drafts and simulated receipts | Liam | FE-01, FE-03, FE-07 review-view reuse if useful |
| FE-06 | Note editing and exact funder disclosure | Liam | FE-01, FE-03 |
| FE-07 | Quarterly report review and download; no browser document editor | Robby | FE-01; FE-03 satisfied |
| FE-08 | Grant application and complete-answer word limit | Robby | FE-01, FE-03, FE-07 |
| FE-09 | Funder-year ledger and retry-safe expense entry | Robby | FE-01, FE-03 |
| FE-10 | Recorded runs, failures and honest usage labels | Robby | FE-03; integrate with FE-07 |
| FE-11 | Integrate all routes and rehearse acceptance flows | Liam; Robby verifies B flows | FE-01 through FE-10 |
| FE-12 | Add Storybook stories | Robby; Liam supplies A states | Stretch only, after FE-11 |

Next work: Liam proceeds with FE-01 and his inbox/counseling slices; Robby proceeds with reports/grants. FE-03 references in the dependency column are satisfied. Agree only the props needed for the next working interaction, then refine state handling as it is implemented. Consolidate actual duplication during integration on November 8. FE-02 can progress once the shell is stable; FE-11 remains the final rehearsal. Do not reopen the completed planning card to resolve hypothetical future cases.

Liam owns shell/layout/evidence integration for this frontend plan; Robby owns report review/download views and any useful shared draft presentation. Backend/API/shared domain types, package/runtime declarations and global style changes still require coordination with the lead. The fourth teammate's role is not inferred. Assignments here are implementation ownership for this plan, not a claim the original lead has already merged or approved changes.

## Required backend integration details

- Preserve returned dashboards and server errors. Keep draft `revision` distinct from data revision and opaque evidence tokens; do not regenerate server hashes in the browser.
- Use the same draft-generation `Idempotency-Key` and body after an uncertain response. Distinguish still-running conflict, input/key conflict, terminal failure and live-attempt limit. A fresh user attempt uses a new key.
- Approve/export the current server document revision; keep validation and stale-output blocks without requiring a browser document editor. Reports/applications appear under `/grants`; follow-up responses remain inside `/inbox`. Preserve unsaved input where record-entry forms actually exist. Share views only when implementation demonstrates useful overlap.
- Note saves carry `expectedNoteHash` from the loaded note. Unchanged normalized saves preserve approval; relevant evidence changes invalidate copies, unrelated changes should not be treated as globally stale.
- Expenses use positive integer cents and a stable retry ID. Ledger displays separate actual, disallowed, outside-period and upcoming entries using server classifications.
- Recorded runs include failures without drafts. Partial/unknown usage cannot be labeled total usage or zero cost; recorded snapshots do not imply deterministic model regeneration or authentication.

## Done and cut line

For each implemented card: typecheck, relevant actual API interaction, keyboard/narrow-layout checks, and UI evidence. A prop-only fixture is evidence of view behavior, not proof of mutation integration. The final gate is `npm run verify` against disposable state plus a browser rehearsal across all four pages, reset, then repeat. Never use `--live` as the baseline. No runtime checks were run merely to write this plan.

Protect all four brief slices: Rosa preserves gifts/cents; follow-ups have source-backed reasons and explicitly simulated receipts; wrong claims and over-limit applications are blocked (fixture/API checks can demonstrate these without a browser document editor); grant spending respects funder year/categories; the exact counseling copy excludes the private sentinel and blocks nonpayable/stale copies. Approval/export must not be described as actual external delivery. The original Challenge 1 asks for sent follow-ups; the local simulation boundary remains an explicit coverage limitation.

Final submission: **November 8, 2026, 4:45 PM America/New_York**. Liam's updated feature/code freeze target is **around 3:30 PM Eastern**, prioritizing feature delivery and usability. Authentication is deferred. See [second-pass notes](FE-01-SECOND-PASS.md). Cut Storybook, extra polish, additional integrations and a second funder first. Do not resurrect the original suggested plan's optional package stack, exact-replay claim, or proposal to drop application drafting: the revised [build plan](BUILD-PLAN.md) requires the application slice.

## Source trail

- [Original challenge snapshots](sources/overview.md): [1](sources/challenge-1.md), [2](sources/challenge-2.md), [4](sources/challenge-4.md), [6](sources/challenge-6.md).
- [Revised build plan](BUILD-PLAN.md), [teammate A](TEAMMATE-A.md), [teammate B](TEAMMATE-B.md), [backend handoff](BACKEND-HANDOFF.md).
- [Project context](PROJECT-CONTEXT.md) and [development baseline](DEVELOPMENT.md).
- Liam’s supplied KanbanFlow PDF snapshot, `l_r_taskSnapshot.pdf`, November 7 at 7:20 PM Eastern: FE-03 Done and review comment on pages 12–14. Its comment records team decisions; it is not an instruction to build a telemetry endpoint or upload documents.
- Current source inspected: `src/app/page.tsx`, `src/components/*`, `src/app/api/[...path]/route.ts`; installed Next.js guides for Server/Client Components and data fetching.

Application refactoring is delegated by these cards. This planning change does not implement routes, change APIs, install Storybook, or verify teammate completion.

## FE-01 foundation pass — November 8

Branch: `feature/fe-01`. Liam chose a partial scaffold delivery: real dashboard
summary data with prop-driven placeholder views and fictional fixtures, rather
than migrating feature actions in this pass. Storybook remains FE-12. FE-01 is
still open until the full component-boundary and feature-migration acceptance
criteria are met. This section records implementation scope, not live board status.

### Routes and ownership

| Area | Files / boundary | Owner |
| --- | --- | --- |
| Page orchestration | `src/app/{page,inbox/page,grants/page,counseling/page}.tsx`, `src/app/_hooks/use-workspace-data.ts` | Liam; Robby reviews grants interface |
| Shell and navigation | `src/components/layout/` | Liam |
| Overview summaries | `src/components/dashboard/` | Liam; Robby reviews grants/report summaries |
| Inbox summaries and future actions | `src/components/inbox/` | Liam |
| Grants, report/application review and downloads | `src/components/grants/` | Robby |
| Counseling summaries and future audited note actions | `src/components/counseling/` | Liam |
| Resolved evidence and summary presentation | `src/components/shared/` | Liam owns evidence integration; coordinate shared view changes |
| Frontend transport / formatting / summary mapping | `src/lib/client-api.ts`, `src/lib/format.ts`, `src/lib/workspace-summaries.ts` | Liam foundation; coordinate shared changes |
| Backend APIs and domain types | Existing `src/app/api/` and domain modules | Coordinate with backend lead |

Pages invoke a page-layer hook that owns the dashboard request, cancellation,
retry state and evidence resolution. Views accept focused summary cards and
callbacks. The shared drawer receives resolved `SourceRow[]`, not IDs to look up.
No new view imports transport helpers. The new views default-export one component
per file; there are no private component-helper exceptions in this foundation.
The server root layout remains unchanged. Links expose pathname-based active
state and disable speculative route prefetch. Counseling renders whitelisted
summary metadata and never requests a full note.

### Fixtures and remaining migration

Each new feature view has `*.fixtures.ts` exports for populated, empty and
unavailable data. Layout fixtures cover ready, loading and request failure; drawer
fixtures cover resolved rows and no rows. Fixtures contain fictional values and
stub callbacks and are not imported by production pages. Future stories should
render these same components; production pages do not render stories.

The old `src/components/dashboard.tsx`, operations, reports, grants, disclosure
workspaces and legacy evidence drawer remain **unmounted reference source**.
Their fetching, named exports, large private editors and old document editing UI
are not migrated or endorsed by this pass. `src/components/client-api.ts` is a
compatibility facade; actual transport and formatting now live under `src/lib`.
Do not use the legacy request pattern when implementing the new feature views.

The new routes have no mutations, reset control, model drafting, document editor,
approval or download actions. They show real summary data and explicitly label
feature work still to come. Reports and applications belong under `/grants`;
follow-up review/editing belongs under `/inbox`. Subsequent feature cards must
preserve the existing API guarantees and audited note access described above.

### Foundation validation

November 8: `npm run verify` passed in the running **native Linux ARM64
devcontainer**, with Node 24.19.0 / npm 12.0.2: typecheck, **142 tests**,
production build and **65 HTTP checks**, including direct entry to all four
routes. Validation used disposable state with live credentials disabled.

Browser checks against a temporary production server confirmed real summary
loading, sidebar active state, navigation across all four routes, inbox refresh,
back/forward between grants and counseling, resolved giving evidence, and Escape
dismissal of the drawer. All four pages fit a 390px viewport without horizontal
overflow. The final overview had no captured browser errors or warnings. Loading
was observed; empty summary mappings are unit-tested. Request-error/retry and
empty/unavailable fixtures are supplied but were not separately exercised in the
browser. Full notes and mutation controls are absent from this scaffold.

The preview server was stopped after inspection. This pass did not revalidate
x86-64, Windows/WSL2 or hosted CI and does not establish full feature integration.
