"use client"

import { useEffect, useMemo, useState } from "react"

import type { WorkspaceMemberOption } from "@/lib/team/assignment"
import {
  effectivePermissions,
  hasWorkspacePermission,
  type WorkspacePermission,
  type WorkspacePermissions,
} from "@/lib/team/permissions"

interface WorkspacePermissionState {
  workspace_id: string
  workspace_name?: string | null
  current_user_id: string
  current_role: string
  current_permissions?: WorkspacePermissions
  current_can_connect_own_whatsapp?: boolean
  current_contact_visibility?: string
  current_conversation_visibility?: string
  current_deal_visibility?: string
  can_manage_team: boolean
  members: WorkspaceMemberOption[]
  invitations?: unknown[]
  workspaces?: Array<{
    workspace_id: string
    workspace_name: string | null
    role: string
    status: string
    is_active: boolean
  }>
}

export function useWorkspacePermissions() {
  const [data, setData] = useState<WorkspacePermissionState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/team/members")
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load workspace permissions")
        return payload as WorkspacePermissionState
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subject = useMemo(
    () => ({
      role: data?.current_role,
      permissions: data?.current_permissions,
      can_connect_own_whatsapp: data?.current_can_connect_own_whatsapp,
    }),
    [data],
  )

  const permissions = useMemo(() => effectivePermissions(subject), [subject])

  return {
    data,
    loading,
    role: data?.current_role ?? null,
    permissions,
    has: (permission: WorkspacePermission) => hasWorkspacePermission(subject, permission),
    canManageTeam: data?.can_manage_team === true,
    workspaces: data?.workspaces ?? [],
    workspaceName: data?.workspace_name ?? null,
    workspaceId: data?.workspace_id ?? null,
    refresh: () =>
      fetch("/api/team/members")
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(payload?.error ?? "Failed to load workspace permissions")
          setData(payload as WorkspacePermissionState)
        })
        .catch(() => setData(null)),
  }
}
