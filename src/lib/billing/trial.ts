import { supabaseAdmin } from '@/lib/automations/admin-client'

export const TRIAL_BROADCAST_LIMIT = 1000
export const TRIAL_DAYS = 14
export const PRO_BROADCAST_MONTHLY_LIMIT = 1_000_000

export type WorkspacePlanType = 'trial' | 'pro' | 'lifetime'
export type WorkspaceSubscriptionStatus = 'trialing' | 'active' | 'expired' | 'cancelled' | 'manual'
export type WorkspaceBillingPeriod = 'monthly' | 'yearly' | 'lifetime_setup'

export interface WorkspaceTrialStatus {
  workspaceId: string
  planType: WorkspacePlanType
  subscriptionStatus: WorkspaceSubscriptionStatus
  billingPeriod: WorkspaceBillingPeriod | null
  subscriptionStartedAt: string | null
  subscriptionEndsAt: string | null
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialBroadcastLimit: number
  trialBroadcastUsed: number
  trialBroadcastRemaining: number | null
  proBroadcastLimit: number
  proBroadcastUsed: number
  proBroadcastRemaining: number | null
  proBroadcastPeriodStart: string | null
  proBroadcastPeriodEnd: string | null
  manualPaymentStatus: string | null
  manualPaymentMethod: string | null
  trialDaysRemaining: number | null
  isTrial: boolean
  isTrialExpired: boolean
  isTrialLimitReached: boolean
  isActivePro: boolean
  isProExpired: boolean
  isLifetimeSetup: boolean
  hasTrialBroadcastLimit: boolean
}

interface TrialReserveResult {
  allowed?: boolean
  reason?: string
  message?: string
  plan_type?: WorkspacePlanType
  subscription_status?: WorkspaceSubscriptionStatus
  billing_period?: WorkspaceBillingPeriod
  subscription_ends_at?: string
  used?: number
  limit?: number
  remaining?: number | null
  requested?: number
  reserved?: number
  trial_ends_at?: string
}

interface BroadcastReserveResult extends TrialReserveResult {
  period_start?: string
  period_end?: string
}

interface WorkspacePlanRow {
  id: string
  plan_type: WorkspacePlanType | null
  subscription_status: WorkspaceSubscriptionStatus | null
  billing_period?: WorkspaceBillingPeriod | null
  subscription_started_at?: string | null
  subscription_ends_at?: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  trial_broadcast_limit: number | null
  trial_broadcast_used: number | null
}

