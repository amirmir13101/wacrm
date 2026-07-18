import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LockKeyhole, MessageSquareLock, ShieldCheck, UserCog, Workflow } from "lucide-react";

import { InfoCard, InfoCardGrid, InfoCta, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { publicInfoSocialImage } from "@/lib/seo/metadata";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/security");
const pageDescription =
  "Learn how Talk Wagon protects CRM workspaces with role-based permissions, protected API routes, secure WhatsApp configuration, and masked provider keys.";

export const metadata: Metadata = {
  title: "WhatsApp CRM Security and Data Protection",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon CRM Security",
    description:
      "Security overview for Talk Wagon CRM workspaces, permissions, WhatsApp configuration, AI provider keys, Firecrawl keys, and customer data handling.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [publicInfoSocialImage],
  },
  twitter: {
    card: "summary",
    title: "Security",
    description: pageDescription,
    images: [publicInfoSocialImage.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const securityAreas = [
  {
    title: "Workspace-based access",
    icon: UserCog,
    text: "Talk Wagon is organized around workspaces so each business can manage users, roles, and customer communication separately.",
  },
  {
    title: "Role and permission model",
    icon: ShieldCheck,
    text: "Owners can restrict team access to sensitive settings, customer records, broadcasts, templates, and automation areas.",
  },
  {
    title: "Protected routes",
    icon: LockKeyhole,
    text: "Dashboard and API routes are designed to check authentication, workspace membership, and permissions before returning workspace data.",
  },
  {
    title: "WhatsApp configuration security",
    icon: MessageSquareLock,
    text: "WhatsApp credentials and webhook-related settings should only be visible to authorized workspace users and platform administrators.",
  },
  {
    title: "AI and Firecrawl keys",
    icon: KeyRound,
    text: "Provider API keys should be stored securely, masked in the user interface where applicable, and never pasted into public forms or support chat.",
  },
  {
    title: "Automation guardrails",
    icon: Workflow,
    text: "Automation, broadcasts, and chatbot workflows should be reviewed by the business before being used with real customers.",
  },
] as const;

export default function SecurityPage() {
  return (
    <>
      <WebPageJsonLd path="/security" name="Talk Wagon CRM Security" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Security", url: "/security" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Security"
        title="How Talk Wagon Approaches CRM Security"
        description="Talk Wagon CRM is built around workspace separation, role-based permissions, protected routes, masked configuration, and practical customer data safeguards for WhatsApp CRM teams."
        badges={["Workspace access", "Role permissions", "Protected APIs", "Masked keys"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Security", href: "/security" },
        ]}
      />

      <InfoSection
        title="Security Principles"
        description="Talk Wagon is a customer communication platform, so the product is designed to keep access scoped, credentials restricted, and sensitive workflows controlled by the right people."
      >
        <InfoCardGrid>
          {securityAreas.map((area) => {
            const Icon = area.icon;

            return (
              <InfoCard key={area.title} title={area.title}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eafff3] text-[#08bba4]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p>{area.text}</p>
              </InfoCard>
            );
          })}
        </InfoCardGrid>
      </InfoSection>

      <InfoSection
        eyebrow="Credentials"
        title="API Keys, WhatsApp Settings and Provider Access"
        description="Talk Wagon can work with official WhatsApp API-style workflows, AI providers, and website import providers. These connections may involve sensitive credentials."
        tint="green"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <InfoCard title="Keep keys private">
            Do not share API keys, WhatsApp access tokens, app secrets, webhook verify tokens, AI provider keys, or
            Firecrawl keys in public chats, screenshots, or support messages.
          </InfoCard>
          <InfoCard title="Use workspace permissions">
            Restrict sensitive settings to trusted owners or administrators. Team agents should only receive the access
            required for their role.
          </InfoCard>
          <InfoCard title="Review chatbot knowledge">
            Businesses should review knowledge base content, imported website drafts, chatbot instructions, and
            automation behavior before going live with customers.
          </InfoCard>
          <InfoCard title="Monitor account activity">
            If your team changes, remove unused accounts, update permissions, and rotate third-party credentials when
            needed.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection title="Responsible Use and Incident Contact">
        <div className="rounded-[24px] border border-[#dce9e2] bg-white p-6 text-sm leading-7 text-[#48675b]">
          <p>
            Talk Wagon does not claim security certifications that have not been publicly verified. Security also depends
            on how each workspace manages users, passwords, WhatsApp credentials, customer permissions, and provider
            keys. If you believe you found a security issue or need help with account access, use the{" "}
            <Link href="/contact" className="font-bold text-[#08bba4] hover:text-[#07130e]">
              Contact Us page
            </Link>{" "}
            and avoid sending secrets in the first message.
          </p>
        </div>
      </InfoSection>

      <InfoCta />
      </InfoPageShell>
    </>
  );
}
