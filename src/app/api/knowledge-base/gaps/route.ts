import { NextResponse } from 'next/server'

import {
  flagRagKnowledgeGap,
  getRagKnowledgeGapSummary,
  listRagKnowledgeGaps,
  updateRagKnowledgeGap,
  type RagKnowledgeGapReviewStatus,
} from '@/lib/rag/dashboard-store'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../_helpers'

const reviewStatuses = new Set<RagKnowledgeGapReviewStatus>([
  'new',
  'needs_knowledge',
  'needs_clarification',
  'retrieval_issue',
  'resolved',
  'ignored',
])

function readReviewStatus(value: unknown): RagKnowledgeGapReviewStatus | null {
  return typeof value === 'string' && reviewStatuses.has(value as RagKnowledgeGapReviewStatus)
    ? value as RagKnowledgeGapReviewStatus
    : null
}

export async function GET() {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const [gaps, summary] = await Promise.all([
      listRagKnowledgeGaps(auth.workspace.workspaceId),
      getRagKnowledgeGapSummary(auth.workspace.workspaceId),
    ])
    return NextResponse.json({ gaps, summary })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const sourceLogId = typeof body.sourceLogId === 'string' ? body.sourceLogId.trim() : ''
    const reviewStatus = readReviewStatus(body.reviewStatus) ?? 'needs_knowledge'
    if (!sourceLogId) {
      return NextResponse.json({ error: 'Activity record is required.' }, { status: 400 })
    }
    const id = await flagRagKnowledgeGap({
      workspaceId: auth.workspace.workspaceId,
      sourceLogId,
      reviewStatus,
    })
    return NextResponse.json({ id, flagged: true })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const reviewStatus = readReviewStatus(body.reviewStatus)
    const resolutionNote = typeof body.resolutionNote === 'string' ? body.resolutionNote : null
    if (!id || !reviewStatus) {
      return NextResponse.json({ error: 'Gap ID and a valid review status are required.' }, { status: 400 })
    }

    const gap = await updateRagKnowledgeGap({
      workspaceId: auth.workspace.workspaceId,
      id,
      reviewStatus,
      resolutionNote,
    })
    return NextResponse.json({ gap, updated: true })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
