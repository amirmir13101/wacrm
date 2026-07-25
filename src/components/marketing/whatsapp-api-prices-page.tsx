"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calculator,
  CheckCircle2,
  ExternalLink,
  Info,
  MessageSquareText,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { WhatsAppPricingRate } from "@/types";
import {
  calculatePricingEstimate,
  COMMON_VIEW_CURRENCIES,
  convertMicrosCurrency,
  formatRateMicros,
  isConvertedCurrencyEstimate,
  OFFICIAL_WHATSAPP_PRICING_URL,
  parseRateToMicros,
  type WhatsAppPricingCategory,
} from "@/lib/whatsapp/pricing";

const categoryOptions: { value: WhatsAppPricingCategory; label: string; description: string }[] = [
  {
    value: "marketing",
    label: "Marketing",
    description: "Promotions, offers, product announcements, newsletters, and growth campaigns.",
  },
  {
    value: "utility",
    label: "Utility",
    description: "Transactional updates such as order alerts, reminders, invoices, and account notices.",
  },
  {
    value: "authentication",
    label: "Authentication",
    description: "One-time passcodes and verification messages used to confirm a user action.",
  },
  {
    value: "service",
    label: "Service",
    description: "Customer support replies and service conversations handled through the platform.",
  },
];

type RateKey =
  | "marketing_rate"
  | "utility_rate"
  | "authentication_rate"
  | "service_rate";

function findDefaultRate(rates: WhatsAppPricingRate[]) {
  return (
    rates.find((rate) => rate.iso_country_code?.toUpperCase() === "US") ??
    rates.find((rate) => rate.country_name.trim().toLowerCase() === "united states") ??
    rates[0] ??
    null
  );
}

