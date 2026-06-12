"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { HostikoAuthShell } from "@/components/auth/hostiko-auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <HostikoAuthShell
        title="Check your email"
        description="Use the reset link to return to your secure WhatsApp CRM account."
      >
          <div className="rounded-[24px] border border-[#315846] bg-[#0d1b15] p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3ddf84]/15">
              <CheckCircle className="h-6 w-6 text-[#3ddf84]" />
            </div>
            <p className="text-sm leading-6 text-[#b8cfc7]">
              We&apos;ve sent a password reset link to{" "}
              <span className="text-white">{email}</span>. Please check your
              inbox.
            </p>
            <Link href="/login">
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
      title="Reset Your WhatsApp CRM Password"
      description="Enter your email and we will send a secure reset link for your CRM account."
    >
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
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

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-full bg-[#3ddf84] font-semibold text-[#07130e] hover:bg-[#ffbd29] disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-[#b8cfc7] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
    </HostikoAuthShell>
  );
}
