import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = () =>
  readFileSync(
    join(process.cwd(), 'supabase/migrations/023_workspace_permission_rls_hardening.sql'),
    'utf8',
  )

describe('workspace permission RLS hardening migration', () => {
  it('adds database permission helpers for workspace access checks', () => {
    const sql = migration()

    expect(sql).toContain('public.workspace_has_permission')
    expect(sql).toContain('public.can_view_workspace_conversation')
    expect(sql).toContain('public.can_view_workspace_contact')
    expect(sql).toContain('public.can_view_workspace_deal')
  })

  it('removes broad active-member policies from sensitive CRM tables', () => {
    const sql = migration()

    expect(sql).toContain('DROP POLICY IF EXISTS "Workspace members can manage contacts"')
    expect(sql).toContain('DROP POLICY IF EXISTS "Managers can manage whatsapp config"')
    expect(sql).toContain('DROP POLICY IF EXISTS "Workspace members can manage broadcasts"')
    expect(sql).toContain('DROP POLICY IF EXISTS "Workspace members can manage automations"')
  })

  it('keeps WhatsApp config secrets restricted to explicitly permitted members', () => {
    const sql = migration()

    expect(sql).toContain('Permitted members can view whatsapp config')
    expect(sql).toContain("public.workspace_has_permission(workspace_id, 'manage_whatsapp_config')")
    expect(sql).toContain("public.workspace_has_permission(workspace_id, 'connect_own_whatsapp_config')")
  })
})
