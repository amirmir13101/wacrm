# TalkWagon SEO Batch 04 — Competitor and Alternative Pages Report

## Scope and repository state

- Repository: `D:\Projects\wacrm-production-dev`
- Branch: `production-ready-bulk-system`
- Working HEAD during implementation: `60b3ea4abff64e9f4debf940bbdc3b6bcda84f83`
- Work mode: local implementation and review package only
- Commit/push/deployment: not performed
- Protected systems changed: none

Batch 04 was implemented conservatively because the authoritative V2.2 page map
contains only one comparison page: `/wati-alternative` for the keyword
`wati alternative`.

## Authoritative research decision

Files reviewed:

- `docs/seo/research-v2.2/talkwagon-codex-master-seo-prompt-v2.2.md`
- `docs/seo/research-v2.2/talkwagon-codex-execution-order-v2.2.md`
- `docs/seo/research-v2.2/talkwagon-codex-batch-04-competitor-pages-v2.2.md`
- `docs/seo/research-v2.2/talkwagon-page-keyword-map-v2.2.csv`
- `docs/seo/research-v2.2/talkwagon-codex-keyword-input-v2.2.csv`
- `docs/seo/research-v2.2/talkwagon-keyword-clusters-v2.2.csv`
- `docs/seo/research-v2.2/talkwagon-search-intent-map-v2.2.csv`
- `docs/seo/research-v2.2/talkwagon-cannibalization-resolution-v2.2.csv`
- `docs/seo/research-v2.2/talkwagon-batch-d-competitor-metrics-v2.2.csv`
- `docs/seo/implementation/batch-03-commercial-pages-report.md`

The Batch 04 prompt states to build only comparison pages explicitly approved by
the user and mapped to a numeric keyword, begin with `/wati-alternative`, and
defer other competitor pages until fresh keyword metrics and product evidence
exist.

## Page decision table

| Candidate URL | Decision | Reason |
| --- | --- | --- |
| `/wati-alternative` | Hardened existing page | The authoritative page map already assigns `wati alternative` to this URL with US volume 90 and KD 2. The route already existed from Batch 03, so Batch 04 improved evidence/context instead of duplicating it. |
| `/respond-io-alternative` | Deferred | Semrush US volume 10; not mapped in V2.2 page map. |
| `/aisensy-alternative` | Deferred | Semrush US volume 10; not mapped in V2.2 page map. |
| `/interakt-alternative` | Deferred | Semrush US volume 30; possible future micro candidate, but not mapped in V2.2 page map and requires full official product evidence before publishing. |
| `/gallabox-alternative` | Deferred | Semrush US volume 20; possible future micro candidate, but not mapped in V2.2 page map and requires full official product evidence before publishing. |
| `/zoko-alternative` | Deferred | Semrush US volume 30; possible future micro candidate, but not mapped in V2.2 page map and requires full official product evidence before publishing. |
| `/delightchat-alternative` | Deferred | Semrush US volume 50 and KD 3; recorded as a future opportunity, not created in Batch 04 because it is not mapped in V2.2. |
| `/trengo-alternative` | Deferred | Semrush US volume 50; not mapped in V2.2 page map and requires product evidence. |
| `/sleekflow-alternative` | Deferred | Semrush US volume 40 and KD 6; recorded as a future opportunity, not created in Batch 04 because it is not mapped in V2.2. |
| `/doubletick-alternative` | Deferred | Semrush US volume 40 and KD 1; recorded as a future opportunity, not created in Batch 04 because it is not mapped in V2.2. |

No arbitrary competitor page count was used.

## Semrush validation

Output file:

`docs/seo/implementation/batch-04-semrush-validation.csv`

US `phrase_these` validation on July 19, 2026 confirmed:

- `wati alternative`: volume 90, KD 2, CPC 0, commercial intent signal.
- Several other alternatives show small-volume signals, but they are not
  authoritative Batch 04 page-map entries.
- India `phrase_these` for the same exact alternative batch returned no data.

No keyword metric was invented. No KD 0 value was treated as a confirmed easy
keyword unless Semrush returned it as part of the report and it was still
deferred for mapping/evidence reasons.

## Official competitor evidence

Official WATI sources reviewed on July 19, 2026:

- `https://www.wati.io/pricing/`
- `https://support.wati.io/en/articles/11462993-understanding-wati-s-pricing-structure`
- `https://support.wati.io/en/articles/11462997-understanding-wati-s-pricing-plans`
- `https://support.wati.io/en/collections/15525494-wati-plans-pricing`
- `https://support.wati.io/en/articles/11375155-what-is-wati-platform-overview-and-key-features`

Summary of facts used:

- WATI presents Growth, Pro, and Business plans.
- WATI describes total pricing as subscription plan, messaging charges, and
  optional add-ons.
- WATI pricing content reviewed publicly listed separate messaging charges that
  vary by marketing, utility, and authentication message type.
- WATI product/help content describes messaging, automation, AI, CRM, analytics,
  Team Inbox, and multi-channel customer engagement.

The page does not claim TalkWagon has every WATI feature, does not claim that
TalkWagon is cheaper, and does not claim guaranteed savings or superiority.

## Implementation summary

### `/wati-alternative`

Changed existing page only:

- Kept primary keyword ownership: `WATI alternative`.
- Kept existing metadata, canonical, FAQ schema, breadcrumb schema, WebPage
  schema, three images, and pricing-safe TalkWagon claims.
- Added row-level `evidence` text for all comparison table rows.
- Fixed encoded apostrophe text in the WATI automation row.
- Reworded the team-access evidence row so it stays self-contained and does
  not tell users to leave the page for basic comparison context.
