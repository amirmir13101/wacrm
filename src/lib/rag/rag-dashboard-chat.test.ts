import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const chatRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/chat/route.ts'),
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

describe('RAG dashboard test chat', () => {
  it('adds a dashboard-only Test Chat UI with clean user-facing states', () => {
    expect(page).toContain('Test Chat')
    expect(page).toContain('Ask a question from your saved knowledge...')
    expect(page).toContain('Prepare your knowledge for chatbot first.')
    expect(page).toContain('Add and test your AI provider key first.')
    expect(page).toContain('Retrieved Knowledge')
    expect(page).toContain('Match quality')

    expect(page).not.toContain('raw chunk IDs')
    expect(page).not.toContain('debug JSON')
    expect(page).not.toContain('provider response JSON')
    expect(page).not.toContain('API keys')
  })

  it('adds a workspace-authenticated dashboard chat API route', () => {
    expect(chatRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(chatRoute).toContain('RAG_CHAT_QUESTION_LIMIT')
    expect(chatRoute).toContain('answerRagDashboardQuestion')
    expect(chatRoute).not.toContain('encrypted_api_key')
    expect(chatRoute).not.toContain("from('ai_")
  })

  it('uses starter-style vector retrieval: question embedding, top 4, threshold 0.5', () => {
    expect(chatService).toContain('buildRagRetrievalQueries(question)')
    expect(chatService).toContain('generateRagEmbedding(query, args.providerConfig)')
    expect(chatService).toContain('retrieveRagChunksForQueries')
    expect(chatService).toContain('retrieveKeywordRagChunks')
    expect(chatService).toContain('extractRagKeywordTerms')
    expect(chatService).toContain("eq('rag_knowledge_sources.status', 'active')")
    expect(chatService).toContain('match_rag_knowledge_chunks')
    expect(chatService).toContain('supabase.rpc(rpcName')
    expect(chatService).toContain('p_workspace_id: args.workspaceId')
    expect(chatService).toContain('p_match_count: 4')
    expect(chatService).toContain('p_similarity_threshold: 0.5')
    expect(chatService).toContain('maxOutputTokens: 160')
  })

  it('uses a simple grounded RAG prompt without old CRM complexity', () => {
    expect(chatService).toContain('You are a helpful business support assistant.')
    expect(chatService).toContain('Answer the customer using only the provided knowledge.')
    expect(chatService).toContain('If the answer is not in the knowledge')
    expect(chatService).toContain('If the customer sends only a short topic')
    expect(chatService).toContain('provide a concise overview from the relevant snippets')
    expect(chatService).toContain('Do not invent exact prices')
    expect(chatService).toContain('You may do simple arithmetic only when the needed numbers are explicitly present')
    expect(chatService).toContain('not an official listed value')
    expect(chatService).toContain('do not use competitor prices or competitor specs')
    expect(chatService).toContain('For location, service-area, datacenter')
    expect(chatService).toContain('answer in the same language as the question if possible')

    expect(chatService).not.toContain('selectedOffer')
    expect(chatService).not.toContain('deterministic pricing')
    expect(chatService).not.toContain('derived guidance')
    expect(chatService).not.toContain('fallback preview')
  })

  it('logs dashboard chat safely to rag_chat_logs', () => {
    expect(chatService).toContain("from('rag_chat_logs')")
    expect(chatService).toContain("channel: 'dashboard'")
    expect(chatService).toContain('user_question')
    expect(chatService).toContain('retrieved_chunk_ids')
    expect(chatService).toContain('retrieval_scores')
    expect(chatService).toContain('latency_ms')
  })

  it('keeps dashboard chat separate from website import while exposing a dedicated WhatsApp answer path', () => {
    expect(page).toContain('/api/rag/website-import')
    expect(chatService).not.toContain('rag_website_import')
    expect(chatService).toContain('answerRagDashboardQuestion')
    expect(chatService).toContain('answerRagWhatsAppQuestion')
    expect(webhookRoute).toContain('maybeHandleRagAutoReply')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
