import { NextResponse } from 'next/server'

import { approvalRedirectPath, authenticatedRedirectPath, isAdmin } from '@/lib/auth/approval'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'
import { ensureApprovedUserOwnWorkspace, listCurrentUserWorkspaces } from '@/lib/team/server'

interface BootstrapProfile {
  id: string
  user_id: string
  email: string | null
  role: string | null
  approval_status: string | null
  account_type?: string | null
  must_change_password?: boolean | null
  active_workspace_id?: string | null
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const admin = supabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select(
      'id, user_id, email, role, approval_status, account_type, must_change_password, active_workspace_id',
    )
    .eq('user_id', user.id)
    .maybeSingle<BootstrapProfile>()

  if (profileError) {
    return NextResponse.json(
      {
        authenticated: true,
        error: 'Login succeeded, but your profile could not be loaded. Please contact support.',
      },
      { status: 500 },
    )
  }

  if (!profile) {
    return NextResponse.json(
      {
        authenticated: true,
        error: 'Login succeeded, but your CRM profile was not found. Please contact support.',
      },
      { status: 409 },
    )
  }

  const approvalPath = approvalRedirectPath(profile)
  if (approvalPath) {
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email ?? profile.email },
      profile,
      workspaces: [],
      active_workspace_id: null,
      redirectTo: approvalPath,
    })
  }

  if (profile.must_change_password || isAdmin(profile)) {
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email ?? profile.email },
      profile,
      workspaces: [],
      active_workspace_id: profile.active_workspace_id ?? null,
      redirectTo: authenticatedRedirectPath(profile),
    })
  }

  if (profile.account_type !== 'team_member') {
    await ensureApprovedUserOwnWorkspace(user.id)
  }

  const workspaces = await listCurrentUserWorkspaces(user.id)
  if (!workspaces.length) {
    const message =
      profile.account_type === 'team_member'
        ? 'Your team account is not connected to an active workspace. Please contact the workspace owner.'
        : 'Login succeeded, but your workspace could not be loaded. Please contact support.'

    return NextResponse.json(
      {
        authenticated: true,
        user: { id: user.id, email: user.email ?? profile.email },
        profile,
        workspaces: [],
        active_workspace_id: null,
        error: message,
      },
      { status: 409 },
    )
  }

  const activeWorkspace =
    workspaces.find((workspace) => workspace.workspace_id === profile.active_workspace_id) ??
    workspaces[0]

  if (activeWorkspace.workspace_id !== profile.active_workspace_id) {
    await admin
      .from('profiles')
      .update({ active_workspace_id: activeWorkspace.workspace_id })
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email ?? profile.email },
    profile: {
      ...profile,
      active_workspace_id: activeWorkspace.workspace_id,
    },
    workspaces,
    active_workspace_id: activeWorkspace.workspace_id,
    redirectTo: authenticatedRedirectPath(profile),
  })
}
