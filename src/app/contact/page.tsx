import type { Metadata } from "next";
import { Building2, CreditCard, Headphones, Handshake } from "lucide-react";

import { InfoCard, InfoHero, InfoPageShell, InfoSection } from "@/components/marketing/info-page";

const canonicalUrl = "https://vpscoaster.live/contact";

export const metadata: Metadata = {
  title: "Contact Talk Wagon | WhatsApp CRM Support and Sales",
  description:
    "Contact Talk Wagon for WhatsApp CRM sales questions, technical support, billing help, partnership, setup, or product questions.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Contact Talk Wagon",
    description:
      "Reach Talk Wagon for WhatsApp CRM sales, support, billing, setup, and partnership questions.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const topics = [
  {
    title: "Sales questions",
    text: "Ask about Talk Wagon plans, WhatsApp CRM workflows, teams, broadcasts, or automation features.",
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
    <InfoPageShell>
      <InfoHero
        eyebrow="Contact Talk Wagon"
        title="Questions About WhatsApp CRM? Contact Us"
        description="Use the contact form for sales, support, billing, setup, or partnership questions. The page is ready for future live chat integration without adding a fake chat widget."
        badges={["Sales", "Support", "Billing", "Setup", "Partnerships"]}
      />

      <InfoSection
        title="How Can We Help?"
        description="Choose the topic that fits your question, then send a message through the contact form below."
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
        description="This contact form is prepared for the public site. Connect your preferred email, helpdesk, or CRM intake endpoint when you are ready."
        tint="green"
      >
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <form
            id="contact-form"
            className="rounded-[28px] border border-[#dce9e2] bg-white p-6 shadow-[0_18px_45px_rgba(7,19,14,0.08)]"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-[#07130e]">
                Name
                <input
                  name="name"
                  type="text"
                  className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm font-bold text-[#07130e]">
                Email
                <input
                  name="email"
                  type="email"
                  className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
                Company / Business Name
                <input
                  name="company"
                  type="text"
                  className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
                  autoComplete="organization"
                />
              </label>
              <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
                Subject
                <input
                  name="subject"
                  type="text"
                  className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
                />
              </label>
              <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
                Message
                <textarea
                  name="message"
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 py-3 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#07130e] px-6 text-sm font-extrabold text-white hover:bg-[#1b372b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07130e]"
              >
                Contact Us
              </button>
              <a
                href="#contact-form"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#07130e] bg-white px-6 text-sm font-extrabold text-[#07130e] hover:bg-[#07130e] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07130e]"
              >
                Talk to Agent
              </a>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#668276]">
              Live chat can be connected later through Tawk.to or another approved provider. For now, use this form as
              the safe contact entry point.
            </p>
          </form>

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
  );
}
