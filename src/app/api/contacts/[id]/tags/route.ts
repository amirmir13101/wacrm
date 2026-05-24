import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { syncContactTagsAndDispatch } from '@/lib/contacts/tag-sync'
import { requireCurrentWorkspace } from '@/lib/team/server'

async function requireWorkspace() {
  const result = await requireCurrentWorkspace()
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: result.error }, { status: result.status }),
    }
  }
  return { ok: true as const, workspaceId: result.workspace.workspaceId }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspace = await requireWorkspace()
  if (!workspace.ok) return workspace.response
  const { id: contactId } = await params
  const body = await request.json().catch(() => ({}))
  const tagId = typeof body.tag_id === 'string' ? body.tag_id.trim() : ''
  if (!tagId) return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })

  try {
    const result = await syncContactTagsAndDispatch({
      contactId,
      desiredTagIds: await currentPlus(contactId, tagId, workspace.workspaceId),
      workspaceId: workspace.workspaceId,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update tags' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspace = await requireWorkspace()
  if (!workspace.ok) return workspace.response
  const { id: contactId } = await params
  const body = await request.json().catch(() => ({}))

  try {
    const result = await syncContactTagsAndDispatch({
      contactId,
      desiredTagIds: Array.isArray(body.tag_ids) ? body.tag_ids : [],
      workspaceId: workspace.workspaceId,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update tags' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspace = await requireWorkspace()
  if (!workspace.ok) return workspace.response
  const { id: contactId } = await params
  const body = await request.json().catch(() => ({}))
  const tagId = typeof body.tag_id === 'string' ? body.tag_id.trim() : ''
  if (!tagId) return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })

  try {
    const current = await currentTagIds(contactId, workspace.workspaceId)
    const result = await syncContactTagsAndDispatch({
      contactId,
      desiredTagIds: current.filter((id) => id !== tagId),
      workspaceId: workspace.workspaceId,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update tags' },
      { status: 500 },
    )
  }
}

async function currentPlus(contactId: string, tagId: string, workspaceId: string): Promise<string[]> {
  const current = await currentTagIds(contactId, workspaceId)
  return current.includes(tagId) ? current : [...current, tagId]
}

async function currentTagIds(contactId: string, workspaceId: string): Promise<string[]> {
  const admin = supabaseAdmin()
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (contactError) throw new Error(contactError.message)
  if (!contact) throw new Error('Contact not found')

  const { data, error } = await admin
    .from('contact_tags')
    .select('tag_id')
    .eq('contact_id', contactId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.tag_id as string)
}
