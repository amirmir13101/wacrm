import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  DatabaseZap,
  GitBranch,
  KeyRound,
  ListChecks,
  MessageSquareText,
  UsersRound,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import { getBlogArticle } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

function getArticleOrThrow() {
  const found = getBlogArticle("integrating-whatsapp-with-crm");
  if (!found) {
    throw new Error("Article data missing: integrating-whatsapp-with-crm");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  options: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-options.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon decision map showing five ways to integrate WhatsApp with a CRM",
    caption:
      "The right integration route depends on team size, message volume, automation needs, and whether you need official API workflows.",
  },
  dataMapping: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-data-mapping.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon CRM mapping WhatsApp messages into contact records, tags, owners, and pipeline stages",
    caption:
      "A useful integration maps conversation context into fields your team can actually use: owner, tag, stage, opt-in, and next step.",
  },
  webhooks: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-webhook-crm-events.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing WhatsApp webhook events flowing into CRM timelines and delivery tracking",
    caption:
      "Webhooks are what keep the CRM updated when new messages, delivery statuses, errors, or contact events happen.",
  },
  team: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-team-ownership.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon team inbox showing WhatsApp conversations assigned to sales, support, operations, and manager review",
    caption:
      "After WhatsApp is connected, team ownership matters as much as the technical connection itself.",
  },
  automation: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-automation-handoff.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon workflow builder showing WhatsApp CRM automation steps and human handoff",
    caption:
      "Automation should organize, route, and remind. High-risk decisions should still have a clear human handoff path.",
  },
  optIn: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-template-opt-in-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon WhatsApp CRM integration checklist for opt-in, templates, mapped contacts, webhooks, assignments, and privacy review",
    caption:
      "Template and opt-in readiness should be checked before outbound CRM workflows go live.",
  },
  testing: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-testing.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon pre-launch integration test dashboard for inbound messages, contact creation, duplicate merge, template send, and handoff",
    caption:
      "Test the full path before launch: inbound message, contact match, assignment, template send, status update, failure handling, and handoff.",
  },
  analytics: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-analytics.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon analytics dashboard showing assigned leads, follow-ups, delivery status, pipeline movement, and response queue",
    caption:
      "Once WhatsApp is connected to the CRM, reporting should show queue health and follow-up work, not vanity metrics.",
  },
  checklist: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-crm-integration-launch-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon final launch checklist for WhatsApp CRM integration with API provider ready, phone connected, contacts mapped, templates approved, webhooks tested, team ownership set, automation reviewed, and handoff ready",
    caption:
      "A safe launch means the connection, data, templates, team process, automation, and escalation route have all been tested.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const integrationRoutes = [
  {
    icon: MessageSquareText,
    title: "WhatsApp Business App only",
    detail:
      "Good for one person or very low message volume. It is simple, but it is not a full CRM integration because ownership, history, reporting, and automation stay limited.",
  },
  {
    icon: GitBranch,
    title: "Native connector",
    detail:
      "Useful when your current CRM has a supported WhatsApp connector. Check whether it supports real inbox work, webhooks, templates, and team permissions, not only message logging.",
  },
  {
    icon: UsersRound,
    title: "WhatsApp-native CRM",
    detail:
      "A system such as TalkWagon starts with WhatsApp conversations and builds CRM workflows around inbox ownership, contacts, pipelines, broadcasts, automation, and handoff.",
  },
  {
    icon: KeyRound,
    title: "Provider or BSP bridge",
    detail:
      "A business messaging provider can connect the official WhatsApp Business Platform to a CRM. This can be helpful when you need API access but do not want to build every layer yourself.",
  },
  {
    icon: DatabaseZap,
    title: "Custom API integration",
    detail:
      "Best for teams with engineering resources and custom requirements. It needs careful work around auth, webhooks, retries, rate limits, logging, and data privacy.",
  },
] as const;

const dataFields = [
  "Customer name and phone number",
  "Conversation source and opt-in context",
  "Assigned owner or team",
  "Tags and customer segment",
  "Pipeline stage or ticket status",
  "Last message and next follow-up",
  "Template status and delivery state",
  "Internal notes and handoff reason",
] as const;

const launchChecklist = [
  "Confirm the WhatsApp number and business profile are ready.",
  "Choose the integration route: native connector, WhatsApp-native CRM, provider bridge, or custom API.",
  "Map contacts, duplicates, tags, owners, and pipeline stages before importing live conversations.",
  "Set rules for opt-in, templates, service replies, and outbound broadcast permissions.",
  "Subscribe to the message and status events your CRM needs through webhooks or your provider.",
  "Test inbound, outbound, delivery, read, failed, duplicate-contact, and handoff scenarios.",
  "Document what the team should do when automation cannot answer safely.",
  "Review privacy and security rules before storing sensitive conversation data.",
] as const;

