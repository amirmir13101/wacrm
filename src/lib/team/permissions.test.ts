import { describe, expect, it } from 'vitest'

import {
  canAccessDashboardPath,
  effectivePermissions,
  hasWorkspacePermission,
} from './permissions'

describe('workspace permissions', () => {
  it('gives owners full workspace CRM access', () => {
    expect(hasWorkspacePermission({ role: 'owner' }, 'manage_whatsapp_config')).toBe(true)
    expect(hasWorkspacePermission({ role: 'owner' }, 'manage_pricing_rates')).toBe(true)
    expect(canAccessDashboardPath({ role: 'owner' }, '/broadcasts')).toBe(true)
  })

  it('keeps agents limited by default', () => {
    expect(hasWorkspacePermission({ role: 'agent' }, 'view_inbox')).toBe(true)
    expect(hasWorkspacePermission({ role: 'agent' }, 'reply_to_conversations')).toBe(true)
    expect(hasWorkspacePermission({ role: 'agent' }, 'manage_whatsapp_config')).toBe(false)
    expect(hasWorkspacePermission({ role: 'agent' }, 'view_broadcasts')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/broadcasts')).toBe(false)
  })

  it('lets explicit permission overrides grant or deny feature access', () => {
    const permissions = effectivePermissions({
      role: 'agent',
      permissions: {
        view_broadcasts: true,
        reply_to_conversations: false,
      },
    })

    expect(permissions.view_broadcasts).toBe(true)
    expect(permissions.reply_to_conversations).toBe(false)
  })

  it('maps can_connect_own_whatsapp into the permission set', () => {
    expect(
      hasWorkspacePermission(
        { role: 'agent', can_connect_own_whatsapp: true },
        'connect_own_whatsapp_config',
      ),
    ).toBe(true)
  })
})

