import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('contact lists', () => {
  it('creates a tenant-scoped list entity and safely backfills existing contacts', () => {
    const sql = source('supabase/migrations/072_contact_lists.sql')

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.contact_lists')
    expect(sql).toContain('workspace_id UUID NOT NULL REFERENCES public.workspaces(id)')
    expect(sql).toContain('uq_contact_lists_workspace_name')
    expect(sql).toContain("'Existing Contacts'")
    expect(sql).toContain('UPDATE public.contacts AS contact')
    expect(sql).toContain('CHECK (workspace_id IS NULL OR contact_list_id IS NOT NULL)')
    expect(sql).toContain('CREATE TRIGGER zz_assign_contact_list')
    expect(sql).toContain("name_key = 'existing contacts'")
    expect(sql).toContain('public.workspace_has_permission(workspace_id, \'view_contacts\')')
    expect(sql).not.toMatch(/DROP TABLE\s+(?:public\.)?contacts/i)
  })

  it('requires a list name and assigns every imported row to the resolved list', () => {
    const modal = source('src/components/contacts/import-modal.tsx')

    expect(modal).toContain('Contact List Name')
    expect(modal).toContain("fetch('/api/contact-lists'")
    expect(modal).toContain('contact_list_id: contactListId')
    expect(modal).toContain('disabled={!contactListName.trim()')
  })

  it('shows contact lists before contacts and scopes the contact API by list', () => {
    const page = source('src/app/(dashboard)/contacts/page.tsx')
    const route = source('src/app/api/contacts/route.ts')

    expect(page).toContain("if (!selectedListId)")
    expect(page).toContain('contactLists.map')
    expect(page).toContain('All Contact Lists')
    expect(route).toContain("url.searchParams.get('contactListId')")
    expect(route).toContain("query.eq('contact_list_id', contactListId)")
  })

  it('resolves broadcast list recipients with both workspace and list constraints', () => {
    const audience = source('src/components/broadcasts/step2-select-audience.tsx')
    const route = source('src/app/api/whatsapp/broadcast/route.ts')

    expect(audience).toContain("type: 'contact_list'")
    expect(audience).toContain('Which Contact List do you want to send this campaign to?')
    expect(route).toContain(".from('contact_lists')")
    expect(route).toContain(".eq('workspace_id', args.workspaceId)")
    expect(route).toContain(".eq('contact_list_id', args.audience.contactListId)")
    expect(route).toContain('Selected contact list was not found in this workspace.')
  })
})
