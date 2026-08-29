import { NextResponse } from 'next/server'

import { saveAiAgentConfig, getAiAgentConfig, testAiAgentConfig } from '@/lib/ai-agent/store'
import { AI_PROVIDER_DEFAULTS } from '@/lib/rag/provider-config'
import { isRagProviderType } from '@/lib/rag/settings'
import type { RagProviderType } from '@/lib/rag/types'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function GET() {
  const guard = await requireWorkspacePermission('view_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const config = await getAiAgentConfig(guard.workspace.workspaceId)
    return NextResponse.json({ config })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireWorkspacePermission('manage_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const body = await request.json()
    const provider = parseProvider(body.provider)
    const defaults = AI_PROVIDER_DEFAULTS[provider]
    const config = await saveAiAgentConfig({
      workspaceId: guard.workspace.workspaceId,
      userId: guard.workspace.userId,
      provider,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : null,
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : defaults.baseUrl,
      chatModel: typeof body.chatModel === 'string' ? body.chatModel : defaults.chatModel,
      embeddingModel: typeof body.embeddingModel === 'string' ? body.embeddingModel : defaults.embeddingModel,
      embeddingDimensions: Number(body.embeddingDimensions || defaults.embeddingDimensions),
      systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : null,
      isActive: body.isActive === true,
      autoReplyEnabled: body.autoReplyEnabled === true,
      autoReplyMaxPerConversation: Number(body.autoReplyMaxPerConversation || 3),
      handoffMessage: typeof body.handoffMessage === 'string' ? body.handoffMessage : null,
    })
    return NextResponse.json({ config })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 400 })
  }
}

export async function PATCH() {
  const guard = await requireWorkspacePermission('manage_ai_agent')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const config = await testAiAgentConfig(guard.workspace.workspaceId)
    return NextResponse.json({ config })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 400 })
  }
}

function parseProvider(value: unknown): RagProviderType {
  if (typeof value === 'string' && isRagProviderType(value)) return value
  return 'openai'
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.'
}
