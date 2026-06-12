import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface HeroBadgeRowProps {
  readonly items: readonly string[];
  readonly className?: string;
}

export function HeroBadgeRow({ items, className }: HeroBadgeRowProps) {
  return (
    <div
      className={cn(
        "mt-8 flex w-full flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 lg:justify-start",
        className,
      )}
      aria-label="Feature highlights"
    >
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex min-h-10 min-w-0 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold leading-none text-[#d8fff1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3ddf84]" aria-hidden="true" />
          <span className="whitespace-nowrap">{item}</span>
        </span>
      ))}
    </div>
  );
}
