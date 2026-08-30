import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { prepareRagKnowledgeSource } from './knowledge'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const embeddingStore = read('src/lib/rag/embedding-store.ts')
const knowledgePage = read('src/app/(dashboard)/knowledge-base/page.tsx')
const knowledgeRoute = read('src/app/api/knowledge-base/knowledge/route.ts')
const embedRoute = read('src/app/api/knowledge-base/knowledge/[id]/embed/route.ts')
const statusRoute = read('src/app/api/knowledge-base/status/route.ts')

describe('Knowledge Base embedding generation', () => {
  it('prepares large manual knowledge using the established bounded chunking path', () => {
    const content = Array.from(
      { length: 1_200 },
      (_, index) =>
        `Section ${index}: support, pricing, location, policy, contact, and FAQ details.`,
    ).join(' ')
    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Large knowledge source',
      content,
    })

    expect(prepared.chunks.length).toBeGreaterThan(50)
    expect(Math.max(...prepared.chunks.map((chunk) => chunk.content.length))).toBeLessThanOrEqual(
      1_150,
    )
  })

  it('uses the AI Agent embeddings key and never the removed Chatbot provider table', () => {
    expect(embeddingStore).toContain("from('ai_agent_configs')")
    expect(embeddingStore).toContain("select('embeddings_api_key')")
    expect(embeddingStore).toContain('embedTexts(providerConfig.config.apiKey')
    expect(embeddingStore).not.toContain("from('rag_provider_settings')")
    expect(knowledgePage).toContain('No second AI key is stored here.')
    expect(knowledgePage).toContain('href="/agents"')
    expect(knowledgePage).not.toContain('Paste your API key')
  })

  it('stores Knowledge Base vectors without exposing credentials to the browser', () => {
    expect(embeddingStore).toContain("from('rag_embeddings')")
    expect(embeddingStore).toContain("onConflict: 'chunk_id,embedding_model'")
    expect(embeddingStore).toContain('const RAG_EMBEDDING_DIMENSIONS = 1536')
    expect(knowledgeRoute).toContain('embedRagManualKnowledgeSource')
    expect(embedRoute).toContain("requireKnowledgeBasePermission('manage_knowledge_base')")
    expect(knowledgePage).not.toContain('embeddings_api_key')
    expect(statusRoute).toContain('embeddingsConfigured: Boolean')
    expect(statusRoute).not.toContain('encrypted_api_key')
  })

  it('keeps chunk creation usable when embedding preparation reports a failure', () => {
    expect(knowledgeRoute).toContain('recordFailedRagEmbeddingSummary')
    expect(knowledgeRoute).toContain('saved: true')
    expect(knowledgeRoute).toContain('embeddingWarning')
    expect(embeddingStore).toContain('recordFailedRagEmbeddingSummary')
    expect(knowledgePage).toContain('Creating embeddings automatically')
    expect(knowledgePage).toContain('Knowledge is ready for AI Agent answers.')
  })
})
