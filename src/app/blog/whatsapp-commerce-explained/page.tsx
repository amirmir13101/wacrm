import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Boxes,
  Clock3,
  CreditCard,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  Workflow,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import { getBlogArticle } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

function getArticleOrThrow() {
  const found = getBlogArticle("whatsapp-commerce-explained");
  if (!found) {
    throw new Error("Article data missing: whatsapp-commerce-explained");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  definition: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-definition.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon diagram showing commerce, support, and marketing as separate but connected WhatsApp customer workflows",
    caption:
      "WhatsApp commerce connects product discovery, support, and follow-up, but each workflow still needs its own rules and owner.",
  },
  journey: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-customer-journey.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing a WhatsApp commerce journey from customer question to recommendation, payment direction, delivery follow-up, and handoff",
    caption:
      "A strong commerce journey keeps the next step visible, so a customer is not left waiting between enquiry, payment, delivery, and support.",
  },
  catalog: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-catalog-workflow.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing a WhatsApp Business catalog beside a live customer conversation and contact context cards",
    caption:
      "A catalog helps customers browse products or services, but the conversation still needs context, notes, and a clear follow-up path.",
  },
  policy: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-policy-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon commerce readiness checklist for allowed products, opt-in, payment terms, refund policy, and human handoff",
    caption:
      "Before selling through chat, businesses should check product eligibility, consent, payment wording, policies, and escalation paths.",
  },
  team: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-team-inbox.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon team inbox for WhatsApp commerce conversations with sales, support, and orders agents assigned to customer threads",
    caption:
      "Commerce conversations often move between sales, support, and orders. A shared inbox helps the team avoid losing ownership.",
  },
  automation: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-automation-flow.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon automation flow for WhatsApp commerce follow-up with product question, wait step, condition, tag, sales assignment, and human handoff",
    caption:
      "Automation should handle repeatable routing and follow-up steps while still giving customers a clear human handoff route.",
  },
  analytics: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-analytics.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon commerce operations dashboard showing open conversations, assigned orders, follow-ups due, and team response queue",
    caption:
      "Operational views should focus on queue health, assignment, and follow-up work rather than fake performance promises.",
  },
  examples: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-business-examples.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing WhatsApp commerce examples for local service, ecommerce store, clinic booking, course provider, agency, and B2B service",
    caption:
      "WhatsApp commerce is broader than ecommerce. Any business that answers buying questions in chat needs a repeatable workflow.",
  },
  checklist: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-commerce-launch-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon launch checklist for WhatsApp commerce with catalog ready, replies reviewed, team assigned, payment instructions saved, follow-up workflow active, and handoff route tested",
    caption:
      "Launch only when the catalog, replies, team roles, payment wording, follow-up workflow, and handoff route are ready.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const journeySteps = [
  {
    title: "Discovery",
    detail:
      "A customer finds the business through the website, a QR code, an ad, a referral, a catalog link, or an existing conversation.",
  },
  {
    title: "Enquiry",
    detail:
      "The customer asks about availability, price, delivery, booking slots, service fit, or the difference between options.",
  },
  {
    title: "Selection",
    detail:
      "The business shares catalog items, product details, service packages, images, or a short recommendation based on the customer's need.",
  },
  {
    title: "Order direction",
    detail:
      "The team confirms what the customer wants, clarifies terms, and gives the next safe step for checkout, invoice, booking, or manual payment.",
  },
  {
    title: "Updates",
    detail:
      "The customer receives confirmation, delivery, appointment, or service-progress messages when those updates are accurate and allowed.",
  },
  {
    title: "Support and repeat business",
    detail:
      "After the sale, the same conversation can continue into support, returns, questions, renewals, and future follow-up.",
  },
] as const;

const buildingBlocks = [
  {
    icon: Boxes,
    title: "Business profile and catalog",
    copy:
      "A clear profile and catalog make it easier for customers to understand what you offer before the conversation becomes long.",
  },
  {
    icon: MessageSquareText,
    title: "Conversation context",
    copy:
      "The buying journey happens in messages. Agents need the customer question, previous replies, order notes, and next step in one place.",
  },
  {
    icon: UsersRound,
    title: "Team ownership",
    copy:
      "Commerce chats can involve sales, billing, operations, support, and management. Someone must own each handoff.",
  },
  {
    icon: Workflow,
    title: "Automation with restraint",
    copy:
      "Automations can tag, route, wait, and follow up, but sensitive buying decisions still need human review.",
  },
  {
    icon: CreditCard,
    title: "Safe payment communication",
    copy:
      "Payment instructions should be clear, but customers should never be asked to send passwords, OTPs, full card data, or verification codes in chat.",
  },
  {
    icon: ShieldCheck,
    title: "Policy and eligibility checks",
    copy:
      "Products and services must be eligible under WhatsApp commerce and messaging policies before a business promotes them through WhatsApp.",
  },
] as const;

