import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  Headphones,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  Users,
  Webhook,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { HeroBadgeRow } from "@/components/marketing/hero-badge-row";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/features/team-inbox");
const teamInboxImages = {
  hero: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-hero-overview.webp",
  sharedWorkflow: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-shared-workflow.webp",
  agentAssignment: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-agent-assignment.webp",
  contactHistory: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-contact-history.webp",
  followups: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-followups.webp",
  collaboration: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-collaboration.webp",
  analytics: "/hostiko-crm/generated/team-inbox/talk-wagon-team-inbox-analytics.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp Team Inbox for Sales and Support",
  description:
    "Manage WhatsApp customer conversations in a WhatsApp team inbox with agents, assignments, contact history, role-based permissions, and follow-up workflows.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon WhatsApp Team Inbox",
    description:
      "Give your sales and support team a WhatsApp team inbox and shared WhatsApp CRM inbox for customer conversations, assignments, contact history, and follow-up workflows.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: teamInboxImages.hero,
        width: 1168,
        height: 880,
        alt: "Shared WhatsApp team inbox for sales and support agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Wagon WhatsApp Team Inbox",
    description:
      "A WhatsApp team inbox and shared WhatsApp CRM inbox for customer conversations, assignments, contact history, and follow-up workflows.",
    images: [teamInboxImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const trustPills = [
  "Shared Inbox",
  "Agent Assignment",
  "Contact History",
  "Role-Based Access",
  "Follow-Up Workflow",
] as const;

const problems = [
  ["Scattered customer chats", MessageCircle],
  ["No shared team visibility", Users],
  ["Missed follow-ups", Clock3],
  ["No assignment tracking", UserCheck],
  ["Hard to manage agents", Headphones],
  ["No clean customer history", Tags],
] as const;

const solutions = [
  ["Shared WhatsApp conversation workspace", MessageSquareText],
  ["Team agent access", Users],
  ["Conversation assignment workflow", UserCheck],
  ["Customer contact history", Tags],
  ["Follow-up visibility", Clock3],
  ["Secure permission controls", ShieldCheck],
] as const;

const steps = [
  {
    title: "Connect your official WhatsApp API workflow",
    description:
      "Use your approved WhatsApp setup so customer communication flows into one CRM workspace.",
  },
  {
    title: "Import or organize contacts",
    description:
      "Keep names, phone numbers, tags, consent status, and customer context in one place.",
  },
  {
    title: "Receive and manage customer conversations",
    description:
      "Give your team a shared view of incoming customer messages instead of relying on personal chat lists.",
  },
  {
    title: "Assign conversations to team agents",
    description:
      "Route each lead or support request to a clear owner so responsibility is visible.",
  },
  {
    title: "Track follow-up activity",
    description:
      "Keep no-reply follow-ups, next actions, and customer updates organized inside the CRM.",
  },
  {
    title: "Move leads into your pipeline when needed",
    description:
      "Turn important WhatsApp conversations into sales opportunities and track them through each stage.",
  },
] as const;

const useCases = [
  {
    title: "Sales teams",
    description:
      "Manage new leads from WhatsApp, follow up faster, and move opportunities into a pipeline.",
    icon: GitBranch,
  },
  {
    title: "Support teams",
    description:
      "Keep customer questions organized, assign agents, and avoid losing context between conversations.",
    icon: Headphones,
  },
  {
    title: "Agencies",
    description:
      "Manage client communication workflows with team members, contacts, broadcasts, and permissions.",
    icon: Users,
  },
  {
    title: "Service businesses",
    description:
      "Handle customer bookings, follow-ups, reminders, and support messages from one CRM dashboard.",
    icon: Clock3,
  },
] as const;

const detailedFeatures = [
  {
    title: "Conversation Assignment",
    href: "/features/team-inbox",
    description:
      "Assign customer conversations to the right team member so every lead or support request has a clear owner.",
    icon: UserCheck,
  },
  {
    title: "Contact Context",
    href: "/features#contact-management",
    description:
      "See customer information, notes, status, and history alongside the conversation workflow.",
    icon: Tags,
  },
  {
    title: "Agent Dashboards",
    href: "/features#permissions",
    description:
      "Give team members access to the tools they need without showing sensitive owner/admin settings.",
    icon: Users,
  },
  {
    title: "Follow-Up Workflow",
    href: "/features/automation",
    description:
      "Keep no-reply follow-ups, customer updates, and next actions organized inside the CRM.",
    icon: Clock3,
  },
  {
    title: "Role-Based Permissions",
    href: "/features#permissions",
    description:
      "Control access to contacts, conversations, broadcasts, settings, and team tools.",
    icon: KeyRound,
  },
  {
    title: "Pipeline Connection",
    href: "/features#sales-pipeline",
    description:
      "Turn important conversations into deals and track progress through your sales pipeline.",
    icon: GitBranch,
  },
] as const;

const automationActions = [
  "Send Template",
  "Add Tag",
  "Assign Conversation",
  "Update Contact Field",
  "Create Deal",
  "Wait",
  "If/Else Condition",
  "Send Webhook",
  "Close Conversation",
] as const;

const faqs = [
  {
    question: "What is a WhatsApp team inbox?",
    answer:
      "A WhatsApp team inbox lets multiple team members manage customer conversations from one shared WhatsApp CRM workspace instead of relying on scattered personal chats.",
  },
  {
    question: "Can I assign WhatsApp conversations to agents?",
    answer:
      "Yes. Talk Wagon is built for team workflows where owners and managers can assign conversations and control what agents can access.",
  },
  {
    question: "Can agents see all CRM settings?",
    answer:
      "No. Agents only see what their permissions allow. Sensitive workspace, admin, and configuration settings can stay protected.",
  },
  {
    question: "Does the team inbox connect with contacts?",
    answer:
      "Yes. Customer conversations are connected with contact management so your team can keep customer details, notes, and follow-up context organized.",
  },
  {
    question: "Can the team inbox work with automation?",
    answer:
      "Yes. You can connect team inbox workflows with WhatsApp automation, follow-up automation, contact updates, conversation assignment, deal creation, and webhooks.",
  },
  {
    question: "Is this suitable for sales and support teams?",
    answer:
      "Yes. Sales teams can manage leads and follow-ups, while support teams can handle customer questions and service workflows in one CRM dashboard.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon WhatsApp Team Inbox",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "A WhatsApp team inbox and CRM workspace for shared customer conversations, agent assignments, contact history, role-based permissions, follow-up workflows, and pipeline connection.",
  offers: {
    "@type": "Offer",
    category: "WhatsApp CRM for teams",
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
      name: "WhatsApp Team Inbox",
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

export default function TeamInboxPage() {
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

      <PublicHeader active="team-inbox" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.96),rgba(27,55,43,0.82),rgba(7,19,14,0.96))]"
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
                  <Link className="text-white" href="/features/team-inbox">
                    Team Inbox
                  </Link>
                </li>
              </ol>
            </nav>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <MessageSquareText className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp team inbox for sales, support and agencies
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp Team Inbox for Sales, Support and Follow-Ups
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Give sales and support agents one shared WhatsApp CRM inbox where customer
              conversations, contact history, assignments, permissions, and follow-up
              workflows stay organized.
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
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-sm font-bold text-white hover:bg-white hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Login to Dashboard
              </Link>
            </div>
            <HeroBadgeRow items={trustPills} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={teamInboxImages.hero}
              alt="Shared WhatsApp team inbox for sales and support agents"
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
              Manual WhatsApp Work Gets Messy When Your Team Grows
            </h2>
            <p className="mt-4 text-[#5b7169]">
              When customer messages are spread across personal phones, agents,
              spreadsheets, and manual notes, follow-ups are missed and teams lose
              visibility. Talk Wagon turns WhatsApp communication into a structured CRM
              workflow.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {problems.map(([title, Icon]) => (
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
              One Shared Inbox for Every WhatsApp Customer Conversation
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon helps teams manage customer conversations from one workspace.
              Owners can create agents, control permissions, assign conversations, and
              keep customer context visible without exposing sensitive CRM settings.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {solutions.map(([title, Icon]) => (
                <div key={title} className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{title}</span>
                </div>
              ))}
            </div>
          </div>
          <Image
            src={teamInboxImages.sharedWorkflow}
            alt="Shared WhatsApp team inbox workflow with agent assignment"
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
            <p className="text-sm font-bold uppercase text-[#08bba4]">Customer context and productivity</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Keep History and Team Performance Visible
            </h2>
            <p className="mt-4 text-[#5b7169]">
              A useful team inbox is more than a message list. Agents need customer
              history, follow-up context, and performance visibility so every reply is
              easier to prioritize.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[30px] bg-[#f7fbf8] p-4 ring-1 ring-[#dbe9e2]">
              <Image
                src={teamInboxImages.contactHistory}
                alt="Customer contact history beside a WhatsApp CRM conversation"
                width={1168}
                height={880}
                loading="lazy"
                className="h-auto w-full rounded-[24px]"
              />
              <h3 className="mt-5 px-2 text-xl font-extrabold text-[#07130e]">
                Contact history beside every conversation
              </h3>
              <p className="px-2 pb-2 pt-2 text-sm leading-7 text-[#5b7169]">
                See previous messages, notes, tags, deals, and follow-up context while
                your team handles the chat.
              </p>
            </article>
            <article className="rounded-[30px] bg-[#f7fbf8] p-4 ring-1 ring-[#dbe9e2]">
              <Image
                src={teamInboxImages.analytics}
                alt="Team inbox analytics for response times and open conversations"
                width={1168}
                height={880}
                loading="lazy"
                className="h-auto w-full rounded-[24px]"
              />
              <h3 className="mt-5 px-2 text-xl font-extrabold text-[#07130e]">
                Team inbox productivity signals
              </h3>
              <p className="px-2 pb-2 pt-2 text-sm leading-7 text-[#5b7169]">
                Track open conversations, resolved chats, response activity, and team
                workload without losing the customer workflow.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">How it works</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              How the Talk Wagon Team Inbox Works
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-[28px] bg-[#0d1b15] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffbd29] text-base font-extrabold text-[#07130e]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#d5e9e2]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={teamInboxImages.collaboration}
            alt="Team collaboration inside a shared WhatsApp CRM inbox"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Agent permissions</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Give Agents the Right Access — Nothing More
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon is built for teams that need control. Owners can create agent
              accounts, assign permissions, and decide what each team member can access
              inside the CRM.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Owner-created agent accounts",
                "Temporary password setup",
                "Forced password change on first login",
                "Permission-based dashboard",
                "Protected admin settings",
                "Workspace-based access",
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-[22px] bg-[#f7fbf8] p-5 ring-1 ring-[#dbe9e2]">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Use cases</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Built for Sales Teams, Support Teams and Agencies
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {useCases.map((useCase) => (
              <article key={useCase.title} className="rounded-[28px] bg-white p-6 ring-1 ring-[#dbe9e2]">
                <useCase.icon className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-extrabold text-[#07130e]">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{useCase.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Team Inbox Features</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Team Inbox Features Inside Talk Wagon
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {detailedFeatures.map((feature) => (
                <article key={feature.title} className="rounded-[24px] bg-[#f7fbf8] p-5 ring-1 ring-[#dbe9e2]">
                  <feature.icon className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-4 font-extrabold text-[#07130e]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5b7169]">{feature.description}</p>
                  <Link
                    href={feature.href}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                  >
                    Learn more
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
          <Image
            src={teamInboxImages.agentAssignment}
            alt="WhatsApp conversation assignment workflow"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Comparison</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Shared Team Inbox vs Manual WhatsApp Handling
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[30px] bg-[#0d1b15] p-7">
              <h3 className="text-2xl font-extrabold">Manual WhatsApp</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#d5e9e2]">
                {[
                  "Messages stay on personal devices",
                  "Hard to assign responsibility",
                  "Follow-ups are easy to miss",
                  "No central contact history",
                  "No agent permission control",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ffbd29]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-[30px] bg-white p-7 text-[#07130e]">
              <h3 className="text-2xl font-extrabold">Talk Wagon Team Inbox</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#5b7169]">
                {[
                  "Shared CRM workspace",
                  "Team agent assignment",
                  "Organized customer history",
                  "Follow-up workflows",
                  "Permission-based access",
                  "Pipeline and automation connection",
                ].map((item) => (
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

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={teamInboxImages.followups}
            alt="Team inbox follow-up workflow with pending replies and reminders"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Automation connection</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Connect Your Team Inbox With Automation
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              The team inbox becomes more powerful when connected with Talk Wagon
              automation. Trigger follow-ups, assign conversations, update contact fields,
              create deals, send webhooks, and keep customer workflows moving.
            </p>
            <Link
              href="/features/automation"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
            >
              Explore automation workflows
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="mt-8 flex flex-wrap gap-3">
              {automationActions.map((action) => (
                <span key={action} className="inline-flex items-center gap-2 rounded-full bg-[#f7fbf8] px-4 py-3 text-sm font-bold text-[#07130e] ring-1 ring-[#dbe9e2]">
                  {action === "Send Webhook" ? (
                    <Webhook className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                  ) : action === "Assign Conversation" ? (
                    <UserCheck className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                  ) : action === "Add Tag" ? (
                    <Tags className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                  ) : (
                    <Bot className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                  )}
                  {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp Team Inbox FAQ
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
              Shared WhatsApp inbox for real teams
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Bring Your WhatsApp Conversations Into One Team Inbox
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Start managing customer conversations, agents, contacts, follow-ups, and
              pipeline activity from one organized WhatsApp CRM workspace.
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
