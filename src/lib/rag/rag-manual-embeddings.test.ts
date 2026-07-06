import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareRagKnowledgeSource } from './knowledge'

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
const knowledgeStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/knowledge-store.ts'),
  'utf8',
)
const dashboardStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/dashboard-store.ts'),
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
  it('prepares 105k, 120k, 140k, and 160k character knowledge into normal chunks without source-size failures', () => {
    const makeContent = (targetLength: number) => {
      const lines: string[] = []
      for (let index = 0; lines.join(' ').length < targetLength; index += 1) {
        lines.push(`Section ${index}: Business support details include plan ${index}, price ${index + 1}, location ${index % 7}, policy ${index % 5}, contact option ${index % 9}, and FAQ answer ${index}.`)
      }
      return lines.join(' ').slice(0, targetLength)
    }
    const sizes = [105_000, 120_000, 140_000, 160_000]

    for (const size of sizes) {
      const prepared = prepareRagKnowledgeSource({
        workspaceId: 'workspace-1',
        title: `${size} knowledge`,
        content: makeContent(size),
      })

      expect(prepared.source.cleanedContent.length).toBeGreaterThanOrEqual(size - 50)
      expect(prepared.chunks.length).toBeGreaterThan(50)
      expect(Math.max(...prepared.chunks.map((chunk) => chunk.content.length))).toBeLessThanOrEqual(1_150)
    }
  })

  it('handles website-import shaped 160k content that produces hundreds of preserved heading/card chunks', () => {
    const makeWebsiteImportStyleContent = (targetLength: number) => {
      const sections: string[] = []
      for (let index = 0; sections.join('\n\n').length < targetLength; index += 1) {
        sections.push([
          `### Website card ${index}`,
          `- Name: Business item ${index}`,
          `- Price: $${index + 1}/mo`,
          '- Features: support, policy, location, contact, FAQ, service details, terms, opening hours, delivery, refund information.',
          `- Source: https://example.com/page-${index}`,
        ].join('\n'))
      }
      return sections.join('\n\n').slice(0, targetLength)
    }

    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Large website import knowledge',
      content: makeWebsiteImportStyleContent(160_000),
      sourceType: 'website',
    })

    expect(prepared.source.cleanedContent.length).toBeGreaterThanOrEqual(159_900)
    expect(prepared.chunks.length).toBeGreaterThan(450)
    expect(Math.max(...prepared.chunks.map((chunk) => chunk.content.length))).toBeLessThanOrEqual(1_150)
    expect(embeddingStore).toContain('chunkArray(args.chunkIds, RAG_EMBEDDING_DB_ID_BATCH_SIZE)')
    expect(embeddingStore).toContain('embeddingLookupBatches: Math.ceil(chunks.length / RAG_EMBEDDING_DB_ID_BATCH_SIZE)')
  })

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

  it('keeps the old manual embedding helper batched and duplicate-safe at 50 chunks per request', () => {
    expect(embeddingStore).toContain('RAG_AUTO_EMBED_CHUNK_LIMIT = 0')
    expect(embeddingStore).toContain('RAG_EMBEDDING_BATCH_SIZE = 50')
    expect(embeddingStore).toContain('shouldAutoEmbedRagKnowledge')
    expect(embeddingStore).toContain('createSkippedRagEmbeddingSummary')
    expect(embeddingStore).toContain('RAG_AUTO_EMBED_CHUNK_LIMIT > 0')
    expect(embeddingStore).toContain('selectAdaptiveEmbeddingBatch(chunksNeedingEmbeddings)')
    expect(embeddingStore).toContain('RAG_EMBEDDING_MAX_BATCH_CHARACTERS = 20_000')
    expect(embeddingStore).toContain('RAG_EMBEDDING_MAX_CHUNK_CHARACTERS = 8_000')
    expect(embeddingStore).toContain('RAG_EMBEDDING_DB_ID_BATCH_SIZE = 75')
    expect(embeddingStore).toContain('for (const size of [RAG_EMBEDDING_BATCH_SIZE, 25, 10, 5, 2, 1])')
    expect(embeddingStore).toContain('chunkArray(args.chunkIds, RAG_EMBEDDING_DB_ID_BATCH_SIZE)')
    expect(embeddingStore).toContain('chunkArray(retryableFailedChunkIds, RAG_EMBEDDING_DB_ID_BATCH_SIZE)')
    expect(embeddingStore).not.toContain("in('chunk_id', [...args.chunkIds])")
    expect(embeddingStore).toContain('resetRetriableFailedEmbeddings')
    expect(embeddingStore).toContain("message: 'Getting your knowledge ready for the chatbot. We are preparing the saved content in safe batches.'")
    expect(embeddingStore).toContain('remainingAfterBatch')
    expect(embeddingStore).toContain('Prepared ${created.toLocaleString()} embeddings in this batch')
    expect(embeddingStore).not.toContain('forceReembed')
    expect(embeddingStore).not.toContain('deleteStaleEmbeddingsForChunks')
    expect(embeddingStore).not.toContain('.slice(0, 160)')
  })

  it('sanitizes provider/network failures instead of returning raw fetch errors', () => {
    expect(ragSecurity).toContain('Provider request failed. Please check your AI provider settings or try again.')
    expect(ragHelpers).toContain('The request could not complete right now. Please try again.')
    expect(page).toContain('Could not connect to the embedding provider right now. Please try again.')
    expect(page).not.toContain('TypeError: fetch failed')
  })

  it('returns user-facing embedding failure summaries that keep chunks ready', () => {
    expect(embeddingStore).toContain('AI provider is not configured. Add your API key before embeddings can be created.')
    expect(embeddingStore).toContain('Chunks ready. Embeddings could not be created automatically. Please check your AI provider settings.')
    expect(embeddingStore).toContain('Embedding failed because the AI provider API key appears invalid. Please update your API key.')
    expect(embeddingStore).toContain('Embedding failed because the AI provider account may have low balance, no credits, or billing is not active. Please check your provider billing/credits.')
    expect(embeddingStore).toContain('Embedding provider rate limit reached. Please try again later or use a provider account with higher limits.')
    expect(embeddingStore).toContain('Could not connect to the embedding provider. Please check the provider base URL.')
    expect(embeddingStore).toContain('Embedding failed because the knowledge chunk is too large for the provider. Please reduce the content size or split the knowledge.')
    expect(embeddingStore).toContain('Could not connect to the embedding provider right now. Please try again.')
    expect(embeddingStore).toContain('Selected provider does not support embeddings. Please choose an embedding-capable provider/model.')
    expect(embeddingStore).toContain('embeddingErrorCategory')
    expect(embeddingStore).toContain('embeddingsReady')
    expect(embeddingStore).toContain('userMessage')
    expect(embeddingStore).toContain('provider: args.summary.provider')
    expect(embeddingStore).toContain('embeddingModel: args.summary.embeddingModel')
    expect(embeddingStore).toContain('Chunks ready. Embeddings will be created automatically after saving.')
    expect(embeddingStore).toContain('recordFailedRagEmbeddingSummary')
    expect(embeddingStore).toContain('rag_embedding_failure_summary_metadata_failed')
    expect(embeddingStore).toContain('baseUrlHost')
    expect(embeddingStore).toContain('embeddingDimensionReceived')
    expect(embeddingStore).toContain('chunksToProcess')
    expect(embeddingStore).toContain('batchSize')
    expect(embeddingStore).toContain('batchChunkCount')
    expect(embeddingStore).toContain('batchTotalCharacters')
    expect(embeddingStore).toContain('totalSourceCharacters')
    expect(embeddingStore).toContain('minChunkCharacters')
    expect(embeddingStore).toContain('maxChunkCharacters')
    expect(embeddingStore).toContain('averageChunkCharacters')
    expect(embeddingStore).toContain('sourceType: source.source_type')
    expect(embeddingStore).toContain('chunkState: sourceEmbeddingChunkState(source)')
    expect(embeddingStore).toContain('readyChunkCountBeforeRetry')
    expect(embeddingStore).toContain('readyChunkCountAfterRetry')
    expect(embeddingStore).toContain('retriableFailedRowsReset')
    expect(embeddingStore).toContain('maxBatchCharacters')
    expect(embeddingStore).toContain('sanitizedFailureReason')
    expect(embeddingStore).toContain('totalBatches')
    expect(embeddingStore).toContain('embeddingsReturned')
    expect(embeddingStore).toContain('rowsUpserted')
    expect(embeddingStore).not.toContain('apiKey:')
  })

  it('adds only the single-source knowledge embedding API with workspace permission', () => {
    expect(embedRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(embedRoute).toContain('embedRagManualKnowledgeSource')
    expect(embedRoute).toContain('totalChunks: summary.totalChunks')
    expect(embedRoute).toContain('readyChunks: summary.readyChunks')
    expect(embedRoute).toContain('remainingChunks: summary.remainingChunks')
    expect(embedRoute).toContain('percentComplete: summary.percentComplete')
    expect(embedRoute).toContain('batchChunkCount: summary.batchChunkCount')
    expect(embedRoute).toContain('batchTotalCharacters: summary.batchTotalCharacters')
    expect(embedRoute).not.toContain('force: true')
    expect(embeddingStore).toContain("eq('workspace_id', workspaceId)")
    expect(embeddingStore).toContain("in('source_type', ['manual', 'website', 'faq', 'note'])")
    expect(embeddingStore).not.toContain("from('ai_")
  })

  it('uses the same stable chunking path for website import publish and manual edit saves', () => {
    expect(knowledgeStore).toContain('export async function createRagWebsiteKnowledge')
    expect(knowledgeStore).toContain('export async function updateRagManualKnowledge')
    expect(knowledgeStore).toContain('const prepared = prepareRagKnowledgeSource({')
    expect(knowledgeStore).toContain('sourceType: \'website\'')
    expect(knowledgeStore).toContain('await replaceRagKnowledgeChunks(args.workspaceId, source.id as string, prepared.chunks)')
    expect(knowledgeStore).toContain('await replaceRagKnowledgeChunks(args.workspaceId, args.sourceId, prepared.chunks)')
    expect(dashboardStore).toContain('publishRagWebsiteImportJob')
    expect(dashboardStore).toContain('createRagWebsiteKnowledge({')
  })

  it('adds customer-facing automatic embedding status counts without vectors or debug output', () => {
    expect(page).not.toContain('Prepare for Chatbot')
    expect(page).toContain('Creating embeddings automatically')
    expect(page).toContain('Embeddings will be created automatically')
    expect(page).toContain('Embeddings are created automatically')
    expect(page).toContain('configured AI provider')
    expect(page).toContain('manualKnowledgeProgress')
    expect(page).toContain('websiteImportProgress')
    expect(page).toContain('websiteEmbeddingProgress')
    expect(page).toContain('savedKnowledgeEmbeddingProgress')
    expect(page).toContain('setManualKnowledgeProgress(createKnowledgeProgress')
    expect(page).toContain('setWebsiteImportProgress(createKnowledgeProgress')
    expect(page).toContain("progress.status === 'warning'")
    expect(page).toContain('buildEmbeddingPreparationProgress')
    expect(page).toContain('EmbeddingPreparationPanel')
    expect(page).toContain('Getting your knowledge ready for the chatbot')
    expect(page).toContain('We are preparing the saved content in safe batches.')
    expect(page).toContain('chunks prepared')
    expect(page).toContain('percentComplete')
    expect(page).toContain("numberFromRecord(record, 'totalChunks')")
    expect(page).toContain("numberFromRecord(record, 'readyChunks')")
    expect(page).toContain("numberFromRecord(record, 'remainingChunks')")
    expect(page).toContain("Knowledge is ready for chatbot answers.")
    expect(page).not.toContain('createProgressFromEmbeddingSummary')
    expect(page).not.toContain("filter((step) => step !== 'Ready for chatbot')")
    expect(page).toContain('ready embeddings')
    expect(page).toContain('failed embeddings')
    expect(page).toContain('RAG_EMBEDDINGS_READY_NOTE')
    expect(page).toContain("'Embeddings ready. Knowledge is ready for chatbot answers.'")
    expect(page).toContain('knowledgeSourceWithProgress(source, preparationProgress)')
    expect(page).toContain('Embedding note: {displaySource.embeddingMessage}')
    expect(page).toContain('embeddingNoteClassName(displaySource)')
    expect(page).toContain("'text-emerald-100'")
    expect(page).toContain("'text-amber-100'")
    expect(page).toContain('displaySource.embeddingProvider')
    expect(page).toContain('displaySource.embeddingModel')
    expect(page).toContain('savedKnowledgeMessage')
    expect(page).toContain('async function runKnowledgeEmbeddingBatches')
    expect(page).toContain('for (let batchNumber = 1; batchNumber <= maxBatches; batchNumber += 1)')
    expect(page).toContain('options.onProgress?.(preparationProgress)')
    expect(page).toContain('shouldContinueEmbedding(summary)')
    expect(page).toContain("payload.sourceId && shouldContinueEmbedding(payload.embeddingSummary)")
    expect(page).toContain("sourceId && shouldContinueEmbedding(payload.embeddingSummary)")
    expect(page).toContain('async function reEmbedKnowledge(id: string)')
    expect(page).toContain("fetch(`/api/rag/knowledge/${sourceId}/embed`, { method: 'POST' })")
    expect(page).toContain("reEmbeddingSourceId === displaySource.id ? 'Preparing...' : 'Prepare Again'")
    expect(page).not.toContain("reEmbeddingSourceId === source.id ? 'Re-embedding...' : 'Re-embed'")
    expect(page).toContain("displaySource.embeddingStatus !== 'ready' || displaySource.readyEmbeddingCount === 0")
    expect(page).toContain('disabled={!canManageKnowledge || reEmbeddingSourceId !== null}')
    expect(knowledgeStore).toContain('readEmbeddingSummary')
    expect(knowledgeStore).toContain('statusFromEmbeddingMetadata')
    expect(knowledgeStore).toContain('embeddingMessage: metadataEmbedding.userMessage')
    expect(knowledgeStore).toContain('embeddingProvider: metadataEmbedding.provider')
    expect(knowledgeStore).toContain('embeddingModel: metadataEmbedding.embeddingModel')
    expect(page).toContain('embeddingStatusLabel')
    expect(statusRoute).toContain('failedEmbeddings')
    expect(page).not.toContain('embedding vector')
    expect(page).not.toContain('vector dimensions')
    expect(page).toContain('providerEmbeddingGuidance')
    expect(page).toContain('providerEmbeddingGuidance')
    expect(page).not.toContain('raw provider')
  })

  it('clears stale failed embedding notes after source-specific Prepare Again success', () => {
    const reEmbedStart = page.indexOf('async function reEmbedKnowledge(id: string)')
    const askChatStart = page.indexOf('async function askTestChat()', reEmbedStart)
    const reEmbedBlock = page.slice(reEmbedStart, askChatStart)
    const savedKnowledgeStart = page.indexOf('visibleSavedKnowledgeSources.map((source) => {')
    const savedKnowledgeEnd = page.indexOf('{knowledgeSources.length > SAVED_KNOWLEDGE_PREVIEW_LIMIT', savedKnowledgeStart)
    const savedKnowledgeBlock = page.slice(savedKnowledgeStart, savedKnowledgeEnd)

    expect(reEmbedStart).toBeGreaterThan(-1)
    expect(savedKnowledgeStart).toBeGreaterThan(-1)
    expect(reEmbedBlock).toContain('setKnowledgeSources((current) => current.map((source) => {')
    expect(reEmbedBlock).toContain('if (source.id !== id) return source')
    expect(reEmbedBlock).toContain("embeddingStatus: 'ready'")
    expect(reEmbedBlock).toContain('embeddingMessage: RAG_EMBEDDINGS_READY_NOTE')
    expect(reEmbedBlock).toContain('failedEmbeddingCount: 0')
    expect(savedKnowledgeBlock).toContain('const preparationProgress = savedKnowledgeEmbeddingProgress[source.id]')
    expect(savedKnowledgeBlock).toContain('const displaySource = knowledgeSourceWithProgress(source, preparationProgress)')
    expect(savedKnowledgeBlock).toContain('Embedding note: {displaySource.embeddingMessage}')
    expect(savedKnowledgeBlock).toContain('embeddingNoteClassName(displaySource)')
    expect(savedKnowledgeBlock).toContain('text-emerald-200/85')
    expect(savedKnowledgeBlock).toContain("text-[#d8c68f]")
  })

  it('keeps website import, manual knowledge, and saved knowledge messages separated', () => {
    const importWebsiteStart = page.indexOf('async function importWebsite()')
    const saveWebsiteDraftStart = page.indexOf("async function saveWebsiteDraft(action: 'update' | 'publish' | 'discard')")
    const saveKnowledgeStart = page.indexOf('async function saveKnowledge()')
    const viewKnowledgeStart = page.indexOf('async function viewKnowledge(id: string)')
    const askChatStart = page.indexOf('async function askTestChat()')
    const importWebsiteBlock = page.slice(importWebsiteStart, saveWebsiteDraftStart)
    const saveWebsiteDraftBlock = page.slice(saveWebsiteDraftStart, saveKnowledgeStart)
    const saveKnowledgeBlock = page.slice(saveKnowledgeStart, viewKnowledgeStart)
    const savedKnowledgeActionsBlock = page.slice(viewKnowledgeStart, askChatStart)

    expect(importWebsiteBlock).toContain('setWebsiteImportMessage')
    expect(importWebsiteBlock).not.toContain('setKnowledgeMessage')
    expect(saveWebsiteDraftBlock).toContain('setWebsiteImportMessage')
    expect(saveWebsiteDraftBlock).toContain('setWebsiteReviewError')
    expect(saveWebsiteDraftBlock).not.toContain('setKnowledgeMessage')
    expect(saveKnowledgeBlock).toContain('setKnowledgeMessage')
    expect(saveKnowledgeBlock).not.toContain('setWebsiteImportMessage')
    expect(savedKnowledgeActionsBlock).toContain('setSavedKnowledgeMessage')
    expect(savedKnowledgeActionsBlock).toContain('setSavedKnowledgeEmbeddingProgress')
    expect(savedKnowledgeActionsBlock).toContain('onProgress: (progress) =>')
    expect(savedKnowledgeActionsBlock).not.toContain('setKnowledgeMessage')
    expect(savedKnowledgeActionsBlock).not.toContain('setWebsiteImportMessage')
    expect(savedKnowledgeActionsBlock).not.toContain('setManualKnowledgeProgress')
  })

  it('keeps manual embedding generation separate from guarded WhatsApp auto-reply', () => {
    expect(embeddingStore).not.toContain('match_rag_knowledge_chunks')
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
