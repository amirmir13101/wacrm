# Talk Wagon Technical SEO Audit

Date: 2026-07-11

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

## On-Page SEO Audit

### Pages audited

- Homepage: `/`
- Features hub: `/features`
- Feature detail pages:
  - `/features/team-inbox`
  - `/features/automation`
  - `/features/broadcasts`
  - `/features/flows`
- Pricing: `/pricing`
- Contact: `/contact`
- Company/legal/info pages:
  - `/about`
  - `/privacy-policy`
  - `/terms-and-conditions`
  - `/refund-policy`
  - `/security`
  - `/data-deletion`
- Private and app-only route boundaries:
  - `/login`
  - `/signup`
  - `/dashboard`
  - `/admintops`
  - `/settings`
  - `/inbox`
  - `/broadcasts`
  - `/contacts`
  - `/billing`
  - `/flows`
  - `/ai-chatbot`
  - `/data-deletion/status`
  - `/api/*`

### Metadata added or improved

- Company/legal/info pages now include Twitter card metadata in addition to canonical and Open Graph metadata.
- Root layout keeps fallback canonical, Open Graph, and Twitter metadata for public pages that do not override it.
- Existing feature, pricing, and homepage metadata already had unique page-level titles, descriptions, canonical URLs, Open Graph metadata, Twitter card metadata, and index/follow robots metadata.

### Feature pages improved

- `/features/team-inbox`, `/features/automation`, `/features/broadcasts`, and `/features/flows` now all include visible breadcrumb navigation in the hero area.
- Team Inbox, Automation, and Broadcasts now include `BreadcrumbList` JSON-LD, matching the existing Flows pattern.
- Feature page images already had descriptive alt text; no generic `image`/`photo` alt text was introduced.
- Feature pages already had visible FAQ sections and matching `FAQPage` JSON-LD.

### Schemas added or updated

- Added reusable JSON-LD helpers for:
  - `WebPage`
  - `BreadcrumbList`
- Added `WebPage` and `BreadcrumbList` schema to:
  - `/about`
  - `/contact`
  - `/privacy-policy`
  - `/terms-and-conditions`
  - `/refund-policy`
  - `/security`
  - `/data-deletion`
- Confirmed major marketing pages keep `SoftwareApplication` and `FAQPage` schema where visible page content supports it.

### Heading, alt text, and internal-link fixes

- Public marketing pages use one visible H1 per route.
- Info pages use the shared `InfoHero` H1 pattern.
- Feature detail pages use clear keyword-focused H1 headings and H2 sections.
- Info page layout now keeps `<header>` and `<footer>` outside `<main>`, improving semantic HTML.
- Internal links use descriptive labels such as `Features`, `Pricing`, `Contact`, `Privacy Policy`, and feature-specific anchors rather than vague "click here" text.

### Still needs manual content work

- Add more public comparison/use-case pages only if the business wants to target additional keywords.
- Add real customer proof only when authentic testimonials, case studies, or customer logos are approved.
- Add Search Console/Bing/Yandex ownership verification records outside the codebase if required.
- Continue monitoring query data before expanding content further.

### Pages that should not be indexed

- Auth pages
- CRM dashboard pages
- Admin pages
- Private API routes
- Meta/Facebook data deletion status lookup page
- Any page on `app.talkwagon.chat` that contains workspace, customer, billing, WhatsApp, broadcast, flow, automation, or AI chatbot data

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
- Inspect important pages in Google Search Console URL Inspection.
- Test structured data with Google Rich Results Test.
- Run PageSpeed Insights after deployment.
- Confirm canonical URLs after deployment using a crawler or Search Console URL inspection.
- Monitor indexing, search appearance, and query impressions after Google recrawls the site.
- Add off-site verification files or DNS records only if requested by search tools.
- Continue adding high-quality public content pages if targeting competitive SEO keywords.
