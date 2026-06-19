import { NextResponse } from 'next/server'

import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  getAiPlanAccess,
  isAiProviderConfigured,
  type AiChatbotSettings,
  type AiChatbotTone,
  type AiKnowledgeSourceType,
} from '@/lib/ai/chatbot'
import { embedNewChunks } from '@/lib/ai/embedding-backfill'
import { buildKnowledgeChunkRows, semanticChunkText } from '@/lib/ai/knowledge'
import {
  MAX_IMPORTED_WEBSITE_KNOWLEDGE_CONTENT_LENGTH,
  MAX_MANUAL_KNOWLEDGE_CONTENT_LENGTH,
} from '@/lib/ai/website-import'
import { getPublicFirecrawlSettings } from '@/lib/ai/firecrawl'
import { getPublicProviderSettings } from '@/lib/ai/provider'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { hasWorkspacePermission } from '@/lib/team/permissions'

const SOURCE_TYPES = new Set(['manual', 'faq', 'instructions', 'website'])
const TONES = new Set(['friendly', 'professional', 'concise', 'supportive'])

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const [{ data: settings }, { data: sources }, planAccess, providerSettings, providerConfigured, firecrawlSettings] = await Promise.all([
    admin
      .from('ai_chatbot_settings')
      .select('*')
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle(),
    admin
      .from('ai_knowledge_sources')
      .select('id, workspace_id, source_type, title, content, status, created_at, updated_at')
      .eq('workspace_id', workspace.workspaceId)
      .order('created_at', { ascending: false }),
    getAiPlanAccess(workspace.workspaceId),
    getPublicProviderSettings(workspace.workspaceId),
    isAiProviderConfigured(workspace.workspaceId),
    getPublicFirecrawlSettings(workspace.workspaceId),
  ])

  return NextResponse.json({
    settings:
      settings ??
      ({
        workspace_id: workspace.workspaceId,
        ...DEFAULT_AI_CHATBOT_SETTINGS,
      } satisfies Omit<AiChatbotSettings, 'id'>),
    sources: sources ?? [],
    planAccess,
    providerConfigured,
    providerSettings,
    firecrawlSettings,
    permissions: {
      canManage: hasWorkspacePermission(workspace, 'manage_ai_chatbot'),
      canEnableAutoReply: hasWorkspacePermission(workspace, 'enable_ai_auto_reply'),
      canRechunkAll: ['owner', 'admin'].includes(workspace.role),
    },
  })
}

export async function PUT(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot settings' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const autoReplyEnabled = Boolean(body.auto_reply_enabled)
  if (autoReplyEnabled && !hasWorkspacePermission(workspace, 'enable_ai_auto_reply')) {
    return NextResponse.json({ error: 'You cannot enable AI auto-reply' }, { status: 403 })
  }

  const planAccess = await getAiPlanAccess(workspace.workspaceId)
  if (autoReplyEnabled && !planAccess.canUseAutoReply) {
    return NextResponse.json({ error: planAccess.reason ?? 'Active Pro plan required' }, { status: 402 })
  }
  if (autoReplyEnabled && !(await isAiProviderConfigured(workspace.workspaceId))) {
    return NextResponse.json({ error: 'AI provider is not configured. Add an API key before enabling auto-reply.' }, { status: 503 })
  }

  const tone = typeof body.tone === 'string' && TONES.has(body.tone)
    ? (body.tone as AiChatbotTone)
    : DEFAULT_AI_CHATBOT_SETTINGS.tone
  const fallbackMessage = readLimitedText(body.fallback_message, DEFAULT_AI_CHATBOT_SETTINGS.fallback_message, 500)
  const handoverMessage = readLimitedText(body.handover_message, DEFAULT_AI_CHATBOT_SETTINGS.handover_message, 500)

  const { data, error } = await supabaseAdmin()
    .from('ai_chatbot_settings')
    .upsert(
      {
        workspace_id: workspace.workspaceId,
        enabled: Boolean(body.enabled),
        tone,
        fallback_message: fallbackMessage,
        handover_enabled: Boolean(body.handover_enabled),
        handover_message: handoverMessage,
        auto_reply_enabled: autoReplyEnabled,
      },
      { onConflict: 'workspace_id' },
    )
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot knowledge' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = readLimitedText(body.title, '', 160)
  const sourceType =
    typeof body.source_type === 'string' && SOURCE_TYPES.has(body.source_type)
      ? (body.source_type as AiKnowledgeSourceType)
      : 'manual'
  const contentLimit =
    sourceType === 'website' ? MAX_IMPORTED_WEBSITE_KNOWLEDGE_CONTENT_LENGTH : MAX_MANUAL_KNOWLEDGE_CONTENT_LENGTH
  const content = readLimitedText(body.content, '', contentLimit)

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .insert({
      workspace_id: workspace.workspaceId,
      source_type: sourceType,
      title,
      content,
      status: 'active',
    })
    .select('*')
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: sourceError?.message ?? 'Failed to save knowledge.' }, { status: 500 })
  }

  const chunks = semanticChunkText(content)
  if (chunks.length > 0) {
    const { data: insertedChunks, error: chunksError } = await admin.from('ai_knowledge_chunks').insert(
      buildKnowledgeChunkRows({
        chunks,
        workspaceId: workspace.workspaceId,
        sourceId: source.id,
        title,
        sourceType,
      }),
    ).select('id')
    if (chunksError) {
      return NextResponse.json({ error: chunksError.message }, { status: 500 })
    }
    embedNewChunks(workspace.workspaceId, (insertedChunks ?? []).map((chunk) => chunk.id), admin)
  }

  return NextResponse.json({ source })
}

function readLimitedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLength)
}
