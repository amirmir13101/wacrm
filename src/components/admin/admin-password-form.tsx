"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function passwordValidationError(password: string) {
  if (password.length < 8) return "New password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "New password needs at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "New password needs at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "New password needs at least one number.";
  return null;
}

export function AdminPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (currentPassword === newPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Password update failed.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Password update failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="currentPassword" className="text-slate-300">
            Current password
          </Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className="border-slate-700 bg-slate-950 text-white"
          />
        </div>
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
            className="border-slate-700 bg-slate-950 text-white"
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
            className="border-slate-700 bg-slate-950 text-white"
          />
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Use at least 8 characters with uppercase, lowercase, and a number.
      </p>

      <Button
        type="submit"
        disabled={saving}
        className="bg-violet-600 text-white hover:bg-violet-500"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Changing...
          </>
        ) : (
          "Change Password"
        )}
      </Button>
    </form>
  );
}
