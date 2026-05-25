import { describe, expect, it } from 'vitest'

import {
  resolveWhatsAppConfigScope,
  sanitizeWhatsAppConfigForClient,
} from './whatsapp-config-scope'

describe('whatsapp config permission scope', () => {
  it('lets owners manage the workspace WhatsApp config', () => {
    expect(resolveWhatsAppConfigScope({ role: 'owner' })).toBe('workspace')
  })

  it('keeps normal agents on the owner-managed workspace config without credential form access', () => {
    expect(
      resolveWhatsAppConfigScope({
        role: 'agent',
        permissions: { use_workspace_whatsapp_config: true },
      }),
    ).toBe('managed_by_owner')
  })

  it('scopes agents with own WhatsApp permission to their own config form', () => {
    expect(
      resolveWhatsAppConfigScope({
        role: 'agent',
        permissions: { connect_own_whatsapp_config: true },
        can_connect_own_whatsapp: true,
      }),
    ).toBe('own')
  })

  it('does not return encrypted tokens or verify tokens to the client', () => {
    const databaseRow = {
      id: 'cfg_1',
      phone_number_id: '123',
      waba_id: '456',
      status: 'connected',
      connected_at: '2026-05-25T00:00:00.000Z',
      access_token: 'encrypted-secret',
      verify_token: 'encrypted-verify',
    }
    const safe = sanitizeWhatsAppConfigForClient(databaseRow)

    expect(safe).toEqual({
      id: 'cfg_1',
      phone_number_id: '123',
      waba_id: '456',
      status: 'connected',
      connected_at: '2026-05-25T00:00:00.000Z',
    })
    expect(JSON.stringify(safe)).not.toContain('secret')
  })
})
