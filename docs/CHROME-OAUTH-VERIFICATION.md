# Tidepath Chrome OAuth verification packet

Prepared November 8, 2026 for Google Cloud project **`tidepath-local-extension`**. Publisher/support: **Muntaser Syed · jemsbhai@gmail.com**. This packet describes the Chrome extension and local companion, not the separate Google Workspace add-on or hosted Tidepath application.

## Current evidence and submission order

| Item | Recorded status |
| --- | --- |
| Chrome Web Store item | `bdojcligphldnmdchmlhgibhlldgflcd`; user confirmed configured version **0.1.1** uploaded. Upload is not approval/publication. |
| Original unpacked client | Real Google acceptance previously passed. Preserve its client, directory, ID, journal and active demo. |
| New store client | Created and associated with the store ID. Owner-supplied public SPKI key independently derives that ID; `out/tidepath-extension-store-test` contains separate 0.1.1 assets with `manifest.key`. Chrome loading and actual consent/read/copy acceptance remain **not yet proven**. |
| Homepage/privacy/terms | All three public URLs returned **HTTP 200** with correct titles after the separate website deployment; exact URLs saved in Google branding. |
| Branding/audience | Audience changed from Testing to **In production**. Verify branding succeeded and Publish branding completed; Google confirmed branding is verified and shown to users. |
| Data-access form | **Not verified.** Sensitive justification (710 characters), restricted justification (776 characters) and Drive productivity category entered, but **unsaved**. Required YouTube link blank; **Save disabled**. No data-access submission. |
| Recording | Owner-recorded, actual Google flow for **both clients** is still needed. No suitable completed verification video is claimed. |
| Costs | Billing stays disabled; AI stays off. No assessment waiver, free assessment or completed assessment is claimed. |

Google's [restricted-scope guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), updated October 30, 2026, requires verified and **published** branding before data-access submission. That branding prerequisite is now complete. In the observed Verification Center form, a YouTube link is still required before the entered justifications/category can be saved. Changing audience and publishing branding do not complete data-access review.

These exact URLs were checked live without login and saved in branding:

