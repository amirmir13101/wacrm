import { cosineDistance, desc, gt, sql } from 'drizzle-orm'
import { embed } from 'ai'

import { createStarterRagAIProvider } from './provider'
import { createStarterRagDbClient, starterRagEmbeddings } from './db'

export const STARTER_RAG_MAX_CHUNK_LENGTH = 1000
export const STARTER_RAG_MAX_CHUNKS_PER_RESOURCE = 160
export const STARTER_RAG_SIMILARITY_THRESHOLD = 0.5
export const STARTER_RAG_RETRIEVAL_LIMIT = 4

export interface StarterRagEmbeddingChunk {
  readonly content: string
  readonly embedding: number[]
}

export interface StarterRagRelevantContent {
  readonly content: string
  readonly similarity: number
}

const splitLongChunk = (chunk: string): string[] => {
  if (chunk.length <= STARTER_RAG_MAX_CHUNK_LENGTH) {
    return [chunk]
  }

  const chunks: string[] = []
  for (let i = 0; i < chunk.length; i += STARTER_RAG_MAX_CHUNK_LENGTH) {
    chunks.push(chunk.slice(i, i + STARTER_RAG_MAX_CHUNK_LENGTH).trim())
  }

  return chunks.filter(Boolean)
}

const getEmbeddingModel = async () => {
  const { provider, embeddingModel } = await createStarterRagAIProvider()

  return provider.embedding(embeddingModel)
}

export const generateStarterRagChunks = (input: string): string[] => {
  const sentenceChunks = input
    .split(/\n+|(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap(splitLongChunk)

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentenceChunks) {
    const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence

    if (nextChunk.length <= STARTER_RAG_MAX_CHUNK_LENGTH) {
      currentChunk = nextChunk
      continue
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }
    currentChunk = sentence
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  const featureChunks = chunks.flatMap((chunk) => {
    if (!chunk.toLowerCase().includes('supports')) {
      return []
    }

    return chunk
      .replace(/\.$/, '')
      .split(',')
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0 && feature !== chunk)
      .map((feature) =>
        feature.toLowerCase().startsWith('the system supports')
          ? `${feature}.`
          : `The system supports ${feature}.`,
      )
  })

  return Array.from(new Set([...chunks, ...featureChunks])).slice(
    0,
    STARTER_RAG_MAX_CHUNKS_PER_RESOURCE,
  )
}

export const generateStarterRagEmbeddings = async (
  value: string,
): Promise<StarterRagEmbeddingChunk[]> => {
  const chunks = generateStarterRagChunks(value)

  if (chunks.length === 0) {
    return []
  }

  const model = await getEmbeddingModel()
  const embeddings = []

  for (const chunk of chunks) {
    const { embedding } = await embed({
      model,
      value: chunk,
    })

    embeddings.push(embedding)
  }

  return embeddings.map((embedding, i) => ({
    content: chunks[i],
    embedding,
  }))
}

export const generateStarterRagEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\n', ' ')

  const { embedding } = await embed({
    model: await getEmbeddingModel(),
    value: input,
  })

  return embedding
}

export const findStarterRagRelevantContent = async (
  userQuery: string,
): Promise<StarterRagRelevantContent[]> => {
  const userQueryEmbedded = await generateStarterRagEmbedding(userQuery)
  const similarity = sql<number>`1 - (${cosineDistance(
    starterRagEmbeddings.embedding,
    userQueryEmbedded,
  )})`

  const { client, db } = await createStarterRagDbClient()

  try {
    return await db
      .select({ content: starterRagEmbeddings.content, similarity })
      .from(starterRagEmbeddings)
      .where(gt(similarity, STARTER_RAG_SIMILARITY_THRESHOLD))
      .orderBy((table) => desc(table.similarity))
      .limit(STARTER_RAG_RETRIEVAL_LIMIT)
  } finally {
    await client.end({ timeout: 1 })
  }
}
