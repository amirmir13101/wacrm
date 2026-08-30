import { NextResponse } from 'next/server'

import { embedRagManualKnowledgeSource } from '@/lib/rag/embedding-store'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../../../_helpers'

export async function POST(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const summary = await embedRagManualKnowledgeSource({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
    })

    return NextResponse.json({
      summary,
      saved: true,
      chunksCreated: summary.chunksProcessed > 0,
      embeddingsReady: summary.embeddingsReady,
      embeddingErrorCategory: summary.embeddingErrorCategory,
      userMessage: summary.userMessage,
      totalChunks: summary.totalChunks,
      readyChunks: summary.readyChunks,
      processedThisBatch: summary.processedThisBatch,
      remainingChunks: summary.remainingChunks,
      percentComplete: summary.percentComplete,
      batchChunkCount: summary.batchChunkCount,
      batchTotalCharacters: summary.batchTotalCharacters,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
