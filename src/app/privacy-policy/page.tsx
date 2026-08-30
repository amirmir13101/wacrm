import type { Metadata } from "next";
import Link from "next/link";

import { InfoCard, InfoCardGrid, InfoCta, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { publicInfoSocialImage } from "@/lib/seo/metadata";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/privacy-policy");
const pageDescription =
  "Read the Talk Wagon privacy policy for customer contact ownership, CRM data processing, WhatsApp opt-in responsibility, workspace security, and service data practices.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon Privacy Policy",
    description:
      "How Talk Wagon handles CRM account data, customer contact ownership, WhatsApp conversation processing, and privacy responsibilities.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [publicInfoSocialImage],
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy",
    description: pageDescription,
    images: [publicInfoSocialImage.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <WebPageJsonLd path="/privacy-policy" name="Talk Wagon Privacy Policy" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Privacy Policy", url: "/privacy-policy" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Privacy Policy"
        title="How Talk Wagon Handles Privacy and CRM Data"
        description="This policy explains how Talk Wagon CRM, a Berankify LTD project, processes account, workspace, contact, conversation, AI Agent, website import, and support information for the CRM features customers choose to use."
        badges={["Client-owned contacts", "No contact data selling", "CRM service processing", "WhatsApp policy responsibility"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Privacy Policy", href: "/privacy-policy" },
        ]}
      />

      <InfoSection
        title="Your Customer Contact Data Belongs to You"
        description="Talk Wagon is a CRM platform for customer communication. Your business remains responsible for the customer contact records, imported lists, and conversation data you bring into your workspace."
      >
        <div className="rounded-[26px] border border-[#3ddf84]/35 bg-[#f4fff9] p-6 text-base leading-8 text-[#315345] shadow-[0_18px_45px_rgba(7,19,14,0.08)]">
          <p className="font-semibold text-[#07130e]">
            Your customer contact data belongs to you. Talk Wagon only processes contact and conversation information as
            needed to provide the CRM features you use, and we do not sell your customer contact data.
          </p>
          <p className="mt-4">
            Depending on the service setup you choose, operational CRM data may be stored or processed so your team can
            use inbox, contacts, broadcasts, automation, pipeline, and reporting features. This does not transfer
            ownership of your customer database to Talk Wagon.
          </p>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="Information we process"
        title="What Information May Be Processed"
        description="The exact information processed depends on the features enabled in your workspace and the setup selected by your business."
        tint="green"
      >
        <InfoCardGrid>
          <InfoCard title="Account and workspace details">
            Name, email, workspace membership, role, permissions, login status, and settings needed to operate your CRM
            account.
          </InfoCard>
          <InfoCard title="Customer contact records">
            Contact names, phone numbers, tags, notes, opt-in status, and related fields that your business imports,
            creates, or manages inside the CRM.
          </InfoCard>
          <InfoCard title="Conversation and workflow data">
            WhatsApp-style message records, assignments, automation events, broadcast status, pipeline activity, and
            operational logs needed for CRM functionality.
          </InfoCard>
          <InfoCard title="AI Agent and knowledge base data">
            Business knowledge, chatbot instructions, imported website content, embeddings, test questions, and chatbot
            logs may be processed when you enable AI Agent features.
          </InfoCard>
          <InfoCard title="Website import and Firecrawl data">
            Website URLs, crawl results, page content, import drafts, structured facts, and provider status may be
            processed when you choose website import features.
          </InfoCard>
          <InfoCard title="Payment and support data">
            Plan requests, manual payment proof references, support messages, contact form details, and onboarding notes
            may be processed to help operate the service and respond to your requests. We may also retain normalized
            account identifiers and hashed payment-provider identifiers to enforce one-time trial and promotional-offer
            eligibility without storing full card details.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection title="How Talk Wagon Uses Service Data">
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="To provide CRM features">
            We process information so your workspace can manage conversations, contacts, team assignments, broadcasts,
            pricing estimates, automations, and sales pipeline workflows.
          </InfoCard>
          <InfoCard title="To protect and maintain the service">
            We may use operational logs and security-related information to keep the platform reliable, investigate
            issues, prevent abuse, and support account administration.
          </InfoCard>
          <InfoCard title="To support chosen integrations">
            If you connect WhatsApp API or related tools, required information may be processed to send messages,
            receive webhooks, and operate selected workflow features.
          </InfoCard>
          <InfoCard title="To operate AI and website import features">
            If enabled by your workspace, Talk Wagon may process business knowledge, website import drafts, provider
            settings, and chatbot activity so the CRM can answer from approved business information.
          </InfoCard>
          <InfoCard title="To improve product reliability">
            We may review aggregated or operational product signals to improve performance, stability, and user
            experience without selling your customer contact data.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="Customer responsibilities"
        title="Consent, WhatsApp Policies and Imported Contacts"
        description="Talk Wagon helps organize customer communication, but your business controls the contacts and messages used in your workspace."
        tint="green"
      >
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            You are responsible for uploading, importing, messaging, or broadcasting to contacts only when you have the
            proper permission, consent, opt-in, or lawful basis to do so. You are also responsible for following
            WhatsApp, Meta, and applicable communication policies for templates, opt-outs, customer consent, message
            categories, and billing.
          </p>
          <p className="mt-4">
            Talk Wagon provides consent fields, opt-out handling, broadcast preflight checks, and pricing estimates to
            support responsible workflows. These tools do not replace your obligation to follow the rules that apply to
            your business and region.
          </p>
        </div>
      </InfoSection>

      <InfoSection title="Retention, Access and Deletion">
        <InfoCardGrid>
          <InfoCard title="Operational retention">
            CRM records may be retained while your workspace uses the service so the product can preserve history,
            reporting, assignments, and automation behavior.
          </InfoCard>
          <InfoCard title="Account changes">
            Workspace owners and platform administrators may manage users, suspend accounts, archive workspaces, or
            request deletion according to the account controls available in the product.
          </InfoCard>
          <InfoCard title="Deletion requests">
            Deletion or export requests can be reviewed based on the service setup, account status, legal requirements,
            audit needs, and data controlled by the customer workspace.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection
        eyebrow="Cookies and chat widgets"
        title="Cookies, Analytics and Support Tools"
        description="Public pages may use basic cookies, browser storage, embedded support chat, or analytics-style signals when enabled for product support and website reliability."
        tint="green"
      >
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            Talk Wagon does not use cookies to sell your customer contact data. If support chat, analytics, or embedded
            third-party tools are active on public pages, those providers may process technical information according to
            their own policies. Talk Wagon may use Yandex Metrica on public website pages to understand page visits,
            link clicks, and website reliability. Avoid sending passwords, API keys, WhatsApp access tokens, or private
            credentials through public support forms or chat.
          </p>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="Security"
        title="How We Approach Security"
        description="Talk Wagon is designed around workspace separation, role-based access, approval flows, and controlled access to sensitive settings."
        tint="green"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard title="Workspace separation">Workspace data is intended to remain scoped to the correct company and members.</InfoCard>
          <InfoCard title="Role-based access">Owners can limit agent access to conversations, contacts, settings, and team tools.</InfoCard>
          <InfoCard title="Sensitive configuration">WhatsApp API credentials and platform administration features should remain restricted to allowed users.</InfoCard>
        </div>
      </InfoSection>

      <InfoSection title="Policy Updates and Questions">
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            We may update this policy as Talk Wagon changes. The latest version will be available on this page. For
            questions about privacy, account data, or customer contact handling, please use the{" "}
            <Link href="/contact" className="font-bold text-[#08bba4] hover:text-[#07130e]">
              Contact page
            </Link>
            .
          </p>
        </div>
      </InfoSection>

      <InfoCta />
      </InfoPageShell>
    </>
  );
}
