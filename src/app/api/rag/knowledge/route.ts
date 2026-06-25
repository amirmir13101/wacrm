import { NextResponse } from 'next/server'

import {
  createRagManualKnowledge,
  listRagKnowledgeSources,
} from '@/lib/rag/knowledge-store'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
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

    return NextResponse.json({ source, limit: RAG_KNOWLEDGE_CHARACTER_LIMIT })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
