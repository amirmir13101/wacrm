import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const embeddingStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/embedding-store.ts'),
  'utf8',
)
const embeddings = readFileSync(
  join(process.cwd(), 'src/lib/rag/embeddings.ts'),
  'utf8',
)
const embedRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/knowledge/[id]/embed/route.ts'),
  'utf8',
)
const ragHelpers = readFileSync(
  join(process.cwd(), 'src/app/api/rag/_helpers.ts'),
  'utf8',
)
const ragSecurity = readFileSync(
  join(process.cwd(), 'src/lib/rag/security.ts'),
  'utf8',
)
const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const statusRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/status/route.ts'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG manual embedding generation', () => {
  it('keeps the local starter embedding shape: one 1536-dim vector per chunk', () => {
    expect(embeddings).toContain("import { embed } from 'ai'")
    expect(embeddings).toContain('provider.embedding(config.embeddingModel)')
    expect(embeddingStore).toContain('const RAG_EMBEDDING_DIMENSIONS = 1536')
    expect(embeddingStore).toContain('generateRagEmbedding(chunk.chunk_text')
    expect(embeddingStore).toContain('embedding.length !== RAG_EMBEDDING_DIMENSIONS')
  })

  it('uses saved workspace provider settings server-side without exposing keys', () => {
    expect(embeddingStore).toContain("from('rag_provider_settings')")
    expect(embeddingStore).toContain('decrypt(row.encrypted_api_key)')
    expect(embeddingStore).toContain('resolveRagProviderConfig')
    expect(embeddingStore).toContain('sanitizeProviderError')
    expect(page).not.toContain('encrypted_api_key')
    expect(embedRoute).not.toContain('encrypted_api_key')
  })

  it('stores embeddings in rag_embeddings and prevents duplicate ready embeddings', () => {
    expect(embeddingStore).toContain("from('rag_embeddings')")
    expect(embeddingStore).toContain("onConflict: 'chunk_id,embedding_model'")
    expect(embeddingStore).toContain("embedding_status === 'ready'")
    expect(embeddingStore).toContain('readyChunkIds')
    expect(embeddingStore).toContain('embeddingsSkipped')
    expect(embeddingStore).toContain("embedding_status: args.status")
  })

  it('keeps save/import chunk-only by default while preparing embeddings in resumable batches', () => {
    expect(embeddingStore).toContain('RAG_AUTO_EMBED_CHUNK_LIMIT = 0')
    expect(embeddingStore).toContain('RAG_EMBEDDING_BATCH_SIZE = 50')
    expect(embeddingStore).toContain('shouldAutoEmbedRagKnowledge')
    expect(embeddingStore).toContain('createSkippedRagEmbeddingSummary')
    expect(embeddingStore).toContain('RAG_AUTO_EMBED_CHUNK_LIMIT > 0')
    expect(embeddingStore).toContain('chunksNeedingEmbeddings.slice(0, RAG_EMBEDDING_BATCH_SIZE)')
    expect(embeddingStore).toContain('remainingAfterBatch')
    expect(embeddingStore).toContain('Click Prepare for Chatbot again to continue remaining chunks')
    expect(embeddingStore).not.toContain('.slice(0, 160)')
  })

  it('sanitizes provider/network failures instead of returning raw fetch errors', () => {
    expect(ragSecurity).toContain('Provider request failed. Please check your AI provider settings or try again.')
    expect(ragHelpers).toContain('The request could not complete right now. Please try again.')
    expect(page).toContain('Could not connect to the embedding provider right now. Please try again.')
    expect(page).not.toContain('TypeError: fetch failed')
  })

  it('returns user-facing embedding failure summaries that keep chunks ready', () => {
    expect(embeddingStore).toContain('AI provider key is missing. Add your API key before preparing embeddings.')
    expect(embeddingStore).toContain('Chunks ready. Embeddings could not be prepared. Please check your AI provider settings or click Prepare for Chatbot again.')
    expect(embeddingStore).toContain('AI provider key is invalid or provider rejected the request.')
    expect(embeddingStore).toContain('Embedding provider limit reached. Please try again later or check your provider account.')
    expect(embeddingStore).toContain('Could not connect to the embedding provider right now. Please try again.')
    expect(embeddingStore).toContain('embeddingErrorCategory')
    expect(embeddingStore).toContain('embeddingsReady')
    expect(embeddingStore).toContain('userMessage')
    expect(embeddingStore).toContain('Chunks ready. Click Prepare for Chatbot to create embeddings.')
  })

  it('adds only the single-source knowledge embedding API with workspace permission', () => {
    expect(embedRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(embedRoute).toContain('embedRagManualKnowledgeSource')
    expect(embeddingStore).toContain("eq('workspace_id', workspaceId)")
    expect(embeddingStore).toContain("in('source_type', ['manual', 'website', 'faq', 'note'])")
    expect(embeddingStore).not.toContain("from('ai_")
  })

  it('adds customer-facing preparation controls and status counts without vectors or debug output', () => {
    expect(page).toContain('Prepare for Chatbot')
    expect(page).toContain('Use Prepare for Chatbot when you are ready to create embeddings')
    expect(page).toContain('Preparing embeddings in batches...')
    expect(page).toContain('provider API cost')
    expect(page).toContain('Prepare for Chatbot')
    expect(page).toContain('manualKnowledgeProgress')
    expect(page).toContain('websiteImportProgress')
    expect(page).toContain('setManualKnowledgeProgress(createKnowledgeProgress')
    expect(page).toContain('setWebsiteImportProgress(createKnowledgeProgress')
    expect(page).toContain("progress.status === 'warning'")
    expect(page).not.toContain('createProgressFromEmbeddingSummary')
    expect(page).not.toContain("filter((step) => step !== 'Ready for chatbot')")
    expect(page).toContain('ready embeddings')
    expect(page).toContain('failed embeddings')
    expect(page).toContain('embeddingStatusLabel')
    expect(statusRoute).toContain('failedEmbeddings')
    expect(page).not.toContain('embedding vector')
    expect(page).not.toContain('vector dimensions')
    expect(page).not.toContain('Embedding Model')
    expect(page).not.toContain('raw provider')
  })

  it('keeps manual embedding generation separate from guarded WhatsApp auto-reply', () => {
    expect(embeddingStore).not.toContain('match_rag_knowledge_chunks')
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
