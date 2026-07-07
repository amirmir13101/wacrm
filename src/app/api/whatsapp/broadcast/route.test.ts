import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sharedStaticVariables } from './route'

describe('/api/whatsapp/broadcast compatibility route', () => {
  it('does not import direct Meta sending helpers', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).not.toContain('sendTemplateMessage')
    expect(source).not.toContain("from '@/lib/whatsapp/meta-api'")
    expect(source).toContain("status: 'queued'")
    expect(source).toContain('broadcast_recipients')
  })

  it('enforces server-side preflight rules before queueing', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).toContain('buildBroadcastPreflightSummary')
    expect(source).toContain('preflight.blockers.length')
    expect(source).toContain('acknowledge_billing')
    expect(source).toContain('acknowledge_missing_pricing')
    expect(source).toContain('evaluateBroadcastRecipients')
  })

  it('does not consume monthly broadcast quota while messages are only queued', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).not.toContain('reserveWorkspaceBroadcastUsage')
    expect(source).not.toContain('releaseWorkspaceBroadcastUsage')
    expect(source).not.toContain('count: eligibleContacts.length')
    expect(source).toContain("status: 'queued'")
  })

  it('reserves monthly broadcast quota from the worker one sent message at a time', () => {
    const workerSource = readFileSync(
      join(process.cwd(), 'src/app/api/whatsapp/broadcast/worker/route.ts'),
      'utf8',
    )

    expect(workerSource).toContain('reserveWorkspaceBroadcastUsage')
    expect(workerSource).toContain('releaseWorkspaceBroadcastUsage')
    expect(workerSource).toContain('count: 1')
    expect(workerSource.indexOf('const usageReservation = await reserveWorkspaceBroadcastUsage')).toBeLessThan(
      workerSource.indexOf('return await sendQueuedTemplateRecipient'),
    )
    expect(workerSource.indexOf('await releaseWorkspaceBroadcastUsage')).toBeLessThan(
      workerSource.indexOf('error_message: result.error'),
    )
  })

  it('loads shared admin-managed pricing rates for preflight estimates', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).toContain('supabaseAdmin()')
    expect(source).toContain('dedupeSharedPricingRates')
    expect(source).toContain('fetchPricingRates()')
  })

  it('converts shared raw params into queued static template variables', () => {
    expect(
      sharedStaticVariables([
        { phone: '+923001234567', params: ['Hello', 'Gold'] },
        { phone: '+14155552671', params: ['Hello', 'Gold'] },
      ]),
    ).toEqual({
      '1': { type: 'static', value: 'Hello' },
      '2': { type: 'static', value: 'Gold' },
    })
  })

  it('rejects raw per-recipient params so callers cannot bypass queued personalization rules', () => {
    expect(() =>
      sharedStaticVariables([
        { phone: '+923001234567', params: ['Ada'] },
        { phone: '+14155552671', params: ['Grace'] },
      ]),
    ).toThrow(/do not support different raw template_params/)
  })
})
