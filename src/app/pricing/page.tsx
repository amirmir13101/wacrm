import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Cloud,
  KeyRound,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { HeroBadgeRow } from "@/components/marketing/hero-badge-row";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { getCanonicalUrl } from "@/lib/site-url";

const canonicalUrl = getCanonicalUrl("/pricing");
const pricingImages = {
  hero: "/hostiko-crm/generated/pricing/talk-wagon-pricing-hero-overview-usd.webp",
  planComparison: "/hostiko-crm/generated/pricing/talk-wagon-pricing-plan-comparison-usd.webp",
  apiCosts: "/hostiko-crm/generated/pricing/talk-wagon-pricing-whatsapp-api-costs-usd.webp",
  lifetime: "/hostiko-crm/generated/pricing/talk-wagon-pricing-lifetime-self-hosted.webp",
  proValue: "/hostiko-crm/generated/pricing/talk-wagon-pricing-pro-plan-value.webp",
  usageAnalytics: "/hostiko-crm/generated/pricing/talk-wagon-pricing-usage-billing-analytics.webp",
  upgradeCta: "/hostiko-crm/generated/pricing/talk-wagon-pricing-upgrade-cta-usd.webp",
} as const;

export const metadata: Metadata = {
  title: "WhatsApp CRM Pricing and Plans for Teams",
  description:
    "Compare Talk Wagon WhatsApp CRM plans for team inbox, contacts, approved broadcasts, automation, follow-ups, analytics, and self-hosted CRM setup.",
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: "Talk Wagon WhatsApp CRM Pricing",
    description:
      "Compare Free, Pro, and Lifetime self-hosted Talk Wagon CRM plans for WhatsApp teams, broadcasts, automation, analytics, and customer communication.",
    url: canonicalUrl,
    siteName: "Talk Wagon",
    type: "website",
    images: [
      {
        url: pricingImages.hero,
        width: 1168,
        height: 880,
        alt: "Talk Wagon WhatsApp CRM pricing plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Wagon WhatsApp CRM Pricing",
    description:
      "Compare WhatsApp CRM plans for team inboxes, broadcasts, automation, analytics, customer communication, and self-hosted branding.",
    images: [pricingImages.hero],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const trustPills = [
  "Official API Friendly",
  "Team Inbox",
  "Broadcasts",
  "AI Automation",
  "Self-Hosted Option",
] as const;

const plans = [
  {
    name: "14-Day Free Trial",
    price: "$0",
    billing: "$0 for 14 days",
    description:
      "Try the complete Talk Wagon CRM workflow with your official WhatsApp API key before upgrading to Pro.",
    cta: "Start Free Trial",
    href: "/signup",
    featured: false,
    note:
      "Your trial includes 1,000 broadcast messages from the CRM side. WhatsApp/Meta API charges may still apply separately depending on your own official API account.",
    features: [
      "14-day free trial",
      "1,000 broadcast messages included during trial",
      "Access all CRM features during trial",
      "1 team member seat included",
      "Use your official WhatsApp API key",
      "WhatsApp team inbox",
      "Contact management",
      "Message templates support",
      "Broadcast workflow",
      "AI automation workflow",
      "Sales pipeline",
      "Upgrade to Pro after trial",
    ],
  },
  {
    name: "Pro",
    price: "$1",
    regularPrice: "$9.90",
    offerLabel: "First month promo",
    billing: "$1 first month, then $9.90/month",
    description:
      "For growing teams that want all Talk Wagon CRM features, team workflows, broadcasts, automations, and pipeline tools with a clear monthly broadcast allowance.",
    cta: "Upgrade to Pro",
    href: "/checkout/pro",
    note:
      "New workspaces pay $1 for the first month only. Renewals continue at $9.90/month. Use your own official WhatsApp API key; WhatsApp/Meta charges are separate.",
    featured: true,
    features: [
      "250,000 broadcast messages per month",
      "All CRM features included",
      "WhatsApp team inbox",
      "Contact import and management",
      "Broadcast campaigns",
      "WhatsApp templates",
      "AI automation workflows",
      "Follow-up automation",
      "Sales pipeline",
      "Up to 10 team members",
      "Team agents and permissions",
      "Reports and recent sent tracking",
      "Webhook-ready automation",
    ],
  },
  {
    name: "Lifetime",
    price: "$499",
    billing: "Self-hosted CRM setup request",
    description:
      "Best for agencies, hosting companies, and businesses that want a branded self-hosted WhatsApp CRM deployed for their own company.",
    cta: "Request Lifetime Setup",
    href: "/checkout/lifetime",
    featured: false,
    note:
      "Lifetime is a self-hosted setup service request, not a hosted SaaS subscription. Server, domain, WhatsApp/Meta API, and any third-party provider costs are separate unless included in a custom agreement.",
    features: [
      "One-time self-hosted setup request",
      "Self-hosted CRM deployment",
      "Your company branding",
      "Custom logo and public frontend branding",
      "WhatsApp CRM dashboard",
      "Team agents and permissions",
      "Contact management",
      "Broadcast campaigns",
      "AI automation workflows",
      "Sales pipeline",
      "Admin approval system",
      "Production deployment follow-up",
      "Good for agencies and white-label use",
    ],
  },
] as const;

const included = [
  ["WhatsApp CRM dashboard", MessageSquareText],
  ["Contact management", Users],
  ["WhatsApp templates", KeyRound],
  ["Team inbox workflow", Users],
  ["Broadcast campaign workflow", Radio],
  ["Follow-up automation", Zap],
  ["Sales pipeline tools", BadgeDollarSign],
  ["Secure login and workspace system", ShieldCheck],
  ["Official API key support", Cloud],
] as const;

const faqs = [
  {
    question: "Does the 14-day free trial include WhatsApp API charges?",
    answer:
      "The free trial gives you Talk Wagon CRM access for 14 days and includes 1,000 broadcast messages from the CRM side during the trial. WhatsApp/Meta or provider charges may apply separately depending on your account.",
  },
  {
    question: "What broadcast limit is included in Pro?",
    answer:
      "Pro includes 250,000 broadcast messages per month from the CRM side. It does not remove any separate WhatsApp/Meta API or conversation charges from your official provider.",
  },
  {
    question: "Can I use my own WhatsApp API key?",
    answer:
      "Yes. Talk Wagon is designed to work with official WhatsApp API style workflows, so businesses can use their own approved API setup.",
  },
  {
    question: "What is included in the Lifetime plan?",
    answer:
      "The Lifetime plan includes a self-hosted CRM setup with your company branding, suitable for agencies and businesses that want their own branded CRM deployment.",
  },
  {
    question: "Can I upgrade later?",
    answer:
      "Yes. You can start with the 14-day free trial, move to Pro when your team grows, or request a Lifetime self-hosted setup.",
  },
  {
    question: "Is Talk Wagon suitable for agencies?",
    answer:
      "Yes. Agencies can use Talk Wagon to manage WhatsApp customer workflows or choose the Lifetime option for branded self-hosted deployment.",
  },
] as const;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talk Wagon",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: canonicalUrl,
  description:
    "WhatsApp CRM pricing plans for team inboxes, contact management, broadcasts, AI automation, follow-ups, self-hosted CRM branding, and official WhatsApp API workflows.",
  offers: plans.map((plan) => ({
    "@type": "Offer",
    name: `Talk Wagon ${plan.name}`,
    price: plan.name === "14-Day Free Trial" ? "0" : plan.name === "Pro" ? "1" : "499",
    priceCurrency: "USD",
    description: plan.description,
    availability: "https://schema.org/InStock",
  })),
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

export default function PricingPage() {
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

      <PublicHeader active="pricing" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_70%_14%,rgba(61,223,132,0.25),transparent_30%),linear-gradient(90deg,rgba(7,19,14,0.96),rgba(27,55,43,0.82),rgba(7,19,14,0.96))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-25" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-9 sm:px-8 sm:pb-16 sm:pt-12 lg:min-h-[660px] lg:grid-cols-[0.94fr_1.06fr] lg:px-10 lg:py-20">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <BadgeDollarSign className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              WhatsApp CRM pricing for teams and agencies
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Simple Pricing for WhatsApp CRM Teams
            </h1>
            <p className="mt-6 text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Start free with your official WhatsApp API key, upgrade for complete CRM
              features, or choose a lifetime self-hosted setup with your company branding
              and workspace control.
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
            <HeroBadgeRow items={trustPills} />
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/8 p-4 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src={pricingImages.hero}
              alt="Talk Wagon WhatsApp CRM pricing plans"
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
            <p className="text-sm font-bold uppercase text-[#08bba4]">Talk Wagon pricing</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Choose the Plan That Fits Your WhatsApp CRM Workflow
            </h2>
            <p className="mt-4 text-[#5b7169]">
              Compare 14-day trial, Pro, and Lifetime self-hosted options for WhatsApp team
              inboxes, approved broadcasts, automation, analytics, customer communication,
              and branded CRM deployment.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                id={plan.name === "Lifetime" ? "lifetime" : undefined}
                className={`relative flex h-full flex-col rounded-[32px] p-6 shadow-[0_20px_60px_rgba(7,19,14,0.10)] ring-1 ${
                  plan.featured
                    ? "scale-[1.01] bg-[#1b372b] text-white ring-[#1b372b] lg:-mt-5"
                    : "bg-[#f7fbf8] text-[#07130e] ring-[#e1eee8]"
                }`}
              >
                {plan.featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-[#ffbd29] px-4 py-2 text-xs font-extrabold uppercase text-[#07130e]">
                    Most Popular
                  </span>
                ) : null}
                <h3 className="text-2xl font-extrabold">{plan.name}</h3>
                {plan.name === "Pro" && "regularPrice" in plan ? (
                  <div className="mt-6 space-y-3">
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                      <span className="pb-2 text-xl font-bold text-[#d5e9e2]/60 line-through decoration-2">
                        Regular price: {plan.regularPrice}/month
                      </span>
                      <span className="text-5xl font-extrabold">{plan.price} first month</span>
                    </div>
                    <span className="inline-flex rounded-full bg-[#ffbd29] px-3 py-1 text-xs font-extrabold uppercase text-[#07130e]">
                      {plan.offerLabel}
                    </span>
                  </div>
                ) : (
                  <div className="mt-6 flex items-end gap-2">
                    <span className="text-5xl font-extrabold">{plan.price}</span>
                  </div>
                )}
                <p className={`mt-3 text-sm font-bold ${plan.featured ? "text-[#ffbd29]" : "text-[#08bba4]"}`}>
                  {plan.billing}
                </p>
                <p className={`mt-5 text-sm leading-7 ${plan.featured ? "text-[#d5e9e2]" : "text-[#5b7169]"}`}>
                  {plan.description}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-[#3ddf84]" : "text-[#08bba4]"}`}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-full text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    plan.featured
                      ? "min-h-[60px] py-4 bg-[#3ddf84] text-[#07130e] hover:bg-[#ffbd29] focus-visible:outline-white"
                      : "h-12 bg-[#181818] text-white hover:bg-[#ffbd29] hover:text-[#07130e] focus-visible:outline-[#08bba4]"
                  }`}
                >
                  {plan.cta}
                </Link>
                <p className={`mt-5 text-xs leading-6 ${plan.featured ? "text-[#b8cfc7]" : "text-[#5b7169]"}`}>
                  {plan.note}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <article className="rounded-[30px] bg-[#f7fbf8] p-4 ring-1 ring-[#dbe9e2]">
              <Image
                src={pricingImages.planComparison}
                alt="14-day trial Pro and Lifetime WhatsApp CRM plan comparison"
                width={1168}
                height={880}
                loading="lazy"
                className="h-auto w-full rounded-[24px]"
              />
              <h3 className="mt-5 px-2 text-xl font-extrabold text-[#07130e]">
                Compare trial, Pro and Lifetime
              </h3>
              <p className="px-2 pb-2 pt-2 text-sm leading-7 text-[#5b7169]">
                See the upgrade path from testing the CRM to running unlimited workflows
                or requesting a self-hosted setup.
              </p>
            </article>
            <article className="rounded-[30px] bg-[#f7fbf8] p-4 ring-1 ring-[#dbe9e2]">
              <Image
                src={pricingImages.proValue}
                alt="Talk Wagon Pro plan CRM feature value dashboard"
                width={1168}
                height={880}
                loading="lazy"
                className="h-auto w-full rounded-[24px]"
              />
              <h3 className="mt-5 px-2 text-xl font-extrabold text-[#07130e]">
                Pro includes the full CRM workflow
              </h3>
              <p className="px-2 pb-2 pt-2 text-sm leading-7 text-[#5b7169]">
                Team inbox, contacts, broadcasts, automation, pipeline, and permissions
                stay together in one workspace.
              </p>
            </article>
            <article className="rounded-[30px] bg-[#f7fbf8] p-4 ring-1 ring-[#dbe9e2]">
              <Image
                src={pricingImages.usageAnalytics}
                alt="Talk Wagon CRM usage and billing analytics dashboard"
                width={1168}
                height={880}
                loading="lazy"
                className="h-auto w-full rounded-[24px]"
              />
              <h3 className="mt-5 px-2 text-xl font-extrabold text-[#07130e]">
                Understand usage as your team grows
              </h3>
              <p className="px-2 pb-2 pt-2 text-sm leading-7 text-[#5b7169]">
                Track message activity, contacts, team seats, and campaign workflow
                growth with clean CRM usage signals.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#08bba4]">Every plan includes</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              What Is Included in Every Plan?
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5b7169]">
              Talk Wagon does not sell WhatsApp/Meta messages directly. Users connect
              their own official WhatsApp API/account where needed, while Talk Wagon
              provides the CRM workflow for teams, contacts, broadcasts, automation, and
              customer follow-up.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {included.map(([item, Icon]) => (
                <div key={item} className="flex gap-3 rounded-[22px] bg-white p-5 ring-1 ring-[#dbe9e2]">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#08bba4]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[#07130e]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Image
            src={pricingImages.apiCosts}
            alt="WhatsApp CRM API cost estimator and billing explanation"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-white shadow-[0_20px_60px_rgba(7,19,14,0.10)]"
          />
        </div>
      </section>

      <section className="bg-[#1b372b] px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#ffbd29]">Transparent WhatsApp API Pricing</p>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Clear CRM Pricing, Separate Official API Costs
            </h2>
            <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
              Talk Wagon is the CRM platform. WhatsApp/Meta API or conversation charges
              may be billed separately by Meta or your official WhatsApp API provider.
              The trial and Pro plans describe Talk Wagon CRM access, not third-party
              WhatsApp provider charges.
            </p>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0d1b15] p-6">
              <p className="text-sm leading-7 text-[#d8fff1]">
                This keeps your CRM subscription simple while preserving official API
                account ownership. You bring the approved WhatsApp setup; Talk Wagon
                organizes the team inbox, broadcasts, templates, automations, contacts,
                pipeline, and reports around it.
              </p>
            </div>
          </div>
          <Image
            src={pricingImages.lifetime}
            alt="Self-hosted branded WhatsApp CRM setup"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[30px] bg-[#0d1b15] shadow-[0_30px_90px_rgba(0,0,0,0.30)]"
          />
        </div>
      </section>

      <section id="faq" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase text-[#08bba4]">Pricing FAQ</p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              Talk Wagon Pricing FAQ
            </h2>
          </div>
          <div className="mt-10 grid gap-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[24px] border border-[#dbe9e2] bg-[#f7fbf8] p-6 shadow-[0_10px_35px_rgba(7,19,14,0.05)]"
              >
                <h3 className="text-lg font-extrabold text-[#07130e]">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ffbd29] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_0.54fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#07130e]/10 px-3 py-1 text-sm font-bold text-[#07130e]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              WhatsApp CRM pricing made simple
            </div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Choose the Talk Wagon Plan That Fits Your WhatsApp Workflow
            </h2>
            <p className="mt-2 max-w-2xl text-[#214336]">
              Start with a 14-day free trial, unlock full Pro features, or request a
              lifetime branded self-hosted setup for your business.
            </p>
            <div className="mt-6 max-w-2xl">
              <PublicCtaButtons
                primaryLabel="Start Free Trial"
                primaryHref="/signup"
                secondaryLabel="Request Lifetime Setup"
                secondaryHref="/checkout/lifetime"
                className="items-stretch sm:justify-start"
              />
            </div>
          </div>
          <Image
            src={pricingImages.upgradeCta}
            alt="Talk Wagon CRM upgrade CTA with growth metrics"
            width={1168}
            height={880}
            loading="lazy"
            className="h-auto w-full rounded-[28px] shadow-[0_20px_55px_rgba(7,19,14,0.18)]"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
