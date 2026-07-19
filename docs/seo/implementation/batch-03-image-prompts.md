# TalkWagon Batch 03 Hero Image Prompts

## Workflow and visual guardrails

- Generator: installed `higgsfield-generate` skill and authenticated Higgsfield CLI
- Final model: Nano Banana Pro (`nano_banana_pro`)
- Generation format: 4:3 at 2K
- Final delivery format: WebP, 1168 x 880 pixels
- Brand direction: dark forest green, emerald, white, pale mint, and restrained amber
- Reference-image inputs: none; existing TalkWagon generated assets and the current CRM UI style guide were inspected only for palette, depth, composition, dimensions, and naming conventions
- Safety review: every final image was inspected to reject readable generated text, logos, third-party branding, fake product UI, customer data, prices, statistics, and unsupported comparison claims
- Asset type: generated conceptual artwork, not a product screenshot

An initial generation attempt with a free-plan-compatible model was rejected because it introduced generated words and avatar-like details. After the authorized one-day trial became active, the three final assets were generated with Nano Banana Pro and visually reviewed before integration.

## `/use-cases/sales`

- Purpose: communicate the path from customer conversation through team assignment, contact context, lead progression, pipeline work, and follow-up
- Final filename: `talk-wagon-whatsapp-sales-workflow.webp`
- Source path: `public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-sales-workflow.webp`
- Dimensions: 1168 x 880 pixels
- Format: WebP
- File size: 46,042 bytes
- Alt text: `Conceptual Talk Wagon WhatsApp sales workflow with conversations, team assignment, follow-ups, and pipeline stages`
- Higgsfield workflow: Nano Banana Pro text-to-image generation through the installed `higgsfield-generate` skill
- Generation settings: aspect ratio `4:3`; resolution `2k`; batch size `1`; no reference image
- Full final prompt:

  > Create a premium 4:3 conceptual SaaS workflow illustration for Talk Wagon. Use a dark forest-green canvas, deep-green layered panels, emerald connectors, white and pale-mint cards, and subtle amber checkpoints. Visually communicate customer conversation, team assignment, contact context, five-stage lead progression, CRM pipeline, and follow-up loop through universal symbol-only icons and geometric paths. Polished vector plus soft 3D depth, balanced composition, crisp at mobile size. The complete image must contain no letters, words, numbers, logos, people, faces, avatars, statistics, charts, product screenshots, browser chrome, or third-party branding.

- Optimization: center-cropped from the generated 4:3 source to 1168 x 880, encoded as WebP at quality 80 with effort 6 and smart chroma subsampling; unnecessary metadata was not copied
- Review result: no readable text, logo, fake statistic, customer identity, phone number, or fake product screenshot

## `/use-cases/newsletter`

- Purpose: communicate an opted-in audience moving through consent, approval, preflight, queue, delivery-state, and shared-inbox reply stages
- Final filename: `talk-wagon-whatsapp-newsletter-workflow.webp`
- Source path: `public/hostiko-crm/generated/commercial/talk-wagon-whatsapp-newsletter-workflow.webp`
- Dimensions: 1168 x 880 pixels
- Format: WebP
- File size: 57,530 bytes
- Alt text: `Conceptual Talk Wagon WhatsApp newsletter workflow with an opt-in audience, approval checks, campaign queue, delivery status, and inbox replies`
- Higgsfield workflow: Nano Banana Pro text-to-image generation through the installed `higgsfield-generate` skill
- Generation settings: aspect ratio `4:3`; resolution `2k`; batch size `1`; no reference image
- Full final prompt:

  > Create a premium 4:3 conceptual SaaS workflow illustration for Talk Wagon. Use a dark forest-green canvas, deep-green layered panels, emerald paths, white and pale-mint surfaces, and subtle amber checkpoints. Show an opt-in audience as abstract circles flowing through a consent shield, an approved-template symbol, a checklist, an orderly campaign queue, delivery-state check icons, and a reply bubble returning to a shared inbox tray. Polished vector plus soft 3D depth, balanced composition, crisp at mobile size. The complete image must contain no letters, words, numbers, logos, people, faces, avatars, statistics, charts, product screenshots, browser chrome, spam imagery, or third-party branding.

- Optimization: center-cropped from the generated 4:3 source to 1168 x 880, encoded as WebP at quality 80 with effort 6 and smart chroma subsampling; unnecessary metadata was not copied
- Review result: no spam depiction, delivery guarantee, policy-bypass cue, fake analytics, readable text, or fake product screenshot

## `/wati-alternative`

- Purpose: present a neutral framework for evaluating inbox, broadcast, automation, cost layers, and workflow fit without depicting a competitor product
- Final filename: `talk-wagon-wati-alternative-evaluation.webp`
- Source path: `public/hostiko-crm/generated/commercial/talk-wagon-wati-alternative-evaluation.webp`
- Dimensions: 1168 x 880 pixels
- Format: WebP
- File size: 32,170 bytes
- Alt text: `Conceptual Talk Wagon evaluation of WhatsApp CRM inbox, broadcast, automation, cost, and workflow-fit considerations`
- Higgsfield workflow: Nano Banana Pro text-to-image generation through the installed `higgsfield-generate` skill
- Generation settings: aspect ratio `4:3`; resolution `2k`; batch size `1`; no reference image
- Full final prompt:

  > Create a neutral premium 4:3 SaaS evaluation illustration for Talk Wagon. Use a dark forest-green canvas with two balanced abstract workflow columns, a central evaluation checklist and scale, and symbol-only cards representing a team inbox, broadcasts, automation, layered costs, and workflow fit. Use emerald connectors, white and pale-mint panels, restrained amber highlights, polished vector plus soft 3D depth, balanced composition, and clarity at mobile size. The complete image must contain no letters, words, numbers, logos, people, faces, scores, prices, badges, product screenshots, browser chrome, competitor assets, comparison winners, trophies, or superiority symbols.

- Optimization: center-cropped from the generated 4:3 source to 1168 x 880, encoded as WebP at quality 80 with effort 6 and smart chroma subsampling; unnecessary metadata was not copied
- Review result: no WATI logo or interface, fake comparison score, price, superiority badge, trademarked visual asset, or unsupported winner claim

## Delivery confirmation

All three images are page-specific, visually distinct, optimized below 250 KB, and used consistently as the hero, Open Graph, and Twitter image for their assigned page. Their explicit 1168 x 880 dimensions remain compatible with the shared Next.js `Image` component and hero container.
