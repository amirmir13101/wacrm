"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            <LockKeyhole className="h-6 w-6 text-violet-400" />
          </div>
          <CardTitle className="text-xl text-white">Create a new password</CardTitle>
          <CardDescription className="text-slate-400">
            Please create a new password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-300">
                New password
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Use at least 8 characters with uppercase, lowercase, and a number.
            </p>

            <Button
              type="submit"
              disabled={saving}
              className="h-10 w-full bg-violet-600 text-white hover:bg-violet-500"
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
            className="mt-3 w-full text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
