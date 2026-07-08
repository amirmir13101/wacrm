'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { MessageTemplate, VariableMapping } from '@/types';
import type { AudienceConfig } from '@/hooks/use-broadcast-sending';
import type { BroadcastPreflightSummary } from '@/lib/broadcast-preflight';
import {
  COMMON_VIEW_CURRENCIES,
  convertCurrencyTotalsToCurrency,
} from '@/lib/whatsapp/pricing';

interface Step4ReviewPreflightProps {
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
  acknowledgeBilling: boolean;
  acknowledgeMissingPricing: boolean;
  onAcknowledgeBillingChange: (checked: boolean) => void;
  onAcknowledgeMissingPricingChange: (checked: boolean) => void;
  onPreflightChange: (summary: BroadcastPreflightSummary | null) => void;
  onNext: () => void;
  onBack: () => void;
}

function StatusBadge({ state }: { state: 'passed' | 'warning' | 'blocked' }) {
  const config = {
    passed: 'bg-emerald-500/15 text-emerald-200',
    warning: 'bg-amber-500/15 text-amber-200',
    blocked: 'bg-red-500/15 text-red-200',
  }[state];
  return <Badge className={config}>{state === 'passed' ? 'Passed' : state === 'warning' ? 'Warning' : 'Blocked'}</Badge>;
}

