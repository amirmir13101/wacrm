import { createHash } from 'node:crypto'

export interface EmbeddingConfig {
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
  readonly dimensions: number
}

export interface EmbeddingResult {
  readonly embedding: readonly number[]
  readonly model: string
  readonly contentHash: string
}

const DEFAULT_EMBEDDING_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536

export function resolveEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey = process.env.AI_EMBEDDING_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: (process.env.AI_EMBEDDING_BASE_URL?.trim() || DEFAULT_EMBEDDING_BASE_URL).replace(/\/+$/, ''),
    model: process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    dimensions: readPositiveInteger(process.env.AI_EMBEDDING_DIMENSIONS, DEFAULT_EMBEDDING_DIMENSIONS),
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

export async function generateEmbedding(input: string, config = resolveEmbeddingConfig()): Promise<EmbeddingResult | null> {
  const normalized = normalizeEmbeddingInput(input)
  if (!normalized || !config) return null

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

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
