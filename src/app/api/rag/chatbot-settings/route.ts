import { NextResponse } from 'next/server'

import {
  getRagChatbotSettings,
  saveRagChatbotSettings,
  type RagChatbotTone,
} from '@/lib/rag/dashboard-store'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

function readTone(value: unknown): RagChatbotTone {
  if (value === 'friendly' || value === 'concise' || value === 'helpful') return value
  return 'professional'
}

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const settings = await getRagChatbotSettings(auth.workspace.workspaceId)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const settings = await saveRagChatbotSettings({
      workspaceId: auth.workspace.workspaceId,
      enabled: body.enabled !== false,
      tone: readTone(body.tone),
      handoverEnabled: body.handoverEnabled !== false,
      fallbackMessage: typeof body.fallbackMessage === 'string' ? body.fallbackMessage : '',
      handoverMessage: typeof body.handoverMessage === 'string' ? body.handoverMessage : '',
    })
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
