import { NextResponse } from 'next/server'

import {
  discardRagWebsiteImportJob,
  getRagWebsiteImportJob,
  publishRagWebsiteImportJob,
  updateRagWebsiteImportDraft,
} from '@/lib/rag/dashboard-store'
import { createSkippedRagEmbeddingSummary } from '@/lib/rag/embedding-store'
import { requireRagPermission, safeErrorMessage } from '../../_helpers'

interface RouteContext {
  readonly params: Promise<{
    readonly id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const result = await getRagWebsiteImportJob({
      workspaceId: auth.workspace.workspaceId,
      jobId: id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : 'update'
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''

    if (action === 'publish') {
      const result = await publishRagWebsiteImportJob({
        workspaceId: auth.workspace.workspaceId,
        userId: auth.workspace.userId,
        jobId: id,
        title,
        content,
      })
      const embeddingSummary = createSkippedRagEmbeddingSummary(0)
      return NextResponse.json({
        ...result,
        published: true,
        embeddingSummary,
        userMessage: 'Website draft published. Chunks were created; click Prepare for Chatbot when you want embeddings.',
      })
    }

    if (action === 'discard') {
      const result = await discardRagWebsiteImportJob({
        workspaceId: auth.workspace.workspaceId,
        jobId: id,
      })
      return NextResponse.json({ ...result, discarded: true })
    }

    const result = await updateRagWebsiteImportDraft({
      workspaceId: auth.workspace.workspaceId,
      jobId: id,
      title,
      content,
    })
    return NextResponse.json({ ...result, saved: true })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
