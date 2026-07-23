import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
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
  const found = getBlogArticle("whatsapp-business-greeting-message-examples");
  if (!found) {
    throw new Error("Article data missing: whatsapp-business-greeting-message-examples");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  workflow: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-greeting-workflow.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon style dashboard showing a greeting message editor, preview panel, business hours setting, and audience controls",
    caption:
      "A greeting message works best when it is paired with clear audience rules, realistic availability, and a simple next step.",
  },
  examples: {
    src: "/hostiko-crm/generated/blog/talk-wagon-business-message-examples.webp",
    width: 1600,
    height: 900,
    alt: "Team reviewing organized WhatsApp greeting message examples on a TalkWagon style message hub",
    caption:
      "Different customer situations need different greetings: support, sales, appointments, order help, and after-hours replies should not all use the same script.",
  },
  handoff: {
    src: "/hostiko-crm/generated/blog/talk-wagon-team-inbox-human-handoff.webp",
    width: 1600,
    height: 900,
    alt: "TalkWagon style workflow showing an automated greeting moving into a shared team inbox and human handoff",
    caption:
      "The greeting is only the first touch. A growing team also needs assignment, context, follow-up ownership, and human handoff when needed.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const faqs = [
  {
    question: "What is a WhatsApp Business greeting message?",
    answer:
      "A WhatsApp Business greeting message is an automated welcome reply that can be sent when a customer starts a new chat or returns after a period of inactivity, depending on the business app settings.",
  },
  {
    question: "Is a greeting message the same as an away message?",
    answer:
      "No. A greeting message welcomes new or returning customers. An away message explains that the business is unavailable or outside its usual response hours.",
  },
  {
    question: "What should a greeting message include?",
    answer:
      "A useful greeting usually includes a short welcome, the business name, a clear next step, and an honest expectation about when the team can reply.",
  },
  {
    question: "Can a greeting message include a sales offer?",
    answer:
      "It can, but only when the offer is relevant, expected, and appropriate for the customer journey. Most greeting messages should focus first on helping the customer get routed correctly.",
  },
  {
    question: "Do WhatsApp Business greeting messages need Meta approval?",
    answer:
      "Greeting messages configured in the WhatsApp Business app are different from WhatsApp Business Platform message templates. Platform templates have separate Meta rules, categories, and approval requirements.",
  },
] as const;

const examples = [
  {
    title: "General business greeting",
    copy: "Hi [First name], welcome to [Company name]. Thanks for messaging us. How can we help you today?",
    note: "Use this when the customer could be asking about anything and your team wants a friendly, open-ended start.",
  },
  {
    title: "Support expectation greeting",
    copy:
      "Hi, thanks for contacting [Company name]. Our support team is online during [Support hours]. Please share your question and we will help as soon as possible.",
    note: "Useful for teams that need to acknowledge the message without promising an unrealistic instant reply.",
  },
  {
    title: "Sales inquiry greeting",
    copy:
      "Hello, thanks for your interest in [Company name]. Please tell us what you are looking for, and our team will guide you with options, pricing, and next steps.",
    note: "Good for leads who arrive from a website button, ad campaign, product page, or referral.",
  },
  {
    title: "Appointment or booking greeting",
    copy:
      "Hi, welcome to [Company name]. To help with your booking, please send your preferred date, time, service, and location.",
    note: "Works for clinics, salons, consultants, repair services, agencies, and local appointment-based teams.",
  },
  {
    title: "Ecommerce order help greeting",
    copy:
      "Hi, thanks for messaging [Company name]. For order help, please share your order number and the issue you need help with.",
    note: "Keeps order conversations structured from the first reply and reduces the back-and-forth your agents need.",
  },
  {
    title: "After-hours greeting",
    copy:
      "Hi, thanks for reaching [Company name]. We have received your message. Our team replies during [Support hours], and we will get back to you when we are online.",
    note: "Use this only if the stated hours match your real availability. If the team is offline, it should not sound like live support is available.",
  },
] as const;

const sources = [
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
    label: "Meta for Developers: template categorization",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization",
  },
] as const;

