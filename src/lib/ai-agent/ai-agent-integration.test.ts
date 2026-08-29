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

describe('separate AI Agent module', () => {
  it('adds a separate AI Agent dashboard tab without replacing AI Chatbot', () => {
    expect(sidebar).toContain('href: "/agents", label: "AI Agent"')
    expect(sidebar).toContain('href: "/ai-chatbot", label: "AI Chatbot"')
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

  it('keeps AI Agent data separate from the RAG chatbot tables', () => {
    expect(store).toContain("from('ai_agent_configs')")
    expect(store).toContain("from('ai_agent_knowledge_documents')")
    expect(store).toContain("from('ai_agent_knowledge_chunks')")
    expect(officialConfig).toContain("from('ai_agent_configs')")
    expect(officialKnowledge).toContain("from('ai_agent_knowledge_chunks')")
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

  it('dispatches the separate AI Agent only after Flow and RAG precedence checks', () => {
    expect(webhookRoute).toContain("import { NextResponse, after } from 'next/server'")
    expect(webhookRoute).toContain('after(async () => {')
    expect(webhookRoute).toContain("import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'")
    expect(webhookRoute).toContain('!flowConsumed &&')
    expect(webhookRoute).toContain('!aiReplied &&')
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

  it('derives the client account role from the active workspace membership', () => {
    expect(authHook).toContain('.from("workspace_members")')
    expect(authHook).toContain('mapWorkspaceRoleToAccountRole(membership.role)')
    expect(authHook).not.toContain('accountRole: user ? "admin" : null')
  })
})