const mistakes = [
  {
    title: "Logging messages without ownership",
    detail:
      "A CRM note is not enough if nobody owns the next action. Every active conversation needs an owner, status, and follow-up rule.",
  },
  {
    title: "Syncing too much sensitive data",
    detail:
      "Do not store passwords, OTPs, full card numbers, bank login details, private credentials, or unnecessary regulated information inside a chat workflow.",
  },
  {
    title: "Ignoring duplicate contacts",
    detail:
      "A customer may message from different sources or use number formats with country-code differences. Duplicate handling should be tested early.",
  },
  {
    title: "Treating templates as normal chat replies",
    detail:
      "Outbound template messages need the right category, approval, and customer context. Do not assume every sales follow-up can be sent freely.",
  },
  {
    title: "Skipping failure states",
    detail:
      "Your CRM should show failed sends, webhook gaps, paused automations, invalid templates, and provider errors clearly enough for a human to fix.",
  },
] as const;

const faqs = [
  {
    question: "What does integrating WhatsApp with CRM mean?",
    answer:
      "It means connecting WhatsApp conversations with customer records, ownership, tags, pipeline stages, templates, automation, and reporting so the team can manage follow-ups in one organized system.",
  },
  {
    question: "Do I need the WhatsApp Business API to integrate WhatsApp with a CRM?",
    answer:
      "Not always. A very small business may use the WhatsApp Business App manually. A growing team usually needs the official WhatsApp Business Platform or a provider-backed CRM integration for shared inboxes, templates, webhooks, and automation.",
  },
  {
    question: "What CRM data should sync from WhatsApp?",
    answer:
      "Useful fields include customer name, phone number, opt-in context, assigned owner, tags, pipeline stage, latest message, follow-up date, template status, and handoff notes. Sensitive data should be minimized.",
  },
  {
    question: "Can WhatsApp CRM integration automate replies?",
    answer:
      "Yes, but automation should be used carefully. It works best for routing, tagging, follow-up reminders, approved template workflows, and simple known questions. Pricing exceptions, complaints, payment issues, and sensitive cases should have human handoff.",
  },
  {
    question: "How should a business test a WhatsApp CRM integration before launch?",
    answer:
      "Test inbound messages, contact creation, duplicate matching, assignment, template sending, delivery/read/failed statuses, webhook events, automation branches, human handoff, and reporting before sending real campaigns or relying on the workflow.",
  },
] as const;

export const metadata: Metadata = {
  title: article.seoTitle,
  description: article.description,
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
};

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#087d68]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#10231d] md:text-4xl">{title}</h2>
      <div className="mt-5 space-y-5 text-lg leading-8 text-[#415951]">{children}</div>
    </section>
  );
}

