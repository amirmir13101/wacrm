import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  Headphones,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Radio,
  Search,
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
  { label: "Home", href: "/" },
  { label: "Inbox", href: "#inbox" },
  { label: "Contacts", href: "#contacts" },
  { label: "Broadcasts", href: "#broadcasts" },
  { label: "Automation", href: "#automation" },
  { label: "Pipeline", href: "#pipeline" },
];

const workflowFinder = [
  ["Inbox", "Shared"],
  ["Contacts", "Clean"],
  ["Templates", "Approved"],
  ["Broadcasts", "Queued"],
  ["Pipeline", "Tracked"],
];

const serviceTabs = [
  "Team Inbox",
  "Contact CRM",
  "Broadcast CRM",
  "Automation",
  "Pipeline",
];

const productCards = [
  {
    title: "Team Inbox CRM",
    badge: "Support teams",
    description:
      "Centralize WhatsApp conversations, assign agents, filter open chats, and keep every customer reply inside one workspace.",
    icon: MessageSquareText,
    image: "/hostiko-crm/illustrations/team-inbox-workflow.svg",
    features: ["Shared inbox", "Agent assignment", "Conversation history"],
  },
  {
    title: "Contact Management",
    badge: "Sales teams",
    description:
      "Import contacts, normalize phone numbers, record consent, segment with tags, and connect every profile to WhatsApp history.",
    icon: Users,
    image: "/hostiko-crm/illustrations/whatsapp-crm-dashboard.svg",
    features: ["CSV import", "Opt-in status", "Duplicate prevention"],
  },
  {
    title: "Broadcast Campaigns",
    badge: "Marketing teams",
    description:
      "Queue approved-template campaigns with preflight checks, pricing estimates, pause controls, retries, and live progress updates.",
    icon: Radio,
    image: "/hostiko-crm/illustrations/broadcast-campaigns.svg",
    features: ["Preflight checks", "Server-side queue", "Live delivery stats"],
  },
  {
    title: "Workflow Automation",
    badge: "Operations",
    description:
      "Trigger keyword replies, tag flows, time-based actions, assignment rules, and follow-ups while protecting opt-out status.",
    icon: Bot,
    image: "/hostiko-crm/illustrations/ai-automation-flow.svg",
    features: ["Keyword triggers", "Wait steps", "Team routing"],
  },
];

