import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { authenticatedRedirectPath } from "@/lib/auth/approval";
import { createClient } from "@/lib/supabase/server";

const siteUrl = "https://vpscoaster.live";

export const metadata: Metadata = {
  title: "WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation",
  description:
    "Manage WhatsApp customer conversations, team inboxes, contacts, broadcasts, templates, AI workflows, follow-ups, and sales pipelines from one production-ready CRM dashboard.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Production-Ready WhatsApp CRM for Teams and Automation",
    description:
      "Organize WhatsApp conversations, manage contacts, assign team agents, send broadcasts, automate follow-ups, and track sales pipelines from one CRM platform.",
    url: siteUrl,
    siteName: "WACRM",
    type: "website",
    images: [
      {
        url: "/hostiko-crm/illustrations/whatsapp-crm-dashboard.svg",
        width: 960,
        height: 700,
        alt: "WhatsApp CRM dashboard with customer conversations and automation workflows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Production-Ready WhatsApp CRM for Teams and Automation",
    description:
      "Manage WhatsApp conversations, contacts, team agents, broadcasts, templates, AI workflows, and sales pipelines from one CRM dashboard.",
    images: ["/hostiko-crm/illustrations/whatsapp-crm-dashboard.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Automation", href: "#automation" },
  { label: "Campaigns", href: "#broadcasts" },
  { label: "FAQ", href: "#faq" },
];

const metrics = [
  ["Team inbox", "Shared"],
  ["Contacts", "Opt-in ready"],
  ["Broadcasts", "Queued safely"],
  ["Pipelines", "Sales tracked"],
];

const features = [
  {
    title: "WhatsApp Team Inbox",
    description:
      "Manage every WhatsApp customer conversation in one shared inbox with assigned agents, statuses, contact history, and fast replies.",
    icon: MessageSquareText,
    image: "/hostiko-crm/illustrations/team-inbox-workflow.svg",
    alt: "Shared WhatsApp team inbox for agents and managers",
  },
  {
    title: "Contact Management CRM",
    description:
      "Import, clean, tag, segment, and manage customer profiles with phone normalization, consent status, and conversation history.",
    icon: Users,
    image: "/hostiko-crm/illustrations/whatsapp-crm-dashboard.svg",
    alt: "WhatsApp CRM dashboard with customer conversations and automation workflows",
  },
  {
    title: "Broadcast Campaign CRM",
    description:
      "Queue WhatsApp broadcast campaigns with approved templates, opt-in enforcement, preflight checks, pricing estimates, and live status updates.",
    icon: Radio,
    image: "/hostiko-crm/illustrations/broadcast-campaigns.svg",
    alt: "Broadcast campaign CRM for WhatsApp contacts",
  },
  {
    title: "AI Workflow Automation",
    description:
      "Build automated customer follow-ups, keyword replies, tag triggers, assignment flows, and time-based workflows without losing human control.",
    icon: Bot,
    image: "/hostiko-crm/illustrations/ai-automation-flow.svg",
    alt: "AI automation workflow for customer follow-ups",
  },
  {
    title: "Sales Pipeline CRM",
    description:
      "Turn WhatsApp leads into organized deal cards, follow-up stages, assigned owners, and visible sales pipeline progress.",
    icon: GitBranch,
    image: "/hostiko-crm/illustrations/sales-pipeline.svg",
    alt: "Sales pipeline CRM with lead cards and follow-up stages",
  },
  {
    title: "Secure Workspace Management",
    description:
      "Protect customer communication with admin approval, team invitations, role-based access control, workspace permissions, and account safety flows.",
    icon: LockKeyhole,
    image: "/hostiko-crm/illustrations/team-inbox-workflow.svg",
    alt: "Shared WhatsApp team inbox for agents and managers",
  },
];

const workflow = [
  {
    title: "Connect WhatsApp",
    text: "Use the official Meta WhatsApp Cloud API and keep workspace configuration controlled by owners.",
  },
  {
    title: "Organize customers",
    text: "Import contacts, record consent, clean phone numbers, and group leads with tags and pipelines.",
  },
  {
    title: "Run team workflows",
    text: "Assign conversations, control agent permissions, automate follow-ups, and track every customer touchpoint.",
  },
  {
    title: "Launch safely",
    text: "Use approved templates, broadcast preflight checks, retry controls, worker logs, and live delivery updates.",
  },
];

const faqs = [
  {
    question: "What is a WhatsApp CRM?",
    answer:
      "A WhatsApp CRM helps a business organize customer conversations, contacts, broadcasts, templates, follow-ups, team assignments, and sales activity around WhatsApp communication.",
  },
  {
    question: "Can my team manage WhatsApp conversations together?",
    answer:
      "Yes. The CRM includes a shared WhatsApp team inbox, workspace members, agent assignment, role permissions, and filters for assigned or unassigned conversations.",
  },
  {
    question: "Can I send WhatsApp broadcast campaigns?",
    answer:
      "Yes. Broadcast campaigns use approved WhatsApp templates, recipient opt-in checks, queue processing, retry controls, pause/resume/cancel actions, and delivery status tracking.",
  },
  {
    question: "Does this CRM support AI automation?",
    answer:
      "The CRM supports automation workflows for keyword replies, follow-ups, tag triggers, assignment flows, wait steps, and customer workflow actions. AI-powered CRM workflows can be layered into this automation foundation.",
  },
  {
    question: "Can I assign conversations to agents?",
    answer:
      "Yes. Owners and managers can assign conversations to team agents, use round-robin or least-busy automation assignment, and review assignment history.",
  },
  {
    question: "Can I import and manage contacts?",
    answer:
      "Yes. The contact management CRM supports CSV imports, phone normalization, duplicate prevention, tags, consent fields, pagination, and customer conversation history.",
  },
  {
    question: "Is this CRM suitable for sales and support teams?",
    answer:
      "Yes. It is designed for support teams, sales teams, agencies, and business owners who need customer conversation management, lead management, WhatsApp automation, and secure team access.",
  },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WACRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "Production-ready WhatsApp CRM for team inboxes, contact management, broadcast campaigns, AI workflow automation, and sales pipeline tracking.",
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
    <main className="min-h-screen overflow-hidden bg-[#07130e] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="relative z-20">
        <div className="border-b border-white/10 bg-[#0d1b15]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 text-xs text-[#7fb9a9] sm:px-8 lg:px-10">
            <div className="hidden items-center gap-5 sm:flex">
              <span>WhatsApp customer communication platform</span>
              <span className="h-1 w-1 rounded-full bg-[#315846]" />
              <span>Official Meta Cloud API ready</span>
            </div>
            <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
              <Link href="/signup" className="hover:text-white">
                Register
              </Link>
              <a href="#faq" className="hover:text-white">
                Support
              </a>
            </div>
          </div>
        </div>

        <nav className="border-b border-white/10 bg-[#1b372b]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
            <Link href="/" className="flex items-center gap-3" aria-label="WACRM home">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold tracking-normal text-white">
                WACRM
              </span>
            </Link>

            <div className="hidden items-center gap-7 text-sm font-medium uppercase tracking-normal text-white/90 lg:flex">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-[#ffbd29]">
                  {item.label}
                </a>
              ))}
            </div>

            <Link href="/signup">
              <Button className="h-11 rounded-full bg-[#0d1b15] px-6 font-semibold text-white hover:bg-[#ffbd29] hover:text-[#07130e]">
                Start Managing Customers
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-b border-[#315846] bg-[#07130e]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(61,223,132,0.22),transparent_34%),linear-gradient(90deg,rgba(27,55,43,0.88),rgba(7,19,14,0.82))]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-full opacity-25" aria-hidden="true">
          <div className="mx-auto h-full max-w-7xl bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.2%,transparent_9.2%),linear-gradient(0deg,transparent_0,transparent_15%,rgba(127,185,169,0.16)_15%,rgba(127,185,169,0.16)_15.2%,transparent_15.2%)] bg-[length:120px_120px]" />
        </div>

        <div className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#315846] bg-[#10261c]/85 px-4 py-2 text-sm text-[#b8ffe0] shadow-xl shadow-black/20">
              <ShieldCheck className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              Secure WhatsApp business CRM for teams
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#c8ded6] sm:text-lg">
              Manage WhatsApp customers, teams, broadcasts, templates, AI workflows,
              follow-ups, and sales pipelines from one premium CRM dashboard built
              for real business communication.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup">
                <Button className="h-12 w-full rounded-full bg-[#3ddf84] px-7 font-bold text-[#07130e] hover:bg-[#ffbd29] sm:w-auto">
                  Start Managing Customers
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-full border-white/30 bg-white/5 px-7 font-semibold text-white hover:bg-white hover:text-[#07130e] sm:w-auto"
                >
                  Login to Dashboard
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
              {[
                "Shared inbox for WhatsApp teams",
                "Opt-in safe broadcast campaigns",
                "Permission-based agent dashboards",
                "Follow-up automation and sales pipelines",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-[#d8fff1]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <Image
              src="/hostiko-crm/illustrations/whatsapp-crm-dashboard.svg"
              alt="WhatsApp CRM dashboard with customer conversations and automation workflows"
              width={960}
              height={700}
              priority
              className="h-auto w-full drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Turn WhatsApp Conversations Into Organized CRM Workflows
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-[#b8cfc7]">
            Replace scattered customer chats with one secure customer engagement
            platform for sales teams, support agents, managers, and business owners.
          </p>
          <div className="mt-8 rounded-full border border-[#315846] bg-white p-2 shadow-2xl shadow-black/20">
            <div className="grid gap-2 sm:grid-cols-4">
              {metrics.map(([label, value]) => (
                <div key={label} className="rounded-full bg-[#f4fff9] px-4 py-4 text-center">
                  <p className="text-sm font-bold text-[#07130e]">{label}</p>
                  <p className="mt-1 text-xs font-medium text-[#1b6b48]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#07130e] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffbd29]">
              Everything your WhatsApp sales team needs
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              A Shared WhatsApp Team Inbox for Modern Businesses
            </h2>
            <p className="mt-4 text-[#b8cfc7]">
              WACRM brings contact management, broadcast campaign CRM, team agent
              assignment, templates, AI automation, and pipeline tracking into one
              permission-based workspace.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group overflow-hidden rounded-[30px] border border-[#315846] bg-[#10261c] p-5 shadow-xl shadow-black/10"
              >
                <div className="mb-5 overflow-hidden rounded-[24px] bg-[#0d1b15]">
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    width={760}
                    height={520}
                    loading="lazy"
                    className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#b8cfc7]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="automation" className="border-y border-[#315846] bg-[#10261c] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffbd29]">
              Build AI-powered WhatsApp workflows
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              Automate Follow-Ups Without Losing the Human Touch
            </h2>
            <p className="mt-5 text-base leading-8 text-[#b8cfc7]">
              Use WhatsApp workflow automation for keyword replies, time-based
              follow-ups, tag-triggered actions, lead routing, and customer
              conversation management while keeping agents in control.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {workflow.map((item, index) => (
                <div key={item.title} className="rounded-[24px] border border-[#315846] bg-[#0d1b15] p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffbd29] font-bold text-[#07130e]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#b8cfc7]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <Image
            src="/hostiko-crm/illustrations/ai-automation-flow.svg"
            alt="AI automation workflow for customer follow-ups"
            width={760}
            height={520}
            loading="lazy"
            className="h-auto w-full rounded-[36px] shadow-2xl shadow-black/20"
          />
        </div>
      </section>

      <section id="broadcasts" className="bg-[#07130e] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffbd29]">
                Launch with control
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                Broadcast Campaigns With Approved WhatsApp Templates
              </h2>
              <p className="mt-5 leading-8 text-[#b8cfc7]">
                Prepare campaigns with opt-in checks, pricing estimates, country
                breakdowns, duplicate prevention, pause/resume/cancel controls, and
                live progress updates.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["Preflight", "Check connection, approved template, consent, valid phones, and pricing before queueing."],
                ["Queue", "Process campaigns server-side with worker logs, retries, pause, resume, and cancel."],
                ["Reports", "Track sent, delivered, read, replied, skipped, failed, and estimated delivered cost."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-[28px] border border-[#315846] bg-[#10261c] p-6">
                  <Radio className="h-7 w-7 text-[#3ddf84]" aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#b8cfc7]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr]">
          <Image
            src="/hostiko-crm/illustrations/sales-pipeline.svg"
            alt="Sales pipeline CRM with lead cards and follow-up stages"
            width={760}
            height={520}
            loading="lazy"
            className="h-auto w-full rounded-[36px] shadow-2xl shadow-black/20"
          />
          <div className="self-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffbd29]">
              Built for teams, agents, managers, and growing businesses
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              Track Leads, Follow-Ups, and Sales Pipelines
            </h2>
            <p className="mt-5 leading-8 text-[#d5e9e2]">
              Convert customer chats into lead management CRM workflows with assigned
              agents, deal cards, pipeline stages, follow-up automation, and customer
              conversation history.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["Role-based access", ShieldCheck],
                ["Customer reports", BarChart3],
                ["Automated workflows", Workflow],
                ["Business messaging", MessageCircle],
              ].map(([label, Icon]) => (
                <div key={label as string} className="flex items-center gap-3 rounded-full bg-[#10261c] px-4 py-3">
                  <Icon className="h-5 w-5 text-[#3ddf84]" aria-hidden="true" />
                  <span className="text-sm font-semibold text-white">{label as string}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#07130e] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffbd29]">
              Questions
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              WhatsApp Business CRM FAQ
            </h2>
          </div>
          <div className="mt-10 grid gap-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-[24px] border border-[#315846] bg-[#10261c] p-6">
                <h3 className="text-lg font-bold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-[#b8cfc7]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#10261c] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[34px] border border-[#315846] bg-[#0d1b15] p-8 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3ddf84]/10 px-3 py-1 text-sm text-[#b8ffe0]">
              <Sparkles className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              Production-ready WhatsApp CRM
            </div>
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              Build Your WhatsApp Workflow Today
            </h2>
            <p className="mt-2 max-w-2xl text-[#b8cfc7]">
              Start managing customer conversations, contacts, agents, broadcasts,
              templates, automation, and pipelines from one secure dashboard.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/login">
              <Button
                variant="outline"
                className="h-12 w-full rounded-full border-white/25 px-7 font-semibold text-white hover:bg-white hover:text-[#07130e] sm:w-auto"
              >
                Login to Dashboard
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="h-12 w-full rounded-full bg-[#3ddf84] px-7 font-bold text-[#07130e] hover:bg-[#ffbd29] sm:w-auto">
                Build Your WhatsApp Workflow
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#0d1b15] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 border-t border-[#315846] pt-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold text-white">WACRM</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#7fb9a9]">
              A premium WhatsApp business CRM for customer conversation management,
              team inboxes, lead workflows, broadcasts, and automation.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">CRM</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#7fb9a9]">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#automation" className="hover:text-white">Automation</a></li>
              <li><a href="#broadcasts" className="hover:text-white">Broadcasts</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white">Account</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#7fb9a9]">
              <li><Link href="/login" className="hover:text-white">Login</Link></li>
              <li><Link href="/signup" className="hover:text-white">Register</Link></li>
              <li><Link href="/forgot-password" className="hover:text-white">Forgot password</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white">Security</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#7fb9a9]">
              <li>Role-based access</li>
              <li>Workspace permissions</li>
              <li>Opt-in enforcement</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-7xl text-sm text-[#7fb9a9]">
          Copyright 2026 WACRM. Built for secure WhatsApp customer communication.
        </p>
      </footer>
    </main>
  );
}