function rateCell(rate: WhatsAppPricingRate, key: RateKey) {
  const micros = parseRateToMicros(rate[key]);
  return micros === null ? "Not available" : `${formatRateMicros(micros, rate.currency)} / message`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available yet";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function WhatsAppApiPricesMarketingPage({
  rates,
}: {
  readonly rates: readonly WhatsAppPricingRate[];
}) {
  const allRates = useMemo(() => [...rates], [rates]);
  const defaultRate = findDefaultRate(allRates);
  const [rateId, setRateId] = useState(defaultRate?.id ?? "");
  const [category, setCategory] = useState<WhatsAppPricingCategory>("marketing");
  const [messageCount, setMessageCount] = useState(1000);
  const [viewCurrency, setViewCurrency] = useState("");
  const [search, setSearch] = useState("");

  const selectedRate = allRates.find((rate) => rate.id === rateId) ?? defaultRate;
  const estimate = useMemo(
    () =>
      calculatePricingEstimate({
        rate: selectedRate,
        category,
        messageCount,
      }),
    [selectedRate, category, messageCount],
  );
  const convertedEstimate = useMemo(() => {
    if (!selectedRate || !viewCurrency || estimate.status !== "ok") return null;
    return convertMicrosCurrency({
      amountMicros: estimate.rawTotalMicros,
      fromCurrency: selectedRate.currency,
      toCurrency: viewCurrency,
    });
  }, [selectedRate, viewCurrency, estimate]);

  const filteredRates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allRates;
    return allRates.filter((rate) =>
      [rate.country_name, rate.iso_country_code, rate.phone_country_code, rate.currency]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [allRates, search]);

  return (
    <>
      <section className="bg-white px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.78fr)] lg:items-start">
          <div className="rounded-[30px] border border-[#dbe9e2] bg-[#f7fbf8] p-6 shadow-[0_18px_50px_rgba(7,19,14,0.07)] sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#07130e] text-[#3ddf84]">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">
                  WhatsApp API pricing calculator
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#07130e]">
                  Estimate your WhatsApp business cost
                </h2>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <CalculatorField label="Country / market">
                <select
                  value={selectedRate?.id ?? ""}
                  onChange={(event) => setRateId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#cfe5dc] bg-white px-4 text-sm font-bold text-[#07130e] outline-none transition-colors focus:border-[#08bba4] focus:ring-4 focus:ring-[#08bba4]/15"
                >
                  {allRates.length === 0 ? <option value="">Rates unavailable</option> : null}
                  {allRates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.country_name} ({rate.currency})
                    </option>
                  ))}
                </select>
              </CalculatorField>

              <CalculatorField label="Message category">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as WhatsAppPricingCategory)}
                  className="h-12 w-full rounded-2xl border border-[#cfe5dc] bg-white px-4 text-sm font-bold text-[#07130e] outline-none transition-colors focus:border-[#08bba4] focus:ring-4 focus:ring-[#08bba4]/15"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </CalculatorField>

              <CalculatorField label="Number of delivered messages">
                <Input
                  type="number"
                  min={0}
                  value={messageCount}
                  onChange={(event) => setMessageCount(Number(event.target.value) || 0)}
                  className="h-12 rounded-2xl border-[#cfe5dc] bg-white text-sm font-bold text-[#07130e]"
                />
              </CalculatorField>

              <CalculatorField label="View estimate in currency">
                <select
                  value={viewCurrency}
                  onChange={(event) => setViewCurrency(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#cfe5dc] bg-white px-4 text-sm font-bold text-[#07130e] outline-none transition-colors focus:border-[#08bba4] focus:ring-4 focus:ring-[#08bba4]/15"
                >
                  <option value="">Original currency only</option>
                  {COMMON_VIEW_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </CalculatorField>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#08bba4]/35 bg-white p-5">
              <p className="text-sm font-semibold text-[#5b7169]">Selected category</p>
              <p className="mt-1 text-lg font-extrabold text-[#07130e]">
                {categoryOptions.find((option) => option.value === category)?.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-[#5b7169]">
                {categoryOptions.find((option) => option.value === category)?.description}
              </p>
            </div>
          </div>

          <aside className="rounded-[30px] border border-[#0f8d72]/35 bg-[#07130e] p-6 text-white shadow-[0_24px_70px_rgba(7,19,14,0.22)] sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#3ddf84]">
              Estimated result
            </p>
            <p className="mt-5 text-sm text-[#b8cfc7]">Rate per delivered message</p>
            <p className="mt-2 text-3xl font-extrabold text-white">{estimate.rateDisplay}</p>
            <p className="mt-7 text-sm text-[#b8cfc7]">Estimated total</p>
            <p className="mt-2 text-4xl font-extrabold text-[#3ddf84]">{estimate.totalDisplay}</p>

            {convertedEstimate ? (
              <div className="mt-5 rounded-[22px] border border-[#3ddf84]/25 bg-[#3ddf84]/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8cfc7]">
                  Converted estimate
                </p>
                <p className="mt-2 text-2xl font-extrabold text-white">{convertedEstimate.display}</p>
                <Badge className="mt-3 bg-[#ffbd29]/15 text-[#ffdf7e]">
                  {convertedEstimate.status === "missing_rate" ? "FX rate missing" : "FX estimate"}
                </Badge>
              </div>
            ) : null}

            {selectedRate ? (
              <div className="mt-6 space-y-2 text-sm leading-6 text-[#b8cfc7]">
                <p className="break-words">
                  Source: {selectedRate.official_rate_source_url || selectedRate.source_url || OFFICIAL_WHATSAPP_PRICING_URL}
                </p>
                <p>Last verified: {formatDate(selectedRate.last_verified_at)}</p>
              </div>
            ) : null}

            {estimate.warnings.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {estimate.warnings.map((warning) => (
                  <Badge key={warning} className="bg-[#ffbd29]/15 text-[#ffdf7e]">
                    {warning}
                  </Badge>
                ))}
              </div>
            ) : null}

            <p className="mt-6 text-xs leading-6 text-[#8bb4a5]">
              Estimates are rounded for display. WhatsApp/Meta billing, taxes, provider fees, and
              exchange rates can differ from this WhatsApp business pricing estimate.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-[#f7fbf8] px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Delivered messages",
                copy: "Meta charges when a WhatsApp Platform message is delivered, not merely when it is queued or sent.",
                Icon: MessageSquareText,
              },
              {
                title: "Market and category",
                copy: "The recipient market and message category determine the rate shown in the official pricing table.",
                Icon: Calculator,
              },
              {
                title: "Template approval matters",
                copy: "Marketing, utility, and authentication campaigns depend on approved template categories.",
                Icon: ShieldCheck,
              },
              {
                title: "CRM costs are separate",
                copy: "TalkWagon subscription pricing and WhatsApp business cost remain separate cost layers.",
                Icon: Info,
              },
            ].map(({ title, copy, Icon }) => (
              <article
                key={title}
                className="rounded-[26px] border border-[#dbe9e2] bg-white p-6 shadow-[0_12px_35px_rgba(7,19,14,0.05)]"
              >
                <Icon className="h-6 w-6 text-[#08bba4]" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-extrabold text-[#07130e]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">{copy}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[30px] border border-[#dbe9e2] bg-white shadow-[0_18px_50px_rgba(7,19,14,0.07)]">
              <Image
                src="/hostiko-crm/generated/pricing/talk-wagon-pricing-whatsapp-api-costs-usd.webp"
                alt="WhatsApp API pricing calculator showing message categories and estimated costs"
                width={1168}
                height={876}
                sizes="(min-width: 1024px) 50vw, 94vw"
                className="aspect-[16/10] w-full object-cover object-left-top"
              />
              <div className="p-6">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#08bba4]">
                  API cost planning
                </p>
                <h3 className="mt-3 text-xl font-extrabold text-[#07130e]">
                  Estimate WhatsApp API pricing before a campaign goes live
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  Plan around delivered messages, market rates, and message categories before your team
                  sends marketing, utility, authentication, or service conversations.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-[30px] border border-[#dbe9e2] bg-white shadow-[0_18px_50px_rgba(7,19,14,0.07)]">
              <Image
                src="/hostiko-crm/generated/pricing/talk-wagon-pricing-usage-billing-analytics.webp"
                alt="TalkWagon billing analytics dashboard showing WhatsApp message usage and plan insights"
                width={1168}
                height={876}
                sizes="(min-width: 1024px) 50vw, 94vw"
                className="aspect-[16/10] w-full object-cover object-left-top"
              />
              <div className="p-6">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#08bba4]">
                  Usage visibility
                </p>
                <h3 className="mt-3 text-xl font-extrabold text-[#07130e]">
                  Keep CRM subscription and WhatsApp business cost separate
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5b7169]">
                  Use TalkWagon to manage team workflows, broadcasts, and customer conversations while
                  tracking WhatsApp/Meta usage as a separate billing layer.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing-table" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#08bba4]">
                Full pricing list
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-[#07130e] sm:text-4xl">
                WhatsApp business API pricing rates by market and category
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5b7169]">
                Search the admin-maintained TalkWagon rate list. The official WhatsApp pricing page
                remains the final source for Meta billing, and this table is shown to help teams plan
                WhatsApp business API pricing before sending campaigns. If you are comparing WhatsApp
                for business pricing with CRM software costs, keep message usage, provider fees, and
                TalkWagon subscription fees in separate budget lines.
              </p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b7169]" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search market, country code, or currency"
                className="h-12 rounded-2xl border-[#cfe5dc] bg-[#f7fbf8] pl-11 text-sm font-semibold text-[#07130e]"
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[26px] border border-[#dbe9e2] bg-white shadow-[0_18px_55px_rgba(7,19,14,0.07)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-[#07130e] text-left text-white">
                  <tr>
                    <th className="px-5 py-4">Country</th>
                    <th className="px-5 py-4">ISO</th>
                    <th className="px-5 py-4">Phone code</th>
                    <th className="px-5 py-4">Currency</th>
                    <th className="px-5 py-4">Marketing</th>
                    <th className="px-5 py-4">Utility</th>
                    <th className="px-5 py-4">Authentication</th>
                    <th className="px-5 py-4">Service</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-[#5b7169]">
                        No rates match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRates.map((rate) => (
                      <tr key={rate.id} className="border-t border-[#edf4f1] text-[#315249]">
                        <td className="px-5 py-4 font-extrabold text-[#07130e]">{rate.country_name}</td>
                        <td className="px-5 py-4">{rate.iso_country_code}</td>
                        <td className="px-5 py-4">+{rate.phone_country_code}</td>
                        <td className="px-5 py-4 font-bold">{rate.currency}</td>
                        <td className="px-5 py-4">{rateCell(rate, "marketing_rate")}</td>
                        <td className="px-5 py-4">{rateCell(rate, "utility_rate")}</td>
                        <td className="px-5 py-4">{rateCell(rate, "authentication_rate")}</td>
                        <td className="px-5 py-4">{rateCell(rate, "service_rate")}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className={
                                rate.verified_by_admin
                                  ? "bg-[#3ddf84]/15 text-[#08745d]"
                                  : "bg-[#ffbd29]/20 text-[#6d5000]"
                              }
                            >
                              {rate.verified_by_admin ? "Reviewed" : "Needs review"}
                            </Badge>
                            {isConvertedCurrencyEstimate(rate) ? (
                              <Badge className="bg-[#07130e]/10 text-[#315249]">FX estimate</Badge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-[#5b7169]">
            Need the CRM subscription price too? WhatsApp cloud API pricing is separate from CRM software.
            Compare TalkWagon plans on the{" "}
            <Link href="/pricing" className="font-extrabold text-[#08745d] underline-offset-4 hover:underline">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}

function CalculatorField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-[#315249]">{label}</span>
      {children}
    </label>
  );
}

export function WhatsAppApiCategoryGuide() {
  return (
    <section className="bg-[#07130e] px-5 py-20 text-white sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ffbd29]">
            API categories
          </p>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            What affects WhatsApp business API pricing?
          </h2>
          <p className="mt-5 text-base leading-8 text-[#d5e9e2]">
            WhatsApp API pricing is not one flat global number. The useful planning formula is
            simple: delivered messages multiplied by the rate for the recipient market and the
            selected category. WhatsApp cloud API pricing uses the same planning logic, while your
            provider may also charge platform or processing fees.
          </p>
          <a
            href={OFFICIAL_WHATSAPP_PRICING_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#3ddf84] px-5 py-3 text-sm font-extrabold text-[#07130e] hover:bg-[#ffbd29]"
          >
            Official WhatsApp pricing source
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {categoryOptions.map((option) => (
            <article key={option.value} className="rounded-[24px] border border-white/10 bg-white/8 p-5">
              <CheckCircle2 className="h-5 w-5 text-[#3ddf84]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-extrabold">{option.label}</h3>
              <p className="mt-3 text-sm leading-7 text-[#d5e9e2]">{option.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
