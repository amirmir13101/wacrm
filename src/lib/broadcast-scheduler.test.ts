import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scheduler = readFileSync(
  join(process.cwd(), 'src/workers/scrape-scheduler.ts'),
  'utf8',
)
const ecosystem = readFileSync(join(process.cwd(), 'ecosystem.config.js'), 'utf8')
const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8')

describe('PM2 CRM scheduler', () => {
  it('runs the broadcast, automations, and flows cron endpoints locally', () => {
    expect(scheduler).toContain('/api/whatsapp/broadcast/worker')
    expect(scheduler).toContain('/api/automations/cron')
    expect(scheduler).toContain('/api/flows/cron')
    expect(scheduler).toContain("method: 'POST'")
    expect(scheduler).toContain("method: 'GET'")
  })

  it('loads the cron secret from local env files without logging the secret', () => {
    expect(scheduler).toContain("loadEnv({ path: '.env.local'")
    expect(scheduler).toContain('AUTOMATION_CRON_SECRET')
    expect(scheduler).toContain("'x-cron-secret': secret")
    expect(scheduler).not.toContain('console.log(secret')
    expect(scheduler).not.toContain('console.info(secret')
    expect(scheduler).not.toContain('console.warn(secret')
    expect(scheduler).not.toContain('process.env.AUTOMATION_CRON_SECRET)')
  })

  it('is wired into the existing PM2 scheduler process', () => {
    expect(ecosystem).toContain("name: 'wacrm-scheduler'")
    expect(ecosystem).toContain("script: 'src/workers/scrape-scheduler.ts'")
    expect(ecosystem).toContain("node_args: '--import tsx'")
  })

  it('documents PM2 scheduler as the preferred production runner', () => {
    expect(readme).toContain('wacrm-scheduler')
    expect(readme).toContain('preferred production runner')
    expect(readme).toContain('/api/whatsapp/broadcast/worker')
    expect(readme).toContain('/api/automations/cron')
    expect(readme).toContain('/api/flows/cron')
    expect(readme).toContain('${AUTOMATION_CRON_SECRET}')
  })
})
