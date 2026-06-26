import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  generateStarterRagChunks,
  STARTER_RAG_MAX_CHUNK_LENGTH,
  STARTER_RAG_MAX_CHUNKS_PER_RESOURCE,
  STARTER_RAG_RETRIEVAL_LIMIT,
  STARTER_RAG_SIMILARITY_THRESHOLD,
} from './embedding'
import {
  STARTER_RAG_DEFAULT_DATABASE_URL,
} from './config'
import { STARTER_RAG_MAX_OUTPUT_TOKENS, STARTER_RAG_SYSTEM_PROMPT } from './chat'
import { STARTER_RAG_RESOURCE_CHARACTER_LIMIT } from './resources'
import { canAccessDashboardPath } from '../team/permissions'

const starterChat = readFileSync(
  join('G:', 'ai-sdk-rag-starter-main', 'ai-sdk-rag-starter-main', 'app/api/chat/route.ts'),
  'utf8',
)
const starterEmbedding = readFileSync(
  join('G:', 'ai-sdk-rag-starter-main', 'ai-sdk-rag-starter-main', 'lib/ai/embedding.ts'),
  'utf8',
)
const starterRagChat = readFileSync(
  join(process.cwd(), 'src/lib/starter-rag/chat.ts'),
  'utf8',
)
const starterRagEmbedding = readFileSync(
  join(process.cwd(), 'src/lib/starter-rag/embedding.ts'),
  'utf8',
)
const starterRagDb = readFileSync(join(process.cwd(), 'src/lib/starter-rag/db.ts'), 'utf8')
const starterRagPage = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/starter-rag/page.tsx'),
  'utf8',
)
const starterRagSettingsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/starter-rag/settings/route.ts'),
  'utf8',
)
const starterRagResourcesRoute = readFileSync(
  join(process.cwd(), 'src/app/api/starter-rag/resources/route.ts'),
  'utf8',
)
const sidebar = readFileSync(join(process.cwd(), 'src/components/layout/sidebar.tsx'), 'utf8')
const header = readFileSync(join(process.cwd(), 'src/components/layout/header.tsx'), 'utf8')
const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8')

describe('separate Starter RAG implementation', () => {
  it('keeps the Starter RAG prompt and tool-call behavior', () => {
    expect(starterChat).toContain(STARTER_RAG_SYSTEM_PROMPT)
    expect(starterRagChat).toContain('getInformation')
    expect(starterRagChat).toContain('stepCountIs(5)')
    expect(starterRagChat).toContain('maxOutputTokens: STARTER_RAG_MAX_OUTPUT_TOKENS')
    expect(STARTER_RAG_MAX_OUTPUT_TOKENS).toBe(160)
  })

  it('keeps Starter chunking, threshold, and top-k retrieval constants', () => {
    expect(starterEmbedding).toContain('const MAX_CHUNK_LENGTH = 1000')
    expect(starterEmbedding).toContain('const MAX_CHUNKS_PER_RESOURCE = 160')
    expect(starterEmbedding).toContain('.where(gt(similarity, 0.5))')
    expect(starterEmbedding).toContain('.limit(4)')

    expect(STARTER_RAG_MAX_CHUNK_LENGTH).toBe(1000)
    expect(STARTER_RAG_MAX_CHUNKS_PER_RESOURCE).toBe(160)
    expect(STARTER_RAG_SIMILARITY_THRESHOLD).toBe(0.5)
    expect(STARTER_RAG_RETRIEVAL_LIMIT).toBe(4)

    const chunks = generateStarterRagChunks(
      'The system supports WhatsApp support, live chat, email support.',
    )
    expect(chunks).toContain('The system supports WhatsApp support.')
    expect(chunks).toContain('The system supports live chat.')
    expect(chunks).toContain('The system supports email support.')
  })

  it('uses Starter database tables and does not connect to CRM rag tables', () => {
    expect(STARTER_RAG_DEFAULT_DATABASE_URL).toBe('postgres://postgres:postgres@localhost:5433/rag_test')
    expect(starterRagDb).toContain("pgTable('resources'")
    expect(starterRagDb).toContain("pgTable(\n  'embeddings'")
    expect(starterRagDb).toContain("vector('embedding', { dimensions: 1536 })")
    expect(starterRagEmbedding).not.toContain("from('rag_knowledge_sources')")
    expect(starterRagEmbedding).not.toContain('match_rag_knowledge_chunks')
    expect(starterRagDb).not.toContain('rag_')
  })

  it('adds an isolated dashboard route and isolated API namespace', () => {
    expect(sidebar).toContain('href: "/starter-rag"')
    expect(sidebar).toContain('label: "Starter RAG"')
    expect(header).toContain('"/starter-rag": "Starter RAG"')
    expect(canAccessDashboardPath({ role: 'manager' }, '/starter-rag')).toBe(true)
    expect(canAccessDashboardPath({ role: 'agent' }, '/starter-rag')).toBe(false)

    expect(starterRagPage).toContain('/api/starter-rag/settings')
    expect(starterRagPage).toContain('/api/starter-rag/resources')
    expect(starterRagPage).toContain('/api/starter-rag/chat')
    expect(starterRagPage).not.toContain('/api/rag/chat')
  })

  it('supports 500,000-character manual Starter knowledge and keeps secrets out of git', () => {
    expect(STARTER_RAG_RESOURCE_CHARACTER_LIMIT).toBe(500_000)
    expect(starterRagPage).toContain('500_000')
    expect(gitignore).toContain('.starter-rag-config.json')
    expect(starterRagSettingsRoute).not.toContain('return apiKey')
    expect(starterRagResourcesRoute).toContain('STARTER_RAG_RESOURCE_CHARACTER_LIMIT')
  })
})
