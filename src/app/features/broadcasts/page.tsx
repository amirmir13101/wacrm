import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  GitBranch,
  KeyRound,
  ListChecks,
  MessageSquareText,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { HeroBadgeRow } from "@/components/marketing/hero-badge-row";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/features/broadcasts");
const broadcastImages = {
  hero: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-hero-overview.webp",
  approvedTemplates: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-approved-templates.webp",
  contactSegmentation: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-contact-segmentation.webp",
  queueProgress: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-queue-progress.webp",
  deliveryTracking: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-delivery-tracking.webp",
  retryFailed: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-retry-failed.webp",
  analytics: "/hostiko-crm/generated/broadcasts/talk-wagon-broadcasts-analytics.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp Broadcast Software With CRM Tracking",
  description:
    "Create opt-in WhatsApp broadcast software workflows with selected contacts, approved templates, preflight checks, team permissions, delivery tracking, and CRM follow-up workflows.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon WhatsApp Broadcast Software With CRM Tracking",
    description:
      "Manage opt-in WhatsApp broadcast workflows with contacts, approved templates, campaign organization, team access, delivery tracking, and CRM follow-ups.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: broadcastImages.hero,
        width: 960,
        height: 700,
        alt: "WhatsApp broadcast campaign CRM with selected contacts and template messages",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Wagon WhatsApp Broadcast Software With CRM Tracking",
    description:
      "Opt-in WhatsApp broadcast workflows with contacts, approved templates, campaign organization, delivery tracking, and CRM follow-ups.",
    images: [broadcastImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const trustPills = [
  "Approved Templates",
  "Contact Selection",
  "Campaign Workflow",
  "Team Access",
  "CRM Tracking",
] as const;

const problemCards = [
  ["Messy contact lists", Users],
  ["Manual campaign tracking", ClipboardCheck],
  ["Hard to segment customers", Tags],
  ["No clear follow-up workflow", GitBranch],
  ["Agents lose context", MessageSquareText],
  ["Campaign results are hard to organize", ListChecks],
] as const;

const solutionCards = [
  ["Contact-based sending workflow", Users, "/features#contact-management"],
  ["Approved template support", KeyRound, "/features/broadcasts#templates"],
  ["Campaign organization", ClipboardCheck, "/features/broadcasts"],
  ["Broadcast status tracking", ListChecks, "/features/broadcasts"],
  ["Team visibility", ShieldCheck, "/features/team-inbox"],
  ["Follow-up connection", GitBranch, "/features/automation"],
  ["Customer records", Tags, "/features#contact-management"],
  ["Workspace security", ShieldCheck, "/features#permissions"],
] as const;

const steps = [
  {
    title: "Import or select contacts",
    description:
      "Build your campaign audience from organized CRM contacts instead of scattered spreadsheets.",
  },
  {
    title: "Choose an approved WhatsApp template",
    description:
      "Use approved template messages for consistent, business-ready campaign communication.",
  },
  {
    title: "Prepare the campaign",
    description:
      "Name the broadcast, choose the audience, and keep the campaign attached to your CRM workflow.",
  },
  {
    title: "Review selected contacts",
    description:
      "Check who is included before sending so the final audience is clear to your team.",
  },
  {
    title: "Send or queue the broadcast workflow",
    description:
      "Queue campaigns through a structured workflow instead of sending manually one contact at a time.",
  },
  {
    title: "Track sent/pending status",
    description:
      "Follow campaign progress so pending, sent, failed, and skipped records stay visible.",
  },
  {
    title: "Follow up with interested customers",
    description:
      "Turn replies into assigned conversations, tags, deals, and automation follow-up workflows.",
  },
] as const;

const useCases = [
  {
    title: "Product updates",
    description: "Tell opted-in customers about new services, features, or package changes.",
  },
  {
    title: "Appointment reminders",
    description: "Send structured reminders for bookings, renewals, or service windows.",
  },
  {
    title: "Lead follow-ups",
    description: "Reconnect with customers who asked for price, plan, or order details.",
  },
  {
    title: "Service notifications",
    description: "Share support, maintenance, or account-related updates from one CRM workflow.",
  },
  {
    title: "Offer announcements",
    description: "Run organized campaigns for selected customer segments and tracked follow-ups.",
  },
  {
    title: "Customer reactivation",
    description: "Bring inactive contacts back into a conversation with approved template campaigns.",
  },
  {
    title: "Onboarding messages",
    description: "Guide new customers through next steps after signup, purchase, or inquiry.",
  },
  {
    title: "Support updates",
    description: "Keep customers informed when a support issue or service request changes status.",
  },
] as const;

const complianceCards = [
  { title: "Template readiness", icon: KeyRound },
  { title: "Campaign tracking", icon: ClipboardCheck },
  { title: "Selected audiences", icon: Users },
  { title: "Cost awareness", icon: BadgeDollarSign },
] as const;

const comparison = {
  manual: [
    "Scattered spreadsheets",
    "Unclear sent status",
    "Hard to select contacts",
    "No follow-up process",
    "No team visibility",
    "Disconnected customer history",
  ],
  talkWagon: [
    "Organized contacts",
    "Selected campaign audience",
    "Template-based workflow",
    "Broadcast tracking",
    "Team assignment",
    "Follow-up automation",
    "Pipeline connection",
  ],
} as const;

const faqs = [
  {
    question: "What is a WhatsApp broadcast CRM?",
    answer:
      "A WhatsApp broadcast CRM works like WhatsApp broadcast software for opted-in campaigns: it helps a business organize contacts, choose campaign audiences, use approved templates, track campaign status, and connect replies with follow-up workflows.",
  },
  {
    question: "Can I send campaigns to selected contacts?",
    answer:
      "Yes. Talk Wagon is designed around contact selection and campaign organization so each WhatsApp broadcast message can be prepared for the right audience.",
  },
  {
    question: "Does Talk Wagon support WhatsApp templates?",
    answer:
      "Yes. Talk Wagon supports approved WhatsApp template workflows for structured broadcast and follow-up messaging.",
  },
  {
    question: "Can broadcasts connect with follow-up automation?",
    answer:
      "Yes. Broadcast replies can connect with CRM workflows such as tagging, assignment, deal creation, and follow-up automation.",
  },
  {
    question: "Can agents manage broadcast replies?",
    answer:
      "Yes. Replies can be handled through the team inbox and assigned to sales or support agents based on workspace permissions.",
  },
  {
    question: "Are WhatsApp/Meta API charges included?",
    answer:
      "Talk Wagon organizes the CRM workflow. WhatsApp, Meta, or provider API charges may be separate depending on your official account and provider setup.",
  },
  {
    question: "Is this useful for sales and marketing teams?",
    answer:
      "Yes. Sales and marketing teams can use Talk Wagon as a WhatsApp marketing tool for lead follow-up, offers, product updates, reminders, and customer reactivation workflows.",
  },
  {
    question: "Can I organize contacts before sending campaigns?",
    answer:
      "Yes. Contacts can be imported, searched, paginated, segmented, and managed inside the CRM before a campaign is prepared.",
  },
  {
    question: "What WhatsApp broadcast limit should teams plan for?",
    answer:
      "The normal WhatsApp broadcast limit in the consumer app is different from official business template workflows. Talk Wagon helps teams prepare opted-in campaigns through approved templates, CRM contact selection, and workspace tracking.",
  },
  {
    question: "How many contacts can be added in a WhatsApp broadcast workflow?",
    answer:
      "The number depends on your official WhatsApp account, approved template use, contact consent, and provider rules. Talk Wagon keeps the campaign organized in the CRM so teams can review contacts before sending.",
  },
  {
    question: "How does WhatsApp broadcast work in Talk Wagon?",
    answer:
      "A team chooses an approved template, selects eligible contacts, reviews the campaign, queues the broadcast, and then tracks replies and follow-ups from the CRM.",
  },
  {
    question: "Can I create an example of WhatsApp broadcast message before sending?",
    answer:
      "Yes. Teams can prepare the approved template, review the message variables, check the selected audience, and confirm the campaign before it is queued.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon WhatsApp Broadcast CRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "A WhatsApp broadcast CRM and WhatsApp marketing software workflow for approved templates, contact selection, team permissions, campaign tracking, and follow-up organization.",
  offers: {
    "@type": "Offer",
    category: "WhatsApp broadcast CRM",
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
      name: "WhatsApp Broadcasts",
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

export default function BroadcastsFeaturePage() {
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

      <PublicHeader active="broadcasts" />

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
                  <Link className="text-white" href="/features/broadcasts">
                    Broadcasts
                  </Link>
                </li>
              </ol>
            </nav>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <Radio className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp broadcast CRM for organized campaigns
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp Broadcast Campaigns With CRM Tracking
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Prepare opt-in WhatsApp campaigns with selected contacts, approved
              templates, preflight checks, team permissions, delivery status, and
              follow-up workflows connected to your CRM.
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
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-sm font-bold text-white hover:bg-white hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                View Pricing
              </Link>
            </div>
            <HeroBadgeRow items={trustPills} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={broadcastImages.hero}
              alt="WhatsApp broadcast campaign CRM with selected contacts and template messages"
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
              Broadcasting Without a CRM Gets Messy Fast
            </h2>
            <p className="mt-4 text-[#5b7169]">
              When campaign contacts, message templates, sent status, replies, and
              follow-ups are managed manually, the team loses visibility and customers
              fall through the cracks.
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
              Run WhatsApp Broadcasts From an Organized CRM Workflow
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon connects your contacts, approved WhatsApp templates, campaign
              preparation, queue workflow, and follow-up process so broadcasts stay
              organized from planning to reply handling.
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
            src={broadcastImages.queueProgress}
            alt="WhatsApp CRM broadcast workflow dashboard"
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
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Campaign workflow</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              How Talk Wagon Broadcast Campaigns Work
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

      <section id="templates" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={broadcastImages.approvedTemplates}
            alt="Approved WhatsApp template campaign workflow"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Template campaigns</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Use Approved WhatsApp Templates for Consistent Campaigns
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon helps teams organize approved templates, prepare safer business
              communication, and keep campaign messaging consistent. WhatsApp or Meta
              charges may be separate depending on your provider and official account.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Approved templates",
                "Consistent messaging",
                "Safer business communication",
                "Campaign readiness",
              ].map((item) => (
                <div key={item} className="rounded-[22px] bg-[#f7fbf8] p-5 text-sm font-bold text-[#07130e] ring-1 ring-[#dbe9e2]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact-selection" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Contact selection</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Send Broadcasts to the Right Contacts
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Import contacts, search your customer list, use pagination, select the right
              audience, and keep campaign contact work scoped inside the correct
              workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {["Contact import", "Search", "Pagination", "Select contacts", "Workspace-scoped lists", "Bulk actions"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[#07130e] ring-1 ring-[#dbe9e2]">
                  <Search className="h-4 w-4 text-[#08bba4]" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <Image
            src={broadcastImages.contactSegmentation}
            alt="WhatsApp CRM contact selection for broadcast campaigns"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section id="follow-up-workflows" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Image
            src={broadcastImages.deliveryTracking}
            alt="Broadcast replies moving into WhatsApp CRM follow-up workflows"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#f4fff9] shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Follow-up workflow</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Turn Broadcast Replies Into Follow-Up Workflows
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              When customers reply, your team can assign conversations, add tags, update
              contact fields, create deals, run automation follow-ups, and track progress
              in the sales pipeline.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#08bba4]">Official API style workflows</p>
              <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
                Built for Official WhatsApp API Style Workflows
              </h2>
              <p className="mt-5 text-base leading-8 text-[#5b7169]">
                Talk Wagon keeps broadcasts organized around approved template workflows,
                contact selection, CRM tracking, and team permissions. It is built to
                support official WhatsApp Business Platform style communication while
                reminding teams that actual provider billing and policy requirements can
                vary.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {complianceCards.map(({ title, icon: Icon }) => (
                <article key={title} className="rounded-[26px] bg-white p-6 ring-1 ring-[#dbe9e2]">
                  <Icon className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-extrabold text-[#07130e]">{title}</h3>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Image
              src={broadcastImages.retryFailed}
              alt="Broadcast retry failed recipients dashboard"
              width={1168}
              height={880}
              loading="lazy"
              className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
            />
            <Image
              src={broadcastImages.analytics}
              alt="Broadcast campaign analytics dashboard"
              width={1168}
              height={880}
              loading="lazy"
              className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Comparison</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Manual Broadcast Lists vs Broadcast CRM Workflow
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[30px] bg-[#0d1b15] p-7">
              <h3 className="text-2xl font-extrabold">Manual Broadcast Lists</h3>
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
              <h3 className="text-2xl font-extrabold">Talk Wagon Broadcast CRM</h3>
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

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Use cases</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Broadcast Campaigns for Sales, Support and Marketing
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {useCases.map((useCase) => (
              <article key={useCase.title} className="rounded-[28px] bg-[#f7fbf8] p-6 ring-1 ring-[#dbe9e2]">
                <Send className="h-7 w-7 text-[#08bba4]" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-extrabold text-[#07130e]">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{useCase.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp Broadcast CRM FAQ
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
              Campaigns, contacts, templates and follow-ups in one CRM
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Launch Organized WhatsApp Broadcast Campaigns With Talk Wagon
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Start preparing campaigns, selecting contacts, using approved templates,
              and connecting replies to CRM follow-up workflows from one workspace.
            </p>
          </div>
          <PublicCtaButtons
            primaryLabel="Start For Free"
            primaryHref="/signup"
            secondaryLabel="View Pricing"
            secondaryHref="/pricing"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
