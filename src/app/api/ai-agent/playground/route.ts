import { NextResponse } from 'next/server'

import { askAiAgent } from '@/lib/ai-agent/store'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function POST(request: Request) {
  const guard = await requireWorkspacePermission('view_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const body = await request.json()
    const result = await askAiAgent({
      workspaceId: guard.workspace.workspaceId,
      userId: guard.workspace.userId,
      question: String(body.question ?? ''),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed.' }, { status: 400 })
  }
}
