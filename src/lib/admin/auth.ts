import { createClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" || profile.approval_status !== "approved") {
    return { error: "Admin access required", status: 403 as const };
  }

  return { user, profile };
}