const appVsPlatformRows = [
  {
    area: "Typical fit",
    app: "Small businesses that manage conversations from the WhatsApp Business app.",
    platform:
      "Teams that need multiple agents, integrations, approved templates, CRM context, automation, and reporting.",
  },
  {
    area: "Catalog workflow",
    app: "Create and manage catalog items in the app tools available to the business.",
    platform:
      "Connect catalog and product-message workflows through Meta Business assets and approved platform integrations.",
  },
  {
    area: "Team operation",
    app: "Best for simpler ownership where one or a few people handle messages directly.",
    platform:
      "Better suited for shared inboxes, assignment, permissions, routing, and audit-friendly follow-up.",
  },
  {
    area: "Automation",
    app: "Limited to app-level business tools such as greeting, away, and quick replies.",
    platform:
      "Can support structured workflow logic, approved template messaging, integrations, and handoff processes.",
  },
  {
    area: "Risk to manage",
    app: "Conversations can become hard to track as volume grows.",
    platform:
      "Requires correct setup, policy compliance, template quality, and responsible data handling.",
  },
] as const;

const examples = [
  {
    business: "Local service business",
    scenario:
      "A customer asks whether a repair service is available this week. The team checks location, service type, time window, and then books or hands off to the right person.",
  },
  {
    business: "Ecommerce store",
    scenario:
      "A shopper asks about size, color, delivery, and return terms. The team shares catalog items, confirms availability, and sends safe checkout instructions.",
  },
  {
    business: "Clinic or appointment team",
    scenario:
      "A patient asks about a service. The team explains the booking path and avoids collecting sensitive medical or payment credentials in chat.",
  },
  {
    business: "Course provider",
    scenario:
      "A lead asks about curriculum, schedule, price, and enrollment. The conversation becomes a qualification and follow-up workflow.",
  },
  {
    business: "Agency or B2B service",
    scenario:
      "A prospect asks which package fits their goal. The team gathers requirements, tags the lead, assigns a sales owner, and follows up after the proposal.",
  },
] as const;

const mistakes = [
  "Treating WhatsApp commerce as a bulk-spam channel instead of a permission-based customer conversation.",
  "Adding products or services before checking commerce policy and eligibility restrictions.",
  "Letting payment conversations happen without clear safety boundaries.",
  "Sending customers to different people without context or assignment history.",
  "Using automation to answer questions that require human judgment.",
  "Forgetting to update catalog items, prices, availability, delivery terms, and refund wording.",
  "Measuring only message volume instead of queue health, handoff quality, and follow-up completion.",
] as const;

const launchChecklist = [
  "Confirm that products or services are eligible under WhatsApp commerce and messaging policies.",
  "Prepare a clean catalog or service list with accurate descriptions, availability, and terms.",
  "Write safe replies for product questions, payment instructions, delivery updates, refunds, and handoff.",
  "Define who owns sales, support, order updates, billing questions, and escalations.",
  "Set rules for what information customers should never send in chat.",
  "Create tags, stages, or pipeline steps for open enquiries and follow-ups.",
  "Test the journey from first question to post-purchase support before inviting real traffic.",
] as const;

