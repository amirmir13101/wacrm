import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { defaultPermissionsForRole, WORKSPACE_PERMISSIONS } from '../team/permissions'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/048_rag_foundation.sql',
)
const migration = readFileSync(migrationPath, 'utf8')

describe('RAG foundation migration proposal', () => {
  it('creates only the new rag foundation tables', () => {
    const expectedTables = [
      'rag_provider_settings',
      'rag_firecrawl_settings',
      'rag_knowledge_sources',
      'rag_knowledge_chunks',
      'rag_embeddings',
      'rag_chat_logs',
    ]

    for (const table of expectedTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }

    const legacyNamespace = 'ai'
    expect(migration).not.toContain(`CREATE TABLE IF NOT EXISTS ${legacyNamespace}_`)
    expect(migration).not.toContain(`public.${legacyNamespace}_`)
  })

  it('keeps provider choices aligned with the Phase 1 provider contract', () => {
    expect(migration).toContain(
      "provider IN ('openai', 'openrouter', 'ollama', 'custom_openai_compatible')",
    )
    expect(migration).not.toContain('anthropic')
    expect(migration).not.toContain('claude')
  })

  it('creates pgvector storage and starter-parity vector search RPC', () => {
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS vector')
    expect(migration).toContain('embedding vector(1536) NOT NULL')
    expect(migration).toContain('USING hnsw (embedding vector_cosine_ops)')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.match_rag_knowledge_chunks')
    expect(migration).toContain('p_match_count INTEGER DEFAULT 4')
    expect(migration).toContain('p_similarity_threshold DOUBLE PRECISION DEFAULT 0.5')
    expect(migration).toContain('1 - (e.embedding <=> p_query_embedding)')
  })

  it('keeps vector retrieval workspace scoped and active-source scoped', () => {
    expect(migration).toContain('public.workspace_has_permission(p_workspace_id,')
    expect(migration).toContain('e.workspace_id = p_workspace_id')
    expect(migration).toContain('c.workspace_id = p_workspace_id')
    expect(migration).toContain('s.workspace_id = p_workspace_id')
    expect(migration).toContain("s.status = 'active'")
    expect(migration).toContain('c.deleted_at IS NULL')
    expect(migration).toContain('s.deleted_at IS NULL')
  })

  it('enables RLS and uses new rag permissions only', () => {
    const expectedTables = [
      'rag_provider_settings',
      'rag_firecrawl_settings',
      'rag_knowledge_sources',
      'rag_knowledge_chunks',
      'rag_embeddings',
      'rag_chat_logs',
    ]

    for (const table of expectedTables) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }

    expect(migration).toContain('view_rag_chatbot')
    expect(migration).toContain('manage_rag_chatbot')
    expect(migration).toContain('manage_rag_provider')

    const legacyNamespace = 'ai'
    expect(migration).not.toContain(`view_${legacyNamespace}_chatbot`)
    expect(migration).not.toContain(`manage_${legacyNamespace}_chatbot`)
    expect(migration).not.toContain(`enable_${legacyNamespace}_auto_reply`)
  })

  it('keeps provider and Firecrawl key settings restricted to provider managers', () => {
    expect(migration).toContain(
      'CREATE POLICY "Members can view rag provider settings"',
    )
    expect(migration).toContain(
      'CREATE POLICY "Members can manage rag provider settings"',
    )
    expect(migration).toContain(
      'CREATE POLICY "Members can view rag firecrawl settings"',
    )
    expect(migration).toContain(
      'CREATE POLICY "Members can manage rag firecrawl settings"',
    )
    expect(migration.match(/manage_rag_provider/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('updates app role defaults consistently with the migration proposal', () => {
    expect(WORKSPACE_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'view_rag_chatbot',
        'manage_rag_chatbot',
        'manage_rag_provider',
        'enable_rag_auto_reply',
      ]),
    )

    const manager = defaultPermissionsForRole('manager')
    const agent = defaultPermissionsForRole('agent')

    expect(manager.view_rag_chatbot).toBe(true)
    expect(manager.manage_rag_chatbot).toBe(true)
    expect(manager.manage_rag_provider).not.toBe(true)
    expect(manager.enable_rag_auto_reply).not.toBe(true)
    expect(agent.view_rag_chatbot).not.toBe(true)
    expect(agent.manage_rag_chatbot).not.toBe(true)
  })
})
