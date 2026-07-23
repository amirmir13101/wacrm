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
  const found = getBlogArticle("whatsapp-away-message-examples");
  if (!found) {
    throw new Error("Article data missing: whatsapp-away-message-examples");
  }
  return found;
}

const article = getArticleOrThrow();

const articleImages = {
  hero: article.image,
  schedule: {
    src: "/hostiko-crm/generated/blog/talk-wagon-whatsapp-away-message-schedule.webp",
    width: 1600,
    height: 900,
    alt: "Illustrated WhatsApp Business away-message settings with business-hours schedule, exceptions, recipient controls, and message preview",
    caption:
      "A reliable away message combines accurate hours, a clear reply expectation, sensible recipients, and a message that has been tested before launch.",
  },
  examples: {
    src: "/hostiko-crm/generated/blog/talk-wagon-away-message-examples.webp",
    width: 1600,
    height: 900,
    alt: "Illustrated library of professional WhatsApp away-message examples for after-hours support, weekends, holidays, sales, appointments, ecommerce, delays, and urgent requests",
    caption:
      "The strongest away message reflects the actual reason for the delay and gives the customer one practical next step.",
  },
  handoff: {
    src: "/hostiko-crm/generated/blog/talk-wagon-away-message-human-handoff.webp",
    width: 1600,
    height: 900,
    alt: "Illustrated customer workflow showing an automatic away response followed by shared inbox routing, contact context, and human handoff",
    caption:
      "Automation should acknowledge the customer and preserve context; a person should take over when the team is available or the conversation needs judgment.",
  },
} as const;

type ArticleImage = (typeof articleImages)[keyof typeof articleImages];

const setupSteps = [
  {
    step: "1",
    title: "Open Business tools",
    detail: "Open WhatsApp Business and go to the business tools or business settings area.",
  },
  {
    step: "2",
    title: "Choose Away message",
    detail: "Open the away-message setting and turn on the option to send an away reply.",
  },
  {
    step: "3",
    title: "Write the reply",
    detail: "State that the team is unavailable, when it expects to return, and what the customer can send now.",
  },
  {
    step: "4",
    title: "Set the schedule",
    detail: "Choose always, a custom period, or outside business hours when those options are available.",
  },
  {
    step: "5",
    title: "Choose recipients",
    detail: "Review who should receive the message so customers do not get an irrelevant or repeated reply.",
  },
  {
    step: "6",
    title: "Save and test",
    detail: "Send a customer-like test outside the scheduled hours and verify the timing, wording, and next step.",
  },
] as const;

const examples = [
  {
    title: "After-hours customer support",
    copy:
      "Thanks for contacting [Company name]. Our support team is currently offline and will be back at [Opening time] on [Day]. Please send your account or order reference and a short description of the issue. We will review it when the team returns.",
    note: "Use this when support is unavailable overnight. Replace every placeholder and avoid promising an exact response time unless the team can meet it.",
  },
  {
    title: "Weekend away message",
    copy:
      "Hello, you have reached [Company name] outside our weekend support hours. We reopen on [Day] at [Time]. You can leave your name, order number, and question now, and our team will follow up after reopening.",
    note: "A weekend message should name the reopening day instead of relying on a vague phrase such as soon.",
  },
  {
    title: "Holiday closure",
    copy:
      "Thank you for messaging [Company name]. We are closed for [Holiday] from [Start date] to [End date]. Normal service resumes on [Return date]. For urgent matters covered by [Urgent-support policy], contact [Approved alternative contact].",
    note: "Only include an alternative channel when it is monitored and approved for that type of request.",
  },
  {
    title: "Sales enquiry after hours",
    copy:
      "Thanks for your interest in [Company name]. Our sales team is away right now and returns at [Time/Day]. Please share the product or service you are considering, your location, and any deadline. A sales representative will review your message when the team is online.",
    note: "This collects useful qualification details without pretending that a salesperson is currently available.",
  },
  {
    title: "Appointment or booking request",
    copy:
      "Thanks for contacting [Company name]. Our booking desk is closed at the moment. Please send your preferred service, date, time, and location. We will confirm availability after [Opening time]. Your appointment is not confirmed until our team replies.",
    note: "The final sentence prevents an automated acknowledgement from being mistaken for a confirmed booking.",
  },
  {
    title: "Ecommerce order enquiry",
    copy:
      "We have received your message. Our order-support team is currently away. Please send your order number, the email or phone used at checkout, and the help you need. We will check the order after [Opening time]. Do not share card details or passwords in chat.",
    note: "Collect only the information needed to locate the order and include a simple safety reminder.",
  },
  {
    title: "Unexpected response delay",
    copy:
      "Thanks for your patience. We are receiving more enquiries than usual, so replies may take up to [Realistic time range]. Your message is in the queue; there is no need to send it again. If your situation changes, add the new detail in this chat.",
    note: "Use a delay message temporarily and only when the stated time range reflects current operations.",
  },
  {
    title: "Small local business",
    copy:
      "Hi, thanks for messaging [Business name]. We are closed right now and reopen [Day] at [Time]. Please tell us which service you need and your preferred area or appointment time. We will reply when we are back.",
    note: "This straightforward version works for many local services without sounding like a large call center.",
  },
  {
    title: "Urgent or emergency boundary",
    copy:
      "This WhatsApp inbox is not monitored continuously and cannot provide emergency assistance. If there is an immediate risk to health or safety, contact your local emergency service. For non-emergency enquiries, leave your details and our team will reply during [Business hours].",
    note: "Businesses in sensitive sectors should have this wording reviewed against their own policies and local obligations.",
  },
] as const;

