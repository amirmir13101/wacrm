import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('broadcast workspace control access', () => {
  const control = readFileSync(
    join(process.cwd(), 'src/app/api/whatsapp/broadcast/[id]/control/route.ts'),
    'utf8',
  )
  const retry = readFileSync(
    join(process.cwd(), 'src/app/api/whatsapp/broadcast/[id]/retry/route.ts'),
    'utf8',
  )
  const worker = readFileSync(
    join(process.cwd(), 'src/app/api/whatsapp/broadcast/worker/route.ts'),
    'utf8',
  )

  it('scopes pause, resume, and cancel to the active workspace permission', () => {
    expect(control).toContain("requireWorkspacePermission('pause_resume_cancel_broadcasts')")
    expect(control).toContain(".eq('workspace_id', workspaceId)")
    expect(control).not.toContain(".eq('user_id'")
  })

  it('scopes retries, template lookup, and WhatsApp configuration to the workspace', () => {
    expect(retry).toContain("requireWorkspacePermission('queue_broadcasts')")
    expect(retry).toContain(".eq('workspace_id', workspaceId)")
    expect(retry).toContain('findWorkspaceWhatsAppConfig')
    expect(retry).not.toContain(".eq('user_id', user.id)")
  })

  it('sends queued team broadcasts with the workspace template and configuration', () => {
    expect(worker).toContain('row.broadcast.workspace_id')
    expect(worker).toContain(".eq('workspace_id', workspaceId)")
    expect(worker).toContain('configByWorkspace')
    expect(worker).toContain('findWorkspaceWhatsAppConfig')
  })

  it('accepts normalized approved template statuses during worker send and retry', () => {
    expect(worker).toContain('APPROVED_TEMPLATE_STATUSES')
    expect(worker).toContain(".in('status', [...APPROVED_TEMPLATE_STATUSES])")
    expect(retry).toContain('APPROVED_TEMPLATE_STATUSES')
    expect(retry).toContain(".in('status', [...APPROVED_TEMPLATE_STATUSES])")
  })
})
