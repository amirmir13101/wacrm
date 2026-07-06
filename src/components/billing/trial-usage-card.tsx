'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeDollarSign, Loader2 } from 'lucide-react'

import type { WorkspaceTrialStatus } from '@/lib/billing/trial'

interface TrialUsageCardProps {
  compact?: boolean
  onStatus?: (trial: WorkspaceTrialStatus) => void
}

function planLabel(planType?: string | null) {
  if (planType === 'pro') return 'Pro'
  if (planType === 'lifetime') return 'Lifetime setup'
  return 'Free Trial'
}

function formatPlanDate(value?: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function TrialUsageCard({ compact = false, onStatus }: TrialUsageCardProps) {
  const [trial, setTrial] = useState<WorkspaceTrialStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/billing/trial')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load trial usage')
        return payload.trial as WorkspaceTrialStatus
      })
      .then((nextTrial) => {
        if (!cancelled) {
          setTrial(nextTrial)
          onStatus?.(nextTrial)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trial usage')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [onStatus])

  const usagePercent = useMemo(() => {
    if (!trial || trial.trialBroadcastLimit <= 0) return 0
    return Math.min(100, Math.round((trial.trialBroadcastUsed / trial.trialBroadcastLimit) * 100))
  }, [trial])

  const proUsagePercent = useMemo(() => {
    if (!trial || trial.proBroadcastLimit <= 0) return 0
    return Math.min(100, Math.round((trial.proBroadcastUsed / trial.proBroadcastLimit) * 100))
  }, [trial])

  if (loading) {
    return (
      <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-4">
        <div className="flex items-center gap-2 text-sm text-[#b8cfc7]">
          <Loader2 className="size-4 animate-spin" />
          Loading plan usage...
        </div>
      </section>
    )
  }

  if (error || !trial) {
    return (
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4" />
          Plan usage is temporarily unavailable.
        </div>
      </section>
    )
  }

  const isPro = trial.isActivePro
  const isProExpired = trial.isProExpired
  const isLifetimeSetup = trial.isLifetimeSetup
  const remaining = trial.trialBroadcastRemaining ?? 0
  const proRemaining = trial.proBroadcastRemaining ?? 0
  const expiryDate = formatPlanDate(trial.subscriptionEndsAt)
  const proPeriodLabel = trial.billingPeriod === 'yearly' ? 'yearly' : 'monthly'
  const planMessage = isPro
    ? [
        `${trial.proBroadcastUsed.toLocaleString()} / ${trial.proBroadcastLimit.toLocaleString()} broadcast messages used this month. ${proRemaining.toLocaleString()} remaining.`,
        expiryDate ? `Your Pro ${proPeriodLabel} plan is active until ${expiryDate}.` : null,
      ]
        .filter(Boolean)
        .join(' ')
    : isProExpired
      ? 'Your Pro plan has expired. Renew your Pro plan to continue using Pro features.'
      : isLifetimeSetup
        ? 'Lifetime is a self-hosted setup request. Hosted CRM access continues through Trial or Pro.'
        : `${trial.trialBroadcastUsed.toLocaleString()} / ${trial.trialBroadcastLimit.toLocaleString()} trial broadcast messages used. ${remaining.toLocaleString()} remaining.`

  return (
    <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-extrabold text-emerald-950">
              <BadgeDollarSign className="size-3.5" />
              {planLabel(trial.planType)}
            </span>
            {trial.isTrial ? (
              <span className="text-sm font-semibold text-[#d8fff1]">
                {trial.trialDaysRemaining} day{trial.trialDaysRemaining === 1 ? '' : 's'} left
              </span>
            ) : isProExpired ? (
              <span className="text-sm font-semibold text-amber-200">Expired</span>
            ) : (
              <span className="text-sm font-semibold text-[#d8fff1]">
                {isPro ? 'Unlimited CRM usage' : 'Self-hosted setup request'}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[#b8cfc7]">{planMessage}</p>
        </div>

        {isProExpired ? (
          <Link
            href="/checkout/pro"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#3ddf84] px-5 text-sm font-bold text-[#07130e] hover:bg-[#ffbd29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ddf84]"
          >
            Renew Pro
          </Link>
        ) : isLifetimeSetup || isPro ? null : (
          <Link
            href="/checkout/pro"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#3ddf84] px-5 text-sm font-bold text-[#07130e] hover:bg-[#ffbd29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ddf84]"
          >
            Upgrade to Pro
          </Link>
        )}
      </div>

      {trial.hasTrialBroadcastLimit ? (
        <div className={compact ? 'mt-3' : 'mt-4'}>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-950">
            <div
              className="h-full rounded-full bg-[#3ddf84]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {(trial.isTrialExpired || trial.isTrialLimitReached) && (
            <p className="mt-2 text-xs font-semibold text-amber-200">
              {trial.isTrialExpired
                ? 'Your trial has ended. Upgrade to Pro to continue sending broadcasts.'
                : 'You have used all trial broadcast messages. Upgrade to Pro to continue sending broadcasts.'}
            </p>
          )}
        </div>
      ) : null}

      {isPro ? (
        <div className={compact ? 'mt-3' : 'mt-4'}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#d8fff1]">
            <span>Broadcast messages: {trial.proBroadcastUsed.toLocaleString()} / {trial.proBroadcastLimit.toLocaleString()} used</span>
            <span>{proRemaining.toLocaleString()} remaining this month</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-950">
            <div
              className="h-full rounded-full bg-[#3ddf84]"
              style={{ width: `${proUsagePercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
