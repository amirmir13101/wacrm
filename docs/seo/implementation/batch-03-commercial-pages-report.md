# TalkWagon SEO Batch 03 — Commercial Landing Pages Report

## Scope and repository state

- Repository: `D:\Projects\wacrm-production-dev`
- Branch: `production-ready-bulk-system`
- Starting HEAD: `0b910bddb067748d181a705958950c9e5fe4191d`
- Work mode: local implementation and review only
- Production deployment: not performed
- Batch 01 and Batch 02: preserved
- Research authority: `docs/seo/research-v2.2`
- Semrush verification date: 2026-07-18

The V2.2 package uses `talkwagon-search-intent-map-v2.2.csv` and
`talkwagon-cannibalization-resolution-v2.2.csv`; those are the authoritative
files corresponding to the older names referenced in the execution prompt.

## Pages considered

| Proposed URL | Decision | Reason |
| --- | --- | --- |
| `/use-cases/sales` | Created | Approved V2.2 commercial use-case page with verified US demand and a distinct sales-workflow intent. |
| `/use-cases/newsletter` | Created | Approved V2.2 commercial use-case page with verified US demand and a distinct opt-in campaign intent. |
| `/wati-alternative` | Created | Approved V2.2 comparison page with verified US demand; written as a neutral, dated, source-linked evaluation guide. |
| `/whatsapp-api-pricing` | Rejected | The existing `/pricing` page owns `whatsapp api pricing`; creating another public page would reintroduce a known redirect and cannibalization conflict. |
| Country/language commercial pages | Deferred | Assigned to later international SEO batches; no hreflang or translated routes belong in Batch 03. |
| Competitor listicles and blog articles | Deferred | Assigned to later competitor/article batches. The V2.2 cannibalization map reserves the commercial page as the primary owner. |

No page was added to satisfy an arbitrary page count.

## Final URL-to-keyword ownership

### Existing ownership preserved

| URL | Primary keyword |
| --- | --- |
| `/` | `whatsapp crm` |
| `/features` | `whatsapp business api` |
| `/features/team-inbox` | `whatsapp team inbox` |
| `/features/flows` | `whatsapp chatbot` |
| `/features/automation` | `whatsapp automation` |
| `/features/broadcasts` | `whatsapp broadcast software` |
| `/pricing` | `whatsapp api pricing` |

### Batch 03 ownership and Semrush evidence

| URL | Primary keyword | Secondary keyword | Country / database | Volume | KD | CPC (USD) | Intent | Semrush modules | Evidence |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `/use-cases/sales` | `whatsapp sales` | `whatsapp commerce` | United States / `us` | 110 | 14 | 7.05 | Commercial / consideration | Phrase These + Keyword Difficulty | `semrush-phrase-these-us-priority-seeds-2026-07-18.txt`; reconfirmed with Phrase KDI |
| `/use-cases/newsletter` | `whatsapp newsletter` | None assigned as a separate target | United States / `us` | 480 | 15 | 2.36 | Commercial / consideration | Phrase These + Keyword Difficulty | `semrush-phrase-these-us-priority-seeds-2026-07-18.txt`; reconfirmed with Phrase KDI |
| `/wati-alternative` | `wati alternative` | None assigned as a separate target | United States / `us` | 90 | 2 | 0.00 | Commercial / decision | Phrase These + Keyword Difficulty | `semrush-phrase-these-us-priority-seeds-2026-07-18.txt`; reconfirmed with Phrase KDI |
| `/use-cases/sales` | `whatsapp commerce` (secondary) | — | United States / `us` | 320 | 14 | 7.42 | Commercial / consideration | Phrase These + Keyword Difficulty | V2.2 search-intent and page maps; reconfirmed 2026-07-18 |

All primary recommendations have numeric volume and KD. The WATI keyword's KD
of 2 is a confirmed numeric Semrush value, not an unavailable zero. Additional
phrases in metadata and copy are descriptive product language, not additional
primary keyword recommendations.

