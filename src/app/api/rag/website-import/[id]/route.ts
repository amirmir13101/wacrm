import { NextResponse } from 'next/server'

import {
  discardRagWebsiteImportJob,
  getRagWebsiteImportJob,
  publishRagWebsiteImportJob,
  updateRagWebsiteImportDraft,
} from '@/lib/rag/dashboard-store'
import {
  embedRagManualKnowledgeSource,
  recordFailedRagEmbeddingSummary,
} from '@/lib/rag/embedding-store'
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
    const title = typeof body.title === 'string' ? body.title : undefined
    const content = typeof body.content === 'string' ? body.content : undefined

    if (action === 'publish') {
      const result = await publishRagWebsiteImportJob({
        workspaceId: auth.workspace.workspaceId,
        userId: auth.workspace.userId,
        jobId: id,
        title,
        content,
      })
      let embeddingSummary
      let embeddingWarning = false
      try {
        embeddingSummary = await embedRagManualKnowledgeSource({
          workspaceId: auth.workspace.workspaceId,
          sourceId: result.sourceId,
        })
      } catch (embeddingError) {
        embeddingWarning = true
        embeddingSummary = await recordFailedRagEmbeddingSummary({
          workspaceId: auth.workspace.workspaceId,
          sourceId: result.sourceId,
          error: embeddingError,
        })
        console.warn('rag_website_import_embedding_after_publish_failed', {
          category: embeddingSummary.embeddingErrorCategory,
          chunksProcessed: embeddingSummary.chunksProcessed,
          jobId: id,
          sourceId: result.sourceId,
          workspaceId: auth.workspace.workspaceId,
        })
      }
      return NextResponse.json({
        ...result,
        published: true,
        saved: true,
        embeddingWarning,
        embeddingSummary,
        embeddingsReady: embeddingSummary.embeddingsReady,
        embeddingErrorCategory: embeddingSummary.embeddingErrorCategory,
        userMessage: embeddingSummary.userMessage,
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
      title: title ?? '',
      content: content ?? '',
    })
    return NextResponse.json({ ...result, saved: true })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
