import { createHash } from 'node:crypto'

import { resolveAiEmbeddingProviderConfig } from '@/lib/ai/provider'

export interface EmbeddingConfig {
  readonly source: 'workspace' | 'env'
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
  readonly dimensions: number
  readonly supported: boolean
  readonly reason: string | null
}

export interface EmbeddingResult {
  readonly embedding: readonly number[]
  readonly model: string
  readonly contentHash: string
}

export const DEFAULT_EMBEDDING_DIMENSIONS = 1536

export async function resolveEmbeddingConfig(workspaceId?: string | null): Promise<EmbeddingConfig> {
  const config = await resolveAiEmbeddingProviderConfig(workspaceId)
  return {
    source: config.source,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
    supported: config.supported,
    reason: config.reason,
  }
}

export function hashKnowledgeContent(value: string): string {
  return createHash('sha256').update(normalizeEmbeddingInput(value)).digest('hex')
}

export function normalizeEmbeddingInput(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export function estimateTokenCount(value: string): number {
  return Math.max(1, Math.ceil(normalizeEmbeddingInput(value).length / 4))
}

export async function generateEmbedding(
  input: string,
  configOrWorkspaceId?: EmbeddingConfig | string | null,
): Promise<EmbeddingResult | null> {
  const normalized = normalizeEmbeddingInput(input)
  const config =
    typeof configOrWorkspaceId === 'object' && configOrWorkspaceId !== null
      ? configOrWorkspaceId
      : await resolveEmbeddingConfig(configOrWorkspaceId)
  if (!normalized || !config.supported || !config.apiKey) return null

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      input: normalized,
      dimensions: config.dimensions,
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding provider returned HTTP ${response.status}.`)
  }

  const body = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
    model?: string
  }
  const embedding = body.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Embedding provider returned an invalid embedding.')
  }
  if (embedding.length !== config.dimensions) {
    throw new Error(`Embedding provider returned ${embedding.length} dimensions; expected ${config.dimensions}.`)
  }
  return {
    embedding,
    model: body.model ?? config.model,
    contentHash: hashKnowledgeContent(normalized),
  }
}
