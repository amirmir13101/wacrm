import { relations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  index,
  pgTable,
  text,
  timestamp,
  vector,
  varchar,
} from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'
import postgres from 'postgres'

import { getStarterRagEffectiveSettings } from './config'

export const starterRagResources = pgTable('resources', {
  id: varchar('id', { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const starterRagEmbeddings = pgTable(
  'embeddings',
  {
    id: varchar('id', { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    resourceId: varchar('resource_id', { length: 191 }).references(
      () => starterRagResources.id,
      { onDelete: 'cascade' },
    ),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  },
  (table) => ({
    embeddingIndex: index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
  }),
)

export const starterRagResourcesRelations = relations(starterRagResources, ({ many }) => ({
  embeddings: many(starterRagEmbeddings),
}))

export const starterRagEmbeddingsRelations = relations(starterRagEmbeddings, ({ one }) => ({
  resource: one(starterRagResources, {
    fields: [starterRagEmbeddings.resourceId],
    references: [starterRagResources.id],
  }),
}))

export async function createStarterRagDbClient() {
  const settings = await getStarterRagEffectiveSettings()
  const client = postgres(settings.databaseUrl, { max: 1 })
  const db = drizzle(client, {
    schema: {
      resources: starterRagResources,
      embeddings: starterRagEmbeddings,
    },
  })

  return { client, db }
}

export function isStarterRagDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('connect ECONNREFUSED') ||
    error.message.includes('password authentication failed') ||
    error.message.includes('database') ||
    error.message.includes('relation "resources" does not exist')
  )
}

export function readableStarterRagError(error: unknown): string {
  if (!(error instanceof Error)) return 'Starter RAG request failed.'
  if (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED')) {
    return 'Starter RAG database is not reachable. Start the Starter RAG Docker pgvector container.'
  }
  if (error.message.includes('relation "resources" does not exist')) {
    return 'Starter RAG tables are missing. Run the Starter RAG database migrations against its pgvector database.'
  }
  if (error.message.includes('API key')) {
    return 'Starter RAG provider API key is not configured.'
  }
  return error.message || 'Starter RAG request failed.'
}
