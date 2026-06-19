import { NextResponse } from 'next/server'

import { rechunkKnowledgeSource } from '@/lib/ai/knowledge'
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
    return NextResponse.json({ error: 'You cannot manage AI Chatbot knowledge' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const sourceId = typeof body.source_id === 'string' ? body.source_id.trim() : ''
  if (!sourceId && !['owner', 'admin'].includes(workspace.role)) {
    return NextResponse.json({ error: 'Workspace admin access is required to re-chunk all sources.' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const sourceResult = sourceId
    ? await admin
      .from('ai_knowledge_sources')
      .select('id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('id', sourceId)
    : await admin
      .from('ai_knowledge_sources')
      .select('id')
      .eq('workspace_id', workspace.workspaceId)
  if (sourceResult.error) {
    return NextResponse.json({ error: sourceResult.error.message }, { status: 500 })
  }
  const sourceRows = sourceResult.data ?? []

  if (sourceId && sourceRows.length === 0) {
    return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
  }

  let totalOldChunks = 0
  let totalNewChunks = 0
  let sourcesProcessed = 0
  const errors: string[] = []
  for (const source of sourceRows) {
    try {
      const result = await rechunkKnowledgeSource({
        workspaceId: workspace.workspaceId,
        sourceId: source.id,
        client: admin,
      })
      totalOldChunks += result.oldChunkCount
      totalNewChunks += result.newChunkCount
      sourcesProcessed += 1
    } catch (rechunkError) {
      errors.push(rechunkError instanceof Error ? rechunkError.message : 'Unknown re-chunk error')
    }
  }

  return NextResponse.json({
    sources_processed: sourcesProcessed,
    total_old_chunks: totalOldChunks,
    total_new_chunks: totalNewChunks,
    status: errors.length === 0 ? 'completed' : sourcesProcessed > 0 ? 'partial' : 'failed',
    ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
  })
}
