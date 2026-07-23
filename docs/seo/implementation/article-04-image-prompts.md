# Article 04 Image Prompts — WhatsApp Commerce Explained

## Stage A status

Article 04 is not implemented yet. This file prepares the image-generation package only.

Upload the generated source images to:

`D:\Projects\wacrm-production-dev\article-04-images`

After upload, the next stage should visually inspect every image, remove visible AI model branding if needed, preserve originals unchanged, convert the approved images to optimized WebP, and place them contextually in Article 04.

## Article 04 selection

- Proposed article: `WhatsApp Commerce: What It Is and How It Works`
- Proposed URL: `/blog/whatsapp-commerce-explained`
- Primary keyword: `whatsapp commerce`
- Search intent: informational-commercial explainer for businesses trying to understand how WhatsApp can support catalog browsing, customer questions, order conversations, compliant commerce workflows, and CRM follow-up.
- Planned length: 3,000–3,600 words.

## Research-source record

Metrics are previously researched; not currently revalidated.

| Keyword | Role | Source | Row/reference | Previously researched data |
|---|---|---|---|---|
| `whatsapp commerce` | Primary | `docs/seo/lovable-import/v2.1-authoritative/talkwagon-codex-keyword-input-v2.1.csv` | Row 9 | US / `us`, English, volume 320, KD 14, CPC 7.42, commercial, strict, secondary on `/use-cases/sales` |
| `whatsapp commerce` | Primary validation | `docs/seo/lovable-import/v2.1-authoritative/talkwagon-strict-opportunities-v2.1.csv` | Row 5 | US / `us`, English, volume 320, KD 14, CPC 7.42, strict opportunity |
| `whatsapp commerce` | Corrected metric reference | `docs/seo/lovable-import/v2.1-authoritative/talkwagon-v2-to-v2.1-changelog.md` | Table row for `whatsapp commerce` | Legacy 720 / KD 14 corrected to 320 / KD 14 |
| `whatsapp-commerce-explained` | Article topic source | `docs/seo/lovable-import/v2-legacy-reference/talkwagon-validated-blog-topics.csv` | Row 5 | Legacy article plan. Use topic only; do not use legacy volume as authoritative because V2.1 corrected it. |
| `whatsapp shop` | Supporting phrase | `docs/seo/lovable-import/v2-legacy-reference/talkwagon-validated-blog-topics.csv` | Row 5 | Supporting phrase only; no current revalidation. |
| `whatsapp catalog` | Supporting phrase | `docs/seo/lovable-import/v2-legacy-reference/talkwagon-validated-blog-topics.csv` | Row 5 | Supporting phrase only; no current revalidation. |

## Cannibalization conclusion

V2.1 explicitly removes or merges the planned `whatsapp team inbox`, `whatsapp automation`, `whatsapp sales`, and `whatsapp newsletter` blog topics into their feature/use-case pages. It also defers a `whatsapp api pricing` blog. `whatsapp commerce` is not listed as a removed blog conflict in `talkwagon-cannibalization-resolution-v2.1.csv`, but V2.1 maps it as a secondary term for `/use-cases/sales`.

Therefore Article 04 should avoid becoming a duplicate sales landing page. It should be an educational explainer that answers “what is WhatsApp commerce, how does it work, what are the parts, what should a business prepare, and how does it connect to CRM workflows?” The article should link to `/use-cases/sales` as the commercial next step, not replace it.

## Competitor and source coverage reviewed

Sources checked on 2026-07-24:

- CM.com — `https://www.cm.com/glossary/what-is-whatsapp-commerce/`
- Infobip — `https://www.infobip.com/blog/the-whatsapp-ecommerce-customer-journey`
- Umnico — `https://umnico.com/blog/whatsapp-commerce/`
- Insider — `https://insiderone.com/end-to-end-conversational-buying-experiences-with-whatsapp-commerce/`
- SleekFlow — `https://sleekflow.io/en-us/blog/whatsapp-business-catalog`
- Gallabox — `https://gallabox.com/blog/whatsapp-commerce-policy`
- Official WhatsApp policy reference — `https://whatsappbusiness.com/policy/`
- Official WhatsApp catalog reference — `https://faq.whatsapp.com/405903568419894`
- Official WhatsApp catalog setup reference — `https://faq.whatsapp.com/833697274483076`

Observed competitor coverage:

