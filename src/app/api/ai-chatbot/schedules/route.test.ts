import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const { requireCurrentWorkspace } = vi.hoisted(() => ({
  requireCurrentWorkspace: vi.fn(),
}))
vi.mock('@/lib/team/server', () => ({ requireCurrentWorkspace }))
vi.mock('@/lib/team/permissions', () => ({ hasWorkspacePermission: vi.fn(() => true) }))
vi.mock('@/lib/automations/admin-client', () => ({ supabaseAdmin: vi.fn() }))

import { GET } from './route'
import { calculateNextRunAt, parseScheduleFrequency } from '@/lib/ai/scrape-schedules'
import { normalizeWebsiteUrl } from '@/lib/ai/website-import'

describe('scrape schedule API', () => {
  it('returns 401 without an authenticated workspace', async () => {
    requireCurrentWorkspace.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' })
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('calculates daily and weekly next run times', () => {
    const from = new Date('2026-06-20T04:00:00.000Z')
    expect(calculateNextRunAt({ frequency: 'daily', hourUtc: 3 }, from)).toBe('2026-06-21T03:00:00.000Z')
    expect(calculateNextRunAt({ frequency: 'weekly', dayOfWeek: 1, hourUtc: 3 }, from)).toBe('2026-06-22T03:00:00.000Z')
  })

  it('rejects invalid frequencies and unsafe private URLs', () => {
    expect(parseScheduleFrequency('hourly')).toBeNull()
    expect(() => normalizeWebsiteUrl('http://localhost:3000')).toThrow('public website')
    expect(() => normalizeWebsiteUrl('http://192.168.1.10')).toThrow('public website')
  })

  it('contains workspace-scoped create, update, soft-delete, and duplicate protections', () => {
    const root = process.cwd()
    const createRoute = fs.readFileSync(path.join(root, 'src/app/api/ai-chatbot/schedules/route.ts'), 'utf8')
    const updateRoute = fs.readFileSync(path.join(root, 'src/app/api/ai-chatbot/schedules/[id]/route.ts'), 'utf8')
    expect(createRoute).toContain("eq('workspace_id', workspace.workspaceId)")
    expect(createRoute).toContain('An active schedule already exists for this URL.')
    expect(createRoute).toContain('calculateNextRunAt')
    expect(updateRoute).toContain('calculateNextRunAt')
    expect(updateRoute).toContain("update({ is_active: false, next_run_at: null })")
    expect(updateRoute).not.toContain('.delete()')
  })
})
