import { supabaseAdmin } from '@/lib/automations/admin-client'

export const TRIAL_BROADCAST_LIMIT = 1000
export const TRIAL_DAYS = 14

export type WorkspacePlanType = 'trial' | 'pro' | 'lifetime'
export type WorkspaceSubscriptionStatus = 'trialing' | 'active' | 'expired' | 'cancelled' | 'manual'

export interface WorkspaceTrialStatus {
  workspaceId: string
  planType: WorkspacePlanType
  subscriptionStatus: WorkspaceSubscriptionStatus
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialBroadcastLimit: number
  trialBroadcastUsed: number
  trialBroadcastRemaining: number | null
  trialDaysRemaining: number | null
  isTrial: boolean
  isTrialExpired: boolean
  isTrialLimitReached: boolean
  hasTrialBroadcastLimit: boolean
}

interface TrialReserveResult {
  allowed?: boolean
  reason?: string
  message?: string
  plan_type?: WorkspacePlanType
  subscription_status?: WorkspaceSubscriptionStatus
  used?: number
  limit?: number
  remaining?: number | null
  requested?: number
  reserved?: number
  trial_ends_at?: string
}

interface WorkspacePlanRow {
  id: string
  plan_type: WorkspacePlanType | null
  subscription_status: WorkspaceSubscriptionStatus | null
  trial_started_at: string | null
  trial_ends_at: string | null
  trial_broadcast_limit: number | null
  trial_broadcast_used: number | null
}

export function calculateTrialStatus(row: WorkspacePlanRow, now = new Date()): WorkspaceTrialStatus {
  const planType = row.plan_type ?? 'trial'
  const subscriptionStatus = row.subscription_status ?? 'trialing'
  const limit = Math.max(row.trial_broadcast_limit ?? TRIAL_BROADCAST_LIMIT, 0)
  const used = Math.max(row.trial_broadcast_used ?? 0, 0)
  const isTrial = planType === 'trial' && subscriptionStatus === 'trialing'
  const endsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const isTrialExpired =
    planType === 'trial' &&
    (subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled' || (endsAt ? endsAt <= now : false))
  const remaining = planType === 'trial' ? Math.max(limit - used, 0) : null
  const trialDaysRemaining =
    isTrial && endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
      : null

  return {
    workspaceId: row.id,
    planType,
    subscriptionStatus,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialBroadcastLimit: limit,
    trialBroadcastUsed: used,
    trialBroadcastRemaining: remaining,
    trialDaysRemaining,
    isTrial,
    isTrialExpired,
    isTrialLimitReached: planType === 'trial' && used >= limit,
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

  return 'Your free trial broadcast limit is not available right now. Please try again or upgrade to Pro.'
}

export async function getWorkspaceTrialStatus(workspaceId: string): Promise<WorkspaceTrialStatus> {
  const { data, error } = await supabaseAdmin()
    .from('workspaces')
    .select(
      'id, plan_type, subscription_status, trial_started_at, trial_ends_at, trial_broadcast_limit, trial_broadcast_used',
    )
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load workspace plan: ${error.message}`)
  if (!data) throw new Error('Workspace not found')

  return calculateTrialStatus(data as WorkspacePlanRow)
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
