import Link from "next/link";

import { cn } from "@/lib/utils";

interface PublicCtaButtonsProps {
  readonly primaryLabel: string;
  readonly primaryHref: string;
  readonly secondaryLabel?: string;
  readonly secondaryHref?: string;
  readonly className?: string;
}

const baseButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-center text-sm font-extrabold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto";

export function PublicCtaButtons({
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  className,
}: PublicCtaButtonsProps) {
  const primaryIsAuthHref = primaryHref === "/login" || primaryHref === "/signup";
  const secondaryIsAuthHref = secondaryHref === "/login" || secondaryHref === "/signup";
  const PrimaryComponent = primaryIsAuthHref ? "a" : Link;
  const SecondaryComponent = secondaryIsAuthHref ? "a" : Link;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      <PrimaryComponent
        href={primaryHref}
        className={cn(
          baseButtonClass,
          "bg-[#07130e] text-white shadow-[0_14px_30px_rgba(7,19,14,0.18)] hover:bg-[#1b372b] focus-visible:outline-[#07130e]",
        )}
      >
        {primaryLabel}
      </PrimaryComponent>
      {secondaryLabel && secondaryHref ? (
        <SecondaryComponent
          href={secondaryHref}
          className={cn(
            baseButtonClass,
            "border-2 border-[#07130e] bg-white text-[#07130e] hover:bg-[#07130e] hover:text-white focus-visible:outline-[#07130e]",
          )}
        >
          {secondaryLabel}
        </SecondaryComponent>
      ) : null}
    </div>
  );
}
