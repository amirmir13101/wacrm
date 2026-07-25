import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  MessageSquareText,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import { getBlogArticle } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

function getArticleOrThrow() {
  const found = getBlogArticle("delightchat-alternative");
  if (!found) {
    throw new Error("Article data missing: delightchat-alternative");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  decisionMap: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-alternative-decision-map.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing a decision map for teams comparing DelightChat with a WhatsApp-first CRM",
    caption:
      "A useful comparison starts with product fit: Shopify-centered omnichannel support versus WhatsApp-first CRM workflows.",
  },
  featureComparison: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-feature-comparison.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon comparison workspace showing verified capability notes for DelightChat and WhatsApp CRM workflows",
    caption:
      "Evidence dates matter because public pricing, channels, and feature packaging can change between vendor pages.",
  },
  inboxModel: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-inbox-channel-model.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon shared inbox model comparing omnichannel support queues with WhatsApp CRM conversation ownership",
    caption:
      "DelightChat is built around ecommerce support channels. TalkWagon is designed around WhatsApp conversations becoming owned CRM work.",
  },
  shopifyPipeline: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-shopify-crm-pipeline.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon workflow showing Shopify order context beside CRM contacts and sales pipeline stages",
    caption:
      "The key decision is whether your team needs Shopify-native order context first, or CRM pipeline ownership around WhatsApp conversations first.",
  },
  pricingChecklist: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-pricing-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon total-cost checklist for comparing subscription price, WhatsApp charges, team seats, broadcasts, automation, and migration work",
    caption:
      "Do not compare only the subscription line. Include Meta charges, seats, usage limits, setup time, and the cost of changing team workflows.",
  },
  migration: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-migration-workflow.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon migration workflow showing contacts, templates, conversations, tags, pipeline stages, and team permissions moving into a CRM",
    caption:
      "A good migration plan protects customer context before any team switches tools.",
  },
  chooseFit: {
    src: "/hostiko-crm/generated/blog/talk-wagon-delightchat-choose-by-fit.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon choose-by-fit framework showing when to choose DelightChat and when to choose a WhatsApp-first CRM",
    caption:
      "The right answer is not universal. Choose the system that matches the way your team sells, supports, assigns, and follows up.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const comparisonRows = [
  {
    area: "Primary orientation",
    delightchat:
      "Shopify and D2C-focused omnichannel support with WhatsApp marketing, social channels, email, live chat, and ecommerce context.",
    talkwagon:
      "WhatsApp-first CRM for shared inbox ownership, contacts, pipelines, broadcasts, visual flows, AI knowledge answers, and permissions.",
  },
  {
    area: "Best-fit team",
    delightchat:
      "Ecommerce teams that want Shopify order context and multiple customer-support channels in one helpdesk-style workspace.",
    talkwagon:
      "Teams that mainly work from WhatsApp and need customer conversations organized into CRM follow-up, assignments, and sales workflows.",
  },
  {
    area: "Channels",
    delightchat:
      "Official pages describe WhatsApp, Instagram, Facebook, email, live chat, and related ecommerce support workflows.",
    talkwagon:
      "TalkWagon focuses on WhatsApp CRM workflows rather than becoming a broad omnichannel helpdesk.",
  },
  {
    area: "Sales pipeline",
    delightchat:
      "Useful where ecommerce support, order conversations, broadcasts, and Shopify context drive the workflow.",
    talkwagon:
      "Includes contact records and pipeline-style follow-up so WhatsApp enquiries can move through sales stages.",
  },
  {
    area: "Automation",
    delightchat:
      "Official docs describe automated replies, campaign workflows, Shopify-related automation, and AI features.",
    talkwagon:
      "Provides automations and visual flows for routing, waits, conditions, tags, broadcasts, and human handoff.",
  },
  {
    area: "Pricing review",
    delightchat:
      "Public pricing surfaces observed on July 24, 2026 showed different plan figures, so teams should verify the current checkout or quote.",
    talkwagon:
      "Public pricing is listed as $1 first month, then $9.99/month for Pro, with Meta/WhatsApp charges separate.",
  },
] as const;

