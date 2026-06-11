import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/automations/admin-client";
import { requireCurrentWorkspace } from "@/lib/team/server";

interface ImportAuditRow {
  contact_id?: string | null;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  category?: string | null;
  opt_in_status?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace();
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    );
  }

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? (body.rows as ImportAuditRow[]) : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No import rows provided" }, { status: 400 });
  }
  if (rows.length > 10000) {
    return NextResponse.json({ error: "Import audit is too large" }, { status: 400 });
  }

  const totalCount = Number.isFinite(body.total_count) ? Number(body.total_count) : rows.length;
  const validCount = Number.isFinite(body.valid_count) ? Number(body.valid_count) : rows.length;
  const invalidCount = Number.isFinite(body.invalid_count) ? Number(body.invalid_count) : 0;
  const campaignName =
    typeof body.campaign_name === "string" && body.campaign_name.trim()
      ? body.campaign_name.trim().slice(0, 160)
      : "Contact import";

  const admin = supabaseAdmin();
  const { data: importRow, error: importError } = await admin
    .from("admin_contact_imports")
    .insert({
      workspace_id: workspaceResult.workspace.workspaceId,
      uploaded_by_user_id: workspaceResult.workspace.userId,
      campaign_name: campaignName,
      source: typeof body.source === "string" ? body.source.slice(0, 80) : "contacts_csv",
      total_count: totalCount,
      valid_count: validCount,
      invalid_count: invalidCount,
    })
    .select("id")
    .single();

  if (importError) return NextResponse.json({ error: importError.message }, { status: 500 });

  const auditRows = rows.map((row) => ({
    import_id: importRow.id,
    workspace_id: workspaceResult.workspace.workspaceId,
    uploaded_by_user_id: workspaceResult.workspace.userId,
    contact_id: row.contact_id ?? null,
    name: row.name ?? null,
    phone: row.phone ?? null,
    city: row.city ?? null,
    category: row.category ?? null,
    opt_in_status: row.opt_in_status ?? null,
    raw_data: row.raw_data ?? {},
  }));

  const { error: rowsError } = await admin
    .from("admin_contact_import_rows")
    .insert(auditRows);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  return NextResponse.json({ success: true, import_id: importRow.id });
}