- Most competitor pages explain WhatsApp commerce as conversational shopping or end-to-end buying inside WhatsApp.
- Several cover catalogs, product discovery, automated replies, carts, payments, and customer support.
- Many pages are either broad and vendor-centric or too focused on their own catalog integration.
- The TalkWagon article should be more practical: define the concept, separate app catalog vs platform workflows, explain compliant commerce policies, map the customer journey, show where CRM records and handoffs matter, and provide a launch checklist without claiming Meta endorsement.

## Proposed Article 04 outline

1. Hero: What WhatsApp commerce means for a real business.
2. Definition: WhatsApp commerce vs WhatsApp marketing vs WhatsApp support.
3. Core building blocks:
   - Business profile
   - Catalog or product/service list
   - Customer conversation
   - Approved templates where needed
   - Team inbox and contact history
   - Automation and human handoff
   - Order, payment, delivery, and support follow-up
4. Customer journey:
   - Discovery
   - Product question
   - Recommendation
   - Cart or order conversation
   - Payment direction
   - Confirmation
   - Delivery or appointment update
   - Repeat purchase or support
5. WhatsApp catalog explained:
   - What catalogs are
   - When catalogs are enough
   - When a CRM or platform workflow is needed
6. Policy and compliance:
   - Commerce policy
   - Prohibited/restricted items
   - Responsible transaction terms
   - Opt-in and quality expectations
7. WhatsApp commerce for small teams:
   - Assign ownership
   - Keep customer context visible
   - Use tags, stages, and reminders
   - Avoid losing leads in personal chats
8. Examples by business type:
   - Local services
   - Ecommerce
   - Clinics or appointment businesses
   - Agencies
   - Education/course providers
   - B2B services
9. Common mistakes:
   - Treating WhatsApp like a spam channel
   - Mixing support and sales ownership
   - No catalog maintenance
   - No handoff path
   - No clear payment/refund terms
10. TalkWagon angle:
    - Shared team inbox
    - Contacts and pipeline
    - Approved broadcasts
    - Automation flows
    - AI chatbot from approved knowledge
    - Human handoff
11. Launch checklist.
12. FAQs.
13. Conclusion and next steps.

## Image generation rules

Use Gemini Pro or the user's chosen image model. Generate 16:9 images, ideally 1600×900 or larger, with a professional SaaS/editorial style. Every prompt below must include:

- TalkWagon logo visible naturally in the interface or dashboard header.
- Dark forest-green and emerald TalkWagon style.
- USA-style dummy people/customer names and realistic dummy messages where dashboards appear.
- No WhatsApp or Meta official logo.
- No third-party logos.
- No fake real customer data.
- No watermarks, Gemini sparkle marks, model branding, or signature marks.
- No distorted text; keep UI text minimal, clean, and readable.
- No placeholder-only dashboards; use realistic dummy names, statuses, and messages.

## Gemini Pro image prompts

### 1. Hero image — WhatsApp commerce CRM journey

Create a premium 16:9 SaaS editorial hero image for TalkWagon CRM about WhatsApp commerce. Show a dark forest-green TalkWagon dashboard with the TalkWagon logo in the top-left, a shared customer inbox on the left, a product/service catalog panel in the center, and a sales pipeline/order follow-up panel on the right. Use USA dummy customer names such as Sarah Miller, David Brooks, Emily Carter, and Michael Reed. Include short realistic dummy messages like “Is this item available?”, “Can I get delivery by Friday?”, and “Please send the payment link.” Use emerald green active states and subtle amber highlights. Professional lighting, rounded cards, soft shadows, clean readable UI, no official WhatsApp or Meta logo, no watermarks, no placeholder text.

### 2. Definition image — commerce, support, and marketing are connected but different

Create a 16:9 educational SaaS diagram-style image in TalkWagon branding. Show three connected dark-green dashboard cards labeled Commerce, Support, and Marketing, with arrows moving between product questions, order updates, and follow-up campaigns. Include the TalkWagon logo on the dashboard header. Use realistic USA dummy data: “Sarah Miller — Product question”, “James Wilson — Delivery update”, “Olivia Brown — Repeat order”. Clean modern interface, emerald highlights, amber labels, professional visual hierarchy, no third-party logos, no watermark, no fake statistics.

### 3. Customer journey image — from question to order follow-up

Create a 16:9 polished motion-inspired dashboard still showing a WhatsApp commerce customer journey inside TalkWagon. Use a horizontal sequence of cards: Ask Question → Recommend Product → Confirm Details → Payment Direction → Delivery Follow-Up → Human Handoff. Show small animated-style arrows and CRM cards moving through the stages. TalkWagon logo visible. USA dummy names and messages only: “Brian Adams asks about size”, “Jessica Lee requests pickup time”, “Chris Parker needs invoice help.” Dark forest-green UI, emerald action buttons, subtle amber stage badges, readable English UI, no official WhatsApp/Meta logos.

