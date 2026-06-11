"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { authenticatedRedirectPath } from "@/lib/auth/approval";
import { friendlyAuthError, inviteAcceptPath, inviteAuthPath } from "@/lib/team/invitations";
import { refreshClientRoute } from "@/lib/ui/post-mutation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(friendlyAuthError(error.message));
        return;
      }

      await supabase.auth.refreshSession().catch(() => undefined);

      if (inviteActive) {
        refreshClientRoute(router, inviteRedirectPath);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase
            .from("profiles")
            .select("role, approval_status, account_type, must_change_password")
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null };

      refreshClientRoute(router, authenticatedRedirectPath(profile));
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            <MessageSquare className="h-6 w-6 text-violet-500" />
          </div>
          <CardTitle className="text-xl text-white">Welcome back</CardTitle>
          <CardDescription className="text-slate-400">
            {inviteActive ? "Sign in with the invited email to join the workspace" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-violet-500 hover:text-violet-400"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href={inviteActive ? inviteAuthPath("/signup", inviteToken, inviteEmail || email) : "/signup"}
              className="text-violet-500 hover:text-violet-400"
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
