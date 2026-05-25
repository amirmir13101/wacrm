"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Mail, MessageSquare, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface InviteInfo {
  invited_email: string;
  role: string;
  workspace_name?: string | null;
  expires_at: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabase = createClient();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInvite() {
      setLoading(true);
      const [{ data: sessionResult }, validateResponse] = await Promise.all([
        supabase.auth.getUser(),
        fetch("/api/invite/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      ]);
      const payload = await validateResponse.json().catch(() => ({}));
      if (cancelled) return;
      setUserEmail(sessionResult.user?.email ?? null);
      if (!validateResponse.ok) {
        setError(payload?.error ?? "Invitation is invalid");
        setLoading(false);
        return;
      }
      setInvite(payload.invitation);
      setLoading(false);
    }
    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [supabase, token]);

  async function acceptInvite() {
    setAccepting(true);
    setError(null);
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await res.json().catch(() => ({}));
    setAccepting(false);
    if (!res.ok) {
      setError(payload?.error ?? "Failed to accept invitation");
      return;
    }
    setAccepted(true);
    setTimeout(() => router.push("/dashboard"), 900);
  }

  const invitedEmail = invite?.invited_email ?? "";
  const emailMatches =
    userEmail && invitedEmail && userEmail.toLowerCase() === invitedEmail.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            {error ? (
              <XCircle className="h-6 w-6 text-amber-400" />
            ) : accepted ? (
              <CheckCircle className="h-6 w-6 text-violet-400" />
            ) : (
              <MessageSquare className="h-6 w-6 text-violet-500" />
            )}
          </div>
          <CardTitle className="text-xl text-white">
            {accepted ? "Invitation accepted" : "Workspace invitation"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {loading
              ? "Checking invitation..."
              : invite
                ? `Join ${invite.workspace_name || "this workspace"} as ${invite.role}.`
                : "We could not load this invitation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          )}

          {invite && !accepted && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-violet-300" />
                <span>This invitation was sent to</span>
              </div>
              <p className="mt-2 font-medium text-white">{invite.invited_email}</p>
              <p className="mt-2 text-xs text-slate-500">
                Expires {new Date(invite.expires_at).toLocaleString()}.
              </p>
            </div>
          )}

          {!loading && invite && !userEmail && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={`/login?invite_token=${encodeURIComponent(token)}`}>
                <Button className="w-full bg-violet-600 text-white hover:bg-violet-500">
                  Login with this email
                </Button>
              </Link>
              <Link
                href={`/signup?invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitedEmail)}`}
              >
                <Button variant="outline" className="w-full border-slate-700 text-slate-200 hover:bg-slate-800">
                  Create account
                </Button>
              </Link>
            </div>
          )}

          {!loading && invite && userEmail && !emailMatches && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                You are logged in as <span className="text-white">{userEmail}</span>.
                This invitation was sent to <span className="text-white">{invite.invited_email}</span>.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = `/login?invite_token=${encodeURIComponent(token)}`;
                }}
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Login with invited email
              </Button>
            </div>
          )}

          {!loading && invite && userEmail && emailMatches && !accepted && (
            <Button
              onClick={acceptInvite}
              disabled={accepting}
              className="w-full bg-violet-600 text-white hover:bg-violet-500"
            >
              {accepting ? "Accepting..." : "Accept invitation"}
            </Button>
          )}

          {accepted && (
            <p className="text-center text-sm text-slate-400">
              Redirecting to your workspace dashboard...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
