import { NextResponse } from 'next/server'

import { createRagWebsiteImportJob } from '@/lib/rag/dashboard-store'
import { createRagWebsiteImportDraft } from '@/lib/rag/website-import'
import {
  createSkippedRagEmbeddingSummary,
} from '@/lib/rag/embedding-store'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url : ''
    const pageLimit = typeof body.pageLimit === 'number' ? body.pageLimit : undefined
    const draft = await createRagWebsiteImportDraft({
      workspaceId: auth.workspace.workspaceId,
      url,
      pageLimit,
    })
    const result = await createRagWebsiteImportJob({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      draft,
    })
    const embeddingSummary = createSkippedRagEmbeddingSummary(0)

    return NextResponse.json({
      ...result,
      stats: draft.stats,
      message: draft.message,
      embeddingSummary,
      saved: false,
      draftReady: true,
      chunksCreated: false,
      embeddingsReady: embeddingSummary.embeddingsReady,
      embeddingErrorCategory: embeddingSummary.embeddingErrorCategory,
      userMessage: draft.message,
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