- Kept non-affiliation/trademark notice and dated evidence language.

### Shared comparison table

`src/components/marketing/commercial-landing-page.tsx` now supports an optional
fourth column:

`Evidence or important context`

This makes competitor pages more useful because visitors can see the reasoning
directly on the page rather than being told to read an external document.

The commercial landing-page signup CTAs also render as plain anchors instead of
Next.js route links. This preserves the same visible CTA behavior while avoiding
marketing-page RSC prefetch requests to `/signup`, which redirect to the app
subdomain and can otherwise create browser CORS console noise during rendered
verification.

### Public navigation and footer

`src/components/marketing/public-header.tsx`

- Added desktop `Use Cases` dropdown linking to:
  - `/use-cases/sales`
  - `/use-cases/newsletter`
- Added desktop `Compare` link to `/wati-alternative`.
- Added the same completed commercial pages to the mobile menu.
- Kept the expanded desktop navigation at the `xl` breakpoint after adding
  Use Cases and Compare, so medium/tablet widths use the mobile menu instead
  of a crowded desktop nav.
- Rendered cross-domain app login/signup CTAs as plain anchors in the public
  marketing header to avoid Next.js RSC prefetch/navigation CORS console noise
  on marketing pages.

`src/components/marketing/public-footer.tsx`

- Added a `Use Cases` group with:
  - WhatsApp Sales CRM
  - WhatsApp Newsletter
  - WATI Alternative
- Added `Compare WATI Alternative` under Resources.

## Image review

No new images were generated because `/wati-alternative` already had three
approved, optimized, page-specific visual placements.

Artifacts:

- `docs/seo/implementation/batch-04-image-prompts.md`
- `docs/seo/implementation/batch-04-image-review-contact-sheet.png`

Final images verified:

| File | Dimensions | Size |
| --- | ---: | ---: |
| `public/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation-v2.webp` | 1168 × 880 | 73,008 bytes |
| `public/hostiko-crm/generated/commercial/talk-wagon-wati-workflow-evaluation-v2.webp` | 1168 × 880 | 79,766 bytes |
| `public/hostiko-crm/generated/commercial/talk-wagon-wati-decision-framework-v2.webp` | 1168 × 880 | 83,646 bytes |

## Product and pricing claim review

- Existing TalkWagon public pricing was not changed.
- `$1/month`, `90% OFF`, and `$1 first month, then $9.90/month` remain
  preserved in the pricing page.
- The WATI page still states that Meta WhatsApp API charges are separate from
  TalkWagon CRM subscription pricing.
- No new TalkWagon feature was invented.
- No competitor feature was included without official-source support.

## Validation evidence

### Automated validation

- Focused Batch 04/Batch 03/domain tests:
  - Command: `npm test -- src/lib/seo/batch-04-competitor-pages.test.ts src/lib/seo/batch-03-commercial-pages.test.ts src/lib/domain-routing.test.ts`
  - Result: passed, 3 files, 22 tests.
- Lint:
  - Command: `npm run lint`
  - Result: passed with 0 errors and 22 existing warnings.
- Typecheck:
  - Command: `npm run typecheck`
  - Result: passed.
- Full test suite:
  - Command: `npm test`
  - Result: passed, 112 files and 802 tests.
- Build:
  - Command: `npm run build`
  - Result: passed; 97 static pages generated.
- Diff check:
  - Command: `git diff --check`
  - Result: passed with normal CRLF warnings only.

### Local production route checks

Local production server: `http://localhost:3024`

| Route | HTTP | H1 count | JSON-LD |
| --- | ---: | ---: | --- |
| `/wati-alternative` | 200 | 1 | WebPage, BreadcrumbList, FAQPage |
| `/use-cases/sales` | 200 | 1 | WebPage, BreadcrumbList, FAQPage |
| `/use-cases/newsletter` | 200 | 1 | WebPage, BreadcrumbList, FAQPage |
| `/features` | 200 | 1 | SoftwareApplication, FAQPage |
| `/pricing` | 200 | 1 | SoftwareApplication, FAQPage |

All internal links extracted from those pages returned 200 locally.

Direct WATI visual assets returned 200 with `image/webp` content type.

Sitemap and robots local checks returned 200.

Rendered production smoke tests at desktop, tablet, and mobile widths found no
horizontal overflow. A cross-domain app login/signup RSC fetch warning was found
and fixed by rendering those app-domain CTA links as plain anchors.

Playwright browser automation was not available in this local environment, so no
new dependency was installed. Responsive and console checks should be repeated
manually before deployment if desired.

## Files changed

- `src/app/wati-alternative/page.tsx`
- `src/components/marketing/commercial-landing-page.tsx`
- `src/components/marketing/public-header.tsx`
- `src/components/marketing/public-footer.tsx`
- `src/lib/seo/batch-04-competitor-pages.test.ts`
- `docs/seo/implementation/batch-04-competitor-pages-report.md`
- `docs/seo/implementation/batch-04-changed-files.md`
- `docs/seo/implementation/batch-04-complete.patch`
- `docs/seo/implementation/batch-04-image-prompts.md`
- `docs/seo/implementation/batch-04-image-review-contact-sheet.png`
- `docs/seo/implementation/batch-04-semrush-validation.csv`
- `docs/seo/implementation/batch-04-future-article-keywords.csv`

## Deferred opportunities

See:

`docs/seo/implementation/batch-04-future-article-keywords.csv`

These are not approved Batch 04 pages. They need a later approval, fresh
Semrush validation, and official competitor research before implementation.

## Final Batch 04 status

Ready for review. Not committed, not pushed, and not deployed.
