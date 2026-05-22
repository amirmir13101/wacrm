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