const faqs = [
  {
    question: "What is WhatsApp commerce?",
    answer:
      "WhatsApp commerce is the use of WhatsApp business messaging to help customers discover products or services, ask questions, browse catalog information, make buying decisions, receive payment or order instructions, and continue support or follow-up in the same conversation.",
  },
  {
    question: "Is WhatsApp commerce the same as an online store?",
    answer:
      "No. A traditional online store usually centers on a website checkout. WhatsApp commerce is more conversational: the customer may browse a catalog, ask questions, receive guidance, and complete the next step through a link, invoice, booking flow, or approved business process.",
  },
  {
    question: "What is a WhatsApp catalog?",
    answer:
      "A WhatsApp catalog is a business tool that lets a business showcase products or services so customers can browse items and ask questions inside WhatsApp. Catalog behavior and availability can vary by business setup, region, and the tools being used.",
  },
  {
    question: "Do all products qualify for WhatsApp commerce?",
    answer:
      "No. Businesses should review WhatsApp commerce and messaging policies before offering goods or services through WhatsApp. Some products, services, or transaction types may be restricted or prohibited.",
  },
  {
    question: "Should customers send card details or OTPs through WhatsApp?",
    answer:
      "No. A business should not ask customers to share passwords, OTPs, full payment-card numbers, verification codes, or other sensitive credentials in chat. Use secure payment links, invoices, or approved payment processes instead.",
  },
  {
    question: "Where does TalkWagon fit in a WhatsApp commerce workflow?",
    answer:
      "TalkWagon helps teams manage WhatsApp customer conversations, contacts, assignments, automations, visual flows, AI answers from approved knowledge, and human handoff. It supports the team workflow around commerce conversations rather than replacing a business's product, payment, or policy responsibilities.",
  },
] as const;

const sources = [
  {
    label: "WhatsApp Business Messaging Policy and Commerce Policy",
    href: "https://whatsappbusiness.com/policy/",
  },
  {
    label: "WhatsApp Help Center: about catalog",
    href: "https://faq.whatsapp.com/405903568419894",
  },
  {
    label: "WhatsApp Help Center: create and maintain a catalog",
    href: "https://faq.whatsapp.com/833697274483076",
  },
  {
    label: "Meta for Developers: catalogs overview",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/",
  },
  {
    label: "WhatsApp Business Platform overview",
    href: "https://whatsappbusiness.com/products/business-platform/",
  },
  {
    label: "WhatsApp Business Terms of Service",
    href: "https://www.whatsapp.com/legal/business-terms",
  },
] as const;

const title = article.seoTitle;
const description = article.description;
const canonicalUrl = article.canonicalUrl;

