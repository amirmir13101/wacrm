import { NextResponse } from 'next/server'

import {
  deleteRagKnowledgeSource,
  getRagKnowledgeSource,
  updateRagManualKnowledge,
} from '@/lib/rag/knowledge-store'
import {
  embedRagManualKnowledgeSource,
  recordFailedRagEmbeddingSummary,
} from '@/lib/rag/embedding-store'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../../_helpers'

interface RouteContext {
  readonly params: Promise<{
    readonly id: string
  }>
}

function readSourceType(value: unknown): 'manual' | 'website' | 'faq' | 'note' | undefined {
  if (value === 'manual' || value === 'website' || value === 'faq' || value === 'note') return value
  return undefined
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const source = await getRagKnowledgeSource({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
    })
    if (!source) return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    return NextResponse.json({ source, limit: RAG_KNOWLEDGE_CHARACTER_LIMIT })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''
    const sourceType = readSourceType(body.sourceType)
    const source = await updateRagManualKnowledge({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
      title,
      content,
      sourceType,
      status: 'active',
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
      console.warn('rag_manual_knowledge_embedding_after_update_failed', {
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
      embeddingsReady: embeddingSummary?.embeddingsReady ?? false,
      embeddingErrorCategory: embeddingSummary?.embeddingErrorCategory ?? null,
      userMessage: embeddingSummary?.userMessage ?? 'Knowledge source updated.',
      limit: RAG_KNOWLEDGE_CHARACTER_LIMIT,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const result = await deleteRagKnowledgeSource({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
