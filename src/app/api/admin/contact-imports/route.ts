import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const requestedPageSize = parsePositiveInt(url.searchParams.get("pageSize"), 50);
  const pageSize = PAGE_SIZE_OPTIONS.includes(
    requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? requestedPageSize
    : 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = supabaseAdmin();
  const { data, error, count } = await admin
    .from("admin_contact_imports")
    .select(
      "id, workspace_id, uploaded_by_user_id, campaign_name, source, total_count, valid_count, invalid_count, created_at, workspace:workspaces(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

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
    page,
    pageSize,
    total: count ?? 0,
  });
}

export async function DELETE(request: Request) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string" && id))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one uploaded contact list to delete." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const { error: rowsError } = await admin
    .from("admin_contact_import_rows")
    .delete()
    .in("import_id", ids);

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("admin_contact_imports")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    deleted_ids: (data ?? []).map((row) => row.id),
    deleted_count: data?.length ?? 0,
  });
}
