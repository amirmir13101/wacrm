"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Menu, X } from "lucide-react";

import { appHrefForHost, marketingHrefForHost } from "@/lib/domain-routing";

const homeNavItem = { label: "Home", href: "/" } as const;
const blogNavItem = { label: "Blog", href: "/blog" } as const;
const apiPricingNavItem = { label: "API Pricing", href: "/whatsapp-api-prices" } as const;
const pricingNavItem = { label: "Pricing", href: "/pricing" } as const;

const featureItems = [
  { label: "All Features", href: "/features" },
  { label: "Team Inbox", href: "/features/team-inbox" },
  { label: "Visual Flows", href: "/features/flows" },
  { label: "Automation", href: "/features/automation" },
  { label: "Broadcasts", href: "/features/broadcasts" },
] as const;

const useCaseItems = [
  { label: "WhatsApp Sales", href: "/use-cases/sales" },
  { label: "WhatsApp Newsletter", href: "/use-cases/newsletter" },
] as const;

const comparisonItems = [
  { label: "WATI Alternative", href: "/wati-alternative" },
] as const;

const trustItems = ["Team Inbox", "Flows", "Automation", "Broadcasts", "Secure Workspaces"];

type DesktopDropdownId = "features" | "use-cases" | "compare";
type MobileGroupId = DesktopDropdownId;

const desktopDropdowns = [
  { id: "features", label: "Features", items: featureItems },
  { id: "use-cases", label: "Use Cases", items: useCaseItems },
  { id: "compare", label: "Compare", items: comparisonItems },
] as const;

const orderedDesktopNavItems = [
  { type: "link", item: homeNavItem },
  { type: "dropdown", dropdown: desktopDropdowns[0] },
  { type: "dropdown", dropdown: desktopDropdowns[1] },
  { type: "dropdown", dropdown: desktopDropdowns[2] },
  { type: "link", item: blogNavItem },
  { type: "link", item: apiPricingNavItem },
  { type: "link", item: pricingNavItem },
] as const;

const orderedMobileNavItems = orderedDesktopNavItems;

interface PublicHeaderProps {
  readonly active?:
    | "home"
    | "features"
    | "flows"
    | "team-inbox"
    | "automation"
    | "broadcasts"
    | "pricing"
    | "api-pricing"
    | "blog";
}