function EditorialImage({ image, priority = false }: { image: ArticleImage; priority?: boolean }) {
  return (
    <figure className="my-10 overflow-hidden rounded-[2rem] border border-[#d7eee5] bg-[#f5fbf8] shadow-[0_24px_80px_rgba(0,42,31,0.12)]">
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        sizes="(min-width: 1280px) 1040px, (min-width: 768px) 92vw, 100vw"
        className="h-auto w-full"
      />
      {"caption" in image ? (
        <figcaption className="border-t border-[#d7eee5] bg-white px-6 py-4 text-sm leading-6 text-[#5f766f]">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-[#bdebd8] bg-[#ecfff6] p-6 text-[#174438]">
      <div className="flex gap-3">
        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#087d68]" aria-hidden="true" />
        <div className="space-y-3 text-base leading-7">{children}</div>
      </div>
    </div>
  );
}

export default function WhatsAppCrmIntegrationArticlePage() {
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
    },
    publisher: {
      "@type": "Organization",
      name: "TalkWagon",
      logo: {
        "@type": "ImageObject",
        url: getCanonicalUrl("/logo.png"),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": article.canonicalUrl,
    },
  };

  return (
    <main className="min-h-screen bg-[#f6fbf8] text-[#10231d]">
      <JsonLdScript id="article-05-blogposting" data={articleJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: getCanonicalUrl("/") },
          { name: "Blog", url: getCanonicalUrl("/blog") },
          { name: article.title, url: article.canonicalUrl },
        ]}
      />
      <FaqJsonLd id="article-05-faq-json-ld" faqs={faqs} />
      <PublicHeader />

      <article>
        <header className="relative overflow-hidden bg-[#062319] text-white">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(28,211,137,0.18),transparent_42%),radial-gradient(circle_at_78%_24%,rgba(255,194,41,0.16),transparent_32%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-[#b8f6df] transition hover:border-[#3be38f]"
              >
                <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                Back to TalkWagon blog
              </Link>
              <p className="mt-8 text-sm font-black uppercase tracking-[0.32em] text-[#41ee9f]">Integration guide</p>
              <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.055em] md:text-6xl lg:text-7xl">
                How to Integrate WhatsApp with a CRM
              </h1>
              <p className="mt-7 max-w-2xl text-xl leading-8 text-[#d6f7e8]">
                A practical setup guide for connecting WhatsApp conversations with CRM contacts, ownership,
                webhooks, templates, automation, reporting, and human handoff without losing customer context.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#d6f7e8]">
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2">{article.readingTime}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2">Updated {article.updatedDate}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2">Previously researched keyword data</span>
              </div>
            </div>

            <EditorialImage image={articleImages.hero} priority />
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-[1.75rem] border border-[#d7eee5] bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#087d68]">Table of contents</p>
              <nav className="mt-5 space-y-2 text-sm font-bold text-[#415951]">
                {[
                  ["Meaning", "#meaning"],
                  ["When to integrate", "#when"],
                  ["Integration routes", "#routes"],
                  ["Data mapping", "#data"],
                  ["Webhooks", "#webhooks"],
                  ["Team ownership", "#team"],
                  ["Templates and opt-in", "#templates"],
                  ["Automation", "#automation"],
                  ["Testing", "#testing"],
                  ["Mistakes", "#mistakes"],
                  ["TalkWagon workflow", "#talkwagon"],
                  ["FAQs", "#faqs"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="block rounded-2xl px-3 py-2 transition hover:bg-[#ecfff6] hover:text-[#087d68]">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rounded-[2rem] border border-[#d7eee5] bg-white p-6 shadow-sm md:p-10">
              <div className="space-y-12">
                <SectionHeading id="meaning" eyebrow="Definition" title="What integrating WhatsApp with CRM actually means">
                  <p>
                    Integrating WhatsApp with CRM means more than copying messages into a customer profile.
                    A useful integration connects WhatsApp conversations with the records and workflows your
                    team already uses: contact identity, owner, tags, pipeline stage, message history, template
                    status, follow-up tasks, and reporting.
                  </p>
                  <p>
                    The goal is simple: when a customer messages your business, the team should know who the
                    customer is, what they asked before, who owns the conversation, what the next step is, and
                    whether any automation or template message has already been sent.
                  </p>
                  <Callout>
                    <p>
                      Think of the integration as an operating system for conversations. WhatsApp is where the
                      customer talks; the CRM is where your team organizes context, responsibility, and follow-up.
                    </p>
                  </Callout>
                </SectionHeading>

                <SectionHeading id="when" eyebrow="Fit check" title="When you need integration instead of only the WhatsApp Business App">
                  <p>
                    A one-person business can often start with the WhatsApp Business App. It has useful basics:
                    a business profile, labels, quick replies, greeting messages, away messages, and catalog
                    support. The problem appears when more than one person needs to work from the same customer
                    history.
                  </p>
                  <p>
                    You should consider CRM integration when conversations are shared across sales, support,
                    operations, billing, or managers; when leads need pipeline tracking; when broadcasts require
                    approved templates and audience checks; when follow-ups are being forgotten; or when customers
                    repeat themselves because context is scattered.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.options} />

                <SectionHeading id="routes" eyebrow="Integration routes" title="Five realistic ways to connect WhatsApp and CRM">
                  <p>
                    There is no single best integration model for every business. The right route depends on your
                    team size, message volume, budget, engineering resources, compliance needs, and how much of
                    the workflow should be automated.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {integrationRoutes.map((route) => (
                      <div key={route.title} className="rounded-[1.5rem] border border-[#d7eee5] bg-[#f8fffb] p-5">
                        <route.icon className="h-6 w-6 text-[#087d68]" aria-hidden="true" />
                        <h3 className="mt-4 text-xl font-black text-[#10231d]">{route.title}</h3>
                        <p className="mt-3 text-base leading-7 text-[#526960]">{route.detail}</p>
                      </div>
                    ))}
                  </div>
                </SectionHeading>

                <SectionHeading id="data" eyebrow="Data mapping" title="What data should move between WhatsApp and the CRM">
                  <p>
                    The best integrations are selective. They sync the information that helps the team serve the
                    customer, and they avoid storing sensitive details that do not belong in a chat workflow.
                    Before connecting tools, decide which fields should be created, updated, or only displayed.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {dataFields.map((field) => (
                      <div key={field} className="flex items-start gap-3 rounded-2xl border border-[#d7eee5] bg-[#f8fffb] p-4">
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#087d68]" aria-hidden="true" />
                        <span className="font-bold text-[#24463c]">{field}</span>
                      </div>
                    ))}
                  </div>
                  <p>
                    The customer should not have to repeat the same story each time a new agent joins. At the
                    same time, your CRM should not become a dumping ground for every message. The practical
                    balance is to preserve context and next actions while keeping private or unnecessary data out.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.dataMapping} />

                <SectionHeading id="webhooks" eyebrow="Webhooks" title="How webhooks keep the CRM updated">
                  <p>
                    On the official WhatsApp Business Platform, webhooks send event payloads to your server or
                    provider when relevant activity happens. Those events can include inbound messages, message
                    statuses, errors, and other updates depending on the subscribed fields and configuration.
                  </p>
                  <p>
                    For a CRM workflow, the practical question is not just “Can we receive a webhook?” The better
                    question is: what should happen when the event arrives? An inbound message may create or match
                    a contact, update the conversation timeline, assign the thread, trigger a workflow, or notify
                    a human. A failed message should not disappear; it should become visible enough for the team
                    to fix.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.webhooks} />

                <SectionHeading id="team" eyebrow="Ownership" title="A WhatsApp CRM integration needs clear team ownership">
                  <p>
                    The technical connection is only half the work. Once WhatsApp messages enter a CRM, the team
                    needs rules for ownership. Who handles a new lead? Who takes support? Who reviews payment or
                    refund questions? Who can send broadcasts? Who can edit templates or automation?
                  </p>
                  <p>
                    Without ownership rules, the CRM becomes another place where messages sit. With ownership
                    rules, each conversation has a responsible person, a status, and a next step. That is what
                    turns chat activity into a real customer workflow.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.team} />

                <SectionHeading id="templates" eyebrow="Templates and opt-in" title="Templates, opt-in, and outbound CRM messages">
                  <p>
                    Inbound customer-service conversations and outbound template workflows are different. A CRM
                    integration should make that difference clear. Service replies usually happen inside an open
                    conversation. Proactive messages often require approved templates, the right category, and
                    customer context.
                  </p>
                  <p>
                    Businesses should record where opt-in came from, what type of messages the customer expects,
                    which templates are approved, and which team members are allowed to send them. A CRM that hides
                    these details can create compliance and customer-trust problems.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.optIn} />

                <SectionHeading id="automation" eyebrow="Automation" title="How automation and human handoff should work together">
                  <p>
                    Automation is most useful when it handles repeatable structure: assign a new enquiry, tag a
                    contact, update a stage, wait before a follow-up, send an approved template, or route a message
                    to the right person. It becomes risky when it pretends to solve every edge case.
                  </p>
                  <p>
                    A strong WhatsApp CRM integration should let automation organize the workflow while keeping
                    a human path for complaints, pricing exceptions, refunds, payment issues, account access,
                    regulated products, and sensitive customer situations.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.automation} />

                <SectionHeading id="testing" eyebrow="Pre-launch QA" title="What to test before going live">
                  <p>
                    Test the boring pieces first. Send a message from a new number. Send from an existing number.
                    Try a duplicate contact. Send a template. Trigger a failed message. Pause an automation.
                    Assign a conversation to a second user. Check whether the CRM shows the same reality your
                    customer sees.
                  </p>
                  <div className="mt-6 rounded-[1.5rem] border border-[#d7eee5] bg-[#f8fffb] p-6">
                    <ul className="space-y-3">
                      {launchChecklist.map((item) => (
                        <li key={item} className="flex gap-3 text-base leading-7 text-[#415951]">
                          <ListChecks className="mt-1 h-5 w-5 shrink-0 text-[#087d68]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SectionHeading>

                <EditorialImage image={articleImages.testing} />

                <SectionHeading id="mistakes" eyebrow="Mistakes" title="Common WhatsApp CRM integration mistakes">
                  <p>
                    Most integration problems are not caused by one missing button. They happen when data, people,
                    permissions, templates, and automation are connected without a clear operating model.
                  </p>
                  <div className="mt-6 grid gap-4">
                    {mistakes.map((mistake) => (
                      <div key={mistake.title} className="rounded-[1.5rem] border border-[#f1df9d] bg-[#fffbea] p-5">
                        <h3 className="text-xl font-black text-[#3f3514]">{mistake.title}</h3>
                        <p className="mt-3 text-base leading-7 text-[#685b2a]">{mistake.detail}</p>
                      </div>
                    ))}
                  </div>
                </SectionHeading>

                <EditorialImage image={articleImages.analytics} />

                <SectionHeading id="talkwagon" eyebrow="TalkWagon workflow" title="How TalkWagon supports WhatsApp CRM workflows">
                  <p>
                    TalkWagon is built around the practical CRM layer for WhatsApp: a shared inbox, contact
                    records, pipelines, approved broadcast workflows, automation, visual flows, team permissions,
                    AI answers from approved business knowledge, and human handoff.
                  </p>
                  <p>
                    If your team is still deciding whether WhatsApp should become a full customer workflow, start
                    with the <Link href="/features/team-inbox" className="font-bold text-[#087d68] underline-offset-4 hover:underline">team inbox</Link>.
                    If your main issue is routing and follow-up, read about{" "}
                    <Link href="/features/automation" className="font-bold text-[#087d68] underline-offset-4 hover:underline">WhatsApp automation</Link>{" "}
                    and <Link href="/features/flows" className="font-bold text-[#087d68] underline-offset-4 hover:underline">visual flows</Link>.
                    If the workflow is sales-led, the{" "}
                    <Link href="/use-cases/sales" className="font-bold text-[#087d68] underline-offset-4 hover:underline">WhatsApp sales use case</Link>{" "}
                    explains how conversations can move into pipeline follow-up.
                  </p>
                  <p>
                    For related setup work, see our guides to{" "}
                    <Link href="/blog/whatsapp-business-greeting-message-examples" className="font-bold text-[#087d68] underline-offset-4 hover:underline">WhatsApp greeting messages</Link>,{" "}
                    <Link href="/blog/whatsapp-away-message-examples" className="font-bold text-[#087d68] underline-offset-4 hover:underline">away messages</Link>,{" "}
                    <Link href="/blog/whatsapp-business-quick-replies" className="font-bold text-[#087d68] underline-offset-4 hover:underline">quick replies</Link>, and{" "}
                    <Link href="/blog/whatsapp-commerce-explained" className="font-bold text-[#087d68] underline-offset-4 hover:underline">WhatsApp commerce</Link>.
                  </p>
                </SectionHeading>

                <EditorialImage image={articleImages.checklist} />

                <SectionHeading id="faqs" eyebrow="FAQs" title="Helpful FAQs about integrating WhatsApp with CRM">
                  <div className="space-y-4">
                    {faqs.map((faq) => (
                      <details key={faq.question} className="rounded-[1.25rem] border border-[#d7eee5] bg-[#f8fffb] p-5">
                        <summary className="cursor-pointer text-lg font-black text-[#10231d]">{faq.question}</summary>
                        <p className="mt-4 text-base leading-7 text-[#526960]">{faq.answer}</p>
                      </details>
                    ))}
                  </div>
                </SectionHeading>

                <section className="rounded-[2rem] bg-[#062319] p-8 text-white md:p-10">
                  <BellRing className="h-8 w-8 text-[#41ee9f]" aria-hidden="true" />
                  <h2 className="mt-4 text-3xl font-black tracking-[-0.03em]">The best integration makes follow-up visible</h2>
                  <p className="mt-4 max-w-3xl text-lg leading-8 text-[#d6f7e8]">
                    A WhatsApp CRM integration should not make the team busier with extra admin. It should make
                    customer context, ownership, templates, automation, and next steps easier to see. That is the
                    difference between “we connected WhatsApp” and “we can manage customer conversations properly.”
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3bdc83] px-6 py-3 text-base font-black text-[#071b13] transition hover:bg-[#6ef3a6]"
                  >
                    Start with TalkWagon
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </section>

                <section className="rounded-[1.5rem] border border-[#d7eee5] bg-[#f8fffb] p-6">
                  <h2 className="text-2xl font-black text-[#10231d]">Sources</h2>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[#526960]">
                    <li>
                      WhatsApp for Business Developer Hub:{" "}
                      <a href="https://whatsappbusiness.com/developers/developer-hub/" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        Build on the WhatsApp Business Platform
                      </a>
                    </li>
                    <li>
                      WhatsApp Business webhooks article:{" "}
                      <a href="https://whatsappbusiness.com/blog/how-to-use-webhooks-from-whatsapp-business-api/" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        Implementing Webhooks From The WhatsApp Business Platform
                      </a>
                    </li>
                    <li>
                      Meta Developers documentation referenced from the Developer Hub for Cloud API setup,
                      webhooks, Embedded Signup, message templates, opt-in, error codes, rate limits, and policy enforcement.
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </article>

      <PublicFooter />
    </main>
  );
}
