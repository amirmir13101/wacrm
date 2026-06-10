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

interface OwnedWorkspaceForDelete {
  id: string
  name: string
  candidates: Array<{
    user_id: string
    full_name: string | null
    email: string | null
    role: string
  }>
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
  const action = typeof body?.action === 'string' ? body.action : 'delete'
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
    .select('id, name')
    .eq('owner_user_id', target.user_id)
    .is('archived_at', null)

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 })
  }
  if ((ownedWorkspaces ?? []).length > 0) {
    const ownedWorkspaceDetails = await loadOwnedWorkspaceDeleteDetails(
      ownedWorkspaces as Array<{ id: string; name: string }>,
      target.user_id,
    )

    if (action === 'transfer_delete') {
      const transfers = Array.isArray(body?.transfers) ? body.transfers : []
      const transferResult = await transferOwnedWorkspaces({
        workspaces: ownedWorkspaceDetails,
        transfers,
        oldOwnerUserId: target.user_id,
      })
      if (!transferResult.ok) {
        return NextResponse.json({ error: transferResult.error }, { status: 400 })
      }
    } else if (action === 'archive_delete') {
      if (body?.confirmation !== 'ARCHIVE DELETE') {
        return NextResponse.json(
          { error: 'Type ARCHIVE DELETE to archive workspaces and delete the owner.' },
          { status: 400 },
        )
      }
      const archiveResult = await archiveOwnedWorkspaces({
        workspaces: ownedWorkspaceDetails,
        archivedByProfileId: adminCheck.profile.id,
        reason: deleteReason,
      })
      if (!archiveResult.ok) {
        return NextResponse.json({ error: archiveResult.error }, { status: 500 })
      }
    } else {
      return NextResponse.json(
        {
          error:
            'This user owns a workspace. Choose transfer ownership or archive workspace before deleting the owner account.',
          requires_owner_action: true,
          owned_workspaces: ownedWorkspaceDetails,
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await softDeleteProfile({
    profileId: id,
    targetUserId: target.user_id,
    deletedByProfileId: adminCheck.profile.id,
    deleteReason,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ user: data })
}

async function softDeleteProfile({
  profileId,
  targetUserId,
  deletedByProfileId,
  deleteReason,
}: {
  profileId: string
  targetUserId: string
  deletedByProfileId: string
  deleteReason: string
}) {
  const admin = supabaseAdmin()
  const deletedAt = new Date().toISOString()
  const { data, error } = await admin
    .from('profiles')
    .update({
      approval_status: 'deleted',
      approved_at: null,
      approved_by: null,
      deleted_at: deletedAt,
      deleted_by: deletedByProfileId,
      delete_reason: deleteReason,
      active_workspace_id: null,
    })
    .eq('id', profileId)
    .select(
      'id, user_id, full_name, email, role, approval_status, approved_at, approved_by, deleted_at, deleted_by, delete_reason, created_at, updated_at',
    )
    .single()

  if (error) return { data: null, error: `Failed to delete user: ${error.message}` }

  const { error: memberError } = await admin
    .from('workspace_members')
    .update({ status: 'suspended' })
    .eq('user_id', targetUserId)
    .neq('role', 'owner')

  if (memberError) {
    return {
      data,
      error: `User deleted, but membership suspension failed: ${memberError.message}`,
    }
  }

  return { data, error: null }
}

async function loadOwnedWorkspaceDeleteDetails(
  workspaces: Array<{ id: string; name: string }>,
  oldOwnerUserId: string,
): Promise<OwnedWorkspaceForDelete[]> {
  const admin = supabaseAdmin()
  const workspaceIds = workspaces.map((workspace) => workspace.id)
  const { data: members } = workspaceIds.length
    ? await admin
        .from('workspace_members')
        .select('workspace_id, user_id, role, status')
        .in('workspace_id', workspaceIds)
        .eq('status', 'active')
        .neq('user_id', oldOwnerUserId)
    : { data: [] }

  const activeMembers = (members ?? []) as Array<{
    workspace_id: string
    user_id: string
    role: string
    status: string
  }>
  const candidateUserIds = [...new Set(activeMembers.map((member) => member.user_id))]
  const { data: profiles } = candidateUserIds.length
    ? await admin
        .from('profiles')
        .select('user_id, full_name, email, approval_status')
        .in('user_id', candidateUserIds)
        .eq('approval_status', 'approved')
    : { data: [] }
  const profileByUserId = new Map(
    ((profiles ?? []) as Array<{
      user_id: string
      full_name: string | null
      email: string | null
    }>).map((profile) => [profile.user_id, profile]),
  )

  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    candidates: activeMembers
      .filter((member) => member.workspace_id === workspace.id && profileByUserId.has(member.user_id))
      .map((member) => {
        const profile = profileByUserId.get(member.user_id)
        return {
          user_id: member.user_id,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          role: member.role,
        }
      }),
  }))
}

