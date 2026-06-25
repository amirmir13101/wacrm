import { NextResponse } from 'next/server'

import {
  createRagManualKnowledge,
  listRagKnowledgeSources,
} from '@/lib/rag/knowledge-store'
import { embedRagManualKnowledgeSource } from '@/lib/rag/embedding-store'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
import { sanitizeProviderError } from '@/lib/rag/security'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
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
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''

    const source = await createRagManualKnowledge({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      title,
      content,
    })
    const embeddingSummary = await embedRagManualKnowledgeSource({
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

    return NextResponse.json({ source, embeddingSummary, limit: RAG_KNOWLEDGE_CHARACTER_LIMIT })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
