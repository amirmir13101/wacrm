import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { mapWorkspaceRoleToAccountRole, hasMinRole, type AccountRole } from './roles'

export class UnauthorizedError extends Error {
  status = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getCurrentAccount() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    if (workspaceResult.status === 401) throw new UnauthorizedError(workspaceResult.error)
    throw new ForbiddenError(workspaceResult.error)
  }

  const supabase = await createClient()
  const { workspace } = workspaceResult
  const accountRole = mapWorkspaceRoleToAccountRole(workspace.role)

  return {
    supabase,
    userId: workspace.userId,
    accountId: workspace.workspaceId,
    accountRole,
    account: {
      id: workspace.workspaceId,
      name: workspace.workspaceName ?? 'Workspace',
    },
  }
}

export async function requireRole(minRole: AccountRole) {
  const context = await getCurrentAccount()
  if (!hasMinRole(context.accountRole, minRole)) {
    throw new ForbiddenError('Permission required')
  }
  return context
}

export function toErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return NextResponse.json({ error: message }, { status: 500 })
}
