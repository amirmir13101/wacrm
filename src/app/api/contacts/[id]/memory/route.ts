import { NextResponse } from 'next/server'

import { clearContactMemory } from '@/lib/ai/memory'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

interface RouteContext {
  readonly params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_contacts')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const contactId = (await context.params).id
  if (!await contactBelongsToWorkspace(contactId, workspace.workspaceId)) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const admin = supabaseAdmin()
  const [memory, recentSummaries] = await Promise.all([
    admin
      .from('ai_contact_memories')
      .select('contact_id, memory_summary, key_facts, topics_discussed, last_intent, sentiment, preferred_language, unresolved_questions, conversation_count, last_conversation_at, memory_enabled, updated_at')
      .eq('workspace_id', workspace.workspaceId)
      .eq('contact_id', contactId)
      .maybeSingle(),
    admin
      .from('ai_conversation_summaries')
      .select('id, summary, topics, intent, sentiment, resolved, unresolved_questions, key_facts_extracted, language_detected, summarized_at, created_at')
      .eq('workspace_id', workspace.workspaceId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    memory: memory.data ?? null,
    recentSummaries: recentSummaries.data ?? [],
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'edit_contacts')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const contactId = (await context.params).id
  if (!await contactBelongsToWorkspace(contactId, workspace.workspaceId)) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.memory_enabled !== 'boolean') {
    return NextResponse.json({ error: 'memory_enabled boolean is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('ai_contact_memories')
    .upsert({
      workspace_id: workspace.workspaceId,
      contact_id: contactId,
      memory_enabled: body.memory_enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,contact_id' })
    .select('contact_id, memory_summary, key_facts, topics_discussed, last_intent, sentiment, preferred_language, unresolved_questions, conversation_count, last_conversation_at, memory_enabled, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memory: data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'edit_contacts')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const contactId = (await context.params).id
  if (!await contactBelongsToWorkspace(contactId, workspace.workspaceId)) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  await clearContactMemory(workspace.workspaceId, contactId)
  return new NextResponse(null, { status: 204 })
}

async function contactBelongsToWorkspace(contactId: string, workspaceId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return Boolean(data)
}