## Page implementation details

### `/use-cases/sales`

- Conversion goal: start a free trial or review pricing after understanding the
  team-inbox-to-pipeline sales workflow.
- H1: `WhatsApp Sales CRM for Leads and Follow-Ups`
- Title: `WhatsApp Sales CRM for Leads and Follow-Ups - Talk Wagon` (58 characters)
- Meta description: `Turn WhatsApp sales conversations into assigned leads, organized contact context, CRM pipeline stages, and timely follow-ups with Talk Wagon.` (141 characters)
- Canonical: `https://talkwagon.chat/use-cases/sales` in production
- Hero, Open Graph, and Twitter image:
  `/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-workflow.webp`
- Image alt: `Conceptual Talk Wagon WhatsApp sales workflow with conversations, team assignment, follow-ups, and pipeline stages`
- Content outline: hero; sales outcomes; five-step process; shared inbox,
  pipeline, and commerce workflow sections; consent/Meta limitation; related
  guides; six visible FAQs; final CTA.
- Contextual links: `/features/team-inbox`, `/features/automation`, `/pricing`,
  `/signup`, plus standard public navigation/footer links.
- FAQ schema is generated from the same six visible FAQ objects.

### `/use-cases/newsletter`

- Conversion goal: start a free trial or review pricing after understanding the
  approved-template, audience, preflight, queue, and reply workflow.
- H1: `WhatsApp Newsletter Software for Teams`
- Title: `WhatsApp Newsletter Software for Teams - Talk Wagon` (52 characters)
- Meta description: `Plan opt-in WhatsApp newsletter campaigns with approved templates, audience checks, queue processing, delivery tracking, and CRM follow-ups.` (140 characters)
- Canonical: `https://talkwagon.chat/use-cases/newsletter` in production
- Hero, Open Graph, and Twitter image:
  `/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-workflow.webp`
- Image alt: `Conceptual Talk Wagon WhatsApp newsletter workflow with an opt-in audience, approval checks, campaign queue, delivery status, and inbox replies`
- Content outline: hero; campaign outcomes; consent-to-follow-up process;
  preparation, server processing, and shared-inbox reply sections; policy
  limitation; related guides; six visible FAQs; final CTA.
- Contextual links: `/features/broadcasts`, `/features/team-inbox`, `/pricing`,
  `/signup`, plus standard public navigation/footer links.
- FAQ schema is generated from the same six visible FAQ objects.

### `/wati-alternative`

- Conversion goal: evaluate Talk Wagon with the buyer's actual workflow and
  review current pricing without unsupported parity or superiority claims.
- H1: `WATI Alternative for WhatsApp CRM Teams`
- Title: `WATI Alternative for WhatsApp CRM Teams - Talk Wagon` (54 characters)
- Meta description: `Compare Talk Wagon as a WATI alternative for team inboxes, CRM workflows, broadcasts, automation, permissions, and transparent plan evaluation.` (143 characters)
- Canonical: `https://talkwagon.chat/wati-alternative` in production
- Hero, Open Graph, and Twitter image:
  `/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation.webp`
- Image alt: `Conceptual Talk Wagon evaluation of WhatsApp CRM inbox, broadcast, automation, cost, and workflow-fit considerations`
- Content outline: hero; evidence-led comparison outcomes; five-step evaluation
  process; Talk Wagon workflow, official WATI plan structure, and fit sections;
  non-affiliation/trademark notice; dated official sources; related guides; six
  visible FAQs; final CTA.
- Contextual links: `/features`, `/pricing`, `/features/team-inbox`, `/signup`,
  plus standard public navigation/footer links.
- Official WATI sources reviewed:
  - `https://www.wati.io/pricing/`
  - `https://support.wati.io/en/articles/11462993-understanding-wati-s-pricing-structure`
  - `https://support.wati.io/en/articles/11462997-understanding-wati-s-pricing-plans`
  - `https://support.wati.io/en/collections/15525494-wati-plans-pricing`
