import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  deleteStarterRagResource,
  getStarterRagResource,
  STARTER_RAG_RESOURCE_CHARACTER_LIMIT,
  updateStarterRagResource,
} from '@/lib/starter-rag/resources'

import { requireStarterRagPermission, starterRagErrorResponse } from '../../_helpers'

export const runtime = 'nodejs'

const paramsSchema = z.object({ id: z.string().min(1) })
const resourceSchema = z.object({
  content: z.string().min(1).max(STARTER_RAG_RESOURCE_CHARACTER_LIMIT),
})

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStarterRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = paramsSchema.parse(await context.params)
    const resource = await getStarterRagResource(id)
    if (!resource) {
      return NextResponse.json({ error: 'Starter RAG resource not found.' }, { status: 404 })
    }
    return NextResponse.json({ resource })
  } catch (error) {
    return starterRagErrorResponse(error)
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStarterRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = paramsSchema.parse(await context.params)
    const body = resourceSchema.parse(await request.json())
    const result = await updateStarterRagResource({ id, content: body.content })
    return NextResponse.json({ resource: { id, ...result } })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStarterRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = paramsSchema.parse(await context.params)
    await deleteStarterRagResource(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return starterRagErrorResponse(error, 400)
  }
}
