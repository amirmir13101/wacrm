/** Shared provider and Knowledge Base preparation types. */

export const RAG_PROVIDER_TYPES = [
  'openai',
  'openrouter',
  'groq',
  'ollama',
  'custom_openai_compatible',
  'gemini',
] as const

export type RagProviderType = (typeof RAG_PROVIDER_TYPES)[number]

/** Shared AI provider input used by the existing AI Agent configuration. */
export interface CustomerFacingRagProviderInput {
  readonly provider: RagProviderType
  readonly apiKey: string
  readonly baseUrl?: string | null
  readonly chatModel?: string | null
  readonly embeddingModel?: string | null
  readonly embeddingDimensions?: number | null
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

export interface RagChunk {
  readonly content: string
  readonly index: number
  readonly metadata?: Readonly<Record<string, unknown>>
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
