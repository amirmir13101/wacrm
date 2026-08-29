import { NextResponse } from 'next/server'

import { deleteAiAgentKnowledge } from '@/lib/ai-agent/store'
import { requireWorkspacePermission } from '@/lib/team/server'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireWorkspacePermission('manage_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const { id } = await params
    await deleteAiAgentKnowledge(guard.workspace.workspaceId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed.' }, { status: 400 })
  }
}
