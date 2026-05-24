import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dueRows: [] as Record<string, unknown>[],
  timeBasedRows: [] as Record<string, unknown>[],
  claimRow: { id: 'pending-1' } as Record<string, unknown> | null,
  timeBasedClaimRow: { id: 'automation-1' } as Record<string, unknown> | null,
  resumePendingExecution: vi.fn(),
  runAutomationsForTrigger: vi.fn(),
}))

vi.mock('@/lib/automations/engine', () => ({
  resumePendingExecution: mocks.resumePendingExecution,
  runAutomationsForTrigger: mocks.runAutomationsForTrigger,
}))

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== 'automation_pending_executions' && table !== 'automations') {
        throw new Error(`unexpected table: ${table}`)
      }
      const isAutomations = table === 'automations'
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(async () => ({
          data: isAutomations ? mocks.timeBasedRows : mocks.dueRows,
          error: null,
        })),
        update: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: isAutomations ? mocks.timeBasedClaimRow : mocks.claimRow,
          error: null,
        })),
      }
      return query
    },
  }),
}))

describe('/api/automations/cron', () => {
  afterEach(() => {
    delete process.env.AUTOMATION_CRON_SECRET
    mocks.dueRows = []
    mocks.timeBasedRows = []
    mocks.claimRow = { id: 'pending-1' }
    mocks.timeBasedClaimRow = { id: 'automation-1' }
    mocks.resumePendingExecution.mockReset()
    mocks.runAutomationsForTrigger.mockReset()
  })

  it('requires the cron secret', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'expected-secret'
    const { GET } = await import('./route')

    const res = await GET(new Request('http://test.local/api/automations/cron'))

    expect(res.status).toBe(401)
  })

  it('resumes a due wait step when cron runs with the correct secret', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'expected-secret'
    mocks.dueRows = [
      {
        id: 'pending-1',
        automation_id: 'automation-1',
        user_id: 'user-1',
        contact_id: 'contact-1',
        log_id: 'log-1',
        parent_step_id: null,
        branch: null,
        next_step_position: 2,
        context: { message_text: 'hello' },
      },
    ]
    const { GET } = await import('./route')

    const res = await GET(
      new Request('http://test.local/api/automations/cron', {
        headers: { 'x-cron-secret': 'expected-secret' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      processed: 1,
      wait_processed: 1,
      time_based_processed: 0,
    })
    expect(mocks.resumePendingExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pending-1',
        automation_id: 'automation-1',
        next_step_position: 2,
      }),
    )
  })

  it('starts a due time-based automation when cron runs', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'expected-secret'
    mocks.timeBasedRows = [
      {
        id: 'automation-1',
        user_id: 'user-1',
        trigger_config: { schedule: 'every 1 minutes' },
        last_scheduled_run_at: '2000-01-01T00:00:00.000Z',
      },
    ]
    const { GET } = await import('./route')

    const res = await GET(
      new Request('http://test.local/api/automations/cron', {
        headers: { 'x-cron-secret': 'expected-secret' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.time_based_processed).toBe(1)
    expect(mocks.runAutomationsForTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        automationId: 'automation-1',
        triggerType: 'time_based',
      }),
    )
  })
})
