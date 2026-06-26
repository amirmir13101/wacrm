import { NextResponse } from 'next/server'
import { z } from 'zod'

import { answerStarterRagQuestion } from '@/lib/starter-rag/chat'

import { requireStarterRagPermission, starterRagErrorResponse } from '../_helpers'

export const runtime = 'nodejs'

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10_000),
})

const chatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(24),
})

export async function POST(request: Request) {
  const auth = await requireStarterRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = chatSchema.parse(await request.json())
    const result = await answerStarterRagQuestion(body.messages)
    return NextResponse.json(result)
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}
