# Tidepath Chrome release preparation — November 8, 2026

The user authorized the remaining Chrome Web Store and Google OAuth publication steps after reporting completed registration under the publisher account. Store work uses the existing `codex/tidepath-mvp` checkout. A separately requested chat handles the native Sheets add-on and Google Workspace Marketplace; those are different releases and Cloud projects.

## Verified state

- Store item ID supplied after the user's manual draft upload: `bdojcligphldnmdchmlhgibhlldgflcd`. Google Cloud's **Verify ownership** returned **Your app ownership has been verified** for this exact item.
- Cloud project: `tidepath-local-extension`. A new **Tidepath Chrome Web Store** client was created for that item. The original unpacked-demo client was preserved. The public client ID is embedded only in the configured output package, not in the default source manifest.
- Branding name **Tidepath — local Sheets review**, original Tidepath logo, publisher support email and authorized domain `muntasersyed.com` were saved successfully. Public extension-specific home/privacy/terms pages are being prepared for the verified domain; they must be live before verification submission.
- The existing three scopes remain `drive.metadata.readonly`, `spreadsheets.readonly` and `drive.file`. The project's audience was still **Testing** when the new client was created. No OAuth verification or public eligibility is claimed by creating the client.
- Store package version **0.1.1** includes 16/32/48/128-pixel icons, a configured OAuth manifest, separate-companion instructions, and in-product setup/privacy/terms links.
- Prepared ZIP: `out/tidepath-extension-store-release.zip`, SHA-256 `fa53c4953bbbebbfb686ee0da7e2a4378c929ef47a496d21843f24a8745a8327`. The owner subsequently confirmed that the existing item's Package tab shows **0.1.1** after uploading this replacement. That is owner-reported upload evidence; automated portal inspection is unavailable.
- The initial draft ZIP remains unchanged at `out/tidepath-extension-store.zip`, SHA-256 `c86267ac5c9d11b5b12d72acc88b24b95a4a03e378435f4f62ff02b71a4f9895`. It is not suitable for final submission because it has no OAuth client.

## Materials

[Submission copy and reviewer instructions](CHROME-WEB-STORE-SUBMISSION.md) include the listing, single purpose, permission justifications, data categories, scope use, setup, fictional review and real-Google review. [The privacy policy](CHROME-EXTENSION-PRIVACY.md) covers the local companion, session tokens, plaintext local journals, approved Google copies and optional aggregate advice transfer.

Three 1280×800 images in `docs/chrome-web-store/` show the actual UI using the fictional browser rehearsal. The setup image explicitly displays the simulated-Chrome/fictional-data label; these are illustrative UI images, **not evidence of store installation or Google authorization**. No private workbook IDs, real record values or pairing tokens are included.

Standalone public pages are prepared under ignored `outputs/chrome-web-store/site/extension/` for `/extension`, `/extension/privacy` and `/extension/terms`. Their deployment is coordinated with the existing public-site checkout. The generic native-add-on privacy and terms are separate.

## Remaining dependencies

1. Publish and verify the dedicated home/privacy/terms pages, then save their exact live URLs in Google branding and request verification.
2. Complete production audience and Google's required sensitive/restricted data-access verification, including an accurate extension consent/use demonstration. Google can require external review or an assessment; no paid assessment is authorized by this work.
3. Complete the listing/privacy/distribution/reviewer fields for the owner's uploaded 0.1.1 package, verify actual store-ID Google authorization, then submit for review. The Chrome developer dashboard is explicitly blocked from browser automation here; the owner must perform its portal actions. No alternate automation was used to bypass that restriction.
4. Record store submission, approval, publication and an actual public installation separately. No public install URL is claimed yet.

## Preserved demo

The existing unpacked demo uses its original ID and output path. Its manifest/ZIP hashes were unchanged by release packaging. The existing companion remained running with Google connected, AI off and zero AI attempts. This release work did not restart it, alter its journal, or call a paid model. Changing to the store ID for a later live test requires deliberately starting a matching companion session; the current session must not be silently replaced.

## Validation

The pinned Node 24.19.0/npm 12.0.2 `npm run verify` completed successfully in the current working checkout: typecheck, **247 tests**, production build and **72 deterministic HTTP checks**. This checkout includes the separate, still-uncommitted draft-review work; those totals describe the complete working checkout, not a source-isolated release commit. The release packaging and extension checks separately passed 28 targeted tests. Packaging tests cover preservation of a configured demo output, the explicit file allowlist, icon dimensions, configured versus draft instructions, deterministic ZIP output, and invalid output-path rejection. No live AI was used.
