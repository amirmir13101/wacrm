import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const { id } = await params;
  const admin = supabaseAdmin();
  const { data: importRow, error: importError } = await admin
    .from("admin_contact_imports")
    .select(
      "id, workspace_id, uploaded_by_user_id, campaign_name, source, total_count, valid_count, invalid_count, created_at, workspace:workspaces(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (importError) return NextResponse.json({ error: importError.message }, { status: 500 });
  if (!importRow) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  const [{ data: rows, error: rowsError }, { data: uploader }] = await Promise.all([
    admin
      .from("admin_contact_import_rows")
      .select("id, contact_id, name, phone, city, category, opt_in_status, raw_data, created_at")
      .eq("import_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("user_id", importRow.uploaded_by_user_id)
      .maybeSingle(),
  ]);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  return NextResponse.json({
    import: {
      ...importRow,
      uploader: uploader ?? null,
    },
    rows: rows ?? [],
  });
}
