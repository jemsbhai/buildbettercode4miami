# Public origin migration inventory

Prepared November 7, 2026. The canonical origin **https://tidepath.muntasersyed.com** is live on Netlify Free with valid TLS. Local application sources, publisher guards, verification-script defaults and saved Marketplace links use it. Backend `51e9f39`, Netlify deployment `6aefb7c009d3e43c1de1f189`, passed hosted checks, real Google website sign-in/sign-out and numeric native version-2 acceptance. The Store Listing draft now contains the verified version-2 standard-report screenshot. Google branding/data-access review and public installation remain pending; deployment is not publication approval.

## Domain findings

Google requires the top private domain used by consent pages, web-client redirects and JavaScript origins in Authorized domains. The current Public Suffix List includes `netlify.app`, so the top private domain for a default hosted site would be its exact `<site>.netlify.app` hostname, not `netlify.app` and not a wildcard. This is an inference from [Google's rule](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) and the [authoritative suffix list](https://publicsuffix.org/list/public_suffix_list.dat); it does not prove Google will approve that hosted site.

There is a material verification distinction: Search Console supports HTML-file or meta-tag verification for a URL-prefix property, but Google's current OAuth domain-remediation instructions explicitly require a DNS-level Domain property for an unverified-domain finding. Do not represent successful HTML-file verification or waiting 24 hours as proof of OAuth domain approval. See [Search Console ownership methods](https://support.google.com/webmasters/answer/9008080?hl=en) and [OAuth domain remediation](https://support.google.com/cloud/answer/13804266?hl=en).

Initial read-only public DNS checks found:

| Record | Observed result |
| --- | --- |
| `muntasersyed.com` nameservers | `ns27.domaincontrol.com`, `ns28.domaincontrol.com` |
| Apex A records | The four GitHub Pages addresses: `185.199.108.153` through `185.199.111.153` |
| `www.muntasersyed.com` | CNAME to `jemsbhai.github.io` |
| Apex TXT | A Google site-verification record exists; its associated account has not been established |
| `tidepath.muntasersyed.com` | NXDOMAIN; no existing hostname found |
| Connected Vercel domain lookup | Not found in the connected `jemsbhais-projects` team |

The [live personal website](https://muntasersyed.com/) identifies Muntaser Syed. The root operator subsequently confirmed the existing `sc-domain:muntasersyed.com` Domain property under `jemsbhai@gmail.com`: Settings showed **You are a verified owner**, with the property added September 20. Root-domain ownership covers its subdomains, so no additional Google ownership TXT record was needed. Netlify's separate ownership proof is recorded below. The existing GoDaddy browser session opened the exact domain's DNS table with 12 records and record-management controls.

The selected subdomain `tidepath.muntasersyed.com` requires no new domain purchase. Once the Netlify site exists, add that exact custom subdomain to Netlify and create only its CNAME to the actual site hostname at the existing DNS provider. Preserve apex A records, `www`, email records and nameservers. Netlify documents this [external-DNS subdomain configuration](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/). Confirm TLS and content before enabling native execution on the new host. This does not authorize a purchase, paid plan, DNS migration or change to the personal website.

Netlify reserved site ID `c5b62d90-5666-4c70-9da6-11ac0cfef6fe` in the verified Free team and required an ownership TXT at `subdomain-owner-verification.muntasersyed.com`. The root operator authorized that exact additional public proof record. GoDaddy saved it, authoritative DNS confirmed it, and Netlify accepted it before assigning the custom subdomain as the site's primary domain.

GoDaddy then saved **CNAME tidepath → tidepath-sheets.netlify.app**. An authoritative query to `ns27.domaincontrol.com` returned that exact target and **1800-second TTL**. The DNS table increased from 12 to 14 records. Readback confirmed the original four apex GitHub Pages A records, `www` CNAME and nameservers remain unchanged; no existing record was edited or deleted. Private proof captures are `.data/public-dns-netlify-txt-saved.png` and `.data/public-dns-tidepath-cname-saved.png`.

## Repository and private configuration inventory

| Location | Required change and current preparation |
| --- | --- |
| `integrations/google-sheets-addon/Code.gs` | Change fixed `TIDEPATH_ORIGIN_`; identity tokens continue to go only to this fixed HTTPS backend |
| `integrations/google-sheets-addon/appsscript.json` | Change the exact `urlFetchWhitelist` origin, with trailing slash; no scope expansion |
| `tests/public-addon-client.test.ts` | Match the new fixed command endpoint |
| `scripts/publish-addon.mjs` | Change the publisher origin guard |
| Ignored `.data/public-addon-publisher.json` | Change only `TIDEPATH_BACKEND_URL`, preserving key and Cloud project configuration without printing them |
| Ignored staged release bundle | Regenerate with `--prepare`; paste final Code/manifest and already-prepared standard-only Sidebar into the existing standalone script |
| Production environment | Set `TIDEPATH_PUBLIC_ORIGIN` to the exact HTTPS origin; retain verified Google audience/client configuration and restricted database role |
| `scripts/verify-public-hosted.mjs`, `scripts/verify-public-session-hosted.ts` | Update default target; explicitly set `TIDEPATH_VERIFY_URL` for migration checks |
| `src/app/privacy/page.tsx` | Prepared Netlify hosting-provider disclosure for the matching new deployment; database/retention disclosure is preserved |
| Public website navigation | Links are relative; no hostname substitution is needed in the public components or install/account pages |
| `public/google281391256ed28668.html` | Existing URL-prefix evidence only. Use the exact file/tag instructed by the new Search Console property if that method is needed; DNS Domain verification is separate |
| Listing, reviewer and video docs | Update canonical links and scope justification endpoint; replace superseded v1 screenshot after native verification |
| Release/database/runbook docs | Separate historical Vercel evidence from new production evidence; do not rewrite prior observations as tests of the new host |

The source and private publisher configuration changes listed above are prepared for the new canonical origin. Historical release/database evidence is maintained separately by its operators. The native ID-token audience, Cloud project, script ID, six manifest scopes and Google Picker key restrictions need no change solely because the backend hostname changes. The Picker renders in Google's Apps Script frame; the public website origin is not its dialog origin.

## Google and Marketplace sequence

1. Establish the actual free hosting account/plan and deployed HTTPS site. Check the full public routes, backend health and access-control behavior on that exact host before redirecting customers or native tokens there.
2. Confirm the selected custom domain resolves to the new deployment with a valid certificate. Inspect the existing Search Console Domain property under the Cloud-project owner account; complete verification if required. Record the actual result.
3. In the existing web OAuth client, set the exact new `/api/auth/google/callback` URI. Add a JavaScript origin only if actually needed by the client; this application performs server-side authorization redirects. Do not create a replacement native client or broaden scopes.
4. Update Google Branding homepage, privacy and terms URLs and the appropriate top private Authorized domain (`muntasersyed.com` for the candidate custom hostname). Keep the plain app title Tidepath and approved publisher/contact fields. Remove retired web-client URLs before removing their old Authorized domain.
5. Changing homepage, policy URLs or authorized domains creates new Draft Branding. Verify and publish the new branding when allowed. If a review is already in progress, Google requires cancelling it before changes. Record any actual delay or findings; the old host's waiting period is not approval for a new domain. [Branding changes](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
6. Verify real website Google sign-in/account actions on the new host. Cookies and in-progress OAuth flows belong to the old origin; use a fresh sign-in instead of assuming they migrate.
7. Paste final Code, Sidebar, Picker and manifest into the existing standalone script, retain only those four source files, and create a new immutable version. Test its numeric version with the new backend before updating the SDK version.
8. Update Marketplace website/developer/support/setup/privacy/terms links, standard-only copy and real native screenshot; save draft. The Google scopes and sensitive-scope video gates remain. Record the video only against the final domain/native version/backend combination.
9. Verify the replacement deployment and carefully retire the public project on the paid host under the root operator's direction. Preserve the unrelated demo and personal website. A redirect running on a paid host is still traffic to that host and is not evidence of zero public-usage charges.

The root operator saved the exact web OAuth callback `https://tidepath.muntasersyed.com/api/auth/google/callback`, canonical branding URLs and only `muntasersyed.com` in Authorized domains. Real sign-in now reaches clean `/account` without query or fragment, and sign-out passed. Numeric native version 2 passed the canonical-host import/merge/report/approval/write/retry/deletion workflow. Marketplace App Configuration saved integer version 2 and canonical website fields; Store Listing saved canonical links, standard-only copy and the actual native version-2 screenshot. No review submission occurred. Google branding remains unverified; the real website account chooser still displays `muntasersyed.com` rather than the saved Tidepath title.

The four-file native bundle is `.data/public-addon-version2/`, containing only `Code.gs`, `Sidebar.html`, `Picker.html` and `appsscript.json`; publisher helpers are excluded. All 11 native-client/sidebar workflow tests passed after the origin change. Final backend and native evidence are recorded in [the dated release record](PUBLIC-RELEASE-2026-11-07.md). The former Vercel public project is paused, disconnected from Git and has cron disabled; the unrelated demo and existing personal website remain preserved.
