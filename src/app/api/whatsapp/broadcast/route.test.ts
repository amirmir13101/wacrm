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

  it('queues broadcasts from the exact selected approved template record without defaulting language', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).toContain('templateId: body.template_id')
    expect(source).toContain('isApprovedTemplateStatus')
    expect(source).toContain('Selected template has no approved language')
    expect(source).toContain('templateName = template.name')
    expect(source).toContain('templateLanguage = template.language')
    expect(source).not.toContain("let templateLanguage = (body.template_language as string | undefined) ?? 'en_US'")
  })

  it('verifies the exact selected template pair against the connected Meta WABA before queueing', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/whatsapp/broadcast/route.ts'), 'utf8')

    expect(source).toContain('verifyTemplateExistsInConnectedMeta')
    expect(source).toContain('message_templates?limit=100&fields=id,name,language,status')
    expect(source).toContain('template.name === args.templateName')
    expect(source).toContain('template.language === args.language')
    expect(source).toContain('This template/language is not available in Meta anymore')
  })

  it('worker validates the exact queued template name and language before sending', () => {
    const workerSource = readFileSync(
      join(process.cwd(), 'src/app/api/whatsapp/broadcast/worker/route.ts'),
      'utf8',
    )

    expect(workerSource).toContain('row.broadcast.template_language')
    expect(workerSource).toContain(".eq('name', row.broadcast.template_name)")
    expect(workerSource).toContain(".eq('language', row.broadcast.template_language)")
    expect(workerSource).toContain('This template/language is not available in Meta anymore')
    expect(workerSource).not.toContain("row.broadcast.template_language || 'en_US'")
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

  it('refunds broadcast quota when Meta later marks an accepted broadcast message failed', () => {
    const webhookSource = readFileSync(
      join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
      'utf8',
    )

    expect(webhookSource).toContain("import { releaseWorkspaceBroadcastUsage } from '@/lib/billing/trial'")
    expect(webhookSource).toContain(".select('id, status, broadcast:broadcasts(workspace_id)')")
    expect(webhookSource).toContain("if (status.status === 'failed')")
    expect(webhookSource).toContain('await releaseWorkspaceBroadcastUsage({ workspaceId, count: 1 })')
    expect(webhookSource.indexOf("status.status === 'failed'")).toBeLessThan(
      webhookSource.indexOf('await releaseWorkspaceBroadcastUsage({ workspaceId, count: 1 })'),
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
