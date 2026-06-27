import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  RAG_CHUNK_OVERLAP_CHARS,
  createRagChunks,
  maxRagChunksForContent,
} from './chunking'
import {
  cleanRagKnowledgeContent,
  prepareRagKnowledgeSource,
  RAG_KNOWLEDGE_CHARACTER_LIMIT,
} from './knowledge'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const listRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/knowledge/route.ts'),
  'utf8',
)
const detailRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/knowledge/[id]/route.ts'),
  'utf8',
)
const knowledgeStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/knowledge-store.ts'),
  'utf8',
)
const settingsStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/settings.ts'),
  'utf8',
)
const cleanupMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/050_delete_archived_rag_knowledge.sql'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG manual knowledge management', () => {
  it('uses the shared 500,000 character limit for manual and future website knowledge', () => {
    expect(RAG_KNOWLEDGE_CHARACTER_LIMIT).toBe(500_000)
    expect(page).toContain('500,000 character limit')
    expect(page).toContain('RAG_KNOWLEDGE_CHARACTER_LIMIT')
  })

  it('fully chunks long sources beyond the old 160 chunk cap without dropping late facts', () => {
    const finalFact = 'FINAL UNIQUE SUPPORT FACT: The emergency support email is final-test@example.com.'
    const longContent = `${Array.from({ length: 230 }, (_, index) =>
      `Generic business policy paragraph ${index + 1}. ${'This sentence keeps the source long and generic. '.repeat(20)}`,
    ).join('\n\n')}\n\n${finalFact}`

    expect(longContent.length).toBeGreaterThan(160_000)
    expect(longContent.length).toBeLessThan(RAG_KNOWLEDGE_CHARACTER_LIMIT)

    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Large generic knowledge',
      content: longContent,
    })

    expect(prepared.chunks.length).toBeGreaterThan(160)
    expect(prepared.chunks.some((chunk) => chunk.content.includes(finalFact))).toBe(true)
    expect(prepared.chunks.at(-1)?.content).toContain(finalFact)
  })

  it('adds readable overlap between neighboring chunks', () => {
    const chunks = createRagChunks(
      [
        'Opening paragraph explains the business service and customer support process.',
        'Second paragraph includes the contact path and escalation detail.',
        'Third paragraph includes the final policy and response expectation.',
      ].join(' '),
      {
        maxChunkLength: 95,
        overlapChars: 30,
      },
    )

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[1]?.content).toContain('support process')
    expect(chunks[1]?.content).toContain('Second paragraph')
  })

  it('aligns safe max chunks with the full 500,000 character knowledge limit', () => {
    expect(RAG_CHUNK_OVERLAP_CHARS).toBeGreaterThanOrEqual(100)
    expect(maxRagChunksForContent(RAG_KNOWLEDGE_CHARACTER_LIMIT)).toBeGreaterThan(500)
    expect(maxRagChunksForContent(RAG_KNOWLEDGE_CHARACTER_LIMIT)).toBeGreaterThan(160)
  })

  it('cleans dangerous control characters and rejects empty or oversized content', () => {
    expect(cleanRagKnowledgeContent('Hello\u0000   world\n\n\nagain')).toBe('Hello world\n\nagain')

    expect(() =>
      prepareRagKnowledgeSource({
        workspaceId: 'workspace-1',
        title: 'Too large',
        content: 'x'.repeat(RAG_KNOWLEDGE_CHARACTER_LIMIT + 1),
      }),
    ).toThrow('characters or less')

    expect(() =>
      prepareRagKnowledgeSource({
        workspaceId: 'workspace-1',
        title: 'Empty',
        content: '   ',
      }),
    ).toThrow('Knowledge content is required.')
  })

  it('adds the customer-facing Knowledge Base UI without technical internals', () => {
    expect(page).toContain('Knowledge Base')
    expect(page).toContain('Knowledge Title')
    expect(page).toContain('Example: Company contact details')
    expect(page).toContain('Knowledge Text')
    expect(page).toContain('Paste your business information, FAQs, pricing, policies, or service details here.')
    expect(page).toContain('Add Knowledge')
    expect(page).toContain('Knowledge List')
    expect(page).toContain('Chunks ready')
    expect(page).toContain('Knowledge processing status')
    expect(page).toContain('Saving knowledge...')
    expect(page).toContain('Cleaning content...')
    expect(page).toContain('Creating chunks...')
    expect(page).toContain('Preparing embeddings...')
    expect(page).toContain('Ready for chatbot')
    expect(page).toContain('animate-spin')

    expect(page).not.toContain('embedding vector')
    expect(page).not.toContain('retrieval score')
    expect(page).not.toContain('chunk ID')
    expect(page).not.toContain('database ID')
    expect(page).not.toContain('raw debug')
  })

  it('adds workspace-scoped CRUD routes with the right permissions', () => {
    expect(listRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(listRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(detailRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(detailRoute).toContain("requireRagPermission('manage_rag_chatbot')")

    expect(listRoute).toContain('createRagManualKnowledge')
    expect(listRoute).toContain('embedRagManualKnowledgeSource')
    expect(listRoute).toContain('shouldAutoEmbedRagKnowledge')
    expect(listRoute).toContain('createSkippedRagEmbeddingSummary')
    expect(listRoute).toContain('embeddingSummary')
    expect(listRoute).toContain('sanitizeProviderError')
    expect(detailRoute).toContain('getRagKnowledgeSource')
    expect(detailRoute).toContain('updateRagManualKnowledge')
    expect(detailRoute).toContain('embedRagManualKnowledgeSource')
    expect(detailRoute).toContain('shouldAutoEmbedRagKnowledge')
    expect(detailRoute).toContain('createSkippedRagEmbeddingSummary')
    expect(detailRoute).toContain('embeddingSummary')
    expect(detailRoute).toContain('sanitizeProviderError')
    expect(detailRoute).toContain('deleteRagKnowledgeSource')
  })

  it('uses only new rag tables and creates starter-style chunks before embedding', () => {
    expect(knowledgeStore).toContain("from('rag_knowledge_sources')")
    expect(knowledgeStore).toContain("from('rag_knowledge_chunks')")
    expect(knowledgeStore).not.toContain("from('ai_")
    expect(knowledgeStore).toContain('prepareRagKnowledgeSource')
    expect(knowledgeStore).toContain('chunk_coverage')
    expect(knowledgeStore).toContain('chunk_overlap_chars')
    expect(knowledgeStore).toContain('embedding_status')
    expect(knowledgeStore).not.toContain('generateRagEmbedding')
    expect(knowledgeStore).not.toContain('generateRagChunkEmbeddings')
  })

  it('permanently deletes sources, chunks, and embeddings while keeping WhatsApp RAG guarded', () => {
    expect(knowledgeStore).toContain('deleteRagKnowledgeSource')
    expect(knowledgeStore).toContain("from('rag_embeddings')")
    expect(knowledgeStore).toContain(".in('chunk_id', chunkIds)")
    expect(knowledgeStore).toContain("from('rag_knowledge_chunks')")
    expect(knowledgeStore).toContain("from('rag_knowledge_sources')")
    expect(knowledgeStore).toContain('chunksDeleted')
    expect(knowledgeStore).toContain('embeddingsDeleted')
    expect(knowledgeStore).not.toContain('archiveRagKnowledgeSource')
    expect(page).toContain('Delete this knowledge source permanently? This will remove its content, chunks, and embeddings. This cannot be undone.')
    expect(page).toContain('Knowledge deleted permanently.')
    expect(page).toContain('Delete')
    expect(page).not.toContain('Archive')
    expect(page).toContain('Website Import')
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })

  it('excludes archived and deleted knowledge from status counts', () => {
    expect(settingsStore).toContain(".eq('status', 'active')")
    expect(settingsStore).toContain(".eq('rag_knowledge_sources.status', 'active')")
    expect(settingsStore).toContain(".eq('rag_knowledge_chunks.rag_knowledge_sources.status', 'active')")
    expect(settingsStore).toContain(".is('rag_knowledge_chunks.deleted_at', null)")
    expect(settingsStore).toContain(".is('rag_knowledge_chunks.rag_knowledge_sources.deleted_at', null)")
  })

  it('includes a safe cleanup migration for legacy archived RAG knowledge', () => {
    expect(cleanupMigration).toContain('DELETE FROM public.rag_embeddings')
    expect(cleanupMigration).toContain('DELETE FROM public.rag_knowledge_chunks')
    expect(cleanupMigration).toContain('DELETE FROM public.rag_knowledge_sources')
    expect(cleanupMigration).toContain("s.status = 'archived'")
    expect(cleanupMigration).toContain('s.deleted_at IS NOT NULL')
    expect(cleanupMigration).toContain('c.deleted_at IS NOT NULL')
    expect(cleanupMigration).not.toContain('public.ai_')
    expect(cleanupMigration).not.toContain('public.whatsapp')
    expect(cleanupMigration).not.toContain('public.contacts')
  })
})
