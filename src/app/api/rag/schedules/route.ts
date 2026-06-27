import { NextResponse } from 'next/server'

import {
  listRagScrapeSchedules,
  saveRagScrapeSchedule,
} from '@/lib/rag/dashboard-store'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

function readFrequency(value: unknown): 'daily' | 'weekly' | 'monthly' {
  if (value === 'daily' || value === 'monthly') return value
  return 'weekly'
}

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const schedules = await listRagScrapeSchedules(auth.workspace.workspaceId)
    return NextResponse.json({ schedules })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const schedule = await saveRagScrapeSchedule({
      workspaceId: auth.workspace.workspaceId,
      userId: auth.workspace.userId,
      id: typeof body.id === 'string' ? body.id : null,
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