export function calculateTrialStatus(row: WorkspacePlanRow, now = new Date()): WorkspaceTrialStatus {
  const planType = row.plan_type ?? 'trial'
  const subscriptionStatus = row.subscription_status ?? 'trialing'
  const billingPeriod = row.billing_period ?? null
  const limit = Math.max(row.trial_broadcast_limit ?? TRIAL_BROADCAST_LIMIT, 0)
  const used = Math.max(row.trial_broadcast_used ?? 0, 0)
  const isTrial = planType === 'trial' && subscriptionStatus === 'trialing'
  const endsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const subscriptionEndsAt = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null
  const isTrialExpired =
    planType === 'trial' &&
    (subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled' || (endsAt ? endsAt <= now : false))
  const isActivePro =
    planType === 'pro' &&
    subscriptionStatus === 'active' &&
    (billingPeriod === 'monthly' || billingPeriod === 'yearly') &&
    Boolean(subscriptionEndsAt && subscriptionEndsAt > now)
  const isProExpired =
    planType === 'pro' &&
    (subscriptionStatus === 'expired' ||
      subscriptionStatus === 'cancelled' ||
      !subscriptionEndsAt ||
      subscriptionEndsAt <= now)
  const isLifetimeSetup = planType === 'lifetime' || billingPeriod === 'lifetime_setup'
  const remaining = planType === 'trial' ? Math.max(limit - used, 0) : null
  const trialDaysRemaining =
    isTrial && endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
      : null

  return {
    workspaceId: row.id,
    planType,
    subscriptionStatus,
    billingPeriod,
    subscriptionStartedAt: row.subscription_started_at ?? null,
    subscriptionEndsAt: row.subscription_ends_at ?? null,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialBroadcastLimit: limit,
    trialBroadcastUsed: used,
    trialBroadcastRemaining: remaining,
    proBroadcastLimit: PRO_BROADCAST_MONTHLY_LIMIT,
    proBroadcastUsed: 0,
    proBroadcastRemaining: planType === 'pro' ? PRO_BROADCAST_MONTHLY_LIMIT : null,
    proBroadcastPeriodStart: null,
    proBroadcastPeriodEnd: null,
    manualPaymentStatus: null,
    manualPaymentMethod: null,
    trialDaysRemaining,
    isTrial,
    isTrialExpired,
    isTrialLimitReached: planType === 'trial' && used >= limit,
    isActivePro,
    isProExpired,
    isLifetimeSetup,
    hasTrialBroadcastLimit: planType === 'trial' && subscriptionStatus === 'trialing',
  }
}

export function trialBlockMessage(args: {
  reason?: string | null
  remaining?: number | null
}): string {
  if (args.reason === 'trial_expired') {
    return 'Your 14-day free trial has ended. Upgrade to Pro to continue sending broadcasts.'
  }

  if (args.reason === 'trial_limit_exceeded') {
    const remaining = Math.max(args.remaining ?? 0, 0)
    return `Your free trial includes 1,000 broadcast messages. You have ${remaining.toLocaleString()} remaining. Reduce your recipients or upgrade to Pro.`
  }

  if (args.reason === 'pro_expired') {
    return 'Your Pro plan has expired. Renew your Pro plan to continue sending broadcasts.'
  }

  if (args.reason === 'pro_limit_exceeded') {
    const remaining = Math.max(args.remaining ?? 0, 0)
    return `Your Pro plan includes 1,000,000 broadcast messages per billing period. You have ${remaining.toLocaleString()} remaining in this period. Reduce your recipients or wait for the next billing-period reset.`
  }

  if (args.reason === 'lifetime_setup_not_hosted') {
    return 'Lifetime is a self-hosted setup request, not hosted Pro access. Renew Pro to send broadcasts from this hosted workspace.'
  }

  return 'Your free trial broadcast limit is not available right now. Please try again or upgrade to Pro.'
}

export async function getWorkspaceTrialStatus(workspaceId: string): Promise<WorkspaceTrialStatus> {
  const { data, error } = await supabaseAdmin()
    .from('workspaces')
    .select(
      'id, plan_type, subscription_status, billing_period, subscription_started_at, subscription_ends_at, trial_started_at, trial_ends_at, trial_broadcast_limit, trial_broadcast_used',
    )
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load workspace plan: ${error.message}`)
  if (!data) throw new Error('Workspace not found')

  const status = calculateTrialStatus(data as WorkspacePlanRow)
  const { data: manualPayment, error: manualPaymentError } = await supabaseAdmin()
    .from('manual_payment_requests')
    .select('payment_method, status')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (manualPaymentError) {
    throw new Error(`Failed to load manual payment status: ${manualPaymentError.message}`)
  }

  const statusWithPayment = {
    ...status,
    manualPaymentStatus: typeof manualPayment?.status === 'string' ? manualPayment.status : null,
    manualPaymentMethod: typeof manualPayment?.payment_method === 'string' ? manualPayment.payment_method : null,
  }

  if (status.planType !== 'pro') return statusWithPayment

  const { data: usage, error: usageError } = await supabaseAdmin().rpc(
    'get_workspace_broadcast_usage_status',
    { p_workspace_id: workspaceId },
  )

  if (usageError) {
    throw new Error(`Failed to load Pro broadcast usage: ${usageError.message}`)
  }

  const usageStatus = (usage ?? {}) as {
    used?: number
    limit?: number
    remaining?: number
    period_start?: string
    period_end?: string
  }
  const proLimit = Math.max(Number(usageStatus.limit ?? PRO_BROADCAST_MONTHLY_LIMIT), 0)
  const used = Math.max(Number(usageStatus.used ?? 0), 0)
  return {
    ...status,
    manualPaymentStatus: statusWithPayment.manualPaymentStatus,
    manualPaymentMethod: statusWithPayment.manualPaymentMethod,
    proBroadcastLimit: proLimit,
    proBroadcastUsed: used,
    proBroadcastRemaining: Math.max(Number(usageStatus.remaining ?? proLimit - used), 0),
    proBroadcastPeriodStart: usageStatus.period_start ?? null,
    proBroadcastPeriodEnd: usageStatus.period_end ?? null,
  }
}

export async function reserveTrialBroadcastUsage(args: {
  workspaceId: string
  count: number
}): Promise<{
  allowed: boolean
  reserved: number
  message?: string
  result: TrialReserveResult
}> {
  const { data, error } = await supabaseAdmin().rpc('reserve_workspace_trial_broadcast_usage', {
    p_workspace_id: args.workspaceId,
    p_message_count: args.count,
  })

  if (error) throw new Error(`Failed to reserve trial usage: ${error.message}`)

  const result = (data ?? {}) as TrialReserveResult
  const allowed = result.allowed === true

  return {
    allowed,
    reserved: allowed ? Math.max(result.reserved ?? 0, 0) : 0,
    message: allowed ? undefined : trialBlockMessage({ reason: result.reason, remaining: result.remaining }),
    result,
  }
}

export async function releaseTrialBroadcastUsage(args: {
  workspaceId: string
  count: number
}): Promise<void> {
  if (args.count <= 0) return
  const { error } = await supabaseAdmin().rpc('release_workspace_trial_broadcast_usage', {
    p_workspace_id: args.workspaceId,
    p_message_count: args.count,
  })
  if (error) throw new Error(`Failed to release trial usage: ${error.message}`)
}

export async function reserveWorkspaceBroadcastUsage(args: {
  workspaceId: string
  count: number
}): Promise<{
  allowed: boolean
  reserved: number
  message?: string
  result: BroadcastReserveResult
}> {
  const { data, error } = await supabaseAdmin().rpc('reserve_workspace_broadcast_usage', {
    p_workspace_id: args.workspaceId,
    p_message_count: args.count,
  })

  if (error) throw new Error(`Failed to reserve broadcast usage: ${error.message}`)

  const result = (data ?? {}) as BroadcastReserveResult
  const allowed = result.allowed === true

  return {
    allowed,
    reserved: allowed ? Math.max(result.reserved ?? 0, 0) : 0,
    message: allowed ? undefined : trialBlockMessage({ reason: result.reason, remaining: result.remaining }),
    result,
  }
}

export async function releaseWorkspaceBroadcastUsage(args: {
  workspaceId: string
  count: number
}): Promise<void> {
  if (args.count <= 0) return
  const { error } = await supabaseAdmin().rpc('release_workspace_broadcast_usage', {
    p_workspace_id: args.workspaceId,
    p_message_count: args.count,
  })
  if (error) throw new Error(`Failed to release broadcast usage: ${error.message}`)
}
