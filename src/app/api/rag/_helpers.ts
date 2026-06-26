import { NextResponse } from 'next/server'

import type { WorkspacePermission } from '@/lib/team/permissions'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function requireRagPermission(permission: WorkspacePermission) {
  const result = await requireWorkspacePermission(permission)
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: result.error }, { status: result.status }),
    }
  }

  return { ok: true as const, workspace: result.workspace }
}

export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Request failed.'
  if (/fetch failed|network|econnreset|etimedout|timeout/i.test(error.message)) {
    return 'The request could not complete right now. Please try again.'
  }
  return error.message || 'Request failed.'
}
