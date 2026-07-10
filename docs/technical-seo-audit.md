# Talk Wagon Technical SEO Audit

Date: 2026-07-10

## Scope

This audit covers the public Talk Wagon marketing website on `https://talkwagon.chat` and the separation from the private CRM application on `https://app.talkwagon.chat`.

Protected CRM areas were not changed: authentication, payments, checkout logic, WhatsApp credentials, Meta setup, broadcast worker, scheduler, AI/RAG, flows, automations, database, and environment values.

## Current SEO foundation

- Public marketing pages use page-level metadata with titles, descriptions, canonical URLs, Open Graph metadata, and index/follow robots metadata.
- Public feature pages include JSON-LD structured data for software/product-style content and FAQs where applicable.
- The root layout now provides fallback Open Graph and Twitter metadata for pages that do not define their own richer metadata.
- `robots.txt` points to the production sitemap at `https://talkwagon.chat/sitemap.xml`.
- `sitemap.xml` lists root-domain public pages only.
- Private dashboard, auth, admin, API, and app-only routes are excluded from crawling through `robots.txt`, route metadata, or both.
- Dashboard, auth, and admin layouts include `noindex` metadata.
- Security headers are centralized in `next.config.ts`, including HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a report-only CSP.
- Public/app domain routing keeps marketing pages on `talkwagon.chat` and CRM/dashboard routes on `app.talkwagon.chat`.
- Yandex Metrica is host-gated to the public root domain and is not loaded on `app.talkwagon.chat`.

## Changes made in this pass

- Expanded `robots.txt` disallow coverage for private/app routes:
  - `/ai-chatbot`
  - `/billing`
  - `/data-deletion/status`
  - `/flows`
  - `/whatsapp-api-pricing`
  - slash variants for existing private routes
- Added root-level fallback canonical, Open Graph, and Twitter metadata.
- Added `/data-deletion` to the public cache header allowlist.
- Added tests to keep the SEO boundary from regressing.

## Indexing policy

### Indexable

- `/`
- `/features`
- `/features/team-inbox`
- `/features/automation`
- `/features/broadcasts`
- `/features/flows`
- `/pricing`
- `/about`
- `/contact`
- `/privacy-policy`
- `/terms-and-conditions`
- `/refund-policy`
- `/security`
- `/data-deletion`

### Not indexable

- Auth pages: `/login`, `/signup`, `/forgot-password`, `/change-password`
- CRM pages: `/dashboard`, `/inbox`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations`, `/flows`, `/ai-chatbot`, `/billing`, `/whatsapp-api-pricing`, `/settings`, `/team`
- Admin pages: `/admin`, `/admintops`
- APIs: `/api/*`
- Meta callback status: `/data-deletion/status`

## Manual follow-up

- Submit `https://talkwagon.chat/sitemap.xml` in Google Search Console, Bing Webmaster Tools, and Yandex Webmaster.
- Confirm canonical URLs after deployment using a crawler or Search Console URL inspection.
- Add off-site verification files or DNS records only if requested by search tools.
- Continue adding high-quality public content pages if targeting competitive SEO keywords.