export const metadata: Metadata = {
  title,
  description,
  keywords: [article.primaryKeyword, ...article.secondaryKeywords],
  authors: [{ name: article.author }],
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "article",
    publishedTime: article.publishedDate,
    modifiedTime: article.updatedDate,
    authors: [article.author],
    images: [
      {
        url: article.image.src,
        width: article.image.width,
        height: article.image.height,
        alt: article.image.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [article.image.src],
  },
  robots: { index: true, follow: true },
};

function EditorialImage({ image, priority = false }: { image: ArticleImage; priority?: boolean }) {
  return (
    <figure className="my-12 overflow-hidden rounded-[30px] border border-[#dbe9e2] bg-white shadow-[0_24px_70px_rgba(7,19,14,0.1)]">
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        className="aspect-[16/9] w-full object-cover"
        priority={priority}
      />
      {"caption" in image ? (
        <figcaption className="border-t border-[#dbe9e2] bg-[#f7fbf8] px-5 py-4 text-sm leading-6 text-[#5b7169]">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SectionHeading({
  eyebrow,
  title,
  children,
  id,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly children?: ReactNode;
  readonly id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#07130e] sm:text-4xl">{title}</h2>
      {children ? <div className="mt-5 text-lg leading-8 text-[#315345]">{children}</div> : null}
    </section>
  );
}

export default function WhatsAppCommerceExplainedArticlePage() {
  return (
    <>
      <JsonLdScript
        id="article-04-blogposting-json-ld"
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description,
          image: getCanonicalUrl(article.image.src),
          datePublished: article.publishedDate,
          dateModified: article.updatedDate,
          author: {
            "@type": "Organization",
            name: article.author,
            url: getCanonicalUrl("/"),
          },
          publisher: {
            "@type": "Organization",
            name: "Talk Wagon",
            logo: {
              "@type": "ImageObject",
              url: getCanonicalUrl("/hostiko-crm/brand/talk-wagon-logo-public.png"),
            },
          },
          mainEntityOfPage: canonicalUrl,
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: article.title, url: article.path },
        ]}
      />
      <FaqJsonLd id="article-04-faq-json-ld" faqs={faqs} />
      <PublicHeader active="blog" />
      <main className="bg-[#f7fbf8] text-[#07130e]">
        <article>
          <header className="relative overflow-hidden bg-[#07130e] px-5 py-16 text-white sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(61,223,132,0.2),transparent_32%),linear-gradient(135deg,#07130e,#123226)]" />
            <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
              <div>
                <nav className="text-sm font-semibold text-[#d8fff1]" aria-label="Breadcrumb">
                  <Link href="/" className="hover:text-[#3ddf84]">
                    Home
                  </Link>
                  <span className="mx-2 text-[#7fb9a9]">/</span>
                  <Link href="/blog" className="hover:text-[#3ddf84]">
                    Blog
                  </Link>
                  <span className="mx-2 text-[#7fb9a9]">/</span>
                  <span>WhatsApp commerce</span>
                </nav>
                <h1 className="mt-8 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  WhatsApp Commerce: What It Is and How It Works
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  WhatsApp commerce is the use of WhatsApp business messaging to help customers
                  discover products or services, ask questions, browse catalog information, make
                  buying decisions, receive safe next steps, and continue support in the same
                  conversation.
                </p>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  This guide explains the customer journey, WhatsApp shop and catalog concepts,
                  Business App versus Business Platform workflows, policy considerations, and the
                  team processes that keep commerce conversations organized.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#d8fff1]">
                  <span>{article.author}</span>
                  <span aria-hidden="true">|</span>
                  <time dateTime={article.publishedDate}>Published July 24, 2026</time>
                  <span aria-hidden="true">|</span>
                  <span>{article.readingTime}</span>
                </div>
              </div>
              <EditorialImage image={articleImages.hero} priority />
            </div>
          </header>

          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[260px_1fr] lg:px-10">
            <aside className="hidden lg:block">
              <div className="sticky top-8 rounded-[26px] border border-[#dbe9e2] bg-white p-5 shadow-[0_18px_50px_rgba(7,19,14,0.08)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#08bba4]">In this guide</p>
                <ol className="mt-4 space-y-3 text-sm font-semibold text-[#315345]">
                  <li><a href="#definition" className="hover:text-[#08bba4]">What commerce means</a></li>
                  <li><a href="#journey" className="hover:text-[#08bba4]">Customer journey</a></li>
                  <li><a href="#catalog" className="hover:text-[#08bba4]">Catalog and shop</a></li>
                  <li><a href="#app-platform" className="hover:text-[#08bba4]">App vs Platform</a></li>
                  <li><a href="#team" className="hover:text-[#08bba4]">Team responsibilities</a></li>
                  <li><a href="#automation" className="hover:text-[#08bba4]">Automation and handoff</a></li>
                  <li><a href="#policy" className="hover:text-[#08bba4]">Policy and payments</a></li>
                  <li><a href="#examples" className="hover:text-[#08bba4]">Business examples</a></li>
                  <li><a href="#checklist" className="hover:text-[#08bba4]">Launch checklist</a></li>
                  <li><a href="#faqs" className="hover:text-[#08bba4]">FAQs</a></li>
                </ol>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6 text-lg leading-8 text-[#315345]">
                <p>
                  The simplest way to understand WhatsApp commerce is this: the chat becomes part
                  of the buying journey. A customer does not only send a support question. They may
                  ask what is available, compare options, request payment instructions, confirm an
                  order, ask about delivery, and come back for help later. The business needs a
                  workflow for all of that, not just a phone with incoming messages.
                </p>
              </div>

              <SectionHeading id="definition" eyebrow="Definition" title="What WhatsApp commerce means">
                <p>
                  WhatsApp commerce is not one single button or one single feature. It is a set of
                  business messaging practices that help a customer move from interest to decision
                  through WhatsApp. For some businesses, that may be as simple as a catalog and a
                  person answering questions. For larger teams, it may include approved templates,
                  platform integrations, contact records, automated routing, and a shared inbox.
                </p>
                <p className="mt-5">
                  It is also different from plain marketing. Marketing may bring the customer into
                  the conversation, but commerce has to answer practical buying questions: what is
                  available, what does it cost, what are the terms, how does payment work, when
                  will the customer receive the product or service, and who helps if something goes
                  wrong?
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.definition} />

              <div className="grid gap-4 sm:grid-cols-2">
                {buildingBlocks.map((block) => {
                  const Icon = block.icon;
                  return (
                    <section key={block.title} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfff6] text-[#08bba4]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="text-lg font-extrabold text-[#07130e]">{block.title}</h3>
                      </div>
                      <p className="mt-4 leading-7 text-[#315345]">{block.copy}</p>
                    </section>
                  );
                })}
              </div>

              <SectionHeading id="journey" eyebrow="Journey" title="How a WhatsApp commerce customer journey works">
                <p>
                  A useful commerce journey is not just “customer asks, business replies.” It is a
                  chain of decisions and handoffs. Each step should make the next step clearer for
                  the customer and easier for the team to track.
                </p>
              </SectionHeading>

              <div className="mt-8 grid gap-4">
                {journeySteps.map((step, index) => (
                  <section key={step.title} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3ddf84] text-sm font-extrabold text-[#07130e]">
                        {index + 1}
                      </span>
                      <h3 className="text-xl font-extrabold text-[#07130e]">{step.title}</h3>
                    </div>
                    <p className="mt-4 leading-7 text-[#315345]">{step.detail}</p>
                  </section>
                ))}
              </div>

              <EditorialImage image={articleImages.journey} />

              <SectionHeading id="catalog" eyebrow="Catalog" title="WhatsApp shop and catalog concepts">
                <p>
                  Many people use “WhatsApp shop” casually to describe selling through WhatsApp.
                  The more precise concept is the WhatsApp Business catalog: a way for a business
                  to showcase products or services so customers can browse and ask about them.
                  Official catalog features can include product or service details and collections,
                  depending on the business setup and available tools.
                </p>
                <p className="mt-5">
                  A catalog is helpful because it reduces repeated explanations. Instead of typing
                  the same product list in every chat, the business can point customers to a
                  structured set of items. But a catalog is not a full operating system. The team
                  still needs to confirm availability, handle questions, explain delivery or
                  service terms, and keep conversation history organized.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.catalog} />

              <div className="overflow-x-auto rounded-[24px] border border-[#dbe9e2] bg-white">
                <table className="min-w-[780px] text-left text-sm">
                  <thead className="bg-[#ecfff6] text-[#07130e]">
                    <tr>
                      <th className="px-5 py-4 font-extrabold">Approach</th>
                      <th className="px-5 py-4 font-extrabold">What it is good for</th>
                      <th className="px-5 py-4 font-extrabold">What still needs process</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                    <tr>
                      <td className="px-5 py-4 font-extrabold text-[#07130e]">Catalog-assisted chat</td>
                      <td className="px-5 py-4">Helping customers browse items or services before asking questions.</td>
                      <td className="px-5 py-4">Availability, pricing context, delivery terms, and handoff ownership.</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-4 font-extrabold text-[#07130e]">Traditional ecommerce checkout</td>
                      <td className="px-5 py-4">Structured self-service purchase flows on a website or app.</td>
                      <td className="px-5 py-4">Pre-sale questions, special requests, post-purchase support, and abandoned conversations.</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-4 font-extrabold text-[#07130e]">CRM-supported commerce</td>
                      <td className="px-5 py-4">Keeping the customer, conversation, assignment, and follow-up in one workspace.</td>
                      <td className="px-5 py-4">Correct product data, safe payment handling, and policy-compliant messaging.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <SectionHeading id="app-platform" eyebrow="Setup choices" title="WhatsApp Business App versus WhatsApp Business Platform workflows">
                <p>
                  The WhatsApp Business app and WhatsApp Business Platform are not the same
                  operating model. The app is often enough for simpler owner-led communication.
                  The platform is built for more advanced business messaging, integrations,
                  approved templates, and systems that need multiple users or software workflows.
                </p>
              </SectionHeading>

              <div className="mt-8 overflow-x-auto rounded-[24px] border border-[#dbe9e2] bg-white">
                <table className="min-w-[820px] text-left text-sm">
                  <thead className="bg-[#ecfff6] text-[#07130e]">
                    <tr>
                      <th className="px-5 py-4 font-extrabold">Area</th>
                      <th className="px-5 py-4 font-extrabold">WhatsApp Business App</th>
                      <th className="px-5 py-4 font-extrabold">WhatsApp Business Platform</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                    {appVsPlatformRows.map((row) => (
                      <tr key={row.area}>
                        <td className="px-5 py-4 font-extrabold text-[#07130e]">{row.area}</td>
                        <td className="px-5 py-4">{row.app}</td>
                        <td className="px-5 py-4">{row.platform}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <SectionHeading id="team" eyebrow="Team inbox" title="Commerce conversations need clear team responsibilities">
                <p>
                  In a small business, one person may answer every message. As volume grows, that
                  breaks down. The same customer can ask a sales question, request a payment link,
                  ask for delivery information, and then need support. If each handoff happens in
                  someone&apos;s memory, the customer feels the gaps.
                </p>
                <p className="mt-5">
                  A WhatsApp team inbox helps by giving conversations an owner. Sales can qualify
                  the request, operations can handle order status, support can answer issues, and
                  a manager can review escalations. The point is not to make the workflow complex.
                  The point is to make responsibility visible.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.team} />

              <SectionHeading id="automation" eyebrow="Automation" title="Human-led conversations versus automation">
                <p>
                  Automation can improve a WhatsApp commerce workflow when it handles repeatable
                  structure: tagging a new product question, assigning a conversation, sending a
                  safe follow-up, waiting before a reminder, or routing a customer to the right
                  team. It becomes risky when it pretends to understand context that should be
                  reviewed by a person.
                </p>
                <p className="mt-5">
                  A practical rule: automate organization and low-risk next steps, but keep a
                  human path for pricing exceptions, refunds, complaints, sensitive details, and
                  anything that affects the customer&apos;s money, account, or access.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.automation} />

              <SectionHeading id="policy" eyebrow="Safety" title="Policy, eligibility, privacy, and payment communication">
                <p>
                  WhatsApp commerce must be built inside the rules of WhatsApp Business messaging
                  and commerce policies. Businesses should check whether their products or services
                  are allowed before promoting or selling them through WhatsApp. They should also
                  keep account information accurate and avoid messaging practices that create spam
                  or quality problems.
                </p>
                <p className="mt-5">
                  Payment communication needs special care. A business can explain payment steps
                  or send a secure payment link, invoice, or approved checkout route. It should not
                  ask customers to send passwords, OTPs, full payment-card information, bank login
                  details, verification codes, or private credentials through chat.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.policy} />

              <div className="rounded-[28px] border border-[#f2d27c] bg-[#fff9e8] p-6 text-[#5b4a1f]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="text-xl font-extrabold text-[#07130e]">Safe chat rule</h3>
                    <p className="mt-3 leading-7">
                      Use WhatsApp to guide the customer, not to collect sensitive credentials.
                      If a step involves payment, identity, or account access, direct customers to
                      a secure process and explain what information they should never share in chat.
                    </p>
                  </div>
                </div>
              </div>

              <SectionHeading id="examples" eyebrow="Examples" title="Practical WhatsApp commerce examples by business type">
                <p>
                  WhatsApp commerce is not only for ecommerce stores. Any business that discusses
                  services, availability, packages, appointments, or purchase decisions in chat can
                  benefit from a more organized commerce workflow.
                </p>
              </SectionHeading>

              <div className="mt-8 grid gap-5">
                {examples.map((example) => (
                  <section key={example.business} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                    <h3 className="text-xl font-extrabold text-[#07130e]">{example.business}</h3>
                    <p className="mt-3 leading-7 text-[#315345]">{example.scenario}</p>
                  </section>
                ))}
              </div>

              <EditorialImage image={articleImages.examples} />

              <SectionHeading id="talkwagon" eyebrow="TalkWagon workflow" title="Where TalkWagon fits">
                <p>
                  TalkWagon helps teams manage the operational layer around WhatsApp commerce:
                  shared inbox ownership, contact history, pipeline follow-ups, approved broadcast
                  workflows, automations, visual flows, AI answers from approved business
                  knowledge, and human handoff. It does not replace a business&apos;s responsibility
                  for accurate product data, payment security, policy compliance, or customer
                  service judgment.
                </p>
                <p className="mt-5">
                  If your team is already using WhatsApp for sales conversations, the commercial
                  next step is the <Link href="/use-cases/sales" className="font-bold text-[#087d68] underline-offset-4 hover:underline">WhatsApp sales workflow</Link>. If you are still setting up the customer-response layer, start with the{" "}
                  <Link href="/features/team-inbox" className="font-bold text-[#087d68] underline-offset-4 hover:underline">team inbox</Link>,{" "}
                  <Link href="/features/automation" className="font-bold text-[#087d68] underline-offset-4 hover:underline">automation</Link>, and{" "}
                  <Link href="/features/flows" className="font-bold text-[#087d68] underline-offset-4 hover:underline">visual flows</Link> pages.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.analytics} />

              <SectionHeading id="mistakes" eyebrow="Mistakes" title="Common WhatsApp commerce mistakes to avoid">
                <p>
                  Most commerce problems are not caused by WhatsApp itself. They come from unclear
                  ownership, outdated information, unsafe payment wording, or trying to automate
                  sensitive decisions too early.
                </p>
              </SectionHeading>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {mistakes.map((mistake) => (
                  <div key={mistake} className="rounded-[22px] border border-[#f2d27c] bg-[#fff9e8] p-5 leading-7 text-[#5b4a1f]">
                    {mistake}
                  </div>
                ))}
              </div>

              <SectionHeading id="checklist" eyebrow="Checklist" title="WhatsApp commerce launch checklist">
                <p>
                  Before you invite more customers into WhatsApp buying conversations, make sure
                  the workflow is ready. A small, reliable setup is better than a noisy channel
                  that no one owns.
                </p>
              </SectionHeading>

              <div className="mt-8 rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6">
                <ul className="grid gap-4">
                  {launchChecklist.map((item) => (
                    <li key={item} className="flex gap-3 leading-7 text-[#315345]">
                      <ListChecks className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <EditorialImage image={articleImages.checklist} />

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { href: "/blog/whatsapp-business-greeting-message-examples", label: "Greeting message examples" },
                  { href: "/blog/whatsapp-away-message-examples", label: "Away message examples" },
                  { href: "/blog/whatsapp-business-quick-replies", label: "Quick replies guide" },
                  { href: "/blog/integrating-whatsapp-with-crm", label: "WhatsApp CRM integration guide" },
                  { href: "/pricing", label: "TalkWagon pricing" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center justify-between rounded-[20px] border border-[#dbe9e2] bg-white p-4 font-bold text-[#07130e] transition hover:border-[#3ddf84]"
                  >
                    {link.label}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                ))}
              </div>

              <SectionHeading id="faqs" eyebrow="FAQs" title="Helpful FAQs about WhatsApp commerce" />

              <div className="mt-8 grid gap-4">
                {faqs.map((faq) => (
                  <section key={faq.question} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                    <h3 className="text-xl font-extrabold text-[#07130e]">{faq.question}</h3>
                    <p className="mt-3 leading-7 text-[#315345]">{faq.answer}</p>
                  </section>
                ))}
              </div>

              <SectionHeading eyebrow="Conclusion" title="Build the workflow before you scale the channel">
                <p>
                  WhatsApp commerce works best when the business treats the chat as a real
                  operating workflow. Catalogs help customers browse. Conversations help customers
                  decide. A team inbox keeps ownership clear. Automation keeps repeatable steps
                  moving. Human handoff protects the moments where judgment matters.
                </p>
                <p className="mt-5">
                  If your team wants to turn WhatsApp sales conversations into a more organized
                  process, start with the questions customers already ask every day. Then build
                  the catalog, replies, assignments, safety rules, follow-ups, and handoffs that
                  make those conversations easier to serve.
                </p>
              </SectionHeading>

              <div className="mt-10 rounded-[28px] border border-[#3ddf84]/35 bg-[#07130e] p-6 text-white">
                <div className="flex items-start gap-3">
                  <ShoppingCart className="mt-1 h-6 w-6 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                  <div>
                    <h2 className="text-2xl font-extrabold">Organize WhatsApp commerce conversations in one CRM workspace</h2>
                    <p className="mt-3 leading-7 text-[#d8fff1]">
                      TalkWagon helps growing teams manage WhatsApp conversations, contacts,
                      assignments, automations, visual flows, broadcasts, AI answers from approved
                      knowledge, and human handoff.
                    </p>
                    <Link
                      href="/use-cases/sales"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3ddf84] px-5 py-3 font-extrabold text-[#07130e] transition hover:bg-[#2acb73]"
                    >
                      Explore WhatsApp sales workflows
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>

              <section className="mt-12 border-t border-[#dbe9e2] pt-8">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Sources checked
                </div>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#315345]">
                  {sources.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} className="font-semibold text-[#087d68] underline-offset-4 hover:underline">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
