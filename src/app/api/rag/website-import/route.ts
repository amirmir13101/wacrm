import { NextResponse } from 'next/server'

import { importRagWebsiteKnowledge } from '@/lib/rag/website-import'
import {
  createSkippedRagEmbeddingSummary,
} from '@/lib/rag/embedding-store'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url : ''
    const pageLimit = typeof body.pageLimit === 'number' ? body.pageLimit : undefined
    const result = await importRagWebsiteKnowledge({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      url,
      pageLimit,
    })
    const embeddingSummary = createSkippedRagEmbeddingSummary(result.source.chunkCount)

    return NextResponse.json({
      ...result,
      embeddingSummary,
      saved: true,
      chunksCreated: result.source.chunkCount > 0,
      embeddingsReady: embeddingSummary.embeddingsReady,
      embeddingErrorCategory: embeddingSummary.embeddingErrorCategory,
      userMessage: embeddingSummary.userMessage,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
