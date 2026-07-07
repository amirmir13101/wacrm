import { supabaseAdmin } from '@/lib/automations/admin-client'

export const FREE_TEAM_MEMBER_LIMIT = 1
export const PRO_TEAM_MEMBER_LIMIT = 10

export const teamMemberLimitMessage = (limit: number) =>
  `Your current plan allows up to ${limit} team member(s). Upgrade your plan to invite more team members.`

export function workspaceTeamMemberLimit(args: {
  planType?: string | null
  subscriptionStatus?: string | null
  subscriptionEndsAt?: string | null
  now?: Date
}) {
  const now = args.now ?? new Date()
  const endsAt = args.subscriptionEndsAt ? new Date(args.subscriptionEndsAt) : null
  const isActivePro =
    args.planType === 'pro' &&
    args.subscriptionStatus === 'active' &&
    (!endsAt || endsAt.getTime() > now.getTime())

  return isActivePro ? PRO_TEAM_MEMBER_LIMIT : FREE_TEAM_MEMBER_LIMIT
}

export interface WorkspaceTeamLimitStatus {
  readonly limit: number
  readonly used: number
  readonly remaining: number
  readonly canInviteMore: boolean
  readonly message: string
}

interface WorkspacePlanRow {
  readonly plan_type: string | null
  readonly subscription_status: string | null
  readonly subscription_ends_at: string | null
}

export async function getWorkspaceTeamLimitStatus(
  workspaceId: string,
): Promise<WorkspaceTeamLimitStatus> {
  const admin = supabaseAdmin()
  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .select('plan_type, subscription_status, subscription_ends_at')
    .eq('id', workspaceId)
    .maybeSingle<WorkspacePlanRow>()

  if (workspaceError) throw new Error(workspaceError.message)
  if (!workspace) throw new Error('Workspace not found')

  const limit = workspaceTeamMemberLimit({
    planType: workspace.plan_type,
    subscriptionStatus: workspace.subscription_status,
    subscriptionEndsAt: workspace.subscription_ends_at,
  })

  const { count: memberCount, error: memberError } = await admin
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .neq('role', 'owner')
    .in('status', ['active', 'invited'])

  if (memberError) throw new Error(memberError.message)

  const { count: inviteCount, error: inviteError } = await admin
    .from('workspace_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())

  if (inviteError) throw new Error(inviteError.message)

  const used = Math.max((memberCount ?? 0) + (inviteCount ?? 0), 0)
  const remaining = Math.max(limit - used, 0)

  return {
    limit,
    used,
    remaining,
    canInviteMore: remaining > 0,
    message: teamMemberLimitMessage(limit),
  }
}

