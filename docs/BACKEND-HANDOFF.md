# Backend handoff for the frontend team

**Frontend organization update, November 7:** the [frontend work plan](FRONTEND-WORK-PLAN.md) replaces the old component ownership and parent-callback organization referenced below. Liam owns inbox/counseling, Robby owns reports/grants, pages own view loading, and view components consume props. FE-03 is Done: pages pass backend callbacks as props and feature state handling is refined during implementation. Browser document editing is out of scope; older frontend editor walkthroughs below are superseded, while backend validation checks remain applicable. The API contracts and integration checks in this handoff remain applicable.

Keep building in the existing Next.js + TypeScript app. The backend adds capabilities to the current contracts; existing note, draft, disclosure and dashboard requests still work. Shared types in `src/lib/types.ts` remain authoritative. Continue using the parent refresh callbacks and the server-returned dashboard.

**Verification status:** 94 automated tests, the production build including TypeScript, and 74 HTTP checks passed. Real report, application and follow-up calls passed using `gpt-5.4-mini`. No new browser walkthrough was performed; teammates' new frontend controls still need integration and rehearsal. See [VERIFICATION.md](VERIFICATION.md) for current evidence and the historical browser baseline.

After pulling this backend update, start a fresh fictional rehearsal with **Reset demo**. Legacy approved drafts do not automatically acquire the new exact-content approval digest. Validation used a separate state file and left the presenter's `.data/state.json` untouched.

## Teammate A: operations and counseling

Own the existing operations and disclosure components. Prioritize useful server error messages, clear reviewed/approved states, and the note → exact funder preview → approval → export flow.

- Full notes returned by `GET /api/notes/:id` and successful note saves now include an optional `contentHash`. Keep this token with the loaded editor state. Include it as `expectedNoteHash` on `PATCH /api/notes/:id` to reject a save if someone has changed that note since it was opened. Existing callers may omit it.
- On a conflict, preserve unsaved editor text and offer reload/review; do not automatically overwrite a newer note. The save body still requires `goal`, `progress`, `privateDetail` and `durationMinutes`.
- Saving unchanged normalized text and duration is a no-op. It does not invalidate an approved disclosure or create extra source/audit records.
- Render the returned `disclosure.payload`; never assemble a funder copy from the internal note. Preview creation blocks nonpayable sessions, wrong funders, future/out-of-year sessions, unsafe policy fields and invalid required values.
- A narrow copy guard also blocks the complete `privateDetail` text pasted into a permitted field, ignoring case and whitespace differences. It does not detect paraphrases or every sensitive passage. Counselor review remains necessary.
- Approving the same current `payloadHash` again is safe and returns the existing approval. Changed note or disclosure evidence still blocks approval/export and requires a fresh preview.
- Show failures from the API without copying internal note bodies into toasts, debugging logs or draft-generation requests. Dashboard notes remain summaries; note reads and funder-copy actions are audited with metadata.

## Teammate B: reports and grants

Own the existing report and grant components. Prioritize the wrong-claim block/correction, the full-answer application limit, and an understandable ledger with one usable add-expense action.

| Request | Body | Successful response |
| --- | --- | --- |
| `POST /api/grants/:id/expenses` | `{ id, date, category, amountCents, description }` | `{ expense, inserted, dashboard }` |
| `GET /api/grants/:id/ledger` | — | `{ ledger }` |

These additive routes passed the integrated HTTP checks. Exercise the corresponding frontend controls after wiring them.

Use a stable expense `id` for each submission and reuse it when retrying after a network failure. A matching retry returns `inserted: false` without duplicating spending or evidence. Reusing an ID with changed details is rejected; a genuinely new expense needs a new ID. IDs allow 1–120 letters, digits, dots, underscores, colons or hyphens and must start with a letter or digit.

Use an ISO `YYYY-MM-DD` date and positive integer `amountCents`. Convert the user's currency input carefully; never send floating-point dollars as cents. Category is required and the API allows at most 100 characters; matching ignores input case and surrounding spaces. An unknown category is accepted and visibly classified as disallowed when it counts as actual spending. Description is required, with a maximum of 1,000 characters.

Render `dashboard.ledgers` without recalculating totals:

- `asOf`: the date through which actual spending is counted.
- `categories`: budget, spent, remaining and server-calculated warning status. Money remains integer cents until display formatting.
- `disallowed`: expenses through `asOf` inside the funder year whose category is not permitted.
- `outsidePeriod`: expenses outside the funder's inclusive fiscal dates.
- `upcoming`: expenses inside the funder year but after `asOf`; these do not reduce remaining budget or count as spent yet. Treat the optional field as `[]` for compatibility.

Quick demo data: the seeded transport budget is $1,000, with $350 spent. A new 60,000-cent transport entry dated `2026-09-30` moves it to $950 spent and `near_limit`. A second, distinct 10,000-cent entry moves it to $1,050 and `over_budget`. Reset returns to the original fixture. Future-dated entries demonstrate `upcoming` instead.

