import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard billing lock UI', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8')
  const trialCard = readFileSync(join(process.cwd(), 'src/components/billing/trial-usage-card.tsx'), 'utf8')

  it('shows an upgrade state for expired Trial, expired Pro, and hosted-inactive Lifetime setup', () => {
    expect(source).toContain('planStatus?.isTrialExpired')
    expect(source).toContain('planStatus?.isProExpired')
    expect(source).toContain('planStatus?.isLifetimeSetup')
    expect(source).toContain('Upgrade required')
    expect(source).toContain('CRM features are locked')
    expect(source).toContain('href="/checkout/pro"')
  })

  it('keeps the plan card as the dashboard source of plan status', () => {
    expect(source).toContain('<TrialUsageCard onStatus={setPlanStatus} />')
    expect(trialCard).toContain('onStatus?: (trial: WorkspaceTrialStatus) => void')
    expect(trialCard).toContain('onStatus?.(nextTrial)')
  })
})
