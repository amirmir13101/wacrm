"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { appHrefForHost, marketingHrefForHost } from "@/lib/domain-routing";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Flows", href: "/features/flows" },
  { label: "Team Inbox", href: "/features/team-inbox" },
  { label: "Automation", href: "/features/automation" },
  { label: "Broadcasts", href: "/features/broadcasts" },
  { label: "Pricing", href: "/pricing" },
] as const;

const useCaseItems = [
  { label: "WhatsApp Sales", href: "/use-cases/sales" },
  { label: "WhatsApp Newsletter", href: "/use-cases/newsletter" },
] as const;

const comparisonItems = [
  { label: "WATI Alternative", href: "/wati-alternative" },
] as const;

const mobileNavItems = [
  ...navItems,
  ...useCaseItems,
  ...comparisonItems,
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

const trustItems = ["Team Inbox", "Flows", "Automation", "Broadcasts", "Secure Workspaces"];

interface PublicHeaderProps {
  readonly active?:
    | "home"
    | "features"
    | "flows"
    | "team-inbox"
    | "automation"
    | "broadcasts"
    | "pricing";
}

export function PublicHeader({ active }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentHost, setCurrentHost] = useState("");
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentHost(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="relative z-30">
      <div className="hidden bg-[#0d1b15] text-white lg:block">
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
        <div ref={mobileMenuRef} className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-8 xl:px-10">
          <div className="flex min-h-[72px] items-center justify-between gap-4 py-3 lg:min-h-[76px] lg:gap-6 lg:py-0">
            <Link
              href={marketingHrefForHost("/", currentHost)}
              onClick={() => setMobileMenuOpen(false)}
              className="flex shrink-0 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#08bba4] sm:mr-4 lg:translate-x-12 lg:mr-8 xl:mr-10"
              aria-label="Talk Wagon home"
            >
              <Image
                src="/hostiko-crm/brand/talk-wagon-logo-public.webp"
                alt="Talk Wagon CRM logo"
                width={520}
                height={79}
                priority={active === "home"}
                className="h-8 w-auto max-w-[190px] object-contain sm:h-9 sm:max-w-[240px] lg:h-10 lg:max-w-[265px]"
              />
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="flex items-center justify-center gap-1 rounded-full bg-[#f4fff9] px-2 py-2 ring-1 ring-[#dce9e2] xl:gap-2">
                {navItems.map((item) => {
                  const isActive =
                    (active === "home" && item.href === "/") ||
                    (active === "features" && item.href === "/features") ||
                    (active === "flows" && item.href === "/features/flows") ||
                    (active === "team-inbox" && item.href === "/features/team-inbox") ||
                    (active === "automation" && item.href === "/features/automation") ||
                    (active === "broadcasts" && item.href === "/features/broadcasts") ||
                    (active === "pricing" && item.href === "/pricing");

                  return (
                    <Link
                      key={item.label}
                      href={marketingHrefForHost(item.href, currentHost)}
                      className={`inline-flex h-10 items-center rounded-full px-3 text-sm font-bold transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] xl:px-4 ${
                        isActive ? "bg-white text-[#08bba4] shadow-sm" : "text-[#07130e]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#07130e] transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] xl:px-4"
                    aria-haspopup="true"
                  >
                    Use Cases
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <div className="invisible absolute left-1/2 top-full z-40 mt-3 w-56 -translate-x-1/2 rounded-3xl border border-[#dce9e2] bg-white p-2 opacity-0 shadow-[0_22px_55px_rgba(7,19,14,0.16)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    {useCaseItems.map((item) => (
                      <Link
                        key={item.href}
                        href={marketingHrefForHost(item.href, currentHost)}
                        className="block rounded-2xl px-4 py-3 text-sm font-extrabold text-[#07130e] hover:bg-[#f4fff9] hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
                {comparisonItems.map((item) => (
                  <Link
                    key={item.label}
                    href={marketingHrefForHost(item.href, currentHost)}
                    className="inline-flex h-10 items-center rounded-full px-3 text-sm font-bold text-[#07130e] transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] xl:px-4"
                  >
                    Compare
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center gap-2 xl:flex xl:gap-3">
              <a
                href={appHrefForHost("/login", currentHost)}
                className="inline-flex h-11 items-center rounded-full px-3 text-sm font-bold text-[#07130e] hover:bg-[#f4fff9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] sm:px-4"
              >
                Login
              </a>
              <a href={appHrefForHost("/signup", currentHost)}>
                <Button className="h-11 rounded-full bg-[#181818] px-4 text-sm font-bold text-white hover:bg-[#ffbd29] hover:text-[#07130e] sm:px-6">
                  Start Free Trial
                </Button>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#07130e] text-white shadow-[0_12px_26px_rgba(7,19,14,0.18)] transition-colors hover:bg-[#143326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] xl:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-menu"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          {mobileMenuOpen ? (
            <div
              id="public-mobile-menu"
              className="border-t border-[#e6f0eb] pb-4 xl:hidden"
            >
              <div className="mt-3 grid gap-2 rounded-[26px] bg-[#f4fff9] p-3 ring-1 ring-[#dce9e2]">
                {mobileNavItems.map((item) => (
                  <Link
                    key={item.label}
                    href={marketingHrefForHost(item.href, currentHost)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 items-center justify-between rounded-2xl px-4 text-sm font-extrabold text-[#07130e] transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                  >
                    {item.label}
                    <span className="h-2 w-2 rounded-full bg-[#3ddf84]" aria-hidden="true" />
                  </Link>
                ))}
                <div className="mt-2 grid gap-2 border-t border-[#dce9e2] pt-3">
                  <a
                    href={appHrefForHost("/login", currentHost)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[#07130e] bg-white px-4 text-sm font-extrabold text-[#07130e] hover:bg-[#07130e] hover:text-white"
                  >
                    Login
                  </a>
                  <a
                    href={appHrefForHost("/signup", currentHost)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#07130e] px-4 text-sm font-extrabold text-white hover:bg-[#ffbd29] hover:text-[#07130e]"
                  >
                    Start Free Trial
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
