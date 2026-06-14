"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'
import type { WorkspacePermission } from '@/lib/team/permissions'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
  permission: WorkspacePermission
}

const ACTIONS: Action[] = [
  { label: 'New Contact', href: '/contacts', icon: UserPlus, tint: 'text-[#08bba4]', permission: 'create_contacts' },
  { label: 'New Deal', href: '/pipelines', icon: Briefcase, tint: 'text-[#3ddf84]', permission: 'create_deals' },
  { label: 'New Broadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-[#ffbd29]', permission: 'create_broadcasts' },
  { label: 'New Automation', href: '/automations/new', icon: Zap, tint: 'text-[#08bba4]', permission: 'create_automations' },
]

export function QuickActions() {
  const workspace = useWorkspacePermissions()
  const actions = ACTIONS.filter((action) => workspace.has(action.permission))
  if (actions.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-2xl border border-[#dce9e2] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(7,19,14,0.05)] transition-colors hover:border-[#3ddf84] hover:bg-[#f4fff9]"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#eafff3] ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-[#07130e]">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
