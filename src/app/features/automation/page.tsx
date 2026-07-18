import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  KeyRound,
  MessageSquareText,
  Repeat2,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  Webhook,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { HeroBadgeRow } from "@/components/marketing/hero-badge-row";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/features/automation");
const automationImages = {
  hero: "/hostiko-crm/generated/automation/talk-wagon-automation-hero-overview.webp",
  triggerBuilder: "/hostiko-crm/generated/automation/talk-wagon-automation-trigger-action-builder.webp",
  smartRouting: "/hostiko-crm/generated/automation/talk-wagon-automation-smart-routing.webp",
  followUps: "/hostiko-crm/generated/automation/talk-wagon-automation-follow-up-workflows.webp",
  ifElse: "/hostiko-crm/generated/automation/talk-wagon-automation-if-else-conditions.webp",
  analytics: "/hostiko-crm/generated/automation/talk-wagon-automation-analytics.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp Automation Software for CRM Follow-Ups",
  description:
    "Use WhatsApp automation software for follow-ups, contact updates, agent assignment, tags, deals, webhooks, wait steps, and customer workflows.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon WhatsApp Automation Software for CRM Follow-Ups",
    description:
      "Build WhatsApp automation workflows for follow-ups, contacts, agents, deals, conditions, webhooks, and customer communication.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: automationImages.hero,
        width: 1168,
        height: 880,
        alt: "AI WhatsApp automation workflow for customer follow-ups and CRM actions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Wagon WhatsApp Automation Software for CRM Follow-Ups",
    description:
      "WhatsApp automation for follow-ups, contacts, agents, deals, conditions, webhooks, and CRM actions.",
    images: [automationImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const trustPills = [
  "Follow-Up Automation",
  "AI Workflows",
  "Webhooks",
  "Agent Assignment",
  "Deal Creation",
] as const;

const problemCards = [
  ["Missed no-reply follow-ups", Clock3],
  ["Repetitive customer messages", Repeat2],
  ["Manual agent assignment", UserCheck],
  ["Slow lead routing", Route],
  ["Disconnected tools", Webhook],
  ["No clear workflow logic", Bot],
] as const;

const solutionCards = [
  ["Follow-up automation", Clock3, "/features/automation"],
  ["Contact field updates", Tags, "/features#contact-management"],
  ["Conversation assignment", UserCheck, "/features/team-inbox"],
  ["Deal creation", GitBranch, "/features#sales-pipeline"],
  ["Webhook actions", Webhook, "/features/automation"],
  ["If/Else conditions", Route, "/features/automation"],
  ["Wait steps", Repeat2, "/features/automation"],
  ["Template-based messaging", Send, "/features/broadcasts"],
] as const;

const automationActions = [
  {
    title: "Send Message",
    description:
      "Send a normal WhatsApp response when the conversation context allows your team to reply directly.",
    icon: MessageSquareText,
  },
  {
    title: "Send Template",
    description:
      "Use approved WhatsApp templates for consistent follow-ups, reminders, and structured customer messages.",
    icon: Send,
  },
  {
    title: "Add Tag",
    description:
      "Mark contacts as Interested, New Lead, Support, Renewal, or any segment your team uses.",
    icon: Tags,
  },
  {
    title: "Remove Tag",
    description:
      "Clean up old segments automatically when a customer moves to a new stage or no longer matches a group.",
    icon: Tags,
  },
  {
    title: "Assign Conversation",
    description:
      "Route a customer chat to a specific agent, a round-robin queue, or the least-busy team member.",
    icon: UserCheck,
  },
  {
    title: "Update Contact Field",
    description:
      "Change CRM details such as status, source, interest level, or follow-up notes as the workflow runs.",
    icon: KeyRound,
  },
  {
    title: "Create Deal",
    description:
      "Open a sales opportunity when a WhatsApp lead asks for price, service details, renewal, or purchase help.",
    icon: GitBranch,
  },
  {
    title: "Wait",
    description:
      "Pause a workflow for a planned delay before sending a follow-up or moving to the next action.",
    icon: Clock3,
  },
  {
    title: "Condition If/Else",
    description:
      "Branch customer journeys based on message content, tags, contact fields, or workflow outcomes.",
    icon: Route,
  },
  {
    title: "Send Webhook",
    description:
      "Use a webhook as a controlled WhatsApp CRM integration point when a workflow reaches an important step.",
    icon: Webhook,
  },
  {
    title: "Close Conversation",
    description:
      "Close resolved customer conversations after a support answer, follow-up sequence, or completed handoff.",
    icon: CheckCircle2,
  },
] as const;

const workflows = [
  {
    title: "No-Reply Follow-Up",
    steps: [
      "Customer asks for pricing",
      "Agent replies with plan details",
      "Workflow waits before checking for a response",
      "Approved template follow-up is sent if the customer stays quiet",
    ],
  },
  {
    title: "New Lead Routing",
    steps: [
      "A fresh WhatsApp lead sends a message",
      "CRM adds a New Lead tag",
      "Conversation is assigned to the right sales agent",
      "A pipeline deal is created for follow-up tracking",
    ],
  },
  {
    title: "Broadcast Follow-Up",
    steps: [
      "Customer replies to a broadcast campaign",
      "CRM updates the contact status",
      "Interested contacts are tagged",
      "Sales follow-up workflow starts automatically",
    ],
  },
  {
    title: "Support Escalation",
    steps: [
      "Customer uses a support keyword",
      "Conversation moves to a support agent",
      "Webhook notifies another system if needed",
      "Conversation is closed after the issue is resolved",
    ],
  },
] as const;

const comparison = {
  manual: [
    "Repeated messages",
    "Forgotten follow-ups",
    "Manual assignments",
    "Slow lead tracking",
    "No clear workflow history",
  ],
  talkWagon: [
    "Automatic follow-ups",
    "Template-based messages",
    "Agent assignment",
    "Contact updates",
    "Deal creation",
    "Webhook integration",
    "Consistent workflow tracking",
  ],
} as const;

const faqs = [
  {
    question: "What is WhatsApp automation?",
    answer:
      "WhatsApp automation uses rules, triggers, delays, and CRM actions to handle repetitive customer communication tasks such as follow-ups, tagging, assignment, and deal creation.",
  },
  {
    question: "Can Talk Wagon automate follow-ups?",
    answer:
      "Yes. Talk Wagon can run follow-up workflows with waits, approved template messages, contact updates, tags, and assignment steps.",
  },
  {
    question: "Can automations assign conversations to agents?",
    answer:
      "Yes. Automations can assign conversations to a specific team member, a round-robin rotation, or the least-busy available agent.",
  },
  {
    question: "Can I use approved WhatsApp templates in automation?",
    answer:
      "Yes. Template automation is designed for approved WhatsApp templates, including variable mapping for customer details such as name or phone.",
  },
  {
    question: "Can automation update contact fields?",
    answer:
      "Yes. Automation can update contact fields and tags so your customer records stay aligned with the latest conversation workflow.",
  },
  {
    question: "How can webhooks support a WhatsApp CRM integration?",
    answer:
      "The Send Webhook action can notify a configured external system when a workflow reaches a specific step, providing a controlled integration point without exposing workspace credentials.",
  },
  {
    question: "Is AI automation included in Talk Wagon?",
    answer:
      "Talk Wagon supports AI-assisted workflow planning, WhatsApp chatbot handoff patterns, and smarter CRM automation patterns while keeping owners in control of the final workflow.",
  },
  {
    question: "Can I use automation for sales and support workflows?",
    answer:
      "Yes. Sales teams can automate lead routing and follow-ups, while support teams can automate assignment, tagging, escalation, and closure workflows.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon WhatsApp Automation",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "WhatsApp automation software and AI CRM workflows for customer follow-ups, WhatsApp chatbot handoff patterns, agent assignment, contact updates, deal creation, webhooks, template messaging, and sales or support processes.",
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
      item: getCanonicalUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Features",
      item: getCanonicalUrl("/features"),
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "WhatsApp Automation",
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

export default function AutomationFeaturePage() {
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

      <PublicHeader active="automation" />

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
                  <Link className="text-white" href="/features/automation">
                    Automation
                  </Link>
                </li>
              </ol>
            </nav>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <Bot className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp automation for sales and support workflows
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp Automation for Follow-Ups and CRM Workflows
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Automate repetitive WhatsApp CRM tasks such as no-reply follow-ups,
              agent assignment, contact updates, tags, deal creation, webhooks, and
              customer lifecycle actions from one organized dashboard.
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
            <HeroBadgeRow items={trustPills} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={automationImages.hero}
              alt="AI WhatsApp automation workflow for customer follow-ups and CRM actions"
              width={1168}
              height={880}
              priority
              className="h-auto w-full rounded-[26px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">The problem</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Manual Follow-Ups Slow Down Every WhatsApp Team
            </h2>
            <p className="mt-4 text-[#5b7169]">
              When teams rely on memory, spreadsheets, and manual reminders, customer
              replies get delayed, leads are missed, and agents repeat the same tasks
              again and again.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {problemCards.map(([title, Icon]) => (
              <article key={title} className="rounded-[26px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]">
                <Icon className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-extrabold text-[#07130e]">{title}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">The solution</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Turn Customer Communication Into Automated CRM Workflows
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon turns customer messages, tags, templates, assignments, waits,
              deals, and webhooks into repeatable workflows that help your team move
              faster without losing control.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {solutionCards.map(([title, Icon, href]) => (
                <Link
                  key={title}
                  href={href}
                  className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2] hover:ring-[#3ddf84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{title}</span>
                </Link>
              ))}
            </div>
          </div>
          <Image
            src={automationImages.triggerBuilder}
            alt="Talk Wagon automation trigger and action builder workflow"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Automation actions</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Automation Actions Built for Real Business Workflows
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Build WhatsApp workflow automation with practical CRM steps your sales and
              support teams understand.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {automationActions.map((action) => (
              <article key={action.title} className="rounded-[28px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]">
                <action.icon className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-extrabold text-[#07130e]">{action.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{action.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Example workflows</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Example WhatsApp Automation Workflows
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <article key={workflow.title} className="rounded-[30px] bg-[#0d1b15] p-7">
                <h3 className="text-2xl font-extrabold text-white">{workflow.title}</h3>
                <ul className="mt-6 space-y-4 text-sm leading-7 text-[#d5e9e2]">
                  {workflow.steps.map((step) => (
                    <li key={step} className="flex gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Image
              src={automationImages.ifElse}
              alt="Talk Wagon if else automation condition workflow"
              width={1168}
              height={880}
              loading="lazy"
              className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
            />
            <Image
              src={automationImages.analytics}
              alt="Talk Wagon automation analytics and workflow performance dashboard"
              width={1168}
              height={880}
              loading="lazy"
              className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={automationImages.followUps}
            alt="Talk Wagon follow-up automation workflow dashboard"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">AI automation</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              AI-Assisted Automation for Smarter CRM Workflows
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon helps teams plan smarter WhatsApp automation workflows, improve
              follow-up consistency, segment customers better, and create repeatable
              customer journeys while keeping owners in control.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "AI workflow planning",
                "Smarter follow-up suggestions",
                "Faster workflow creation",
                "Better customer segmentation",
                "Repeatable customer journeys",
                "Owner-controlled automation",
              ].map((item) => (
                <div key={item} className="rounded-[22px] bg-[#f7fbf8] p-5 text-sm font-bold text-[#07130e] ring-1 ring-[#dbe9e2]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Team safety</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Automation With Team Permissions and Workspace Control
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Owners can decide which team members can view, create, edit, or activate
              automations. Agents stay inside their permitted dashboard while sensitive
              workspace settings and WhatsApp configuration remain protected.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Owner permissions",
                "Agent restrictions",
                "Workspace security",
                "Protected WhatsApp config",
                "Controlled automation access",
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Image
            src={automationImages.smartRouting}
            alt="Talk Wagon smart conversation routing and team assignment automation"
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
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Comparison</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Manual CRM Work vs Automated WhatsApp Workflows
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[30px] bg-[#0d1b15] p-7">
              <h3 className="text-2xl font-extrabold">Manual CRM Work</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#d5e9e2]">
                {comparison.manual.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ffbd29]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-[30px] bg-white p-7 text-[#07130e]">
              <h3 className="text-2xl font-extrabold">Talk Wagon Automation</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#5b7169]">
                {comparison.talkWagon.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp Automation FAQ
            </h2>
          </div>
          <div className="mt-10 grid gap-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[24px] border border-[#dbe9e2] bg-white p-6 shadow-[0_10px_35px_rgba(7,19,14,0.05)]"
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
              WhatsApp automation for repeatable customer journeys
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Build Smarter WhatsApp Workflows With Talk Wagon
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Start automating follow-ups, assignments, contact updates, deals, and
              customer workflow steps from one secure WhatsApp CRM dashboard.
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
