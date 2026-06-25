import { NextResponse } from 'next/server'

import {
  getRagAutoReplySettings,
  saveRagAutoReplySettings,
  type RagAutoReplyFallbackMode,
} from '@/lib/rag/auto-reply'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

function readFallbackMode(value: unknown): RagAutoReplyFallbackMode {
  return value === 'send_fallback' ? 'send_fallback' : 'do_not_reply'
}

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const settings = await getRagAutoReplySettings(auth.workspace.workspaceId)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRagPermission('enable_rag_auto_reply')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const settings = await saveRagAutoReplySettings({
      workspaceId: auth.workspace.workspaceId,
      enabled: body.enabled === true,
      fallbackMode: readFallbackMode(body.fallbackMode),
      fallbackMessage: typeof body.fallbackMessage === 'string' ? body.fallbackMessage : '',
    })

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
