import { NextResponse } from 'next/server'

import {
  getRagConversationControl,
  upsertRagConversationControl,
  type RagConversationControlAction,
} from '@/lib/rag/conversation-controls'
import { requireRagPermission, safeErrorMessage } from '../../_helpers'

interface RouteContext {
  readonly params: Promise<{
    readonly conversationId: string
  }>
}

function readAction(value: unknown): RagConversationControlAction | null {
  if (
    value === 'accept_human' ||
    value === 'reject_human' ||
    value === 'ai_active' ||
    value === 'ai_pause'
  ) {
    return value
  }
  return null
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRagPermission('reply_to_conversations')
  if (!auth.ok) return auth.response

  try {
    const { conversationId } = await context.params
    const control = await getRagConversationControl({
      workspaceId: auth.workspace.workspaceId,
      conversationId,
    })
    return NextResponse.json({ control })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRagPermission('reply_to_conversations')
  if (!auth.ok) return auth.response

  try {
    const { conversationId } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = readAction(body.action)
    if (!action) {
      return NextResponse.json({ error: 'Invalid conversation control action.' }, { status: 400 })
    }

    const control = await upsertRagConversationControl({
      workspaceId: auth.workspace.workspaceId,
      conversationId,
      action,
      reason: typeof body.reason === 'string' ? body.reason : null,
    })
    return NextResponse.json({ control })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
