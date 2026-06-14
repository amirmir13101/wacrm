import { cn } from '@/lib/utils'

/**
 * Shared skeleton primitive — a pulsing slate block sized to whatever
 * container it's dropped into. Used by every dashboard widget while
 * its data fetches.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[#dce9e2]', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[#dce9e2] bg-white p-5 shadow-[0_18px_45px_rgba(7,19,14,0.06)]',
        className,
      )}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  )
}
