import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { embed } from 'ai'

import { createStarterRagDbClient } from '@/lib/starter-rag/db'
import { createStarterRagAIProvider } from '@/lib/starter-rag/provider'

import { requireStarterRagPermission, starterRagErrorResponse } from '../../_helpers'

export const runtime = 'nodejs'

export async function POST() {
  const auth = await requireStarterRagPermission('manage_rag_provider')
  if (!auth.ok) return auth.response

  let client: Awaited<ReturnType<typeof createStarterRagDbClient>>['client'] | null = null

  try {
    const dbClient = await createStarterRagDbClient()
    client = dbClient.client
    await dbClient.db.execute(sql`select 1`)

    const { provider, providerName, embeddingModel } = await createStarterRagAIProvider()
    await embed({
      model: provider.embedding(embeddingModel),
      value: 'Starter RAG connection test',
    })

    return NextResponse.json({
      ok: true,
      provider: providerName,
      embeddingModel,
      message: 'Starter RAG database and embedding provider are reachable.',
    })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  } finally {
    if (client) {
      await client.end({ timeout: 1 })
    }
  }
}
