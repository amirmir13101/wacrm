import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG manual knowledge management', () => {
  it('uses the shared 200,000 character limit for manual and future website knowledge', () => {
    expect(RAG_KNOWLEDGE_CHARACTER_LIMIT).toBe(200_000)
    expect(page).toContain('200,000 character limit')
    expect(page).toContain('RAG_KNOWLEDGE_CHARACTER_LIMIT')
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
    expect(page).toContain('Not embedded')

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
    expect(detailRoute).toContain('getRagKnowledgeSource')
    expect(detailRoute).toContain('updateRagManualKnowledge')
    expect(detailRoute).toContain('archiveRagKnowledgeSource')
  })

  it('uses only new rag tables and creates starter-style chunks before embedding', () => {
    expect(knowledgeStore).toContain("from('rag_knowledge_sources')")
    expect(knowledgeStore).toContain("from('rag_knowledge_chunks')")
    expect(knowledgeStore).not.toContain("from('ai_")
    expect(knowledgeStore).toContain('prepareRagKnowledgeSource')
    expect(knowledgeStore).toContain('embedding_status')
    expect(knowledgeStore).not.toContain('generateRagEmbedding')
    expect(knowledgeStore).not.toContain('generateRagChunkEmbeddings')
  })

  it('soft archives sources and does not add website import, test chat, or WhatsApp behavior', () => {
    expect(knowledgeStore).toContain("status: 'archived'")
    expect(knowledgeStore).toContain('deleted_at')
    expect(page).toContain('Website Import')
    expect(page).toContain('Not active yet')
    expect(page).not.toContain('/api/rag/chat')
    expect(page).not.toContain('/api/rag/website-import')
    expect(webhookRoute).not.toContain('rag')
  })
})
