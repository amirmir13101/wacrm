import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  Radio,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  Users,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { authenticatedRedirectPath } from "@/lib/auth/approval";
import { createClient } from "@/lib/supabase/server";

const siteUrl = "https://vpscoaster.live";
const canonicalUrl = `${siteUrl}/`;
const homeImages = {
  hero: "/hostiko-crm/generated/talk-wagon-home-hero-dashboard.webp",
  teamInbox: "/hostiko-crm/generated/talk-wagon-home-team-inbox.webp",
  broadcasts: "/hostiko-crm/generated/talk-wagon-home-broadcast-campaigns.webp",
  automation: "/hostiko-crm/generated/talk-wagon-home-automation-workflows.webp",
  pipeline: "/hostiko-crm/generated/talk-wagon-home-sales-pipeline.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation",
  description:
    "Manage WhatsApp customer conversations, team inboxes, contacts, broadcasts, templates, AI workflows, follow-ups, and sales pipelines from one production-ready CRM dashboard.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Production-Ready WhatsApp CRM for Teams and Automation",
    description:
      "Organize WhatsApp conversations, manage contacts, assign team agents, send broadcasts, automate follow-ups, and track sales pipelines from one CRM platform.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: homeImages.hero,
        width: 2336,
        height: 1744,
        alt: "WhatsApp CRM dashboard with customer conversations and automation workflows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Production-Ready WhatsApp CRM for Teams and Automation",
    description:
      "Manage WhatsApp conversations, contacts, team agents, broadcasts, templates, AI workflows, and sales pipelines from one CRM dashboard.",
    images: [homeImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const workflowPills = [
  { label: "Team Inbox", icon: MessageSquareText, href: "/features/team-inbox" },
  { label: "Contacts", icon: Users, href: "/features#contact-management" },
  { label: "Broadcasts", icon: Radio, href: "/features/broadcasts" },
  { label: "Templates", icon: Tags, href: "/features#templates" },
  { label: "AI Automation", icon: Bot, href: "/features/automation" },
  { label: "Follow-Ups", icon: Clock3, href: "/features/automation" },
  { label: "Sales Pipeline", icon: GitBranch, href: "/features#sales-pipeline" },
  { label: "Agent Permissions", icon: ShieldCheck, href: "/features#permissions" },
];

const featureCards = [
  {
    title: "WhatsApp Team Inbox",
    description:
      "Manage customer messages in one shared CRM inbox with agents, assignments, conversation history, and permission-based access.",
    icon: MessageSquareText,
    image: homeImages.teamInbox,
    alt: "Shared WhatsApp team inbox for agents and managers",
    href: "/features/team-inbox",
  },
  {
    title: "Contact Management",
    description:
      "Import, organize, search, paginate, select, and bulk manage contacts inside secure workspace-based accounts.",
    icon: Users,
    image: homeImages.hero,
    alt: "WhatsApp CRM dashboard with customer conversations and automation workflows",
    href: "/features#contact-management",
  },
  {
    title: "Broadcast Campaigns",
    description:
      "Send approved WhatsApp template campaigns to selected contacts and track delivery workflow status from the CRM.",
    icon: Radio,
    image: homeImages.broadcasts,
    alt: "Broadcast campaign CRM for WhatsApp contacts",
    href: "/features/broadcasts",
  },
  {
    title: "AI Workflow Automation",
    description:
      "Automate repetitive follow-ups, lead routing, status updates, webhooks, and customer communication tasks.",
    icon: Bot,
    image: homeImages.automation,
    alt: "AI automation workflow for customer follow-ups",
    href: "/features/automation",
  },
  {
    title: "Sales Pipeline",
    description:
      "Track leads, deals, follow-ups, and customer stages from one simple sales pipeline CRM connected to conversations.",
    icon: GitBranch,
    image: homeImages.pipeline,
    alt: "Sales pipeline dashboard for WhatsApp CRM leads",
    href: "/features#sales-pipeline",
  },
  {
    title: "Role-Based Team Access",
    description:
      "Create team agents, force first-login password changes, assign permissions, and control what each member can view or manage.",
    icon: KeyRound,
    image: homeImages.teamInbox,
    alt: "Permission-based CRM workspace for team agents",
    href: "/features#permissions",
  },
];

const automationSteps = [
  "Import or add contacts",
  "Segment customers",
  "Send approved templates",
  "Trigger follow-ups",
  "Assign conversations",
  "Track pipeline results",
];

const plans = [
  {
    title: "Starter CRM",
    audience: "For small teams",
    description: "Manage contacts and customer conversations in one WhatsApp CRM workspace.",
    features: ["Shared inbox foundation", "Contact management CRM", "Customer conversation tracking"],
  },
  {
    title: "Team CRM",
    audience: "For growing businesses",
    description: "Add agents, role-based permissions, broadcasts, templates, and sales pipelines.",
    features: ["Team agent CRM", "WhatsApp broadcast CRM", "Sales pipeline CRM"],
    highlighted: true,
  },
  {
    title: "Automation CRM",
    audience: "For workflow-focused teams",
    description: "Use WhatsApp workflow automation, AI automation planning, and follow-up workflows.",
    features: ["WhatsApp automation", "Automated customer follow-ups", "AI automation CRM workflows"],
  },
];

const faqs = [
  {
    question: "What is a WhatsApp CRM?",
    answer:
      "A WhatsApp CRM helps businesses organize customer conversations, contacts, team agents, broadcasts, follow-ups, and sales activity in one dashboard.",
  },
  {
    question: "Can my team manage WhatsApp conversations together?",
    answer:
      "Yes. The CRM supports team agents, role-based permissions, shared workspace access, and conversation assignment workflows.",
  },
  {
    question: "Can I send WhatsApp broadcast campaigns?",
    answer:
      "Yes. You can prepare contact lists and send approved WhatsApp template-based campaigns while keeping customer data organized.",
  },
  {
    question: "Does this CRM support automation?",
    answer:
      "Yes. It is built for follow-up automation, workflow triggers, customer updates, agent assignment, and AI-powered automation planning.",
  },
  {
    question: "Is it suitable for sales and support teams?",
    answer:
      "Yes. Sales teams can manage leads and pipelines, while support teams can handle customer conversations and follow-ups from one workspace.",
  },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "Production-ready WhatsApp CRM for team inboxes, contact management, broadcast campaigns, AI workflow automation, customer follow-ups, team agent permissions, and sales pipeline tracking.",
  offers: {
    "@type": "Offer",
    category: "Business messaging CRM",
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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status, account_type, must_change_password")
      .eq("user_id", user.id)
      .maybeSingle();

    redirect(authenticatedRedirectPath(profile));
  }

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

      <PublicHeader active="home" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.94),rgba(27,55,43,0.78),rgba(7,19,14,0.96))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.22)_9%,rgba(127,185,169,0.22)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <ShieldCheck className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              Official Meta WhatsApp API style CRM workflows
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Manage customer conversations, contacts, WhatsApp team inboxes,
              broadcast campaigns, templates, AI workflows, follow-ups, and sales
              pipelines from one production-ready CRM dashboard.
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
            <p className="mt-6 text-sm text-[#b8cfc7]">
              Built for businesses that use WhatsApp for sales, support, marketing,
              and customer follow-ups.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
              <Image
                src={homeImages.hero}
                alt="WhatsApp CRM dashboard with customer conversations and automation workflows"
                width={2336}
                height={1744}
                priority
                className="h-auto w-full rounded-[26px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-extrabold text-[#07130e] sm:text-4xl">
            Build Your WhatsApp CRM Workflow
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-[#5b7169]">
            Start with your customer conversations, organize contacts, assign agents,
            send template-based broadcasts, automate follow-ups, and track every lead
            through your sales pipeline.
          </p>
          <div className="mx-auto mt-8 rounded-[30px] bg-white p-4 shadow-[0_20px_70px_rgba(7,19,14,0.14)] ring-1 ring-[#dbe9e2]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workflowPills.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-full bg-[#f4fff9] px-4 py-4 text-left text-sm font-bold text-[#07130e] ring-1 ring-[#dce9e2] hover:bg-[#eafff3] hover:ring-[#3ddf84] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/features"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#3ddf84] px-7 text-sm font-bold text-[#07130e] hover:bg-[#1fc86f]"
              >
                Explore CRM Features
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#ffbd29] px-7 text-sm font-bold text-[#07130e] hover:bg-[#e9aa1c]"
              >
                Create Workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Customer conversation management
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Everything Your WhatsApp Sales and Support Team Needs
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Replace scattered tools with one organized WhatsApp CRM built for
              conversations, contacts, broadcasts, automations, and team workflows.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((card) => (
              <article
                id={
                  card.title === "WhatsApp Team Inbox"
                    ? "team-inbox"
                    : card.title === "Broadcast Campaigns"
                      ? "broadcasts"
                      : card.title === "AI Workflow Automation"
                        ? "automation"
                        : undefined
                }
                key={card.title}
                className="group flex h-full flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ring-[#e1eee8]"
              >
                <div className="bg-[#1b372b] p-5 text-white">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                      <card.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-extrabold">{card.title}</h3>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-5 overflow-hidden rounded-[22px] bg-[#f4fff9]">
                    <Image
                      src={card.image}
                      alt={card.alt}
                      width={640}
                      height={430}
                      loading="lazy"
                      className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="text-sm leading-7 text-[#5b7169]">{card.description}</p>
                  <Link
                    href={card.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e]"
                  >
                    Learn more
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">
              WhatsApp workflow automation
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Automate Follow-Ups Without Losing the Human Touch
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Build WhatsApp workflows for welcome messages, no-reply follow-ups,
              contact updates, deal creation, agent assignment, webhooks, and
              customer lifecycle automation.
            </p>
            <Link
              href="/features/automation"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#3ddf84] hover:text-[#ffbd29]"
            >
              Explore automation features
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2">
              {automationSteps.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-[24px] bg-[#0d1b15] p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffbd29] font-extrabold text-[#07130e]">
                    {index + 1}
                  </span>
                  <span className="self-center text-sm font-bold text-white">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <Image
            src={homeImages.automation}
            alt="AI automation workflow for customer follow-ups"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={homeImages.teamInbox}
            alt="Shared WhatsApp team inbox for agents and managers"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Shared inbox for WhatsApp
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              A Shared WhatsApp Team Inbox for Modern Businesses
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Give agents a permission-based workspace where they can manage assigned
              conversations, update contacts, follow up with customers, and collaborate
              without exposing sensitive admin settings.
            </p>
            <Link
              href="/features/team-inbox"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e]"
            >
              Learn about the team inbox
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["My conversations", UserCheck],
                ["Unassigned queue", Headphones],
                ["Role-based CRM", LockKeyhole],
                ["Conversation history", MessageCircle],
              ].map(([label, Icon]) => (
                <div key={label as string} className="rounded-[22px] border border-[#dbe9e2] bg-[#f7fbf8] p-5">
                  <Icon className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-3 font-extrabold text-[#07130e]">{label as string}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              WhatsApp broadcast CRM
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Launch WhatsApp Broadcast Campaigns With More Control
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Prepare template-based campaigns, select the right contacts, estimate
              sending workflow, track sent status, and keep customer communication
              organized inside the CRM.
            </p>
            <Link
              href="/features/broadcasts"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#08745d] hover:text-[#07130e]"
            >
              Explore broadcast campaigns
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="mt-8 grid gap-4">
              {[
                "Approved WhatsApp templates",
                "Contact consent and eligibility checks",
                "Recent sent and broadcast reporting",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-full bg-white px-5 py-4 shadow-sm ring-1 ring-[#e1eee8]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Image
            src={homeImages.broadcasts}
            alt="Broadcast campaign CRM for WhatsApp contacts"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section id="pipeline" className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={homeImages.pipeline}
            alt="Sales pipeline dashboard for WhatsApp CRM leads"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">
              WhatsApp sales automation
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Turn Conversations Into Sales Pipeline Progress
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Move leads from first message to follow-up, deal stage, conversion, or
              lost status. Keep your WhatsApp customer journey visible from contact to
              close.
            </p>
            <Link
              href="/features#sales-pipeline"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#3ddf84] hover:text-[#ffbd29]"
            >
              See sales pipeline features
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="mt-8 grid gap-4">
              {[
                ["Lead stages", GitBranch],
                ["Assigned deal owners", UserCheck],
                ["Customer follow-up tracking", Clock3],
              ].map(([label, Icon]) => (
                <div key={label as string} className="flex gap-4 rounded-[24px] bg-[#0d1b15] p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="self-center font-extrabold text-white">{label as string}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">
              Pricing preview
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Simple CRM Plans for Growing WhatsApp Teams
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Choose the CRM workflow level that matches your current business stage.
              Full pricing details can be added when your commercial plans are ready.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.title}
                className={`rounded-[30px] p-6 shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ${
                  plan.highlighted
                    ? "bg-[#1b372b] text-white ring-[#1b372b]"
                    : "bg-[#f7fbf8] text-[#07130e] ring-[#e1eee8]"
                }`}
              >
                <p className={`text-sm font-bold ${plan.highlighted ? "text-[#ffbd29]" : "text-[#08bba4]"}`}>
                  {plan.audience}
                </p>
                <h3 className="mt-3 text-2xl font-extrabold">{plan.title}</h3>
                <p className={`mt-4 text-sm leading-7 ${plan.highlighted ? "text-[#d5e9e2]" : "text-[#5b7169]"}`}>
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`mt-7 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-bold ${
                    plan.highlighted
                      ? "bg-[#3ddf84] text-[#07130e] hover:bg-[#ffbd29]"
                      : "bg-[#181818] text-white hover:bg-[#ffbd29] hover:text-[#07130e]"
                  }`}
                >
                  View Pricing
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Questions</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp CRM Questions, Answered
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
              Production-ready WhatsApp CRM
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Ready to Manage WhatsApp Customers From One CRM?
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Bring conversations, contacts, broadcasts, agents, automations, and
              pipelines into one production-ready WhatsApp CRM dashboard.
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
