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
  if (body?.confirmation !== 'PERMANENT DELETE') {
    return NextResponse.json(
      { error: 'Type PERMANENT DELETE to permanently delete this user.' },
      { status: 400 },
    )
  }

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

  const { error: deleteError } = await admin.auth.admin.deleteUser(target.user_id)
  if (deleteError) {
    return NextResponse.json(
      { error: `Permanent delete failed: ${deleteError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    deleted_user_id: target.user_id,
    deleted_profile_id: target.id,
  })
}
