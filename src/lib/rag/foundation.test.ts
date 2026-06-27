import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  RAG_DATABASE_ADAPTER_OPTIONS,
  RAG_QUALITY_COMPARISON_QUESTIONS,
  RAG_QUALITY_DIFFERENCE_REASONS,
  RAG_STARTER_PARITY_BEHAVIOR,
  RECOMMENDED_RAG_DATABASE_ADAPTER,
} from './architecture'
import {
  buildRagRetrievalQueries,
  buildRagSystemPrompt,
  createEmptyRagAnswer,
  extractRagKeywordTerms,
  scoreKeywordRagChunk,
} from './chat'
import { createRagChunks } from './chunking'
import { prepareRagKnowledgeSource } from './knowledge'
import {
  DEFAULT_RAG_PROVIDER_CONFIG,
  resolveRagProviderConfig,
} from './provider'
import {
  DEFAULT_RAG_MATCH_COUNT,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  retrieveWorkspaceRagChunks,
} from './retrieval'
import { assertWorkspaceScoped, maskSecret, sanitizeProviderError } from './security'
import {
  CUSTOMER_FACING_RAG_PROVIDER_FIELDS,
  FUTURE_RAG_TABLES,
  RAG_PROVIDER_TYPES,
  type CustomerFacingRagProviderInput,
} from './types'
import { WORKSPACE_PERMISSIONS } from '../team/permissions'

