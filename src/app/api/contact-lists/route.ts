import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { visibleContactIds } from '@/lib/contacts/visibility'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

interface ContactListRow {
  id: string
  workspace_id: string
  created_by_user_id: string | null
  name: string
  is_system_default: boolean
  created_at: string
  updated_at: string
}

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_contacts')) {
    return NextResponse.json({ error: 'You cannot view contact lists' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const [listsResult, visibility] = await Promise.all([
    admin
      .from('contact_lists')
      .select('id, workspace_id, created_by_user_id, name, is_system_default, created_at, updated_at')
      .eq('workspace_id', workspace.workspaceId)
      .order('created_at', { ascending: false }),
    visibleContactIds(workspace),
  ])

  if (listsResult.error) {
    return NextResponse.json({ error: listsResult.error.message }, { status: 500 })
  }

  let contactsQuery = admin
    .from('contacts')
    .select('id, contact_list_id')
    .eq('workspace_id', workspace.workspaceId)

  if (visibility.kind === 'ids') {
    if (visibility.ids.length === 0) {
      return NextResponse.json({
        contact_lists: ((listsResult.data ?? []) as ContactListRow[]).map((list) => ({
          ...list,
          contact_count: 0,
        })),
      })
    }
    contactsQuery = contactsQuery.in('id', visibility.ids)
  }

  const contactsResult = await contactsQuery
  if (contactsResult.error) {
    return NextResponse.json({ error: contactsResult.error.message }, { status: 500 })
  }

  const counts = new Map<string, number>()
  for (const contact of (contactsResult.data ?? []) as Array<{
    id: string
    contact_list_id: string | null
  }>) {
    if (!contact.contact_list_id) continue
    counts.set(contact.contact_list_id, (counts.get(contact.contact_list_id) ?? 0) + 1)
  }

  return NextResponse.json({
    contact_lists: ((listsResult.data ?? []) as ContactListRow[]).map((list) => ({
      ...list,
      contact_count: counts.get(list.id) ?? 0,
    })),
  })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'create_contacts')) {
    return NextResponse.json({ error: 'You cannot create contact lists' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (!name) {
    return NextResponse.json({ error: 'Contact List Name is required' }, { status: 400 })
  }
  if (name.length > 120) {
    return NextResponse.json(
      { error: 'Contact List Name must be 120 characters or fewer' },
      { status: 400 },
    )
  }

  const admin = supabaseAdmin()
  const nameKey = name.toLocaleLowerCase('en-US')
  const existing = await findByNameKey(admin, workspace.workspaceId, nameKey)
  if (existing) {
    return NextResponse.json({ contact_list: existing, reused: true })
  }

  const { data, error } = await admin
    .from('contact_lists')
    .insert({
      workspace_id: workspace.workspaceId,
      created_by_user_id: workspace.userId,
      name,
      is_system_default: false,
    })
    .select('id, workspace_id, created_by_user_id, name, is_system_default, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      const concurrent = await findByNameKey(admin, workspace.workspaceId, nameKey)
      if (concurrent) {
        return NextResponse.json({ contact_list: concurrent, reused: true })
      }
      return NextResponse.json(
        { error: 'A contact list with this name already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ contact_list: data, reused: false }, { status: 201 })
}

async function findByNameKey(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string,
  nameKey: string,
) {
  const { data } = await admin
    .from('contact_lists')
    .select('id, workspace_id, created_by_user_id, name, is_system_default, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('name_key', nameKey)
    .maybeSingle()

  return data as ContactListRow | null
}
