"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HostikoAuthShell } from "@/components/auth/hostiko-auth-shell";
import { friendlyAuthError, inviteAcceptPath, inviteAuthPath } from "@/lib/team/invitations";
import { refreshClientRoute } from "@/lib/ui/post-mutation";

const AUTH_BOOTSTRAP_RETRY_DELAYS = [0, 200, 500, 1000];

async function wait(ms: number) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAuthBootstrap() {
  let lastError = "Login succeeded, but your workspace could not be loaded. Please try again.";

  for (const delay of AUTH_BOOTSTRAP_RETRY_DELAYS) {
    await wait(delay);
    const res = await fetch("/api/auth/bootstrap", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));

    if (res.ok && typeof body.redirectTo === "string") {
      return body.redirectTo as string;
    }

    if (typeof body.error === "string" && body.error) {
      lastError = body.error;
    }

    if (res.status !== 401 && res.status !== 500) {
      break;
    }
  }

  throw new Error(lastError);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [cookieInviteActive, setCookieInviteActive] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [inviteToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("invite_token") ?? "";
  });
  const [inviteRequested] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("invite") === "1" || params.get("redirect") === "/invite/accept";
  });
  const [passwordChanged] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("password_changed") === "1";
  });
  const inviteActive = Boolean(inviteToken || cookieInviteActive);
  const inviteRedirectPath = inviteToken
    ? inviteAcceptPath(inviteToken)
    : inviteActive
      ? inviteAcceptPath()
      : "/dashboard";

  useEffect(() => {
    let cancelled = false;
    if (inviteToken || !inviteRequested) return;
    fetch("/api/invite/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (cancelled) return;
        setCookieInviteActive(true);
        if (payload?.invitation?.invited_email) {
          setInviteEmail(payload.invitation.invited_email);
          setEmail((current) => current || payload.invitation.invited_email);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [inviteRequested, inviteToken]);

  useEffect(() => {
    if (passwordChanged) {
      setInfo("Password changed. Please sign in with your new password.");
    }
  }, [passwordChanged]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      setInfo(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(friendlyAuthError(error.message));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Login succeeded, but your session was not ready. Please try again.");
      }

      if (inviteActive) {
        refreshClientRoute(router, inviteRedirectPath);
        return;
      }

      const redirectTo = await loadAuthBootstrap();
      refreshClientRoute(router, redirectTo);
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <HostikoAuthShell
      title="Login to Your WhatsApp CRM Dashboard"
      description={
        inviteActive
          ? "Sign in with the invited email to join the workspace and open your assigned CRM dashboard."
          : "Access your team inbox, contacts, broadcasts, automation workflows, and customer conversations."
      }
    >
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-2xl border border-[#3ddf84]/30 bg-[#3ddf84]/10 px-4 py-3 text-sm text-[#b8ffe0]">
                {info}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-[#d8fff1]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#d8fff1]">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-full bg-[#3ddf84] font-semibold text-[#07130e] hover:bg-[#ffbd29] disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#b8cfc7]">
            Don&apos;t have an account?{" "}
            <Link
              href={inviteActive ? inviteAuthPath("/signup", inviteToken, inviteEmail || email) : "/signup"}
              className="font-medium text-[#ffbd29] hover:text-[#ffe29a]"
            >
              Create account
            </Link>
          </p>
    </HostikoAuthShell>
  );
}
