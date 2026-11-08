# Tidepath Chrome release preparation — November 8, 2026

The user authorized the remaining Chrome Web Store and Google OAuth publication steps after reporting completed registration under the publisher account. Store work uses the existing `codex/tidepath-mvp` checkout. A separately requested chat handles the native Sheets add-on and Google Workspace Marketplace; those are different releases and Cloud projects.

## Current state: branding published; data access and store release pending

The three extension-specific public pages were independently fetched with **HTTP 200** and the correct titles after deployment by the separate website chat. Their exact URLs were saved in Google branding: [homepage](https://tidepath.muntasersyed.com/extension), [privacy](https://tidepath.muntasersyed.com/extension/privacy), and [terms](https://tidepath.muntasersyed.com/extension/terms).

In `tidepath-local-extension`, the audience was changed from **Testing** to **In production**. **Verify branding** succeeded, followed by **Publish branding**. Google confirmed: **Your branding has been verified and is being shown to users**. These results were observed in Google Cloud; private evidence remains in `.data/chrome-release/branding-verified-published.jpg` and `.data/chrome-release/oauth-production-audience.jpg` and is not part of the source/package assets.

**Data access remains not verified.** In the verification form, the 710-character sensitive-scope justification and 776-character restricted-scope justification from [the OAuth packet](CHROME-OAUTH-VERIFICATION.md) were entered, and the Drive productivity category was selected. The required YouTube link remains blank and **Save is disabled**. Those two texts and the category are **unsaved form entries**, not a saved application or submission. The form was left open for the owner to continue. No public OAuth verification, Chrome Store review submission or public install URL is claimed.

## Package and identity evidence

- Store item ID supplied after the user's manual draft upload: `bdojcligphldnmdchmlhgibhlldgflcd`. Google Cloud's **Verify ownership** returned **Your app ownership has been verified** for this exact item.
- Cloud project: `tidepath-local-extension`. A new **Tidepath Chrome Web Store** client was created for that item. The original unpacked-demo client was preserved. The configured output package contains its public OAuth client ID; the default source manifest remains unconfigured. Both public client identifiers are documented in the OAuth packet.
- Branding name **Tidepath — local Sheets review**, original Tidepath logo, publisher support email and authorized domain `muntasersyed.com` were saved successfully. Live links, audience and branding publication are now confirmed above.
- The existing three scopes remain `drive.metadata.readonly`, `spreadsheets.readonly` and `drive.file`. Creating the client and switching audience to In production do not complete data-access verification.
- Store package version **0.1.1** includes 16/32/48/128-pixel icons, a configured OAuth manifest, separate-companion instructions, and in-product setup/privacy/terms links.
- Prepared ZIP: `out/tidepath-extension-store-release.zip`, SHA-256 `fa53c4953bbbebbfb686ee0da7e2a4378c929ef47a496d21843f24a8745a8327`. The owner subsequently confirmed that the existing item's Package tab shows **0.1.1** after uploading this replacement. That is owner-reported upload evidence; automated portal inspection is unavailable.
- The initial draft ZIP remains unchanged at `out/tidepath-extension-store.zip`, SHA-256 `c86267ac5c9d11b5b12d72acc88b24b95a4a03e378435f4f62ff02b71a4f9895`. It is not suitable for final submission because it has no OAuth client.

The owner supplied the store public key. Its SPKI was validated and independently derived extension ID `bdojcligphldnmdchmlhgibhlldgflcd`. A separate ignored local folder, `out/tidepath-extension-store-test`, was prepared from the uploaded 0.1.1 assets with that public `manifest.key`. This did not change the uploaded ZIP or the original demo folder. **The store-ID test folder has not yet been loaded in Chrome, and real consent/read/copy acceptance with the new client remains unverified.** A matching public key is identity-preparation evidence, not an executed OAuth test.

## Owner-reported Chrome Store progress

The owner reports the configured **0.1.1** upload, pasted description, category **Productivity → Workflow & Planning**, language **English**, 128-pixel icon and first two screenshots. Guidance for the third screenshot is in progress; its upload is not yet confirmed. The Chrome Web Store portal is blocked from browser automation, so these entries are owner-reported, not independently inspected or evidence that the full draft has been saved. Privacy, distribution and reviewer completion, review submission, approval and publication remain separate gates.

## Materials

[Submission copy and reviewer instructions](CHROME-WEB-STORE-SUBMISSION.md) include the listing, single purpose, permission justifications, data categories, scope use, setup, fictional review and real-Google review. [The privacy policy](CHROME-EXTENSION-PRIVACY.md) covers the local companion, session tokens, plaintext local journals, approved Google copies and optional aggregate advice transfer.

Three 1280×800 images in `docs/chrome-web-store/` show the actual UI using the fictional browser rehearsal. The setup image explicitly displays the simulated-Chrome/fictional-data label; these are illustrative UI images, **not evidence of store installation or Google authorization**. No private workbook IDs, real record values or pairing tokens are included.

Standalone public pages are prepared under ignored `outputs/chrome-web-store/site/extension/` for `/extension`, `/extension/privacy` and `/extension/terms`. The separate website chat deployed them; anonymous HTTP/content checks passed, and their exact URLs are saved in Google branding. The generic native-add-on privacy and terms are separate.

## Remaining dependencies

1. After the active demo safely ends, load the separate store-ID test folder and run a deliberately matching companion session with a separate journal. Verify actual new-client Google consent, selected reads and correction copies; do not restart or repoint the live demo incidentally.
2. Obtain the owner's verification video covering the two retained OAuth clients, add its YouTube link to the actual form, save the currently unsaved justifications/category, and complete Google's sensitive/restricted data-access submission. The current form cannot be saved without the video link. Google may require further review or an assessment; no waiver or paid assessment is authorized by this record.
3. Complete and save the remaining Chrome listing/privacy/distribution/reviewer fields, confirm the third screenshot, and submit for review. The owner must perform the blocked portal's actions; no alternate automation is used to bypass that restriction.
4. Record data-access approval, store submission, approval, publication and an actual public installation separately. No public install URL is claimed yet.

## Preserved demo

The existing unpacked demo uses its original ID and output path. Its manifest/ZIP hashes were unchanged by release packaging. The existing companion remained running with Google connected, AI off and zero AI attempts. This release work did not restart it, alter its journal, or call a paid model. Changing to the store ID for a later live test requires deliberately starting a matching companion session; the current session must not be silently replaced.

## Validation

Release-preparation source commit **`dddcb624af9bfb6e1846b427cf1c55db8e0eeaa2`** was pushed before the later website/branding/audience observations above. This follow-up changes documentation only; it does not change the release runtime, configured ZIP, client settings, tokens, demo process or journal. No model calls were made. Documentation checks are separate from the historical implementation checks below.

The pinned Node 24.19.0/npm 12.0.2 `npm run verify` completed successfully in the current working checkout: typecheck, **247 tests**, production build and **72 deterministic HTTP checks**. This checkout includes the separate, still-uncommitted draft-review work; those totals describe the complete working checkout, not a source-isolated release commit. The release packaging and extension checks separately passed 28 targeted tests. Packaging tests cover preservation of a configured demo output, the explicit file allowlist, icon dimensions, configured versus draft instructions, deterministic ZIP output, and invalid output-path rejection. No live AI was used.
