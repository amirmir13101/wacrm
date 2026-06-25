import { NextResponse } from 'next/server'

import {
  archiveRagKnowledgeSource,
  getRagKnowledgeSource,
  updateRagManualKnowledge,
} from '@/lib/rag/knowledge-store'
import { embedRagManualKnowledgeSource } from '@/lib/rag/embedding-store'
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
    const status = body.status === 'archived' ? 'archived' : 'active'
    const source = await updateRagManualKnowledge({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
      title,
      content,
      status,
    })
    const embeddingSummary = status === 'active'
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
      }))
      : null

    return NextResponse.json({ source, embeddingSummary, limit: RAG_KNOWLEDGE_CHARACTER_LIMIT })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    await archiveRagKnowledgeSource({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
