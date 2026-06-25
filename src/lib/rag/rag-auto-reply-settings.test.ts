import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { RAG_AUTO_REPLY_DEFAULT_FALLBACK } from './auto-reply'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/049_rag_auto_reply_settings.sql'),
  'utf8',
)
const logsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/logs/route.ts'),
  'utf8',
)
const autoReplyRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/auto-reply/route.ts'),
  'utf8',
)
const logsService = readFileSync(
  join(process.cwd(), 'src/lib/rag/logs.ts'),
  'utf8',
)
const chatService = readFileSync(
  join(process.cwd(), 'src/lib/rag/chat.ts'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG logs and WhatsApp auto reply activation', () => {
  it('creates a safe migration proposal with auto reply disabled by default', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.rag_auto_reply_settings')
    expect(migration).toContain('enabled BOOLEAN NOT NULL DEFAULT FALSE')
    expect(migration).toContain("fallback_mode TEXT NOT NULL DEFAULT 'do_not_reply'")
    expect(migration).toContain("fallback_mode IN ('do_not_reply', 'send_fallback')")
    expect(migration).toContain('ALTER TABLE public.rag_auto_reply_settings ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain("workspace_has_permission(workspace_id, 'view_rag_chatbot')")
    expect(migration).toContain("workspace_has_permission(workspace_id, 'enable_rag_auto_reply')")
    expect(migration).not.toContain('public.ai_')
  })

  it('adds a webhook-safe service retrieval RPC without browser auth dependence', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.match_rag_knowledge_chunks_for_service')
    expect(migration).toContain('e.workspace_id = p_workspace_id')
    expect(migration).toContain("e.embedding_status = 'ready'")
    expect(migration).toContain("s.status = 'active'")
    expect(migration).not.toContain("workspace_has_permission(p_workspace_id, 'view_rag_chatbot')")
  })

  it('keeps logs API workspace-scoped and non-secret', () => {
    expect(logsRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(logsService).toContain("from('rag_chat_logs')")
    expect(logsService).toContain('.eq(\'workspace_id\', args.workspaceId)')
    expect(logsService).toContain('retrievedSourceCount')
    expect(logsService).not.toContain('token_usage')
    expect(logsService).not.toContain('provider response')
    expect(logsService).not.toContain('embedding')
  })

  it('shares grounded chat behavior for dashboard and WhatsApp channels', () => {
    expect(chatService).toContain('answerRagDashboardQuestion')
    expect(chatService).toContain('answerRagWhatsAppQuestion')
    expect(chatService).toContain("channel: 'whatsapp'")
    expect(chatService).toContain('match_rag_knowledge_chunks_for_service')
    expect(chatService).toContain('p_match_count: 4')
    expect(chatService).toContain('p_similarity_threshold: 0.5')
  })

  it('keeps webhook auto reply disabled unless settings explicitly enable it', () => {
    expect(webhookRoute).toContain('maybeHandleRagAutoReply')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
    expect(webhookRoute).toContain('message.type')
    expect(webhookRoute).toContain('contentText')
    expect(webhookRoute).toContain('sendTextMessage')
    expect(webhookRoute).not.toContain('enable_ai_auto_reply')
  })

  it('uses the required customer-safe default fallback message', () => {
    expect(RAG_AUTO_REPLY_DEFAULT_FALLBACK).toBe(
      "Sorry, I don't have that information right now. A team member will help you soon.",
    )
    expect(autoReplyRoute).toContain("requireRagPermission('enable_rag_auto_reply')")
  })
})
