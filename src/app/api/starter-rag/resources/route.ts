import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  addStarterRagResource,
  listStarterRagResources,
  STARTER_RAG_RESOURCE_CHARACTER_LIMIT,
} from '@/lib/starter-rag/resources'

import { requireStarterRagPermission, starterRagErrorResponse } from '../_helpers'

export const runtime = 'nodejs'

const resourceSchema = z.object({
  content: z.string().min(1).max(STARTER_RAG_RESOURCE_CHARACTER_LIMIT),
})

export async function GET() {
  const auth = await requireStarterRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({
      resources: await listStarterRagResources(),
      characterLimit: STARTER_RAG_RESOURCE_CHARACTER_LIMIT,
    })
  } catch (error) {
    return starterRagErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const auth = await requireStarterRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = resourceSchema.parse(await request.json())
    const result = await addStarterRagResource(body)
    return NextResponse.json({ resource: result }, { status: 201 })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}
