'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculator, Edit2, ExternalLink, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WhatsAppPricingRate as DbPricingRate } from '@/types';
import {
  calculatePricingEstimate,
  categoryRateField,
  COMMON_VIEW_CURRENCIES,
  convertMicrosCurrency,
  EXCHANGE_RATE_LAST_UPDATED_AT,
  EXCHANGE_RATE_SOURCE_NOTE,
  EXAMPLE_PRICING_RATES,
  isConvertedCurrencyEstimate,
  OFFICIAL_WHATSAPP_PRICING_URL,
  type WhatsAppPricingCategory,
} from '@/lib/whatsapp/pricing';

type PricingForm = {
  country_name: string;
  iso_country_code: string;
  phone_country_code: string;
  currency: string;
  marketing_rate: string;
  utility_rate: string;
  authentication_rate: string;
  service_rate: string;
  official_rate_source_url: string;
  source_note: string;
  notes: string;
  effective_from: string;
  last_verified_at: string;
  verified_by_admin: boolean;
};

const EMPTY_FORM: PricingForm = {
  country_name: '',
  iso_country_code: '',
  phone_country_code: '',
  currency: 'USD',
  marketing_rate: '',
  utility_rate: '',
  authentication_rate: '',
  service_rate: '',
  official_rate_source_url: OFFICIAL_WHATSAPP_PRICING_URL,
  source_note: '',
  notes: '',
  effective_from: '',
  last_verified_at: '',
  verified_by_admin: false,
};

const CATEGORY_OPTIONS: { value: WhatsAppPricingCategory; label: string }[] = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'utility', label: 'Utility' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'service', label: 'Service' },
];

function toForm(rate: DbPricingRate): PricingForm {
  return {
    country_name: rate.country_name,
    iso_country_code: rate.iso_country_code,
    phone_country_code: rate.phone_country_code,
    currency: rate.currency,
    marketing_rate: String(rate.marketing_rate ?? ''),
    utility_rate: String(rate.utility_rate ?? ''),
    authentication_rate: String(rate.authentication_rate ?? ''),
    service_rate: String(rate.service_rate ?? ''),
    official_rate_source_url: rate.official_rate_source_url ?? rate.source_url ?? OFFICIAL_WHATSAPP_PRICING_URL,
    source_note: rate.source_note ?? '',
    notes: rate.notes ?? '',
    effective_from: rate.effective_from ?? '',
    last_verified_at: rate.last_verified_at ? rate.last_verified_at.slice(0, 10) : '',
    verified_by_admin: Boolean(rate.verified_by_admin),
  };
}

