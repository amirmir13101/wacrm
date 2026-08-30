import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/065_ai_agent_workspace.sql'),
  'utf8',
)
const parityMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/066_ai_agent_official_parity.sql'),
  'utf8',
)
const unlimitedLimitMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/069_allow_unlimited_ai_auto_replies.sql',
  ),
  'utf8',
)
const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/agents/page.tsx'), 'utf8')
const officialConfig = readFileSync(join(process.cwd(), 'src/lib/ai/config.ts'), 'utf8')
const officialKnowledge = readFileSync(join(process.cwd(), 'src/lib/ai/knowledge.ts'), 'utf8')
const store = readFileSync(join(process.cwd(), 'src/lib/ai-agent/store.ts'), 'utf8')
const configRoute = readFileSync(join(process.cwd(), 'src/app/api/ai-agent/config/route.ts'), 'utf8')
const knowledgeRoute = readFileSync(join(process.cwd(), 'src/app/api/ai-agent/knowledge/route.ts'), 'utf8')
const playgroundRoute = readFileSync(join(process.cwd(), 'src/app/api/ai-agent/playground/route.ts'), 'utf8')
const officialConfigRoute = readFileSync(join(process.cwd(), 'src/app/api/ai/config/route.ts'), 'utf8')
const webhookRoute = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'), 'utf8')
const messageThread = readFileSync(join(process.cwd(), 'src/components/inbox/message-thread.tsx'), 'utf8')
const messageComposer = readFileSync(join(process.cwd(), 'src/components/inbox/message-composer.tsx'), 'utf8')
const messageBubble = readFileSync(join(process.cwd(), 'src/components/inbox/message-bubble.tsx'), 'utf8')
const authHook = readFileSync(join(process.cwd(), 'src/hooks/use-auth.tsx'), 'utf8')
const sidebar = readFileSync(join(process.cwd(), 'src/components/layout/sidebar.tsx'), 'utf8')

describe('AI Agent module', () => {
  it('keeps AI Agent and adds the standalone Knowledge Base without AI Chatbot navigation', () => {
    expect(sidebar).toContain('href: "/agents", label: "AI Agent"')
    expect(sidebar).toContain('href: "/knowledge-base", label: "Knowledge Base"')
    expect(sidebar).not.toContain('href: "/ai-chatbot"')
    expect(page).toContain('AI Agents')
    expect(page).toContain("fetch('/api/ai/config')")
  })

  it('uses workspace-scoped tables and permissions in the migration', () => {
    expect(migration).toContain('public.ai_agent_configs')
    expect(migration).toContain('workspace_id uuid NOT NULL UNIQUE')
    expect(migration).toContain("workspace_has_permission(workspace_id, 'view_ai_agent')")
    expect(migration).toContain("workspace_has_permission(workspace_id, 'manage_ai_agent')")
    expect(migration).not.toContain('account_id')
    expect(migration).not.toContain('is_account_member')
  })

  it('keeps AI Agent-owned storage intact while extending retrieval to Knowledge Base data', () => {
    expect(store).toContain("from('ai_agent_configs')")
    expect(store).toContain("from('ai_agent_knowledge_documents')")
    expect(store).toContain("from('ai_agent_knowledge_chunks')")
    expect(officialConfig).toContain("from('ai_agent_configs')")
    expect(officialKnowledge).toContain("from('ai_agent_knowledge_chunks')")
    expect(officialKnowledge).toContain("from('rag_knowledge_sources')")
    expect(officialKnowledge).toContain('match_knowledge_base_semantic')
    expect(officialKnowledge).toContain('match_knowledge_base_fts')
    expect(parityMigration).toContain('match_ai_agent_knowledge_fts')
    expect(parityMigration).toContain('claim_ai_reply_slot')
    expect(store).not.toContain("from('rag_knowledge_sources')")
    expect(store).not.toContain("from('rag_provider_settings')")
  })

  it('gates AI Agent routes with workspace permissions', () => {
    expect(configRoute).toContain("requireWorkspacePermission('view_ai_agent')")
    expect(configRoute).toContain("requireWorkspacePermission('manage_ai_agent')")
    expect(knowledgeRoute).toContain("requireWorkspacePermission('view_ai_agent')")
    expect(knowledgeRoute).toContain("requireWorkspacePermission('manage_ai_agent')")
    expect(playgroundRoute).toContain("requireWorkspacePermission('view_ai_agent')")
  })

  it('dispatches AI Agent after deterministic Flow precedence', () => {
    expect(webhookRoute).toContain("import { NextResponse, after } from 'next/server'")
    expect(webhookRoute).toContain('after(async () => {')
    expect(webhookRoute).toContain("import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'")
    expect(webhookRoute).toContain('!flowConsumed &&')
    expect(webhookRoute).not.toContain('maybeHandleRagAutoReply')
    expect(webhookRoute).not.toContain('!aiReplied &&')
    expect(webhookRoute).toContain('await dispatchInboundToAiReply({')
    expect(webhookRoute).toContain('accountId: workspaceId')
  })

  it('ports the official Inbox controls and AI-generated indicator', () => {
    expect(messageThread).toContain('import { AiThreadBanner } from "./ai-thread-banner"')
    expect(messageThread).toContain('<AiThreadBanner')
    expect(messageComposer).toContain('fetch("/api/ai/draft"')
    expect(messageComposer).toContain('aria-label="Draft with AI Agent"')
    expect(messageBubble).toContain('message.ai_generated')
    expect(messageBubble).toContain('Sent automatically by the AI Agent')
  })

  it('validates handoff targets against active workspace membership', () => {
    expect(officialConfigRoute).toContain(".from('workspace_members')")
    expect(officialConfigRoute).toContain(".eq('workspace_id', accountId)")
    expect(officialConfigRoute).toContain(".eq('status', 'active')")
    expect(officialConfigRoute).not.toContain(".from('profiles')")
  })

  it('stores an empty optional system prompt without violating the workspace schema', () => {
    expect(officialConfigRoute).toContain("system_prompt: systemPrompt ?? ''")
  })

  it('allows the explicit Unlimited reply-limit sentinel in the database', () => {
    expect(unlimitedLimitMigration).toContain(
      'auto_reply_max_per_conversation BETWEEN 0 AND 20',
    )
    expect(unlimitedLimitMigration).toContain('0 means Unlimited')
  })

  it('derives the client account role from the active workspace membership', () => {
    expect(authHook).toContain('.from("workspace_members")')
    expect(authHook).toContain('mapWorkspaceRoleToAccountRole(membership.role)')
    expect(authHook).not.toContain('accountRole: user ? "admin" : null')
  })
})
