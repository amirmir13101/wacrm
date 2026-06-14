import { NextResponse } from 'next/server'

import { getWorkspaceTrialStatus } from '@/lib/billing/trial'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  try {
    const trial = await getWorkspaceTrialStatus(workspaceResult.workspace.workspaceId)
    return NextResponse.json({ trial })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load trial status' },
      { status: 500 },
    )
  }
}
