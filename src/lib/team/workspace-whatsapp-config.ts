import { supabaseAdmin } from '@/lib/automations/admin-client'

type ConfigColumns =
  | 'id, status'
  | 'phone_number_id, access_token, status'
  | 'phone_number_id, waba_id, access_token, status'
  | '*'

export async function findWorkspaceWhatsAppConfig<T = Record<string, unknown>>(args: {
  workspaceId: string
  columns?: ConfigColumns
}): Promise<{ config: T | null; source: 'workspace' | 'legacy_member' | null; error?: string }> {
  const admin = supabaseAdmin()
  const columns = args.columns ?? '*'

  const { data: ownerMembers, error: memberError } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', args.workspaceId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'manager'])

  if (memberError) {
    return { config: null, source: null, error: memberError.message }
  }

  const ownerUserIds = [...new Set((ownerMembers ?? []).map((member) => member.user_id).filter(Boolean))]
  if (ownerUserIds.length === 0) return { config: null, source: null }

  const { data: workspaceConfig, error: workspaceError } = await admin
    .from('whatsapp_config')
    .select(columns)
    .eq('workspace_id', args.workspaceId)
    .in('user_id', ownerUserIds)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (workspaceError) {
    return { config: null, source: null, error: workspaceError.message }
  }
  if (workspaceConfig) {
    return { config: workspaceConfig as T, source: 'workspace' }
  }

  const { data: legacyConfig, error: legacyError } = await admin
    .from('whatsapp_config')
    .select(columns)
    .in('user_id', ownerUserIds)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (legacyError) {
    return { config: null, source: null, error: legacyError.message }
  }

  return {
    config: (legacyConfig as T | null) ?? null,
    source: legacyConfig ? 'legacy_member' : null,
  }
}
