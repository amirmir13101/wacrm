import { supabaseAdmin } from '@/lib/automations/admin-client'

export const RAG_AUTO_REPLY_DEFAULT_FALLBACK =
  "Sorry, I don't have that information right now. A team member will help you soon."

export type RagAutoReplyFallbackMode = 'do_not_reply' | 'send_fallback'

export interface RagAutoReplySettingsView {
  readonly enabled: boolean
  readonly fallbackMode: RagAutoReplyFallbackMode
  readonly fallbackMessage: string
  readonly whatsappConnected: boolean
  readonly providerConfigured: boolean
  readonly knowledgeReady: boolean
}

interface RagAutoReplySettingsRow {
  readonly enabled: boolean | null
  readonly fallback_mode: string | null
  readonly fallback_message: string | null
}

function normalizeFallbackMode(value: string | null | undefined): RagAutoReplyFallbackMode {
  return value === 'send_fallback' ? 'send_fallback' : 'do_not_reply'
}

function normalizeFallbackMessage(value: string | null | undefined): string {
  const clean = value?.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return clean || RAG_AUTO_REPLY_DEFAULT_FALLBACK
}

async function getReadiness(workspaceId: string): Promise<{
  readonly whatsappConnected: boolean
  readonly providerConfigured: boolean
  readonly knowledgeReady: boolean
}> {
  const admin = supabaseAdmin()
  const [whatsapp, provider, embeddings] = await Promise.all([
    admin
      .from('whatsapp_config')
      .select('id', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected'),
    admin
      .from('rag_provider_settings')
      .select('id', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .not('encrypted_api_key', 'is', null),
    admin
      .from('rag_embeddings')
      .select('id', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('embedding_status', 'ready'),
  ])

  if (whatsapp.error) throw new Error(whatsapp.error.message)
  if (provider.error) throw new Error(provider.error.message)
  if (embeddings.error) throw new Error(embeddings.error.message)

  return {
    whatsappConnected: (whatsapp.count ?? 0) > 0,
    providerConfigured: (provider.count ?? 0) > 0,
    knowledgeReady: (embeddings.count ?? 0) > 0,
  }
}

export async function getRagAutoReplySettings(
  workspaceId: string,
): Promise<RagAutoReplySettingsView> {
  const { data, error } = await supabaseAdmin()
    .from('rag_auto_reply_settings')
    .select('enabled, fallback_mode, fallback_message')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data as RagAutoReplySettingsRow | null
  const readiness = await getReadiness(workspaceId)

  return {
    enabled: row?.enabled === true,
    fallbackMode: normalizeFallbackMode(row?.fallback_mode),
    fallbackMessage: normalizeFallbackMessage(row?.fallback_message),
    ...readiness,
  }
}

export async function saveRagAutoReplySettings(args: {
  readonly workspaceId: string
  readonly enabled: boolean
  readonly fallbackMode: RagAutoReplyFallbackMode
  readonly fallbackMessage: string
}): Promise<RagAutoReplySettingsView> {
  const fallbackMode = normalizeFallbackMode(args.fallbackMode)
  const fallbackMessage = normalizeFallbackMessage(args.fallbackMessage).slice(0, 500)

  const { error } = await supabaseAdmin()
    .from('rag_auto_reply_settings')
    .upsert(
      {
        workspace_id: args.workspaceId,
        enabled: args.enabled,
        fallback_mode: fallbackMode,
        fallback_message: fallbackMessage,
      },
      { onConflict: 'workspace_id' },
    )

  if (error) throw new Error(error.message)
  return getRagAutoReplySettings(args.workspaceId)
}

export async function getRagAutoReplyRuntimeSettings(
  workspaceId: string | null | undefined,
): Promise<{
  readonly enabled: boolean
  readonly fallbackMode: RagAutoReplyFallbackMode
  readonly fallbackMessage: string
} | null> {
  if (!workspaceId) return null
  const { data, error } = await supabaseAdmin()
    .from('rag_auto_reply_settings')
    .select('enabled, fallback_mode, fallback_message')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[rag-auto-reply] settings lookup failed:', error.message)
    return null
  }
  const row = data as RagAutoReplySettingsRow | null
  return {
    enabled: row?.enabled === true,
    fallbackMode: normalizeFallbackMode(row?.fallback_mode),
    fallbackMessage: normalizeFallbackMessage(row?.fallback_message),
  }
}
