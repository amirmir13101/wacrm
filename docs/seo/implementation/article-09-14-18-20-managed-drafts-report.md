# Articles 09, 14, 18, and 20 Managed Draft Rewrite Report

## Scope

Four future SEO articles were reviewed, expanded, and kept as admin-managed drafts only:

- Article 09: How to Broadcast on WhatsApp
- Article 14: WhatsApp Business Message Templates
- Article 18: Dutch scheduled-message guide
- Article 20: WhatsApp event invitation messages

These drafts are not code-published static articles and remain excluded from the public static blog registry and sitemap until they are published from the admin dashboard.

## Correction completed

The previous draft set used an extra markdown table of contents near the top of each article. That did not match the published Article 01–08 structure because the managed blog renderer already creates the sticky sidebar table of contents from H2 headings.

Correction completed:

- Removed top-of-article `Table of contents` / `Inhoud` sections from all four drafts.
- Preserved sidebar TOC behavior through normal H2 headings.
- Expanded each article with practical, non-filler guidance.
- Added three supporting body images per article, so each draft now has four total images including the hero.
- Kept each article in `draft` status.

## Research source

Primary keyword and roadmap decisions came from:

- `docs/seo/implementation/future-article-roadmap-live-semrush-2026-07-25.csv`

Rows used:

- Article 09 row: primary `how to broadcast on whatsapp`, UK volume 110, KD 14, informational intent.
- Article 14 row: primary `whatsapp business message template`, US volume 110, KD 20, informational intent.
- Article 18 row: primary `whatsapp bericht plannen`, NL volume 590, KD 16, informational intent.
- Article 20 row: primary `whatsapp message for event invitation`, IN volume 49500, KD 13, informational intent.

Metrics are preserved from the approved research files and should be treated as previously researched values, not newly revalidated live metrics.

## Current internet and competitor review

The rewrite used current official documentation and competitor-style coverage to improve completeness:

- Article 09 reviewed official WhatsApp broadcast-list/business-broadcast guidance plus current broadcast guides from CRM and WhatsApp marketing vendors. The improved draft covers not only list creation but consent, segmentation, exclusions, templates, send windows, reply assignment, and post-send metrics.
- Article 14 reviewed Meta template category/component documentation and current template-approval guides. The improved draft explains categories, components, approval basics, governance, examples, and workflow usage.
- Article 18 reviewed Dutch scheduled-message search results and business scheduling guidance. The improved draft clarifies the difference between personal scheduling, app-based approaches, CRM workflows, templates, and team follow-up.
- Article 20 reviewed event invitation and RSVP guides. The improved draft adds message anatomy, timing, segmentation, RSVP workflow, reminders, reply handling, analytics, and examples.

## Draft files updated

- `content/blog-drafts/article-09-how-to-broadcast-on-whatsapp.json`
- `content/blog-drafts/article-09-how-to-broadcast-on-whatsapp.md`
- `content/blog-drafts/article-14-whatsapp-business-message-template.json`
- `content/blog-drafts/article-14-whatsapp-business-message-template.md`
- `content/blog-drafts/article-18-whatsapp-bericht-plannen.json`
- `content/blog-drafts/article-18-whatsapp-bericht-plannen.md`
- `content/blog-drafts/article-20-whatsapp-event-invitation-messages.json`
- `content/blog-drafts/article-20-whatsapp-event-invitation-messages.md`

## Fresh images added

Existing hero images retained:

- `public/hostiko-crm/generated/blog/talk-wagon-how-to-broadcast-on-whatsapp-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-message-template-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-event-invitation-messages-hero.webp`

New Article 09 body images:

- `public/hostiko-crm/generated/blog/talk-wagon-broadcast-audience-preflight.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-broadcast-template-review.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-broadcast-delivery-replies.webp`

New Article 14 body images:

- `public/hostiko-crm/generated/blog/talk-wagon-template-anatomy-editor.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-template-category-decision-tree.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-template-governance-approval.webp`

New Article 18 body images:

- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-methoden.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-workflow.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-campagne.webp`

New Article 20 body images:

- `public/hostiko-crm/generated/blog/talk-wagon-event-invitation-builder.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-event-rsvp-reminder-workflow.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-event-campaign-analytics.webp`

All new body images were generated as fresh TalkWagon-style visuals, converted to 1600x900 WebP, and compressed below 150 KB each.

## Publishing safety

The drafts use the existing safe script:

- `scripts/upsert-managed-blog-draft.mjs`

The script only accepts metadata with `status: "draft"`, writes `published_at: null`, and refuses to replace an already published article with a draft.

## Link policy

No bottom `Sources` or `References` sections were added. Official, public, and internal links are integrated naturally inside relevant sentences.

## Tests updated

Updated:

- `src/lib/seo/article-09-14-18-20-managed-drafts.test.ts`

The test now verifies:

- all four articles remain drafts;
- approved keyword ownership is preserved;
- hero image assets are optimized WebP files;
- each article includes at least three body WebP images in addition to the hero;
- top-of-article manual TOC sections do not reappear;
- bottom source-link dumps are not present;
- drafts remain excluded from public static blog registry and sitemap.

## Protected systems

No changes were made to authentication, payments, checkout, pricing logic, WhatsApp credentials, webhooks, broadcast worker logic, database migrations, scheduler configuration, AI chatbot, RAG, or CRM protected backend systems.
