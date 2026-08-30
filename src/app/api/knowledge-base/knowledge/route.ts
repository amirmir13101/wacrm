import { NextResponse } from 'next/server'

import {
  createRagManualKnowledge,
  listRagKnowledgeSources,
} from '@/lib/rag/knowledge-store'
import {
  embedRagManualKnowledgeSource,
  recordFailedRagEmbeddingSummary,
} from '@/lib/rag/embedding-store'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../_helpers'

function readSourceType(value: unknown): 'manual' | 'website' | 'faq' | 'note' {
  if (value === 'website' || value === 'faq' || value === 'note') return value
  return 'manual'
}

export async function GET() {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const sources = await listRagKnowledgeSources(auth.workspace.workspaceId)
    return NextResponse.json({
      sources,
      limit: RAG_KNOWLEDGE_CHARACTER_LIMIT,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''
    const sourceType = readSourceType(body.sourceType)

    const source = await createRagManualKnowledge({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      title,
      content,
      sourceType,
    })
    let embeddingSummary
    let embeddingWarning = false
    try {
      embeddingSummary = await embedRagManualKnowledgeSource({
        workspaceId: auth.workspace.workspaceId,
        sourceId: source.id,
      })
    } catch (embeddingError) {
      embeddingWarning = true
      embeddingSummary = await recordFailedRagEmbeddingSummary({
        workspaceId: auth.workspace.workspaceId,
        sourceId: source.id,
        error: embeddingError,
      })
      console.warn('rag_manual_knowledge_embedding_after_save_failed', {
        category: embeddingSummary.embeddingErrorCategory,
        chunksProcessed: embeddingSummary.chunksProcessed,
        sourceId: source.id,
        workspaceId: auth.workspace.workspaceId,
      })
    }

    return NextResponse.json({
      source,
      embeddingSummary,
      saved: true,
      embeddingWarning,
      chunksCreated: source.chunkCount > 0,
      embeddingsReady: embeddingSummary.embeddingsReady,
      embeddingErrorCategory: embeddingSummary.embeddingErrorCategory,
      userMessage: embeddingSummary.userMessage,
      limit: RAG_KNOWLEDGE_CHARACTER_LIMIT,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
