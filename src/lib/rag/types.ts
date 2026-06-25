/**
 * Server-side RAG foundation types.
 *
 * Phase 1 intentionally defines architecture contracts only. Database tables,
 * API routes, UI, Firecrawl imports, and WhatsApp auto-reply wiring come in
 * later approved phases.
 */

export const RAG_PROVIDER_TYPES = [
  'openai',
  'openrouter',
  'ollama',
  'custom_openai_compatible',
] as const

export type RagProviderType = (typeof RAG_PROVIDER_TYPES)[number]

export const CUSTOMER_FACING_RAG_PROVIDER_FIELDS = ['provider', 'apiKey'] as const

export interface CustomerFacingRagProviderInput {
  readonly provider: RagProviderType
  readonly apiKey: string
}

export interface RagResolvedProviderConfig {
  readonly provider: RagProviderType
  readonly apiKey: string
  readonly baseUrl: string
  readonly chatModel: string
  readonly embeddingModel: string
  readonly embeddingDimensions: number
  readonly headers?: Readonly<Record<string, string>>
}

export interface RagProviderPublicStatus {
  readonly provider: RagProviderType
  readonly configured: boolean
  readonly keyLast4: string | null
  readonly lastTestStatus?: 'not_tested' | 'success' | 'failed' | null
}

export interface RagFirecrawlPublicStatus {
  readonly configured: boolean
  readonly keyLast4: string | null
  readonly lastTestStatus?: 'not_tested' | 'success' | 'failed' | null
}

export interface RagFirecrawlKeyInput {
  readonly apiKey: string
}

export interface RagChunk {
  readonly content: string
  readonly index: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface RagEmbeddedChunk extends RagChunk {
  readonly embedding: ReadonlyArray<number>
  readonly embeddingModel: string
}

export interface RagRetrievedChunk extends RagChunk {
  readonly chunkId: string
  readonly sourceId: string
  readonly sourceTitle: string
  readonly sourceUrl?: string | null
  readonly similarity: number
}

export interface RagConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface RagKnowledgeSourceDraft {
  readonly workspaceId: string
  readonly title: string
  readonly sourceType: 'manual' | 'website' | 'file' | 'faq' | 'note'
  readonly rawContent: string
  readonly cleanedContent: string
  readonly sourceUrl?: string | null
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface RagAnswerRequest {
  readonly workspaceId: string
  readonly question: string
  readonly standaloneQuestion?: string
  readonly retrievedChunks: ReadonlyArray<RagRetrievedChunk>
  readonly recentMessages?: ReadonlyArray<RagConversationMessage>
}

export interface RagAnswerResult {
  readonly status: 'answered' | 'fallback' | 'provider_error'
  readonly answer: string
  readonly retrievedChunks: ReadonlyArray<RagRetrievedChunk>
}

export const FUTURE_RAG_TABLES = [
  'rag_provider_settings',
  'rag_firecrawl_settings',
  'rag_auto_reply_settings',
  'rag_knowledge_sources',
  'rag_knowledge_chunks',
  'rag_embeddings',
  'rag_chat_logs',
] as const