### 4. Catalog workflow image — catalog plus conversation context

Create a 16:9 professional SaaS dashboard image showing TalkWagon with a product/service catalog panel connected to a live customer conversation. The dashboard should show the TalkWagon logo, a catalog list with generic items like “Starter service package”, “Premium consultation”, “Monthly care plan”, and a customer thread with USA dummy names. Include context cards for contact history, tags, and next step. Use dark forest-green background, white content panels, emerald accents, amber status chips, high contrast and readable UI. No real brand logos besides TalkWagon, no model watermark.

### 5. Compliance and policy image — commerce safety checklist

Create a 16:9 editorial SaaS image for a WhatsApp commerce policy and readiness checklist. Show a TalkWagon dashboard with a checklist card titled “Commerce readiness” and items such as “Allowed products checked”, “Customer opt-in confirmed”, “Clear payment terms”, “Refund policy saved”, “Human handoff ready”. Use USA dummy workspace data, no real customer info. Dark green CRM style, emerald checkmarks, amber caution accents, clean layout, no official WhatsApp/Meta logos, no legal scare imagery, no watermark.

### 6. Team inbox image — multiple agents managing commerce conversations

Create a 16:9 polished TalkWagon CRM dashboard image showing a team inbox for commerce conversations. Include the TalkWagon logo. Show agent assignment cards with USA dummy agents: “Amanda Cooper — Sales”, “Daniel Harris — Support”, “Rachel Green — Orders”. Customer messages should be realistic and short: “Can I change my order?”, “Do you have this in blue?”, “I need tracking info.” Show assignment, tags, contact notes, and handoff state. Dark forest-green interface, emerald active card borders, amber priority marker, no official WhatsApp/Meta logos, no watermark.

### 7. Automation image — commerce follow-up workflow

Create a 16:9 TalkWagon automation-flow dashboard image for a commerce follow-up workflow. Show visual nodes connected with lines: New product question, Wait 15 minutes, If customer replies, Tag interested, Send approved follow-up, Assign to sales, Human handoff. Include TalkWagon logo in the app frame, USA dummy labels/messages, emerald nodes, amber condition node, dark forest-green canvas with subtle grid. Professional SaaS UI, readable node labels, no third-party logos, no watermark.

### 8. Analytics image — commerce performance without fake claims

Create a 16:9 TalkWagon dashboard image showing safe operational analytics for commerce conversations, without fake performance claims. Use neutral cards like “Open conversations”, “Assigned orders”, “Follow-ups due”, “Team response queue”, with small trend visuals but no unrealistic numbers. Include USA dummy customer list and TalkWagon logo. Dark forest-green and emerald UI, amber warning for overdue follow-up, white cards, professional SaaS lighting, no official WhatsApp/Meta logos, no watermark.

### 9. Examples by business type image — commerce works beyond ecommerce

Create a 16:9 editorial illustration/dashboard hybrid for TalkWagon showing WhatsApp commerce use cases across business types. Include dashboard cards for Local service, Ecommerce store, Clinic booking, Course provider, Agency, and B2B service. Each card should show a short realistic dummy customer request from USA names, not placeholder text. TalkWagon logo visible, dark forest-green background, emerald accents, amber highlights, polished SaaS style, no official WhatsApp or Meta logo, no watermark.

### 10. Checklist image — launch checklist for a small team

Create a 16:9 clean SaaS checklist image for Article 04 conclusion. Show a TalkWagon dashboard with a launch checklist: “Catalog ready”, “Replies reviewed”, “Team assigned”, “Payment instructions saved”, “Follow-up workflow active”, “Handoff route tested”. Include USA dummy workspace name “Northstar Services” and dummy team members, with TalkWagon logo in the header. Dark forest-green CRM theme, emerald checks, amber caution note, rounded cards, high contrast, no fake metrics, no third-party logos, no watermark.

## Preferred final article image mapping

- Hero: Prompt 1
- Definition section: Prompt 2
- Customer journey section: Prompt 3
- Catalog section: Prompt 4
- Policy section: Prompt 5
- Team workflow section: Prompt 6
- Automation section: Prompt 7
- Analytics or checklist section: Prompt 8 or Prompt 10

Generate all 10 if possible. If time is limited, generate prompts 1–8 first.
