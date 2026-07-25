import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  JsonLdScript,
  WebPageJsonLd,
} from "@/components/marketing/seo-json-ld";
import {
  WhatsAppApiCategoryGuide,
  WhatsAppApiPricesMarketingPage,
} from "@/components/marketing/whatsapp-api-prices-page";
import { PublicCtaButtons } from "@/components/marketing/public-cta-buttons";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { getCanonicalUrl } from "@/lib/site-url";
import { dedupeSharedPricingRates } from "@/lib/whatsapp/pricing-rates";
import type { WhatsAppPricingRate } from "@/types";

export const dynamic = "force-dynamic";

const pricingRateTimeoutMs = 4000;
const pagePath = "/whatsapp-api-prices";
const pageTitle = "WhatsApp API Pricing Calculator | TalkWagon";
const pageDescription =
  "Estimate WhatsApp API pricing by country, message category, and delivered-message count. Compare WhatsApp business pricing rates before planning campaigns.";

const faqs = [
  {
    question: "What is WhatsApp API pricing?",
    answer:
      "WhatsApp API pricing is the usage cost for business messages sent through the WhatsApp Business Platform. Rates can vary by recipient country, message category, and provider billing setup.",
  },
  {
    question: "Is WhatsApp business pricing included in TalkWagon CRM plans?",
    answer:
      "No. TalkWagon CRM subscription pricing and WhatsApp business pricing are separate. TalkWagon helps teams manage inboxes, contacts, broadcasts, flows, and follow-ups, while Meta or an official provider may bill WhatsApp API usage separately.",
  },
  {
    question: "What does the WhatsApp API pricing calculator estimate?",
    answer:
      "The calculator estimates delivered-message cost by multiplying the selected market rate by the number of delivered messages. It is a planning estimate for WhatsApp business API pricing, not a final Meta invoice.",
  },
  {
    question: "How is WhatsApp cloud API pricing calculated?",
    answer:
      "WhatsApp cloud API pricing is planned by market, message category, and delivered-message count. Marketing, utility, authentication, and service messages can have different rates depending on the recipient market.",
  },
  {
    question: "Why can my final WhatsApp business cost be different?",
    answer:
      "Final billing can differ because of Meta pricing updates, taxes, exchange rates, provider fees, account setup, and whether messages are actually delivered.",
  },
] as const;

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: getCanonicalUrl(pagePath),
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: getCanonicalUrl(pagePath),
    siteName: "TalkWagon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

async function loadPricingRates(): Promise<WhatsAppPricingRate[]> {
  try {
    const result = await Promise.race([
      supabaseAdmin()
        .from("whatsapp_pricing_rates")
        .select("*")
        .order("country_name"),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("Pricing rate lookup timed out") }),
          pricingRateTimeoutMs,
        ),
      ),
    ]);

    if (result.error) return [];
    return dedupeSharedPricingRates((result.data ?? []) as WhatsAppPricingRate[]);
  } catch {
    return [];
  }
}

export default async function PublicWhatsAppApiPricesPage() {
  const rates = await loadPricingRates();
  const canonicalUrl = getCanonicalUrl(pagePath);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbf8] text-[#07130e]">
      <WebPageJsonLd path={pagePath} name="WhatsApp API Pricing Calculator" description={pageDescription} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "WhatsApp API Pricing", url: pagePath },
        ]}
      />
      <FaqJsonLd id="whatsapp-api-prices-faq-json-ld" faqs={faqs} />
      <JsonLdScript
        id="whatsapp-api-prices-software-json-ld"
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TalkWagon WhatsApp API Pricing Calculator",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: canonicalUrl,
          description: pageDescription,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "Public WhatsApp API pricing calculator included on the TalkWagon website.",
          },
        }}
      />

      <PublicHeader active="api-pricing" />

      <section className="relative isolate overflow-hidden bg-[#07130e] text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(61,223,132,0.25),transparent_34%),linear-gradient(90deg,rgba(7,19,14,0.98),rgba(27,55,43,0.9),rgba(7,19,14,0.98))]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0,transparent_9%,rgba(127,185,169,0.24)_9%,rgba(127,185,169,0.24)_9.3%,transparent_9.3%),linear-gradient(0deg,transparent_0,transparent_13%,rgba(127,185,169,0.16)_13%,rgba(127,185,169,0.16)_13.3%,transparent_13.3%)] bg-[length:120px_120px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.98fr_0.82fr] lg:px-10 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#d8fff1]">
              <CheckCircle2 className="h-4 w-4 text-[#3ddf84]" aria-hidden="true" />
              Official WhatsApp API pricing planning for CRM teams
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              WhatsApp API Pricing and Cost Calculator
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#d5e9e2] sm:text-lg">
              Estimate WhatsApp API pricing by recipient market, message category, and delivered
              message count. Compare WhatsApp business pricing, WhatsApp business API pricing,
              and WhatsApp cloud API pricing assumptions before planning broadcasts, service
              replies, utility alerts, or authentication messages.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#calculator"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3ddf84] px-7 text-sm font-extrabold text-[#07130e] hover:bg-[#ffbd29]"
              >
                Use calculator
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-sm font-extrabold text-white hover:bg-white hover:text-[#07130e]"
              >
                TalkWagon pricing page
              </a>
            </div>
          </div>
          <aside className="relative overflow-hidden rounded-[34px] border border-white/15 bg-white/8 p-3 shadow-[0_32px_95px_rgba(0,0,0,0.35)] backdrop-blur">
            <Image
              src="/hostiko-crm/generated/pricing/talk-wagon-pricing-whatsapp-api-costs-usd.webp"
              alt="TalkWagon WhatsApp API pricing calculator dashboard illustration"
              width={1168}
              height={876}
              priority
              sizes="(min-width: 1024px) 42vw, 94vw"
              className="aspect-[4/3] w-full rounded-[26px] object-cover object-left-top"
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-[#07130e]/82 p-4 text-sm leading-6 text-[#d8fff1] shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur">
              Visual guide only — use the live calculator and market table below for the current TalkWagon rate data.
            </div>
          </aside>
        </div>
      </section>

      <div id="calculator">
        <WhatsAppApiPricesMarketingPage rates={rates} />
      </div>
      <WhatsAppApiCategoryGuide />

      <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">
              FAQ
            </p>
            <h2 className="mt-4 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
              WhatsApp API pricing questions
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
        <div className="mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1fr_0.55fr]">
          <div>
            <h2 className="text-2xl font-extrabold text-[#07130e] sm:text-3xl">
              Need CRM pricing, not only API message pricing?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#214336]">
              TalkWagon helps your team manage WhatsApp inboxes, contacts, broadcasts, flows,
              automations, and follow-ups. WhatsApp API usage remains a separate Meta/provider cost.
            </p>
          </div>
          <PublicCtaButtons
            primaryLabel="Compare TalkWagon plans"
            primaryHref="/pricing"
            secondaryLabel="Start Free Trial"
            secondaryHref="/signup"
            className="items-stretch lg:justify-end"
          />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
