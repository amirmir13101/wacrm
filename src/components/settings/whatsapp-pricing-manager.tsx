'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculator, ExternalLink, Loader2, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import type { WhatsAppPricingRate as DbPricingRate } from '@/types';
import {
  calculatePricingEstimate,
  COMMON_VIEW_CURRENCIES,
  convertMicrosCurrency,
  formatRateMicros,
  isConvertedCurrencyEstimate,
  OFFICIAL_WHATSAPP_PRICING_URL,
  parseRateToMicros,
  type WhatsAppPricingCategory,
} from '@/lib/whatsapp/pricing';

const CATEGORY_OPTIONS: { value: WhatsAppPricingCategory; label: string }[] = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'utility', label: 'Utility' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'service', label: 'Service' },
];

type RateKey =
  | 'marketing_rate'
  | 'utility_rate'
  | 'authentication_rate'
  | 'service_rate';

function rateCell(rate: DbPricingRate, key: RateKey) {
  const micros = parseRateToMicros(rate[key]);
  return micros === null ? 'Not available' : `${formatRateMicros(micros, rate.currency)} / message`;
}

function findDefaultCalculatorRate(rates: DbPricingRate[]) {
  return (
    rates.find((rate) => rate.iso_country_code?.toUpperCase() === 'US') ??
    rates.find((rate) => ['united states', 'usa'].includes(rate.country_name.trim().toLowerCase())) ??
    rates[0] ??
    null
  );
}

