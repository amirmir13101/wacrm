# Article 05 Changed Files

## Application files

- `src/app/blog/integrating-whatsapp-with-crm/page.tsx`
  - New Article 05 route.
  - Adds metadata, canonical, BlogPosting JSON-LD, Breadcrumb JSON-LD, FAQPage JSON-LD, hero, table of contents, article body, images, sources, FAQs, and internal links.

- `src/lib/marketing/blog.ts`
  - Adds Article 05 to the public blog index data.
  - Adds title, description, excerpt, keyword metadata, historical research notes, image metadata, date, reading time, and canonical URL.

- `src/app/sitemap.ts`
  - Adds `/blog/integrating-whatsapp-with-crm` to the sitemap.

- `src/app/blog/whatsapp-business-greeting-message-examples/page.tsx`
  - Adds a contextual reciprocal link to Article 05.

- `src/app/blog/whatsapp-away-message-examples/page.tsx`
  - Adds a contextual reciprocal link to Article 05.

- `src/app/blog/whatsapp-business-quick-replies/page.tsx`
  - Adds Article 05 to related internal links.

- `src/app/blog/whatsapp-commerce-explained/page.tsx`
  - Adds Article 05 to related internal links.

- `src/lib/seo/article-05-whatsapp-crm-integration.test.ts`
  - Adds source-level regression tests for Article 05 metadata, H1 count, schema, images, sitemap, blog index, internal links, and cannibalization boundaries.

## Image files

Final optimized images added to `public/hostiko-crm/generated/blog/`:

- `talk-wagon-whatsapp-crm-integration-hero.webp`
- `talk-wagon-whatsapp-crm-integration-options.webp`
- `talk-wagon-whatsapp-crm-data-mapping.webp`
- `talk-wagon-whatsapp-webhook-crm-events.webp`
- `talk-wagon-whatsapp-crm-team-ownership.webp`
- `talk-wagon-whatsapp-crm-automation-handoff.webp`
- `talk-wagon-whatsapp-crm-template-opt-in-checklist.webp`
- `talk-wagon-whatsapp-crm-integration-testing.webp`
- `talk-wagon-whatsapp-crm-integration-analytics.webp`
- `talk-wagon-whatsapp-crm-integration-launch-checklist.webp`

All final WebP files are 1600×900 and under 150 KB.

## Documentation files

- `docs/seo/implementation/article-05-topic-brief.md`
  - Records topic selection, keyword source rows, cannibalization conclusion, and proposed outline.

- `docs/seo/implementation/article-05-image-prompts.md`
  - Stores the 10 image prompts used for manual generation.

- `docs/seo/implementation/article-05-keyword-validation.csv`
  - Records exact local research rows and historical keyword metrics.

- `docs/seo/implementation/article-05-sources.csv`
  - Records official/source and competitor references used for the article.

- `docs/seo/implementation/article-05-competitor-analysis.md`
  - Summarizes competitor coverage and the TalkWagon content gap.

- `docs/seo/implementation/article-05-report.md`
  - Records implementation summary, image handling, internal links, validation, and protected-system confirmation.

- `docs/seo/implementation/article-05-image-review-contact-sheet.png`
  - Visual contact sheet of final optimized Article 05 images.

## Validation evidence

- Focused Article 01–05 SEO tests: passed, 5 files, 27 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 22 existing warnings and 0 errors.
- `npm test`: passed, 117 files, 831 tests.
- `npm run build`: passed.
- `git diff --check`: passed with Git line-ending warnings only.

## Local route smoke checks

Checked with local production server on port 3025:

- `/blog`: 200
- `/blog/integrating-whatsapp-with-crm`: 200
- `/blog/whatsapp-business-greeting-message-examples`: 200
- `/blog/whatsapp-away-message-examples`: 200
- `/blog/whatsapp-business-quick-replies`: 200
- `/blog/whatsapp-commerce-explained`: 200
- `/sitemap.xml`: 200
- Article 05 H1 count: 1
- Article 05 JSON-LD: present
- Article 05 canonical: present
- Blog index contains Article 05: yes
- Sitemap contains Article 05: yes
- All 10 Article 05 images return 200 as `image/webp`.

## Excluded files

Not intended for commit unless explicitly requested:

- Original uploaded files in `article-05-images/`
- Pre-existing untracked Article 01–04 review artifacts
- Pre-existing research folders and unrelated docs/assets
- Environment files, secrets, logs, or deployment configuration
