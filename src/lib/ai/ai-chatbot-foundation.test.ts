import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('AI chatbot Phase 1 foundation', () => {
  it('creates workspace-scoped chatbot tables with RLS', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql')
    const providerMigration = read('supabase/migrations/034_ai_chatbot_provider_settings.sql')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_chatbot_settings')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_knowledge_sources')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_knowledge_chunks')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_chatbot_logs')
    expect(migration).toContain('workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE')
    expect(migration).toContain('ALTER TABLE ai_chatbot_settings ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_knowledge_sources ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_chatbot_logs ENABLE ROW LEVEL SECURITY')
    expect(providerMigration).toContain('CREATE TABLE IF NOT EXISTS ai_chatbot_provider_settings')
    expect(providerMigration).toContain('workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE')
    expect(providerMigration).toContain('encrypted_api_key TEXT')
    expect(providerMigration).toContain('api_key_last4 TEXT')
    expect(providerMigration).toContain('ALTER TABLE ai_chatbot_provider_settings ENABLE ROW LEVEL SECURITY')
  })

  it('adds AI chatbot permissions to defaults and RLS policies', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql')
    const permissions = read('src/lib/team/permissions.ts')
    const permissionUi = read('src/lib/team/permission-ui.ts')

    for (const permission of ['view_ai_chatbot', 'manage_ai_chatbot', 'enable_ai_auto_reply']) {
      expect(migration).toContain(permission)
      expect(permissions).toContain(permission)
      expect(permissionUi).toContain(permission)
    }
  })

  it('routes the dashboard and APIs through permission checks', () => {
    const middleware = read('src/middleware.ts')
    const sidebar = read('src/components/layout/sidebar.tsx')

    expect(middleware).toContain("'/ai-chatbot'")
    expect(middleware).toContain("path.startsWith('/api/ai-chatbot')")
    expect(middleware).toContain("'view_ai_chatbot'")
    expect(middleware).toContain("'manage_ai_chatbot'")
    expect(sidebar).toContain('AI Chatbot')
    expect(sidebar).toContain('view_ai_chatbot')
  })

  it('keeps live auto-reply guarded by plan, provider, opt-out, and human assignment checks', () => {
    const autoReply = read('src/lib/ai/auto-reply.ts')
    const api = read('src/app/api/ai-chatbot/route.ts')

    expect(autoReply).toContain('isOptOutMessage')
    expect(autoReply).toContain('getAiPlanAccess')
    expect(autoReply).toContain('conversation.assigned_agent_id')
    expect(autoReply).toContain('requireProvider: true')
    expect(autoReply).toContain("sender_type: 'bot'")
    expect(api).toContain('canUseAutoReply')
    expect(api).toContain('isAiProviderConfigured')
    expect(api).toContain('enable_ai_auto_reply')
  })

  it('adds Phase 2 conversation controls with RLS and API protection', () => {
    const migration = read('supabase/migrations/035_ai_chatbot_conversation_controls.sql')
    const route = read('src/app/api/ai-chatbot/conversations/[id]/route.ts')
    const middleware = read('src/middleware.ts')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_conversation_controls')
    expect(migration).toContain('UNIQUE(workspace_id, conversation_id)')
    expect(migration).toContain("status IN ('ai_active', 'ai_paused', 'needs_human')")
    expect(migration).toContain('ALTER TABLE ai_conversation_controls ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('workspace_has_permission(workspace_id,')
    expect(migration).toContain('can_view_workspace_conversation')
    expect(route).toContain('getAiConversationControl')
    expect(route).toContain('upsertAiConversationControl')
    expect(route).toContain("'manage_ai_chatbot'")
    expect(middleware).toContain("path.startsWith('/api/ai-chatbot')")
  })

  it('guards Phase 2 auto-replies against paused AI, cooldowns, repeats, and daily caps', () => {
    const autoReply = read('src/lib/ai/auto-reply.ts')

    expect(autoReply).toContain('getAiConversationControl')
    expect(autoReply).toContain("control?.status === 'ai_paused'")
    expect(autoReply).toContain("control?.status === 'needs_human'")
    expect(autoReply).toContain('isInCooldown')
    expect(autoReply).toContain('AI_DAILY_REPLY_LIMIT')
    expect(autoReply).toContain('daily_reply_limit_reached')
    expect(autoReply).toContain('isSimilarAiResponse')
    expect(autoReply).toContain('same_response_repeated')
    expect(autoReply).toContain('recordAiReply')
    expect(autoReply).toContain('recordAiSkippedReason')
  })

  it('sends configured fallback and handoff messages for live AI misses', () => {
    const autoReply = read('src/lib/ai/auto-reply.ts')

    expect(autoReply).toContain('sendConfiguredAiMessage')
    expect(autoReply).toContain('chatbotSettings.fallback_message.trim()')
    expect(autoReply).toContain('DEFAULT_AI_CHATBOT_SETTINGS.fallback_message')
    expect(autoReply).toContain('chatbotSettings.handover_message.trim()')
    expect(autoReply).toContain("status: 'fallback'")
    expect(autoReply).toContain("sender_type: 'bot'")
    expect(autoReply).toContain('sendTextMessage')
    expect(autoReply).toContain('recordAiReply')
    expect(autoReply).toContain('recordAiSkippedReason')
  })

  it('renders inbox conversation AI controls and readable skipped reasons', () => {
    const thread = read('src/components/inbox/message-thread.tsx')

    expect(thread).toContain('/api/ai-chatbot/conversations/${conversationId}')
    expect(thread).toContain('/api/ai-chatbot/conversations/${conversation.id}')
    expect(thread).toContain('fetchAiConversationControl')
    expect(thread).toContain('ai-conversation-control:${conversationId}')
    expect(thread).toContain('table: "ai_conversation_controls"')
    expect(thread).toContain('Pause AI')
    expect(thread).toContain('Resume AI')
    expect(thread).toContain('Mark Needs Human')
    expect(thread).toContain('sm:flex-nowrap')
    expect(thread).toContain('lastSkippedMessage')
    expect(thread).toContain('AI active')
    expect(thread).toContain('AI paused')
    expect(thread).toContain('Needs human')
  })

  it('lets owners edit knowledge sources and refreshes chunks safely', () => {
    const page = read('src/app/(dashboard)/ai-chatbot/page.tsx')
    const route = read('src/app/api/ai-chatbot/sources/[id]/route.ts')

    expect(page).toContain('Edit Business Knowledge')
    expect(page).toContain('Update Knowledge')
    expect(page).toContain('DialogContent')
    expect(page).toContain('closeEditSourceModal')
    expect(page).toContain('editSourceTitle')
    expect(page).toContain('editSourceContent')
    expect(page).toContain('editSource(source)')
    expect(route).toContain('export async function PUT')
    expect(route).toContain("hasWorkspacePermission(workspace, 'manage_ai_chatbot')")
    expect(route).toContain(".eq('workspace_id', workspace.workspaceId)")
    expect(route).toContain(".from('ai_knowledge_chunks')")
    expect(route).toContain('.delete()')
    expect(route).toContain('chunkKnowledgeText(content)')
    expect(route).toContain("source_id: id")
  })

  it('shows the owner AI chatbot testing flow', () => {
    const page = read('src/app/(dashboard)/ai-chatbot/page.tsx')

    expect(page).toContain('AI Chatbot Testing Flow')
    expect(page).toContain('TESTING_FLOW_STEPS')
    expect(page).toContain('Add AI provider API key')
    expect(page).toContain('Confirm AI replies only once')
    expect(page).toContain('Pause AI in Inbox and confirm it stops')
    expect(page).toContain('Mark Needs Human and confirm AI stops')
    expect(page).toContain('→')
  })

  it('keeps duplicate and recent-human guardrails visible without touching manual replies', () => {
    const autoReply = read('src/lib/ai/auto-reply.ts')
    const controls = read('src/lib/ai/conversation-controls.ts')
    const sendRoute = read('src/app/api/whatsapp/send/route.ts')

    expect(autoReply).toContain('duplicate_inbound_message')
    expect(autoReply).toContain('AI_HUMAN_REPLY_PAUSE_SECONDS')
    expect(autoReply).toContain(".eq('sender_type', 'agent')")
    expect(autoReply).toContain('human_replied_recently')
    expect(controls).toContain('AI_CHATBOT_HUMAN_REPLY_PAUSE_SECONDS ?? 300')
    expect(controls).toContain('AI did not reply because this inbound message was already processed.')
    expect(controls).toContain('AI did not reply because a human agent replied recently.')
    expect(sendRoute).toContain("sender_type: 'agent'")
    expect(sendRoute).not.toContain('maybeHandleAiAutoReply')
  })

  it('keeps provider API keys server-only and masked in public responses', () => {
    const providerHelper = read('src/lib/ai/provider.ts')
    const providerRoute = read('src/app/api/ai-chatbot/provider/route.ts')

    expect(providerHelper).toContain('encrypt(apiKey)')
    expect(providerHelper).toContain('decrypt(data.encrypted_api_key)')
    expect(providerHelper).toContain('maskApiKey')
    expect(providerHelper).toContain('apiKeyMasked')
    expect(providerRoute).not.toContain('encrypted_api_key')
    expect(providerRoute).not.toContain('decrypt(')
  })

  it('does not add website scraping or vector search in Phase 1', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql').toLowerCase()
    const pkg = read('package.json').toLowerCase()

    expect(migration).not.toContain('vector(')
    expect(migration).not.toContain('pgvector')
    expect(pkg).not.toContain('firecrawl')
    expect(pkg).not.toContain('cheerio')
    expect(pkg).not.toContain('puppeteer')
  })
})
