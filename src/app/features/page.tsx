import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Radio,
  Rocket,
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

const canonicalUrl = getCanonicalUrl("/features");
const featureImages = {
  hero: "/hostiko-crm/generated/features/talk-wagon-features-hero-overview.webp",
  teamInbox: "/hostiko-crm/generated/features/talk-wagon-features-team-inbox.webp",
  contacts: "/hostiko-crm/generated/features/talk-wagon-features-contact-management.webp",
  broadcasts: "/hostiko-crm/generated/features/talk-wagon-features-broadcasts.webp",
  automation: "/hostiko-crm/generated/features/talk-wagon-features-ai-automation.webp",
  pipeline: "/hostiko-crm/generated/features/talk-wagon-features-sales-pipeline.webp",
  permissions: "/hostiko-crm/generated/features/talk-wagon-features-permissions.webp",
  flows: "/hostiko-crm/generated/flows/talk-wagon-flows-builder-nodes.webp",
  templates: "/hostiko-crm/generated/flows/talk-wagon-flows-meta-template-submission.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp CRM Features for Teams, Flows and Broadcasts",
  description:
    "Explore Talk Wagon WhatsApp CRM features for shared inboxes, contacts, visual flows, approved broadcasts, Meta template approval, automation, agent permissions, analytics, and pipeline tracking.",
  keywords: [
    "WhatsApp CRM features",
    "WhatsApp automation flows",
    "WhatsApp team inbox",
    "WhatsApp broadcast CRM",
    "Meta WhatsApp template approval",
    "customer journey automation",
    "sales pipeline CRM",
    "WhatsApp CRM for teams",
  ],
  category: "Business software",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon WhatsApp CRM Features for Growing Teams",
    description:
      "Discover WhatsApp CRM tools for shared inboxes, contacts, visual flows, approved broadcasts, Meta template approval, automation, permissions, analytics, and pipeline tracking.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: featureImages.hero,
        width: 1168,
        height: 880,
        alt: "Talk Wagon CRM features overview dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Wagon WhatsApp CRM Features for Growing Teams",
    description:
      "WhatsApp CRM features for shared inboxes, contacts, visual flows, approved broadcasts, Meta template approval, automation, permissions, analytics, and pipeline tracking.",
    images: [featureImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const heroPills = [
  "Team Inbox",
  "Contacts",
  "Flows",
  "Broadcasts",
  "Meta Templates",
  "AI Automation",
  "Pipeline",
  "Permissions",
] as const;

const featureCards = [
  {
    title: "WhatsApp Team Inbox",
    icon: MessageSquareText,
    href: "/features/team-inbox",
    description:
      "Manage customer chats in a shared inbox instead of scattered phones. Agents can work assigned conversations, managers can monitor queues, and every customer message stays connected to CRM history.",
  },
  {
    title: "Flows",
    icon: GitBranch,
    href: "/features/flows",
    description:
      "Create visual WhatsApp automation flows for follow-ups, reminders, routing, approved template messages, and customer journeys. Teams can connect triggers, conditions, waits, actions, and run history in one builder.",
  },
  {
    title: "Contact Management",
    icon: Users,
    href: "/features#contact-management",
    description:
      "Store customer names, phones, tags, consent status, and activity in one searchable workspace. Imports, pagination, selection tools, and safe bulk actions help large lists stay manageable.",
  },
  {
    title: "Broadcast Campaigns",
    icon: Radio,
    href: "/features/broadcasts",
    description:
      "Prepare WhatsApp template broadcasts with eligibility checks, consent controls, preflight review, queue processing, and live delivery updates. This gives campaigns structure before they reach customers.",
  },
  {
    title: "Meta Template Approval",
    icon: Tags,
    href: "/features/flows#meta-template-submission",
    description:
      "Create WhatsApp message templates, submit them to Meta/Facebook for approval, sync approved templates back into the CRM, and use them inside broadcasts or automation flows.",
  },
  {
    title: "AI Workflow Automation",
    icon: Bot,
    href: "/features/automation",
    description:
      "Automate repetitive customer workflows such as welcome replies, keyword responses, assignment, tagging, follow-ups, webhooks, and deal creation. Automation reduces manual work while keeping agents in control.",
  },
  {
    title: "Sales Pipeline",
    icon: GitBranch,
    href: "/features#sales-pipeline",
    description:
      "Track WhatsApp leads from first message to quote, payment pending, won, or lost. Deals can be assigned to agents so sales work is visible and follow-ups do not disappear.",
  },
  {
    title: "Team Agents",
    icon: UserCheck,
    href: "/features#permissions",
    description:
      "Create team member accounts for sales or support agents without sharing the owner password. Agents get their own login, workspace access, and first-login password change flow.",
  },
  {
    title: "Role-Based Permissions",
    icon: KeyRound,
    href: "/features#permissions",
    description:
      "Control which tabs and actions each member can use, including inbox, contacts, broadcasts, automations, pipeline, settings, and team management. Owners can keep sensitive tools limited.",
  },
  {
    title: "Workspace Security",
    icon: LockKeyhole,
    href: "/features#permissions",
    description:
      "Each company workspace keeps contacts, conversations, templates, broadcasts, pricing, automations, and agents separated. Team members use workspace data without seeing platform admin areas.",
  },
  {
    title: "Admin Approval Flow",
    icon: ShieldCheck,
    href: "/features#permissions",
    description:
      "New company owners can sign up, then wait for platform approval before accessing the CRM. This protects production access while keeping the customer onboarding path clean.",
  },
  {
    title: "Reports and Recent Sent",
    icon: Clock3,
    href: "/features",
    description:
      "Review recent sent activity, broadcast status, recipient outcomes, automation logs, and pipeline progress. These views help owners spot what happened without refreshing pages constantly.",
  },
  {
    title: "Webhooks and Automation Actions",
    icon: Webhook,
    href: "/features/automation",
    description:
      "Use automation steps that send webhooks, update contacts, close conversations, assign work, and create deals. This connects WhatsApp conversations with wider business workflows.",
  },
] as const;

const automationActions = [
  ["Send Message", "Send a normal WhatsApp reply when the conversation context allows it."],
  ["Send Template", "Send an approved WhatsApp template with mapped variables."],
  ["Add Tag", "Mark contacts with labels such as Interested, Support, or Follow Up."],
  ["Remove Tag", "Clean up tags when a contact no longer fits a segment."],
  ["Assign Conversation", "Route a chat to a specific agent, round-robin pool, or least-busy member."],
  ["Update Contact Field", "Change CRM contact details as part of a workflow."],
  ["Create Deal", "Open a sales pipeline deal when a lead shows buying intent."],
  ["Wait", "Pause a workflow for a defined delay before continuing."],
  ["Condition If/Else", "Branch a workflow based on contact, message, or tag conditions."],
  ["Send Webhook", "Notify another business system when the automation reaches a step."],
  ["Close Conversation", "Close a conversation after a resolved support or sales workflow."],
] as const;

const useCases = [
  "Welcome new WhatsApp leads and assign them to the right agent.",
  "Auto-reply when a customer asks for price, cost, package, VPS, or RDP details.",
  "Send approved template follow-ups after a customer has gone quiet.",
  "Tag interested customers and move them into a sales pipeline.",
  "Run opted-in broadcast campaigns with preflight checks before queueing.",
  "Separate owner, manager, sales, and support dashboards by permission.",
  "Track payment-pending deals so no order waits unnoticed.",
  "Use webhooks to connect WhatsApp conversations with external tools.",
] as const;

const faqs = [
  {
    question: "What are WhatsApp CRM features?",
    answer:
      "WhatsApp CRM features are tools that help a business manage conversations, contacts, visual flows, broadcasts, automations, agents, permissions, and sales follow-ups from one workspace.",
  },
  {
    question: "Does Talk Wagon support a shared WhatsApp inbox?",
    answer:
      "Yes. Talk Wagon supports a team inbox where owners and permitted agents can view, assign, reply to, and manage WhatsApp conversations.",
  },
  {
    question: "Can I manage WhatsApp contacts in the CRM?",
    answer:
      "Yes. You can organize contacts, search lists, import contacts, manage consent, tag customers, and keep customer details connected to conversations.",
  },
  {
    question: "Can Talk Wagon send WhatsApp broadcasts?",
    answer:
      "Yes. Broadcasts use approved WhatsApp templates, queue processing, preflight checks, recipient eligibility, and live status updates.",
  },
  {
    question: "Does the CRM support WhatsApp template messages?",
    answer:
      "Yes. The CRM can create WhatsApp templates, submit them to Meta/Facebook for approval, sync approved templates back, and use them for broadcasts or automation template sends.",
  },
  {
    question: "Does Talk Wagon support visual automation flows?",
    answer:
      "Yes. Talk Wagon supports visual WhatsApp automation flows for triggers, conditions, waits, approved template messages, team routing, follow-ups, and run history.",
  },
  {
    question: "Can automations reply to keywords?",
    answer:
      "Yes. Keyword automations can match words such as price, cost, support, or buy and then run configured actions.",
  },
  {
    question: "Can I assign agents different permissions?",
    answer:
      "Yes. Workspace owners can create team members and control which features each member can view or manage.",
  },
  {
    question: "Does Talk Wagon include a sales pipeline?",
    answer:
      "Yes. The pipeline helps track leads, deals, assigned agents, stages, and sales progress from WhatsApp conversations.",
  },
  {
    question: "Is this connected to the official Meta WhatsApp Cloud API?",
    answer:
      "Talk Wagon is designed around WhatsApp Business Platform and Meta Cloud API workflows for templates, webhooks, and message handling.",
  },
  {
    question: "Can agents use the owner WhatsApp connection safely?",
    answer:
      "Yes. Agents can use the workspace WhatsApp connection without seeing sensitive API credentials unless the owner explicitly grants connection permissions.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "WhatsApp CRM features for team inboxes, contact management, visual flows, broadcasts, Meta template approval, AI automation, follow-ups, role-based agents, permissions, and sales pipeline tracking.",
  offers: {
    "@type": "Offer",
    category: "WhatsApp CRM",
    availability: "https://schema.org/InStock",
  },
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

function SectionEyebrow({ children }: { readonly children: ReactNode }) {
  return <p className="text-sm font-bold uppercase text-[#08bba4]">{children}</p>;
}

export default function FeaturesPage() {
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

      <PublicHeader active="features" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(61,223,132,0.25),transparent_28%),linear-gradient(90deg,rgba(7,19,14,0.96),rgba(27,55,43,0.82),rgba(7,19,14,0.96))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-25" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-9 sm:px-8 sm:pb-16 sm:pt-12 lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-20">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <Rocket className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp CRM features for growing teams
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp CRM Features for Teams, Automation and Growth
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Explore tools for shared inboxes, contact management, visual flows,
              approved template broadcasts, Meta template approval, automation workflows,
              follow-ups, role-based agents, analytics, and sales pipeline tracking.
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
            <HeroBadgeRow items={heroPills} />
          </div>

          <div className="relative">
            <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
              <Image
                src={featureImages.hero}
                alt="Talk Wagon CRM features overview dashboard"
                width={1168}
                height={880}
                priority
                className="h-auto w-full rounded-[26px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>WhatsApp CRM features</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Everything Your WhatsApp Customer Workflow Needs in One CRM
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Talk Wagon combines daily WhatsApp communication, visual flows,
              team workflows, automation, broadcasts, template approval, permissions,
              and sales tracking so businesses can manage customer growth from one workspace.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[28px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2] transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-[#07130e]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  {feature.description}
                </p>
                <Link
                  href={feature.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                >
                  Learn more
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="visual-flows" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Flows and approved templates</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Build Customer Journeys and Manage Approved Messages Visually
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Connect triggers, conditions, waits, team routing, and approved message
              templates in one workspace, then review how each customer journey runs.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Link
              href="/features/flows"
              className="group overflow-hidden rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ring-[#e1eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#08bba4]"
            >
              <div className="overflow-hidden bg-[#f4fff9]">
                <Image
                  src={featureImages.flows}
                  alt="Talk Wagon visual flow builder with connected customer journey nodes"
                  width={1168}
                  height={880}
                  loading="lazy"
                  className="h-auto w-full transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="text-2xl font-extrabold text-[#07130e]">Visual Flows</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  Design branching customer journeys with triggers, conditions, waits,
                  messages, team assignments, webhooks, and transparent run history.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] group-hover:text-[#07130e]">
                  Explore Flows
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>

            <Link
              href="/features/flows#meta-template-submission"
              className="group overflow-hidden rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ring-[#e1eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#08bba4]"
            >
              <div className="overflow-hidden bg-[#f4fff9]">
                <Image
                  src={featureImages.templates}
                  alt="Talk Wagon message template editor with approval and sync statuses"
                  width={1168}
                  height={880}
                  loading="lazy"
                  className="h-auto w-full transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="text-2xl font-extrabold text-[#07130e]">
                  Template Approval and Sync
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  Create message templates, submit them for approval, track status, sync
                  approved templates, and reuse them in broadcasts or Flows.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] group-hover:text-[#07130e]">
                  See Template Workflow
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section id="team-inbox" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <SectionEyebrow>Team Inbox</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              A Shared WhatsApp Inbox for Sales and Support Teams
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Keep customer conversations organized with assignment, agent access,
              conversation history, and owner-managed visibility. Teams can handle daily
              WhatsApp work without sharing one password or losing customer context.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "My Conversations and Unassigned views",
                "Manual conversation assignment",
                "Workspace-based customer history",
                "Agent permissions for reply and close actions",
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Image
            src={featureImages.teamInbox}
            alt="Shared WhatsApp team inbox for agents and managers"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section id="contact-management" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={featureImages.contacts}
            alt="Contact management with consent badges and safe bulk actions"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <SectionEyebrow>Contact Management</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Organize Contacts With Consent, Search and Safe Bulk Tools
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon keeps contact lists practical for real business use. Import
              contacts, manage workspace data, search and paginate large lists, select
              visible rows, and bulk delete safely when cleanup is needed.
            </p>
            <div className="mt-8 grid gap-4">
              {[
                "Import contacts with WhatsApp opt-in and source fields",
                "Search, paginate, and select visible contacts quickly",
                "Use consent badges for opted-in, not opted-in, and opted-out customers",
                "Bulk delete safely with confirmation and immediate UI updates",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-full bg-[#f7fbf8] px-5 py-4 ring-1 ring-[#e1eee8]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="templates" className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Broadcasts</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Queue WhatsApp Campaigns With Preflight Checks
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Broadcasts use approved templates, opt-in checks, skipped recipient
              reasons, pricing estimates, and server-side queue processing. The result is
              a cleaner send workflow before messages leave your CRM.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Approved template enforcement",
                "Eligible recipient counts",
                "Pricing and missing-rate warnings",
                "Pause, resume, cancel, and retry support",
              ].map((item) => (
                <li key={item} className="rounded-[22px] bg-[#0d1b15] p-5 text-sm font-bold text-white">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Image
            src={featureImages.broadcasts}
            alt="Broadcast campaign CRM for WhatsApp contacts"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
        </div>
      </section>

      <section id="automation" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={featureImages.automation}
            alt="AI automation workflow for customer follow-ups"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <SectionEyebrow>AI Automation</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Automate WhatsApp Follow-Ups and CRM Workflows
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Build keyword replies, welcome messages, waits, template follow-ups,
              assignment rules, tag actions, deal creation, and webhook flows. Automation
              helps teams respond faster while preserving opt-out and permission safety.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {["First inbound message", "Keyword match", "Tag added", "Time-based schedules"].map((item) => (
                <div key={item} className="rounded-[22px] border border-[#dbe9e2] bg-[#f7fbf8] p-5">
                  <Bot className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-3 font-extrabold text-[#07130e]">{item}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="sales-pipeline" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <SectionEyebrow>Sales Pipeline</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Track Leads From WhatsApp Message to Won Deal
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Connect conversations and contacts with deals so sales teams can track lead
              value, assigned agent, status, and next steps. Pipeline work becomes visible
              instead of being hidden in chat threads.
            </p>
            <div className="mt-8 grid gap-4">
              {["New lead", "Qualified", "Quotation sent", "Payment pending", "Won or lost"].map((item) => (
                <div key={item} className="flex items-center gap-4 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <GitBranch className="h-5 w-5 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Image
            src={featureImages.pipeline}
            alt="Sales pipeline dashboard for WhatsApp CRM leads"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section id="permissions" className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={featureImages.permissions}
            alt="Workspace permissions and team agents"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Team Agents and Permissions</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Give Agents Access Without Sharing Owner Credentials
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Workspace owners can create agent accounts with temporary passwords, force a
              first-login password change, and choose the dashboard areas each member can
              access.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Owner-created agent accounts with a temporary password",
                "Forced password change before the agent enters the CRM",
                "Permission-based dashboard access for inbox, contacts, pipeline, broadcasts, settings, and team tools",
                "Workspace WhatsApp connection is managed by the owner unless own connection access is allowed",
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-[22px] bg-[#0d1b15] p-5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                  <span className="text-sm font-bold text-white">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Automation Actions</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Practical Actions for Real WhatsApp CRM Workflows
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Automations are useful when they do concrete business work. These actions
              help Talk Wagon move a customer from message to tag, assignment, follow-up,
              webhook, or deal.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {automationActions.map(([title, description]) => (
              <article key={title} className="rounded-[24px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]">
                <h3 className="text-lg font-extrabold text-[#07130e]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Comparison</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Manual WhatsApp vs Talk Wagon CRM
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[30px] bg-white p-7 ring-1 ring-[#dbe9e2]">
              <h3 className="text-2xl font-extrabold text-[#07130e]">Manual WhatsApp</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#5b7169]">
                {[
                  "Chats live on individual phones or scattered accounts.",
                  "No clear owner for new leads or support requests.",
                  "Follow-ups depend on memory and manual notes.",
                  "Broadcast readiness, opt-in status, and pricing are hard to verify.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ffbd29]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-[30px] bg-[#1b372b] p-7 text-white shadow-[0_20px_60px_rgba(7,19,14,0.16)]">
              <h3 className="text-2xl font-extrabold">Talk Wagon CRM</h3>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#d5e9e2]">
                {[
                  "A shared workspace keeps chats, contacts, deals, and agents together.",
                  "Owners can assign conversations and control team permissions.",
                  "Automations handle keyword replies, waits, tags, templates, and webhooks.",
                  "Broadcast preflight checks eligibility, pricing, and final queue counts.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Use Cases</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Built for WhatsApp Sales, Support and Growth Teams
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {useCases.map((item) => (
              <div key={item} className="flex gap-4 rounded-[24px] bg-[#f7fbf8] p-5 ring-1 ring-[#dbe9e2]">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                <span className="text-sm font-bold text-[#07130e]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp CRM Features FAQ
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
              WhatsApp CRM features ready for production
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Ready to Run WhatsApp Sales and Support From One CRM?
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Start with a workspace, connect your WhatsApp workflow, organize contacts,
              assign agents, and automate the follow-ups your team repeats every day.
            </p>
          </div>
          <PublicCtaButtons
            primaryLabel="Start For Free"
            primaryHref="/signup"
            secondaryLabel="Login to Dashboard"
            secondaryHref="/login"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
