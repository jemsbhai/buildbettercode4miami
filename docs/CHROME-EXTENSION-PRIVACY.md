# Tidepath Chrome extension privacy policy

Effective November 8, 2026. This policy covers **Tidepath — local Sheets review**, versions 0.1.x, and its companion running on your computer. The publisher is Muntaser Syed. Privacy and support contact: **jemsbhai@gmail.com**.

The Chrome extension reviews Google Sheets you select and creates separate correction workbooks only after your approval. It requires a local companion. This policy covers that extension and companion, which operate separately from the Tidepath website and Google Workspace add-on.

## Information handled and why

When you connect Google, Chrome obtains a Google access token. The extension sends that token to the companion on your computer so it can make your requested Google API calls. The companion also obtains a Google account permission identifier and saves its SHA-256 fingerprint to prevent a different Google account from opening the same journal through the application. Tidepath does not receive your Google password.

When you request spreadsheet discovery, Google returns accessible spreadsheet names, IDs and modification metadata. Discovery does not automatically scan or select a workbook. When you select workbooks and confirm the scan, Tidepath reads their eligible tabs, headings, cell values, formulas, number formats and source versions. These may include names, donor identifiers, email addresses, phone numbers, donation amounts, transaction dates, currencies and other content in the selected tables. Tidepath uses them to check data quality, explain findings, show exact proposed changes and preserve a recoverable history.

Known private or counseling workbook and tab labels are excluded before reading their cells. Known sensitive column labels are used to omit those columns. These checks cannot recognize every confidential value. Exclude private counseling, health and other inappropriate confidential records before scanning; a suitable label is not a guarantee that a table is safe to process.

After you confirm column mappings and approve the exact plan, the companion sends the reviewed data to Google to create separate correction workbooks and read them back for verification. It does not edit the original workbooks. The new workbooks contain eligible data and number formats; they do not reproduce excluded private columns or tabs, general styling, charts, comments, scripts or sharing settings. Formula-bearing sources are blocked from correction-copy creation.

The extension does not inspect your general browsing history, monitor other tabs, inject scripts into websites, collect keyboard activity, or run advertising or analytics. The publisher does not automatically receive your spreadsheet contents, journals, Google tokens or optional API key.

## Where information goes

- **Your computer:** the extension communicates with its authenticated companion at `http://127.0.0.1:4318`. This is a loopback connection on your device, not a remote Tidepath server. It uses HTTP with a random session pairing token; it is not a TLS-encrypted connection. The companion accepts the configured extension identity and rejects unrelated browser origins.
- **Google:** Google supplies authorized spreadsheet data and stores correction workbooks that you approve. The companion uses HTTPS for Google API requests. Google's own services and your account settings govern data held by Google.
- **OpenAI, only if you explicitly enable optional advice:** the companion can send the exact request described below directly to OpenAI over HTTPS using your own API account. No Tidepath inference proxy is involved.
- **Support you request:** if you email the publisher, the publisher and email provider receive the information you choose to include. Use fictional examples or redacted error descriptions. Do not send API keys, tokens, private journals or confidential spreadsheet records. The publisher will use the message to respond to your request; access to specific user data for support requires your consent.

## Optional AI advice

Deterministic review works without an OpenAI account or key. AI advice is off by default. To enable it, you must enter your own API key into the companion's hidden terminal prompt, inspect the exact outgoing JSON preview, and approve that request in the extension. API charges belong to your OpenAI account; a failed request can still incur charges.

The request contains issue counts, standard mapped field names, table kinds and whether mappings were confirmed, together with instructions, a model identifier and an output limit. Those counts and categories are derived from your scan. It does **not** include raw cells, contact values, workbook or tab titles, spreadsheet IDs, source URLs or counseling text. The API key is sent to OpenAI as the authorization credential, not as part of the advice prompt. OpenAI also receives the network and request information ordinarily needed to serve that API request.

The request sets `store: false`. That setting is not a promise of zero provider retention; OpenAI's applicable API terms, account settings and data controls govern provider handling. The returned text is advisory and cannot approve or apply corrections. No request is sent merely by opening the preview. There is no automatic retry or paid fallback.

## Storage, retention and removal

The extension keeps the pairing token and pending recovery identifiers in Chrome session storage restricted to trusted extension contexts. Chrome clears that session storage when the extension is reloaded, updated or disabled, or the browser restarts. Google access tokens use Chrome's identity cache and companion memory; tokens are not written to the companion journal or returned to the extension's page. An optional OpenAI key stays in companion memory and is not saved to disk by Tidepath.

The companion saves selected eligible source snapshots, findings, mappings, approved plans, source and copy references, timestamps, operation status and the account fingerprint in a local JSON journal. Defaults, relative to the source folder from which the companion runs, are `.data/local-sheets/google-journal.json` for Google data and `.data/local-sheets/demo-journal.json` for fictional rehearsal. A custom `--data-file` changes that location. Journals remain until you remove them; there is no automatic retention deadline. The application limits a journal to 100 saved scans. Journals are not encrypted by Tidepath. Protect your device, backups and operating-system account.

AI responses, usage records and background jobs are held in companion memory for that process. **Remove local API key** clears the key; it does not erase every result already displayed or retained in that session. Stopping the companion ends its in-memory session. Downloaded findings JSON can contain reviewed values and source references and remains wherever you save it.

To stop access, choose **Disconnect Google**, then **Forget connection**, and stop the companion with Ctrl+C, waiting for **Stopped cleanly**. If the companion is unreachable, stop that process to clear its in-memory credentials. You can also revoke Tidepath's grant in your Google account's third-party access settings. Disconnecting or uninstalling the extension does not delete your local journals, downloads or Google correction workbooks. After stopping the companion, delete the appropriate journal and any backups or exports you no longer need. Remove correction workbooks separately in Google Drive if desired. Revoking access does not erase data already saved locally or in Google.

## Limited use and policy changes

Tidepath complies with the Chrome Web Store User Data Policy and the Google API Services User Data Policy, including their Limited Use requirements. Data is used for the review, correction-copy, recovery and optional advice features described here. Tidepath does not sell user data, use it for advertising, or use it to make creditworthiness or lending decisions. The publisher does not use spreadsheet data to train a general-purpose AI model. The optional user-approved advice request serves the current review task.

Material changes to these practices will be disclosed in this policy and in the product before using data in a new way that requires your consent. For questions or a support-data deletion request, contact **jemsbhai@gmail.com**. The publisher cannot remotely remove files stored only on your computer or in your Google account; use the removal steps above.