function cleanRate(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function WhatsAppPricingManager() {
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [rates, setRates] = useState<DbPricingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingForm>(EMPTY_FORM);
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
    fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchRates() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_pricing_rates')
      .select('*')
      .eq('user_id', user.id)
      .order('country_name');

    if (error) {
      toast.error('Failed to load WhatsApp pricing rates');
    } else {
      setRates((data ?? []) as DbPricingRate[]);
      if (!calculatorRateId && data?.[0]) setCalculatorRateId(data[0].id);
    }
    setLoading(false);
  }

  function update<K extends keyof PricingForm>(key: K, value: PricingForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function edit(rate: DbPricingRate) {
    setEditingId(rate.id);
    setForm(toForm(rate));
  }

  async function saveRate() {
    if (!user) return;
    if (!isAdmin) {
      toast.error('Only admins can manage pricing rates');
      return;
    }
    if (!form.country_name.trim() || !form.iso_country_code.trim() || !form.phone_country_code.trim()) {
      toast.error('Country, ISO code, and phone country code are required');
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      country_name: form.country_name.trim(),
      iso_country_code: form.iso_country_code.trim().toUpperCase(),
      phone_country_code: form.phone_country_code.replace(/\D/g, ''),
      currency: form.currency.trim().toUpperCase() || 'USD',
      marketing_rate: cleanRate(form.marketing_rate),
      utility_rate: cleanRate(form.utility_rate),
      authentication_rate: cleanRate(form.authentication_rate),
      service_rate: cleanRate(form.service_rate),
      official_rate_source_url: form.official_rate_source_url.trim() || OFFICIAL_WHATSAPP_PRICING_URL,
      source_url: form.official_rate_source_url.trim() || OFFICIAL_WHATSAPP_PRICING_URL,
      source_note: form.source_note.trim() || null,
      notes: form.notes.trim() || null,
      effective_from: form.effective_from || null,
      last_verified_at: form.last_verified_at ? new Date(form.last_verified_at).toISOString() : null,
      verified_by_admin: form.verified_by_admin,
    };

    const { error } = editingId
      ? await supabase.from('whatsapp_pricing_rates').update(payload).eq('id', editingId)
      : await supabase.from('whatsapp_pricing_rates').insert(payload);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingId ? 'Pricing rate updated' : 'Pricing rate added');
      resetForm();
      await fetchRates();
    }
    setSaving(false);
  }

  async function deleteRate(rate: DbPricingRate) {
    if (!isAdmin) {
      toast.error('Only admins can delete pricing rates');
      return;
    }
    if (!confirm(`Delete pricing rate for ${rate.country_name}?`)) return;
    const { error } = await supabase.from('whatsapp_pricing_rates').delete().eq('id', rate.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Pricing rate deleted');
      await fetchRates();
    }
  }

  async function addExampleRates() {
    if (!user || !isAdmin) return;
    setSaving(true);
    const existing = new Set(rates.map((rate) => `${rate.iso_country_code}:${rate.currency}`));
    const rows = EXAMPLE_PRICING_RATES.filter(
      (rate) => !existing.has(`${rate.iso_country_code}:${rate.currency}`),
    ).map((rate) => ({ ...rate, user_id: user.id }));

    if (rows.length === 0) {
      toast.info('Example countries already exist');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('whatsapp_pricing_rates').insert(rows);
    if (error) toast.error(error.message);
    else {
      toast.success('Example pricing rows added');
      await fetchRates();
    }
    setSaving(false);
  }

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
          <h2 className="text-lg font-semibold text-white">WhatsApp Pricing</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Store manually verified Meta pricing rates and estimate campaign cost before sending.
            Estimate only. Actual Meta billing may differ.
          </p>
          <p className="mt-2 max-w-3xl text-xs text-amber-200">
            Actual Meta billing may differ. Verify important campaigns with the official WhatsApp
            calculator.
          </p>
          <a
            href={OFFICIAL_WHATSAPP_PRICING_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
          >
            Official WhatsApp pricing page <ExternalLink className="size-3" />
          </a>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addExampleRates}
          disabled={!isAdmin || saving}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <Plus className="size-4" />
          Add Example Countries
        </Button>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Pricing is admin-managed. You can view estimates, but only admins can change rates.
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Country">
              <Input value={form.country_name} onChange={(e) => update('country_name', e.target.value)} placeholder="Pakistan" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="ISO code">
              <Input value={form.iso_country_code} onChange={(e) => update('iso_country_code', e.target.value)} placeholder="PK" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Phone country code">
              <Input value={form.phone_country_code} onChange={(e) => update('phone_country_code', e.target.value)} placeholder="92" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Currency">
              <Input value={form.currency} onChange={(e) => update('currency', e.target.value)} placeholder="USD" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Marketing rate">
              <Input type="number" step="0.000001" value={form.marketing_rate} onChange={(e) => update('marketing_rate', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Utility rate">
              <Input type="number" step="0.000001" value={form.utility_rate} onChange={(e) => update('utility_rate', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Authentication rate">
              <Input type="number" step="0.000001" value={form.authentication_rate} onChange={(e) => update('authentication_rate', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Service rate">
              <Input type="number" step="0.000001" value={form.service_rate} onChange={(e) => update('service_rate', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Official source URL">
              <Input value={form.official_rate_source_url} onChange={(e) => update('official_rate_source_url', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Last verified">
              <Input type="date" value={form.last_verified_at} onChange={(e) => update('last_verified_at', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Effective from">
              <Input type="date" value={form.effective_from} onChange={(e) => update('effective_from', e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Source note">
              <Input value={form.source_note} onChange={(e) => update('source_note', e.target.value)} placeholder="Copied from official Meta calculator" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="Notes">
              <Input value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Internal note" className="bg-slate-800 border-slate-700 text-white" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.verified_by_admin} onChange={(e) => update('verified_by_admin', e.target.checked)} className="size-4 accent-violet-600" />
            Verified by admin against official Meta calculator
          </label>
          <div className="flex gap-2">
            <Button onClick={saveRate} disabled={!isAdmin || saving} className="bg-violet-600 text-white hover:bg-violet-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Update Rate' : 'Add Rate'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} className="border-slate-700 text-slate-300">
                Cancel Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={rateSearch}
              onChange={(event) => setRateSearch(event.target.value)}
              placeholder="Search country, ISO code, phone code, or currency"
              className="border-slate-700 bg-slate-900 pl-9 text-white"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Country</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Currency</th>
                <th className="px-3 py-2 text-left">Marketing</th>
                <th className="px-3 py-2 text-left">Utility</th>
                <th className="px-3 py-2 text-left">Verified</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading pricing rates...</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No pricing rates configured.</td></tr>
              ) : filteredRates.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No pricing rates match your search.</td></tr>
              ) : (
                filteredRates.map((rate) => (
                  <tr key={rate.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-3 py-2 text-white">{rate.country_name}</td>
                    <td className="px-3 py-2">+{rate.phone_country_code}</td>
                    <td className="px-3 py-2">{rate.currency}</td>
                    <td className="px-3 py-2">{rate.marketing_rate ?? '-'}</td>
                    <td className="px-3 py-2">{rate.utility_rate ?? '-'}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <Badge
                          variant={rate.verified_by_admin ? 'secondary' : 'outline'}
                          className={rate.verified_by_admin ? 'bg-emerald-500/15 text-emerald-200' : 'text-amber-200'}
                        >
                          {rate.verified_by_admin ? 'Verified' : 'Needs review'}
                        </Badge>
                        <p className="text-xs text-slate-500">
                          {rate.last_verified_at ? new Date(rate.last_verified_at).toLocaleDateString() : 'No date'}
                        </p>
                        {isConvertedCurrencyEstimate(rate) && (
                          <p className="text-xs text-amber-200">Converted from USD</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => edit(rate)} className="text-slate-300">
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteRate(rate)} className="text-red-300">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-violet-300" />
              <h3 className="font-medium text-white">Cost Calculator</h3>
            </div>
            <Field label="Country / market">
              <select value={calculatorRateId} onChange={(e) => setCalculatorRateId(e.target.value)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white">
                <option value="">Select rate</option>
                {rates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.country_name} ({rate.currency})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Message category">
              <select value={calculatorCategory} onChange={(e) => setCalculatorCategory(e.target.value as WhatsAppPricingCategory)} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white">
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of messages">
              <Input type="number" min={0} value={calculatorCount} onChange={(e) => setCalculatorCount(Number(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-white" />
            </Field>
            <Field label="View estimate in currency">
              <select
                value={calculatorViewCurrency}
                onChange={(e) => setCalculatorViewCurrency(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white"
              >
                <option value="">Original currency only</option>
                {COMMON_VIEW_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
              <p className="text-slate-400">Rate per delivered message</p>
              <p className="mt-1 text-lg font-semibold text-white">{estimate.rateDisplay}</p>
              <p className="mt-3 text-slate-400">Estimated total</p>
              <p className="mt-1 text-2xl font-semibold text-violet-200">{estimate.totalDisplay}</p>
              {convertedEstimate && (
                <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/10 p-3">
                  <p className="text-xs text-violet-200">Converted estimate</p>
                  <p className="mt-1 text-xl font-semibold text-white">{convertedEstimate.display}</p>
                  {convertedEstimate.status === 'missing_rate' ? (
                    <p className="mt-1 text-xs text-amber-200">Conversion rate not configured.</p>
                  ) : (
                    <div className="mt-1 space-y-1 text-xs text-slate-400">
                      <p>
                        Uses {EXCHANGE_RATE_SOURCE_NOTE.toLowerCase()} updated{' '}
                        {new Date(EXCHANGE_RATE_LAST_UPDATED_AT).toLocaleDateString()}.
                      </p>
                      {convertedEstimate.warnings.map((warning) => (
                        <p key={warning} className="text-amber-200">
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {calculatorRate && (
                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  <p>Category field: {categoryRateField(calculatorCategory)}</p>
                  <p>Source: {calculatorRate.official_rate_source_url || calculatorRate.source_url || OFFICIAL_WHATSAPP_PRICING_URL}</p>
                  <p>Last verified: {calculatorRate.last_verified_at ? new Date(calculatorRate.last_verified_at).toLocaleDateString() : 'Not verified'}</p>
                  {isConvertedCurrencyEstimate(calculatorRate) && (
                    <p className="text-amber-200">Converted estimate. Actual Meta billing currency/rate may differ.</p>
                  )}
                </div>
              )}
              {estimate.warnings.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-amber-200">
                  {estimate.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Estimate only. Actual Meta billing may differ. Verify against Meta&apos;s official calculator before real campaigns.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Totals are rounded for display. Internal calculation keeps full precision. Converted totals use admin-maintained exchange rates.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