- Homepage: [tidepath.muntasersyed.com/extension](https://tidepath.muntasersyed.com/extension)
- Privacy: [tidepath.muntasersyed.com/extension/privacy](https://tidepath.muntasersyed.com/extension/privacy)
- Terms: [tidepath.muntasersyed.com/extension/terms](https://tidepath.muntasersyed.com/extension/terms)

Private proof of branding publication and audience state is retained in `.data/chrome-release/branding-verified-published.jpg` and `.data/chrome-release/oauth-production-audience.jpg`. Do not include those screenshots or session details in the public source package. Source release commit `dddcb624af9bfb6e1846b427cf1c55db8e0eeaa2` predates these cloud observations. The current update records evidence only and makes no runtime or cloud changes.

Keep the account-wide Apps Script integration and the unrelated public add-on's Cloud project outside this request. The current task does not require changing either.

## Clients that the recording must cover

These OAuth client IDs are public application identifiers, not passwords or client secrets. Never include tokens, private spreadsheet IDs or API keys in this document or a public video.

| Client | OAuth client ID | Chrome extension ID | Evidence needed |
| --- | --- | --- | --- |
| Original local demonstration | `618661169886-r7qlhpf8glc17eb8sehrrmll2opi9eos.apps.googleusercontent.com` | `fhgofdchfkpnlffnjcgpajokmggbcilo` | Record this client's real consent and scope usage, even though its prior local acceptance passed. |
| Configured store release | `618661169886-1mmgps3ga59bie7l0qpl728mlmc3j26u.apps.googleusercontent.com` | `bdojcligphldnmdchmlhgibhlldgflcd` | First verify the installed identity, then record actual consent and scope usage with the new client. |

The original client remains in this project to preserve the working demo. **Do not delete it to simplify the review.** The recording must account for both retained clients. Google recommends separating development and production projects; if reviewers require that change, plan it separately with the owner rather than moving or deleting an active demo client during preparation.

## Form text — each block is under 1,000 characters

### App purpose and features

```text
Tidepath is a Chrome extension for reviewing the quality of Google Sheets selected by the user. A companion on the user's computer discovers spreadsheet metadata, reads eligible selected tables, checks mappings, donor/gift identifiers, dates and exact amounts, and presents cell-specific findings. Only after explicit approval does it create and read back separate correction workbooks. Originals are never edited. Saved local history supports recovery. Optional, separately consented AI advice explains aggregate findings and cannot approve or apply changes. The product is a user-facing spreadsheet productivity/data-quality tool, not a general automation platform or a hosted data broker.
```

The current form's **Drive productivity** category was selected to describe this spreadsheet review use, but it remains unsaved while the required video link is blank. Do not claim email access, background account surveillance or general-purpose automation. The six text blocks in this packet are prepared copy; only the two scope justifications identified in the status table were entered in the observed form, and neither has been saved or submitted.

### Restricted scope: `https://www.googleapis.com/auth/drive.metadata.readonly`

```text
After the user chooses Find accessible spreadsheets, Drive files.list returns names, IDs and modified times of accessible Sheets so the user can select a scan scope. Drive files.get reads source versions before/after reads and copying to reject stale approvals. Drive about returns a permission identifier, hashed locally to bind the journal to the connected account. No arbitrary file contents are read through this scope. drive.file alone cannot discover the existing accessible workbooks in this implemented workflow: they have not been individually authorized through a Picker flow. A Picker-based redesign is possible but is not implemented. We request metadata read-only rather than full Drive read or write access. Discovery does not automatically select or scan files.
```

### Sensitive scope: `https://www.googleapis.com/auth/spreadsheets.readonly`

```text
After the user explicitly selects workbooks and confirms the scope, the local companion reads their tab metadata, eligible cell values, formulas and number formats to produce traceable data-quality findings and exact proposed corrections. Known private workbook/tab labels and sensitive column labels are excluded; users must exclude other confidential data before scanning. The source reader has no source-write operation. Read-only Sheets access is narrower than the spreadsheets write scope. drive.file alone would not read arbitrary existing sources without a different per-file selection/authorization workflow, which this version does not implement. Multiple-workbook scanning requires a separate opt-in.
```

### Non-sensitive scope: `https://www.googleapis.com/auth/drive.file`

```text
After mapping confirmation, exact-plan review and explicit approval, the companion creates new correction workbooks, writes eligible reviewed values to those newly created IDs, and reads them back for verification. It never overwrites the source workbooks, changes their sharing or deletes Google files. The adapter tracks app-created IDs and rejects writes to other IDs. A read-only scope cannot create these approved outputs; full Drive write or full spreadsheets write access is unnecessary. Corrections are separate data workbooks, not full-fidelity clones. Formula-bearing sources are blocked from automatic copy creation.
```

Scope classifications follow Google's [Drive scope reference](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [Sheets scope reference](https://developers.google.com/workspace/sheets/api/scopes). Do not remove a scope only to avoid review while leaving the implementation dependent on it.

### Data flow and optional AI disclosure

```text
Chrome identity obtains the user's Google access token and passes it to the paired loopback companion. Google tokens and optional OpenAI keys remain in process memory/Chrome's identity cache, not the journal. Selected eligible snapshots, findings, plans, an account fingerprint and operation history persist in a user-controlled local JSON journal. Approved correction data goes to Google. Optional advice can send issue counts, standard mapped-field names, table kinds and mapping-confirmation flags directly to OpenAI using the user's key after an exact preview and per-request consent. This is derived Google data. No raw cells, contact values, workbook/tab names, IDs or source URLs enter that request. It uses store:false, without claiming zero provider retention. AI is off throughout the verification recording; the local preview demonstrates the potential transfer without making a provider call.
```

### Security-assessment clarification

```text
Please assess this exact architecture: a user-run loopback companion, local unencrypted JSON journal, HTTPS Google APIs, and optional user-approved transmission of derived scan counts/categories to OpenAI. The publisher does not operate a spreadsheet-processing server or inference proxy. The loopback connection uses HTTP with a random bearer token and exact extension identity; do not infer TLS encryption for that local link. Optional AI is a third-party API capability even when unused in the recording. We are not claiming an assessment exemption based on local processing, aggregate payloads or AI being off. Please identify the applicable verification/assessment requirements for this data flow. No security assessment or waiver has been completed.
```

Google's [assessment guidance](https://support.google.com/cloud/answer/13465431) places assessment after the other review requirements and says its review team will direct the next step. Record any actual requirement and cost before arranging a paid assessment; billing or paid services are not authorized by this packet.

## Prepare the store-ID test without disrupting the demo

The public-key preparation below is complete; actual Chrome loading and live acceptance are still future owner-operated steps. **Do not restart the current companion now.**

1. **Completed preparation:** the owner's store public key was validated as SPKI and independently derived ID `bdojcligphldnmdchmlhgibhlldgflcd`. A separate ignored folder, `out/tidepath-extension-store-test`, contains the uploaded 0.1.1 assets, store OAuth client ID and public `key` manifest field. The original demo folder and uploaded ZIP are unchanged. This is a public key, not a private signing key. Chrome's [OAuth setup guide](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) explains aligning a development installation's ID to the store item.
2. The owner manually loads that separate test folder and verifies the actual ID is `bdojcligphldnmdchmlhgibhlldgflcd`. A matching OAuth client string alone does not prove Chrome assigned the right ID. Do not overwrite `out/tidepath-extension` or assume that its existing local ID changed.
3. **Only after the live demo has safely ended**, stop its companion with Ctrl+C and wait for **Stopped cleanly**. Confirm no accepted operation is still in progress. Keep its journal and Google sources intact.
4. Launch the companion for the store ID using a separate journal, without an AI key:

   ```sh
   npm run sheets:local -- --extension-id bdojcligphldnmdchmlhgibhlldgflcd --data-file .data/local-sheets/store-google-review.json
   ```

5. Pair the newly generated token off-camera, connect an eligible test account and test only new disposable fictional Google workbooks. This recording's file IDs, exports and journal remain private. Successful original-client acceptance cannot substitute for this new-client test.
6. When recording the original client, also use a separate review journal and its exact extension ID. The companion's port is fixed at 4318, so run the two real-client sessions sequentially. Do not point the new store session at the original demo journal.

## Owner recording checklist

The owner must record the actual Chrome extension and Google consent flow: automation access to Chrome's internal and extension pages is blocked. A generic hackathon website video, the mock browser harness, or footage from the separate Apps Script add-on is insufficient.

Google's [video requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#how_to_submit_your_app_for_brand_verification) call for English consent, the app name, the OAuth client ID visible in the consent address bar, demonstrated scope usage and coverage of every client. Submit an accessible **Unlisted YouTube** link. If Chrome's consent surface does not expose the required address bar, capture the actual behavior and ask the reviewer for acceptable supplemental evidence; do not fabricate a URL or substitute a console screenshot as proof of consent.

Record two clearly labeled chapters, one for each client in the table:

1. Show the installed extension's ID/version and explain that a local companion is required. Hide pairing tokens and terminal secrets. Use only fictional Google records in a dedicated review workbook.
2. Show **Connect Google account** initiating the real English consent flow. Capture the app identity, client identity and requested permissions. If prior grants suppress consent, arrange a fresh eligible test account or an owner-approved grant reset after the demo; do not revoke the active demo account's grant incidentally.
3. Demonstrate **Find accessible spreadsheets**, then select only the disposable review workbook. Explain metadata discovery and that no workbook is selected automatically. Keep unrelated real workbook names out of the recording.
4. Confirm the scope, scan and show source-linked findings. Confirm column mappings and inspect an exact before/after plan. This demonstrates actual selected Sheets reads; a fixture banner must not be presented as real Google access.
5. Explicitly approve creation of a correction workbook. Show the resulting real Google copy, its verified status and the unchanged source. Demonstrate recovery/history with the same operation identity; do not create fresh copies merely to imply retry safety.
6. Show the local **AI preview** with no key and zero attempts. Explain that optional advice could transfer these derived counts/categories to OpenAI only after a separately supplied key and consent. **Do not enable AI or send a request.**
7. Show the public privacy policy and explain the local journal, retention until user deletion, unencrypted local storage and separate Google copies. Demonstrate Disconnect Google only in the dedicated review session; do not delete the original live demo's data.

Before submission, replay the complete video to check that both clients are distinguishable, consent and actual file operations are visible, the link plays without requesting access, and no token/key/private record is exposed. Record timestamps for each client's consent, discovery, scan, approval/copy and AI-preview explanation. Add the owner's video link to the actual form and save its currently entered sensitive/restricted justifications and category when enabled. Retain the `drive.file` explanation as supporting material; do not claim that the observed form requested or saved a separate non-sensitive-scope justification. The existing [reviewer setup packet](CHROME-WEB-STORE-SUBMISSION.md) supplies a small fictional CSV and exact companion setup.

## Evidence ledger

| Evidence | Result to record after it is observed |
| --- | --- |
| Public homepage/privacy/terms | Passed: all three exact URLs above returned HTTP 200 with correct titles and were saved in branding. |
| Branding | Passed: Verify branding then Publish branding; Google confirmed verified branding is being shown to users. |
| Audience | Observed **In production**, changed separately from Testing. This is not data-access verification. |
| Original-client recording | Video timestamps and actual consent/data-access result |
| Store-client identity and acceptance | Public key derives the store ID; separate test folder prepared. Actual Chrome ID/version after loading, consent, selected reads and verified correction copy remain pending. |
| Video | Owner-provided Unlisted YouTube URL, accessible playback and both-client coverage |
| Data-access submission | Not submitted: required YouTube link blank, Save disabled, two justifications/category entered but unsaved. Record later save/submission and reviewer correspondence separately. |
| Assessment | Google's actual applicability decision and any further owner-authorized steps |
| Public availability | OAuth result and Chrome Store approval/publication recorded separately |

Preparing this document changes no client, audience, runtime, journal, Google file or billing setting and does not start a model request.