const featureRows = [
  {
    title: "Connect the official Meta WhatsApp Cloud API",
    text: "Owners manage the workspace WhatsApp connection, while agents can use it safely without seeing private API credentials.",
    icon: ShieldCheck,
  },
  {
    title: "Keep customer consent visible before sending",
    text: "Broadcasts and automations respect opt-in and opt-out fields so teams can avoid unsafe customer messaging.",
    icon: LockKeyhole,
  },
  {
    title: "Track leads from first chat to closed sale",
    text: "Move customer opportunities through pipeline stages, assign owners, and keep follow-ups tied to real conversations.",
    icon: GitBranch,
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
    question: "Does this CRM support automation?",
    answer:
      "The CRM supports automation workflows for keyword replies, follow-ups, tag triggers, assignment flows, wait steps, and customer workflow actions.",
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
    <main className="min-h-screen overflow-hidden bg-[#f7fbf8] text-[#07130e]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="relative z-30">
        <div className="bg-[#0d1b15] text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 text-xs sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <form
              action="#features"
              className="hidden w-full max-w-sm items-center gap-2 border-b border-white/30 pb-1 text-[#c8ded6] lg:flex"
              role="search"
            >
              <button
                type="submit"
                aria-label="Search CRM workflows"
                className="flex h-7 w-7 items-center justify-center text-white"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#7fb9a9]"
                name="q"
                placeholder="Search CRM workflows..."
                type="search"
              />
            </form>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-white/85 lg:justify-end">
              <Link href="/login" className="hover:text-[#3ddf84]">
                Login
              </Link>
              <Link href="/signup" className="hover:text-[#3ddf84]">
                Registration
              </Link>
              <a href="#features" className="hover:text-[#3ddf84]">
                Features
              </a>
              <a href="#faq" className="inline-flex items-center gap-1 hover:text-[#3ddf84]">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Support
              </a>
            </div>
          </div>
        </div>

        <nav className="bg-white shadow-[0_12px_35px_rgba(7,19,14,0.08)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8 lg:px-10">
            <Link href="/" className="flex items-center gap-3" aria-label="WACRM home">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-2xl font-extrabold tracking-normal text-[#07130e]">
                WACRM
              </span>
            </Link>

            <div className="hidden items-center gap-7 text-sm font-bold uppercase text-[#07130e] xl:flex">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="hover:text-[#08bba4]">
                  {item.label}
                </a>
              ))}
            </div>

            <Link href="/signup" className="hidden sm:block">
              <Button className="h-12 rounded-full bg-[#181818] px-7 font-bold text-white hover:bg-[#ffbd29] hover:text-[#07130e]">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.92),rgba(27,55,43,0.74),rgba(7,19,14,0.94))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.22)_9%,rgba(127,185,169,0.22)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto flex min-h-[470px] max-w-5xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8 lg:px-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
            <ShieldCheck className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
            Official Meta WhatsApp Cloud API ready
          </p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[#d5e9e2] sm:text-lg">
            Manage customer conversations, agents, contact consent, approved templates,
            broadcasts, automations, and sales pipelines from one secure CRM workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#3ddf84] px-7 font-bold text-[#07130e] hover:bg-[#ffbd29]"
            >
              Build CRM Workflow
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center rounded-full border border-white/30 px-7 font-bold text-white hover:bg-white hover:text-[#07130e]"
            >
              Client Dashboard
            </Link>
          </div>
          <nav aria-label="Page breadcrumb" className="mt-8 text-sm text-[#7fb9a9]">
            <Link href="/" className="text-white hover:text-[#3ddf84]">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span>WhatsApp CRM Platform</span>
          </nav>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-extrabold text-[#07130e] sm:text-4xl">
            Build Your WhatsApp Customer Workflow
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#5b7169]">
            Search the CRM areas your team needs, then start with login or a new
            workspace account.
          </p>
          <form
            action="#features"
            className="mx-auto mt-8 grid max-w-5xl gap-3 rounded-[30px] bg-white p-3 shadow-[0_20px_70px_rgba(7,19,14,0.14)] lg:grid-cols-[1fr_auto_auto]"
            role="search"
          >
            <label className="sr-only" htmlFor="workflow-search">
              Search CRM workflow
            </label>
            <input
              id="workflow-search"
              name="workflow"
              type="search"
              className="h-14 rounded-full bg-[#f4fff9] px-6 text-[#07130e] outline-none ring-1 ring-[#dce9e2] placeholder:text-[#7a9188] focus:ring-2 focus:ring-[#3ddf84]"
              placeholder="Inbox, contacts, broadcasts, automation, pipeline..."
            />
            <Button className="h-14 rounded-full bg-[#3ddf84] px-8 font-bold text-[#07130e] hover:bg-[#1fc86f]">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search CRM
            </Button>
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center rounded-full bg-[#ffbd29] px-8 text-sm font-bold text-[#07130e] hover:bg-[#e9aa1c]"
            >
              Get Started
            </Link>
          </form>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {workflowFinder.map(([name, value]) => (
              <li
                key={name}
                className="rounded-full border border-[#dbe9e2] bg-[#f9fdfb] px-5 py-3 text-sm"
              >
                <span className="font-extrabold text-[#07130e]">{name}</span>
                <span className="ml-2 text-[#1b6b48]">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-extrabold text-[#07130e] sm:text-4xl">
            Browse CRM Products and Services
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2 border-b border-[#dbe9e2] pb-4">
            {serviceTabs.map((tab, index) => (
              <a
                key={tab}
                href={index === 0 ? "#inbox" : index === 1 ? "#contacts" : index === 2 ? "#broadcasts" : index === 3 ? "#automation" : "#pipeline"}
                className={`rounded-full px-5 py-2 text-sm font-bold ${
                  index === 0
                    ? "bg-[#ffbd29] text-[#07130e]"
                    : "bg-white text-[#5b7169] hover:bg-[#eafff3] hover:text-[#07130e]"
                }`}
              >
                {tab}
              </a>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {productCards.map((card) => (
              <article
                id={
                  card.title === "Team Inbox CRM"
                    ? "inbox"
                    : card.title === "Contact Management"
                      ? "contacts"
                      : card.title === "Broadcast Campaigns"
                        ? "broadcasts"
                        : "automation"
                }
                key={card.title}
                className="group flex h-full flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ring-[#e1eee8]"
              >
                <div className="bg-[#1b372b] p-5 text-white">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                      <card.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-[#ffdd7a]">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold">{card.title}</h3>
                </div>
                <div className="p-5">
                  <div className="mb-5 overflow-hidden rounded-[22px] bg-[#f4fff9]">
                    <Image
                      src={card.image}
                      alt={`${card.title} illustration`}
                      width={520}
                      height={360}
                      loading="lazy"
                      className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="text-sm leading-7 text-[#5b7169]">{card.description}</p>
                  <ul className="mt-5 space-y-3 text-sm text-[#07130e]">
                    {card.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#08bba4]" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto border-t border-[#e1eee8] p-5">
                  <Link
                    href="/signup"
                    className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#3ddf84] text-sm font-bold text-[#07130e] hover:bg-[#ffbd29]"
                  >
                    Start Now
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pipeline" className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative">
            <Image
              src="/hostiko-crm/illustrations/sales-pipeline.svg"
              alt="Sales pipeline CRM with lead cards and follow-up stages"
              width={760}
              height={520}
              loading="lazy"
              className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
            />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">
              Business CRM control panel
            </p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Run Sales, Support, and Follow-Up Workflows From One Dashboard
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Keep conversations, contact records, broadcasts, automations, pricing
              estimates, pipeline deals, and team permissions connected inside the same
              workspace.
            </p>
            <div className="mt-8 grid gap-4">
              {featureRows.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-[24px] bg-[#0d1b15] p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#b8cfc7]">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#08bba4]">
                Why teams choose WACRM
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
                Built for WhatsApp Customer Operations
              </h2>
              <p className="mt-5 leading-8 text-[#5b7169]">
                The CRM keeps the operational pieces together: customer messages,
                assigned agents, consent, approved templates, queue processing,
                automation logs, and workspace security.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                ["Fast team replies", Headphones],
                ["Live broadcast updates", Radio],
                ["Automation logs", Clock3],
                ["Business reports", BarChart3],
                ["Workspace permissions", ShieldCheck],
                ["Workflow builder", Workflow],
              ].map(([label, Icon]) => (
                <div key={label as string} className="rounded-[24px] border border-[#dbe9e2] bg-[#f7fbf8] p-5">
                  <Icon className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-4 font-extrabold text-[#07130e]">{label as string}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Questions</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp Business CRM FAQ
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

      <section className="bg-[#ffbd29] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#07130e]/10 px-3 py-1 text-sm font-bold text-[#07130e]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Production-ready WhatsApp CRM
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Start Managing Your WhatsApp Customers Today
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Open your secure dashboard or create a workspace for team inboxes,
              broadcasts, contact management, automation, and pipeline tracking.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border-2 border-[#07130e] px-7 text-sm font-bold text-[#07130e] hover:bg-[#07130e] hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#07130e] px-7 text-sm font-bold text-white hover:bg-[#1b372b]"
            >
              Register / Get Started
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#0d1b15] px-5 py-16 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3ddf84] text-[#07130e]">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold text-white">WACRM</span>
            </Link>
            <p className="mt-4 text-sm leading-7 text-[#7fb9a9]">
              Copyright 2026 WACRM. Secure customer communication for WhatsApp teams.
            </p>
          </div>
          {[
            ["CRM Services", [["Team Inbox", "#inbox"], ["Contacts", "#contacts"], ["Broadcasts", "#broadcasts"], ["Pipeline", "#pipeline"]]],
            ["Automation", [["Workflow Builder", "#automation"], ["Templates", "#features"], ["Reports", "#features"]]],
            ["Company", [["Features", "#features"], ["FAQ", "#faq"], ["Support", "#faq"]]],
            ["Account", [["Login", "/login"], ["Register", "/signup"], ["Forgot Password", "/forgot-password"]]],
            ["Security", [["Permissions", "#pipeline"], ["Opt-in Safety", "#features"], ["Meta Cloud API", "#features"]]],
          ].map(([heading, links]) => (
            <div key={heading as string}>
              <h3 className="font-extrabold text-white">{heading as string}</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#7fb9a9]">
                {(links as string[][]).map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-[#3ddf84]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
