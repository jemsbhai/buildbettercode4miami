# Local spreadsheet reconciliation rules

The deterministic engine is `src/lib/reconcile.ts`; its input/output contracts are in `src/lib/reconcile-types.ts`. It scans explicitly selected workbook snapshots together, so duplicate evidence can cross tabs and workbooks. The first row of each included tab must be its header. This is a bounded donation/contact reconciliation product, not a universal spreadsheet repair system.

The companion service and extension own authorization, Google reads, approval, correction-copy creation, retry journals and recovery. The engine itself performs no network requests, reads no credentials and writes no files. It never mutates its supplied snapshots. Existing Next.js app contracts and the frozen Apps Script remain separate.

## Schema and scope

Supported mapped fields are `gift_id`, `donor_id`, `name`, `email`, `phone`, `amount`, `date`, `channel`, `currency` and `quantity`. Common donation/contact header aliases are inferred; duplicate aliases require the user to select a column. A supplied mapping uses zero-based column indexes, cannot map two fields to the same column and cannot select an excluded private column.

An amount column classifies a tab as a gift table. Its default required fields are gift ID, donor ID, amount and date. Contact tables require donor ID and name by default. The API can supply another explicit list of required supported fields. Unknown schemas generate a schema finding and must be mapped before useful validation; an unknown table is not reported as fully validated. Blank public rows are ignored. An unmapped private value alone does not make a row a donation.

Each edited tab must have an explicitly confirmed mapping before a correction plan is accepted. Inferred mappings remain visible suggestions. A changed mapping creates a new scan identifier and requires fresh review.

Each finding carries workbook ID, tab ID/title, one-based row and column, and an A1 cell reference. Fixes include the original typed cell and proposed replacement, plus an explanation. Original formulas are represented separately from effective values. Optional `numberFormat` metadata carries a format type and pattern; safe fixes preserve that metadata.

## Supported findings and changes

| Issue | Detection | Available reviewed action |
| --- | --- | --- |
| Missing required value/header | Mapped required cell is blank, or required field is unmapped | Manual correction; no guessed value |
| Duplicate gift identifier | Same case-sensitive, trimmed gift ID and compatible normalized transaction values across included records | Review all source references; no gift deletion or amount reduction |
| Conflicting gift record | Same gift ID but different donor ID, exact amount/currency, date, channel, or transaction formula | Manual evidence review; involved identities receive no merge proposal |
| Donor identity conflict | One case-sensitive, trimmed donor ID has multiple nonempty normalized names, emails or phone values | Manual review; no proposed identity change |
| Potential duplicate identity | Different donor IDs share normalized email or a phone with at least seven digits | Review candidate; contact equality alone is not identity proof |
| Compatible identity resolution | Connected shared-contact candidates also have the same nonempty normalized name, compatible contacts, and no conflicting records | Explicitly approve donor-ID substitutions in correction copies; canonical ID is the lexicographically first existing ID |
| Whitespace | Surrounding whitespace in mapped name, email, phone or channel text | Trim surrounding whitespace only |
| Money formatting | Valid positive money with supported currency and exact precision | Normalize text formatting without changing exact cents or currency |
| Invalid amount | Malformed separators, excess precision, negative/refund, zero, incompatible symbol/code, unsafe numeric magnitude, or invalid currency | Manual correction; amount is excluded from valid totals and counted as invalid |
| Date formatting | Valid unambiguous supported calendar date | Normalize text to `YYYY-MM-DD` |
| Ambiguous date | Distinct day/month numbers both at most 12 without explicit date order | Select MDY or DMY for that tab and rescan |
| Native Google date | Integral numeric serial with explicit `DATE` format metadata and resulting day in 1900–2200 | Validate and preserve the original number and format; no text conversion |
| Invalid date | Impossible date, unsupported text, timestamp, unformatted/fractional numeric serial, `DATE_TIME`, or year outside 1900–2200 | Manual correction |
| Currency formatting | Supported code with different case/whitespace | Canonical uppercase currency code |
| Invalid currency | Unsupported or missing code when a currency column is mapped | Manual correction; no exchange-rate conversion |
| Quantity formatting | Exact US-style decimal with at most six fractional digits | Normalize textual grouping/leading zeros without changing value |
| Invalid quantity | Unsupported separators, exponent, boolean, excessive precision, unsafe numeric magnitude | Manual correction |
| Formula-backed field | Any mapped cell contains a formula | Preserve formula and report for review; no formula patch |

Name-only similarity never proposes an identity merge. Email matching is case-insensitive candidate evidence; phone matching removes punctuation but does not infer country codes. The engine does not claim these normalizations establish identity. Different contacts or names, including legitimate aliases that need human judgment, remain manual.

Identity fixes carry a `groupId` for each original alias → canonical ID decision. Every occurrence of that alias in the selected scope must be selected together. A partial decision is rejected, and a formula-backed alias ID blocks its connected candidate's proposals. All changed tabs still need confirmed mappings. Every gift row is retained. Other workbooks outside the selected scope are neither inspected nor changed, so a decision is not a global identity assertion.

Stable gift and donor identifiers are compared case-sensitively after surrounding whitespace is trimmed for matching. The engine does not lowercase or otherwise silently rewrite stable IDs. Original values remain in snapshots and fix provenance.

