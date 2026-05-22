import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('broadcast worker run logging', () => {
  it('has a migration for durable worker run logs', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/013_broadcast_worker_runs.sql'),
      'utf8',
    )

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS broadcast_worker_runs')
    expect(migration).toContain('processed_count')
    expect(migration).toContain('sent_count')
    expect(migration).toContain('failed_count')
    expect(migration).toContain('skipped_count')
    expect(migration).toContain('error_message')
  })

  it('creates and completes worker logs from the worker route', () => {
    const worker = readFileSync(
      join(process.cwd(), 'src/app/api/whatsapp/broadcast/worker/route.ts'),
      'utf8',
    )

    expect(worker).toContain("from('broadcast_worker_runs')")
    expect(worker).toContain("status: 'running'")
    expect(worker).toContain('finished_at')
    expect(worker).toContain("status: 'completed'")
    expect(worker).toContain("status: 'failed'")
    expect(worker).toContain('Unknown worker send error')
  })
})
