import type { RagProviderType } from '@/lib/rag/types'

export const AI_AGENT_SOURCE_TYPES = ['manual', 'website', 'faq', 'policy', 'product', 'other'] as const

export type AiAgentSourceType = (typeof AI_AGENT_SOURCE_TYPES)[number]

export interface AiAgentConfigView {
  readonly configured: boolean
  readonly provider: RagProviderType
  readonly maskedKey: string | null
  readonly keyLast4: string | null
  readonly baseUrl: string | null
  readonly chatModel: string
  readonly embeddingModel: string
  readonly embeddingDimensions: number
  readonly systemPrompt: string
  readonly isActive: boolean
  readonly autoReplyEnabled: boolean
  readonly autoReplyMaxPerConversation: number
  readonly handoffMessage: string
  readonly lastTestedAt: string | null
  readonly lastTestStatus: 'not_tested' | 'success' | 'failed' | null
  readonly lastTestError: string | null
}

export interface AiAgentKnowledgeDocument {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly sourceType: AiAgentSourceType
  readonly status: 'active' | 'archived'
  readonly chunkCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AiAgentUsageSummary {
  readonly totalRuns: number
  readonly totalTokens: number
  readonly promptTokens: number
  readonly completionTokens: number
  readonly recent: ReadonlyArray<{
    readonly id: string
    readonly mode: string
    readonly provider: string
    readonly model: string
    readonly totalTokens: number
    readonly question: string | null
    readonly createdAt: string
  }>
}

export interface AiAgentAnswerResult {
  readonly answer: string
  readonly usedKnowledge: ReadonlyArray<{
    readonly id: string
    readonly documentId: string
    readonly content: string
  }>
  readonly usage: {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
  }
}
