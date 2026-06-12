import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace, type CurrentWorkspace } from '@/lib/team/server'

const ALLOWED_PAGE_SIZES = [50, 100, 200] as const
const DEFAULT_PAGE_SIZE = 50

interface ContactListRow {
  id: string
  user_id: string
  workspace_id?: string | null
  phone: string
  name?: string | null
  email?: string | null
  company?: string | null
  avatar_url?: string | null
  whatsapp_opt_in?: boolean | null
  opt_in_source?: string | null
  opted_in_at?: string | null
  opted_out_at?: string | null
  opt_out_reason?: string | null
  last_consent_updated_at?: string | null
  consent_notes?: string | null
  created_at: string
  updated_at: string
}

interface ContactTagRow {
  contact_id: string
  tag_id: string
}

export async function GET(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  if (!hasWorkspacePermission(workspaceResult.workspace, 'view_contacts')) {
    return NextResponse.json({ error: 'You cannot view contacts' }, { status: 403 })
  }

  const url = new URL(request.url)
  const page = positiveInt(url.searchParams.get('page'), 1)
  const pageSize = parsePageSize(url.searchParams.get('pageSize'))
  const search = (url.searchParams.get('search') ?? '').trim()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const admin = supabaseAdmin()
  const visibility = await visibleContactIds(workspaceResult.workspace)

  let query = admin
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (visibility.kind === 'ids') {
    if (visibility.ids.length === 0) {
      return NextResponse.json({ contacts: [], total: 0, page, pageSize })
    }
    query = query.in('id', visibility.ids)
  }

  if (search) {
    const term = `%${escapeSearchTerm(search)}%`
    query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},company.ilike.${term}`)
  }

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const contacts = (data ?? []) as ContactListRow[]
  const contactIds = contacts.map((contact) => contact.id)
  const tagsByContact = await listTagsByContact(contactIds)

  return NextResponse.json({
    contacts: contacts.map((contact) => ({
      ...contact,
      tags: tagsByContact.get(contact.id) ?? [],
    })),
    total: count ?? 0,
    page,
    pageSize,
  })
}

export async function DELETE(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  if (!hasWorkspacePermission(workspaceResult.workspace, 'delete_contacts')) {
    return NextResponse.json({ error: 'You cannot delete contacts' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim()),
        ),
      )
    : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No contacts selected' }, { status: 400 })
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Delete at most 200 contacts at a time' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const visibility = await visibleContactIds(workspaceResult.workspace)
  const candidateIds =
    visibility.kind === 'all' ? ids : ids.filter((id) => visibility.ids.includes(id))

  if (candidateIds.length === 0) {
    return NextResponse.json({ deleted_count: 0, deleted_ids: [] })
  }

  const { data: ownedContacts, error: lookupError } = await admin
    .from('contacts')
    .select('id')
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .in('id', candidateIds)

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  const deleteIds = ((ownedContacts ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (deleteIds.length === 0) {
    return NextResponse.json({ deleted_count: 0, deleted_ids: [] })
  }

  const { error: deleteError } = await admin
    .from('contacts')
    .delete()
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .in('id', deleteIds)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deleted_count: deleteIds.length,
    deleted_ids: deleteIds,
  })
}

function parsePageSize(value: string | null): number {
  const parsed = positiveInt(value, DEFAULT_PAGE_SIZE)
  return ALLOWED_PAGE_SIZES.includes(parsed as (typeof ALLOWED_PAGE_SIZES)[number])
    ? parsed
    : DEFAULT_PAGE_SIZE
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeSearchTerm(value: string): string {
  return value.replace(/[%,]/g, '').slice(0, 100)
}

async function listTagsByContact(contactIds: string[]) {
  const tagsByContact = new Map<string, Array<{ id: string; name: string; color: string; created_at: string; user_id: string }>>()
  if (contactIds.length === 0) return tagsByContact

  const admin = supabaseAdmin()
  const { data: contactTags } = await admin
    .from('contact_tags')
    .select('contact_id, tag_id')
    .in('contact_id', contactIds)

  const rows = (contactTags ?? []) as ContactTagRow[]
  const tagIds = Array.from(new Set(rows.map((row) => row.tag_id)))
  if (tagIds.length === 0) return tagsByContact

  const { data: tags } = await admin
    .from('tags')
    .select('id, user_id, name, color, created_at')
    .in('id', tagIds)

  const tagsById = new Map(
    ((tags ?? []) as Array<{ id: string; name: string; color: string; created_at: string; user_id: string }>)
      .map((tag) => [tag.id, tag]),
  )

  for (const row of rows) {
    const tag = tagsById.get(row.tag_id)
    if (!tag) continue
    const current = tagsByContact.get(row.contact_id) ?? []
    current.push(tag)
    tagsByContact.set(row.contact_id, current)
  }

  return tagsByContact
}

async function visibleContactIds(
  workspace: CurrentWorkspace,
): Promise<{ kind: 'all' } | { kind: 'ids'; ids: string[] }> {
  if (
    workspace.contactVisibility === 'all' ||
    hasWorkspacePermission(workspace, 'view_all_contacts')
  ) {
    return { kind: 'all' }
  }

  if (
    workspace.contactVisibility === 'none' ||
    !hasWorkspacePermission(workspace, 'view_assigned_contacts')
  ) {
    return { kind: 'ids', ids: [] }
  }

  const admin = supabaseAdmin()
  const [conversationResult, profileResult] = await Promise.all([
    admin
      .from('conversations')
      .select('contact_id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('assigned_agent_id', workspace.userId)
      .not('contact_id', 'is', null),
    admin
      .from('profiles')
      .select('id')
      .eq('user_id', workspace.userId)
      .maybeSingle(),
  ])

  const contactIds = new Set<string>(
    ((conversationResult.data ?? []) as Array<{ contact_id: string | null }>)
      .map((row) => row.contact_id)
      .filter((id): id is string => Boolean(id)),
  )

  const profileId = (profileResult.data as { id?: string } | null)?.id
  if (profileId) {
    const { data: deals } = await admin
      .from('deals')
      .select('contact_id')
      .eq('workspace_id', workspace.workspaceId)
      .eq('assigned_to', profileId)
      .not('contact_id', 'is', null)

    for (const row of (deals ?? []) as Array<{ contact_id: string | null }>) {
      if (row.contact_id) contactIds.add(row.contact_id)
    }
  }

  return { kind: 'ids', ids: Array.from(contactIds) }
}
