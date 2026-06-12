import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Team Inbox", href: "/features/team-inbox" },
  { label: "Automation", href: "/features/automation" },
  { label: "Broadcasts", href: "/features/broadcasts" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/features#faq" },
] as const;

const trustItems = ["Team Inbox", "Automation", "Broadcasts", "Secure Workspaces"];

interface PublicHeaderProps {
  readonly active?: "home" | "features" | "team-inbox" | "automation" | "broadcasts" | "pricing";
}

export function PublicHeader({ active }: PublicHeaderProps) {
  return (
    <header className="relative z-30">
      <div className="bg-[#0d1b15] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 text-xs sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p className="text-center text-[#d8fff1] lg:text-left">
            Production-ready WhatsApp CRM for sales, support, broadcasts, and AI automation.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-white/85 lg:justify-end">
            {trustItems.map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3ddf84]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <nav className="bg-white shadow-[0_12px_35px_rgba(7,19,14,0.08)]" aria-label="Public navigation">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-8 xl:px-10">
          <div className="flex min-h-[76px] items-center justify-between gap-5 lg:gap-6">
            <Link
              href="/"
              className="mr-4 flex shrink-0 translate-x-8 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#08bba4] sm:translate-x-10 lg:mr-8 lg:translate-x-12 xl:mr-10"
              aria-label="Talk Wagon home"
            >
              <Image
                src="/hostiko-crm/brand/talk-wagon-logo-public.webp"
                alt="Talk Wagon CRM logo"
                width={520}
                height={79}
                priority={active === "home"}
                className="h-8 w-auto max-w-[210px] object-contain sm:h-9 sm:max-w-[240px] lg:h-10 lg:max-w-[265px]"
              />
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
              <div className="flex items-center justify-center gap-1 rounded-full bg-[#f4fff9] px-2 py-2 ring-1 ring-[#dce9e2] xl:gap-2">
                {navItems.map((item) => {
                  const isActive =
                    (active === "home" && item.href === "/") ||
                    (active === "features" && item.href === "/features") ||
                    (active === "team-inbox" && item.href === "/features/team-inbox") ||
                    (active === "automation" && item.href === "/features/automation") ||
                    (active === "broadcasts" && item.href === "/features/broadcasts") ||
                    (active === "pricing" && item.href === "/pricing");

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`inline-flex h-10 items-center rounded-full px-3 text-sm font-bold transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] xl:px-4 ${
                        isActive ? "bg-white text-[#08bba4] shadow-sm" : "text-[#07130e]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full px-3 text-sm font-bold text-[#07130e] hover:bg-[#f4fff9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] sm:px-4"
              >
                Login
              </Link>
              <Link href="/signup">
                <Button className="h-11 rounded-full bg-[#181818] px-4 text-sm font-bold text-white hover:bg-[#ffbd29] hover:text-[#07130e] sm:px-6">
                  Start For Free
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#e6f0eb] py-3 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex h-9 items-center rounded-full bg-[#f4fff9] px-3 text-xs font-bold text-[#07130e] hover:bg-[#eafff3] hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
