"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu, Settings as SettingsIcon, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/inbox/ai-handoff": "AI Handoff",
  "/contacts": "Contacts",
  "/pipelines": "Pipelines",
  "/broadcasts": "Broadcasts",
  "/automations": "Automations",
  "/ai-agent": "AI Agent",
  "/agents": "AI Agent",
  "/knowledge-base": "Knowledge Base",
  "/settings": "Settings",
  "/admin": "Admin",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "Dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const title = getPageTitle(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#17402f] bg-[#07130e] px-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)] lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#c7ddd5] transition-colors hover:bg-[#123226] hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-white sm:text-lg">
          {title}
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-[#123226] focus:bg-[#123226] focus:outline-none data-popup-open:bg-[#123226] sm:gap-3 sm:pl-1 sm:pr-3"
          aria-label="Open account menu"
        >
          <Avatar className="size-8">
            {profile?.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name ?? "Avatar"}
              />
            ) : null}
            <AvatarFallback className="bg-[#3ddf84]/15 text-sm font-medium text-[#3ddf84]">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-white sm:inline">
            {profile?.full_name ?? "User"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 border-[#315846] bg-[#07130e] text-[#eafff3] ring-[#315846]"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-white">
              {profile?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs text-[#8bb4a5]">
              {profile?.email ?? ""}
            </p>
          </div>
          <DropdownMenuSeparator className="bg-[#17402f]" />
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=profile"
                className="text-[#d8fff1] focus:bg-[#123226] focus:text-white"
              />
            }
          >
            <User className="size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=whatsapp"
                className="text-[#d8fff1] focus:bg-[#123226] focus:text-white"
              />
            }
          >
            <SettingsIcon className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#17402f]" />
          <DropdownMenuItem
            onClick={signOut}
            className="text-[#d8fff1] focus:bg-[#123226] focus:text-white"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
