import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'
import type { ApprovalStatus, UserRole } from '@/lib/auth/approval'
import { ensureApprovedUserOwnWorkspace } from '@/lib/team/server'

const allowedStatuses: ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'suspended',
]

const allowedRoles: UserRole[] = ['admin', 'user']

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const nextStatus = body?.approval_status as ApprovalStatus | undefined
  const nextRole = body?.role as UserRole | undefined

  if (nextStatus && !allowedStatuses.includes(nextStatus)) {
    return NextResponse.json(
      { error: 'Invalid approval status' },
      { status: 400 },
    )
  }

  if (nextRole && !allowedRoles.includes(nextRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (!nextStatus && !nextRole) {
    return NextResponse.json(
      { error: 'No supported user changes provided' },
      { status: 400 },
    )
  }

  const updates: Record<string, string | null> = {}
  if (nextRole) updates.role = nextRole
  if (nextStatus) {
    updates.approval_status = nextStatus
    if (nextStatus === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = adminCheck.profile.id
    } else {
      updates.approved_at = null
      updates.approved_by = null
    }
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(
      'id, user_id, full_name, email, role, approval_status, approved_at, approved_by, created_at, updated_at',
    )
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to update user: ${error.message}` },
      { status: 500 },
    )
  }

  if (nextStatus === 'approved') {
    try {
      await ensureApprovedUserOwnWorkspace(data.user_id)
    } catch (workspaceError) {
      return NextResponse.json(
        {
          error:
            workspaceError instanceof Error
              ? `User approved, but workspace setup failed: ${workspaceError.message}`
              : 'User approved, but workspace setup failed',
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ user: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const deleteReason =
    typeof body?.delete_reason === 'string' && body.delete_reason.trim()
      ? body.delete_reason.trim()
      : 'Deleted by platform admin'

  const admin = supabaseAdmin()
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, user_id, full_name, email, role, approval_status, created_at')
    .eq('id', id)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (target.user_id === adminCheck.user.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own platform admin account.' },
      { status: 400 },
    )
  }

  const { data: ownedWorkspaces, error: workspaceError } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_user_id', target.user_id)
    .limit(1)

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 })
  }
  if ((ownedWorkspaces ?? []).length > 0) {
    return NextResponse.json(
      {
        error:
          'This user owns a workspace. Transfer or archive the workspace before deleting the owner account.',
      },
      { status: 400 },
    )
  }

  const deletedAt = new Date().toISOString()
  const { data, error } = await admin
    .from('profiles')
    .update({
      approval_status: 'deleted',
      approved_at: null,
      approved_by: null,
      deleted_at: deletedAt,
      deleted_by: adminCheck.profile.id,
      delete_reason: deleteReason,
    })
    .eq('id', id)
    .select(
      'id, user_id, full_name, email, role, approval_status, approved_at, approved_by, deleted_at, deleted_by, delete_reason, created_at, updated_at',
    )
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete user: ${error.message}` },
      { status: 500 },
    )
  }

  const { error: memberError } = await admin
    .from('workspace_members')
    .update({ status: 'suspended' })
    .eq('user_id', target.user_id)
    .neq('role', 'owner')

  if (memberError) {
    return NextResponse.json(
      { error: `User deleted, but membership suspension failed: ${memberError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ user: data })
}
