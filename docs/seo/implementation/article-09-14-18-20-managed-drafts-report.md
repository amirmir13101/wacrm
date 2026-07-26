# Articles 09, 14, 18, and 20 Managed Draft Report

## Scope

Four future SEO articles were prepared as admin-managed drafts only:

- Article 09: How to Broadcast on WhatsApp
- Article 14: WhatsApp Business Message Templates
- Article 18: Dutch scheduled-message guide
- Article 20: WhatsApp event invitation messages

These drafts are not code-published static articles and are intentionally excluded from the public static blog registry and sitemap until they are published from the admin dashboard.

## Research source

Primary keyword and roadmap decisions came from:

- `docs/seo/implementation/future-article-roadmap-live-semrush-2026-07-25.csv`

Rows used:

- Article 09 row: primary `how to broadcast on whatsapp`, UK volume 110, KD 14, informational intent.
- Article 14 row: primary `whatsapp business message template`, US volume 110, KD 20, informational intent.
- Article 18 row: primary `whatsapp bericht plannen`, NL volume 590, KD 16, informational intent.
- Article 20 row: primary `whatsapp message for event invitation`, IN volume 49500, KD 13, informational intent.

Metrics are preserved from the approved research files and were not reinterpreted as fresh live metrics during this implementation.

## Draft files created

- `content/blog-drafts/article-09-how-to-broadcast-on-whatsapp.json`
- `content/blog-drafts/article-09-how-to-broadcast-on-whatsapp.md`
- `content/blog-drafts/article-14-whatsapp-business-message-template.json`
- `content/blog-drafts/article-14-whatsapp-business-message-template.md`
- `content/blog-drafts/article-18-whatsapp-bericht-plannen.json`
- `content/blog-drafts/article-18-whatsapp-bericht-plannen.md`
- `content/blog-drafts/article-20-whatsapp-event-invitation-messages.json`
- `content/blog-drafts/article-20-whatsapp-event-invitation-messages.md`

## Fresh images created

- `public/hostiko-crm/generated/blog/talk-wagon-how-to-broadcast-on-whatsapp-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-business-message-template-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-bericht-plannen-hero.webp`
- `public/hostiko-crm/generated/blog/talk-wagon-whatsapp-event-invitation-messages-hero.webp`

All four images are new 1600x900 WebP assets, generated for these drafts, and not reused from previous articles.

## Publishing safety

The drafts use the existing safe script:

- `scripts/upsert-managed-blog-draft.mjs`

The script only accepts metadata with `status: "draft"`, writes `published_at: null`, and refuses to replace an already published article with a draft.

## Link policy

No bottom "Sources" or "References" sections were added. Official and internal links are integrated naturally inside relevant sentences.

## Protected systems

No changes were made to authentication, payments, checkout, pricing logic, WhatsApp credentials, webhooks, broadcast worker logic, database migrations, scheduler configuration, AI chatbot, RAG, or CRM protected backend systems.