describe('RAG Phase 1 foundation', () => {
  it('supports only the approved provider types', () => {
    expect(RAG_PROVIDER_TYPES).toEqual([
      'openai',
      'openrouter',
      'groq',
      'ollama',
      'custom_openai_compatible',
      'gemini',
    ])
    expect(RAG_PROVIDER_TYPES).not.toContain('anthropic')
    expect(RAG_PROVIDER_TYPES).not.toContain('claude')
  })

  it('keeps the customer-facing provider input shape simple', () => {
    expect(CUSTOMER_FACING_RAG_PROVIDER_FIELDS).toEqual(['provider', 'apiKey'])

    const input = {
      provider: 'openai',
      apiKey: 'sk-test',
    } satisfies CustomerFacingRagProviderInput

    expect(Object.keys(input)).toEqual(['provider', 'apiKey'])
  })

  it('resolves backend defaults from the simple provider input', () => {
    const config = resolveRagProviderConfig({
      provider: 'openai',
      apiKey: '  sk-test  ',
    })

    expect(config).toMatchObject({
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: DEFAULT_RAG_PROVIDER_CONFIG.openai.baseUrl,
      chatModel: DEFAULT_RAG_PROVIDER_CONFIG.openai.chatModel,
      embeddingModel: DEFAULT_RAG_PROVIDER_CONFIG.openai.embeddingModel,
      embeddingDimensions: DEFAULT_RAG_PROVIDER_CONFIG.openai.embeddingDimensions,
    })
  })

  it('adds OpenRouter defaults without requiring UI base URL or model fields', () => {
    const config = resolveRagProviderConfig({
      provider: 'openrouter',
      apiKey: 'or-test',
    })

    expect(config.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(config.chatModel).toBe('openai/gpt-4o-mini')
    expect(config.embeddingModel).toBe('openai/text-embedding-3-small')
    expect(config.headers).toMatchObject({
      'X-OpenRouter-Title': 'Talk Wagon RAG Chatbot',
    })
  })

  it('creates deterministic starter chunks and knowledge drafts', () => {
    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Business FAQ',
      sourceType: 'manual',
      content: 'Support email is help@example.com.\n\nOpening time is 9 AM.',
    })

    expect(prepared.source.cleanedContent).toContain('Support email')
    expect(prepared.chunks).toHaveLength(1)
    expect(prepared.chunks[0]?.metadata).toMatchObject({
      workspaceId: 'workspace-1',
      title: 'Business FAQ',
      sourceType: 'manual',
    })

    expect(
      createRagChunks('First sentence. Second sentence. Third sentence.', {
        maxChunkLength: 20,
      }).length,
    ).toBeGreaterThan(1)
  })

  it('preserves the local starter feature-level supports chunk behavior', () => {
    const chunks = createRagChunks(
      'The system supports team inbox, contact management, broadcasts, automation, AI chatbot, and human handoff.',
    ).map((chunk) => chunk.content)

    expect(chunks).toContain('The system supports broadcasts.')
    expect(chunks).toContain('The system supports contact management.')
  })

  it('keeps retrieval workspace-scoped through an injectable port', async () => {
    const results = await retrieveWorkspaceRagChunks(
      {
        retrieve: async (request) => [
          {
            content: `Question: ${request.question}`,
            index: 0,
            chunkId: 'chunk-1',
            sourceId: 'source-1',
            sourceTitle: 'FAQ',
            similarity: 0.9,
          },
        ],
      },
      {
        workspaceId: 'workspace-1',
        question: 'What is your email?',
        queryEmbedding: [0.1, 0.2],
      },
    )

    expect(results[0]?.content).toBe('Question: What is your email?')
    await expect(
      retrieveWorkspaceRagChunks(
        { retrieve: async () => [] },
        { workspaceId: ' ', question: 'Hello', queryEmbedding: [] },
      ),
    ).resolves.toEqual([])

    await expect(
      retrieveWorkspaceRagChunks(
        { retrieve: async () => [] },
        { workspaceId: '', question: 'Hello', queryEmbedding: [] },
      ),
    ).rejects.toThrow('workspace_id is required for RAG retrieval.')
  })

  it('keeps starter retrieval defaults explicit for the future pgvector adapter', () => {
    expect(DEFAULT_RAG_MATCH_COUNT).toBe(4)
    expect(DEFAULT_RAG_SIMILARITY_THRESHOLD).toBe(0.5)
  })

  it('returns clean chat fallback scaffolding without old debug concepts', () => {
    const prompt = buildRagSystemPrompt()
    const answer = createEmptyRagAnswer({
      workspaceId: 'workspace-1',
      question: 'Unknown question',
      retrievedChunks: [],
    })

    expect(prompt).toContain('Answer the customer using only the provided knowledge.')
    expect(answer.status).toBe('fallback')
    expect(answer.answer).toBe('I do not see that information in the current knowledge base.')

    const combined = `${prompt}\n${answer.answer}`
    expect(combined).not.toMatch(/selectedOffer|Derived fact guidance|fallback reason/i)
  })

  it('grounds price answers and calculations without treating competitor prices as official values', () => {
    const prompt = buildRagSystemPrompt()

    expect(prompt).toContain('Do not invent exact prices')
    expect(prompt).toContain('You may do simple arithmetic only when the needed numbers are explicitly present')
    expect(prompt).toContain('not an official listed value')
    expect(prompt).toContain('if only a monthly price is present and no exact yearly total')
    expect(prompt).toContain('monthly price x 12')
    expect(prompt).toContain('do not use competitor prices or competitor specs')
    expect(prompt).toContain('Do not mix neighboring plans, products, services, locations, packages, or providers.')
    expect(prompt).toContain('For support, contact, phone, email, ticket, live chat, social, or messaging questions')
    expect(prompt).toContain('include it in the answer')
  })

  it('builds focused retrieval queries for combined monthly and yearly questions', () => {
    expect(buildRagRetrievalQueries('12 gb vps price monthly and yearly')).toEqual([
      '12 gb vps price monthly and yearly',
      '12 gb vps price monthly',
      '12 gb vps price yearly',
    ])

    expect(buildRagRetrievalQueries('What is your support email?')).toEqual([
      'What is your support email?',
      'What support and contact details are available for support email?',
    ])
  })

  it('expands terse topic queries like the starter tool-call flow without business-specific answers', () => {
    expect(buildRagRetrievalQueries('Inventory')).toEqual([
      'Inventory',
      'What information is available about inventory?',
      'What services, products, plans, pricing, support, locations, contact details, and policies are available for inventory?',
      'What support, features, specs, availability, and important details are listed for inventory?',
    ])

    expect(buildRagRetrievalQueries('clinic available?')).toContain(
      'What locations, service areas, addresses, IPs, or availability details are listed for clinic?',
    )
  })

  it('extracts generic keyword terms for exact retrieval supplementation', () => {
    expect(extractRagKeywordTerms('Whatsapp support available?')).toEqual([
      'whatsapp',
      'support',
    ])
    expect(extractRagKeywordTerms('12 gb vps price monthly and yearly')).toEqual([
      'vps',
      'price',
      'monthly',
      'yearly',
    ])
  })

  it('scores keyword chunks by generic customer intent instead of raw term count only', () => {
    const overviewScore = scoreKeywordRagChunk({
      question: 'Inventory',
      terms: ['inventory'],
      matchedTerms: ['inventory'],
      content: 'Inventory services include product tracking, support, reporting, and upgrade options.',
    })
    const policyNoiseScore = scoreKeywordRagChunk({
      question: 'Inventory',
      terms: ['inventory'],
      matchedTerms: ['inventory'],
      content: 'Users must not use inventory services for illegal content, phishing, spam, or harmful activities.',
    })

    expect(overviewScore).toBeGreaterThan(policyNoiseScore)

    const contactScore = scoreKeywordRagChunk({
      question: 'WhatsApp support available?',
      terms: ['whatsapp', 'support'],
      matchedTerms: ['whatsapp', 'support'],
      content: 'Support is available by WhatsApp at https://wa.me/123456789 and by email.',
    })
    expect(contactScore).toBeGreaterThan(overviewScore)
  })

  it('masks secrets and sanitizes provider errors', () => {
    expect(maskSecret('sk-live-123456')).toBe('****3456')
    expect(sanitizeProviderError(new Error('Request failed for sk-live-secret Bearer token-123'))).toBe(
      'Request failed for [redacted] Bearer [redacted]',
    )
    expect(() => assertWorkspaceScoped('')).toThrow('workspace_id is required.')
  })

  it('keeps future table names in the new rag namespace', () => {
    expect(FUTURE_RAG_TABLES.every((table) => table.startsWith('rag_'))).toBe(true)
  })

  it('documents starter-parity requirements and database adapter trade-offs', () => {
    expect(RAG_STARTER_PARITY_BEHAVIOR).toEqual(
      expect.arrayContaining([
        'feature_level_supports_chunks',
        'cosine_similarity_vector_search',
        'similarity_threshold_0_5',
        'top_4_retrieved_chunks',
      ]),
    )
    expect(RECOMMENDED_RAG_DATABASE_ADAPTER).toBe('supabase_rpc')
    expect(RAG_DATABASE_ADAPTER_OPTIONS.supabase_rpc.tradeOffs).toContain(
      'can preserve pgvector cosine search through SQL/RPC',
    )
    expect(RAG_DATABASE_ADAPTER_OPTIONS.drizzle_direct_postgres.tradeOffs).toContain(
      'closest to the local starter schema and query style',
    )
  })

  it('requires future phases to compare CRM answers against the local starter baseline', () => {
    expect(RAG_QUALITY_COMPARISON_QUESTIONS).toEqual([
      'What is the support email?',
      'Do you have Singapore VPS location?',
      'What is the Singapore test IP?',
      'What is the monthly price of VPS x4?',
      'What is the yearly price of VPS x4?',
      'Do you sell laptops?',
    ])
    expect(RAG_QUALITY_DIFFERENCE_REASONS).toEqual([
      'chunking difference',
      'embedding model difference',
      'vector query difference',
      'prompt difference',
      'model difference',
      'retrieved chunks difference',
    ])
  })
})

describe('RAG Phase 1 permissions and integration boundaries', () => {
  it('adds only new rag permission names', () => {
    expect(WORKSPACE_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'view_rag_chatbot',
        'manage_rag_chatbot',
        'manage_rag_provider',
        'enable_rag_auto_reply',
      ]),
    )

    const legacyNamespace = 'ai'
    const legacyPermissions = [
      `view_${legacyNamespace}_chatbot`,
      `manage_${legacyNamespace}_chatbot`,
      `enable_${legacyNamespace}_auto_reply`,
    ]

    for (const permission of legacyPermissions) {
      expect(WORKSPACE_PERMISSIONS).not.toContain(permission)
    }
  })

  it('keeps WhatsApp webhook RAG integration behind a disabled-by-default guard', () => {
    const webhookRoute = readFileSync(
      join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
      'utf8',
    )

    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('maybeHandleRagAutoReply')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