const faqs = [
  {
    question: "What is a WhatsApp away message?",
    answer:
      "A WhatsApp away message is an automated reply that tells customers a business is unavailable or outside its response hours. It should explain when the team expects to return and what the customer can do next.",
  },
  {
    question: "What should I write in a WhatsApp Business away message?",
    answer:
      "Include a short acknowledgement, the reason or timing of the absence, realistic business hours or a return date, and one useful next step. Avoid promising a reply time your team cannot reliably meet.",
  },
  {
    question: "Is an away message the same as a greeting message?",
    answer:
      "No. A greeting message welcomes a new or returning customer. An away message sets expectations because the team is currently unavailable. The two messages should have different wording and purposes.",
  },
  {
    question: "Can WhatsApp Business send an automatic reply outside business hours?",
    answer:
      "The WhatsApp Business app includes away-message scheduling options. The exact labels and choices can vary by app version and device, so confirm the current options inside Business tools and test the schedule from another account.",
  },
  {
    question: "Should I include an emergency contact in an away message?",
    answer:
      "Only include an alternative contact if it is approved, monitored, and appropriate for the request. If the inbox is not an emergency service, say so clearly rather than implying continuous monitoring.",
  },
  {
    question: "Do WhatsApp away messages need Meta template approval?",
    answer:
      "An away message configured in the WhatsApp Business app is different from a WhatsApp Business Platform message template. Platform templates have separate category, content, and approval requirements.",
  },
] as const;

