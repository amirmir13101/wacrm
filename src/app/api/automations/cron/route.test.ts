import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dueRows: [] as Record<string, unknown>[],
  claimRow: { id: 'pending-1' } as Record<string, unknown> | null,
  resumePendingExecution: vi.fn(),
}))

vi.mock('@/lib/automations/engine', () => ({
  resumePendingExecution: mocks.resumePendingExecution,
}))

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== 'automation_pending_executions') {
        throw new Error(`unexpected table: ${table}`)
      }
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(async () => ({ data: mocks.dueRows, error: null })),
        update: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: mocks.claimRow, error: null })),
      }
      return query
    },
  }),
}))

describe('/api/automations/cron', () => {
  afterEach(() => {
    delete process.env.AUTOMATION_CRON_SECRET
    mocks.dueRows = []
    mocks.claimRow = { id: 'pending-1' }
    mocks.resumePendingExecution.mockReset()
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
    expect(body).toEqual({ processed: 1 })
    expect(mocks.resumePendingExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pending-1',
        automation_id: 'automation-1',
        next_step_position: 2,
      }),
    )
  })
})
