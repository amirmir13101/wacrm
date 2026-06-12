"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { HostikoAuthShell } from "@/components/auth/hostiko-auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function passwordValidationError(password: string) {
  if (password.length < 8) return "New password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "New password needs at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "New password needs at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "New password needs at least one number.";
  return null;
}

export default function ForcedPasswordChangePage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = passwordValidationError(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Password update failed.");
      await supabase.auth.signOut().catch(() => undefined);
      toast.success("Password changed. Please sign in with your new password.");
      setNewPassword("");
      setConfirmPassword("");
      window.location.replace("/login?password_changed=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password update failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <HostikoAuthShell
      title="Secure Your Team Member Account"
      description="Please create a new password before continuing."
      eyebrow="First login security"
    >
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-[#d8fff1]">
                New password
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#d8fff1]">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="h-11 rounded-full border-[#315846] bg-[#0d1b15] px-4 text-white focus-visible:border-[#3ddf84] focus-visible:ring-[#3ddf84]/25"
              />
            </div>

            <p className="text-xs leading-5 text-[#7fb9a9]">
              Use at least 8 characters with uppercase, lowercase, and a number.
            </p>

            <Button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-full bg-[#3ddf84] font-semibold text-[#07130e] hover:bg-[#ffbd29]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save password"
              )}
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            onClick={() => void logout()}
            className="mt-3 w-full rounded-full text-[#b8cfc7] hover:bg-[#143326] hover:text-white"
          >
            Logout
          </Button>
    </HostikoAuthShell>
  );
}
