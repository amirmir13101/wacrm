import { NextResponse } from 'next/server'

import type { WorkspacePermission } from '@/lib/team/permissions'
import { requireWorkspacePermission } from '@/lib/team/server'
import { getStarterRagSetupHelp } from '@/lib/starter-rag/config'
import { readableStarterRagError } from '@/lib/starter-rag/db'

export async function requireStarterRagPermission(permission: WorkspacePermission) {
  const result = await requireWorkspacePermission(permission)
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: result.error }, { status: result.status }),
    }
  }

  return { ok: true as const, workspace: result.workspace }
}

export function starterRagErrorResponse(error: unknown, status = 500) {
  return NextResponse.json(
    {
      error: readableStarterRagError(error),
      setupHelp: getStarterRagSetupHelp(),
    },
    { status },
  )
}
