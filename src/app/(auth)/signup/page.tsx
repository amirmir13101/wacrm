"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { HostikoAuthShell } from "@/components/auth/hostiko-auth-shell";
import { friendlyAuthError, inviteAuthPath, inviteUrl } from "@/lib/team/invitations";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") ?? "";
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cookieInviteActive, setCookieInviteActive] = useState(false);
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
  const supabase = createClient();

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
          setEmail(payload.invitation.invited_email);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [inviteRequested, inviteToken]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    if (!inviteActive) {
      const check = await fetch("/api/auth/signup-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkBody = await check.json().catch(() => ({}));
      if (!check.ok) {
        setError(checkBody?.error ?? "Unable to create account with this email.");
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: inviteToken
          ? inviteUrl(inviteToken)
          : inviteActive
            ? `${window.location.origin}/invite/accept`
            : undefined,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(friendlyAuthError(error.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <HostikoAuthShell
        title="Account pending approval"
        description="Your WhatsApp CRM workspace account is almost ready."
      >
          <div className="rounded-[24px] border border-[#315846] bg-[#0d1b15] p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3ddf84]/15">
              <CheckCircle className="h-6 w-6 text-[#3ddf84]" />
            </div>
            <p className="text-sm leading-6 text-[#b8cfc7]">
              {inviteActive
                ? "Account created. Please confirm your email if required, then return to this invite link or sign in to finish joining the workspace."
                : "Your account has been created and is pending admin approval."}
              {email ? (
                <>
                  {" "}
                  We&apos;ve also sent any required confirmation email to{" "}
                  <span className="text-white">{email}</span>.
                </>
              ) : null}
            </p>
            <Link href={inviteActive ? inviteAuthPath("/login", inviteToken) : "/login"}>
              <Button
                variant="outline"
                className="mt-5 w-full rounded-full border-[#315846] text-[#d8fff1] hover:bg-[#143326] hover:text-white"
              >
                Back to sign in
              </Button>
            </Link>
          </div>
      </HostikoAuthShell>
    );
  }

  return (
    <HostikoAuthShell
      title="Create Your WhatsApp CRM Workspace"
      description={
        inviteActive
          ? "Create your agent account with the invited email and join the assigned workspace."
          : "Start your Talk Wagon workspace for WhatsApp customer conversations, contacts, broadcasts, automation, team agents, and follow-ups."
      }
    >
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-[#d8fff1]">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

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
                readOnly={inviteActive}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-[#d8fff1]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-[#d8fff1]">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white placeholder:text-[#7fb9a9] focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-full bg-[#3ddf84] font-semibold text-[#07130e] hover:bg-[#ffbd29] disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#b8cfc7]">
            Already have an account?{" "}
            <Link
              href={inviteActive ? inviteAuthPath("/login", inviteToken) : "/login"}
              className="font-medium text-[#ffbd29] hover:text-[#ffe29a]"
            >
              Sign in
            </Link>
          </p>
    </HostikoAuthShell>
  );
}
