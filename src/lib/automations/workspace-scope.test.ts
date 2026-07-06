import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('automation active workspace scope', () => {
  const routes = [
    'src/app/api/automations/route.ts',
    'src/app/api/automations/[id]/route.ts',
    'src/app/api/automations/[id]/duplicate/route.ts',
    'src/app/api/automations/[id]/logs/route.ts',
  ].map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
  const engine = readFileSync(join(process.cwd(), 'src/lib/automations/engine.ts'), 'utf8')
  const sender = readFileSync(join(process.cwd(), 'src/lib/automations/meta-send.ts'), 'utf8')

  it('resolves automation APIs through the active workspace helper', () => {
    for (const route of routes) {
      expect(route).toContain('requireWorkspacePermission')
    }
    expect(routes.every((route) =>
      route.includes(".eq('workspace_id', workspaceResult.workspace.workspaceId)"),
    )).toBe(true)
  })

  it('dispatches automations only inside the triggering workspace', () => {
    expect(engine).toContain('workspaceId: string')
    expect(engine).toContain(".eq('workspace_id', input.workspaceId)")
    expect(engine).not.toContain(".eq('user_id', input.userId)")
    expect(engine).toContain('requireAutomationWorkspaceId')
    expect(sender).toContain(".eq('workspace_id', input.workspaceId)")
    expect(sender).toContain('findWorkspaceWhatsAppConfig')
  })
})
