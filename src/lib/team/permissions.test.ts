import { describe, expect, it } from 'vitest'

import {
  canDelegatePermissions,
  canManageWorkspaceRole,
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
    expect(hasWorkspacePermission({ role: 'agent' }, 'view_ai_agent')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/broadcasts')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/ai-agent')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/agents')).toBe(false)
  })

  it('allows managers and owners to use the separate AI Agent tab', () => {
    expect(hasWorkspacePermission({ role: 'manager' }, 'view_ai_agent')).toBe(true)
    expect(hasWorkspacePermission({ role: 'manager' }, 'manage_ai_agent')).toBe(true)
    expect(canAccessDashboardPath({ role: 'manager' }, '/ai-agent')).toBe(true)
    expect(canAccessDashboardPath({ role: 'manager' }, '/agents')).toBe(true)
    expect(canAccessDashboardPath({ role: 'owner' }, '/ai-agent')).toBe(true)
    expect(canAccessDashboardPath({ role: 'owner' }, '/agents')).toBe(true)
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

  it('separates platform admin pages from workspace owner dashboards', () => {
    expect(canAccessDashboardPath({ role: 'owner' }, '/team')).toBe(true)
    expect(canAccessDashboardPath({ role: 'owner' }, '/settings')).toBe(true)
    expect(canAccessDashboardPath({ role: 'agent' }, '/team')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/settings')).toBe(true)
  })

  it('allows pricing viewing without granting pricing edits', () => {
    expect(hasWorkspacePermission({ role: 'agent' }, 'view_pricing')).toBe(true)
    expect(hasWorkspacePermission({ role: 'agent' }, 'use_cost_calculator')).toBe(true)
    expect(hasWorkspacePermission({ role: 'agent' }, 'manage_pricing_rates')).toBe(false)
    expect(canAccessDashboardPath({ role: 'agent' }, '/whatsapp-api-pricing')).toBe(true)
    expect(canAccessDashboardPath({ role: 'agent', permissions: { view_pricing: false, use_cost_calculator: false } }, '/whatsapp-api-pricing')).toBe(false)
  })

  it('allows logged-in workspace members to view billing', () => {
    expect(canAccessDashboardPath({ role: 'agent' }, '/billing')).toBe(true)
    expect(canAccessDashboardPath({ role: 'agent', permissions: { view_dashboard: false } }, '/billing')).toBe(true)
  })

  it('prevents managers from granting admin or manager roles', () => {
    expect(canManageWorkspaceRole('manager', 'admin')).toBe(false)
    expect(canManageWorkspaceRole('manager', 'manager')).toBe(false)
    expect(canManageWorkspaceRole('manager', 'agent')).toBe(true)
  })

  it('lets owners manage lower workspace roles and admins manage lower roles only', () => {
    expect(canManageWorkspaceRole('owner', 'admin')).toBe(true)
    expect(canManageWorkspaceRole('owner', 'owner')).toBe(false)
    expect(canManageWorkspaceRole('admin', 'manager')).toBe(true)
    expect(canManageWorkspaceRole('admin', 'admin')).toBe(false)
  })

  it('only delegates known permissions already held by the actor', () => {
    const manager = { role: 'manager' as const }
    expect(canDelegatePermissions(manager, { view_inbox: true })).toBe(true)
    expect(canDelegatePermissions(manager, { manage_whatsapp_config: true })).toBe(false)
    expect(canDelegatePermissions(manager, { unknown_permission: true })).toBe(false)
    expect(canDelegatePermissions(manager, { view_inbox: 'yes' })).toBe(false)
  })
})
