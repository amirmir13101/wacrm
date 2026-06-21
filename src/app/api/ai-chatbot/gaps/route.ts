import { NextResponse } from 'next/server'

import { buildLanguageBreakdown, groupKnowledgeGaps, type KnowledgeGapRow } from '@/lib/ai/knowledge-gaps'
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

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ai_knowledge_gaps')
    .select('question, fallback_reason, retrieval_score, created_at, detected_language, channel, failure_category, technical_reason, provider_status, provider_error_code, provider_error_type, provider_error_message, selected_source_titles, guardrail_reason, handoff_triggered, suggested_action, resolved_at')
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error?.code === '42P01') {
    return NextResponse.json({ gaps: [], total: 0, enabled: false })
  }
  if (error) {
    if (error.code === '42703') {
      const fallback = await admin
        .from('ai_knowledge_gaps')
        .select('question, fallback_reason, retrieval_score, created_at')
        .eq('workspace_id', workspace.workspaceId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (fallback.error?.code === '42P01') {
        return NextResponse.json({ gaps: [], total: 0, enabled: false })
      }
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }
      const rows = filterMissingKnowledgeRows((fallback.data ?? []) as KnowledgeGapRow[])
      return NextResponse.json({
        gaps: groupKnowledgeGaps(rows),
        total: rows.length,
        enabled: true,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = filterMissingKnowledgeRows((data ?? []) as KnowledgeGapRow[])
  return NextResponse.json({
    gaps: groupKnowledgeGaps(rows),
    language_breakdown: buildLanguageBreakdown(rows),
    total: rows.length,
    enabled: true,
  })
}

function filterMissingKnowledgeRows(rows: readonly KnowledgeGapRow[]): KnowledgeGapRow[] {
  const missingReasons = new Set([
    'no_relevant_knowledge',
    'no_active_knowledge',
    'model_fallback',
    'model_fallback_after_retry',
    'unsupported_claims_after_retry',
  ])
  return rows.filter((row) => {
    if (row.provider_status || row.provider_error_code || row.provider_error_type || row.provider_error_message) return false
    const category = row.failure_category ?? ''
    return category === 'missing_knowledge' || missingReasons.has(row.fallback_reason)
  })
}
