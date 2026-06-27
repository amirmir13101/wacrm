import { NextResponse } from 'next/server'

import {
  deleteRagKnowledgeSource,
  getRagKnowledgeSource,
  updateRagManualKnowledge,
} from '@/lib/rag/knowledge-store'
import {
  createSkippedRagEmbeddingSummary,
  embedRagManualKnowledgeSource,
  shouldAutoEmbedRagKnowledge,
} from '@/lib/rag/embedding-store'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
import { sanitizeProviderError } from '@/lib/rag/security'
import { requireRagPermission, safeErrorMessage } from '../../_helpers'

interface RouteContext {
  readonly params: Promise<{
    readonly id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRagPermission('view_rag_chatbot')
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
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''
    const source = await updateRagManualKnowledge({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
      title,
      content,
      status: 'active',
    })
    const embeddingSummary = shouldAutoEmbedRagKnowledge(source.chunkCount)
      ? await embedRagManualKnowledgeSource({
        workspaceId: auth.workspace.workspaceId,
        sourceId: source.id,
      }).catch((error) => ({
        chunksProcessed: 0,
        embeddingsCreated: 0,
        embeddingsSkipped: 0,
        embeddingsFailed: 0,
        status: 'failed' as const,
        message: sanitizeProviderError(error),
        embeddingsReady: false,
        embeddingErrorCategory: 'unknown_embedding_error' as const,
        userMessage: 'Chunks ready. Embeddings could not be prepared. Please check your AI provider settings or click Prepare for Chatbot again.',
      }))
      : createSkippedRagEmbeddingSummary(source.chunkCount)

    return NextResponse.json({
      source,
      embeddingSummary,
      saved: true,
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
  const auth = await requireRagPermission('manage_rag_chatbot')
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
