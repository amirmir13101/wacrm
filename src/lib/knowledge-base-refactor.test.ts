import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const page = read('src/app/(dashboard)/knowledge-base/page.tsx')
const sidebar = read('src/components/layout/sidebar.tsx')
const middleware = read('src/middleware.ts')
const webhook = read('src/app/api/whatsapp/webhook/route.ts')
const messageThread = read('src/components/inbox/message-thread.tsx')
const retrieval = read('src/lib/ai/knowledge.ts')
const nonDestructiveMigration = read(
  'supabase/migrations/067_knowledge_base_and_ai_agent_retrieval.sql',
)
const cleanupMigration = read('supabase/migrations/068_remove_obsolete_ai_chatbot.sql')

describe('AI Chatbot removal and standalone Knowledge Base', () => {
  it('exposes only AI Agent and Knowledge Base in CRM navigation', () => {
    expect(sidebar).toContain('href: "/agents", label: "AI Agent"')
    expect(sidebar).toContain('href: "/knowledge-base", label: "Knowledge Base"')
    expect(sidebar).not.toContain('AI Chatbot')
    expect(existsSync(join(root, 'src/app/(dashboard)/ai-chatbot/page.tsx'))).toBe(false)
    expect(middleware).toContain("'/knowledge-base'")
    expect(middleware).toContain("'/api/knowledge-base'")
    expect(middleware).not.toContain("'/api/rag'")
  })

  it('preserves the migrated knowledge workflows without a second AI key', () => {
    for (const label of [
      'Firecrawl Settings',
      'Website Knowledge Import',
      'Manual Knowledge Base',
      'Saved Knowledge',
      'Schedule & Import History',
      'Knowledge Activity & Unanswered Questions',
    ]) {
      expect(page).toContain(label)
    }
    expect(page).toContain('No second AI key is stored here.')
    expect(page).toContain('href="/agents"')
    expect(page).not.toContain('Test Chatbot')
    expect(page).not.toContain('Chatbot Instructions')
    expect(page).not.toContain('Live WhatsApp auto-reply')
    expect(page).not.toContain('/api/rag')
  })

  it('removes Chatbot-only webhook and inbox controls but preserves AI Agent controls', () => {
    expect(webhook).not.toContain('maybeHandleRagAutoReply')
    expect(webhook).not.toContain('getRagAutoReplyRuntimeSettings')
    expect(webhook).toContain('dispatchInboundToAiReply')
    expect(messageThread).not.toContain('RagConversationControl')
    expect(messageThread).not.toContain('AI Pause')
    expect(messageThread).toContain('<AiThreadBanner')
  })

  it('retrieves bounded context from both knowledge sources', () => {
    expect(retrieval).toContain('match_ai_agent_knowledge_semantic')
    expect(retrieval).toContain('match_knowledge_base_semantic')
    expect(retrieval).toContain('match_ai_agent_knowledge_fts')
    expect(retrieval).toContain('match_knowledge_base_fts')
    expect(retrieval).toContain('return Array.from(picked.values()).slice(0, k)')
  })

  it('keeps the first migration non-destructive and permission-scoped', () => {
    expect(nonDestructiveMigration).toContain("'view_knowledge_base'")
    expect(nonDestructiveMigration).toContain("'manage_knowledge_base'")
    expect(nonDestructiveMigration).toContain('match_knowledge_base_semantic')
    expect(nonDestructiveMigration).toContain('match_knowledge_base_fts')
    expect(nonDestructiveMigration).not.toMatch(/DROP TABLE/i)
  })

  it('guards the separate destructive cleanup and retains Category-B/C tables', () => {
    expect(cleanupMigration).toContain('RAISE EXCEPTION')
    for (const removed of [
      'rag_provider_settings',
      'rag_auto_reply_settings',
      'rag_chatbot_settings',
      'rag_conversation_controls',
    ]) {
      expect(cleanupMigration).toContain(`DROP TABLE IF EXISTS public.${removed}`)
    }
    for (const retained of [
      'ai_agent_configs',
      'ai_agent_knowledge_documents',
      'ai_agent_knowledge_chunks',
      'rag_firecrawl_settings',
      'rag_knowledge_sources',
      'rag_knowledge_chunks',
      'rag_embeddings',
      'rag_chat_logs',
    ]) {
      expect(cleanupMigration).not.toContain(`DROP TABLE IF EXISTS public.${retained}`)
    }
  })
})
