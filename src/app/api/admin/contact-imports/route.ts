import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function GET() {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("admin_contact_imports")
    .select(
      "id, workspace_id, uploaded_by_user_id, campaign_name, source, total_count, valid_count, invalid_count, created_at, workspace:workspaces(name)",
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((row) => row.uploaded_by_user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
    : { data: [] };
  const profileByUserId = new Map(
    ((profiles ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>).map(
      (profile) => [profile.user_id, profile],
    ),
  );

  return NextResponse.json({
    imports: (data ?? []).map((row) => ({
      ...row,
      uploader: profileByUserId.get(row.uploaded_by_user_id) ?? null,
    })),
  });
}
