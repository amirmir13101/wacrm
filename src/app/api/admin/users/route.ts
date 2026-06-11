import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'

type AdminUserAccountType = 'platform_admin' | 'workspace_owner' | 'pending_signup' | 'platform_user'

interface ProfileRow {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  role: string
  approval_status: string
  approved_at: string | null
  approved_by: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
  created_at: string
  updated_at: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, approval_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' || profile.approval_status !== 'approved') {
    return { error: 'Admin access required', status: 403 as const }
  }

  return { user, profile }
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const includeDeleted = status === 'deleted' || searchParams.get('include_deleted') === '1'

  const admin = supabaseAdmin()
  let query = admin
    .from('profiles')
    .select(
      'id, user_id, full_name, email, role, approval_status, approved_at, approved_by, deleted_at, deleted_by, delete_reason, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('approval_status', status)
  } else if (!includeDeleted) {
    query = query.neq('approval_status', 'deleted')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: `Failed to load users: ${error.message}` },
      { status: 500 },
    )
  }

  let users: Array<ProfileRow & { account_type: AdminUserAccountType }>
  try {
    users = await filterPlatformAdminUsers((data ?? []) as ProfileRow[])
  } catch (classificationError) {
    return NextResponse.json(
      {
        error:
          classificationError instanceof Error
            ? classificationError.message
            : 'Failed to classify admin users',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ users })
}

async function filterPlatformAdminUsers(profiles: ProfileRow[]) {
  if (profiles.length === 0) return []

  const admin = supabaseAdmin()
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean)
  const emails = profiles
    .map((profile) => profile.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))

  const [
    ownedWorkspaceResult,
    memberResult,
    invitedEmailResult,
    acceptedInviteResult,
  ] = await Promise.all([
    userIds.length
      ? admin.from('workspaces').select('owner_user_id').in('owner_user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from('workspace_members').select('user_id, role').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    emails.length
      ? admin
          .from('workspace_invitations')
          .select('invited_email')
          .in('invited_email', emails)
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin
          .from('workspace_invitations')
          .select('accepted_by_user_id')
          .in('accepted_by_user_id', userIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
  ])

  const lookupError =
    ownedWorkspaceResult.error ??
    memberResult.error ??
    invitedEmailResult.error ??
    acceptedInviteResult.error

  if (lookupError) {
    throw new Error(`Failed to classify admin users: ${lookupError.message}`)
  }

  const workspaceOwnerUserIds = new Set(
    ((ownedWorkspaceResult.data ?? []) as Array<{ owner_user_id: string | null }>)
      .map((row) => row.owner_user_id)
      .filter((userId): userId is string => Boolean(userId)),
  )
  const teamMemberOnlyUserIds = new Set(
    ((memberResult.data ?? []) as Array<{ user_id: string | null; role: string | null }>)
      .filter((row) => row.role !== 'owner')
      .map((row) => row.user_id)
      .filter((userId): userId is string => Boolean(userId)),
  )
  const invitedEmails = new Set(
    ((invitedEmailResult.data ?? []) as Array<{ invited_email: string | null }>)
      .map((row) => row.invited_email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  )
  const acceptedInviteUserIds = new Set(
    ((acceptedInviteResult.data ?? []) as Array<{ accepted_by_user_id: string | null }>)
      .map((row) => row.accepted_by_user_id)
      .filter((userId): userId is string => Boolean(userId)),
  )

  return profiles
    .map((profile) => ({
      ...profile,
      account_type: classifyAdminUser(profile, {
        workspaceOwnerUserIds,
        teamMemberOnlyUserIds,
        invitedEmails,
        acceptedInviteUserIds,
      }),
    }))
    .filter(
      (profile): profile is ProfileRow & { account_type: AdminUserAccountType } =>
        profile.account_type !== null,
    )
}

function classifyAdminUser(
  profile: ProfileRow,
  context: {
    workspaceOwnerUserIds: Set<string>
    teamMemberOnlyUserIds: Set<string>
    invitedEmails: Set<string>
    acceptedInviteUserIds: Set<string>
  },
): AdminUserAccountType | null {
  if (profile.role === 'admin') return 'platform_admin'
  if (context.workspaceOwnerUserIds.has(profile.user_id)) return 'workspace_owner'

  const email = profile.email?.trim().toLowerCase() ?? ''
  const hasInviteFootprint =
    context.teamMemberOnlyUserIds.has(profile.user_id) ||
    context.acceptedInviteUserIds.has(profile.user_id) ||
    (email ? context.invitedEmails.has(email) : false)

  if (hasInviteFootprint) return null
  if (profile.approval_status === 'pending') return 'pending_signup'
  return 'platform_user'
}
