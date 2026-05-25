import { hasWorkspacePermission, type PermissionSubject } from './permissions'

export type WhatsAppConfigScope = 'workspace' | 'own' | 'managed_by_owner' | 'blocked'

export interface SafeWhatsAppConfig {
  id?: string
  phone_number_id?: string | null
  waba_id?: string | null
  status?: string | null
  connected_at?: string | null
}

export function resolveWhatsAppConfigScope(subject: PermissionSubject): WhatsAppConfigScope {
  if (hasWorkspacePermission(subject, 'manage_whatsapp_config')) return 'workspace'
  if (hasWorkspacePermission(subject, 'connect_own_whatsapp_config')) return 'own'
  if (hasWorkspacePermission(subject, 'use_workspace_whatsapp_config')) return 'managed_by_owner'
  return 'blocked'
}

export function sanitizeWhatsAppConfigForClient(row?: SafeWhatsAppConfig | null): SafeWhatsAppConfig | undefined {
  if (!row) return undefined
  return {
    id: row.id,
    phone_number_id: row.phone_number_id,
    waba_id: row.waba_id,
    status: row.status,
    connected_at: row.connected_at,
  }
}
