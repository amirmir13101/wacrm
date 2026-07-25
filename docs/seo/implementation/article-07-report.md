# Article 07 Draft Implementation Report

## Article decision

- Topic: best WhatsApp CRM software buyer evaluation
- Proposed public URL after admin publication: `/blog/best-whatsapp-crm`
- Status: `draft`
- Primary keyword: `best whatsapp crm`
- Live US volume/KD: `30 / 17`
- Search intent: commercial investigation
- Live supporting terms:
  - `crm whatsapp` — US 320 / KD 28
  - `whatsapp crm software` — US 50 / KD 25
  - `best crm with whatsapp integration` — US 50 / KD 9
- Metric source: current Semrush connector result queried July 25, 2026

## Why Article 07 is the correct next article

The live Semrush roadmap retains this as Article 07 with P2 priority. The earlier 13-article governed shortlist independently assigns the same topic and `/blog/best-whatsapp-crm` URL. This makes the topic stable across both planning layers while allowing the current live metrics to replace the historical values.

## Cannibalization control

The homepage owns the category term `whatsapp crm`. Article 07 is deliberately limited to commercial-investigation intent:

- buyer requirements;
- neutral platform orientation;
- real-workflow tests;
- total-cost evaluation;
- a 30-day proof-of-fit plan.

It does not present itself as the product-category homepage and does not use `whatsapp crm` as its primary keyword.

## Research

Current search coverage and official evidence were reviewed on July 25, 2026. The article compares TalkWagon, WATI, respond.io, Kommo, Interakt, SleekFlow, Trengo, and Zoko using their official product, pricing, or help pages. The comparison:

- does not declare a universal winner;
- dates volatile product and pricing observations;
- separates CRM subscription costs from WhatsApp/Meta messaging charges;
- directs buyers to validate plan-level limits and real workflows;
- includes an independence and trademark note.

Exact source URLs are recorded in `article-07-sources.csv`.

## Draft-only architecture

Article 07 is intentionally not added to:

- `src/lib/marketing/blog.ts`;
- the static sitemap;
- any code-managed public article route.

Instead, its reviewed source is stored under `content/blog-drafts/` and is inserted into the existing `blog_articles` table with:

- `status = draft`;
- `published_at = null`.

The public CMS repository selects only `status = published` rows with an eligible publication date. The admin preview remains available, and the owner can publish the draft later from the existing article manager.

## Content structure

- Neutral quick answer and buyer definition
- WhatsApp app/platform/CRM distinction
- Four-step evaluation framework
- Weighted criteria
- Eight-platform orientation table
- Shared inbox and contact-context test
- Contact-to-pipeline test
- Broadcast, consent, and campaign test
- Automation, AI, and human-handoff test
- Integrations and channel strategy
- Permissions and governance
- Total-cost model
- 30-day proof-of-fit plan
- TalkWagon fit and non-fit guidance
- Final buyer checklist
- Eight FAQs
- Current source list

## Images

Eight original generated PNGs remain outside the repository. Eight selected images were converted to 1600x900 WebP at production quality:

- `talk-wagon-best-whatsapp-crm-hero.webp`
- `talk-wagon-whatsapp-crm-buyer-requirements.webp`
- `talk-wagon-whatsapp-crm-evaluation-framework.webp`
- `talk-wagon-whatsapp-crm-shared-inbox-context.webp`
- `talk-wagon-whatsapp-crm-sales-pipeline-test.webp`
- `talk-wagon-whatsapp-crm-broadcast-controls.webp`
- `talk-wagon-best-whatsapp-crm-automation-handoff.webp`
- `talk-wagon-whatsapp-crm-total-cost-checklist.webp`

The hero uses eager/priority loading through the managed article component. Supporting markdown images use lazy loading.

## Validation

- Draft payload validation: passed.
- Focused Article 07 tests: 5 passed.
- Lint: passed with 0 errors and 22 pre-existing warnings.
- Typecheck: passed.
- Full test suite: 120 files and 847 tests passed.
- Production build: passed; 107 static pages generated.
- `git diff --check`: passed.
