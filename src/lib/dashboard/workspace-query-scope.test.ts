import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('dashboard workspace query scope', () => {
  const source = readFileSync(join(process.cwd(), 'src/lib/dashboard/queries.ts'), 'utf8')
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'),
    'utf8',
  )

  it('requires the active workspace for every dashboard aggregate', () => {
    expect(source).toContain('loadMetrics(db: DB, workspaceId: string)')
    expect(source).toContain('loadPipelineDonut(db: DB, workspaceId: string)')
    expect(source).toContain('loadResponseTime(db: DB, workspaceId: string)')
    expect(source).toContain(".eq('workspace_id', workspaceId)")
  })

  it('waits for and passes the selected workspace from the dashboard', () => {
    expect(page).toContain('if (!workspace.workspaceId) return')
    expect(page).toContain('loadMetrics(db, workspace.workspaceId)')
    expect(page).toContain('loadActivity(db, workspace.workspaceId, 50)')
  })
})
