import type { Metadata } from "next";
import Link from "next/link";

import { InfoCard, InfoCardGrid, InfoCta, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/terms-and-conditions");
const pageDescription =
  "Review Talk Wagon terms for WhatsApp CRM account use, workspace access, responsible messaging, contact consent, subscriptions, and acceptable use.";

export const metadata: Metadata = {
  title: "Terms of Service | Talk Wagon CRM",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon Terms and Conditions",
    description:
      "Terms for using Talk Wagon WhatsApp CRM, including customer responsibilities, workspace access, subscriptions, and acceptable use.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | Talk Wagon CRM",
    description: pageDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsAndConditionsPage() {
  return (
    <>
      <WebPageJsonLd path="/terms-and-conditions" name="Talk Wagon Terms of Service" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Terms of Service", url: "/terms-and-conditions" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Terms and Conditions"
        title="Terms for Using Talk Wagon WhatsApp CRM"
        description="These terms describe the basic rules for using Talk Wagon CRM, a Berankify LTD project, managing a workspace, connecting WhatsApp workflows, and keeping customer communication responsible."
        badges={["Workspace accounts", "Responsible messaging", "Client-owned data", "Fair platform use"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Terms", href: "/terms-and-conditions" },
        ]}
      />

      <InfoSection
        title="Using Talk Wagon"
        description="Talk Wagon provides CRM tools for WhatsApp-oriented teams, including inbox, contacts, broadcasts, automations, team permissions, pricing estimates, and pipeline workflows."
      >
        <InfoCardGrid>
          <InfoCard title="Account access">
            You are responsible for maintaining secure login credentials and for ensuring team members use their own
            approved accounts rather than shared passwords.
          </InfoCard>
          <InfoCard title="Workspace control">
            Workspace owners manage their company workspace, team members, roles, permissions, WhatsApp configuration,
            contacts, and CRM records.
          </InfoCard>
          <InfoCard title="Platform administration">
            Platform administrator features are reserved for authorized platform administrators and are separate from
            normal workspace owner or agent features.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection
        eyebrow="Customer data"
        title="Your Contacts and CRM Data"
        description="Your customer contact records, imported lists, and conversation data belong to your business. Talk Wagon processes operational data as needed to provide the CRM features you use."
        tint="green"
      >
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            You are responsible for the accuracy, legality, permissions, and opt-in status of the contacts and messages
            you manage through Talk Wagon. You should only upload or message contacts when you have the proper permission
            and when your use follows WhatsApp, Meta, and applicable communication rules.
          </p>
        </div>
      </InfoSection>

      <InfoSection title="Acceptable Use">
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="Do use Talk Wagon for legitimate CRM work">
            Sales follow-ups, customer support, contact organization, approved template workflows, pipeline management,
            and team conversation handling are appropriate use cases.
          </InfoCard>
          <InfoCard title="Do not abuse messaging features">
            Do not use Talk Wagon for spam, unlawful messaging, deceptive outreach, unauthorized scraping, harassment,
            or communication that violates WhatsApp, Meta, or local rules.
          </InfoCard>
          <InfoCard title="Protect credentials and secrets">
            WhatsApp API credentials, webhook tokens, team passwords, and workspace settings should be kept secure and
            shared only with authorized users.
          </InfoCard>
          <InfoCard title="Respect workspace permissions">
            Do not attempt to bypass roles, access another company workspace, inspect restricted data, or use platform
            admin pages unless you are authorized.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="Subscriptions and service"
        title="Plans, Trials and Availability"
        tint="green"
      >
        <InfoCardGrid>
          <InfoCard title="Plans and billing">
            Talk Wagon may offer free, subscription, lifetime, or self-hosted setup options. Plan details, available
            features, and billing terms may vary by selected service.
          </InfoCard>
          <InfoCard title="WhatsApp and third-party costs">
            WhatsApp, Meta, hosting, payment, or third-party integration costs may be separate from Talk Wagon fees
            unless explicitly included in your selected setup.
          </InfoCard>
          <InfoCard title="AI chatbot limitations">
            AI chatbot, website import, and automation features are support tools. Your business should review knowledge
            base content, customer replies, policy statements, and automated responses before relying on them.
          </InfoCard>
          <InfoCard title="Service changes">
            Features may change over time as the CRM improves. We aim to keep the service reliable, but no online system
            can guarantee uninterrupted availability.
          </InfoCard>
        </InfoCardGrid>
      </InfoSection>

      <InfoSection title="Limitations and Updates">
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            Talk Wagon is provided to support customer communication workflows, but your business remains responsible for
            its own legal, compliance, billing, messaging, and customer relationship decisions. These terms may be updated
            as the product, services, or policies change. Questions can be sent through the{" "}
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