- The page states that third-party information was reviewed on July 18, 2026,
  can change, must be verified, and that Talk Wagon is not affiliated with,
  endorsed by, or sponsored by WATI.

## Metadata and schema

Every new route includes:

- unique Next.js metadata title and 140–160 character description;
- self-referencing canonical through `getCanonicalUrl`;
- Open Graph `website` metadata;
- Twitter `summary_large_image` metadata;
- one H1;
- visible breadcrumbs and matching `BreadcrumbList` JSON-LD;
- `WebPage` JSON-LD;
- visible FAQs and matching `FAQPage` JSON-LD;
- descriptive image alt text; and
- index/follow robots metadata.

Schema types rendered on each page are exactly `WebPage`, `BreadcrumbList`, and
`FAQPage`. No Product, Review, AggregateRating, or SearchAction schema was added.

## Reusable implementation

`src/components/marketing/commercial-landing-page.tsx` supplies the common
visual structure while every route owns its metadata, copy, outcomes, steps,
sections, limitations, links, and FAQ data. This preserves the current Talk
Wagon marketing design without creating thin pages or duplicate page copy.

`FaqJsonLd` was added to the existing SEO JSON-LD helpers so schema is generated
directly from the visible FAQ data.

## Page-specific Higgsfield artwork

Three unique conceptual hero images were generated with the installed
`higgsfield-generate` workflow and Nano Banana Pro after the authorized trial
became active. Existing homepage, feature, and broadcast hero images are no
longer reused by these pages.

| Route | Final asset | Dimensions | Size |
| --- | --- | ---: | ---: |
| `/use-cases/sales` | `public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-workflow.webp` | 1168 x 880 | 46,042 bytes |
| `/use-cases/newsletter` | `public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-workflow.webp` | 1168 x 880 | 57,530 bytes |
| `/wati-alternative` | `public/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation.webp` | 1168 x 880 | 32,170 bytes |

Each asset uses the TalkWagon forest-green, emerald, white, pale-mint, and amber
visual language. Visual review confirmed no readable generated text, logos,
third-party interfaces, fake product screenshots, people, customer data,
prices, statistics, comparison scores, or unsupported superiority claims.

The generated 4:3 sources were center-cropped to the existing 1168 x 880 hero
container and encoded as WebP at quality 80 with effort 6 and smart chroma
subsampling. Source metadata was not copied. Full prompts, settings, alt text,
and optimization details are recorded in
`docs/seo/implementation/batch-03-image-prompts.md`.

## Hub links, sitemap, routing, and cache policy

- `/features` now links to all three completed Batch 03 guides.
- `/pricing` now links to the source-grounded WATI alternative guide.
- The sitemap includes only the three finished routes:
  - sales and newsletter: weekly, priority 0.8;
  - WATI alternative: monthly, priority 0.75.
- Public-domain routing recognizes `/use-cases/*` and `/wati-alternative` so the
  pages remain on `talkwagon.chat` rather than the authenticated app subdomain.
- Existing public cache policy now includes those routes.
- Robots restrictions were not changed.

## Cannibalization audit

A source-level exact-phrase scan was run across existing and new public pages.
The original seven primary owners remain unchanged. Incidental supporting uses
on the feature hub, footer, pricing explanation, related-link cards, FAQs, and
descriptive copy do not create competing title/H1/canonical ownership.

- `whatsapp sales` is owned by `/use-cases/sales`; the future sales blog is deferred.
- `whatsapp newsletter` is owned by `/use-cases/newsletter`; the future newsletter guide is deferred.
- `wati alternative` is owned by `/wati-alternative`; the future alternatives listicle is deferred.
- `whatsapp commerce` appears only as a secondary phrase on the sales use case.
- No `/whatsapp-api-pricing` route was created.

