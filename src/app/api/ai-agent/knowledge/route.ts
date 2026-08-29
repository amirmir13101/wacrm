import { NextResponse } from 'next/server'

import { listAiAgentKnowledge, saveAiAgentKnowledge } from '@/lib/ai-agent/store'
import { AI_AGENT_SOURCE_TYPES, type AiAgentSourceType } from '@/lib/ai-agent/types'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function GET() {
  const guard = await requireWorkspacePermission('view_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const documents = await listAiAgentKnowledge(guard.workspace.workspaceId)
    return NextResponse.json({ documents })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireWorkspacePermission('manage_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const body = await request.json()
    const documents = await saveAiAgentKnowledge({
      workspaceId: guard.workspace.workspaceId,
      userId: guard.workspace.userId,
      id: typeof body.id === 'string' ? body.id : null,
      title: String(body.title ?? ''),
      content: String(body.content ?? ''),
      sourceType: parseSourceType(body.sourceType),
    })
    return NextResponse.json({ documents })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 400 })
  }
}

function parseSourceType(value: unknown): AiAgentSourceType {
  if (typeof value === 'string' && (AI_AGENT_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as AiAgentSourceType
  }
  return 'manual'
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.'
}
