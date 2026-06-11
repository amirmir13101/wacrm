"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Upload, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/contacts", label: "Uploaded Contact Lists", icon: Upload },
];

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/95 p-5 md:block">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Platform Admin</p>
              <p className="text-xs text-slate-500">System controls</p>
            </div>
          </Link>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-violet-600 text-white"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Button
            type="button"
            variant="outline"
            onClick={() => void logout()}
            className="mt-8 w-full justify-start border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </aside>

        <main className="flex-1">
          <div className="border-b border-slate-800 bg-slate-950/95 p-4 md:hidden">
            <div className="flex items-center justify-between">
              <Link href="/admin" className="font-semibold text-white">
                Platform Admin
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void logout()}
                className="border-slate-800 text-slate-300"
              >
                Logout
              </Button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-md border border-slate-800 px-3 py-1.5 text-sm text-slate-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
