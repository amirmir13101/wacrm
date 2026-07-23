import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Library,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import { getBlogArticle } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

function getArticleOrThrow() {
  const found = getBlogArticle("whatsapp-business-quick-replies");
  if (!found) {
    throw new Error("Article data missing: whatsapp-business-quick-replies");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  comparison: {
    src: "/hostiko-crm/generated/blog/talk-wagon-quick-reply-vs-automation-comparison.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard comparing a manually selected quick reply with an away reply, workflow, and approved template process",
    caption:
      "Quick replies are manually selected saved responses. They are useful, but they are not the same as automated replies or approved platform templates.",
  },
  library: {
    src: "/hostiko-crm/generated/blog/talk-wagon-quick-reply-library-organization.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon quick-reply library organized by support, sales, orders, delivery, payments, bookings, follow-up, and human handoff",
    caption:
      "A strong reply library is grouped by purpose, shortcut, owner, and review status so agents can find the right response quickly.",
  },
  setup: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-quick-reply-setup-workflow.webp",
    width: 1600,
    height: 900,
    alt: "Step-by-step TalkWagon style quick-reply setup workflow showing reply creation, shortcut selection, saving, chat selection, review, and sending",
    caption:
      "Treat every saved reply as a draft that should be reviewed in context before it reaches a customer.",
  },
  examples: {
    src: "/hostiko-crm/generated/blog/talk-wagon-quick-reply-message-examples.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard with quick-reply examples for customer support, sales, orders, appointments, payments, delivery, delays, and follow-up messages",
    caption:
      "Reusable replies work best when they are specific enough to help, but flexible enough for the agent to personalize.",
  },
  team: {
    src: "/hostiko-crm/generated/blog/talk-wagon-team-consistent-quick-replies.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon shared team inbox showing agents using the same approved quick-reply library for consistent customer communication",
    caption:
      "A shared library helps a team sound consistent across support, sales, and follow-up conversations.",
  },
  handoff: {
    src: "/hostiko-crm/generated/blog/talk-wagon-quick-reply-human-review-handoff.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard showing a support agent reviewing a quick reply and handing off a sensitive conversation to a teammate",
    caption:
      "Saved replies should speed up common work, not replace judgment when a conversation needs a person.",
  },
  maintenance: {
    src: "/hostiko-crm/generated/blog/talk-wagon-quick-reply-library-maintenance.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon saved-reply maintenance workflow showing review due, update, duplicate resolution, approval, and retired responses",
    caption:
      "Quick replies can become risky when they are outdated. Assign an owner and review them on a schedule.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const comparisonRows = [
  {
    type: "Quick replies",
    purpose: "Reusable saved responses chosen by an agent during a chat.",
    bestFor: "Common questions, support answers, pricing requests, delivery updates, and follow-ups.",
    caution: "The agent should check context and personalize before sending.",
  },
  {
    type: "Greeting messages",
    purpose: "Automatic welcome replies for new or returning customers.",
    bestFor: "First-contact acknowledgement and basic routing.",
    caution: "They should not carry the full burden of customer support.",
  },
  {
    type: "Away messages",
    purpose: "Automatic replies when the business is unavailable or outside hours.",
    bestFor: "After-hours, holidays, closures, and delayed response expectations.",
    caution: "The schedule and response promise must match real staffing.",
  },
  {
    type: "Automated workflows",
    purpose: "Rules that route, tag, wait, branch, or hand off conversations.",
    bestFor: "Structured operations where a trigger should perform repeatable work.",
    caution: "Automations need monitoring and a human escape path.",
  },
  {
    type: "Approved API templates",
    purpose: "Pre-approved messages used by the WhatsApp Business Platform.",
    bestFor: "Business-initiated or template-based platform messaging.",
    caution: "They follow separate Meta approval, category, and policy rules.",
  },
] as const;

const setupSteps = [
  {
    step: "1",
    title: "Open Business tools",
    detail:
      "Open the WhatsApp Business app and go to the business tools or settings area where message tools are managed.",
  },
  {
    step: "2",
    title: "Choose Quick replies",
    detail:
      "Open Quick replies. WhatsApp labels can vary slightly by device or app version, so use the current option shown in your app.",
  },
  {
    step: "3",
    title: "Create the reply",
    detail:
      "Write the message that should be reused. Keep it short enough for an agent to scan and adjust before sending.",
  },
  {
    step: "4",
    title: "Add a shortcut",
    detail:
      "Choose a memorable shortcut such as /pricing, /hours, /delivery, /booking, or /handoff.",
  },
  {
    step: "5",
    title: "Save and test",
    detail:
      "Save the reply, open a test chat, type the shortcut or slash command, and confirm the reply appears correctly.",
  },
  {
    step: "6",
    title: "Review before sending",
    detail:
      "Treat the saved reply as a starting point. Check the customer context, personalize it, and remove anything that does not apply.",
  },
] as const;

const examples = [
  {
    group: "General enquiries",
    shortcut: "/hello",
    copy:
      "Hi [First name], thanks for contacting [Company name]. How can we help you today?",
    note: "Use this when the customer has not explained the request yet.",
  },
  {
    group: "Business hours",
    shortcut: "/hours",
    copy:
      "Our current business hours are [Business hours]. If you message outside these hours, our team will reply when we are back online.",
    note: "Keep hours updated whenever staffing or holidays change.",
  },
  {
    group: "Pricing enquiries",
    shortcut: "/pricing",
    copy:
      "Thanks for asking. Please tell us which [Product name] or service you are interested in, and we will share the most relevant pricing details.",
    note: "Ask for the missing detail before sending a long price list.",
  },
  {
    group: "Product availability",
    shortcut: "/stock",
    copy:
      "Please send the [Product name], size, color, or model you need. We will check availability and confirm the next step.",
    note: "Useful for ecommerce, local retail, and product-led sales teams.",
  },
  {
    group: "Order confirmation",
    shortcut: "/order",
    copy:
      "Thanks. Please share your [Order number] so we can check the order status and help you accurately.",
    note: "Do not ask for passwords, OTPs, or payment-card details.",
  },
  {
    group: "Delivery information",
    shortcut: "/delivery",
    copy:
      "Delivery timing depends on your location and order status. Please send your [Order number] and delivery city so we can check the latest update.",
    note: "This avoids guessing and sets up a useful follow-up.",
  },
  {
    group: "Appointments and bookings",
    shortcut: "/booking",
    copy:
      "To help with your booking, please send your preferred date, time, service, and location. We will confirm availability before the appointment is booked.",
    note: "Make it clear that the booking is not confirmed until the team replies.",
  },
  {
    group: "Customer support",
    shortcut: "/support",
    copy:
      "I can help with that. Please share a short description of the issue and any relevant [Order number], account email, or screenshot.",
    note: "Ask only for information the team genuinely needs.",
  },
  {
    group: "Sales qualification",
    shortcut: "/sales",
    copy:
      "Happy to guide you. Please share what you are trying to achieve, your expected timeline, and the best contact person for this request.",
    note: "Good for service providers, SaaS teams, agencies, and B2B sellers.",
  },
  {
    group: "Payment instructions",
    shortcut: "/payment",
    copy:
      "We can share payment instructions here, but please do not send card details, passwords, OTPs, or private banking codes in chat.",
    note: "Saved payment replies should include safety boundaries.",
  },
  {
    group: "Delayed responses",
    shortcut: "/delay",
    copy:
      "Thanks for your patience. We are checking this and will reply with an update as soon as we have confirmed information.",
    note: "Do not promise an exact time unless your team can meet it.",
  },
  {
    group: "Human handoff",
    shortcut: "/handoff",
    copy:
      "I am going to connect this conversation with [Agent name] so the right team member can review the details and help you further.",
    note: "Use this when a saved answer is not enough.",
  },
  {
    group: "Follow-up messages",
    shortcut: "/followup",
    copy:
      "Hi [First name], I am following up on your previous request. Do you still need help with [Topic]?",
    note: "Keep follow-ups polite and relevant to the actual conversation.",
  },
] as const;

const libraryTips = [
  "Group replies by purpose, such as support, sales, orders, delivery, bookings, payments, and handoff.",
  "Use short shortcuts that agents can remember, such as /hours or /delivery.",
  "Assign an owner for each reply so someone is responsible for accuracy.",
  "Add a review date for replies that mention prices, hours, policies, availability, or compliance-sensitive wording.",
  "Retire duplicates instead of letting agents choose between several nearly identical answers.",
] as const;

const writingRules = [
  "Start with the customer's situation, not with your internal process.",
  "Keep replies short enough to personalize quickly.",
  "Use placeholders like [First name], [Order number], and [Support link] only when the agent will replace them.",
  "Avoid asking for passwords, OTPs, full payment-card details, or unnecessary sensitive information.",
  "Include one clear next step so the customer knows what to do after reading the reply.",
  "Use friendly language, but avoid sounding like a script when the customer is upset or confused.",
] as const;

const mistakes = [
  "Sending a saved reply without reading the latest customer message.",
  "Keeping old pricing, business hours, or delivery promises in the library.",
  "Writing replies so long that agents stop reviewing them.",
  "Using one reply for support, sales, billing, and appointments.",
  "Making the customer repeat details already visible in the conversation.",
  "Using quick replies as a substitute for human review on sensitive requests.",
] as const;

const checklist = [
  "List the top repeated questions your team answers every week.",
  "Create one reply per clear purpose instead of one giant all-purpose answer.",
  "Choose memorable shortcuts and avoid duplicates.",
  "Add placeholders only where they are useful.",
  "Review each reply for privacy, accuracy, and tone.",
  "Test replies in real chat context before training the team.",
  "Schedule monthly or quarterly reviews for replies that can become outdated.",
] as const;

const faqs = [
  {
    question: "What are WhatsApp Business quick replies?",
    answer:
      "WhatsApp Business quick replies are saved responses that help a business reuse frequently sent messages. An agent can select a saved reply during a chat and then review or personalize it before sending.",
  },
  {
    question: "How do I set quick replies in WhatsApp Business?",
    answer:
      "Open the WhatsApp Business app, go to Business tools or the current message tools area, choose Quick replies, create a reply, add a shortcut, save it, and test it in a chat. Exact labels can vary by device and app version.",
  },
  {
    question: "Are quick replies the same as automated replies?",
    answer:
      "No. Quick replies are reusable saved responses selected by a person. Greeting messages, away messages, workflows, and platform templates follow different rules and can be automatic or approval-based.",
  },
  {
    question: "Can quick replies include customer-specific details?",
    answer:
      "Yes, but they should use placeholders such as [First name] or [Order number] so the agent knows what to personalize before sending.",
  },
  {
    question: "What should I avoid in quick replies?",
    answer:
      "Avoid outdated prices, unrealistic response promises, very long scripts, unclear next steps, and requests for passwords, OTPs, or payment-card information.",
  },
  {
    question: "How many quick replies should a business create?",
    answer:
      "Start with the repeated questions your team answers most often. A small, accurate library is better than a large library full of duplicates and outdated replies.",
  },
] as const;

const sources = [
  {
    label: "WhatsApp Help Center: how to use quick replies",
    href: "https://faq.whatsapp.com/1791149784551042",
  },
  {
    label: "WhatsApp Help Center: greeting messages",
    href: "https://faq.whatsapp.com/501866148528310",
  },
  {
    label: "WhatsApp Help Center: away messages",
    href: "https://faq.whatsapp.com/2565868990219715",
  },
  {
    label: "Meta for Developers: WhatsApp templates overview",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview",
  },
  {
    label: "Google Search Central: creating helpful content",
    href: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
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
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="mt-16">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#07130e] sm:text-4xl">{title}</h2>
      {children ? <div className="mt-5 text-lg leading-8 text-[#315345]">{children}</div> : null}
    </div>
  );
}

export default function WhatsAppBusinessQuickRepliesArticlePage() {
  return (
    <>
      <JsonLdScript
        id="article-03-blogposting-json-ld"
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
      <FaqJsonLd id="article-03-faq-json-ld" faqs={faqs} />
      <PublicHeader active="blog" />
      <main className="bg-[#f7fbf8] text-[#07130e]">
        <article>
          <header className="relative overflow-hidden bg-[#07130e] px-5 py-16 text-white sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(61,223,132,0.2),transparent_32%),linear-gradient(135deg,#07130e,#123226)]" />
            <div className="relative mx-auto max-w-5xl">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 rounded-full border border-[#3ddf84]/35 bg-white/8 px-4 py-2 text-sm font-semibold text-[#d8fff1] transition hover:border-[#3ddf84]"
              >
                Blog
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <h1 className="mt-8 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                WhatsApp Business Quick Replies: Setup Guide and Practical Examples
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                Quick replies are saved responses that help a business answer repeated questions
                faster without asking agents to type the same message all day. Used well, they
                create consistency. Used carelessly, they can sound robotic or send outdated
                information. This guide shows how to build a useful library and when a human
                should still review the answer.
              </p>
              <p className="mt-5">
                It also explains how WhatsApp Business reply shortcuts fit beside greeting
                messages, away messages, team inbox work, and higher-control automation.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#d8fff1]">
                <span>{article.author}</span>
                <span aria-hidden="true">|</span>
                <time dateTime={article.publishedDate}>Published July 23, 2026</time>
                <span aria-hidden="true">|</span>
                <span>{article.readingTime}</span>
              </div>
              <EditorialImage image={articleImages.hero} priority />
            </div>
          </header>

          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 lg:px-0">
            <div className="rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6 text-lg leading-8 text-[#315345]">
              <p>
                A WhatsApp quick reply is not a chatbot and it is not a broadcast template. It is
                a reusable saved response that a person can choose during a conversation. That
                difference matters because quick replies are strongest when they combine speed
                with judgment: the reply is ready, but the agent still checks the customer context
                before sending.
              </p>
            </div>

            <nav className="mt-10 rounded-[28px] border border-[#dbe9e2] bg-white p-6 shadow-[0_18px_50px_rgba(7,19,14,0.06)]">
              <div className="flex items-center gap-3">
                <Library className="h-5 w-5 text-[#08bba4]" aria-hidden="true" />
                <h2 className="text-lg font-extrabold text-[#07130e]">In this guide</h2>
              </div>
              <div className="mt-5 grid gap-3 text-sm font-semibold text-[#315345] sm:grid-cols-2">
                {[
                  "What quick replies are",
                  "Quick replies vs other message types",
                  "Setup steps and shortcuts",
                  "Reusable reply examples",
                  "Library organization",
                  "Writing and review checklist",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </nav>

            <SectionHeading eyebrow="Definition" title="What WhatsApp Business quick replies are">
              <p>
                WhatsApp Business quick replies are reusable messages for common customer
                questions. In the WhatsApp Business app, a business can create saved replies and
                give each one a shortcut. When an agent is replying to a customer, the shortcut
                helps bring up the saved message quickly.
              </p>
              <p className="mt-5">
                The practical value is not just speed. A good quick-reply library keeps important
                information consistent: support hours, booking requirements, delivery wording,
                payment safety reminders, and the way the team asks for missing details. It also
                reduces the chance that each agent writes a different answer to the same question.
              </p>
            </SectionHeading>

            <SectionHeading eyebrow="Distinctions" title="Quick replies are not every WhatsApp message tool">
              <p>
                Many businesses mix up quick replies, greeting messages, away messages, automated
                workflows, and approved platform templates. They can all involve repeated wording,
                but they behave differently.
              </p>
            </SectionHeading>

            <div className="mt-8 overflow-x-auto rounded-[24px] border border-[#dbe9e2] bg-white">
              <table className="min-w-[760px] text-left text-sm">
                <thead className="bg-[#ecfff6] text-[#07130e]">
                  <tr>
                    <th className="px-5 py-4 font-extrabold">Message type</th>
                    <th className="px-5 py-4 font-extrabold">What it does</th>
                    <th className="px-5 py-4 font-extrabold">Best use</th>
                    <th className="px-5 py-4 font-extrabold">Watch out for</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                  {comparisonRows.map((row) => (
                    <tr key={row.type}>
                      <td className="px-5 py-4 font-extrabold text-[#07130e]">{row.type}</td>
                      <td className="px-5 py-4">{row.purpose}</td>
                      <td className="px-5 py-4">{row.bestFor}</td>
                      <td className="px-5 py-4">{row.caution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <EditorialImage image={articleImages.comparison} />

            <SectionHeading eyebrow="Setup" title="How to create and use WhatsApp Business quick replies">
              <p>
                The exact labels can vary by device and app version, but the workflow is simple:
                create a saved message, give it a shortcut, save it, then choose it from a chat
                when it fits the customer request. Do a live test before training the team to use
                the reply.
              </p>
            </SectionHeading>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {setupSteps.map((item) => (
                <div key={item.step} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3ddf84] text-sm font-extrabold text-[#07130e]">
                      {item.step}
                    </span>
                    <h3 className="text-lg font-extrabold text-[#07130e]">{item.title}</h3>
                  </div>
                  <p className="mt-4 leading-7 text-[#315345]">{item.detail}</p>
                </div>
              ))}
            </div>

            <EditorialImage image={articleImages.setup} />

            <SectionHeading eyebrow="Examples" title="Practical WhatsApp Business quick reply examples">
              <p>
                Use these examples as starting points, not as messages to send blindly. Replace
                every placeholder, check the latest customer message, and remove anything that
                does not apply.
              </p>
            </SectionHeading>

            <div className="mt-8 grid gap-5">
              {examples.map((example) => (
                <section key={example.shortcut} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-extrabold text-[#07130e]">{example.group}</h3>
                    <span className="rounded-full bg-[#ecfff6] px-3 py-1 text-sm font-bold text-[#087d68]">
                      {example.shortcut}
                    </span>
                  </div>
                  <blockquote className="mt-4 rounded-[18px] border border-[#3ddf84]/35 bg-[#f7fbf8] p-4 leading-7 text-[#315345]">
                    {example.copy}
                  </blockquote>
                  <p className="mt-3 text-sm leading-6 text-[#5b7169]">{example.note}</p>
                </section>
              ))}
            </div>

            <EditorialImage image={articleImages.examples} />

            <SectionHeading eyebrow="Library" title="How to organize a quick-reply library">
              <p>
                The problem with saved replies is not usually the first week. The problem appears
                later, when old prices, old hours, and duplicate replies stay in circulation. A
                library needs structure so agents can find the right reply and trust that it is
                still accurate.
              </p>
            </SectionHeading>

            <div className="mt-8 grid gap-4">
              {libraryTips.map((tip) => (
                <div key={tip} className="flex gap-3 rounded-[20px] border border-[#dbe9e2] bg-white p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <p className="leading-7 text-[#315345]">{tip}</p>
                </div>
              ))}
            </div>

            <EditorialImage image={articleImages.library} />

            <SectionHeading eyebrow="Writing" title="How to write better quick replies">
              <p>
                The best saved reply sounds like a helpful agent wrote it, not like a system pasted
                a script into the chat. It should be accurate, brief, safe, and easy to adapt.
              </p>
            </SectionHeading>

            <div className="mt-8 rounded-[28px] border border-[#dbe9e2] bg-white p-6">
              <ul className="grid gap-4">
                {writingRules.map((rule) => (
                  <li key={rule} className="flex gap-3 leading-7 text-[#315345]">
                    <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <SectionHeading eyebrow="Mistakes" title="Common quick-reply mistakes to avoid">
              <p>
                Quick replies are meant to reduce repetitive typing. They should not reduce care.
                A saved reply that ignores context can frustrate a customer faster than a slower
                but accurate human answer.
              </p>
            </SectionHeading>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {mistakes.map((mistake) => (
                <div key={mistake} className="rounded-[22px] border border-[#f2d27c] bg-[#fff9e8] p-5 leading-7 text-[#5b4a1f]">
                  {mistake}
                </div>
              ))}
            </div>

            <EditorialImage image={articleImages.handoff} />

            <SectionHeading eyebrow="Checklist" title="Practical implementation checklist">
              <p>
                Start small. A tight set of accurate quick replies is easier to train, review, and
                improve than a giant library nobody trusts.
              </p>
            </SectionHeading>

            <div className="mt-8 rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6">
              <ul className="grid gap-4">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-3 leading-7 text-[#315345]">
                    <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <EditorialImage image={articleImages.maintenance} />

            <SectionHeading eyebrow="Team workflows" title="How TalkWagon supports consistent team communication">
              <p>
                TalkWagon is built for teams that manage customer conversations across a shared
                WhatsApp CRM workspace. A team can keep customer context in one place, organize
                contacts and pipeline follow-ups, use automation and visual flows for structured
                routing, and hand conversations to the right person when a saved reply is not
                enough.
              </p>
              <p className="mt-5">
                That does not remove the need for a good reply library. It makes the library more
                useful because the team can combine reusable wording with contact context,
                assignments, tags, and human ownership.
              </p>
            </SectionHeading>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { href: "/features/team-inbox", label: "Shared team inbox" },
                { href: "/features/automation", label: "Automation" },
                { href: "/features/flows", label: "Visual flows" },
                { href: "/use-cases/sales", label: "Sales workflows" },
                { href: "/pricing", label: "Pricing" },
                { href: "/blog/whatsapp-business-greeting-message-examples", label: "Greeting message guide" },
                { href: "/blog/whatsapp-away-message-examples", label: "Away message guide" },
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

            <EditorialImage image={articleImages.team} />

            <SectionHeading eyebrow="FAQs" title="Helpful FAQs about WhatsApp Business quick replies" />

            <div className="mt-8 grid gap-4">
              {faqs.map((faq) => (
                <section key={faq.question} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                  <h3 className="text-xl font-extrabold text-[#07130e]">{faq.question}</h3>
                  <p className="mt-3 leading-7 text-[#315345]">{faq.answer}</p>
                </section>
              ))}
            </div>

            <SectionHeading eyebrow="Conclusion" title="Build quick replies that agents actually trust">
              <p>
                WhatsApp Business quick replies are simple, but a professional quick-reply system
                needs more than a few shortcuts. Write replies for real customer situations,
                organize them by purpose, review them regularly, and train agents to personalize
                before sending. That is how saved replies become a useful service habit instead of
                another source of confusing canned messages.
              </p>
            </SectionHeading>

            <div className="mt-10 rounded-[28px] border border-[#3ddf84]/35 bg-[#07130e] p-6 text-white">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-1 h-6 w-6 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                <div>
                  <h2 className="text-2xl font-extrabold">Turn repeated questions into consistent team replies</h2>
                  <p className="mt-3 leading-7 text-[#d8fff1]">
                    TalkWagon helps growing teams manage WhatsApp conversations, contacts,
                    follow-ups, automations, visual flows, and human handoff in one CRM workspace.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3ddf84] px-5 py-3 font-extrabold text-[#07130e] transition hover:bg-[#2acb73]"
                  >
                    Start your free trial
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
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
