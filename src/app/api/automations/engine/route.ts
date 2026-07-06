import { NextResponse } from 'next/server'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import type { AutomationTriggerType } from '@/types'
import { requireWorkspacePermission } from '@/lib/team/server'

/**
 * Manual trigger for testing or for external integrations that want
 * to fire automations. Auth is required — the caller's user_id is
 * used so RLS-safe data remains per-user.
 */
export async function POST(request: Request) {
  const workspaceResult = await requireWorkspacePermission('edit_automations')
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const body = await request.json().catch(() => null)
  if (!body?.trigger_type) {
    return NextResponse.json({ error: 'trigger_type required' }, { status: 400 })
  }

  await runAutomationsForTrigger({
    userId: workspaceResult.workspace.userId,
    workspaceId: workspaceResult.workspace.workspaceId,
    triggerType: body.trigger_type as AutomationTriggerType,
    contactId: body.contact_id ?? null,
    context: body.context ?? {},
  })

  return NextResponse.json({ ok: true })
}
