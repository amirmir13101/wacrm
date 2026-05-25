import { describe, expect, it } from 'vitest'

import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  applyPermissionPreset,
  enabledCount,
  setGroupPermissions,
} from './permission-ui'
import { WORKSPACE_PERMISSIONS, defaultPermissionsForRole } from './permissions'

describe('team permission UI helpers', () => {
  it('defines clear grouped permission sections', () => {
    const titles = PERMISSION_GROUPS.map((group) => group.title)

    expect(titles).toContain('Inbox')
    expect(titles).toContain('Contacts')
    expect(titles).toContain('Broadcasts')
    expect(titles).toContain('WhatsApp API')
    expect(PERMISSION_GROUPS.every((group) => group.items.length > 0)).toBe(true)
  })

  it('marks dangerous permissions clearly', () => {
    const dangerous = PERMISSION_GROUPS.flatMap((group) =>
      group.items.filter((item) => item.danger).map((item) => item.key),
    )

    expect(dangerous).toContain('delete_contacts')
    expect(dangerous).toContain('export_contacts')
    expect(dangerous).toContain('manage_whatsapp_config')
    expect(dangerous).toContain('manage_pricing_rates')
    expect(dangerous).toContain('manage_team_members')
  })

  it('counts enabled permissions in a group', () => {
    const inbox = PERMISSION_GROUPS.find((group) => group.id === 'inbox')
    expect(inbox).toBeDefined()

    expect(
      enabledCount(
        { view_inbox: true, reply_to_conversations: true },
        inbox!,
      ),
    ).toBe(2)
  })

  it('can select all and clear a group', () => {
    const contacts = PERMISSION_GROUPS.find((group) => group.id === 'contacts')!
    const selected = setGroupPermissions({}, contacts, true)
    const cleared = setGroupPermissions(selected, contacts, false)

    expect(contacts.items.every((item) => selected[item.key] === true)).toBe(true)
    expect(contacts.items.every((item) => cleared[item.key] === false)).toBe(true)
  })

  it('keeps normal agent preset limited', () => {
    const preset = applyPermissionPreset('agent_basic')

    expect(preset.permissions.view_inbox).toBe(true)
    expect(preset.permissions.view_broadcasts).not.toBe(true)
    expect(preset.permissions.manage_whatsapp_config).not.toBe(true)
    expect(preset.canConnectOwnWhatsapp).toBe(false)
  })

  it('manager preset matches manager defaults', () => {
    const preset = applyPermissionPreset('manager')
    const manager = defaultPermissionsForRole('manager')

    expect(preset.permissions.assign_conversations).toBe(manager.assign_conversations)
    expect(preset.permissions.queue_broadcasts).toBe(manager.queue_broadcasts)
    expect(preset.permissions.manage_pricing_rates).not.toBe(true)
  })

  it('full access preset enables every workspace permission', () => {
    const preset = ROLE_PRESETS.find((item) => item.id === 'full_access')!

    expect(WORKSPACE_PERMISSIONS.every((permission) => preset.permissions[permission] === true)).toBe(true)
  })
})
