import { NextResponse } from 'next/server'

import { answerRagDashboardQuestion, RAG_CHAT_QUESTION_LIMIT } from '@/lib/rag/chat'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const question = typeof body.question === 'string' ? body.question : ''
    if (!question.trim()) {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 })
    }
    if (question.length > RAG_CHAT_QUESTION_LIMIT) {
      return NextResponse.json(
        { error: `Question must be ${RAG_CHAT_QUESTION_LIMIT.toLocaleString()} characters or less.` },
        { status: 400 },
      )
    }

    const result = await answerRagDashboardQuestion({
      workspaceId: auth.workspace.workspaceId,
      question,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