const setupSteps = [
  {
    step: "1",
    title: "Open WhatsApp Business",
    detail: "Start inside the WhatsApp Business app, not the regular customer app.",
  },
  {
    step: "2",
    title: "Go to Business tools",
    detail: "Open the business settings area where automated replies and profile tools live.",
  },
  {
    step: "3",
    title: "Choose Greeting message",
    detail: "Open the greeting message setting and turn the feature on.",
  },
  {
    step: "4",
    title: "Write the message",
    detail: "Use a short welcome, your business name, and the next detail the customer should send.",
  },
  {
    step: "5",
    title: "Choose recipients",
    detail: "Select the audience options available in your app, such as new customers or selected contacts.",
  },
  {
    step: "6",
    title: "Save and test",
    detail: "Check the greeting from a customer-like chat before relying on it in real conversations.",
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
  alternates: {
    canonical: canonicalUrl,
  },
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
  robots: {
    index: true,
    follow: true,
  },
};

function EditorialImage({ image, priority = false }: { image: ArticleImage; priority?: boolean }) {
  return (
    <figure className="not-prose my-10 overflow-hidden rounded-[32px] border border-[#dbe9e2] bg-white p-3 shadow-[0_24px_70px_rgba(7,19,14,0.1)]">
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        priority={priority}
        className="aspect-[16/9] w-full rounded-[24px] object-cover"
      />
      {"caption" in image ? (
        <figcaption className="px-3 py-4 text-sm leading-6 text-[#5b7169]">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}

export default function WhatsAppBusinessGreetingMessageArticlePage() {
  const articleUrl = getCanonicalUrl(article.path);

  return (
    <>
      <JsonLdScript
        id="article-01-blogposting-json-ld"
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
            "@id": articleUrl,
          },
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: article.title, url: article.path },
        ]}
      />
      <FaqJsonLd id="article-01-faq-json-ld" faqs={faqs} />
      <PublicHeader active="blog" />
      <main className="bg-[#f7fbf8] text-[#07130e]">
        <article>
          <section className="relative overflow-hidden bg-[#07130e] px-5 py-16 text-white sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(61,223,132,0.24),transparent_34%),linear-gradient(135deg,#07130e,#123226)]" />
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
                </nav>
                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#3ddf84]/35 bg-white/8 px-4 py-2 text-sm font-semibold text-[#d8fff1]">
                  <Sparkles className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
                  Practical guide for customer-facing WhatsApp replies
                </div>
                <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  WhatsApp Business Greeting Messages: Examples and Setup Guide
                </h1>
                <p className="mt-6 text-lg leading-8 text-[#d8fff1]">
                  A WhatsApp Business greeting message is often the first automated reply a customer sees. This
                  guide explains how greeting messages work, when to use them, how they differ from away messages,
                  and how to write helpful examples for support, sales, bookings, and order conversations.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#b8cfc7]">
                  <span>{article.author}</span>
                  <span aria-hidden="true">•</span>
                  <time dateTime={article.publishedDate}>Published July 19, 2026</time>
                  <span aria-hidden="true">•</span>
                  <span>{article.readingTime}</span>
                </div>
              </div>
              <EditorialImage image={articleImages.hero} priority />
            </div>
          </section>

          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[260px_1fr] lg:px-10">
            <aside className="hidden lg:block">
              <div className="sticky top-8 rounded-[26px] border border-[#dbe9e2] bg-white p-5 shadow-[0_18px_50px_rgba(7,19,14,0.08)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#08bba4]">In this guide</p>
                <ol className="mt-4 space-y-3 text-sm font-semibold text-[#315345]">
                  <li>
                    <a href="#what-it-is" className="hover:text-[#08bba4]">
                      What it is
                    </a>
                  </li>
                  <li>
                    <a href="#greeting-vs-away" className="hover:text-[#08bba4]">
                      Greeting vs away
                    </a>
                  </li>
                  <li>
                    <a href="#setup" className="hover:text-[#08bba4]">
                      Setup and workflow
                    </a>
                  </li>
                  <li>
                    <a href="#examples" className="hover:text-[#08bba4]">
                      Examples
                    </a>
                  </li>
                  <li>
                    <a href="#checklist" className="hover:text-[#08bba4]">
                      Checklist
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-[#08bba4]">
                      FAQ
                    </a>
                  </li>
                </ol>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="max-w-none space-y-10 text-lg leading-8 text-[#315345]">
                <section id="what-it-is">
                  <p className="text-xl leading-9">
                    The best greeting is not a long sales pitch. It is a short welcome that confirms the message
                    arrived, tells the customer what to share next, and sets an honest expectation about response
                    time. A useful greeting helps the customer feel seen without pretending that an agent has
                    already read the conversation.
                  </p>
                  <h2 className="mt-10 text-3xl font-extrabold text-[#07130e]">
                    What is a WhatsApp Business greeting message?
                  </h2>
                  <p className="mt-4">
                    WhatsApp describes greeting messages as a WhatsApp Business app feature that can be turned on
                    from Business tools. The business writes the greeting text, chooses the audience settings
                    available in the app, and saves the automated message. Depending on the settings, the message
                    can welcome customers who start a new chat or return after a period of inactivity.
                  </p>
                  <p className="mt-4">
                    In real business use, the greeting message does four practical jobs: it acknowledges the
                    customer, clarifies the next step, reduces repeated first questions, and helps the team route
                    the conversation. A clinic might ask for the preferred appointment date. A store might ask for
                    an order number. A service business might ask for the city, service type, and urgency. A sales
                    team might ask which product, plan, or package the customer wants to discuss.
                  </p>
                </section>

                <section id="greeting-vs-away">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Greeting message vs away message</h2>
                  <p className="mt-4">
                    Greeting messages and away messages are related, but they should not be treated as the same
                    script. A greeting message starts the conversation. An away message explains that the team is
                    currently unavailable. If both messages say almost the same thing, customers may get confused
                    about whether someone is available to help.
                  </p>
                  <div className="my-8 overflow-hidden rounded-[26px] border border-[#dbe9e2] bg-white shadow-[0_18px_50px_rgba(7,19,14,0.08)]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-[#f4fff9] text-[#07130e]">
                          <tr>
                            <th className="px-5 py-4 font-extrabold">Message type</th>
                            <th className="px-5 py-4 font-extrabold">Best use</th>
                            <th className="px-5 py-4 font-extrabold">Good customer expectation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Greeting message</td>
                            <td className="px-5 py-4">Welcome new or returning customers.</td>
                            <td className="px-5 py-4">“We received your message; here is what to share next.”</td>
                          </tr>
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Away message</td>
                            <td className="px-5 py-4">Explain that the team is offline or unavailable.</td>
                            <td className="px-5 py-4">“We are away; here is when we can reply.”</td>
                          </tr>
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Platform template</td>
                            <td className="px-5 py-4">Send approved business-initiated messages through the API.</td>
                            <td className="px-5 py-4">“This is a categorized template with Meta approval rules.”</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p>
                    If your main goal is to explain when the team is unavailable, use an away message instead.
                    Our complete guide to{" "}
                    <Link href="/blog/whatsapp-away-message-examples" className="font-semibold text-[#08bba4]">
                      WhatsApp away message examples
                    </Link>{" "}
                    covers scheduling, after-hours wording, weekend and holiday replies, and human follow-up. If your team
                    needs reusable saved responses for live conversations, read the{" "}
                    <Link href="/blog/whatsapp-business-quick-replies" className="font-semibold text-[#08bba4]">
                      WhatsApp Business quick replies guide
                    </Link>
                    .
                  </p>
                </section>

                <section id="setup">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">
                    How to set up a WhatsApp Business greeting message
                  </h2>
                  <p className="mt-4">
                    The exact app labels can vary by device and app version, but the current WhatsApp Help Center
                    flow starts from Business tools. A safe setup process looks like this:
                  </p>
                  <div className="mt-8 grid gap-4 lg:grid-cols-3">
                    {setupSteps.map((item, index) => (
                      <div key={item.step} className="relative rounded-[24px] border border-[#dbe9e2] bg-white p-5 shadow-[0_14px_40px_rgba(7,19,14,0.07)]">
                        {index < setupSteps.length - 1 ? (
                          <div className="pointer-events-none absolute -right-5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#3ddf84]/35 bg-[#f4fff9] text-[#08bba4] shadow-sm lg:flex">
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </div>
                        ) : null}
                        <div className="flex items-start gap-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3ddf84]/45 bg-[#eafff4] text-sm font-extrabold text-[#07130e]">
                            {item.step}
                          </span>
                          <div>
                            <h3 className="text-lg font-extrabold text-[#07130e]">{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[#5b7169]">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5">
                    If your business uses the WhatsApp Business Platform or Cloud API, treat templates separately.
                    Meta’s developer documentation describes templates as WhatsApp Business Account assets with
                    their own categories, variables, and approval rules. A greeting script you use in the app is
                    not automatically the same thing as a platform template.
                  </p>
                </section>

                <EditorialImage image={articleImages.workflow} />

                <section id="examples">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">
                    WhatsApp Business greeting message examples
                  </h2>
                  <p className="mt-4">
                    Use these examples as starting points, not fixed scripts. Replace placeholders such as
                    [First name], [Company name], and [Support hours] with real details. Keep every promise
                    accurate. If your team replies during business hours only, say that clearly.
                  </p>
                </section>
              </div>

              <div className="mt-8 grid gap-5">
                {examples.map((example) => (
                  <section
                    key={example.title}
                    className="rounded-[28px] border border-[#dbe9e2] bg-white p-6 shadow-[0_18px_50px_rgba(7,19,14,0.07)]"
                  >
                    <h3 className="text-xl font-extrabold text-[#07130e]">{example.title}</h3>
                    <blockquote className="mt-4 rounded-[22px] border border-[#3ddf84]/35 bg-[#f4fff9] p-5 text-lg leading-8 text-[#123226]">
                      “{example.copy}”
                    </blockquote>
                    <p className="mt-4 text-base leading-7 text-[#5b7169]">{example.note}</p>
                  </section>
                ))}
              </div>

              <EditorialImage image={articleImages.examples} />

              <div className="mt-10 max-w-none space-y-10 text-lg leading-8 text-[#315345]">
                <section>
                  <h2 className="text-3xl font-extrabold text-[#07130e]">
                    How to choose the right greeting for your business
                  </h2>
                  <p className="mt-4">
                    The right greeting depends on what the customer usually wants at the first touch. If most
                    customers ask for prices, the message should ask what product, service, quantity, or plan they
                    want. If customers ask for support, ask for the order number, account email, or screenshot. If
                    customers book appointments, ask for the preferred date, time, service, and location.
                  </p>
                  <p className="mt-4">
                    Keep the greeting broad enough to work for different conversations, but specific enough to
                    reduce agent workload. “How can we help?” is friendly, but it does not collect useful context.
                    “Please share your order number and the issue” is more useful when most chats are order
                    support conversations. The best version depends on your customer journey.
                  </p>
                  <div className="my-8 grid gap-4 md:grid-cols-3">
                    {[
                      {
                        icon: MessageSquareText,
                        title: "Ask for one useful detail",
                        text: "Request the single detail your team needs next: service type, order number, appointment date, or product name.",
                      },
                      {
                        icon: Clock3,
                        title: "Set honest expectations",
                        text: "Mention hours or response timing only when they are real. Avoid fake instant-support promises.",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Keep promotion secondary",
                        text: "A greeting can mention an offer, but the first purpose should be helping the customer get routed correctly.",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[24px] border border-[#dbe9e2] bg-white p-5 shadow-[0_12px_36px_rgba(7,19,14,0.06)]"
                      >
                        <item.icon className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                        <h3 className="mt-4 text-lg font-extrabold text-[#07130e]">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#5b7169]">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Common mistakes to avoid</h2>
                  <ul className="mt-5 list-disc space-y-3 pl-6">
                    <li>Writing a long greeting that customers will skim or ignore.</li>
                    <li>Promising fast support when your team cannot actually reply fast.</li>
                    <li>Using the same text for greetings and away messages.</li>
                    <li>Starting with a discount before understanding the customer’s need.</li>
                    <li>Forgetting to tell the customer what information to send next.</li>
                    <li>Using placeholders without checking that the final message reads naturally.</li>
                    <li>Sending platform template messages without checking the correct template approval rules.</li>
                  </ul>
                </section>

                <section id="checklist">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Greeting message checklist</h2>
                  <p className="mt-4">
                    Before you turn on your greeting, review the message as if you were the customer. A short
                    message that collects the right context is better than a polished paragraph that does not move
                    the conversation forward.
                  </p>
                </section>
              </div>

              <div className="mt-8 rounded-[30px] border border-[#3ddf84]/35 bg-[#0d1b15] p-6 text-white shadow-[0_24px_70px_rgba(7,19,14,0.18)]">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    "The message welcomes the customer in one or two short sentences.",
                    "The customer knows what information to send next.",
                    "Business hours or response-time wording is accurate.",
                    "The tone matches your brand and does not sound robotic.",
                    "Any promotional wording is relevant and expected.",
                    "The message has been tested from a customer-like conversation.",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                      <p className="text-sm leading-6 text-[#d8fff1]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <EditorialImage image={articleImages.handoff} />

              <div className="mt-10 max-w-none space-y-10 text-lg leading-8 text-[#315345]">
                <section>
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Where TalkWagon fits</h2>
                  <p className="mt-4">
                    A greeting message helps with the first reply. A team still needs a reliable way to handle the
                    conversation after that first reply. TalkWagon is built for teams that manage WhatsApp
                    customer conversations beyond a single phone, with shared inbox ownership, contact context,
                    broadcasts, automations, templates, and team permissions.
                  </p>
                  <p className="mt-4">
                    If your business needs routing after the first customer message, explore the{" "}
                    <Link href="/features/team-inbox" className="font-semibold text-[#08bba4]">
                      WhatsApp team inbox
                    </Link>
                    ,{" "}
                    <Link href="/features/automation" className="font-semibold text-[#08bba4]">
                      automation workflows
                    </Link>
                    ,{" "}
                    <Link href="/features/flows" className="font-semibold text-[#08bba4]">
                      WhatsApp flow builder
                    </Link>
                    , and{" "}
                    <Link href="/use-cases/sales" className="font-semibold text-[#08bba4]">
                      WhatsApp sales CRM
                    </Link>
                    .
                  </p>
                </section>

                <section id="faq">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Frequently asked questions</h2>
                </section>
              </div>

              <div className="mt-8 space-y-4">
                {faqs.map((faq) => (
                  <section key={faq.question} className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
                    <h3 className="text-lg font-extrabold text-[#07130e]">{faq.question}</h3>
                    <p className="mt-3 leading-7 text-[#315345]">{faq.answer}</p>
                  </section>
                ))}
              </div>

              <section className="mt-10 rounded-[30px] border border-[#dbe9e2] bg-white p-6">
                <h2 className="text-2xl font-extrabold text-[#07130e]">Official references</h2>
                <p className="mt-3 leading-7 text-[#315345]">
                  These official pages are useful when you need to confirm current WhatsApp Business app behavior
                  or WhatsApp Business Platform template rules.
                </p>
                <ul className="mt-5 space-y-3 text-sm leading-6">
                  {sources.map((source) => (
                    <li key={source.href}>
                      <a
                        href={source.href}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="font-semibold text-[#08bba4] hover:text-[#07130e]"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-10 overflow-hidden rounded-[32px] bg-[#07130e] p-8 text-white shadow-[0_28px_80px_rgba(7,19,14,0.22)]">
                <h2 className="text-3xl font-extrabold">Turn WhatsApp replies into organized team workflows</h2>
                <p className="mt-4 max-w-2xl leading-8 text-[#d8fff1]">
                  Use TalkWagon to manage shared WhatsApp conversations, customer context, broadcasts, follow-ups,
                  automations, and team permissions from one CRM workspace.
                </p>
                <Link
                  href="/pricing"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#3ddf84] px-6 py-3 font-extrabold text-[#07130e] transition hover:bg-[#ffbd29]"
                >
                  See TalkWagon plans
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