const fitCards = [
  {
    icon: ShoppingBag,
    title: "Choose DelightChat if Shopify context is central",
    detail:
      "If order lookup, ecommerce support, social comments, live chat, and Shopify-specific workflows are the heart of your support operation, DelightChat deserves serious evaluation.",
  },
  {
    icon: MessageSquareText,
    title: "Choose TalkWagon if WhatsApp is the operating channel",
    detail:
      "If most customer work begins in WhatsApp and your team needs assignment, contacts, pipelines, broadcasts, flows, AI help, and permissions around those conversations, TalkWagon is the more direct fit.",
  },
  {
    icon: UsersRound,
    title: "Choose by workflow, not by feature count",
    detail:
      "A longer feature list is not always a better business system. The better choice is the product your team can use daily without losing ownership or customer context.",
  },
] as const;

const migrationChecklist = [
  "Export or document active customer conversations and key customer fields before switching.",
  "List the WhatsApp templates, tags, segments, automations, and handoff rules your team relies on.",
  "Confirm which historical conversations must remain searchable and which can stay archived elsewhere.",
  "Rebuild team permissions before inviting agents into the new workspace.",
  "Test inbound messages, broadcasts, template failures, assignment changes, AI answers, and human handoff.",
  "Run both systems in a controlled overlap period if message volume or revenue risk is high.",
] as const;

const totalCostItems = [
  "Monthly subscription and first-month offer",
  "Meta or WhatsApp Business Platform messaging charges",
  "Team seats and permission needs",
  "Broadcast allowance and campaign volume",
  "Automation, AI, and workflow limits",
  "Migration work, training time, and process changes",
] as const;

const faqs = [
  {
    question: "What is the best DelightChat alternative?",
    answer:
      "The best alternative depends on your workflow. Shopify-centered ecommerce support teams may prefer an omnichannel product with deep ecommerce context. WhatsApp-first sales and support teams may prefer TalkWagon because it organizes WhatsApp conversations into CRM contacts, assignments, pipelines, broadcasts, automation, AI knowledge answers, and team permissions.",
  },
  {
    question: "Is TalkWagon a Shopify helpdesk replacement?",
    answer:
      "No. TalkWagon should be evaluated as a WhatsApp-first CRM, not as a Shopify-native omnichannel helpdesk. If Shopify order context is your main requirement, compare that requirement carefully before switching.",
  },
  {
    question: "Why do DelightChat pricing numbers differ across sources?",
    answer:
      "Pricing is a volatile product detail. During research on July 24, 2026, different public DelightChat surfaces showed different plan figures. The safest approach is to treat any comparison article as dated guidance and verify the current price in the vendor checkout or sales quote.",
  },
  {
    question: "Does a DelightChat alternative still need WhatsApp API charges?",
    answer:
      "Usually yes. CRM subscription pricing and Meta or WhatsApp Business Platform messaging charges are separate. Any team comparing tools should check both the software price and the WhatsApp messaging cost.",
  },
  {
    question: "Can I migrate from DelightChat to TalkWagon in one step?",
    answer:
      "Small teams may move quickly, but a safe migration should still review contacts, templates, tags, automation, team permissions, historical conversations, and handoff rules before live customer traffic moves to the new workspace.",
  },
] as const;