## Product-claim review

New copy describes only product behavior already present in the repository and
approved product documentation: shared inbox, assignment, contacts/tags/custom
fields, pipelines/deals, broadcasts, approved templates, audience controls,
preflight, status tracking, server queue, visual flows, automations, roles,
permissions, human handoff, and customer-provided official WhatsApp setup.

Limitations are explicit:

- Talk Wagon does not sell or supply WhatsApp Business API access.
- Businesses remain responsible for approval, consent, templates, compliance,
  and Meta/provider charges.
- Delivery and sales results are not guaranteed.
- Competitor feature parity, superiority, and cost savings are not claimed.

The only existing-page product copy changes are three short guide cards on
`/features` and one factual WATI guide link on `/pricing`.

## Pricing-claim review

- Existing displayed prices remain unchanged.
- `$1/month`, `90% OFF`, and `$1 first month, then $9.90/month` remain intact.
- No new price, discount, allowance, or inclusion claim was added.
- Every relevant page states that Meta WhatsApp messaging and provider charges
  are separate from Talk Wagon CRM subscription pricing.

## Validation evidence

### Automated validation

- Focused Batch 03 and domain-routing tests: 16/16 passed.
- SEO regression tests (Batch 01 marketing keywords, Batch 02, Batch 03, and
  domain routing): 25/25 passed across 4 files.
- Full test suite: 111 files, 796/796 tests passed.
- Typecheck: passed.
- Lint: passed with 0 errors and the same 22 existing warnings.
- Production build: passed with Next.js 16.2.6; 97 static pages generated.
- Build warnings: existing static-asset cache-control warning and existing
  middleware-convention deprecation warning only.
- `git diff --check`: passed before review-package generation.

### Local production route checks

The production build was served locally on port 3023 for read-only checks.

| Route | Result |
| --- | --- |
| `/use-cases/sales` | 200 |
| `/use-cases/newsletter` | 200 |
| `/wati-alternative` | 200 |
| `/features` | 200 |
| `/pricing` | 200 |
| `/sitemap.xml` | 200 |
| `/robots.txt` | 200 |

All internal links extracted from the three new pages returned 200 locally.
Batch 01 titles and descriptions on `/features` and `/pricing` remained intact.

### Browser checks

Desktop viewport: 1440 × 900. Mobile viewport: 390 × 844.

- all three routes rendered with exactly one H1;
- unique metadata and canonicals rendered;
- each route used its unique page-specific image for the hero, Open Graph, and
  Twitter metadata;
- all three images loaded with non-zero 1168 x 880 natural dimensions;
- explicit 1168 x 880 image attributes remained present to prevent layout shift;
- no broken image was detected;
- all three direct image URLs returned 200;
- no horizontal overflow or improper image cropping was detected on desktop or mobile;
- visible FAQ headings and all six questions rendered on each page;
- JSON-LD parsed as WebPage, BreadcrumbList, and FAQPage;
- no forbidden schema type appeared; and
- no browser console warning or error was recorded.

Local canonicals used the configured local site origin during the local server
check; the same helper resolves to `https://talkwagon.chat` in production.

## Protected-area confirmation

No authentication, authorization, dashboard, database, migration, Supabase,
payment, checkout, pricing calculation, WhatsApp credential, Meta configuration,
webhook, broadcast worker, AI/RAG, environment, secret, Nginx, PM2, cron,
scheduler, or VPS file was changed. No dependency was added.

## Deferred issues and non-blocking warnings

- Local build warnings listed above predate Batch 03 and are not caused by these pages.
- The local metadata origin reflects the configured local site URL; production
  continues to resolve the same self-referencing paths on `https://talkwagon.chat`.
- Country/language pages, competitor listicles, and articles remain deferred to
  their approved later batches.
- Live production verification is intentionally deferred until a separate
  commit/deployment approval.
