import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface TagSyncResult {
  tag_ids: string[]
  added_tag_ids: string[]
  removed_tag_ids: string[]
}

export function normalizeTagIds(tagIds: unknown): string[] {
  if (!Array.isArray(tagIds)) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const raw of tagIds) {
    if (typeof raw !== 'string') continue
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}

export function diffContactTagIds(existing: string[], desired: string[]) {
  const existingSet = new Set(existing)
  const desiredSet = new Set(desired)
  return {
    added: desired.filter((id) => !existingSet.has(id)),
    removed: existing.filter((id) => !desiredSet.has(id)),
  }
}

export async function syncContactTagsAndDispatch({
  contactId,
  desiredTagIds,
  workspaceId,
}: {
  contactId: string
  desiredTagIds: string[]
  workspaceId: string
}): Promise<TagSyncResult> {
  const admin = supabaseAdmin()
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .select('id, user_id, workspace_id')
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (contactError) throw new Error(contactError.message)
  if (!contact) throw new Error('Contact not found')

  const desired = normalizeTagIds(desiredTagIds)
  const { data: existingRows, error: existingError } = await admin
    .from('contact_tags')
    .select('tag_id')
    .eq('contact_id', contactId)

  if (existingError) throw new Error(existingError.message)

  const existing = normalizeTagIds((existingRows ?? []).map((row) => row.tag_id))
  const { added, removed } = diffContactTagIds(existing, desired)

  if (removed.length > 0) {
    const { error } = await admin
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .in('tag_id', removed)
    if (error) throw new Error(error.message)
  }

  if (added.length > 0) {
    const { error } = await admin.from('contact_tags').upsert(
      added.map((tagId) => ({ contact_id: contactId, tag_id: tagId })),
      { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
    )
    if (error) throw new Error(error.message)

    await dispatchTagAddedAutomations({
      userId: contact.user_id as string,
      workspaceId,
      contactId,
      tagIds: added,
    })
  }

  return {
    tag_ids: desired,
    added_tag_ids: added,
    removed_tag_ids: removed,
  }
}

async function dispatchTagAddedAutomations({
  userId,
  workspaceId,
  contactId,
  tagIds,
}: {
  userId: string
  workspaceId: string
  contactId: string
  tagIds: string[]
}) {
  const { data: tags } = await supabaseAdmin()
    .from('tags')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .in('id', tagIds)

  const tagNames = new Map(
    ((tags ?? []) as Array<{ id: string; name: string | null }>).map((tag) => [
      tag.id,
      tag.name ?? tag.id,
    ]),
  )

  await Promise.all(
    tagIds.map((tagId) =>
      runAutomationsForTrigger({
        userId,
        triggerType: 'tag_added',
        contactId,
        context: {
          workspace_id: workspaceId,
          tag_id: tagId,
          tag_name: tagNames.get(tagId) ?? tagId,
        },
      }),
    ),
  )
}