export const metadata: Metadata = {
  title: article.seoTitle,
  description: article.description,
  keywords: [article.primaryKeyword, ...article.secondaryKeywords],
  alternates: {
    canonical: article.canonicalUrl,
  },
  openGraph: {
    title: article.seoTitle,
    description: article.description,
    url: article.canonicalUrl,
    type: "article",
    publishedTime: article.publishedDate,
    modifiedTime: article.updatedDate,
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
    title: article.seoTitle,
    description: article.description,
    images: [article.image.src],
  },
  robots: {
    index: true,
    follow: true,
  },
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
        loading={priority ? "eager" : "lazy"}
        sizes="(min-width: 1280px) 1040px, (min-width: 768px) 92vw, 100vw"
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

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-bold text-[#087d68] underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

export default function DelightChatAlternativeArticlePage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    image: [getCanonicalUrl(article.image.src)],
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
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": article.canonicalUrl,
    },
  };

  return (
    <>
      <JsonLdScript id="article-06-blogposting-json-ld" data={articleJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: article.title, url: article.path },
        ]}
      />
      <FaqJsonLd id="article-06-faq-json-ld" faqs={faqs} />
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
                  <span>DelightChat alternative</span>
                </nav>
                <p className="mt-8 text-sm font-black uppercase tracking-[0.28em] text-[#41ee9f]">
                  Evidence-based comparison
                </p>
                <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  DelightChat Alternative: A Practical Comparison for WhatsApp Teams
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  If your team is comparing DelightChat with TalkWagon, the real question is not
                  which product has the longest feature list. It is whether you need a Shopify-centered
                  omnichannel support platform or a WhatsApp-first CRM for conversations, contacts,
                  pipelines, broadcasts, automation, AI answers, and team ownership.
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
                  <li><a href="#summary" className="hover:text-[#08bba4]">Direct answer</a></li>
                  <li><a href="#delightchat" className="hover:text-[#08bba4]">What DelightChat offers</a></li>
                  <li><a href="#why-alternative" className="hover:text-[#08bba4]">Why teams compare</a></li>
                  <li><a href="#comparison" className="hover:text-[#08bba4]">Comparison table</a></li>
                  <li><a href="#inbox" className="hover:text-[#08bba4]">Inbox model</a></li>
                  <li><a href="#shopify-crm" className="hover:text-[#08bba4]">Shopify vs CRM</a></li>
                  <li><a href="#cost" className="hover:text-[#08bba4]">Total cost</a></li>
                  <li><a href="#migration" className="hover:text-[#08bba4]">Migration checklist</a></li>
                  <li><a href="#choose" className="hover:text-[#08bba4]">Choose by fit</a></li>
                  <li><a href="#faqs" className="hover:text-[#08bba4]">FAQs</a></li>
                </ol>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6 text-lg leading-8 text-[#315345]">
                <p>
                  Short answer: DelightChat is a stronger natural fit when a Shopify/D2C team wants
                  omnichannel support around ecommerce context. TalkWagon is a stronger natural fit
                  when a team wants WhatsApp conversations to become organized CRM work: assigned
                  threads, contact records, sales pipeline follow-up, broadcasts, visual flows,
                  AI knowledge answers, and workspace permissions.
                </p>
              </div>

              <SectionHeading id="summary" eyebrow="Direct answer" title="The practical DelightChat alternative decision">
                <p>
                  A good DelightChat alternative page should not pretend that every business has the
                  same problem. DelightChat and TalkWagon overlap around WhatsApp business messaging,
                  team conversations, broadcasts, and automation, but they start from different centers
                  of gravity.
                </p>
                <p className="mt-5">
                  DelightChat presents itself as an ecommerce support and marketing platform for D2C
                  brands, with channels such as WhatsApp, Instagram, Facebook, email, and live chat,
                  plus Shopify context. TalkWagon is built as a WhatsApp CRM: the work starts from the
                  conversation and moves into contacts, ownership, pipelines, broadcasts, automations,
                  flows, AI-assisted answers, and team permissions.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.decisionMap} />

              <div className="grid gap-4 md:grid-cols-3">
                {fitCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <section key={card.title} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfff6] text-[#08bba4]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h2 className="mt-4 text-xl font-extrabold text-[#07130e]">{card.title}</h2>
                      <p className="mt-3 leading-7 text-[#315345]">{card.detail}</p>
                    </section>
                  );
                })}
              </div>

              <SectionHeading id="delightchat" eyebrow="Competitor evidence" title="What DelightChat currently offers">
                <p>
                  DelightChat&apos;s public pages describe an omnichannel support inbox and WhatsApp
                  marketing product for ecommerce teams. Official pages and help-center materials
                  mention WhatsApp Business API, Instagram, Facebook, email, live chat, Shopify order
                  context, broadcasts, automated replies, catalog or chatbot-related workflows, AI
                  features, analytics, and mobile apps.
                </p>
                <p className="mt-5">
                  That matters because some comparison pages on the web are stale. For example, older
                  competitor pages may describe DelightChat as missing capabilities that its current
                  official docs list. This article uses official DelightChat pages for DelightChat facts,
                  TalkWagon pages for TalkWagon facts, and dates volatile pricing observations.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.featureComparison} />

              <SectionHeading id="why-alternative" eyebrow="Evaluation trigger" title="Why teams look for a DelightChat alternative">
                <p>
                  A business usually starts looking for an alternative when the product orientation no
                  longer matches the team&apos;s daily work. If the team is not primarily Shopify-centered,
                  an ecommerce-first support workspace can feel broader than needed. If the team mainly
                  sells, supports, qualifies, and follows up through WhatsApp, a WhatsApp-first CRM can
                  be easier to operate.
                </p>
                <p className="mt-5">
                  Other common triggers are seat limits, workflow complexity, pricing uncertainty, the
                  need for sales pipeline ownership, a desire for simpler WhatsApp broadcasts, or the
                  need to connect AI answers to approved business knowledge without turning the inbox
                  into a generic helpdesk queue.
                </p>
              </SectionHeading>

              <SectionHeading id="comparison" eyebrow="Side by side" title="TalkWagon versus DelightChat comparison table">
                <p>
                  Use this table as a decision framework, not as a claim that one product wins every
                  category. The useful question is which product matches your operating model.
                </p>
              </SectionHeading>

              <div className="mt-8 overflow-x-auto rounded-[24px] border border-[#dbe9e2] bg-white">
                <table className="min-w-[920px] text-left text-sm">
                  <thead className="bg-[#ecfff6] text-[#07130e]">
                    <tr>
                      <th className="px-5 py-4 font-extrabold">Area</th>
                      <th className="px-5 py-4 font-extrabold">DelightChat</th>
                      <th className="px-5 py-4 font-extrabold">TalkWagon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                    {comparisonRows.map((row) => (
                      <tr key={row.area}>
                        <td className="px-5 py-4 font-extrabold text-[#07130e]">{row.area}</td>
                        <td className="px-5 py-4">{row.delightchat}</td>
                        <td className="px-5 py-4">{row.talkwagon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <SectionHeading id="inbox" eyebrow="Inbox model" title="Omnichannel support queue versus WhatsApp CRM ownership">
                <p>
                  An omnichannel support inbox is useful when customer questions arrive from several
                  different places and the team needs one helpdesk-like view. That is a natural
                  ecommerce-support pattern: social comments, email, live chat, WhatsApp, and order
                  context all need to meet somewhere.
                </p>
                <p className="mt-5">
                  A WhatsApp CRM workflow starts from a different pressure. The team may not need every
                  support channel in one helpdesk. It may need every WhatsApp conversation connected to
                  a customer record, owner, tag, pipeline stage, next follow-up, broadcast history, and
                  escalation path. That is where TalkWagon&apos;s team inbox, contacts, and pipeline pages
                  become central.
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.inboxModel} />

              <SectionHeading id="shopify-crm" eyebrow="Workflow fit" title="Shopify workflows versus CRM pipeline follow-up">
                <p>
                  DelightChat is especially relevant when Shopify order context drives the support
                  experience. If agents constantly need order details, ecommerce statuses, abandoned
                  cart workflows, or customer purchase history from a Shopify store, that orientation
                  can be valuable.
                </p>
                <p className="mt-5">
                  TalkWagon should be evaluated differently. It is not trying to be a Shopify-native
                  helpdesk. It is for teams that want WhatsApp messages to become CRM work: a lead is
                  assigned, moved through a pipeline, followed up with, included in approved broadcast
                  workflows when appropriate, and handed to a human when automation should not decide.
                </p>
                <p className="mt-5">
                  For a sales-led team, see the{" "}
                  <Link href="/use-cases/sales" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    WhatsApp sales workflow
                  </Link>
                  . For a team still deciding how to organize messages, compare{" "}
                  <Link href="/features/team-inbox" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    team inbox
                  </Link>
                  ,{" "}
                  <Link href="/features/automation" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    automation
                  </Link>
                  , and{" "}
                  <Link href="/features/flows" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    visual flows
                  </Link>
                  .
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.shopifyPipeline} />

              <SectionHeading id="cost" eyebrow="Pricing review" title="How to compare pricing and total cost">
                <p>
                  Do not compare only the first subscription price you see. Pricing pages, promotional
                  offers, plan packaging, WhatsApp messaging charges, and usage limits can change. During
                  research on July 24, 2026, DelightChat public surfaces showed inconsistent plan figures,
                  so a serious buyer should verify the current checkout or quote before deciding.
                </p>
                <p className="mt-5">
                  TalkWagon&apos;s public pricing lists Pro at $1 first month, then $9.99/month, with 1,000,000
                  broadcast messages per billing period and up to 10 team members. WhatsApp/Meta charges are still
                  separate because official messaging charges are not the same as CRM subscription fees.
                </p>
              </SectionHeading>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {totalCostItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#dbe9e2] bg-white p-4">
                    <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                    <span className="font-bold text-[#315345]">{item}</span>
                  </div>
                ))}
              </div>

              <EditorialImage image={articleImages.pricingChecklist} />

              <SectionHeading id="migration" eyebrow="Migration" title="A safe migration checklist">
                <p>
                  Switching tools is not only a software decision. It changes how agents see customers,
                  who owns conversations, which templates are used, how broadcasts are prepared, and how
                  managers review work. Before moving, document what must survive the switch.
                </p>
              </SectionHeading>

              <div className="mt-8 rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                <ul className="space-y-4">
                  {migrationChecklist.map((item) => (
                    <li key={item} className="flex gap-3 text-base leading-7 text-[#315345]">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <EditorialImage image={articleImages.migration} />

              <SectionHeading id="choose" eyebrow="Decision framework" title="Choose by fit, not by slogans">
                <p>
                  Choose DelightChat when your team is primarily an ecommerce support operation that
                  needs Shopify context, multiple support channels, and D2C messaging workflows in one
                  place. Choose TalkWagon when WhatsApp is your main customer channel and your team needs
                  CRM ownership around messages, contacts, assignments, pipeline follow-up, broadcasts,
                  flows, AI answers from approved knowledge, and permissions.
                </p>
                <p className="mt-5">
                  If you are comparing multiple WhatsApp tools, you may also find the{" "}
                  <Link href="/wati-alternative" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    WATI alternative comparison
                  </Link>{" "}
                  useful. If the real project is implementation rather than vendor selection, read the guide
                  to{" "}
                  <Link href="/blog/integrating-whatsapp-with-crm" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    integrating WhatsApp with a CRM
                  </Link>{" "}
                  and the explainer on{" "}
                  <Link href="/blog/whatsapp-commerce-explained" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    WhatsApp commerce
                  </Link>
                  . For messaging costs outside the CRM plan, review{" "}
                  <Link href="/whatsapp-api-prices" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                    WhatsApp API pricing
                  </Link>
                  .
                </p>
              </SectionHeading>

              <EditorialImage image={articleImages.chooseFit} />

              <div className="rounded-[28px] border border-[#f2d27c] bg-[#fff9e8] p-6 text-[#5b4a1f]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-xl font-extrabold text-[#07130e]">Non-affiliation and evidence note</h2>
                    <p className="mt-3 leading-7">
                      DelightChat, Shopify, WhatsApp, and Meta are referenced for comparison only. TalkWagon
                      is not claiming endorsement by those companies. Competitor capabilities and pricing
                      are volatile, so verify current vendor pages before purchase.
                    </p>
                  </div>
                </div>
              </div>

              <SectionHeading id="faqs" eyebrow="FAQs" title="Helpful FAQs about DelightChat alternatives">
                <div className="space-y-4">
                  {faqs.map((faq) => (
                    <details key={faq.question} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
                      <summary className="cursor-pointer text-lg font-extrabold text-[#07130e]">
                        {faq.question}
                      </summary>
                      <p className="mt-4 text-base leading-7 text-[#315345]">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </SectionHeading>

              <section className="mt-12 rounded-[28px] bg-[#07130e] p-8 text-white">
                <GitBranch className="h-8 w-8 text-[#3ddf84]" aria-hidden="true" />
                <h2 className="mt-4 text-3xl font-extrabold">Build the workflow around how your team actually works</h2>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  A WhatsApp CRM should make customer ownership easier to see: who is talking, what was
                  promised, what happens next, and when a human should take over.
                </p>
                <Link
                  href="/pricing"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3bdc83] px-6 py-3 text-base font-black text-[#071b13] transition hover:bg-[#6ef3a6]"
                >
                  Start with TalkWagon
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </section>

              <section className="mt-12 rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                <h2 className="text-2xl font-extrabold text-[#07130e]">Sources</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#315345]">
                  <li>
                    DelightChat official pricing page:{" "}
                    <SourceLink href="https://www.delightchat.io/pricing">plan and packaging evidence</SourceLink>
                  </li>
                  <li>
                    DelightChat Help Center:{" "}
                    <SourceLink href="https://www.delightchat.io/help-center">official product documentation</SourceLink>
                  </li>
                  <li>
                    DelightChat WhatsApp setup documentation:{" "}
                    <SourceLink href="https://www.delightchat.io/help-center/integrate-whatsapp-on-delightchat">
                      WhatsApp Business API workflow
                    </SourceLink>
                  </li>
                  <li>
                    DelightChat support inbox guide:{" "}
                    <SourceLink href="https://www.delightchat.io/help-center/support-inbox-guide">
                      inbox, tags, assignment, and Shopify context
                    </SourceLink>
                  </li>
                  <li>
                    Meta Developers:{" "}
                    <SourceLink href="https://developers.facebook.com/docs/whatsapp/pricing">
                      WhatsApp Business Platform pricing context
                    </SourceLink>
                  </li>
                  <li>
                    TalkWagon public product pages: pricing, team inbox, broadcasts, automation, flows,
                    AI chatbot, and WhatsApp API pricing pages checked for TalkWagon claims.
                  </li>
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
