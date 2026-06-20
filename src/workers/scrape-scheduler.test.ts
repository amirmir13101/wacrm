import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  processDueSchedules,
  processMemoryRetentionCleanup,
  processSchedule,
  recoverStaleRuns,
  type DueSchedule,
  type SchedulerDependencies,
} from './scrape-scheduler'

const schedule: DueSchedule = {
  id: 'schedule-a',
  workspace_id: 'workspace-a',
  source_id: null,
  url: 'https://example.com/',
  frequency: 'daily',
  day_of_week: null,
  hour_utc: 3,
  auto_publish: false,
  page_limit: 50,
}

describe('scheduled scrape worker', () => {
  it('updates next run before starting and records missing keys safely', async () => {
    const fake = createFakeClient({ historyId: 'history-a' })
    await processSchedule(schedule, dependencies(fake.client, { resolveKey: vi.fn().mockResolvedValue(null) }))
    expect(fake.events.findIndex((event) => event.includes('next_run_at'))).toBeLessThan(
      fake.events.findIndex((event) => event.includes('ai_import_history:insert')),
    )
    expect(fake.events.some((event) => event.includes('firecrawl_key_missing'))).toBe(true)
    expect(fake.events.some((event) => event.includes('"next_run_at":null'))).toBe(true)
  })

  it('reschedules Firecrawl rate limits by six hours', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T00:00:00.000Z'))
    const fake = createFakeClient({ historyId: 'history-b' })
    await processSchedule(schedule, dependencies(fake.client, {
      resolveKey: vi.fn().mockResolvedValue('safe-key'),
      startCrawl: vi.fn().mockRejectedValue(new Error('Firecrawl returned 429 rate limit')),
    }))
    expect(fake.events.some((event) => event.includes('2026-06-20T06:00:00.000Z'))).toBe(true)
    vi.useRealTimers()
  })

  it('marks stale running history rows failed on startup', async () => {
    const fake = createFakeClient({ updatedRows: [{ id: 'stale-a' }] })
    const count = await recoverStaleRuns(fake.client, new Date('2026-06-20T03:00:00.000Z'))
    expect(count).toBe(1)
    expect(fake.events.some((event) => event.includes('worker_restart'))).toBe(true)
  })

  it('detects due schedules and isolates one workspace failure from another', async () => {
    const fake = createFakeClient({ dueSchedules: [schedule, { ...schedule, id: 'schedule-b', workspace_id: 'workspace-b' }] })
    const resolveKey = vi.fn(async (workspaceId: string) => workspaceId === 'workspace-a' ? null : null)
    await expect(processDueSchedules(dependencies(fake.client, { resolveKey }))).resolves.toBeUndefined()
    expect(resolveKey).toHaveBeenCalledWith('workspace-a')
    expect(resolveKey).toHaveBeenCalledWith('workspace-b')
  })

  it('cleans expired AI memory without deleting contacts or conversations', async () => {
    const fake = createFakeClient({
      providerSettings: [{ workspace_id: 'workspace-a', memory_retention_days: 30 }],
      updatedRows: [{ id: 'memory-a' }],
      deletedRows: [{ id: 'summary-a' }],
    })
    const result = await processMemoryRetentionCleanup(fake.client, new Date('2026-06-20T02:00:00.000Z'))

    expect(result).toEqual({ workspaceCount: 1, memoriesCleared: 1, summariesDeleted: 1 })
    expect(fake.events.some((event) => event.startsWith('contacts:delete'))).toBe(false)
    expect(fake.events.some((event) => event.startsWith('conversations:delete'))).toBe(false)
  })
})

function dependencies(
  client: SupabaseClient,
  overrides: Partial<SchedulerDependencies> = {},
): SchedulerDependencies {
  return {
    client,
    resolveKey: vi.fn().mockResolvedValue(null),
    startCrawl: vi.fn(),
    getStatus: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createFakeClient(options: {
  readonly historyId?: string
  readonly updatedRows?: readonly { readonly id: string }[]
  readonly deletedRows?: readonly { readonly id: string }[]
  readonly dueSchedules?: readonly DueSchedule[]
  readonly providerSettings?: readonly { readonly workspace_id: string; readonly memory_retention_days: number | null }[]
}) {
  const events: string[] = []
  const client = {
    from(table: string) {
      let operation = 'query'
      let payload: unknown = null
      const builder = {
        select() { events.push(`${table}:select`); return builder },
        insert(value: unknown) { operation = 'insert'; payload = value; events.push(`${table}:insert:${JSON.stringify(value)}`); return builder },
        update(value: unknown) { operation = 'update'; payload = value; events.push(`${table}:update:${JSON.stringify(value)}`); return builder },
        delete() { operation = 'delete'; events.push(`${table}:delete`); return builder },
        eq(column: string, value: unknown) { events.push(`${table}:eq:${column}:${String(value)}`); return builder },
        lt(column: string, value: unknown) { events.push(`${table}:lt:${column}:${String(value)}`); return builder },
        lte(column: string, value: unknown) { events.push(`${table}:lte:${column}:${String(value)}`); return builder },
        not(column: string, operator: string, value: unknown) { events.push(`${table}:not:${column}:${operator}:${String(value)}`); return builder },
        order() { return builder },
        limit() { return builder },
        single() {
          if (table === 'ai_import_history' && operation === 'insert') {
            return Promise.resolve({ data: { id: options.historyId ?? 'history' }, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          const data = table === 'ai_scrape_schedules' && operation === 'query'
            ? options.dueSchedules ?? []
            : table === 'ai_chatbot_provider_settings' && operation === 'query'
              ? options.providerSettings ?? []
            : table === 'ai_import_history' && operation === 'update'
              ? options.updatedRows ?? []
              : operation === 'update'
                ? options.updatedRows ?? []
                : operation === 'delete'
                  ? options.deletedRows ?? []
              : null
          return Promise.resolve({ data, error: null, payload }).then(resolve, reject)
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
  return { client, events }
}
