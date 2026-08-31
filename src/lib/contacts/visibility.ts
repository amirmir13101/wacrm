import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import type { CurrentWorkspace } from '@/lib/team/server'

export type VisibleContactScope =
  | { kind: 'all' }
  | { kind: 'ids'; ids: string[] }

export async function visibleContactIds(
  workspace: CurrentWorkspace,
): Promise<VisibleContactScope> {
  if (
    workspace.contactVisibility === 'all' ||
    hasWorkspacePermission(workspace, 'view_all_contacts')
  ) {
    return { kind: 'all' }
  }

  if (
    workspace.contactVisibility === 'none' ||
    !hasWorkspacePermission(workspace, 'view_assigned_contacts')
  ) {
    return { kind: 'ids', ids: [] }
  }

  const admin = supabaseAdmin()
  const [conversationResult, profileResult] = await Promise.all([
    admin
      .from('conversations')
      .select('contact_id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('assigned_agent_id', workspace.userId)
      .not('contact_id', 'is', null),
    admin
      .from('profiles')
      .select('id')
      .eq('user_id', workspace.userId)
      .maybeSingle(),
  ])

  const contactIds = new Set<string>(
    ((conversationResult.data ?? []) as Array<{ contact_id: string | null }>)
      .map((row) => row.contact_id)
      .filter((id): id is string => Boolean(id)),
  )

  const profileId = (profileResult.data as { id?: string } | null)?.id
  if (profileId) {
    const { data: deals } = await admin
      .from('deals')
      .select('contact_id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('assigned_to', profileId)
      .not('contact_id', 'is', null)

    for (const row of (deals ?? []) as Array<{ contact_id: string | null }>) {
      if (row.contact_id) contactIds.add(row.contact_id)
    }
  }

  return { kind: 'ids', ids: Array.from(contactIds) }
}
