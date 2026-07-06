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
            className="group flex items-center gap-3 rounded-2xl border border-[#3ddf84]/60 bg-[#0d1b15]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-colors hover:border-[#3ddf84]/80 hover:bg-[#123226]"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#123226] ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-white">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
