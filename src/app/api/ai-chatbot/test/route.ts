import { NextResponse } from 'next/server'

import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  generateChatbotAnswer,
  logAiChatbotEvent,
  type AiChatbotSettings,
} from '@/lib/ai/chatbot'
import { hybridRetrieveKnowledge } from '@/lib/ai/retrieval'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 1000) : ''
  if (!question) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: settings } = await admin
    .from('ai_chatbot_settings')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()

  const effectiveSettings = (settings ?? {
    workspace_id: workspace.workspaceId,
    ...DEFAULT_AI_CHATBOT_SETTINGS,
  }) as AiChatbotSettings

  const retrieval = await hybridRetrieveKnowledge({
    workspaceId: workspace.workspaceId,
    question,
    client: admin,
  })
  if (retrieval.fallbackReason) {
    const fallback = effectiveSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message
    return NextResponse.json({
      status: 'fallback',
      answer: fallback,
      reason: retrieval.fallbackReason,
      usedChunks: retrieval.chunks,
      providerConfigured: false,
    })
  }
  const answer = await generateChatbotAnswer({
    question,
    settings: effectiveSettings,
    chunks: retrieval.chunks,
    workspaceId: workspace.workspaceId,
    calculation: retrieval.calculation,
  })

  await logAiChatbotEvent({
    workspaceId: workspace.workspaceId,
    userMessage: question,
    aiResponse: answer.answer,
    status: answer.status,
    reason: answer.reason,
  })

  return NextResponse.json(answer)
}