export function PublicHeader({ active }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDesktopDropdown, setOpenDesktopDropdown] = useState<DesktopDropdownId | null>(null);
  const [openMobileGroups, setOpenMobileGroups] = useState<ReadonlySet<MobileGroupId>>(
    () => new Set(["features"])
  );
  const [currentHost, setCurrentHost] = useState("");
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentHost(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !openDesktopDropdown) return;

    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
        setOpenDesktopDropdown(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setOpenDesktopDropdown(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen, openDesktopDropdown]);

  const isFeatureActive =
    active === "features" ||
    active === "flows" ||
    active === "team-inbox" ||
    active === "automation" ||
    active === "broadcasts";

  function isDropdownActive(id: DesktopDropdownId): boolean {
    if (id === "features") return isFeatureActive;
    return false;
  }

  function toggleMobileGroup(group: MobileGroupId) {
    setOpenMobileGroups((groups) => {
      const next = new Set(groups);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

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
        <div ref={headerRef} className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-8 xl:px-10">
          <div className="flex min-h-[72px] items-center justify-between gap-4 py-3 lg:min-h-[76px] lg:gap-6 lg:py-0">
            <Link
              href={marketingHrefForHost("/", currentHost)}
              onClick={() => {
                setMobileMenuOpen(false);
                setOpenDesktopDropdown(null);
              }}
              className="flex shrink-0 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#08bba4] sm:mr-4 lg:mr-5 xl:mr-6"
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
              <div className="flex items-center justify-center gap-1 rounded-full bg-[#f4fff9] px-2 py-2 ring-1 ring-[#dce9e2] xl:gap-1 2xl:gap-2">
                {orderedDesktopNavItems.map((entry) => {
                  if (entry.type === "link") {
                    const item = entry.item;
                    const isActive =
                      (active === "home" && item.href === "/") ||
                      (active === "pricing" && item.href === "/pricing") ||
                      (active === "api-pricing" && item.href === "/whatsapp-api-prices") ||
                      (active === "blog" && item.href === "/blog");

                    return (
                      <Link
                        key={item.label}
                        href={marketingHrefForHost(item.href, currentHost)}
                        onClick={() => setOpenDesktopDropdown(null)}
                        className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] 2xl:px-4 ${
                          isActive ? "bg-white text-[#08bba4] shadow-sm" : "text-[#07130e]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  const dropdown = entry.dropdown;
                  const dropdownId = `public-${dropdown.id}-menu`;
                  const isOpen = openDesktopDropdown === dropdown.id;
                  const isActive = isDropdownActive(dropdown.id);

                  return (
                    <div key={dropdown.id} className="relative">
                      <button
                        type="button"
                        className={`inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-bold transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] 2xl:px-4 ${
                          isActive || isOpen ? "bg-white text-[#08bba4] shadow-sm" : "text-[#07130e]"
                        }`}
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        aria-controls={dropdownId}
                        onClick={() =>
                          setOpenDesktopDropdown((open) => (open === dropdown.id ? null : dropdown.id))
                        }
                      >
                        {dropdown.label}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen ? (
                        <div
                          id={dropdownId}
                          role="menu"
                          className="absolute left-1/2 top-full z-40 mt-3 w-64 -translate-x-1/2 rounded-3xl border border-[#dce9e2] bg-white p-2 opacity-100 shadow-[0_22px_55px_rgba(7,19,14,0.16)]"
                        >
                          {dropdown.items.map((item) => (
                            <Link
                              key={item.href}
                              href={marketingHrefForHost(item.href, currentHost)}
                              role="menuitem"
                              onClick={() => setOpenDesktopDropdown(null)}
                              className="block whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-extrabold text-[#07130e] hover:bg-[#f4fff9] hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden shrink-0 items-center justify-center gap-2 xl:flex xl:gap-3">
              <a
                href={appHrefForHost("/login", currentHost)}
                className="inline-flex h-11 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold text-[#07130e] hover:bg-[#f4fff9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] sm:px-4"
              >
                Login
              </a>
              <a
                href={appHrefForHost("/signup", currentHost)}
                className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-[#181818] px-4 text-sm font-bold text-white hover:bg-[#ffbd29] hover:text-[#07130e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4] sm:px-6"
              >
                Start Free Trial
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
                {orderedMobileNavItems.map((entry) => {
                  if (entry.type === "link") {
                    const item = entry.item;

                    return (
                      <Link
                        key={item.label}
                        href={marketingHrefForHost(item.href, currentHost)}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-11 items-center justify-between rounded-2xl px-4 text-sm font-extrabold text-[#07130e] transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                      >
                        {item.label}
                        <span className="h-2 w-2 rounded-full bg-[#3ddf84]" aria-hidden="true" />
                      </Link>
                    );
                  }

                  const group = entry.dropdown;
                  const isOpen = openMobileGroups.has(group.id);
                  const groupId = `public-mobile-${group.id}-menu`;

                  return (
                    <div key={group.id} className="rounded-2xl bg-white/60 ring-1 ring-[#dce9e2]">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between rounded-2xl px-4 text-left text-sm font-extrabold text-[#07130e] transition-colors hover:bg-white hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                        aria-expanded={isOpen}
                        aria-controls={groupId}
                        onClick={() => toggleMobileGroup(group.id)}
                      >
                        <span className="whitespace-nowrap">{group.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen ? (
                        <div id={groupId} className="grid gap-1 px-2 pb-2">
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={marketingHrefForHost(item.href, currentHost)}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex min-h-10 items-center justify-between rounded-xl px-4 text-sm font-bold text-[#315249] transition-colors hover:bg-[#f4fff9] hover:text-[#08bba4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08bba4]"
                            >
                              {item.label}
                              <span className="h-1.5 w-1.5 rounded-full bg-[#3ddf84]" aria-hidden="true" />
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="grid gap-2 border-t border-[#dce9e2] pt-3">
                  {[
                    { label: "About", href: "/about" },
                    { label: "Contact", href: "/contact" },
                  ].map((item) => (
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
                </div>
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