const sources = [
  {
    label: "WhatsApp Help Center: away messages",
    href: "https://faq.whatsapp.com/2565868990219715",
  },
  {
    label: "WhatsApp Help Center: greeting messages",
    href: "https://faq.whatsapp.com/501866148528310",
  },
  {
    label: "WhatsApp Business resource library: onboarding with the app",
    href: "https://whatsappbusiness.com/resources/resource-library/onboarding-success-whatsapp-business-app/",
  },
  {
    label: "Meta for Developers: WhatsApp templates overview",
    href: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview",
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

export default function WhatsAppAwayMessageArticlePage() {
  const articleUrl = getCanonicalUrl(article.path);

  return (
    <>
      <JsonLdScript
        id="article-02-blogposting-json-ld"
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description,
          image: getCanonicalUrl(article.image.src),
          datePublished: article.publishedDate,
          dateModified: article.updatedDate,
          author: { "@type": "Organization", name: article.author },
          publisher: {
            "@type": "Organization",
            name: "Talk Wagon",
            logo: {
              "@type": "ImageObject",
              url: getCanonicalUrl("/hostiko-crm/brand/talk-wagon-logo-public.png"),
            },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: article.title, url: article.path },
        ]}
      />
      <FaqJsonLd id="article-02-faq-json-ld" faqs={faqs} />
      <PublicHeader active="blog" />
      <main className="bg-[#f7fbf8] text-[#07130e]">
        <article>
          <section className="relative overflow-hidden bg-[#07130e] px-5 py-16 text-white sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(61,223,132,0.24),transparent_34%),linear-gradient(135deg,#07130e,#123226)]" />
            <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
              <div>
                <nav className="text-sm font-semibold text-[#d8fff1]" aria-label="Breadcrumb">
                  <Link href="/" className="hover:text-[#3ddf84]">Home</Link>
                  <span className="mx-2 text-[#7fb9a9]">/</span>
                  <Link href="/blog" className="hover:text-[#3ddf84]">Blog</Link>
                </nav>
                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#3ddf84]/35 bg-white/8 px-4 py-2 text-sm font-semibold text-[#d8fff1]">
                  <Sparkles className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
                  Practical guidance for clear after-hours replies
                </div>
                <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  WhatsApp Away Messages: Professional Examples and Setup Guide
                </h1>
                <p className="mt-6 text-lg leading-8 text-[#d8fff1]">
                  A professional WhatsApp away message confirms that the message arrived, explains when the team
                  is unavailable, and gives the customer a useful next step. This guide covers setup, scheduling,
                  original examples, writing advice, and the handoff from automation to a real person.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#b8cfc7]">
                  <span>{article.author}</span>
                  <span aria-hidden="true">•</span>
                  <time dateTime={article.publishedDate}>Published July 23, 2026</time>
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
                  <li><a href="#what-it-is" className="hover:text-[#08bba4]">What an away message does</a></li>
                  <li><a href="#comparison" className="hover:text-[#08bba4]">Away vs greeting</a></li>
                  <li><a href="#setup" className="hover:text-[#08bba4]">Setup and scheduling</a></li>
                  <li><a href="#examples" className="hover:text-[#08bba4]">Professional examples</a></li>
                  <li><a href="#checklist" className="hover:text-[#08bba4]">Writing checklist</a></li>
                  <li><a href="#faq" className="hover:text-[#08bba4]">FAQ</a></li>
                </ol>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="max-w-none space-y-10 text-lg leading-8 text-[#315345]">
                <section id="what-it-is">
                  <p className="text-xl leading-9">
                    An away message is an automatic acknowledgement for a period when your business cannot respond
                    normally. It should not imitate a live agent. It should make the delay understandable, state
                    when a reply is likely, and help the customer leave the information your team will need later.
                  </p>
                  <h2 className="mt-10 text-3xl font-extrabold text-[#07130e]">What is a WhatsApp away message?</h2>
                  <p className="mt-4">
                    The WhatsApp Business app includes an away-message feature within its business tools. A business
                    can write an automatic reply, choose a schedule, and select recipients using the options offered
                    in the installed app version. The message is useful after working hours, over a weekend, during
                    a holiday closure, or whenever normal response times temporarily change.
                  </p>
                  <p className="mt-4">
                    A good WhatsApp Business away message is operational, not decorative. It answers three questions:
                    Is anyone available now? When should the customer expect the team to return? What information can
                    the customer provide while waiting? That structure works for a clinic, ecommerce store, agency,
                    course provider, local service, SaaS company, restaurant, or any other business with defined
                    response hours.
                  </p>
                  <h2 className="mt-10 text-3xl font-extrabold text-[#07130e]">When should a business use one?</h2>
                  <ul className="mt-5 list-disc space-y-3 pl-6">
                    <li>Outside the hours when a person actively monitors the business inbox.</li>
                    <li>During weekends, public holidays, staff training, or a planned closure.</li>
                    <li>When an unexpected service interruption creates a longer response queue.</li>
                    <li>For specialist teams that answer only on certain days or within certain time zones.</li>
                    <li>When the team needs customers to leave an order number, booking request, or case detail.</li>
                  </ul>
                  <p className="mt-4">
                    Do not turn on a generic business closed message for WhatsApp and forget it. Review the schedule
                    when hours change, remove expired holiday dates, and test whether the message reaches the intended
                    recipients. Outdated hours can be more frustrating than no automatic reply at all.
                  </p>
                </section>

                <section id="comparison">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Away message vs greeting message</h2>
                  <p className="mt-4">
                    A greeting welcomes a new or returning customer. An away message explains a temporary lack of
                    availability. A platform template is different again: it is an approved WhatsApp Business
                    Platform asset used under Meta&apos;s template rules. Keeping these purposes separate prevents a
                    customer from receiving a cheerful welcome that sounds like live support when nobody is online.
                  </p>
                  <div className="my-8 overflow-hidden rounded-[26px] border border-[#dbe9e2] bg-white shadow-[0_18px_50px_rgba(7,19,14,0.08)]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-[#f4fff9] text-[#07130e]">
                          <tr>
                            <th className="px-5 py-4 font-extrabold">Message type</th>
                            <th className="px-5 py-4 font-extrabold">Purpose</th>
                            <th className="px-5 py-4 font-extrabold">Core information</th>
                            <th className="px-5 py-4 font-extrabold">Typical timing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dbe9e2] text-[#315345]">
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Away message</td>
                            <td className="px-5 py-4">Set expectations while the team is unavailable.</td>
                            <td className="px-5 py-4">Return time, response expectation, next step.</td>
                            <td className="px-5 py-4">Outside hours or during a closure.</td>
                          </tr>
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Greeting message</td>
                            <td className="px-5 py-4">Welcome a new or returning customer.</td>
                            <td className="px-5 py-4">Welcome, business identity, first useful question.</td>
                            <td className="px-5 py-4">At the beginning of the customer relationship.</td>
                          </tr>
                          <tr>
                            <td className="px-5 py-4 font-bold text-[#07130e]">Platform template</td>
                            <td className="px-5 py-4">Send a categorized business-initiated message through the API.</td>
                            <td className="px-5 py-4">Approved content, variables, category, and language.</td>
                            <td className="px-5 py-4">According to platform messaging and template rules.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p>
                    Need help with the welcome that starts a conversation? Read our separate guide to{" "}
                    <Link href="/blog/whatsapp-business-greeting-message-examples" className="font-semibold text-[#08bba4]">
                      WhatsApp Business greeting message examples
                    </Link>
                    . It covers welcome wording, first questions, and greeting-specific setup without duplicating
                    the after-hours guidance here. For reusable saved responses that agents choose during a live
                    conversation, use the separate{" "}
                    <Link href="/blog/whatsapp-business-quick-replies" className="font-semibold text-[#08bba4]">
                      WhatsApp Business quick replies guide
                    </Link>
                    .
                  </p>
                </section>

                <section id="setup">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">How to set up a WhatsApp Business away message</h2>
                  <p className="mt-4">
                    Menu labels can vary by operating system and app version. WhatsApp&apos;s current help guidance places
                    the feature under Business tools. Use the sequence below as a practical check, then confirm the
                    labels shown on your own device.
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
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3ddf84]/45 bg-[#eafff4] text-sm font-extrabold text-[#07130e]">{item.step}</span>
                          <div>
                            <h3 className="text-lg font-extrabold text-[#07130e]">{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[#5b7169]">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-8 text-2xl font-extrabold text-[#07130e]">Choose a schedule that matches real coverage</h3>
                  <p className="mt-4">
                    An always-on schedule is suitable only when every incoming chat genuinely needs the same notice.
                    A custom schedule is useful for a holiday, event, or temporary closure. Outside-business-hours
                    scheduling is usually the cleanest option for recurring evenings and weekends, but it depends on
                    accurate business hours. Consider time zones if customers and agents are in different markets.
                  </p>
                  <p className="mt-4">
                    Recipient settings matter too. Review whether the automatic reply should go to everyone, people
                    outside the address book, selected contacts, or another audience available in the app. Test from
                    a separate customer account instead of assuming the rule works as expected.
                  </p>
                </section>
              </div>

              <EditorialImage image={articleImages.schedule} />

              <div className="max-w-none space-y-10 text-lg leading-8 text-[#315345]">
                <section id="examples">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Professional WhatsApp away message examples</h2>
                  <p className="mt-4">
                    These are original templates to adapt, not messages to publish unchanged. Replace bracketed
                    placeholders with verified details. Remove any sentence your team cannot honor, and keep the
                    final version short enough to scan on a phone.
                  </p>
                </section>
              </div>

              <div className="mt-8 grid gap-5">
                {examples.map((example) => (
                  <section key={example.title} className="rounded-[28px] border border-[#dbe9e2] bg-white p-6 shadow-[0_18px_50px_rgba(7,19,14,0.07)]">
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
                  <h2 className="text-3xl font-extrabold text-[#07130e]">How to write an away message customers can use</h2>
                  <p className="mt-4">
                    Start with the operational truth. If the business is closed, say it is closed. If replies are
                    delayed, say they are delayed. Then give a useful time reference such as a reopening date,
                    support hours, or a realistic range. Finish with one action that helps the next person: provide
                    an order number, describe the issue, share a preferred appointment time, or select the relevant
                    service.
                  </p>
                  <div className="my-8 grid gap-4 md:grid-cols-3">
                    {[
                      {
                        icon: Clock3,
                        title: "Be precise about timing",
                        text: "Use a real day, time, date, or response range. Avoid soon when the customer needs to plan.",
                      },
                      {
                        icon: MessageSquareText,
                        title: "Ask for one useful action",
                        text: "Request the minimum context needed for follow-up instead of presenting a long questionnaire.",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Set safe boundaries",
                        text: "Do not imply emergency coverage, booking confirmation, or continuous monitoring when none exists.",
                      },
                    ].map((item) => (
                      <div key={item.title} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5 shadow-[0_12px_36px_rgba(7,19,14,0.06)]">
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
                    <li>Calling the reply instant support when no person is monitoring the inbox.</li>
                    <li>Leaving an old holiday date or an incorrect reopening time in the message.</li>
                    <li>Using the same copy for the greeting and away message, causing contradictory expectations.</li>
                    <li>Promising a response within minutes when the real queue may take hours or days.</li>
                    <li>Asking customers to send passwords, payment-card details, or unnecessary personal data.</li>
                    <li>Giving an alternative number or email that nobody checks during the closure.</li>
                    <li>Making the automatic reply so long that the return time and next step are hard to find.</li>
                    <li>Forgetting to test the schedule, time zone, recipients, and mobile formatting.</li>
                  </ul>
                </section>

                <section id="checklist">
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Away-message publishing checklist</h2>
                  <p className="mt-4">
                    Read the message once as a customer and once as the agent who will inherit the chat. The customer
                    should understand the delay, while the agent should receive enough context to continue without
                    asking the customer to repeat everything.
                  </p>
                </section>
              </div>

              <div className="mt-8 rounded-[30px] border border-[#3ddf84]/35 bg-[#0d1b15] p-6 text-white shadow-[0_24px_70px_rgba(7,19,14,0.18)]">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    "The reason or timing of the absence is clear.",
                    "The reopening time or response window is accurate.",
                    "The customer has one useful next step.",
                    "No unmonitored emergency route is presented as live help.",
                    "Every placeholder has been replaced with verified information.",
                    "The schedule and recipients were tested from a customer-like chat.",
                    "The message is readable on a small screen.",
                    "A team member owns the follow-up queue after reopening.",
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
                  <h2 className="text-3xl font-extrabold text-[#07130e]">Move from automatic acknowledgement to human follow-up</h2>
                  <p className="mt-4">
                    An automatic reply handles the waiting period; it does not resolve the conversation. When the
                    team returns, agents need a clear queue, ownership, and the customer context collected earlier.
                    For a growing team, this is where a shared inbox and workflow tools become more useful than a
                    single phone with a basic automatic reply.
                  </p>
                  <p className="mt-4">
                    TalkWagon supports shared WhatsApp conversation handling, contact context, assignment, workflow
                    automation, visual flows, tags, and human handoff. A business can use those capabilities to route
                    an enquiry and preserve context after the away period. TalkWagon does not make a closed team
                    available; your schedule, staffing, and escalation policy still need to reflect real operations.
                  </p>
                  <p className="mt-4">
                    Explore the{" "}
                    <Link href="/features/team-inbox" className="font-semibold text-[#08bba4]">WhatsApp team inbox</Link>
                    ,{" "}
                    <Link href="/features/automation" className="font-semibold text-[#08bba4]">automation workflows</Link>
                    ,{" "}
                    <Link href="/features/flows" className="font-semibold text-[#08bba4]">visual flow builder</Link>
                    , and{" "}
                    <Link href="/use-cases/sales" className="font-semibold text-[#08bba4]">WhatsApp sales CRM</Link>
                    {" "}to see how follow-up can be organized after the initial automatic reply.
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
                  Product menus and platform requirements can change. These official resources are the reference
                  points used to distinguish app away messages, greetings, and WhatsApp Business Platform templates.
                </p>
                <ul className="mt-5 space-y-3 text-sm leading-6">
                  {sources.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} rel="noopener noreferrer" target="_blank" className="font-semibold text-[#08bba4] hover:text-[#07130e]">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-10 overflow-hidden rounded-[32px] bg-[#07130e] p-8 text-white shadow-[0_28px_80px_rgba(7,19,14,0.22)]">
                <h2 className="text-3xl font-extrabold">Keep every follow-up visible after your team returns</h2>
                <p className="mt-4 max-w-2xl leading-8 text-[#d8fff1]">
                  Use TalkWagon to organize shared WhatsApp conversations, customer context, assignment, follow-ups,
                  automations, and team permissions in one CRM workspace.
                </p>
                <Link href="/pricing" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#3ddf84] px-6 py-3 font-extrabold text-[#07130e] transition hover:bg-[#ffbd29]">
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