## Exact arithmetic and dates

Money is parsed as decimal text into `bigint` integer cents. Summation never uses floating-point addition. Totals are decimal strings grouped by currency, with separate gift count, valid amount count and invalid amount count. Duplicate gifts remain counted until a person reconciles the source evidence; the scan total is a total of included valid rows, not deduplicated financial truth.

Supported currency codes are USD, EUR, GBP, CAD and AUD. The default is USD unless a tab setting or mapped currency column supplies another supported code. `$` is accepted only with USD/CAD/AUD, `€` only with EUR, and `£` only with GBP. Dollar signs do not infer a country. Default amount unit is major units (`dollars` in the contract); an `amount_cents` header infers cents, or the user selects cents explicitly. Cents inputs must be integers. Major-unit inputs support at most two fractional digits. No refunds, zero-value gifts, currency conversion or decimal-comma parsing is performed.

US-style thousands grouping is accepted only when structurally valid. For example `1,234.50` is valid and `1,23` is not. Text amounts can exceed JavaScript's safe-integer range because parsing and totals use `bigint`; numeric values whose implied cents exceed the safe range are rejected. Text with more than 30 digits is rejected. Scientific notation is unsupported.

Date parsing accepts year-first forms such as `2026-09-01` and `2026/9/1`, or year-last day/month forms with a four-digit year. An impossible month can disambiguate `31/12/2026`; `03/04/2026` requires a declared date order. Leap years and actual month lengths are checked.

Native Google numeric dates are accepted only with explicit `numberFormat.type: "DATE"`, an integral serial, and a resulting calendar day from 1900 through 2200. Conversion for validation uses integer days from the UTC epoch `1899-12-30`; this arithmetic does not reinterpret a workbook timezone. A native date is never replaced with text. Its original numeric value and format remain in the correction copy. For example, serial `46266` and text `2026-09-01` represent the same date for duplicate comparison. Unformatted numbers, fractional serials and `DATE_TIME` values remain manual. The engine does not infer timezone, parse arbitrary natural language or rewrite formula dates.

## Privacy and untrusted data

Private/counseling/clinical/therapy/case-note/medical/credential labels cause tabs or columns to be excluded. Adapter-supplied exclusions are also honored. General scan reports never include excluded cell values, and excluded columns cannot be mapped back into this workflow. Private data belongs in the existing separately authorized bounded disclosure workflow.

Label detection is deliberately conservative and may exclude innocuous labels. It cannot reliably recognize unlabeled sensitive data; users must review the selected scope. Ordinary mapped public fields can themselves contain personal information. No cell content is interpreted as an instruction. Formula text is preserved as data and is never executed by the engine.

These engine rules alone do not authorize AI disclosure. Optional AI must use the companion's separate enablement, credential, payload-preview and approval boundary. Never send raw workbook snapshots to a provider merely because a deterministic scan completed.

## Plan integrity and invariants

Snapshots include versions and cells in a canonical SHA-256 digest. A scan identifier binds the snapshot, options, findings, mappings and totals. The engine rebuilds the deterministic scan when constructing a plan; it rejects changed snapshots, mappings, unknown finding IDs, manual-only findings and duplicate selections.

Plans are restricted to correction-copy mode and include exact patches, approved finding IDs, changed workbook IDs and original totals. Application verifies the plan digest, re-derives all approved proposals, checks complete identity groups and confirmed mappings, verifies exact original cells, and rejects every formula edit. The generated copy is rescanned; gift count, valid/invalid amount counts and every currency's exact cents must remain unchanged. This validates a local correction result; the Google transport must independently recheck remote source versions and verify its written copies.

An already applied plan cannot be applied to the changed snapshot again. Reapplying the same plan to its original unchanged snapshot deterministically produces the same corrected snapshot. Persistent operation idempotency and interrupted-write recovery belong to the companion service; a deterministic engine hash is not itself a network transaction or an approval signature.

## Limits and verification

The engine rejects scopes exceeding 30 workbooks, 200 tabs, 200,000 cells, 20,000 body rows, 1,000 columns per row or 10,000 findings. Text/formula cells longer than 50,000 characters are rejected. The Google adapter and HTTP service impose additional, sometimes smaller, limits. No oversized scan silently returns a truncated success.

Not supported: fuzzy name resolution, arbitrary schemas without mapping, hidden business rules, cross-sheet formula repair, spreadsheet layout/styles/charts/protection reconciliation beyond preserved number-format metadata, locale inference, currency conversion, tax/refund accounting, timestamp or unformatted date serial interpretation, automatic gift deletion, or authoritative identity matching across unselected files. Privacy exclusions and formula references can also make a tab unsuitable for a correction copy; the transport's validation remains authoritative.

On November 8, 2026, the dedicated engine suite passed **29 tests** on native Windows x64 with Node **24.19.0**; the repository TypeScript check also passed. Tests cover multi-workbook provenance, privacy, untrusted text, formulas, exact money, currency conflicts, dates (including native Google date serials and preserved format metadata), schema mapping, case-sensitive IDs, connected identity candidates, cross-tab coherent approval, stale/tampered plans and limits. Tests use deterministic fixtures and no network/provider calls. This evidence is not real Chrome loading, Google OAuth, live Google write-back or hosted CI verification.
