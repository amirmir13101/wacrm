import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const billingPage = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'),
  'utf8',
)
const billingTrial = readFileSync(join(process.cwd(), 'src/lib/billing/trial.ts'), 'utf8')
const billingRoute = readFileSync(
  join(process.cwd(), 'src/app/api/billing/trial/route.ts'),
  'utf8',
)

describe('Billing dashboard page', () => {
  it('loads workspace-scoped billing data from the existing billing endpoint', () => {
    expect(billingPage).toContain("fetch('/api/billing/trial')")
    expect(billingPage).toContain('WorkspaceTrialStatus')
  })

  it('shows plan, subscription, renewal, dates, and broadcast usage details', () => {
    expect(billingPage).toContain('Current plan')
    expect(billingPage).toContain('Subscription status')
    expect(billingPage).toContain('Next billing / renewal')
    expect(billingPage).toContain('Broadcast usage')
    expect(billingPage).toContain('Subscription start date')
    expect(billingPage).toContain('Subscription end date')
    expect(billingPage).toContain('Billing period')
    expect(billingPage).toContain('Manual payment status')
    expect(billingPage).toContain('Payment method')
  })

  it('does not hard-code fake billing values or manual payment values', () => {
    expect(billingPage).toContain('Not available yet')
    expect(billingPage).toContain('titleCase(trial.manualPaymentStatus)')
    expect(billingPage).toContain('titleCase(trial.manualPaymentMethod)')
    expect(billingPage).not.toContain('value="Not available yet"')
    expect(billingPage).not.toContain('Fake')
    expect(billingPage).not.toContain('Dummy')
  })

  it('reads real workspace billing dates and payment method fields from existing tables', () => {
    expect(billingTrial).toContain('subscription_started_at')
    expect(billingTrial).toContain('subscription_ends_at')
    expect(billingTrial).toContain('trial_started_at')
    expect(billingTrial).toContain('trial_ends_at')
    expect(billingTrial).toContain("from('manual_payment_requests')")
    expect(billingTrial).toContain("select('payment_method, status')")
    expect(billingTrial).toContain('.eq(\'workspace_id\', workspaceId)')
  })

  it('keeps billing access isolated to the current workspace endpoint', () => {
    expect(billingRoute).toContain('requireCurrentWorkspace()')
    expect(billingRoute).toContain('workspaceResult.workspace.workspaceId')
    expect(billingRoute).toContain('getWorkspaceTrialStatus')
  })
})
