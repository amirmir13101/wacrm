import { NextResponse } from 'next/server'

import {
  defaultBaseUrlForProvider,
  defaultModelForProvider,
  getPublicProviderSettings,
  normalizeProvider,
  providerSupportsChat,
  saveProviderSettings,
  testProviderConnection,
} from '@/lib/ai/provider'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const settings = await getPublicProviderSettings(workspace.workspaceId)
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI provider settings' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const provider = normalizeProvider(body.provider)
  const model = readText(body.model, defaultModelForProvider(provider), 120)
  const baseUrl = readText(body.base_url, defaultBaseUrlForProvider(provider), 300)
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''
  const embeddingsEnabled = body.embeddings_enabled === true
  const embeddingModel = readText(body.embedding_model, '', 160)
  const embeddingDimensions = typeof body.embedding_dimensions === 'number' ? body.embedding_dimensions : null

  if (!providerSupportsChat(provider)) {
    const settings = await saveProviderSettings({
      workspaceId: workspace.workspaceId,
      provider,
      model,
      baseUrl,
      apiKey: apiKey || null,
      embeddingsEnabled,
      embeddingModel,
      embeddingDimensions,
    })
    return NextResponse.json({
      settings,
      warning: 'Anthropic Claude can be saved here, but Phase 1 only supports OpenAI-compatible chat APIs.',
    })
  }

  if ((provider === 'custom' || provider === 'ollama') && !baseUrl) {
    return NextResponse.json({ error: 'Base URL is required for custom/Ollama providers.' }, { status: 400 })
  }

  const settings = await saveProviderSettings({
    workspaceId: workspace.workspaceId,
    provider,
    model,
    baseUrl,
    apiKey: apiKey || null,
    embeddingsEnabled,
    embeddingModel,
    embeddingDimensions,
  })

  return NextResponse.json({ settings })
}

export async function POST() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot test AI provider settings' }, { status: 403 })
  }

  const result = await testProviderConnection(workspace.workspaceId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

function readText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return (trimmed || fallback).slice(0, maxLength)
}
