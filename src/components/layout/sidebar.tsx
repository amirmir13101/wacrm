"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions";
import type { WorkspacePermission } from "@/lib/team/permissions";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  Bot,
  Settings,
  LogOut,
  User,
  UserCheck,
  X,
} from "lucide-react";
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

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: WorkspacePermission;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view_dashboard" },
  { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "view_inbox" },
  { href: "/contacts", label: "Contacts", icon: Users, permission: "view_contacts" },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch, permission: "view_pipeline" },
  { href: "/broadcasts", label: "Broadcasts", icon: Radio, permission: "view_broadcasts" },
  { href: "/automations", label: "Automations", icon: Zap, permission: "view_automations" },
  { href: "/ai-chatbot", label: "AI Chatbot", icon: Bot, permission: "view_rag_chatbot" },
  { href: "/starter-rag", label: "Starter RAG", icon: Bot, permission: "view_rag_chatbot" },
  { href: "/team", label: "Team", icon: UserCheck, permission: "view_team" },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const workspace = useWorkspacePermissions();
  const totalUnread = useTotalUnread();
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/team") {
      return workspace.has("view_team") || workspace.has("manage_team_members");
    }
    return workspace.has(item.permission);
  });
  const settingsVisible = workspace.has("view_settings");
  const visibleBottomNavItems = settingsVisible ? bottomNavItems : [];

  async function switchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === workspace.workspaceId) return;
    const res = await fetch("/api/team/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    if (res.ok) {
      await workspace.refresh();
      router.push("/dashboard");
      router.refresh();
    }
  }

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-[#17402f] bg-[#07130e]",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible — reset all the mobile framing.
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#17402f] bg-[#07130e] px-4 lg:justify-center">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center rounded-2xl px-1.5 py-1 transition-colors hover:bg-[#123226] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ddf84]"
          >
            <span className="truncate text-xl font-extrabold tracking-tight text-white">
              <span className="text-[#ffbd29]">Talk</span>{" "}
              <span className="text-white">Wagon</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#b8cfc7] hover:bg-[#123226] hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {workspace.workspaces.length > 1 && (
            <div className="mb-3 rounded-xl border border-[#214b39] bg-[#0d1b15] p-2">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.16em] text-[#8bb4a5]">
                Workspace
              </label>
              <select
                value={workspace.workspaceId ?? ""}
                onChange={(event) => switchWorkspace(event.target.value)}
                className="h-9 w-full rounded-lg border border-[#315846] bg-[#07130e] px-2 text-xs text-white outline-none focus:border-[#3ddf84] focus:ring-2 focus:ring-[#3ddf84]/20"
              >
                {workspace.workspaces.map((item) => (
                  <option key={item.workspace_id} value={item.workspace_id}>
                    {item.workspace_name || "Workspace"} ({item.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <ul className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isActive;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      // Taller on mobile so fingers can hit the row reliably (≥44px).
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-[#3ddf84] text-[#07130e] shadow-[0_10px_26px_rgba(61,223,132,0.18)]"
                        : "text-[#c7ddd5] hover:bg-[#123226] hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {showUnreadDot && (
                      <span
                        aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                        className="relative flex h-2 w-2"
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffbd29] opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffbd29]" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-[#17402f]" />

          <ul className="flex flex-col gap-1">
            {visibleBottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-[#3ddf84] text-[#07130e] shadow-[0_10px_26px_rgba(61,223,132,0.18)]"
                        : "text-[#c7ddd5] hover:bg-[#123226] hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-[#17402f] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#123226] focus:bg-[#123226] focus:outline-none data-popup-open:bg-[#123226]">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-[#3ddf84]/15 text-sm font-medium text-[#3ddf84]">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-[#8bb4a5]">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 border-[#315846] bg-[#07130e] text-[#eafff3] ring-[#315846]"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
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
                    onClick={onClose}
                    className="text-[#d8fff1] focus:bg-[#123226] focus:text-white"
                  />
                }
              >
                <Settings className="size-4" />
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
        </div>
      </aside>
    </>
  );
}
