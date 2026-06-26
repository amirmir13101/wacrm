import { NextResponse } from 'next/server'

import { importRagWebsiteKnowledge } from '@/lib/rag/website-import'
import {
  createSkippedRagEmbeddingSummary,
  embedRagManualKnowledgeSource,
  shouldAutoEmbedRagKnowledge,
} from '@/lib/rag/embedding-store'
import { sanitizeProviderError } from '@/lib/rag/security'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url : ''
    const result = await importRagWebsiteKnowledge({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      url,
    })
    const embeddingSummary = shouldAutoEmbedRagKnowledge(result.source.chunkCount)
      ? await embedRagManualKnowledgeSource({
        workspaceId: auth.workspace.workspaceId,
        sourceId: result.source.id,
      }).catch((error) => ({
        chunksProcessed: 0,
        embeddingsCreated: 0,
        embeddingsSkipped: 0,
        embeddingsFailed: 0,
        status: 'failed' as const,
        message: sanitizeProviderError(error),
      }))
      : createSkippedRagEmbeddingSummary(result.source.chunkCount)

    return NextResponse.json({ ...result, embeddingSummary })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
