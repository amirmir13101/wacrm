import { NextResponse } from 'next/server'

import { chunkKnowledgeText, type AiKnowledgeSourceType } from '@/lib/ai/chatbot'
import { buildChunkSearchMetadata } from '@/lib/ai/retrieval'
import {
  MAX_IMPORTED_WEBSITE_KNOWLEDGE_CONTENT_LENGTH,
  MAX_MANUAL_KNOWLEDGE_CONTENT_LENGTH,
} from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

const SOURCE_TYPES = new Set(['manual', 'faq', 'instructions', 'website'])

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot knowledge' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Knowledge source id is required.' }, { status: 400 })
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
    .update({
      source_type: sourceType,
      title,
      content,
      status: 'active',
    })
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .select('*')
    .maybeSingle()

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 })
  }
  if (!source) {
    return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
  }

  const { error: deleteChunksError } = await admin
    .from('ai_knowledge_chunks')
    .delete()
    .eq('source_id', id)
    .eq('workspace_id', workspace.workspaceId)

  if (deleteChunksError) {
    return NextResponse.json({ error: deleteChunksError.message }, { status: 500 })
  }

  const chunks = chunkKnowledgeText(content)
  if (chunks.length > 0) {
    const { error: chunksError } = await admin.from('ai_knowledge_chunks').insert(
      chunks.map((chunk, index) => ({
        ...chunkSearchRow(chunk, index, title),
        workspace_id: workspace.workspaceId,
        source_id: id,
        chunk_text: chunk,
      })),
    )
    if (chunksError) {
      return NextResponse.json({ error: chunksError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ source })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot knowledge' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Knowledge source id is required.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('ai_knowledge_sources')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function readLimitedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, maxLength)
}

function chunkSearchRow(chunk: string, index: number, title: string) {
  const metadata = buildChunkSearchMetadata(chunk, index)
  return {
    search_text: chunk,
    content_hash: metadata.content_hash,
    token_count: metadata.token_count,
    source_url: metadata.source_url,
    heading_path: title,
    chunk_index: index,
    structured_facts: metadata.structured_facts,
    embedding_status: 'pending',
    metadata: { title, index, ...metadata },
  }
}