export function Step4ReviewPreflight({
  template,
  audience,
  variables,
  acknowledgeBilling,
  acknowledgeMissingPricing,
  onAcknowledgeBillingChange,
  onAcknowledgeMissingPricingChange,
  onPreflightChange,
  onNext,
  onBack,
}: Step4ReviewPreflightProps) {
  const [summary, setSummary] = useState<BroadcastPreflightSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewCurrency, setViewCurrency] = useState('ORIGINAL');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch('/api/whatsapp/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'preflight',
        template_id: template.id,
        audience,
        variables,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Failed to run preflight');
        return payload.preflight as BroadcastPreflightSummary;
      })
      .then((preflight) => {
        if (cancelled) return;
        setSummary(preflight);
        onPreflightChange(preflight);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to run preflight');
        setSummary(null);
        onPreflightChange(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [template.id, audience, variables, onPreflightChange]);

  const canContinue = useMemo(() => {
    if (!summary) return false;
    if (summary.blockers.length > 0) return false;
    if (!acknowledgeBilling) return false;
    if (summary.pricingMissingCount > 0 && !acknowledgeMissingPricing) return false;
    return true;
  }, [acknowledgeBilling, acknowledgeMissingPricing, summary]);

  const convertedGrandTotal = useMemo(() => {
    if (!summary || viewCurrency === 'ORIGINAL' || summary.currencyTotals.length === 0) return null;
    return convertCurrencyTotalsToCurrency(summary.currencyTotals, viewCurrency);
  }, [summary, viewCurrency]);

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Preflight failed</AlertTitle>
          <AlertDescription>{error ?? 'Unable to prepare broadcast preflight.'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack} className="border-slate-700 text-slate-300">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Review & Preflight</h2>
        <p className="mt-1 text-sm text-slate-400">
          Confirm eligibility, pricing, and safety checks before queueing.
        </p>
      </div>

      {summary.blockers.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Broadcast blocked</AlertTitle>
          <AlertDescription>{summary.blockers.join(' ')}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <PreflightCard title="Connection" badge={<StatusBadge state={summary.whatsappConnected ? 'passed' : 'blocked'} />}>
          <p>{summary.whatsappConnected ? 'WhatsApp is connected.' : 'WhatsApp is not connected. Please configure WhatsApp in Settings.'}</p>
        </PreflightCard>
        <PreflightCard title="Template" badge={<StatusBadge state={summary.templateApproved ? 'passed' : 'blocked'} />}>
          <p className="font-medium text-white">{summary.templateName}</p>
          <p>{summary.templateLanguage} / {summary.templateCategory} / {summary.templateStatus}</p>
        </PreflightCard>
      </section>

      <section className="rounded-xl border border-[#3ddf84]/60 bg-slate-900/50 p-4 transition-colors hover:border-[#3ddf84]/80">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Recipients</h3>
          <StatusBadge state={summary.finalQueueCount > 0 ? 'passed' : 'blocked'} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Metric label="Total selected" value={summary.totalSelected} />
          <Metric label="Eligible" value={summary.eligibleCount} highlight />
          <Metric label="Final queued" value={summary.finalQueueCount} highlight />
          <Metric label="Not opted in" value={summary.skippedNotOptedIn} />
          <Metric label="Opted out" value={summary.skippedOptedOut} />
          <Metric label="Invalid phone" value={summary.skippedInvalidPhone} />
          <Metric label="Duplicate phone" value={summary.skippedDuplicatePhone} />
        </div>
      </section>

      <section className="rounded-xl border border-[#3ddf84]/60 bg-slate-900/50 p-4 transition-colors hover:border-[#3ddf84]/80">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Pricing</h3>
            <p className="mt-1 text-xs text-slate-500">Estimate only. Actual Meta billing and FX rates may differ.</p>
          </div>
          <StatusBadge state={summary.pricingMissingCount > 0 ? 'warning' : 'passed'} />
        </div>
        {summary.pricingBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400">No pricing estimate available.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#3ddf84]/60 transition-colors hover:border-[#3ddf84]/80">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Country</th>
                  <th className="px-3 py-2 text-left">Recipients</th>
                  <th className="px-3 py-2 text-left">Rate</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Verified</th>
                </tr>
              </thead>
              <tbody>
                {summary.pricingBreakdown.map((row) => (
                  <tr key={`${row.iso_country_code}:${row.currency}`} className="border-t border-slate-800 text-slate-300">
                    <td className="px-3 py-2">{row.country_name} / {row.currency}</td>
                    <td className="px-3 py-2">{row.recipientCount}</td>
                    <td className="px-3 py-2">{row.rateDisplay}</td>
                    <td className="px-3 py-2 text-white">{row.estimatedTotalDisplay}</td>
                    <td className="px-3 py-2">
                      <Badge className={row.verified ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}>
                        {row.verified ? 'Verified' : 'Needs review'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {summary.currencyTotals.length > 0 && (
          <div className="mt-3 space-y-3 rounded-lg border border-[#3ddf84]/60 bg-slate-950/30 p-3 transition-colors hover:border-[#3ddf84]/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-300">Original currency totals</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.currencyTotals.map((row) => (
                    <Badge key={row.currency} variant="outline" className="border-slate-700 text-slate-200">
                      {row.totalDisplay}
                    </Badge>
                  ))}
                </div>
              </div>
              <label className="space-y-1 text-xs text-slate-400">
                <span>View total in currency</span>
                <select
                  value={viewCurrency}
                  onChange={(event) => setViewCurrency(event.target.value)}
                  className="block h-9 min-w-44 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-sm text-white"
                >
                  <option value="ORIGINAL">Original currencies</option>
                  {COMMON_VIEW_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {convertedGrandTotal && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3">
                <p className="text-xs text-violet-200">Converted grand total</p>
                <p className="mt-1 text-xl font-semibold text-white">{convertedGrandTotal.display}</p>
                {convertedGrandTotal.status === 'missing_rate' ? (
                  <Badge className="mt-2 bg-amber-500/15 text-amber-200">FX rate missing</Badge>
                ) : (
                  <Badge className="mt-2 bg-violet-500/15 text-violet-200">FX estimate</Badge>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Totals are rounded for display. Converted with admin-maintained FX rates.
            </p>
          </div>
        )}
        {summary.missingPricingWarnings.length > 0 && (
          <div className="mt-3 space-y-1 text-xs text-amber-200">
            {summary.missingPricingWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
      </section>

      <div className="space-y-3 rounded-xl border border-[#3ddf84]/60 bg-slate-900/50 p-4 transition-colors hover:border-[#3ddf84]/80">
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={acknowledgeBilling}
            onChange={(event) => onAcknowledgeBillingChange(event.target.checked)}
            className="mt-1 size-4 accent-violet-600"
          />
          <span>I confirm these recipients are opted in and I understand this is an estimated cost.</span>
        </label>
        {summary.pricingMissingCount > 0 && (
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={acknowledgeMissingPricing}
              onChange={(event) => onAcknowledgeMissingPricingChange(event.target.checked)}
              className="mt-1 size-4 accent-violet-600"
            />
            <span>I understand some pricing rates are missing.</span>
          </label>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button variant="outline" onClick={onBack} className="border-slate-700 text-slate-300">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PreflightCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#3ddf84]/60 bg-slate-900/50 p-4 transition-colors hover:border-[#3ddf84]/80 text-sm text-slate-400">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium text-white">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={highlight ? 'text-lg font-semibold text-emerald-200' : 'text-lg font-semibold text-white'}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
