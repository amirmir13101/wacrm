import type { Metadata } from "next";
import Link from "next/link";
import { Bot, MessageSquareText, ShieldCheck, Users } from "lucide-react";

import { InfoCard, InfoCardGrid, InfoCta, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { publicInfoSocialImage } from "@/lib/seo/metadata";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/about");
const pageDescription =
  "Learn about Talk Wagon CRM, a Berankify LTD project for WhatsApp CRM software, chatbot automation, broadcasts, team inboxes, contacts, and customer communication.";

export const metadata: Metadata = {
  title: "About Us | Talk Wagon CRM",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "About Talk Wagon CRM",
    description:
      "Talk Wagon helps teams manage WhatsApp customer conversations, contacts, broadcasts, automations, and sales follow-ups in one WhatsApp CRM software workspace.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [publicInfoSocialImage],
  },
  twitter: {
    card: "summary",
    title: "About Talk Wagon CRM",
    description: pageDescription,
    images: [publicInfoSocialImage.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const values = [
  {
    title: "Organized customer communication",
    icon: MessageSquareText,
    text: "Bring WhatsApp conversations, contact context, follow-ups, and team ownership into a structured CRM workflow.",
  },
  {
    title: "Team-ready access control",
    icon: Users,
    text: "Owners can create team members, control permissions, assign work, and keep sensitive settings protected.",
  },
  {
    title: "Automation with practical guardrails",
    icon: Bot,
    text: "Use automation for follow-ups, tags, webhooks, deal creation, routing, and customer workflow actions.",
  },
  {
    title: "Customer data stays customer-owned",
    icon: ShieldCheck,
    text: "Client contact lists and conversation data belong to the client. Talk Wagon processes operational data only as needed for the CRM service.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <WebPageJsonLd path="/about" name="About Talk Wagon CRM" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="About Talk Wagon"
        title="A WhatsApp CRM Software Platform Built for Customer Communication Teams"
        description="Talk Wagon CRM is a Berankify LTD project built to help businesses manage WhatsApp conversations, automate replies, send broadcasts, organize contacts, and manage customer journeys from one WhatsApp CRM software workspace."
        badges={["Berankify LTD project", "Team Inbox", "Chatbot", "Broadcasts", "Automation"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "About", href: "/about" },
        ]}
      />

      <InfoSection
        title="Why Talk Wagon Exists"
        description="As customer conversations grow, personal phones, scattered spreadsheets, and manual follow-ups stop being enough. Talk Wagon gives teams a cleaner way to manage WhatsApp customer communication with CRM context."
      >
        <div className="rounded-[26px] border border-[#dce9e2] bg-white p-6 text-base leading-8 text-[#48675b] shadow-[0_18px_45px_rgba(7,19,14,0.08)]">
          <p>
            Talk Wagon CRM is a project of Berankify LTD. It is designed for businesses that need a WhatsApp team inbox,
            customer contact management, broadcast preparation, template-aware messaging, chatbot automation, pipeline
            tracking, and role-based access in one workspace. The goal is simple: help teams follow up faster while
            keeping customer context and permissions clear.
          </p>
          <p className="mt-4">
            We are building Talk Wagon to be one of the most affordable WhatsApp chatbot automation and CRM tools for
            growing businesses, especially small teams that need practical customer communication software without heavy
            enterprise complexity.
          </p>
        </div>
      </InfoSection>

      <InfoSection eyebrow="What we focus on" title="Built Around Real CRM Workflows" tint="green">
        <InfoCardGrid>
          {values.map((value) => {
            const Icon = value.icon;

            return (
              <InfoCard key={value.title} title={value.title}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eafff3] text-[#08bba4]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p>{value.text}</p>
              </InfoCard>
            );
          })}
        </InfoCardGrid>
      </InfoSection>

      <InfoSection
        title="Who Talk Wagon Is For"
        description="Talk Wagon is useful for small teams, agencies, service businesses, support desks, sales teams, and companies that manage customer communication through WhatsApp workflows."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="Sales teams">
            Track leads, qualify prospects, assign conversations, follow up, and move deals through a simple pipeline.
          </InfoCard>
          <InfoCard title="Support teams">
            Organize customer questions, assign agents, keep history visible, and close conversations with clearer
            ownership.
          </InfoCard>
          <InfoCard title="Service businesses">
            Manage bookings, reminders, customer updates, renewals, and follow-ups from one CRM workspace.
          </InfoCard>
          <InfoCard title="Agencies and operators">
            Use workspace permissions, team members, broadcasts, and automation to support repeatable client workflows.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="How to start"
        title="Start With the CRM Workflow Your Business Needs"
        description="You can explore Talk Wagon from the public pages, create an account, or review the pricing options before choosing the setup that fits your team."
        tint="green"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
                prefetch={false}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#07130e] px-6 text-sm font-extrabold text-white hover:bg-[#1b372b]"
          >
            Start For Free
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#07130e] bg-white px-6 text-sm font-extrabold text-[#07130e] hover:bg-[#07130e] hover:text-white"
          >
            View Pricing
          </Link>
        </div>
      </InfoSection>

      <InfoCta />
      </InfoPageShell>
    </>
  );
}
