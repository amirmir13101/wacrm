import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GitBranch,
  MessageSquareText,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Webhook,
} from "lucide-react";

import { HeroBadgeRow } from "@/components/marketing/hero-badge-row";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { getCanonicalUrl, getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const canonicalUrl = getCanonicalUrl("/features/flows");
const flowImages = {
  hero: "/hostiko-crm/generated/flows/talk-wagon-flows-hero-overview.webp",
  builder: "/hostiko-crm/generated/flows/talk-wagon-flows-builder-nodes.webp",
  templates: "/hostiko-crm/generated/flows/talk-wagon-flows-meta-template-submission.webp",
  history: "/hostiko-crm/generated/flows/talk-wagon-flows-run-history.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp Automation Flows & Visual Builder | Talk Wagon",
  description:
    "Build visual WhatsApp automation flows for follow-ups, routing, approved templates, reminders, and customer journeys with Talk Wagon CRM.",
  keywords: [
    "WhatsApp automation flows",
    "WhatsApp flow builder",
    "visual workflow builder",
    "WhatsApp follow-up automation",
    "customer journey automation",
    "WhatsApp template automation",
    "CRM workflow automation",
    "Meta WhatsApp templates",
  ],
  category: "Business software",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "WhatsApp Automation Flows & Visual Builder | Talk Wagon",
    description:
      "Build visual WhatsApp automation flows for follow-ups, routing, approved templates, reminders, and customer journeys with Talk Wagon CRM.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: flowImages.hero,
        width: 1168,
        height: 880,
        alt: "Talk Wagon visual WhatsApp automation flow builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsApp Automation Flows & Visual Builder | Talk Wagon",
    description:
      "Visual WhatsApp automation flows for follow-ups, routing, approved templates, reminders, and customer journeys.",
    images: [flowImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const heroPills = [
  "Visual Builder",
  "If/Else Branching",
  "Approved Templates",
  "Run History",
  "Team Routing",
] as const;

const builderHighlights = [
  {
    title: "Triggers",
    description: "Start a flow from customer messages, tags, statuses, or business events.",
    icon: MessageSquareText,
  },
  {
    title: "Conditions",
    description: "Branch customer journeys with if/else logic based on tags, fields, or behavior.",
    icon: Route,
  },
  {
    title: "Actions",
    description: "Send messages, assign conversations, update contacts, create deals, and call webhooks.",
    icon: Send,
  },
  {
    title: "Wait steps",
    description: "Delay follow-ups and reminders so teams can build realistic customer journeys.",
    icon: Clock3,
  },
] as const;

const automationUseCases = [
  "Follow up with new leads after a customer asks for details.",
  "Remind customers about appointments, bookings, renewals, or next steps.",
  "Route support requests to the right team or agent.",
  "Nurture prospects based on tags, stages, and conversation status.",
  "Send approved WhatsApp templates inside repeatable customer journeys.",
  "Create or update deals when a customer reaches a sales-ready stage.",
  "Notify external tools with webhook actions when a workflow reaches a milestone.",
  "Pause, review, and improve flows using run history and outcomes.",
] as const;

const businessTypes = [
  "Agencies",
  "Ecommerce teams",
  "Clinics",
  "Local services",
  "Real estate teams",
  "Education and course providers",
  "Support teams",
  "Sales teams",
] as const;

const flowSteps = [
  {
    title: "Choose a trigger",
    description:
      "Start with a customer message, tag, contact update, status change, or another workspace event.",
  },
  {
    title: "Add conditions",
    description:
      "Split journeys by customer type, tag, response, pipeline stage, or support status.",
  },
  {
    title: "Connect actions",
    description:
      "Send approved templates, wait, assign work, create deals, update records, or send a webhook.",
  },
  {
    title: "Monitor every run",
    description:
      "See what happened, where a journey paused, and which steps should be improved.",
  },
] as const;

const templateFeatures = [
  ["Create templates inside CRM", ClipboardCheck],
  ["Submit to Meta/Facebook for approval", ShieldCheck],
  ["Sync approved templates back", RefreshCw],
  ["Use approved templates in flows", Send],
] as const;

const historySignals = [
  ["Successful steps", CheckCircle2],
  ["Waiting branches", Clock3],
  ["Failed actions", Webhook],
  ["Customer journey timeline", BarChart3],
] as const;

const faqs = [
  {
    question: "What is a WhatsApp automation flow?",
    answer:
      "A WhatsApp automation flow is a visual CRM workflow that connects triggers, conditions, waits, messages, approved templates, assignments, contact updates, deals, and webhooks into a repeatable customer journey.",
  },
  {
    question: "Can I build WhatsApp customer journeys without coding?",
    answer:
      "Yes. Talk Wagon provides a visual WhatsApp flow builder so teams can connect workflow steps and manage customer journeys without writing code.",
  },
  {
    question: "Can WhatsApp automation Flows send approved templates?",
    answer:
      "Yes. Approved WhatsApp templates can be connected to Flow actions for structured follow-ups, reminders, and business messages.",
  },
  {
    question: "Can I submit WhatsApp templates to Meta from the CRM?",
    answer:
      "Yes. The CRM supports creating WhatsApp templates, submitting them to Meta/Facebook for approval, and syncing approved templates back into the workspace.",
  },
  {
    question: "Can WhatsApp Flows route conversations to team members?",
    answer:
      "Yes. Flows can help route conversations, assign work, update contact data, and support sales or support handoff workflows based on workspace permissions.",
  },
  {
    question: "Can Flows automate WhatsApp follow-ups and reminders?",
    answer:
      "Yes. Teams can combine message actions, approved templates, wait steps, conditions, and assignments to automate follow-ups, reminders, nurturing, and support handoffs.",
  },
  {
    question: "Can I monitor WhatsApp Flow runs and failures?",
    answer:
      "Yes. Flow run history shows completed, waiting, and failed steps so teams can understand what happened and improve their customer journeys.",
  },
  {
    question: "Are Flows only for one type of business?",
    answer:
      "No. Flows are general-purpose and can support agencies, ecommerce stores, clinics, local service businesses, course providers, real estate teams, sales teams, and support teams.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon Flows",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "Visual WhatsApp automation flows for follow-ups, reminders, template messages, routing, customer journeys, run history, and CRM workflow automation.",
  featureList: [
    "Visual WhatsApp flow builder",
    "Triggers, conditions, actions, and wait steps",
    "Approved WhatsApp template actions",
    "Team routing and customer journey automation",
    "Flow run history and failure monitoring",
  ],
  offers: {
    "@type": "Offer",
    category: "WhatsApp CRM automation",
    availability: "https://schema.org/InStock",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Features",
      item: `${siteUrl}/features`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "WhatsApp Automation Flows",
      item: canonicalUrl,
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function FlowsFeaturePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbf8] text-[#07130e]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <PublicHeader active="flows" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_74%_16%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.97),rgba(27,55,43,0.83),rgba(7,19,14,0.97))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-25" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-9 sm:px-8 sm:pb-16 sm:pt-12 lg:min-h-[670px] lg:grid-cols-[0.94fr_1.06fr] lg:px-10 lg:py-20">
          <div className="text-center lg:text-left">
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b9f8df] lg:justify-start">
                <li>
                  <Link className="hover:text-white" href="/">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link className="hover:text-white" href="/features">
                    Features
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link className="text-white" href="/features/flows">
                    Flows
                  </Link>
                </li>
              </ol>
            </nav>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <GitBranch className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp flow builder for sales, support and customer journeys
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Visual WhatsApp Automation Flows for Follow-Ups, Routing and Customer Journeys
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Design automated WhatsApp CRM workflows for follow-ups, reminders,
              routing, approved template messages, customer nurturing, and support
              handoffs without repetitive manual work.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3ddf84] px-7 text-sm font-bold text-[#07130e] hover:bg-[#ffbd29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start Free Trial
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/features"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-sm font-bold text-white hover:bg-white hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                View All Features
              </Link>
            </div>
            <HeroBadgeRow items={heroPills} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={flowImages.hero}
              alt="Talk Wagon visual WhatsApp automation flow builder"
              width={1168}
              height={880}
              priority
              className="h-auto w-full rounded-[26px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Visual Flow Builder</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Build Flows by Connecting Triggers, Conditions and Actions
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Create customer journeys visually by connecting blocks on a canvas. A
              business can decide what starts a flow, when it should branch, and which
              customer action should happen next.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {builderHighlights.map((item) => (
                <article key={item.title} className="rounded-[24px] bg-[#f7fbf8] p-5 ring-1 ring-[#dbe9e2]">
                  <item.icon className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-4 font-extrabold text-[#07130e]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5b7169]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
          <Image
            src={flowImages.builder}
            alt="Flow builder canvas with trigger, condition, action, wait and webhook nodes"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Automate customer conversations
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Follow-Ups, Reminders, Routing and Lead Nurturing in One Workflow
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Flows help teams reduce repeated manual work while keeping every customer
              journey connected to contacts, conversations, templates, and CRM history.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {automationUseCases.map((item) => (
              <div key={item} className="flex gap-4 rounded-[24px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                <span className="text-sm font-bold leading-7 text-[#07130e]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={flowImages.templates}
            alt="WhatsApp template manager with Meta approval and sync workflow"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
          <div id="meta-template-submission">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">
              WhatsApp Template Integration
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Create Templates, Submit to Meta and Use Approved Messages in Flows
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Teams can create WhatsApp message templates inside the CRM, submit them to
              Meta/Facebook for approval, sync approved templates back into the workspace,
              and connect those templates to flow actions.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {templateFeatures.map(([title, Icon]) => (
                <article key={title} className="rounded-[22px] bg-[#0d1b15] p-5">
                  <Icon className="h-6 w-6 text-[#3ddf84]" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-extrabold text-white">{title}</h3>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Smart conditions and branching
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Segment Customers and Route Journeys Based on What They Do
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Branch flows with clear if/else style logic, then route customers by
              behavior, tags, contact data, support status, or sales pipeline stage.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {flowSteps.map((step, index) => (
              <article key={step.title} className="rounded-[28px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-base font-extrabold text-[#07130e]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-[#07130e]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Flow Runs / History
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Monitor What Happened and Improve Automation Over Time
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Flow history helps teams understand which steps completed, which actions
              paused, where a journey failed, and how customer follow-ups can be improved.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {historySignals.map(([title, Icon]) => (
                <div key={title} className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{title}</span>
                </div>
              ))}
            </div>
          </div>
          <Image
            src={flowImages.history}
            alt="Flow run history dashboard with customer journey timeline and run signals"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Business use cases</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              General-Purpose Automation for Many Business Types
            </h2>
            <p className="mt-4 text-[#d5e9e2]">
              Flows are not built for one industry. They help any business turn repeated
              WhatsApp customer steps into consistent, trackable workflows.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {businessTypes.map((item) => (
              <article key={item} className="rounded-[24px] bg-[#0d1b15] p-5">
                <Tags className="h-5 w-5 text-[#3ddf84]" aria-hidden="true" />
                <h3 className="mt-4 text-sm font-extrabold text-white">{item}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Flows FAQ
            </h2>
          </div>
          <div className="mt-10 grid gap-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[24px] border border-[#dbe9e2] bg-[#f7fbf8] p-6 shadow-[0_10px_35px_rgba(7,19,14,0.05)]"
              >
                <h3 className="text-lg font-extrabold text-[#07130e]">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ffbd29] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#07130e]/10 px-3 py-1 text-sm font-bold text-[#07130e]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Visual automation for customer journeys
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Ready to Build WhatsApp Flows for Your Team?
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Design follow-ups, reminders, routing, approved templates, and customer
              journeys from one secure Talk Wagon CRM workspace.
            </p>
          </div>
          <PublicCtaButtons
            primaryLabel="Start For Free"
            primaryHref="/signup"
            secondaryLabel="View All Features"
            secondaryHref="/features"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
