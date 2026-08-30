import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('middleware billing and workspace access gates', () => {
  const source = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

  it('protects dashboard-only features including flows and Knowledge Base pages', () => {
    expect(source).toContain("'/flows'")
    expect(source).toContain("'/knowledge-base'")
    expect(source).toContain('canAccessDashboardPath')
  })

  it('protects Knowledge Base and Flows API routes with auth, approval, permission, and billing checks', () => {
    expect(source).toContain("request.nextUrl.pathname.startsWith('/api/knowledge-base')")
    expect(source).toContain("request.nextUrl.pathname.startsWith('/api/flows')")
    expect(source).toContain('evaluateWorkspaceBillingAccess')
    expect(source).toContain("status: 402")
  })

  it('allows expired users to reach upgrade-safe paths instead of logging them out', () => {
    expect(source).toContain('isBillingLockAllowedPath')
    expect(source).toContain("url.searchParams.set('upgrade', 'required')")
    expect(source).toContain("pathname = '/dashboard'")
  })

  it('lets a valid cron secret reach each protected server-side job', () => {
    expect(source).toContain("request.nextUrl.pathname === '/api/whatsapp/broadcast/worker'")
    expect(source).toContain("request.nextUrl.pathname === '/api/automations/cron'")
    expect(source).toContain("request.nextUrl.pathname === '/api/flows/cron'")
    expect(source).toContain('!isCronProtectedFlows')
  })
})
