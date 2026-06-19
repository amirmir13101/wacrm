import { NextResponse } from 'next/server'

import { groupKnowledgeGaps, type KnowledgeGapRow } from '@/lib/ai/knowledge-gaps'
import { supabaseAdmin } from '@/lib/automations/admin-client'
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

  const { data, error } = await supabaseAdmin()
    .from('ai_knowledge_gaps')
    .select('question, fallback_reason, retrieval_score, created_at')
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error?.code === '42P01') {
    return NextResponse.json({ gaps: [], total: 0, enabled: false })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    gaps: groupKnowledgeGaps((data ?? []) as KnowledgeGapRow[]),
    total: (data ?? []).length,
    enabled: true,
  })
}
