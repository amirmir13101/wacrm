import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Flows cron deployment safety', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/flows/cron/route.ts'), 'utf8')
  const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8')

  it('validates the shared cron secret in the route using constant-time comparison', () => {
    expect(route).toContain('AUTOMATION_CRON_SECRET')
    expect(route).toContain('timingSafeEqual')
    expect(route).toContain("status: 401")
  })

  it('allows only secret-authenticated scheduler requests through middleware', () => {
    expect(middleware).toContain('isCronProtectedFlows')
    expect(middleware).toContain("request.headers.get('x-cron-secret')")
    expect(middleware).toContain('!isCronProtectedFlows')
  })

  it('documents all three required production job endpoints without a real secret', () => {
    expect(readme).toContain('/api/whatsapp/broadcast/worker')
    expect(readme).toContain('/api/automations/cron')
    expect(readme).toContain('/api/flows/cron')
    expect(readme).toContain('${AUTOMATION_CRON_SECRET}')
  })
})