async function transferOwnedWorkspaces({
  workspaces,
  transfers,
  oldOwnerUserId,
}: {
  workspaces: OwnedWorkspaceForDelete[]
  transfers: unknown[]
  oldOwnerUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = supabaseAdmin()
  const transferByWorkspace = new Map(
    transfers
      .filter((transfer): transfer is { workspace_id: string; new_owner_user_id: string } =>
        Boolean(
          transfer &&
            typeof transfer === 'object' &&
            'workspace_id' in transfer &&
            'new_owner_user_id' in transfer &&
            typeof transfer.workspace_id === 'string' &&
            typeof transfer.new_owner_user_id === 'string',
        ),
      )
      .map((transfer) => [transfer.workspace_id, transfer.new_owner_user_id]),
  )

  for (const workspace of workspaces) {
    const newOwnerUserId = transferByWorkspace.get(workspace.id)
    if (!newOwnerUserId) return { ok: false, error: `Choose a new owner for ${workspace.name}.` }
    if (!workspace.candidates.some((candidate) => candidate.user_id === newOwnerUserId)) {
      return { ok: false, error: `Selected owner is not an active member of ${workspace.name}.` }
    }

    const { error: workspaceError } = await admin
      .from('workspaces')
      .update({ owner_user_id: newOwnerUserId })
      .eq('id', workspace.id)
      .eq('owner_user_id', oldOwnerUserId)
      .is('archived_at', null)
    if (workspaceError) return { ok: false, error: workspaceError.message }

    const { error: newOwnerError } = await admin
      .from('workspace_members')
      .update({
        role: 'owner',
        status: 'active',
        permissions: {},
        contact_visibility: 'all',
        conversation_visibility: 'all',
        deal_visibility: 'all',
      })
      .eq('workspace_id', workspace.id)
      .eq('user_id', newOwnerUserId)
    if (newOwnerError) return { ok: false, error: newOwnerError.message }

    const { error: oldOwnerError } = await admin
      .from('workspace_members')
      .update({ role: 'agent', status: 'suspended' })
      .eq('workspace_id', workspace.id)
      .eq('user_id', oldOwnerUserId)
    if (oldOwnerError) return { ok: false, error: oldOwnerError.message }
  }

  return { ok: true }
}

async function archiveOwnedWorkspaces({
  workspaces,
  archivedByProfileId,
  reason,
}: {
  workspaces: OwnedWorkspaceForDelete[]
  archivedByProfileId: string
  reason: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = supabaseAdmin()
  const archivedAt = new Date().toISOString()
  const workspaceIds = workspaces.map((workspace) => workspace.id)

  const { error: workspaceError } = await admin
    .from('workspaces')
    .update({
      archived_at: archivedAt,
      archived_by: archivedByProfileId,
      archive_reason: reason,
    })
    .in('id', workspaceIds)
    .is('archived_at', null)
  if (workspaceError) return { ok: false, error: workspaceError.message }

  const { error: memberError } = await admin
    .from('workspace_members')
    .update({ status: 'suspended' })
    .in('workspace_id', workspaceIds)
  if (memberError) return { ok: false, error: memberError.message }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ active_workspace_id: null })
    .in('active_workspace_id', workspaceIds)
  if (profileError) return { ok: false, error: profileError.message }

  return { ok: true }
}
