import type { Metadata } from "next";
import { Building2, CreditCard, Headphones, Handshake } from "lucide-react";

import { ContactMessageForm } from "@/components/marketing/contact-message-form";
import { InfoCard, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/marketing/seo-json-ld";
import { publicInfoSocialImage } from "@/lib/seo/metadata";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/contact");
const pageDescription =
  "Contact Talk Wagon for WhatsApp CRM software sales questions, technical support, billing help, setup, partnership, automation, broadcasts, or team inbox questions.";

export const metadata: Metadata = {
  title: "Contact Us | Talk Wagon CRM",
  description: pageDescription,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Contact Talk Wagon",
    description:
      "Reach Talk Wagon for WhatsApp CRM software sales, support, billing, setup, and partnership questions.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [publicInfoSocialImage],
  },
  twitter: {
    card: "summary",
    title: "Contact Talk Wagon CRM",
    description: pageDescription,
    images: [publicInfoSocialImage.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const topics = [
  {
    title: "Sales questions",
    text: "Ask about Talk Wagon plans, WhatsApp CRM software workflows, teams, broadcasts, or automation features.",
    icon: Building2,
  },
  {
    title: "Technical support",
    text: "Get help with workspace access, team setup, WhatsApp configuration, broadcasts, or CRM workflows.",
    icon: Headphones,
  },
  {
    title: "Billing help",
    text: "Ask about Free, Pro, lifetime setup, WhatsApp API cost separation, or plan-related questions.",
    icon: CreditCard,
  },
  {
    title: "Partnership or setup questions",
    text: "Discuss branded setup, self-hosted deployment, agency workflows, or business onboarding needs.",
    icon: Handshake,
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <WebPageJsonLd path="/contact" name="Contact Talk Wagon CRM" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" },
        ]}
      />
      <InfoPageShell>
      <InfoHero
        eyebrow="Contact Talk Wagon"
        title="Contact Talk Wagon for WhatsApp CRM Software Help"
        description="Use the contact form for sales, support, billing, setup, automation, broadcasts, WhatsApp team inbox, or partnership questions. Live chat can be connected later without adding a fake widget."
        badges={["Sales", "Support", "Billing", "Setup", "Partnerships"]}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Contact", href: "/contact" },
        ]}
      />

      <InfoSection
        title="How Can We Help?"
        description="Choose the topic that fits your question, then send a message through the contact form below. Do not include passwords, tokens, API secrets, or private keys."
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {topics.map((topic) => {
            const Icon = topic.icon;

            return (
              <InfoCard key={topic.title} title={topic.title}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eafff3] text-[#08bba4]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p>{topic.text}</p>
              </InfoCard>
            );
          })}
        </div>
      </InfoSection>

      <InfoSection
        eyebrow="Contact form"
        title="Send a Message"
        description="Send your details through WhatsApp or open the existing live chat widget. Do not include passwords, tokens, API secrets, or private keys."
        tint="green"
      >
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <ContactMessageForm />

          <aside className="rounded-[28px] bg-[#0d1b15] p-6 text-white shadow-[0_18px_45px_rgba(7,19,14,0.16)]">
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#ffbd29]">Before contacting</p>
            <h2 className="mt-3 text-2xl font-extrabold">Include the details that help us understand your request.</h2>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-[#d8fff1]">
              <li>Tell us whether you are asking about sales, support, billing, setup, or partnership.</li>
              <li>For workspace support, describe the page or workflow involved.</li>
              <li>Do not paste passwords, access tokens, API secrets, or private keys into the message.</li>
            </ul>
          </aside>
        </div>
      </InfoSection>
      </InfoPageShell>
    </>
  );
}
