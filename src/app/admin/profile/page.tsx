import { CalendarDays, Mail, ShieldCheck, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPasswordForm } from "@/components/admin/admin-password-form";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProfilePage() {
  const adminCheck = await requirePlatformAdmin();

  if ("error" in adminCheck) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
        {adminCheck.error}
      </div>
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, approval_status, created_at")
    .eq("user_id", adminCheck.user.id)
    .maybeSingle();

  const createdAt = profile?.created_at
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(profile.created_at))
    : "Not available";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-violet-300">Platform admin</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Profile</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your platform administrator account details.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-violet-300" />
            Admin account
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            icon={User}
            label="Name"
            value={profile?.full_name?.trim() || "Not set"}
          />
          <ProfileField
            icon={Mail}
            label="Email"
            value={profile?.email || adminCheck.user.email || "Not available"}
          />
          <ProfileField
            icon={ShieldCheck}
            label="Role"
            value={profile?.role || "admin"}
          />
          <ProfileField
            icon={ShieldCheck}
            label="Approval status"
            value={profile?.approval_status || "approved"}
          />
          <ProfileField
            icon={CalendarDays}
            label="Account created"
            value={createdAt}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="break-words text-sm font-medium text-white">{value}</p>
    </div>
  );
}
