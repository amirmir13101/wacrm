import { NextResponse } from 'next/server'

import { getAiAgentUsage } from '@/lib/ai-agent/store'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function GET() {
  const guard = await requireWorkspacePermission('manage_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const usage = await getAiAgentUsage(guard.workspace.workspaceId)
    return NextResponse.json({ usage })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed.' }, { status: 500 })
  }
}
