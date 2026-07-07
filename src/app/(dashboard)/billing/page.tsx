'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  Loader2,
  Radio,
} from 'lucide-react';

import type { WorkspaceTrialStatus } from '@/lib/billing/trial';

function formatDate(value?: string | null) {
  if (!value) return 'Not available yet';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function titleCase(value?: string | null) {
  if (!value) return 'Not available yet';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function planLabel(trial: WorkspaceTrialStatus) {
  if (trial.planType === 'pro') return 'Pro Plan';
  if (trial.planType === 'lifetime') return 'Lifetime setup';
  return 'Free Trial';
}

export default function BillingPage() {
  const [trial, setTrial] = useState<WorkspaceTrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/billing/trial')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load billing details');
        return payload.trial as WorkspaceTrialStatus;
      })
      .then((nextTrial) => {
        if (!cancelled) setTrial(nextTrial);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load billing details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const broadcastUsage = useMemo(() => {
    if (!trial) return null;
    if (trial.isActivePro) {
      return {
        used: trial.proBroadcastUsed,
        limit: trial.proBroadcastLimit,
        remaining: trial.proBroadcastRemaining ?? 0,
        label: 'Pro monthly broadcast usage',
        period: `${formatDate(trial.proBroadcastPeriodStart)} to ${formatDate(trial.proBroadcastPeriodEnd)}`,
      };
    }

    return {
      used: trial.trialBroadcastUsed,
      limit: trial.trialBroadcastLimit,
      remaining: trial.trialBroadcastRemaining ?? 0,
      label: 'Trial broadcast usage',
      period: `${formatDate(trial.trialStartedAt)} to ${formatDate(trial.trialEndsAt)}`,
    };
  }, [trial]);

  const usagePercent =
    broadcastUsage && broadcastUsage.limit > 0
      ? Math.min(100, Math.round((broadcastUsage.used / broadcastUsage.limit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#3ddf84]">
            Workspace billing
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Billing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#b8cfc7]">
            View your current plan, subscription dates, broadcast usage, and upgrade options for
            this workspace.
          </p>
        </div>
        <Link
          href="/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#3ddf84] px-5 text-sm font-extrabold text-[#07130e] transition hover:bg-[#ffbd29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ddf84]"
        >
          View plans
        </Link>
      </div>

      {loading ? (
        <section className="rounded-2xl border border-[#17402f] bg-[#082019]/70 p-6 text-[#b8cfc7]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading billing details...
          </span>
        </section>
      ) : error || !trial ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Billing details are temporarily unavailable.
          </span>
        </section>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-3">
            <SummaryCard
              icon={BadgeDollarSign}
              title="Current plan"
              value={planLabel(trial)}
              helper={trial.isTrial && trial.trialDaysRemaining !== null
                ? `${trial.trialDaysRemaining} day${trial.trialDaysRemaining === 1 ? '' : 's'} left`
                : titleCase(trial.subscriptionStatus)}
            />
            <SummaryCard
              icon={CreditCard}
              title="Subscription status"
              value={titleCase(trial.subscriptionStatus)}
              helper={`Billing period: ${titleCase(trial.billingPeriod)}`}
            />
            <SummaryCard
              icon={CalendarClock}
              title="Next billing / renewal"
              value={formatDate(trial.subscriptionEndsAt)}
              helper={trial.isActivePro ? 'Active Pro renewal date' : 'Shown when available'}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-2xl border border-[#17402f] bg-[#082019]/70 p-5">
              <div className="flex items-center gap-2">
                <Radio className="size-5 text-[#3ddf84]" />
                <h2 className="text-lg font-bold text-white">Broadcast usage</h2>
              </div>
              {broadcastUsage ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-white">{broadcastUsage.label}</p>
                      <p className="mt-1 text-[#8bb4a5]">{broadcastUsage.period}</p>
                    </div>
                    <p className="font-bold text-[#d8fff1]">
                      {broadcastUsage.used.toLocaleString()} / {broadcastUsage.limit.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#07130e]">
                    <div
                      className="h-full rounded-full bg-[#3ddf84]"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#b8cfc7]">
                    {broadcastUsage.remaining.toLocaleString()} broadcast messages remaining.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#b8cfc7]">Broadcast usage is not available yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#17402f] bg-[#082019]/70 p-5">
              <h2 className="text-lg font-bold text-white">Billing details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Detail label="Subscription start date" value={formatDate(trial.subscriptionStartedAt)} />
                <Detail label="Subscription end date" value={formatDate(trial.subscriptionEndsAt)} />
                <Detail label="Trial start date" value={formatDate(trial.trialStartedAt)} />
                <Detail label="Trial end date" value={formatDate(trial.trialEndsAt)} />
                <Detail label="Billing period" value={titleCase(trial.billingPeriod)} />
                <Detail label="Manual payment status" value={titleCase(trial.manualPaymentStatus)} />
                <Detail label="Payment method" value={titleCase(trial.manualPaymentMethod)} />
              </dl>
            </div>
          </section>

          {!trial.isActivePro && !trial.isLifetimeSetup ? (
            <section className="rounded-2xl border border-[#3ddf84]/30 bg-[#3ddf84]/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Ready for more broadcasts?</h2>
                  <p className="mt-1 text-sm text-[#b8cfc7]">
                    Upgrade to Pro when you need the hosted monthly broadcast allowance.
                  </p>
                </div>
                <Link
                  href="/checkout/pro"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#3ddf84] px-5 text-sm font-extrabold text-[#07130e] transition hover:bg-[#ffbd29]"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  helper,
}: {
  icon: typeof BadgeDollarSign;
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[#17402f] bg-[#082019]/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#b8cfc7]">{title}</p>
          <p className="mt-3 text-2xl font-extrabold text-white">{value}</p>
          <p className="mt-2 text-sm text-[#8bb4a5]">{helper}</p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3ddf84]/15 text-[#3ddf84]">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#17402f] bg-[#07130e]/70 px-3 py-2.5">
      <dt className="text-[#8bb4a5]">{label}</dt>
      <dd className="text-right font-semibold text-white">{value}</dd>
    </div>
  );
}
