import {
  getReadableStarterRagChatError,
  streamStarterRagChat,
} from '@/lib/starter-rag/chat'

import { requireStarterRagPermission, starterRagErrorResponse } from '../_helpers'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const auth = await requireStarterRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { messages } = await request.json()
    const result = await streamStarterRagChat(messages)
    return result.toUIMessageStreamResponse({
      onError: getReadableStarterRagChatError,
    })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}
