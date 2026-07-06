"use client"

import Link from 'next/link'
import { useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Inbox,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading: boolean
}

const PAGE_SIZES = [5, 10, 20, 50] as const
type PageSize = (typeof PAGE_SIZES)[number]

interface KindTheme {
  icon: ComponentType<{ className?: string }>
  /** Tailwind classes for the round icon badge + label color. */
  badge: string
}

const KIND_THEME: Record<ActivityKind, KindTheme> = {
  message: { icon: MessageSquare, badge: 'bg-[#123226] text-[#3ddf84]' },
  contact: { icon: UserPlus, badge: 'bg-[#123226] text-[#3ddf84]' },
  deal: { icon: Briefcase, badge: 'bg-[#123226] text-[#3ddf84]' },
  broadcast: { icon: Radio, badge: 'bg-[#ffbd29]/15 text-[#ffbd29]' },
  automation: { icon: Zap, badge: 'bg-[#123226] text-[#3ddf84]' },
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  // Start at 5 — a quick scan of the most recent events without
  // dominating vertical real estate. User expands explicitly via the
  // footer control when they want deeper history.
  const [pageSize, setPageSize] = useState<PageSize>(5)

  const totalLoaded = items?.length ?? 0
  const visible = items?.slice(0, pageSize) ?? []
  // A size option is "useful" if picking it would reveal rows the
  // smaller option doesn't already show. With PAGE_SIZES=[5,10,20,50]:
  // "10" is useful only once we've loaded ≥6 items, "20" once ≥11, etc.
  // The smallest option is always enabled.
  const isSizeUseful = (size: PageSize, i: number) =>
    i === 0 || totalLoaded > PAGE_SIZES[i - 1]

  return (
    <section className="rounded-2xl border border-[#3ddf84]/60 bg-[#0d1b15]/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-colors hover:border-[#3ddf84]/80">
      <header className="flex items-center justify-between border-b border-[#17402f] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        <Link
          href="/inbox"
          className="text-xs font-medium text-[#3ddf84] hover:text-[#ffbd29]"
        >
          View all →
        </Link>
      </header>

      {loading || !items ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={Inbox}
            title="No activity yet"
            hint="Activity from messages, deals, broadcasts, and automations will appear here."
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[#17402f]">
            {visible.map((it, i) => {
              const theme = KIND_THEME[it.kind]
              const Icon = theme.icon
              // Alternating row background for scanability — dark-theme
              // translation of the spec's white / #f9fafb stripes.
              const stripe = i % 2 === 0 ? 'bg-transparent' : 'bg-[#07130e]/45'
              const row = (
                <div className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={cn(
                      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                      theme.badge,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[#d8fff1]">
                    {it.text}
                  </span>
                  <span className="flex-shrink-0 text-xs text-[#8bb4a5] tabular-nums">
                    {relativeTime(it.at)}
                  </span>
                </div>
              )
              return (
                <li key={it.id} className={cn(stripe, 'transition-colors hover:bg-[#123226]')}>
                  {it.href ? (
                    <Link href={it.href} className="block">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
          <footer className="flex items-center justify-between border-t border-[#17402f] px-5 py-3 text-xs">
            <span className="text-[#8bb4a5] tabular-nums">
              Showing {visible.length} of {totalLoaded}
              {totalLoaded === 50 ? '+' : ''}
            </span>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-[#8bb4a5]">Show</span>
              {PAGE_SIZES.map((size, i) => {
                const disabled = !isSizeUseful(size, i)
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md px-2 py-1 font-medium tabular-nums transition-colors',
                      pageSize === size
                        ? 'bg-[#3ddf84] text-[#07130e]'
                        : 'text-[#b8cfc7] hover:bg-[#123226] hover:text-white',
                      disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-[#8bb4a5]',
                    )}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </footer>
        </>
      )}
    </section>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
