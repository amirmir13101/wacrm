'use client'

interface BarChartProps {
  data: Array<Record<string, string | number>>
  index: string
  categories: string[]
  valueFormatter?: (value: number) => string
  showLegend?: boolean
  yAxisWidth?: number
  className?: string
  colors?: string[]
}

export function BarChart({
  data,
  index,
  categories,
  valueFormatter,
  className,
}: BarChartProps) {
  const category = categories[0]
  const max = Math.max(1, ...data.map((row) => Number(row[category] ?? 0)))

  return (
    <div className={className}>
      <div className="flex h-full items-end gap-2 rounded-md border border-border bg-muted/20 p-3">
        {data.map((row) => {
          const value = Number(row[category] ?? 0)
          const height = Math.max(4, Math.round((value / max) * 100))
          return (
            <div key={String(row[index])} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t bg-primary/80"
                style={{ height: `${height}%` }}
                title={valueFormatter ? valueFormatter(value) : String(value)}
              />
              <span className="max-w-full truncate text-[10px] text-muted-foreground">
                {String(row[index])}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