## Draft requests, retries and recorded runs

Both teammates use `POST /api/drafts` with the existing request body. Add an `Idempotency-Key` header, preferably a UUID generated once when a user starts a draft. Keep that same key and body for double clicks or a network retry. A successful response is `{ draft, dashboard, replayed }`; `replayed: true` means the server returned its saved result without preparing another draft or calling the model again. The header is optional for older clients. Keys allow 1–128 letters, digits, dots, underscores, colons or hyphens.

| Outcome | Frontend behavior |
| --- | --- |
| Successful result | Display the returned draft and refresh from its dashboard. Clear the pending request key. |
| Network interruption, outcome unknown | Preserve the key and retry the same request; do not start a duplicate operation. |
| `409`, request still running | Keep the pending state and key; show the server message and allow a later retry. |
| `409`, key belongs to different input | Correct the client request/key pairing. A new user action with different input needs a new key. |
| Terminal failed or expired request | Show the saved error. An explicit new attempt uses a new key; repeating the failed key does not call the model again. |
| `429`, live attempt limit reached | Offer the visibly labeled deterministic demo mode. |

One generation runs at a time. Reservations and the **twelve live attempts per reset session** persist across server restarts; failed attempts count, while completed-key replays and invalid targets do not consume another attempt. Reset is blocked while a reservation is active. Each reservation has a **90-second lease**; the next generation request records an expired reservation as interrupted so a new request can proceed. Unknown provider usage stays labeled unknown.

Each live attempt allows **up to three initial model turns and one optional repair turn**, with 1,600 output tokens per turn under a **shared 45-second deadline**. The repair uses the same reviewed evidence and preserves rejected output and validation issues in the run. Transport retries are disabled. These bounds are not an exact spending cap.

Teammate B should add recorded-run inspection with `GET /api/runs/:id/replay`. It returns `{ run, replay: "recorded", integrity: { input, output }, draftId, evidenceCurrent }`. `input` and `output` are `"verified"` when their stored snapshots match the saved hashes, otherwise `"unavailable"` when no corresponding hash was recorded, including legacy or interrupted runs; a digest mismatch returns `409`. This is a local content-integrity check, not authentication or model reexecution. `draftId` and `evidenceCurrent` may be `null` for a failed run without a saved draft. Show failed runs from `dashboard.state.runs` as well as runs linked to a successful draft.

**Required run-label update for B:** the current report component shows `inputTokens + outputTokens` as an unconditional total and `maxTurns` as the entire turn limit. When `run.usageKnown === false`, show a nonzero count as **“Reported tokens: N · partial; total unknown”**, or zero as **“Token usage unknown”**. Do not present that value as complete usage or a zero-cost run. `usageKnown: true` supports a complete reported-token label; an absent legacy flag should be labeled **“Recorded tokens: N · completeness unavailable.”** Describe the live limit as three initial turns plus one optional repair instead of treating `maxTurns` as the combined limit. Deterministic demo runs make no model request.

## Approval freshness and compatibility

Approval is bound to the exact content and relevant evidence. Relevant note, policy, provenance or draft dependencies changing makes the output stale. An unrelated donor change no longer invalidates a counseling copy; an unrelated note edit no longer invalidates a report.

New `sourceFingerprint`/`evidenceHash` fields are opaque server tokens. Do not calculate or modify them in the client. The dashboard preserves existing clients' `dataRevision === state.revision` freshness check by presenting the current revision only after the scoped evidence is verified. `originDataRevision` retains the original snapshot revision. Stored snapshots are unchanged by that presentation. Legacy records without scoped fingerprints retain conservative global revision checks.

Draft editor `revision` is still the optimistic concurrency token used by save/approve/send requests. Keep it separate from `dataRevision`. A response error must never mark a draft approved. Existing generation, editing, approval and export routes remain in place; applications still count narrative plus rendered fact lines against the funder's word limit.

## Integration checklist

- A: open/save a note unchanged, then verify its approved copy still exports; edit another note and verify the first remains current; edit the first and verify its old copy is rejected.
- A: paste the complete private detail into progress and verify preview is blocked, then restore the shared field and create a fresh preview. Confirm the internal text never enters the funder copy.
- B: add a valid expense, retry with the same ID, and verify only one entry exists; show a future entry separately from actual spending.
- B: wrong figure → blocked approval → correction → approval → export; include the full application answer in the word-count display.
- B: inspect a failed run without a draft, label partial/unknown usage, and view recorded snapshots without making another live call.
- Both: retry draft generation with the same key after an uncertain response; preserve running/error states and avoid accidental extra live attempts.
- Both: retain the API's error messages, label fictional data and simulated delivery, and rehearse against the integrated build. Backend tests do not establish that a new frontend control is wired correctly.
