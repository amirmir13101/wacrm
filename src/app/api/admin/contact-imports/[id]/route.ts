import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(
  request: Request,
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
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const requestedPageSize = parsePositiveInt(url.searchParams.get("pageSize"), 100);
  const pageSize = PAGE_SIZE_OPTIONS.includes(
    requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? requestedPageSize
    : 100;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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

  const [{ data: rows, error: rowsError, count }, { data: uploader }] = await Promise.all([
    admin
      .from("admin_contact_import_rows")
      .select("id, contact_id, name, phone, city, category, opt_in_status, raw_data, created_at", {
        count: "exact",
      })
      .eq("import_id", id)
      .order("created_at", { ascending: true })
      .range(from, to),
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
    page,
    pageSize,
    total: count ?? 0,
  });
}
