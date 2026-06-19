import { NextResponse } from 'next/server'

import { backfillWorkspaceEmbeddings } from '@/lib/ai/embedding-backfill'
import { generateEmbedding, resolveEmbeddingConfig } from '@/lib/ai/embeddings'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI provider settings' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : 'test'

  if (action === 'backfill') {
    const batchSize = typeof body.batch_size === 'number' ? body.batch_size : 10
    const result = await backfillWorkspaceEmbeddings({
      workspaceId: workspace.workspaceId,
      batchSize,
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  if (action !== 'test') {
    return NextResponse.json({ error: 'Unsupported embeddings action.' }, { status: 400 })
  }

  const config = await resolveEmbeddingConfig(workspace.workspaceId)
  if (!config.supported || !config.apiKey) {
    await markEmbeddingTest(workspace.workspaceId, false, config.reason ?? 'Embedding API key is not configured.')
    return NextResponse.json(
      {
        ok: false,
        message: config.reason ?? 'Embedding API key is not configured.',
      },
      { status: 400 },
    )
  }

  try {
    const result = await generateEmbedding('Embedding connection test', config)
    await markEmbeddingTest(workspace.workspaceId, Boolean(result), result ? null : 'Embedding API key is not configured.')
    return NextResponse.json({
      ok: Boolean(result),
      message: result
        ? 'Embedding connection works.'
        : 'Embedding API key is not configured.',
      model: result?.model ?? config.model,
      dimensions: result?.embedding.length ?? config.dimensions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Embedding connection test failed.'
    await markEmbeddingTest(workspace.workspaceId, false, message)
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    )
  }
}

async function markEmbeddingTest(workspaceId: string, ok: boolean, error: string | null): Promise<void> {
  await supabaseAdmin()
    .from('ai_chatbot_provider_settings')
    .update({
      last_embedding_tested_at: new Date().toISOString(),
      last_embedding_test_status: ok ? 'success' : 'failed',
      last_embedding_test_error: error,
    })
    .eq('workspace_id', workspaceId)
}
