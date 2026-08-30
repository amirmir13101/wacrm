import { NextResponse } from 'next/server'

import {
  deleteRagScrapeSchedule,
  saveRagScrapeSchedule,
} from '@/lib/rag/dashboard-store'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../../_helpers'

interface RouteContext {
  readonly params: Promise<{
    readonly id: string
  }>
}

function readFrequency(value: unknown): 'daily' | 'weekly' | 'monthly' {
  if (value === 'daily' || value === 'monthly') return value
  return 'weekly'
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const schedule = await saveRagScrapeSchedule({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      id,
      url: typeof body.url === 'string' ? body.url : '',
      frequency: readFrequency(body.frequency),
      pageLimit: typeof body.pageLimit === 'number' ? body.pageLimit : 25,
      dayOfWeek: typeof body.dayOfWeek === 'number' ? body.dayOfWeek : null,
      hourUtc: typeof body.hourUtc === 'number' ? body.hourUtc : null,
      autoPublish: body.autoPublish === true,
      isActive: body.isActive === true,
    })
    return NextResponse.json({ schedule })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const result = await deleteRagScrapeSchedule({
      workspaceId: auth.workspace.workspaceId,
      id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
