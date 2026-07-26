import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  ListChecks,
  Workflow,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { BreadcrumbJsonLd, FaqJsonLd, JsonLdScript } from "@/components/marketing/seo-json-ld";
import { getBlogArticle } from "@/lib/marketing/blog";
import { getCanonicalUrl } from "@/lib/site-url";

function getArticleOrThrow() {
  const found = getBlogArticle("how-to-schedule-whatsapp-messages");
  if (!found) {
    throw new Error("Article data missing: how-to-schedule-whatsapp-messages");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  methods: {
    src: "/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-message-methods.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon dashboard comparing broadcast schedules, away-message schedules, template campaigns, and follow-up reminders",
    caption:
      "Scheduling WhatsApp messages is not one feature. Business teams usually combine broadcast timing, away-message schedules, follow-up reminders, and approved template workflows.",
  },
  followUp: {
    src: "/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-follow-up-workflow.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon team inbox showing assigned owners, pipeline stages, and scheduled follow-up reminders for WhatsApp conversations",
    caption:
      "A useful scheduled message workflow starts with ownership: who should send it, why it should be sent, and what happens if the customer replies.",
  },
  broadcast: {
    src: "/hostiko-crm/generated/blog/talk-wagon-schedule-whatsapp-broadcast-checklist.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon broadcast builder showing audience checks, approved template status, schedule timing, review, and send steps",
    caption:
      "Scheduled broadcasts should pass audience, template, timing, timezone, and compliance checks before they enter the sending queue.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const schedulingMethods = [
  {
    method: "Scheduled business broadcasts",
    fit: "Campaigns, announcements, product updates, reminders, or segmented messages sent to a selected audience.",
    limitation:
      "Broadcasts still need opt-in, appropriate content, and current template or platform rules. A scheduled campaign should not become a spam shortcut.",
  },
  {
    method: "Away-message schedules",
    fit: "Automatic replies outside business hours, during holidays, or when the team is temporarily unavailable.",
    limitation:
      "An away schedule confirms availability expectations. It does not replace a real follow-up process after the team returns.",
  },
  {
    method: "Template-based platform messages",
    fit: "Business-initiated messages sent through the WhatsApp Business Platform or a CRM that supports approved templates.",
    limitation:
      "Templates need the right category, approval, variables, and customer context. Pricing and delivery rules can vary by market.",
  },
  {
    method: "CRM follow-up reminders",
    fit: "Sales, support, renewal, booking, payment, or order follow-ups that should be assigned to a team member.",
    limitation:
      "A reminder is safer than a blind automated send when the next message needs context or human judgment.",
  },
  {
    method: "Workflow automation",
    fit: "Triggers, waits, tags, routing, owner assignment, and handoff rules around WhatsApp conversations.",
    limitation:
      "Automation should organize timing and ownership. Sensitive replies still need review.",
  },
] as const;

const scheduleBeforeSending = [
  "Audience permission and opt-in are clear.",
  "The message uses the correct approved template when required.",
  "Variables are tested with realistic customer data.",
  "The send time matches the customer's market or timezone.",
  "The team knows who owns replies after the message is sent.",
  "The workflow has a failure, pause, and human handoff path.",
  "The content does not ask for passwords, OTPs, card numbers, or private credentials.",
  "Reporting separates sent, delivered, failed, replied, and follow-up-needed states.",
] as const;

const workflowSteps = [
  {
    title: "Choose the purpose",
    detail:
      "Decide whether the scheduled message is a broadcast, reminder, service update, appointment note, renewal follow-up, or after-hours acknowledgement.",
  },
  {
    title: "Pick the right channel path",
    detail:
      "Use broadcast scheduling for audience messages, away-message schedules for availability, and CRM reminders for follow-ups that need a person.",
  },
  {
    title: "Confirm template and consent",
    detail:
      "If the business starts the conversation, confirm that the customer context, opt-in, template category, and approval status are suitable.",
  },
  {
    title: "Set the time safely",
    detail:
      "Use the recipient's market, business hours, quiet hours, and campaign purpose to choose the timing. Avoid sending at awkward local hours.",
  },
  {
    title: "Assign reply ownership",
    detail:
      "Scheduling the outbound message is only half the work. Decide who handles replies, failed messages, handoffs, and follow-up tasks.",
  },
  {
    title: "Review after sending",
    detail:
      "Check delivery, failures, replies, opt-outs, and support load. Use the results to improve the next scheduled workflow.",
  },
] as const;

const mistakes = [
  "Assuming every WhatsApp app has the same native send-later feature.",
  "Scheduling a message without checking whether it should be a broadcast, away reply, template, or human reminder.",
  "Sending a campaign before template approval, variable testing, or audience review.",
  "Ignoring timezones and quiet hours for customers in different markets.",
  "Letting automation send sensitive replies that should be reviewed by a person.",
  "Tracking only queued messages instead of sent, delivered, failed, replied, and follow-up states.",
] as const;

const faqs = [
  {
    question: "Can you schedule WhatsApp messages?",
    answer:
      "For business use, scheduling depends on the method. WhatsApp Business supports scheduled business broadcasts in supported tools, away messages can be scheduled by availability, and CRM or platform workflows can schedule approved template campaigns or follow-up reminders. A normal one-to-one chat scheduler should not be assumed for every app, device, or account.",
  },
  {
    question: "Can WhatsApp Business schedule broadcasts?",
    answer:
      "WhatsApp Help Center documentation describes a Schedule option for business broadcasts. Businesses should still confirm that their app version, account, market, and broadcast workflow support the option before relying on it.",
  },
  {
    question: "Is an away message the same as scheduling a WhatsApp message?",
    answer:
      "No. An away message is an automatic availability reply sent according to rules such as always send, custom schedule, or outside business hours. It is useful for expectations, but it is not the same as scheduling a personalized follow-up or campaign.",
  },
  {
    question: "How should a team schedule WhatsApp follow-ups safely?",
    answer:
      "Use a CRM workflow that stores the customer context, owner, due time, message purpose, and handoff rule. When the message requires judgment, schedule a reminder for the agent instead of sending automatically.",
  },
  {
    question: "Do scheduled WhatsApp messages need approved templates?",
    answer:
      "Business-initiated platform messages often use approved templates. The exact requirement depends on whether the message is a service reply, a template message, a marketing campaign, or another supported workflow. Teams should review the current WhatsApp Business Platform rules before sending.",
  },
] as const;

const sources = [
  {
    label: "WhatsApp Help Center: create and send a business broadcast",
    href: "https://faq.whatsapp.com/1711086883148106",
  },
  {
    label: "WhatsApp Help Center: use away messages",
    href: "https://faq.whatsapp.com/2565868990219715",
  },
  {
    label: "Meta for Developers: template fundamentals",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview",
  },
  {
    label: "Meta for Developers: send marketing messages",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages",
  },
  {
    label: "Meta for Developers: template message time-to-live",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/time-to-live",
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

export default function ScheduleWhatsAppMessagesArticlePage() {
  const articleJsonLd = {
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
  };

  return (
    <>
      <JsonLdScript id="article-08-blogposting-json-ld" data={articleJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: article.title, url: article.path },
        ]}
      />
      <FaqJsonLd id="article-08-faq-json-ld" faqs={faqs} />
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
                  <span>Schedule WhatsApp messages</span>
                </nav>
                <h1 className="mt-8 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  How to Schedule WhatsApp Messages
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  Scheduling WhatsApp messages for a business is not just about picking a time.
                  Teams need to know which method fits the job: scheduled broadcasts, away-message
                  schedules, approved templates, reminders, automation, or a human follow-up task.
                </p>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#d8fff1]">
                  This guide explains the practical options, current limitations, team workflow
                  checks, and safety rules before you queue a message for customers.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#d8fff1]">
                  <span className="rounded-full border border-[#3ddf84]/35 px-4 py-2">{article.readingTime}</span>
                  <span className="rounded-full border border-[#3ddf84]/35 px-4 py-2">Updated July 27, 2026</span>
                  <span className="rounded-full border border-[#3ddf84]/35 px-4 py-2">US keyword research</span>
                </div>
              </div>
              <EditorialImage image={articleImages.hero} priority />
            </div>
          </header>

          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[280px_1fr] lg:px-10">
            <aside className="hidden lg:block">
              <div className="sticky top-28 rounded-[28px] border border-[#dbe9e2] bg-white p-5 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#08bba4]">Table of contents</p>
                <nav className="mt-5 grid gap-2 text-sm font-bold text-[#315345]">
                  {[
                    ["Quick answer", "#quick-answer"],
                    ["Methods", "#methods"],
                    ["Team workflow", "#workflow"],
                    ["Broadcasts", "#broadcasts"],
                    ["Automation", "#automation"],
                    ["Mistakes", "#mistakes"],
                    ["Checklist", "#checklist"],
                    ["TalkWagon", "#talkwagon"],
                    ["FAQs", "#faqs"],
                    ["Sources", "#sources"],
                  ].map(([label, href]) => (
                    <a key={href} href={href} className="rounded-2xl px-3 py-2 transition hover:bg-[#ecfff6] hover:text-[#087d68]">
                      {label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="rounded-[30px] border border-[#dbe9e2] bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                <div className="space-y-12">
                  <SectionHeading id="quick-answer" eyebrow="Short answer" title="Can you schedule WhatsApp messages?">
                    <p>
                      Yes, but the right answer depends on what you mean by &quot;schedule.&quot; WhatsApp
                      Business documentation describes scheduling for business broadcasts, and away
                      messages can be sent on a schedule such as outside business hours or a custom
                      schedule. Teams using the WhatsApp Business Platform or a CRM can also plan
                      template campaigns, timed follow-ups, and workflow reminders.
                    </p>
                    <p className="mt-5">
                      The important point is that a scheduled WhatsApp message should be tied to a
                      clear business reason, the correct customer context, and a responsible owner.
                      Otherwise, scheduling becomes another way to create messy conversations at a
                      faster speed.
                    </p>
                    <div className="mt-6 rounded-[24px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6">
                      <div className="flex gap-3">
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                        <p className="text-base leading-7 text-[#315345]">
                          For business teams, the safest scheduling model is not &quot;send later and
                          forget.&quot; It is &quot;schedule, review, assign, monitor, and handle replies.&quot;
                        </p>
                      </div>
                    </div>
                  </SectionHeading>

                  <SectionHeading id="methods" eyebrow="Methods" title="Five practical ways to schedule WhatsApp messages">
                    <p>
                      People often search for one universal WhatsApp scheduler. In real business
                      operations, scheduling is usually split across different tools and message
                      types. A broadcast, an away reply, and a sales follow-up do not carry the same
                      risk or require the same review.
                    </p>
                  </SectionHeading>

                  <EditorialImage image={articleImages.methods} />

                  <div className="overflow-x-auto rounded-[24px] border border-[#dbe9e2] bg-white">
                    <table className="min-w-[820px] text-left text-sm">
                      <thead className="bg-[#ecfff6] text-[#07130e]">
                        <tr>
                          <th className="px-5 py-4 font-extrabold">Method</th>
                          <th className="px-5 py-4 font-extrabold">Best fit</th>
                          <th className="px-5 py-4 font-extrabold">Important limitation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                        {schedulingMethods.map((row) => (
                          <tr key={row.method}>
                            <td className="px-5 py-4 font-extrabold text-[#07130e]">{row.method}</td>
                            <td className="px-5 py-4">{row.fit}</td>
                            <td className="px-5 py-4">{row.limitation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <SectionHeading id="workflow" eyebrow="Workflow" title="A better scheduling workflow for business teams">
                    <p>
                      A customer does not care whether your message came from a broadcast scheduler,
                      a template campaign, an automation, or a reminder. They care whether the
                      message is relevant and whether someone can help if they reply.
                    </p>
                    <p className="mt-5">
                      That is why scheduling should sit inside a team workflow. The team needs a
                      purpose, owner, timing rule, follow-up path, and reporting view. Without those
                      pieces, even a technically successful scheduled message can create operational
                      confusion.
                    </p>
                  </SectionHeading>

                  <EditorialImage image={articleImages.followUp} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    {workflowSteps.map((step, index) => (
                      <section key={step.title} className="rounded-[24px] border border-[#dbe9e2] bg-[#f8fffb] p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d2a51e] bg-[#fff6d7] text-sm font-extrabold text-[#5b4710]">
                            {index + 1}
                          </span>
                          <h3 className="text-xl font-extrabold text-[#07130e]">{step.title}</h3>
                        </div>
                        <p className="mt-4 leading-7 text-[#315345]">{step.detail}</p>
                      </section>
                    ))}
                  </div>

                  <SectionHeading id="broadcasts" eyebrow="Broadcasts" title="How scheduled broadcasts should be reviewed">
                    <p>
                      Scheduled broadcasts are useful when one message needs to reach a selected
                      audience at a planned time. They are common for product updates, event
                      reminders, renewal notices, appointment information, and campaign sends.
                    </p>
                    <p className="mt-5">
                      The risk is that a broadcast feels simple right before it creates a large reply
                      queue. Before sending, check the audience, content, template status, time zone,
                      opt-out handling, and who will answer incoming replies.
                    </p>
                  </SectionHeading>

                  <EditorialImage image={articleImages.broadcast} />

                  <SectionHeading id="automation" eyebrow="Automation" title="When to automate and when to schedule a human reminder">
                    <p>
                      Automation can help with timing, but timing does not remove judgment. It is
                      usually safe to automate internal organization: tags, owner assignment, waits,
                      route selection, queue placement, and reminders. It is riskier to automate
                      sensitive replies about payments, refunds, complaints, account access, legal
                      issues, health details, or pricing exceptions.
                    </p>
                    <p className="mt-5">
                      A good rule is to automate the workflow around the message and keep human
                      review for the message itself when context matters. That keeps the customer
                      experience more reliable and gives the team a chance to catch mistakes.
                    </p>
                  </SectionHeading>

                  <div className="rounded-[28px] border border-[#3ddf84]/35 bg-[#07130e] p-6 text-white">
                    <div className="flex items-start gap-3">
                      <Workflow className="mt-1 h-6 w-6 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                      <div>
                        <h3 className="text-2xl font-extrabold">Use automation for structure, not blind sending</h3>
                        <p className="mt-3 leading-7 text-[#d8fff1]">
                          Let automation prepare the follow-up, assign the owner, and remind the
                          right person. If the reply needs context, schedule a human task rather
                          than sending an automatic message without review.
                        </p>
                      </div>
                    </div>
                  </div>

                  <SectionHeading id="mistakes" eyebrow="Mistakes" title="Common scheduling mistakes to avoid" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    {mistakes.map((mistake) => (
                      <div key={mistake} className="rounded-[22px] border border-[#f2d27c] bg-[#fff9e8] p-5 leading-7 text-[#5b4a1f]">
                        {mistake}
                      </div>
                    ))}
                  </div>

                  <SectionHeading id="checklist" eyebrow="Checklist" title="What to check before a scheduled WhatsApp message goes out">
                    <p>
                      Use this checklist before scheduling a broadcast, campaign, reminder, or
                      automation-assisted message. It keeps timing decisions connected to customer
                      expectations and team capacity.
                    </p>
                  </SectionHeading>

                  <div className="rounded-[28px] border border-[#3ddf84]/35 bg-[#ecfff6] p-6">
                    <ul className="grid gap-4">
                      {scheduleBeforeSending.map((item) => (
                        <li key={item} className="flex gap-3 leading-7 text-[#315345]">
                          <ListChecks className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <SectionHeading id="talkwagon" eyebrow="TalkWagon workflow" title="Where TalkWagon fits in scheduled WhatsApp workflows">
                    <p>
                      TalkWagon helps teams manage the operational layer around WhatsApp timing:
                      shared inbox ownership, contact context, pipeline follow-ups, approved
                      broadcasts, automations, visual flows, AI answers from approved knowledge,
                      and human handoff.
                    </p>
                    <p className="mt-5">
                      If you want to schedule audience messages, start with the{" "}
                      <Link href="/features/broadcasts" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        broadcast workflow
                      </Link>
                      . If you need timed routing and follow-up logic, compare{" "}
                      <Link href="/features/automation" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        automation
                      </Link>{" "}
                      and{" "}
                      <Link href="/features/flows" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        visual flows
                      </Link>
                      . If you are still connecting WhatsApp to your customer system, read the{" "}
                      <Link href="/blog/integrating-whatsapp-with-crm" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        WhatsApp CRM integration guide
                      </Link>
                      .
                    </p>
                    <p className="mt-5">
                      For related message setup, see the guides to{" "}
                      <Link href="/blog/whatsapp-business-greeting-message-examples" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        greeting messages
                      </Link>
                      ,{" "}
                      <Link href="/blog/whatsapp-away-message-examples" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        away messages
                      </Link>
                      ,{" "}
                      <Link href="/blog/whatsapp-business-quick-replies" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        quick replies
                      </Link>
                      ,{" "}
                      <Link href="/blog/whatsapp-commerce-explained" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        WhatsApp commerce
                      </Link>
                      , and the public{" "}
                      <Link href="/whatsapp-api-prices" className="font-bold text-[#087d68] underline-offset-4 hover:underline">
                        WhatsApp API pricing page
                      </Link>
                      .
                    </p>
                  </SectionHeading>

                  <SectionHeading id="faqs" eyebrow="FAQs" title="Helpful FAQs about scheduling WhatsApp messages" />

                  <div className="grid gap-4">
                    {faqs.map((faq) => (
                      <section key={faq.question} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                        <h3 className="text-xl font-extrabold text-[#07130e]">{faq.question}</h3>
                        <p className="mt-3 leading-7 text-[#315345]">{faq.answer}</p>
                      </section>
                    ))}
                  </div>

                  <section className="rounded-[2rem] bg-[#062319] p-8 text-white md:p-10">
                    <BellRing className="h-8 w-8 text-[#41ee9f]" aria-hidden="true" />
                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em]">Schedule the workflow, not just the message</h2>
                    <p className="mt-4 max-w-3xl text-lg leading-8 text-[#d6f7e8]">
                      The best scheduled WhatsApp messages are connected to audience review,
                      template readiness, time zones, owner assignment, and a clear reply path.
                      TalkWagon gives teams the CRM workspace around that timing decision.
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3bdc83] px-6 py-3 text-base font-black text-[#071b13] transition hover:bg-[#6ef3a6]"
                    >
                      Start with TalkWagon
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </Link>
                  </section>

                  <section id="sources" className="border-t border-[#dbe9e2] pt-8">
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
            </div>
          </div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