export function WhatsAppPricingManager() {
  const { user, loading: authLoading } = useAuth();

  const [rates, setRates] = useState<DbPricingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateSearch, setRateSearch] = useState('');

  const [calculatorRateId, setCalculatorRateId] = useState('');
  const [calculatorCategory, setCalculatorCategory] = useState<WhatsAppPricingCategory>('marketing');
  const [calculatorCount, setCalculatorCount] = useState(1000);
  const [calculatorViewCurrency, setCalculatorViewCurrency] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRates() {
      setLoading(true);
      try {
        const response = await fetch('/api/pricing/rates');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load WhatsApp pricing rates');
        const loadedRates = (payload.rates ?? []) as DbPricingRate[];
        if (cancelled) return;
        setRates(loadedRates);
        setCalculatorRateId((current) => current || findDefaultCalculatorRate(loadedRates)?.id || '');
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load WhatsApp pricing rates');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRates();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const calculatorRate = rates.find((rate) => rate.id === calculatorRateId) ?? null;
  const filteredRates = useMemo(() => {
    const query = rateSearch.trim().toLowerCase();
    if (!query) return rates;

    return rates.filter((rate) =>
      [rate.country_name, rate.iso_country_code, rate.phone_country_code, rate.currency]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [rateSearch, rates]);

  const estimate = useMemo(
    () =>
      calculatePricingEstimate({
        rate: calculatorRate,
        category: calculatorCategory,
        messageCount: calculatorCount,
      }),
    [calculatorRate, calculatorCategory, calculatorCount],
  );

  const convertedEstimate = useMemo(() => {
    if (!calculatorRate || !calculatorViewCurrency || estimate.status !== 'ok') return null;
    return convertMicrosCurrency({
      amountMicros: estimate.rawTotalMicros,
      fromCurrency: calculatorRate.currency,
      toCurrency: calculatorViewCurrency,
    });
  }, [calculatorRate, calculatorViewCurrency, estimate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#3ddf84]">
            Billing estimate
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">WhatsApp API Pricing</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#b8cfc7]">
            Estimate WhatsApp message costs by country and message category. Actual Meta billing,
            taxes, and exchange rates may differ.
          </p>
          <a
            href={OFFICIAL_WHATSAPP_PRICING_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#3ddf84] hover:text-[#d8fff1]"
          >
            Official WhatsApp pricing page <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div>
        <Card className="border-[#236845] bg-[#082019]/90 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-[#3ddf84]" />
              <h2 className="font-semibold text-white">Cost Calculator</h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country / market">
                  <select
                    value={calculatorRateId}
                    onChange={(e) => setCalculatorRateId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#236845] bg-[#07130e] px-3 text-sm font-semibold text-white outline-none focus:border-[#3ddf84] focus:ring-2 focus:ring-[#3ddf84]/20"
                  >
                    <option value="">Select rate</option>
                    {rates.map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        {rate.country_name} ({rate.currency})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Message category">
                  <select
                    value={calculatorCategory}
                    onChange={(e) => setCalculatorCategory(e.target.value as WhatsAppPricingCategory)}
                    className="h-11 w-full rounded-xl border border-[#236845] bg-[#07130e] px-3 text-sm font-semibold text-white outline-none focus:border-[#3ddf84] focus:ring-2 focus:ring-[#3ddf84]/20"
                  >
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Number of messages">
                  <Input
                    type="number"
                    min={0}
                    value={calculatorCount}
                    onChange={(e) => setCalculatorCount(Number(e.target.value) || 0)}
                    className="h-11 rounded-xl border-[#236845] bg-[#07130e] text-white"
                  />
                </Field>

                <Field label="View estimate in currency">
                  <select
                    value={calculatorViewCurrency}
                    onChange={(e) => setCalculatorViewCurrency(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#236845] bg-[#07130e] px-3 text-sm font-semibold text-white outline-none focus:border-[#3ddf84] focus:ring-2 focus:ring-[#3ddf84]/20"
                  >
                    <option value="">Original currency only</option>
                    {COMMON_VIEW_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="rounded-xl border border-[#3ddf84]/60 bg-[#07130e]/80 p-4 text-sm transition-colors hover:border-[#3ddf84]/80">
                <p className="text-[#b8cfc7]">Rate per delivered message</p>
                <p className="mt-1 text-xl font-extrabold text-white">{estimate.rateDisplay}</p>
                <p className="mt-5 text-[#b8cfc7]">Estimated total</p>
                <p className="mt-1 text-3xl font-extrabold text-[#3ddf84]">{estimate.totalDisplay}</p>

                {convertedEstimate && (
                  <div className="mt-4 rounded-xl border border-[#3ddf84]/20 bg-[#3ddf84]/10 p-3">
                    <p className="text-xs font-semibold text-[#b8cfc7]">Converted estimate</p>
                    <p className="mt-1 text-xl font-extrabold text-white">{convertedEstimate.display}</p>
                    {convertedEstimate.status === 'missing_rate' ? (
                      <Badge className="mt-2 bg-amber-500/15 text-amber-200">FX rate missing</Badge>
                    ) : (
                      <Badge className="mt-2 bg-[#3ddf84]/15 text-[#d8fff1]">FX estimate</Badge>
                    )}
                  </div>
                )}

                {calculatorRate && (
                  <div className="mt-4 space-y-1 text-xs leading-5 text-[#b8cfc7]">
                    <p className="break-words">
                      Source: {calculatorRate.official_rate_source_url || calculatorRate.source_url || OFFICIAL_WHATSAPP_PRICING_URL}
                    </p>
                    <p>
                      Last verified:{' '}
                      {calculatorRate.last_verified_at
                        ? new Date(calculatorRate.last_verified_at).toLocaleDateString()
                        : 'Not available yet'}
                    </p>
                  </div>
                )}

                {estimate.warnings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {estimate.warnings.map((warning) => (
                      <Badge key={warning} className="bg-[#ffbd29]/15 text-[#ffdf7e]">
                        {warning}
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="mt-4 text-xs leading-5 text-[#8bb4a5]">
                  Totals are rounded for display. Converted totals use maintained FX estimate rates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#17402f] bg-[#082019]/70">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Markets and rates</h2>
              <p className="mt-1 text-sm text-[#b8cfc7]">
                Search available WhatsApp API pricing rates by country, ISO code, phone code, or currency.
              </p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8bb4a5]" />
              <Input
                value={rateSearch}
                onChange={(event) => setRateSearch(event.target.value)}
                placeholder="Search market or currency"
                className="h-11 rounded-xl border-[#236845] bg-[#07130e] pl-9 text-white"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#3ddf84]/60 transition-colors hover:border-[#3ddf84]/80">
            <table className="w-full text-sm">
              <thead className="bg-[#07130e] text-[#b8cfc7]">
                <tr>
                  <th className="px-3 py-3 text-left">Country</th>
                  <th className="px-3 py-3 text-left">Code</th>
                  <th className="px-3 py-3 text-left">Currency</th>
                  <th className="px-3 py-3 text-left">Marketing</th>
                  <th className="px-3 py-3 text-left">Utility</th>
                  <th className="px-3 py-3 text-left">Authentication</th>
                  <th className="px-3 py-3 text-left">Service</th>
                  <th className="px-3 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#8bb4a5]">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Loading pricing rates...
                      </span>
                    </td>
                  </tr>
                ) : rates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#8bb4a5]">
                      No pricing rates are available yet.
                    </td>
                  </tr>
                ) : filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#8bb4a5]">
                      No pricing rates match your search.
                    </td>
                  </tr>
                ) : (
                  filteredRates.map((rate) => (
                    <tr key={rate.id} className="border-t border-[#17402f] text-[#c7ddd5]">
                      <td className="px-3 py-3 font-semibold text-white">{rate.country_name}</td>
                      <td className="px-3 py-3">+{rate.phone_country_code}</td>
                      <td className="px-3 py-3">{rate.currency}</td>
                      <td className="px-3 py-3">{rateCell(rate, 'marketing_rate')}</td>
                      <td className="px-3 py-3">{rateCell(rate, 'utility_rate')}</td>
                      <td className="px-3 py-3">{rateCell(rate, 'authentication_rate')}</td>
                      <td className="px-3 py-3">{rateCell(rate, 'service_rate')}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            className={
                              rate.verified_by_admin
                                ? 'bg-[#3ddf84]/15 text-[#d8fff1]'
                                : 'bg-[#ffbd29]/15 text-[#ffdf7e]'
                            }
                          >
                            {rate.verified_by_admin ? 'Reviewed' : 'Needs review'}
                          </Badge>
                          {isConvertedCurrencyEstimate(rate) && (
                            <Badge className="bg-[#3ddf84]/10 text-[#b8cfc7]">FX estimate</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-[#b8cfc7]">{label}</Label>
      {children}
    </div>
  );
}
