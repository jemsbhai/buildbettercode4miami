# Public origin migration inventory

Prepared November 7, 2026. This is a read-only inventory and migration checklist. No replacement origin has been verified or adopted by this document. Existing production URLs must not be replaced with an assumed Netlify hostname.

## Domain findings

Google requires the top private domain used by consent pages, web-client redirects and JavaScript origins in Authorized domains. The current Public Suffix List includes `netlify.app`, so the top private domain for a default hosted site would be its exact `<site>.netlify.app` hostname, not `netlify.app` and not a wildcard. This is an inference from [Google's rule](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) and the [authoritative suffix list](https://publicsuffix.org/list/public_suffix_list.dat); it does not prove Google will approve that hosted site.

There is a material verification distinction: Search Console supports HTML-file or meta-tag verification for a URL-prefix property, but Google's current OAuth domain-remediation instructions explicitly require a DNS-level Domain property for an unverified-domain finding. Do not represent successful HTML-file verification or waiting 24 hours as proof of OAuth domain approval. See [Search Console ownership methods](https://support.google.com/webmasters/answer/9008080?hl=en) and [OAuth domain remediation](https://support.google.com/cloud/answer/13804266?hl=en).

Read-only public DNS checks found:

| Record | Observed result |
| --- | --- |
| `muntasersyed.com` nameservers | `ns27.domaincontrol.com`, `ns28.domaincontrol.com` |
| Apex A records | The four GitHub Pages addresses: `185.199.108.153` through `185.199.111.153` |
| `www.muntasersyed.com` | CNAME to `jemsbhai.github.io` |
| Apex TXT | A Google site-verification record exists; its associated account has not been established |
| `tidepath.muntasersyed.com` | NXDOMAIN; no existing hostname found |
| Connected Vercel domain lookup | Not found in the connected `jemsbhais-projects` team |

The [live personal website](https://muntasersyed.com/) identifies Muntaser Syed. The root operator subsequently confirmed the existing `sc-domain:muntasersyed.com` Domain property under `jemsbhai@gmail.com`: Settings showed **You are a verified owner**, with the property added September 20. Root-domain ownership covers its subdomains, so no additional TXT record is currently needed for this candidate. The existing GoDaddy browser session also opened the exact domain's DNS table with 12 records and record-management controls.

A candidate requiring no new domain purchase is `tidepath.muntasersyed.com`. Once the publisher selects it and the Netlify site exists, add that exact custom subdomain to Netlify and create only its CNAME to the actual site hostname at the existing DNS provider. Preserve apex A records, `www`, email records and nameservers. Netlify documents this [external-DNS subdomain configuration](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/). Confirm TLS and content before adopting the URL. This does not authorize a purchase, paid plan, DNS migration or change to the personal website.

The GoDaddy form is prepared but unsaved: **CNAME**, name **tidepath**, default **1/2 Hour** TTL, empty target. Save remains disabled. Fill the target only after the actual Netlify deployment and custom-domain assignment have been verified. No existing record was selected for editing or deletion.

## Repository and private configuration inventory

| Location | Change after the new origin is verified |
| --- | --- |
| `integrations/google-sheets-addon/Code.gs` | Change fixed `TIDEPATH_ORIGIN_`; identity tokens continue to go only to this fixed HTTPS backend |
| `integrations/google-sheets-addon/appsscript.json` | Change the exact `urlFetchWhitelist` origin, with trailing slash; no scope expansion |
| `tests/public-addon-client.test.ts` | Match the new fixed command endpoint |
| `scripts/publish-addon.mjs` | Change the publisher origin guard |
| Ignored `.data/public-addon-publisher.json` | Change only `TIDEPATH_BACKEND_URL`, preserving key and Cloud project configuration without printing them |
| Ignored staged release bundle | Regenerate with `--prepare`; paste final Code/manifest and already-prepared standard-only Sidebar into the existing standalone script |
| Production environment | Set `TIDEPATH_PUBLIC_ORIGIN` to the exact HTTPS origin; retain verified Google audience/client configuration and restricted database role |
| `scripts/verify-public-hosted.mjs`, `scripts/verify-public-session-hosted.ts` | Update default target; explicitly set `TIDEPATH_VERIFY_URL` for migration checks |
| `src/app/privacy/page.tsx` | Update hosting-provider disclosure only after the provider is active; preserve accurate database/retention disclosure |
| Public website navigation | Links are relative; no hostname substitution is needed in the public components or install/account pages |
| `public/google281391256ed28668.html` | Existing URL-prefix evidence only. Use the exact file/tag instructed by the new Search Console property if that method is needed; DNS Domain verification is separate |
| Listing, reviewer and video docs | Update canonical links and scope justification endpoint; replace superseded v1 screenshot after native verification |
| Release/database/runbook docs | Separate historical Vercel evidence from new production evidence; do not rewrite prior observations as tests of the new host |

The current scan found hardcoded old-origin references in the files above and the public release/database/listing/reviewer/video documents. The native ID-token audience, Cloud project, script ID, six manifest scopes and Google Picker key restrictions need no change solely because the backend hostname changes. The Picker renders in Google's Apps Script frame; the public website origin is not its dialog origin.

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

No domain, Google configuration, hosting setting or saved Marketplace draft was changed during this inventory.
