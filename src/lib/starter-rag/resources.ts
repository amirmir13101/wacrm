import { count, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { createStarterRagDbClient, starterRagEmbeddings, starterRagResources } from './db'
import { generateStarterRagEmbeddings } from './embedding'

export const STARTER_RAG_RESOURCE_CHARACTER_LIMIT = 500_000

export interface StarterRagResourceSummary {
  readonly id: string
  readonly content: string
  readonly characterCount: number
  readonly embeddingCount: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface StarterRagResourceDetail extends StarterRagResourceSummary {
  readonly content: string
}

function validateResourceContent(content: string): string {
  const clean = content.trim()
  if (!clean) {
    throw new Error('Knowledge content is required.')
  }
  if (clean.length > STARTER_RAG_RESOURCE_CHARACTER_LIMIT) {
    throw new Error(
      `Knowledge content must be ${STARTER_RAG_RESOURCE_CHARACTER_LIMIT.toLocaleString()} characters or less.`,
    )
  }
  return clean
}

export async function addStarterRagResource(input: {
  readonly content: string
}): Promise<{ readonly id: string; readonly embeddingCount: number }> {
  const content = validateResourceContent(input.content)
  const embeddings = await generateStarterRagEmbeddings(content)
  const id = nanoid()
  const { client, db } = await createStarterRagDbClient()

  try {
    await db.insert(starterRagResources).values({ id, content })
    if (embeddings.length > 0) {
      await db.insert(starterRagEmbeddings).values(
        embeddings.map((embedding) => ({
          resourceId: id,
          content: embedding.content,
          embedding: embedding.embedding,
        })),
      )
    }

    return { id, embeddingCount: embeddings.length }
  } finally {
    await client.end({ timeout: 1 })
  }
}

export async function listStarterRagResources(): Promise<StarterRagResourceSummary[]> {
  const { client, db } = await createStarterRagDbClient()

  try {
    const rows = await db
      .select({
        id: starterRagResources.id,
        content: starterRagResources.content,
        createdAt: starterRagResources.createdAt,
        updatedAt: starterRagResources.updatedAt,
        embeddingCount: count(starterRagEmbeddings.id),
      })
      .from(starterRagResources)
      .leftJoin(
        starterRagEmbeddings,
        eq(starterRagEmbeddings.resourceId, starterRagResources.id),
      )
      .groupBy(
        starterRagResources.id,
        starterRagResources.content,
        starterRagResources.createdAt,
        starterRagResources.updatedAt,
      )
      .orderBy(starterRagResources.createdAt)

    return rows.map((row) => ({
      ...row,
      characterCount: row.content.length,
      embeddingCount: Number(row.embeddingCount),
    }))
  } finally {
    await client.end({ timeout: 1 })
  }
}

export async function getStarterRagResource(id: string): Promise<StarterRagResourceDetail | null> {
  const { client, db } = await createStarterRagDbClient()

  try {
    const rows = await db
      .select({
        id: starterRagResources.id,
        content: starterRagResources.content,
        createdAt: starterRagResources.createdAt,
        updatedAt: starterRagResources.updatedAt,
        embeddingCount: count(starterRagEmbeddings.id),
      })
      .from(starterRagResources)
      .leftJoin(
        starterRagEmbeddings,
        eq(starterRagEmbeddings.resourceId, starterRagResources.id),
      )
      .where(eq(starterRagResources.id, id))
      .groupBy(
        starterRagResources.id,
        starterRagResources.content,
        starterRagResources.createdAt,
        starterRagResources.updatedAt,
      )
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      ...row,
      characterCount: row.content.length,
      embeddingCount: Number(row.embeddingCount),
    }
  } finally {
    await client.end({ timeout: 1 })
  }
}

export async function updateStarterRagResource(input: {
  readonly id: string
  readonly content: string
}): Promise<{ readonly embeddingCount: number }> {
  const content = validateResourceContent(input.content)
  const embeddings = await generateStarterRagEmbeddings(content)
  const { client, db } = await createStarterRagDbClient()

  try {
    await db.delete(starterRagEmbeddings).where(eq(starterRagEmbeddings.resourceId, input.id))
    await db
      .update(starterRagResources)
      .set({ content, updatedAt: new Date() })
      .where(eq(starterRagResources.id, input.id))

    if (embeddings.length > 0) {
      await db.insert(starterRagEmbeddings).values(
        embeddings.map((embedding) => ({
          resourceId: input.id,
          content: embedding.content,
          embedding: embedding.embedding,
        })),
      )
    }

    return { embeddingCount: embeddings.length }
  } finally {
    await client.end({ timeout: 1 })
  }
}

export async function deleteStarterRagResource(id: string): Promise<void> {
  const { client, db } = await createStarterRagDbClient()

  try {
    await db.delete(starterRagResources).where(eq(starterRagResources.id, id))
  } finally {
    await client.end({ timeout: 1 })
  }
}
